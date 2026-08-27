"""revalidate 客户端（第 8 步 S-33）。

设计契约（《02-开发技术文档》§3.5 链路 2 与 §8.3）：
- 后台每一次「影响前台展示」的写操作（案例/套餐/新闻上下架及编辑、
  团队 active 变更、SiteConfig 变更、首页轮播图变更）在 **service 事务提交之后**
  由调用方触发 `revalidate(tag)`，让前台 ISR 即时刷新，不等 revalidate 间隔。
- **失败不回滚业务**：revalidate 是写后副作用，失败仅记告警日志
  （不影响已提交的事务），符合「后台点上架 → 前台即时可见」验收硬性。
- 内部端点走内网：NEXT_REVALIDATE_URL 默认 http://localhost:3000/api/revalidate

性能修复（2026-08-27，后台保存卡顿）：revalidate 由【同步阻塞】改为
【后台线程 fire-and-forget】。原实现每处写操作都会同步 `httpx.post`，
当前台 Next.js 未启动或响应慢时，保存接口会被拖住最多 timeout 秒，
表现为「后台点保存很久没反应」。现改为线程方式，接口立即返回，
revalidate 结果只写日志，不影响用户操作。ADR-001 语义不变。
"""

import httpx
import logging
import threading

from .config import settings

logger = logging.getLogger("app.revalidate")

REVALIDATE_TAGS = ("cases", "packages", "news", "careers", "team", "site", "banners")

# 单次请求超时（秒）：过长会让线程积压，过短可能误报失败
_REVALIDATE_TIMEOUT: float = 1.5


def _do_revalidate(tag: str, timeout: float) -> None:
    """实际执行重验证请求（在线程中运行，永不抛错）。"""
    url = f"{settings.NEXT_REVALIDATE_URL.rstrip('/')}/api/revalidate"
    try:
        resp = httpx.post(
            url,
            json={"tag": tag},
            headers={"x-revalidate-token": settings.NEXT_REVALIDATE_TOKEN},
            timeout=timeout,
        )
        ok = resp.status_code == 200 and resp.json().get("code") == 0
        if not ok:
            logger.warning(
                f"[revalidate] tag={tag} failed status={resp.status_code} body={resp.text[:200]}"
            )
        else:
            logger.info(f"[revalidate] tag={tag} ok")
    except Exception as exc:  # noqa: BLE001 - 失败仅告警，不中断业务
        logger.warning(f"[revalidate] tag={tag} exception: {exc!r}")


def revalidate(tag: str, *, timeout: float = 1.5, sync: bool = False) -> bool:
    """触发前台 ISR 重验证。

    - 默认 `sync=False`：后台线程异步触发，**立即返回 True**，
      不阻塞当前接口响应（后台保存不再卡顿）。
    - `sync=True`：同步执行（仅供脚本/测试用），返回真实结果。
    - 失败仅告警，永不抛错；tag 非法时忽略并返回 False。
    """
    if tag not in REVALIDATE_TAGS:
        logger.warning(f"[revalidate] unknown tag: {tag} (ignored)")
        return False

    if not settings.NEXT_REVALIDATE_URL:
        logger.warning("[revalidate] NEXT_REVALIDATE_URL is empty (skip)")
        return False

    if sync:
        _do_revalidate(tag, timeout)
        return True

    # fire-and-forget：守护线程，接口无需等待
    threading.Thread(
        target=_do_revalidate,
        args=(tag, timeout),
        daemon=True,
        name=f"revalidate-{tag}",
    ).start()
    return True