"""内容域 Pydantic Schemas（四层：Base / Create / Update / Out）。

对齐《02-开发技术文档》§6.3（公开 13 个端点，内容部分）与 §6.4（后台内容域 CRUD）。
双轨价格：price_per_sqm（单价）+ price_from（起步总价）+ price_note（服务端自动生成）。
统一响应包装：ApiResponse / ApiListResponse。
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

# ---------- 通用 ----------

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """统一响应包装：{code, message, data}（文档 §6.1）。"""

    code: int = 0
    message: str = "ok"
    data: T | None = None


class ApiListResponse(BaseModel, Generic[T]):
    """统一列表响应：{items, total, page, pageSize}。"""

    items: list[T]
    total: int
    page: int | None = None
    pageSize: int | None = None


class PaginationParams(BaseModel):
    """分页参数（page 从 1 起，pageSize 默认 10、上限 100；缺省返回全量）。"""

    page: int | None = Field(default=None, ge=1)
    pageSize: int | None = Field(default=None, ge=1, le=100)


# ---------- 案例 cases ----------

class CaseBase(BaseModel):
    slug: str = Field(..., min_length=2, max_length=120, pattern=r"^[a-z0-9][a-z0-9-]*$")
    category: str = Field(..., pattern=r"^(private|small|apartment)$")
    title: str = Field(..., min_length=1, max_length=200)
    cover: str = Field(default="", max_length=500)
    gallery: list[str] = Field(default_factory=list)
    video_url: str | None = Field(default=None, max_length=500)
    summary: str | None = None
    content: str | None = None
    style_tags: list[str] = Field(default_factory=list)
    house_type_tags: list[str] = Field(default_factory=list)
    area_range: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=200)
    area: Decimal | None = Field(default=None, ge=0, le=100000)
    year: int | None = Field(default=None, ge=2000, le=2100)
    designer: str | None = Field(default=None, max_length=100)
    studio: str | None = Field(default=None, max_length=100)
    material_notes: str | None = None
    price_per_sqm: Decimal = Field(default=0, ge=0, le=10_000_000)
    is_featured: bool = False
    status: str = Field(default="draft", pattern=r"^(draft|published|offline)$")


class CaseCreate(CaseBase):
    """创建案例（后台 POST /admin/cases）。"""


class CaseUpdate(CaseBase):
    """全量更新案例（后台 PUT /admin/cases/{id}）。"""


class CaseOut(BaseModel):
    """案例公开输出（列表项+详情共用基础字段）。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    category: str
    title: str
    cover: str
    gallery: list[str] = Field(default_factory=list)
    video_url: str | None = None
    summary: str | None = None
    content: str | None = None
    style_tags: list[str] = Field(default_factory=list)
    house_type_tags: list[str] = Field(default_factory=list)
    area_range: str | None = None
    location: str | None = None
    area: Decimal | None = None
    year: int | None = None
    designer: str | None = None
    studio: str | None = None
    material_notes: str | None = None
    price_per_sqm: Decimal = 0
    price_note: str | None = None
    is_featured: bool = False
    view_count: int = 0
    status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CaseListItem(CaseOut):
    """列表项：不含长文 content（轻量）。"""

    content: str | None = None  # 保留字段但列表序列化时不填充


class CaseDetailOut(CaseOut):
    """详情：含 prev/next 上下篇（同 category published）。"""

    prev: "CaseListItem | None" = None
    next: "CaseListItem | None" = None


# ---------- 套餐 packages ----------

class PackageBase(BaseModel):
    slug: str = Field(..., min_length=2, max_length=120, pattern=r"^[a-z0-9][a-z0-9-]*$")
    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., pattern=r"^(single_space|whole_house|style)$")
    cover: str = Field(default="", max_length=500)
    summary: str | None = Field(default=None, max_length=500)
    description: str | None = None
    applicable_house_type: str | None = Field(default=None, max_length=200)
    price_per_sqm: Decimal = Field(default=0, ge=0, le=10_000_000)
    price_from: Decimal = Field(default=0, ge=0, le=100_000_000)
    # 面积区间阶梯系数（对齐原型 admin.html：{"<60":1,"60-90":1.15,"90-120":1.3,">120":1.5}）
    area_step_coefficient: dict = Field(
        default_factory=lambda: {"<60": 1, "60-90": 1.15, "90-120": 1.3, ">120": 1.5}
    )
    status: str = Field(default="draft", pattern=r"^(draft|published|offline)$")
    process_steps: list["PackageProcessStepCreate"] = Field(default_factory=list)


class PackageProcessStepCreate(BaseModel):
    """套餐流程步骤（嵌套在 PackageCreate 内）。"""

    step_no: int = Field(..., ge=1, le=99)
    title: str = Field(..., min_length=1, max_length=120)
    description: str | None = None


