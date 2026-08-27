"""上传文件索引模型（20 张表中的 uploads 表）。

第 3 步：上传管道写入（owner_type='file' 占位）；第 7 步接入 staff 外键与业务 owner 关联。
"""

from datetime import datetime

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Identity, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Upload(Base):
    """上传文件索引：storage_key 磁盘相对路径 + url 公开访问串。"""

    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    owner_type: Mapped[str] = mapped_column(String(30), nullable=False, server_default="file")
    owner_id: Mapped[int | None] = mapped_column(BigInteger)
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    mime: Mapped[str | None] = mapped_column(String(80))
    size: Mapped[int | None] = mapped_column(Integer)
    uploaded_by: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")