"""ORM 模型注册（跨 5 个限界上下文）。

说明：第 2 步迁移已用显式 Alembic DDL 建表，此处模型仅用作 ORM 读写映射，
不参与 autogenerate。各域模型在自己的模块内定义，这里统一导出。

- 内容域：Case/CaseImage/Package/PackageProcessStep/News/Career/TeamMember/
  ContentViewStat/SiteConfig/SiteHistoryItem
- 线索域：Message/MessageThread
- 组织域：Department/Staff/LoginLog/RefreshToken/SensitiveAccessLog
- 交付域：Project/ConstructionSite
- 资源域：Upload
"""

from .content import (
    Career,
    Case,
    CaseImage,
    ContentViewStat,
    News,
    Package,
    PackageProcessStep,
    SiteConfig,
    SiteHistoryItem,
    TeamMember,
)
from .lead import Message, MessageThread
from .org import Department, LoginLog, RefreshToken, SensitiveAccessLog, Staff
from .delivery import ConstructionSite, Project
from .upload import Upload

__all__ = [
    "Career",
    "Case",
    "CaseImage",
    "ContentViewStat",
    "News",
    "Package",
    "PackageProcessStep",
    "SiteConfig",
    "SiteHistoryItem",
    "TeamMember",
    "Message",
    "MessageThread",
    "Department",
    "LoginLog",
    "RefreshToken",
    "SensitiveAccessLog",
    "Staff",
    "ConstructionSite",
    "Project",
    "Upload",
]