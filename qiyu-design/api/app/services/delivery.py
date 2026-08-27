"""交付域服务层（projects / construction_sites）。

对齐《02-开发技术文档》§6.4.8~§6.4.10：
- ProjectService：list/create/get/update/status 9 态流转/progress/delete 软删；
  code 自动生成 `QY-{yyyy}-{seq}`（§6.4.8），9 态迁移表见 §4.3，违例 code=4003。
- SiteService：CRUD；DELETE 硬删（§6.4.10），删时关联 projects.site_id 置 NULL。
错误码：4003 非法状态流转、4040 不存在。
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.models.delivery import ConstructionSite, Project
from app.schemas.delivery import ProjectCreate, ProjectUpdate, SiteCreate, SiteUpdate

# ---------- 9 态状态机合法迁移（§4.3） ----------
PROJECT_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "lead": ("measuring", "cancelled"),
    "measuring": ("designing", "cancelled"),
    "designing": ("quoting", "cancelled"),
    "quoting": ("signed", "cancelled"),
    "signed": ("constructing", "cancelled"),
    "constructing": ("acceptance", "cancelled"),
    "acceptance": ("done", "cancelled"),
    "done": (),
    "cancelled": (),
}

STATUS_LABELS: dict[str, str] = {
    "lead": "线索",
    "measuring": "量房",
    "designing": "设计",
    "quoting": "报价",
    "signed": "签约",
    "constructing": "施工",
    "acceptance": "验收",
    "done": "完成",
    "cancelled": "取消",
}


def _next_code(db: Session) -> str:
    """生成项目编号 QY-{yyyy}-{seq}：同年序列 +1，seq 四位补零。"""
    year = datetime.now().year
    prefix = f"QY-{year}-"
    row = db.execute(
        select(func.count()).select_from(Project).where(Project.code.like(f"{prefix}%"))
    ).scalar_one()
    return f"{prefix}{int(row or 0) + 1:04d}"


class ProjectService:
    @staticmethod
    def list(
        db: Session,
        *,
        status: str | None = None,
        designer_id: int | None = None,
        keyword: str | None = None,
        page: int | None = None,
        page_size: int | None = None,
    ) -> tuple[list[Project], int]:
        stmt = select(Project).where(Project.deleted_at.is_(None))
        if status:
            stmt = stmt.where(Project.status == status)
        if designer_id:
            stmt = stmt.where(Project.designer_id == designer_id)
        if keyword:
            kw = f"%{keyword}%"
            stmt = stmt.where(
                Project.title.ilike(kw)
                | Project.code.ilike(kw)
                | Project.client_name.ilike(kw)
                | Project.designer_name.ilike(kw)
            )
        total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
        stmt = stmt.order_by(Project.created_at.desc())
        if page and page_size:
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        return list(db.execute(stmt).scalars()), total

    @staticmethod
    def get(db: Session, pk: int) -> Project | None:
        return db.execute(
            select(Project).where(Project.id == pk, Project.deleted_at.is_(None))
        ).scalar_one_or_none()

    @staticmethod
    def create(db: Session, payload: ProjectCreate) -> Project:
        data = payload.model_dump()
        data["code"] = _next_code(db)
        p = Project(**data)
        db.add(p)
        db.flush()
        return p

    @staticmethod
    def update(db: Session, pk: int, payload: ProjectUpdate) -> Project:
        p = ProjectService.get(db, pk)
        if p is None:
            raise BizError(4040, "项目不存在")
        for k, v in payload.model_dump().items():
            setattr(p, k, v)
        db.flush()
        return p

    @staticmethod
    def set_status(db: Session, pk: int, new_status: str) -> Project:
        p = ProjectService.get(db, pk)
        if p is None:
            raise BizError(4040, "项目不存在")
        allowed = PROJECT_TRANSITIONS.get(p.status, ())
        if new_status not in allowed:
            raise BizError(4003, f"非法状态流转：{p.status} → {new_status}")
        p.status = new_status
        # 终态：done/cancelled 进度自动置 100
        if new_status in ("done", "cancelled"):
            p.progress = 100
        db.flush()
        return p

    @staticmethod
    def set_progress(db: Session, pk: int, progress: int) -> Project:
        p = ProjectService.get(db, pk)
        if p is None:
            raise BizError(4040, "项目不存在")
        if not 0 <= progress <= 100:
            raise BizError(3001, "进度必须在 0-100 之间")
        p.progress = progress
        db.flush()
        return p

    @staticmethod
    def delete(db: Session, pk: int) -> None:
        p = ProjectService.get(db, pk)
        if p is None:
            raise BizError(4040, "项目不存在")
        p.deleted_at = datetime.now()


class SiteService:
    @staticmethod
    def list(
        db: Session,
        *,
        keyword: str | None = None,
        page: int | None = None,
        page_size: int | None = None,
    ) -> tuple[list[ConstructionSite], int]:
        stmt = select(ConstructionSite)
        if keyword:
            kw = f"%{keyword}%"
            stmt = stmt.where(
                ConstructionSite.name.ilike(kw)
                | ConstructionSite.address.ilike(kw)
                | ConstructionSite.supervisor.ilike(kw)
            )
        total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
        stmt = stmt.order_by(ConstructionSite.created_at.desc())
        if page and page_size:
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        return list(db.execute(stmt).scalars()), total

    @staticmethod
    def get(db: Session, pk: int) -> ConstructionSite | None:
        return db.execute(
            select(ConstructionSite).where(ConstructionSite.id == pk)
        ).scalar_one_or_none()

    @staticmethod
    def create(db: Session, payload: SiteCreate) -> ConstructionSite:
        s = ConstructionSite(**payload.model_dump())
        db.add(s)
        db.flush()
        return s

    @staticmethod
    def update(db: Session, pk: int, payload: SiteUpdate) -> ConstructionSite:
        s = SiteService.get(db, pk)
        if s is None:
            raise BizError(4040, "工地不存在")
        for k, v in payload.model_dump().items():
            setattr(s, k, v)
        db.flush()
        return s

    @staticmethod
    def delete(db: Session, pk: int) -> None:
        """硬删工地；关联该项目的最新 project 若指向本工地则置 NULL。"""
        s = SiteService.get(db, pk)
        if s is None:
            raise BizError(4040, "工地不存在")
        # 关联解除：projects.site_id 指向本工地 → NULL（§6.4.10 循环外键 ON DELETE SET NULL 的显式等价）
        links = db.execute(
            select(Project).where(Project.site_id == pk, Project.deleted_at.is_(None))
        ).scalars()
        for p in links:
            p.site_id = None
        db.delete(s)
        db.flush()