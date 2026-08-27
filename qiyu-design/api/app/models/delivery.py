"""交付域 ORM（2 表：projects / construction_sites）。

对齐《03-数据库设计文档》§5.3.9/§5.3.10 DDL（第 2 步已由 0001_initial 迁移落库）。
- projects：9 态状态机（§4.3）+ code 自动生成 QY-{yyyy}-{seq} + progress ∈ [0,100]；
  designer_id → staff.id（组织域）；site_id ↔ construction_sites 循环外键（双向 ON DELETE SET NULL）。
- construction_sites：工地联系，DELETE 为硬删（对齐 §6.4.10），删时关联 projects.site_id 置 NULL。
软删除约定：projects 用 deleted_at 软删；sites 硬删。
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Identity, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Project(Base):
    """项目表：9 态状态机 + 进度 + 设计师/工地关联。"""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    client_name: Mapped[str | None] = mapped_column(String(60))
    client_phone: Mapped[str | None] = mapped_column(String(20))
    designer_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("staff.id", ondelete="SET NULL"))
    designer_name: Mapped[str | None] = mapped_column(String(60))
    site_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("construction_sites.id", ondelete="SET NULL"),  # 循环外键（ORM 显式声明，DB 层 ALTER 追加）
    )
    status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("status IN ('lead','measuring','designing','quoting','signed','constructing','acceptance','done','cancelled')"),
        nullable=False, server_default="lead",
    )
    budget: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    area: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    style: Mapped[str | None] = mapped_column(String(60))
    address: Mapped[str | None] = mapped_column(String(200))
    progress: Mapped[int] = mapped_column(
        Integer, CheckConstraint("progress BETWEEN 0 AND 100"),
        nullable=False, server_default="0",
    )
    start_date: Mapped[date | None] = mapped_column(Date)
    expected_end_date: Mapped[date | None] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    site: Mapped["ConstructionSite | None"] = relationship(foreign_keys=[site_id], viewonly=True)


class ConstructionSite(Base):
    """工地联系表：关联 project（循环外键）；DELETE 硬删。"""

    __tablename__ = "construction_sites"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(String(300))
    supervisor: Mapped[str | None] = mapped_column(String(60))
    phone: Mapped[str | None] = mapped_column(String(20))
    project_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("projects.id", ondelete="SET NULL"))
    remark: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 保留列（DDL 有），但业务硬删

    # 注释：project 反向关系不定义（与 Project.site 循环外键同向，SQLAlchemy 会报 ArgumentError）