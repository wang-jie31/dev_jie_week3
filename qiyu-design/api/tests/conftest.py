"""pytest 公共夹具：事务回滚 DB 会话 + TestClient + 角色 JWT。

策略：每个测试开启一个数据库事务，测试结束时 rollback —— 不污染 qiyu 真实数据。
JWT 由 core.security.create_access_token 签发（get_current_user 第 7 步完善前按 payload 解析）。
"""

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# 保证 api/ 目录可导入 app 包
API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))

from app.core.db import engine, get_db  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def db_session():
    """事务内会话：测试结束整体回滚，不落库污染真实数据。"""
    conn = engine.connect()
    trans = conn.begin()
    session = Session(bind=conn, expire_on_commit=False)
    yield session
    session.close()
    trans.rollback()
    conn.close()


@pytest.fixture()
def client(db_session):
    """TestClient：覆盖 get_db 依赖指向事务会话。"""

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _jwt(staff_id: int | str, role: str, username: str = "tester") -> str:
    return create_access_token(str(staff_id), {"username": username, "role": role})


@pytest.fixture()
def admin_token() -> str:
    return _jwt(1, "admin", "admin")


@pytest.fixture()
def design_token() -> str:
    return _jwt(2, "design", "design01")


@pytest.fixture()
def cs_token() -> str:
    return _jwt(3, "cs", "cs01")


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}