"""线索域服务层（留言/预约提交 + 后台流转 + 沟通记录）。

对齐《02-开发技术文档》§6.3.12（公开提交）与 §6.4.7（后台线索域）：
- 公开提交：XSS 清洗（§12.4）+ 限流 10/min/IP（§6.1 表：公开 /messages 10 次/分/IP，令牌桶超限 429 + Retry-After）
- 后台：kind 分流查询 / 状态机 4 态流转（§4.3 合法迁移，违规 code=4003）/ threads 只追加不删（审计）
错误码：3001 缺必填、3002 手机号格式、3003 内容缺失、4003 非法状态流转、4040 线索不存在。
"""

from __future__ import annotations

import re
import time
from datetime import datetime
from threading import Lock

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.models.content import TeamMember  # 仅做类型参考，未使用
from app.models.lead import Message, MessageThread

# ---------- 常量 ----------
PHONE_RE = r"^1[3-9]\d{9}$"

# 状态机合法迁移（§4.3 Message 4 态）
MESSAGE_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "new": ("contacted", "closed"),
    "contacted": ("converted", "closed", "new"),
    "converted": (),
    "closed": (),
}

# 限流：公开提交 10/min/IP
PUBLIC_RATE_LIMIT = {
    "max": 10,
    "window": 60,  # 秒
}

# XSS 黑名单标记（简单清洗）：剥离 script/on* 事件/js: 等
XSS_BAD_PATTERNS = [
    re.compile(r"<script[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<[^>]*\bon[a-zA-Z]+\s*=", re.IGNORECASE),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"<iframe[^>]*>.*?</iframe>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<object[^>]*>.*?</object>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<embed[^>]*>.*?</embed>", re.IGNORECASE | re.DOTALL),
]


def sanitize_text(text: str | None) -> str:
    """XSS 清洗：剥离 script/iframe/object/embed 标签与 on* 事件属性。"""
    if not text:
        return text or ""
    for pat in XSS_BAD_PATTERNS:
        text = pat.sub("", text)
    return text.strip()


# ---------- 限流（内存令牌桶，v1 无 Redis；触发条件见文档 §6.1） ----------
class RateLimiter:
    """基于内存滑窗的计数器限流。键：`{ip}:messages`。窗口 60s，超限抛 BizError。"""

    def __init__(self, max_requests: int = 10, window_seconds: int = 60) -> None:
        self.max = max_requests
        self.window = window_seconds
        self._lock = Lock()
        self._buckets: dict[str, list[float]] = {}

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            hits = [t for t in self._buckets.get(key, []) if now - t < self.window]
            if len(hits) >= self.max:
                # 超限：返回 429 语义（业务错误码 3004）
                self._buckets[key] = hits
                raise BizError(3004, "提交过于频繁，请稍后再试")
            hits.append(now)
            self._buckets[key] = hits

    def retry_after(self, key: str) -> int:
        with self._lock:
            hits = [t for t in self._buckets.get(key, []) if time.monotonic() - t < self.window]
            if not hits:
                return 0
            oldest = min(hits)
            return max(1, int(self.window - (time.monotonic() - oldest)))


message_rate_limiter = RateLimiter(PUBLIC_RATE_LIMIT["max"], PUBLIC_RATE_LIMIT["window"])


# ---------- 公开提交 ----------
def create_message_public(
    db: Session,
    *,
    name: str,
    phone: str,
    email: str | None,
    budget: str | None,
    content: str,
    source_page: str | None,
    kind: str = "appointment",
    ip: str = "",
) -> Message:
    """公开提交：校验 → 清洗 → 限流 → 落库 status='new'。"""
    # 必填
    if not name or not name.strip():
        raise BizError(3001, "请填写称呼")
    if not content or not content.strip():
        raise BizError(3001, "请填写咨询内容")
    # 手机号
    if not phone or not re.match(PHONE_RE, phone):
        raise BizError(3002, "手机号格式不正确")
    # 限流（10/min/IP）
    message_rate_limiter.check(f"{ip}:messages")

    # XSS 清洗
    safe_name = sanitize_text(name)
    safe_content = sanitize_text(content)

    msg = Message(
        name=safe_name[:60],
        phone=phone,
        email=sanitize_text(email)[:120] or None,
        budget=sanitize_text(budget)[:120] or None,
        content=safe_content[:2000],
        source_page=sanitize_text(source_page)[:200] or None,
        kind=kind,
        status="new",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


# ---------- 后台：查询 ----------
def list_messages(
    db: Session,
    *,
    kind: str | None = None,
    status: str | None = None,
    source_page: str | None = None,
    keyword: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> dict:
    """后台列表：kind 分流 + 状态过滤 + 关键词（name/phone/content）+ 分页（缺省全量）。"""
    q = db.query(Message).filter(Message.deleted_at.is_(None))
    if kind:
        q = q.filter(Message.kind == kind)
    if status:
        q = q.filter(Message.status == status)
    if source_page:
        q = q.filter(Message.source_page == source_page)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(
            (Message.name.ilike(like))
            | (Message.phone.ilike(like))
            | (Message.content.ilike(like))
        )
    q = q.order_by(Message.created_at.desc(), Message.id.desc())

    total = q.count()
    if page is not None and page_size is not None:
        q = q.offset((page - 1) * page_size).limit(page_size)

    return {"items": q.all(), "total": total}


def get_message(db: Session, message_id: int) -> Message | None:
    return db.query(Message).filter(Message.id == message_id, Message.deleted_at.is_(None)).first()


# ---------- 后台：状态流转 ----------
def update_message_status(db: Session, message: Message, new_status: str) -> Message:
    """4 态流转：合法迁移表校验，违规抛 4003。"""
    allowed = MESSAGE_TRANSITIONS.get(message.status, ())
    if message.status == new_status:
        return message  # 幂等：同态不报错
    if new_status not in allowed:
        raise BizError(4003, f"非法状态流转：{message.status} → {new_status}")
    message.status = new_status
    db.commit()
    db.refresh(message)
    return message


# ---------- 后台：沟通记录（threads） ----------
def append_thread(
    db: Session,
    message: Message,
    *,
    type_: str,
    content: str,
    author: str,
) -> MessageThread:
    """追加沟通记录：type 白名单 + 内容清洗；只追加不删（审计）。"""
    if type_ not in ("phone", "wechat", "sms", "email", "note"):
        raise BizError(3003, "沟通类型不合法")
    if not content or not content.strip():
        raise BizError(3001, "请填写沟通内容")
    thread = MessageThread(
        message_id=message.id,
        type=type_,
        content=sanitize_text(content)[:2000],
        author=sanitize_text(author)[:60] or "系统",
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


# ---------- 后台：补充备注/预算 ----------
def update_message_note(db: Session, message: Message, note: str | None, budget: str | None) -> Message:
    if note is not None:
        message.note = sanitize_text(note)[:2000] or None
    if budget is not None:
        message.budget = sanitize_text(budget)[:120] or None
    db.commit()
    db.refresh(message)
    return message