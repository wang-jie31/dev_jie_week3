"""认证路由（S-25）：登录 / 刷新 / 登出 / 当前用户。

对齐《02-开发技术文档》§8.1 登录鉴权：
  POST /api/v1/admin/login     {username,password} → {access_token, refresh_token, user}
  POST /api/v1/admin/refresh   {refresh_token} → {access_token, refresh_token}
  POST /api/v1/admin/logout    {refresh_token} → 吊销
  GET  /api/v1/admin/me        → 当前用户信息（含角色）
统一响应 {code, message, data}；错误码：2001 账号密码错误、2002 令牌失效、2003 账号禁用。
"""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BizError
from app.core.login_rate import check_login_allowed, record_fail, record_success
from app.schemas.org import LoginIn, LoginOutData, RefreshIn, RefreshOutData
from app.services.org import AuthService

router = APIRouter(prefix="/api/v1/admin", tags=["auth"])


def _ok(data=None) -> dict:
    return {"code": 0, "message": "ok", "data": data}


@router.post("/login", response_model=dict)
def admin_login(payload: LoginIn, request: Request, db: Session = Depends(get_db)) -> dict:
    """后台登录：argon2id 校验 + 双令牌 + 登录日志 + 失败限流（S-34）。"""
    client_ip = request.client.host if request.client else "unknown"

    # S-34：失败次数限流 —— 每 IP 每分钟最多 5 次失败，超限 429
    allowed, retry_after = check_login_allowed(client_ip)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"code": 5004, "message": "操作过于频繁，请稍后再试", "data": None},
            headers={"Retry-After": str(retry_after)},
        )

    try:
        data = AuthService.login(db, payload.username, payload.password, request)
    except BizError as e:
        # 2001/2003 属登录失败 → 计数
        if e.code in (2001, 2003):
            record_fail(client_ip)
        raise
    # 登录成功 → 清空该 IP 失败记录
    record_success(client_ip)
    return _ok(data)


@router.post("/refresh", response_model=dict)
def admin_refresh(payload: RefreshIn, request: Request, db: Session = Depends(get_db)) -> dict:
    """刷新 access_token：校验 refresh 未吊销并轮换。"""
    data = AuthService.refresh(db, payload.refresh_token, request)
    return _ok(data)


@router.post("/logout", response_model=dict)
def admin_logout(payload: RefreshIn, db: Session = Depends(get_db)) -> dict:
    """登出：吊销 refresh_token。"""
    AuthService.logout(db, payload.refresh_token)
    return _ok({"logout": True})


@router.get("/me", response_model=dict)
def admin_me(current_user: dict = Depends(get_current_user)) -> dict:
    """当前登录用户信息（前端侧边栏角色显隐用）。"""
    return _ok(current_user)