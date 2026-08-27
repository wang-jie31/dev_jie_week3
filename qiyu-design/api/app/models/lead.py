"""线索域 ORM（2 表：messages / message_threads）。

对齐《03-数据库设计文档》§5.3.7 + 《02-开发技术文档》§4.3 状态机。
- messages.kind: appointment(预约)/message(留言)；status 4 态 new/contacted/converted/closed。
- message_threads: 沟通记录只追加不删（审计），type: phone/wechat/sms/email/note。
"""

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Message(Base):
    """留言/预约（线索）：前台公开提交，后台 4 态流转 + 沟通记录。"""

    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(120))
    budget: Mapped[str | None] = mapped_column(String(120))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_page: Mapped[str | None] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("kind IN ('appointment','message')"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("status IN ('new','contacted','converted','closed')"),
        nullable=False,
        server_default="new",
    )
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    threads: Mapped[list["MessageThread"]] = relationship(
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="MessageThread.created_at",
    )


class MessageThread(Base):
    """沟通记录（只追加不删，审计），type 限定 5 类。"""

    __tablename__ = "message_threads"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    message_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("type IN ('phone','wechat','sms','email','note')"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str] = mapped_column(String(60), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")

    message: Mapped[Message] = relationship(back_populates="threads")