class PackageCreate(PackageBase):
    """创建套餐（后台 POST /admin/packages）。"""


class PackageUpdate(PackageBase):
    """全量更新套餐（后台 PUT /admin/packages/{id}）。"""


class PackageOut(BaseModel):
    """套餐公开输出（列表项）。不含 description 长文与步骤。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    type: str
    cover: str
    summary: str | None = None
    applicable_house_type: str | None = None
    price_per_sqm: Decimal = 0
    price_from: Decimal = 0
    area_step_coefficient: dict = Field(
        default_factory=lambda: {"<60": 1, "60-90": 1.15, "90-120": 1.3, ">120": 1.5}
    )
    price_note: str | None = None
    status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PackageListItem(PackageOut):
    """列表项（与 PackageOut 相同结构，语义区分）。"""


class PackageProcessStepOut(BaseModel):
    """套餐步骤输出。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    step_no: int
    title: str
    description: str | None = None


class PackageDetailOut(PackageOut):
    """详情：含 description 长文 + 流程步骤。"""

    description: str | None = None
    process_steps: list[PackageProcessStepOut] = Field(default_factory=list)


# ---------- 新闻 news ----------

class NewsBase(BaseModel):
    slug: str = Field(..., min_length=2, max_length=120, pattern=r"^[a-z0-9][a-z0-9-]*$")
    title: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., pattern=r"^(company|industry)$")
    cover: str = Field(default="", max_length=500)
    summary: str | None = Field(default=None, max_length=500)
    content: str | None = None
    status: str = Field(default="draft", pattern=r"^(draft|published|offline)$")


class NewsCreate(NewsBase):
    """创建资讯（后台 POST /admin/news）。"""


class NewsUpdate(NewsBase):
    """全量更新资讯（后台 PUT /admin/news/{id}）。"""


class NewsOut(BaseModel):
    """资讯输出（列表项+详情）。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    category: str
    cover: str
    summary: str | None = None
    content: str | None = None
    published_at: datetime | None = None
    status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- 招聘 careers ----------

class CareerBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., pattern=r"^(social|campus)$")
    location: str | None = Field(default=None, max_length=100)
    type: str | None = Field(default=None, max_length=60)
    duties: str | None = None
    status: str = Field(default="draft", pattern=r"^(draft|published|offline)$")


class CareerCreate(CareerBase):
    """创建招聘岗位（后台 POST /admin/careers，仅 admin）。"""


class CareerUpdate(CareerBase):
    """全量更新招聘岗位（后台 PUT /admin/careers/{id}，仅 admin）。"""


class CareerOut(BaseModel):
    """招聘岗位输出。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    category: str
    location: str | None = None
    type: str | None = None
    duties: str | None = None
    status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- 团队 team_members ----------

class TeamMemberBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    title: str | None = Field(default=None, max_length=100)
    avatar: str | None = Field(default=None, max_length=500)
    specialty: str | None = Field(default=None, max_length=200)
    bio: str | None = None
    staff_id: int | None = None
    order: int = Field(default=0, ge=0, le=9999)
    active: bool = True


class TeamMemberCreate(TeamMemberBase):
    """创建团队成员（后台 POST /admin/team）。"""


class TeamMemberUpdate(TeamMemberBase):
    """全量更新团队成员（后台 PUT /admin/team/{id}）。"""


class TeamMemberOut(BaseModel):
    """团队成员输出。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    title: str | None = None
    avatar: str | None = None
    specialty: str | None = None
    bio: str | None = None
    staff_id: int | None = None
    order: int = 0
    active: bool = True
    created_at: datetime | None = None


# ---------- 前台聚合 ----------

class HomeOut(BaseModel):
    """首页聚合（§6.3.1）：轮播图 + 精选案例×3 + 上架套餐 + 新闻预览×3 + 关于摘要。"""

    home_banners: list[dict] = Field(default_factory=list)  # 首页轮播（2026-08-27）：[{image,title,en,desc,link,link_label,link2,link2_label,sort,enabled}]
    featured_cases: list[CaseListItem] = Field(default_factory=list)
    published_packages: list[PackageListItem] = Field(default_factory=list)
    news_preview: list[NewsOut] = Field(default_factory=list)
    about_summary: str = ""


# ---------- 站点配置（前台公开部分） ----------

class SiteConfigPublicOut(BaseModel):
    """站点配置公开输出（§6.3.11）：品牌/公司/流程/联系/社媒/历程。"""

    model_config = ConfigDict(from_attributes=True)

    id: int = 1
    company_intro: str | None = None
    brand_intro: str | None = None
    process_intro: str | None = None
    contact_info: dict[str, Any] = Field(default_factory=dict)
    social_links: list[dict[str, Any]] = Field(default_factory=list)
    history_items: list[Any] = Field(default_factory=list)
    updated_at: datetime | None = None