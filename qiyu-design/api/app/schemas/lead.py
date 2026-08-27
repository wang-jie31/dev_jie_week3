"""线索域 Schemas（messages / message_threads）。

对齐《02-开发技术文档》§6.3.12（公开提交）+ §6.4.7（后台受理）。
错误码：3xxx 线索域（3001 缺必填、3002 手机号格式、3003 内容长度、4003 非法状态流转）。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ---------- 通用响应包装（与 content.py 同款） ----------

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


# ---------- 手机号校验（与文档一致：^1[3-9]\\d{9}$） ----------

PHONE_RE = r"^1[3-9]\d{9}$"


def validate_phone(v: str | None) -> str | None:
    import re

    if v is None or v == "":
        return v
    if not re.match(PHONE_RE, v):
        raise ValueError("手机号格式不正确")
    return v


# ---------- Message ----------

class MessageBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    phone: str = Field(..., min_length=11, max_length=11)
    email: str | None = Field(default=None, max_length=120)
    budget: str | None = Field(default=None, max_length=120)
    content: str = Field(..., min_length=1, max_length=2000)
    source_page: str | None = Field(default=None, max_length=200)
    kind: str = Field(default="appointment", pattern=r"^(appointment|message)$")


class MessagePublicCreate(MessageBase):
    """前台公开提交（§6.3.12）：请求体仅公开字段，服务端强制 status=new。"""

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        import re

        if not re.match(PHONE_RE, v):
            raise ValueError("手机号格式不正确")
        return v

    @field_validator("name", "content")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class MessageCreate(MessageBase):
    """后台手工新增（可选；列表/流转/记录为主）。"""


class MessageUpdate(BaseModel):
    """后台更新：仅允许 note + budget（流转走专用 PATCH）。"""

    note: str | None = Field(default=None, max_length=2000)
    budget: str | None = Field(default=None, max_length=120)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    email: str | None = None
    budget: str | None = None
    content: str
    source_page: str | None = None
    kind: str
    status: str
    note: str | None = None
    created_at: datetime | None = None
    deleted_at: datetime | None = None


class MessageDetailOut(MessageOut):
    """详情：附沟通记录 threads。"""

    threads: list["MessageThreadOut"] = Field(default_factory=list)


# ---------- MessageThread ----------

class MessageThreadCreate(BaseModel):
    type: str = Field(..., pattern=r"^(phone|wechat|sms|email|note)$")
    content: str = Field(..., min_length=1, max_length=2000)


class MessageThreadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    message_id: int
    type: str
    content: str
    author: str
    created_at: datetime | None = None


MessageDetailOut.model_rebuild()