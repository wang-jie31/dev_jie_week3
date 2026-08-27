"""登录限流（第 8 步 S-34）。

契约（《02-开发技术文档》§6.1 / §8.1）：
- 每 IP 每分钟最多 5 次失败的登录尝试；超限返回 429 + Retry-After。
- 实现：内存滑动窗口（dict[ip, deque[timestamp]]），单进程内存即可
  （方案明确 v1 不引 Redis，多进程部署时由 Nginx 层限流兜底）。
- 成功登录即清空该 IP 记录（避免正常用户被误伤）。

线程安全：FastAPI 同步端点跑在线程池，用 threading.Lock 保护共享状态。
"""

from __future__ import annotations

import threading
import time
from collections import deque

# 每 IP 每分钟最大失败次数
_MAX_FAILS_PER_MIN = 5
_WINDOW_SEC = 60
# 返回前的冷却秒数（429 Retry-After）
_RETRY_AFTER_SEC = 60

_lock = threading.Lock()
_fails: dict[str, deque[float]] = {}


def check_login_allowed(ip: str) -> tuple[bool, int]:
    """检查该 IP 是否允许登录。

    返回 (allowed, retry_after_seconds)。allowed=False 表示触发限流，
    应返回 HTTP 429，Retry-After = retry_after_seconds。
    """
    now = time.monotonic()
    with _lock:
        q = _fails.get(ip)
        if not q:
            return True, 0
        # 清理窗口外的旧记录
        while q and now - q[0] > _WINDOW_SEC:
            q.popleft()
        if len(q) >= _MAX_FAILS_PER_MIN:
            # 最早一条失败距现在多久 → 还需等多久
            oldest = q[0] if q else now
            wait = int(_WINDOW_SEC - (now - oldest)) + 1
            return False, max(wait, 1)
        return True, 0


def record_fail(ip: str) -> None:
    """记录一次失败登录尝试。"""
    now = time.monotonic()
    with _lock:
        q = _fails.setdefault(ip, deque(maxlen=_MAX_FAILS_PER_MIN + 1))
        q.append(now)


def record_success(ip: str) -> None:
    """登录成功：清空该 IP 的失败记录。"""
    with _lock:
        _fails.pop(ip, None)