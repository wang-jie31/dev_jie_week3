"""组织域 ORM（第 7 步补全：员工/部门/登录日志/令牌/敏感访问审计/站点配置）。

表结构映射与 0001_initial 迁移一致（20 张表已在第 2 步落库）。
"""

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Identity, Integer, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Department(Base):
    """部门表。"""

    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    lead: Mapped[str | None] = mapped_column(String(60))
    description: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")


class Staff(Base):
    """内部账号（最小 stub：password_hash/role 第 7 步接入完整鉴权）。"""

    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    username: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(60))
    gender: Mapped[str | None] = mapped_column(
        String(10), CheckConstraint("gender IN ('male','female','unknown')"),
    )
    department_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("departments.id", ondelete="SET NULL"))
    role: Mapped[str] = mapped_column(
        String(20), CheckConstraint("role IN ('admin','sales','design','cs')"),
        nullable=False, server_default="cs",
    )
    salt: Mapped[str] = mapped_column(String(40), nullable=False, server_default="")
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    phone: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(String(300))
    id_card_enc: Mapped[str | None] = mapped_column(Text)
    id_card_nonce: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")


class LoginLog(Base):
    """登录日志（11. login_logs）：每次登录成功/失败落一条。"""

    __tablename__ = "login_logs"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("staff.id", ondelete="SET NULL"))
    username: Mapped[str | None] = mapped_column(String(60))
    name: Mapped[str | None] = mapped_column(String(60))
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(400))
    login_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")


class RefreshToken(Base):
    """刷新令牌（20. refresh_tokens）：SHA-256 哈希落库，可撤销（§9 威胁模型）。"""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    staff_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")


class SensitiveAccessLog(Base):
    """敏感信息访问审计（18. sensitive_access_logs）：身份证解密等敏感读取留痕。"""

    __tablename__ = "sensitive_access_logs"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    target_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    target_field: Mapped[str] = mapped_column(String(30), nullable=False)
    operator_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("staff.id", ondelete="SET NULL"))
    operator_name: Mapped[str | None] = mapped_column(String(60))
    action: Mapped[str] = mapped_column(String(20), nullable=False, server_default="read")
    ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")


# 注：SiteConfig / SiteHistoryItem 已在 app/models/content.py 定义（第 3 步内容域），
# 此处不再重复声明，避免 SQLAlchemy "Table already defined"（重复 __tablename__）。