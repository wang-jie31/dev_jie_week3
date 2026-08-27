"""FastAPI 依赖：当前用户解析 + RBAC 角色断言（第 7 步补全）。

- get_current_user：校验 Bearer access_token → 查 staff 表确认存在且 active（已删/禁用账号 401）
- require_role：返回依赖函数，角色不匹配抛 BizError(4010, "权限不足")（统一 {code,message} 协议）
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .exceptions import BizError
from .security import decode_token
from app.models.org import Staff

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> dict:
    """解析 Bearer Token → 当前用户（staff 行，active 校验）。"""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未提供认证凭据")
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效或过期的令牌")
    # 查库：账号必须存在且 active
    staff = db.execute(select(Staff).where(Staff.id == int(payload["sub"]))).scalar_one_or_none()
    if staff is None or not staff.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号不存在或已禁用")
    return {
        "id": staff.id,
        "username": staff.username,
        "name": staff.name,
        "role": staff.role,
        "department_id": staff.department_id,
    }


def require_role(*roles: str):
    """RBAC 依赖工厂：当前用户角色不在允许列表则抛 4010 越权。"""

    def _checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise BizError(4010, "权限不足，需要角色：" + "/".join(roles))
        return user

    return _checker