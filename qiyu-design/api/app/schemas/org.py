"""组织域 Schema（S-25~S-28，§7.2 后台接口表）。

- 认证：LoginIn/LoginOut/RefreshIn/RefreshOut
- 账号：StaffCreate/StaffUpdate/StaffOut/StaffDetailOut（脱敏 id_card_mask）
- 部门：DepartmentCreate/DepartmentUpdate/DepartmentOut
- 登录日志：LoginLogOut（CSV 导出由 router 直出 text/csv）
- 站点配置：SiteConfigAdminOut（含 history_items）
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ---------- 通用 ----------
class ApiResponse(BaseModel):
    code: int = 0
    message: str = "ok"
    data: dict | list | None = None


# ---------- 认证（S-25） ----------
class LoginIn(BaseModel):
    """登录请求：username + password 必填。"""

    username: str = Field(..., min_length=1, max_length=60)
    password: str = Field(..., min_length=1, max_length=128)


class LoginOutData(BaseModel):
    access_token: str
    refresh_token: str
    user: dict  # {id, username, name, role, department_id}


class RefreshIn(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class RefreshOutData(BaseModel):
    access_token: str


# ---------- 账号（S-26） ----------
class StaffCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=60)
    name: str = Field(..., min_length=1, max_length=60)
    nickname: str | None = Field(default=None, max_length=60)
    gender: str | None = Field(default=None, pattern=r"^(male|female|unknown)$")
    department_id: int | None = None
    role: str = Field(default="cs", pattern=r"^(admin|sales|design|cs)$")
    password: str = Field(..., min_length=6, max_length=128)
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=300)
    id_card: str | None = Field(default=None, max_length=18)  # 仅创建时接受明文（加密落库）
    active: bool = True


class StaffUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    nickname: str | None = Field(default=None, max_length=60)
    gender: str | None = Field(default=None, pattern=r"^(male|female|unknown)$")
    department_id: int | None = None
    role: str | None = Field(default=None, pattern=r"^(admin|sales|design|cs)$")
    password: str | None = Field(default=None, min_length=6, max_length=128)  # 提供则重哈希
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=300)
    id_card: str | None = Field(default=None, max_length=18)  # 提供则重新加密（审计 action=update）
    active: bool | None = None


class StaffOut(BaseModel):
    """列表/详情输出：身份证脱敏 id_card_mask；永不回传密文。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str
    nickname: str | None = None
    gender: str | None = None
    department_id: int | None = None
    department_name: str | None = None
    role: str
    active: bool
    phone: str | None = None
    address: str | None = None
    id_card_mask: str | None = None  # 如 110***********1234
    last_login_at: datetime | None = None
    created_at: datetime | None = None


# ---------- 部门（S-27） ----------
class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    sort: int = 0
    lead: str | None = Field(default=None, max_length=60)
    description: str | None = Field(default=None, max_length=300)


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    sort: int | None = None
    lead: str | None = Field(default=None, max_length=60)
    description: str | None = Field(default=None, max_length=300)


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sort: int
    lead: str | None = None
    description: str | None = None
    created_at: datetime | None = None


# ---------- 登录日志（S-27） ----------
class LoginLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    username: str | None = None
    name: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    login_time: datetime | None = None


# ---------- staff-short（S-27） ----------
class StaffShortOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: str


# ---------- 站点配置（S-28） ----------
class SiteHistoryItemIn(BaseModel):
    year: str = Field(..., min_length=1, max_length=20)
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    sort: int = 0


class SiteConfigUpdate(BaseModel):
    company_intro: str | None = None
    brand_intro: str | None = None
    process_intro: str | None = None
    contact_info: dict | None = None  # {address, phone, email, hours, map_coords}
    social_links: list | None = None  # [{name, url, icon}]
    history_items: list[SiteHistoryItemIn] | None = None  # 全量替换
    home_banners: list[dict] | None = None  # 首页轮播图（2026-08-27）：[{image,title,en,desc,link,link_label,link2,link2_label,sort,enabled}]


class SiteConfigAdminOut(BaseModel):
    id: int
    company_intro: str | None = None
    brand_intro: str | None = None
    process_intro: str | None = None
    contact_info: dict = {}
    social_links: list = []
    history_items: list = []
    home_banners: list = []  # 首页轮播图（2026-08-27 功能补全）
    updated_at: datetime | None = None