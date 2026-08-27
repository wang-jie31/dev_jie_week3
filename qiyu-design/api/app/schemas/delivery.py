"""交付域 Schemas（projects / construction_sites）。

对齐《02-开发技术文档》§6.4.8/§6.4.10：
- ProjectCreate 含 title/client/designer/site/status/budget/area/style/address/progress/日期/note；
  服务端自动生成 code=QY-{yyyy}-{seq}（§6.4.8），status 默认 lead。
- 9 态状态机校验（§4.3）在 Service 层，违规 code=4003。
- SiteCreate：name 必填 + 可选 project_id；删除为硬删（§6.4.10）。
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

# ---------- 通用响应包装（与 lead.py 同款） ----------

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = 0
    message: str = "ok"
    data: T | None = None


class ApiListResponse(BaseModel, Generic[T]):
    items: list[T] = Field(default_factory=list)
    total: int = 0
    page: int | None = None
    pageSize: int | None = None


# ---------- Project ----------

PROJECT_STATUSES = (
    "lead",
    "measuring",
    "designing",
    "quoting",
    "signed",
    "constructing",
    "acceptance",
    "done",
    "cancelled",
)


class ProjectBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    client_name: str | None = Field(default=None, max_length=60)
    client_phone: str | None = Field(default=None, max_length=20)
    designer_id: int | None = None
    designer_name: str | None = Field(default=None, max_length=60)
    site_id: int | None = None
    status: str = Field(default="lead", pattern=r"^(lead|measuring|designing|quoting|signed|constructing|acceptance|done|cancelled)$")
    budget: Decimal | None = Field(default=None, ge=0)
    area: Decimal | None = Field(default=None, ge=0)
    style: str | None = Field(default=None, max_length=60)
    address: str | None = Field(default=None, max_length=200)
    progress: int = Field(default=0, ge=0, le=100)
    start_date: date | None = None
    expected_end_date: date | None = None
    note: str | None = Field(default=None, max_length=2000)


class ProjectCreate(ProjectBase):
    """后台新建（§6.4.8）：code 由服务端自动生成。"""


class ProjectUpdate(ProjectBase):
    """后台全量更新（PUT）。"""


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    client_name: str | None
    client_phone: str | None
    designer_id: int | None
    designer_name: str | None
    site_id: int | None
    status: str
    budget: Decimal | None
    area: Decimal | None
    style: str | None
    address: str | None
    progress: int
    start_date: date | None
    expected_end_date: date | None
    note: str | None
    created_at: datetime
    updated_at: datetime


# ---------- Site ----------

class SiteBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    supervisor: str | None = Field(default=None, max_length=60)
    phone: str | None = Field(default=None, max_length=20)
    project_id: int | None = None
    remark: str | None = Field(default=None, max_length=1000)


class SiteCreate(SiteBase):
    """后台新建工地（§6.4.10）。"""


class SiteUpdate(SiteBase):
    """后台全量更新。"""


class SiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: str | None
    supervisor: str | None
    phone: str | None
    project_id: int | None
    remark: str | None
    created_at: datetime