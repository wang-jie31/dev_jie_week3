"""内容域 ORM 模型（8 表：cases / case_images / packages / package_process_steps / news / careers / team_members / content_view_stats）。

对齐《03-数据库设计文档》§5 建表 DDL（第 2 步已由 0001_initial 迁移落库）。
软删除约定：查询默认过滤 deleted_at IS NULL；布尔状态用 status 三态（draft/published/offline）。
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Identity, Integer, Numeric, SmallInteger, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Case(Base):
    """案例表：多维筛选（分类/风格/户型/面积/排序/关键词）由仓储层实现。"""

    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("category IN ('private','small','apartment')"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    cover: Mapped[str] = mapped_column(String(500), nullable=False, server_default="")
    gallery: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    video_url: Mapped[str | None] = mapped_column(String(500))
    summary: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str | None] = mapped_column(Text)
    style_tags: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    house_type_tags: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    area_range: Mapped[str | None] = mapped_column(String(40))
    location: Mapped[str | None] = mapped_column(String(200))
    area: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    year: Mapped[int | None] = mapped_column(Integer)
    designer: Mapped[str | None] = mapped_column(String(100))
    studio: Mapped[str | None] = mapped_column(String(100))
    material_notes: Mapped[str | None] = mapped_column(Text)
    price_per_sqm: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    price_note: Mapped[str | None] = mapped_column(String(200))
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("status IN ('draft','published','offline')"),
        nullable=False, server_default="draft",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    images: Mapped[list["CaseImage"]] = relationship(
        back_populates="case", cascade="all, delete-orphan", order_by="CaseImage.sort",
    )


class CaseImage(Base):
    """案例图集：case_id 外键 + 排序。"""

    __tablename__ = "case_images"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    case_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")

    case: Mapped[Case] = relationship(back_populates="images")


class Package(Base):
    """套餐表：双轨价格（price_per_sqm + price_from）+ 面积区间系数。"""

    __tablename__ = "packages"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("type IN ('single_space','whole_house','style')"),
        nullable=False,
    )
    cover: Mapped[str] = mapped_column(String(500), nullable=False, server_default="")
    summary: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    applicable_house_type: Mapped[str | None] = mapped_column(String(200))
    price_per_sqm: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    price_from: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    area_step_coefficient: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{\"<60\":1,\"60-90\":1.15,\"90-120\":1.3,\">120\":1.5}'::jsonb"))
    price_note: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("status IN ('draft','published','offline')"),
        nullable=False, server_default="draft",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    process_steps: Mapped[list["PackageProcessStep"]] = relationship(
        back_populates="package", cascade="all, delete-orphan", order_by="PackageProcessStep.step_no",
    )


class PackageProcessStep(Base):
    """套餐流程步骤：step_no 排序。"""

    __tablename__ = "package_process_steps"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    package_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("packages.id", ondelete="CASCADE"), nullable=False)
    step_no: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")

    package: Mapped[Package] = relationship(back_populates="process_steps")


class News(Base):
    """资讯表（企业新闻/行业资讯）。"""

    __tablename__ = "news"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("category IN ('company','industry')"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    cover: Mapped[str] = mapped_column(String(500), nullable=False, server_default="")
    summary: Mapped[str | None] = mapped_column(String(500))
    content: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("status IN ('draft','published','offline')"),
        nullable=False, server_default="draft",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Career(Base):
    """招聘岗位（社会招聘/校园招聘）。"""

    __tablename__ = "careers"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("category IN ('social','campus')"),
        nullable=False,
    )
    location: Mapped[str | None] = mapped_column(String(100))
    type: Mapped[str | None] = mapped_column(String(60))
    duties: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("status IN ('draft','published','offline')"),
        nullable=False, server_default="draft",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TeamMember(Base):
    """团队档案：active 控制前台展示，order 排序，staff_id 关联组织域账号（第 7 步）。"""

    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    title: Mapped[str | None] = mapped_column(String(100))
    avatar: Mapped[str | None] = mapped_column(String(500))
    specialty: Mapped[str | None] = mapped_column(String(200))
    bio: Mapped[str | None] = mapped_column(Text)
    staff_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("staff.id", ondelete="SET NULL"))
    order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ContentViewStat(Base):
    """内容浏览日聚合：(content_type, content_id, stat_date) 复合主键，浏览量去重上报。"""

    __tablename__ = "content_view_stats"

    content_type: Mapped[str] = mapped_column(
        String(20), CheckConstraint("content_type IN ('case','package','news')"),
        primary_key=True, nullable=False,
    )
    content_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, nullable=False)
    stat_date: Mapped[date] = mapped_column(Date, primary_key=True, nullable=False)
    views: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")


class SiteConfig(Base):
    """站点配置单例（id=1）：品牌/公司/流程文案 + 联系 + 社媒 + 首页轮播图（JSONB）。"""

    __tablename__ = "site_config"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)  # 单例 id=1
    company_intro: Mapped[str | None] = mapped_column(Text)
    brand_intro: Mapped[str | None] = mapped_column(Text)
    process_intro: Mapped[str | None] = mapped_column(Text)
    contact_info: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    social_links: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    # 首页轮播图（2026-08-27 功能补全）：[{image, title, en, desc, link, link_label, sort, enabled}]
    home_banners: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")


class SiteHistoryItem(Base):
    """发展历程条目（品牌历程时间轴）。"""

    __tablename__ = "site_history_items"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    year: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")