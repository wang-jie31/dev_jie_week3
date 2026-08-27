"""内容域仓储：参数化 CRUD + 公开/后台多维筛选（防注入，SQLAlchemy 参数绑定）。

标签筛选（style_tags / house_type_tags）使用 JSONB `@>` 操作符命中 GIN 索引。
分页约定：请求 page/pageSize 且 pageSize ≤ 100 时分页；否则返回全量（文档 §6.1）。
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session, selectinload

from app.models.content import (
    Career,
    Case,
    CaseImage,
    News,
    Package,
    PackageProcessStep,
    TeamMember,
)

ALIVE = "deleted_at IS NULL"


def _page_args(page: int | None, page_size: int | None) -> tuple[int, int] | None:
    """返回 (offset, limit)；page 或 pageSize 任一缺失时返回 None（全量，文档 §6.1）。"""
    if page is None or page_size is None:
        return None
    page_size = max(1, min(page_size, 100))  # 上限 100
    page = max(1, page)
    return (page - 1) * page_size, page_size


class CaseRepo:
    """案例仓储：公开筛选（published）+ 后台全量（含 draft/offline）+ 软删过滤。"""

    @staticmethod
    def _apply_filters(stmt, *, cat: str | None = None, style: str | None = None,
                       house_type: str | None = None, area_range: str | None = None,
                       keyword: str | None = None, status: str | None = None,
                       published_only: bool = False) -> Any:
        conds = [Case.deleted_at.is_(None)]
        if published_only:
            conds.append(Case.status == "published")
        if status:
            conds.append(Case.status == status)
        if cat:
            conds.append(Case.category == cat)
        if style:
            for s in style.split(","):
                s = s.strip()
                if s:
                    conds.append(Case.style_tags.op("@>")(func.cast([s], JSONB)))
        if house_type:
            for h in house_type.split(","):
                h = h.strip()
                if h:
                    conds.append(Case.house_type_tags.op("@>")(func.cast([h], JSONB)))
        if area_range:
            conds.append(Case.area_range == area_range)
        if keyword:
            like = f"%{keyword}%"
            conds.append(or_(Case.title.ilike(like), Case.summary.ilike(like), Case.location.ilike(like)))
        return stmt.where(and_(*conds))

    @classmethod
    def list_public(cls, db: Session, *, cat=None, style=None, house_type=None,
                    area_range=None, keyword=None, sort: str = "latest",
                    page: int | None = None, page_size: int | None = None) -> tuple[list[Case], int]:
        stmt = select(Case)
        stmt = cls._apply_filters(stmt, cat=cat, style=style, house_type=house_type,
                                  area_range=area_range, keyword=keyword, published_only=True)
        if sort == "hottest":
            stmt = stmt.order_by(Case.view_count.desc(), Case.created_at.desc())
        else:
            stmt = stmt.order_by(Case.created_at.desc())
        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        pg = _page_args(page, page_size)
        if pg:
            stmt = stmt.offset(pg[0]).limit(pg[1])
        return list(db.scalars(stmt).all()), total

    @classmethod
    def list_admin(cls, db: Session, *, cat=None, status=None, keyword=None,
                   page: int | None = None, page_size: int | None = None) -> tuple[list[Case], int]:
        stmt = select(Case)
        stmt = cls._apply_filters(stmt, cat=cat, status=status, keyword=keyword)
        stmt = stmt.order_by(Case.created_at.desc())
        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        pg = _page_args(page, page_size)
        if pg:
            stmt = stmt.offset(pg[0]).limit(pg[1])
        return list(db.scalars(stmt).all()), total

    @classmethod
    def get_by_slug(cls, db: Session, slug: str, *, published_only: bool = False) -> Case | None:
        stmt = select(Case).where(Case.slug == slug, Case.deleted_at.is_(None))
        if published_only:
            stmt = stmt.where(Case.status == "published")
        return db.scalar(stmt)

    @classmethod
    def get_by_id(cls, db: Session, pk: int) -> Case | None:
        return db.scalar(select(Case).where(Case.id == pk, Case.deleted_at.is_(None)))

    @classmethod
    def exists_slug(cls, db: Session, slug: str, exclude_id: int | None = None) -> bool:
        stmt = select(Case.id).where(Case.slug == slug, Case.deleted_at.is_(None))
        if exclude_id:
            stmt = stmt.where(Case.id != exclude_id)
        return db.scalar(stmt) is not None

    @classmethod
    def prev_next(cls, db: Session, case: Case) -> tuple[Case | None, Case | None]:
        """详情上下篇：同 category 内按 id 相邻（published）。"""
        base = and_(Case.category == case.category, Case.status == "published", Case.deleted_at.is_(None))
        prev = db.scalar(select(Case).where(base, Case.id < case.id).order_by(Case.id.desc()).limit(1))
        nxt = db.scalar(select(Case).where(base, Case.id > case.id).order_by(Case.id.asc()).limit(1))
        return prev, nxt

    @classmethod
    def featured(cls, db: Session, limit: int = 3) -> list[Case]:
        stmt = (select(Case).where(Case.status == "published", Case.is_featured.is_(True), Case.deleted_at.is_(None))
                .order_by(Case.created_at.desc()).limit(limit))
        return list(db.scalars(stmt).all())

    @classmethod
    def save(cls, db: Session, case: Case) -> Case:
        db.add(case)
        db.flush()
        return case

    @classmethod
    def delete_soft(cls, db: Session, case: Case) -> None:
        case.deleted_at = func.now()
        db.flush()

    @classmethod
    def bump_view(cls, db: Session, case_id: int) -> None:
        db.execute(Case.__table__.update().where(Case.id == case_id).values(view_count=Case.view_count + 1))
        db.flush()


class PackageRepo:
    """套餐仓储：公开只看 published；详情带 process_steps 懒加载。"""

    @classmethod
    def list_public(cls, db: Session, *, ptype: str | None = None,
                    page: int | None = None, page_size: int | None = None) -> tuple[list[Package], int]:
        conds = [Package.status == "published", Package.deleted_at.is_(None)]
        if ptype:
            conds.append(Package.type == ptype)
        stmt = select(Package).where(and_(*conds)).order_by(Package.created_at.desc())
        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        pg = _page_args(page, page_size)
        if pg:
            stmt = stmt.offset(pg[0]).limit(pg[1])
        return list(db.scalars(stmt).all()), total

    @classmethod
    def list_admin(cls, db: Session, *, ptype: str | None = None, status: str | None = None,
                   page: int | None = None, page_size: int | None = None) -> tuple[list[Package], int]:
        conds = [Package.deleted_at.is_(None)]
        if ptype:
            conds.append(Package.type == ptype)
        if status:
            conds.append(Package.status == status)
        stmt = select(Package).where(and_(*conds)).order_by(Package.created_at.desc())
        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        pg = _page_args(page, page_size)
        if pg:
            stmt = stmt.offset(pg[0]).limit(pg[1])
        return list(db.scalars(stmt).all()), total

    @classmethod
    def get_by_slug(cls, db: Session, slug: str, *, published_only: bool = False) -> Package | None:
        stmt = select(Package).options(selectinload(Package.process_steps)).where(
            Package.slug == slug, Package.deleted_at.is_(None))
        if published_only:
            stmt = stmt.where(Package.status == "published")
        return db.scalar(stmt)

    @classmethod
    def get_by_id(cls, db: Session, pk: int) -> Package | None:
        return db.scalar(select(Package).where(Package.id == pk, Package.deleted_at.is_(None)))

    @classmethod
    def exists_slug(cls, db: Session, slug: str, exclude_id: int | None = None) -> bool:
        stmt = select(Package.id).where(Package.slug == slug, Package.deleted_at.is_(None))
        if exclude_id:
            stmt = stmt.where(Package.id != exclude_id)
        return db.scalar(stmt) is not None

    @classmethod
    def save(cls, db: Session, pkg: Package) -> Package:
        db.add(pkg)
        db.flush()
        return pkg

    @classmethod
    def delete_soft(cls, db: Session, pkg: Package) -> None:
        pkg.deleted_at = func.now()
        db.flush()


class NewsRepo:
    """资讯仓储。"""

    @classmethod
    def _base(cls, db: Session) -> Any:
        return select(News)

    @classmethod
    def list_public(cls, db: Session, *, cat: str | None = None,
                    page: int | None = None, page_size: int | None = None) -> tuple[list[News], int]:
        conds = [News.status == "published", News.deleted_at.is_(None)]
        if cat:
            conds.append(News.category == cat)
        stmt = select(News).where(and_(*conds)).order_by(News.published_at.desc().nullslast(), News.created_at.desc())
        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        pg = _page_args(page, page_size)
        if pg:
            stmt = stmt.offset(pg[0]).limit(pg[1])
        return list(db.scalars(stmt).all()), total

    @classmethod
    def list_admin(cls, db: Session, *, cat: str | None = None, status: str | None = None,
                   page: int | None = None, page_size: int | None = None) -> tuple[list[News], int]:
        conds = [News.deleted_at.is_(None)]
        if cat:
            conds.append(News.category == cat)
        if status:
            conds.append(News.status == status)
        stmt = select(News).where(and_(*conds)).order_by(News.created_at.desc())
        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        pg = _page_args(page, page_size)
        if pg:
            stmt = stmt.offset(pg[0]).limit(pg[1])
        return list(db.scalars(stmt).all()), total

    @classmethod
    def get_by_slug(cls, db: Session, slug: str, *, published_only: bool = False) -> News | None:
        stmt = select(News).where(News.slug == slug, News.deleted_at.is_(None))
        if published_only:
            stmt = stmt.where(News.status == "published")
        return db.scalar(stmt)

    @classmethod
    def get_by_id(cls, db: Session, pk: int) -> News | None:
        return db.scalar(select(News).where(News.id == pk, News.deleted_at.is_(None)))

    @classmethod
    def exists_slug(cls, db: Session, slug: str, exclude_id: int | None = None) -> bool:
        stmt = select(News.id).where(News.slug == slug, News.deleted_at.is_(None))
        if exclude_id:
            stmt = stmt.where(News.id != exclude_id)
        return db.scalar(stmt) is not None

    @classmethod
    def save(cls, db: Session, news: News) -> News:
        db.add(news)
        db.flush()
        return news

    @classmethod
    def delete_soft(cls, db: Session, news: News) -> None:
        news.deleted_at = func.now()
        db.flush()


class CareerRepo:
    """招聘岗位仓储（仅后台写，公开只读）。"""

    @classmethod
    def list_public(cls, db: Session, *, cat: str | None = None) -> list[Career]:
        conds = [Career.status == "published", Career.deleted_at.is_(None)]
        if cat:
            conds.append(Career.category == cat)
        stmt = select(Career).where(and_(*conds)).order_by(Career.created_at.desc())
        return list(db.scalars(stmt).all())

    @classmethod
    def list_admin(cls, db: Session, *, cat: str | None = None, status: str | None = None,
                   page: int | None = None, page_size: int | None = None) -> tuple[list[Career], int]:
        conds = [Career.deleted_at.is_(None)]
        if cat:
            conds.append(Career.category == cat)
        if status:
            conds.append(Career.status == status)
        stmt = select(Career).where(and_(*conds)).order_by(Career.created_at.desc())
        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        pg = _page_args(page, page_size)
        if pg:
            stmt = stmt.offset(pg[0]).limit(pg[1])
        return list(db.scalars(stmt).all()), total

    @classmethod
    def get_by_id(cls, db: Session, pk: int) -> Career | None:
        return db.scalar(select(Career).where(Career.id == pk, Career.deleted_at.is_(None)))

    @classmethod
    def save(cls, db: Session, c: Career) -> Career:
        db.add(c)
        db.flush()
        return c

    @classmethod
    def delete_soft(cls, db: Session, c: Career) -> None:
        c.deleted_at = func.now()
        db.flush()


class TeamMemberRepo:
    """团队档案仓储：公开只看 active，按 order 排序。"""

    @classmethod
    def list_public(cls, db: Session) -> list[TeamMember]:
        stmt = (select(TeamMember)
                .where(TeamMember.active.is_(True), TeamMember.deleted_at.is_(None))
                .order_by(TeamMember.order.asc(), TeamMember.id.asc()))
        return list(db.scalars(stmt).all())

    @classmethod
    def list_admin(cls, db: Session, *, include_inactive: bool = True) -> list[TeamMember]:
        conds = [TeamMember.deleted_at.is_(None)]
        if not include_inactive:
            conds.append(TeamMember.active.is_(True))
        stmt = select(TeamMember).where(and_(*conds)).order_by(TeamMember.order.asc(), TeamMember.id.asc())
        return list(db.scalars(stmt).all())

    @classmethod
    def get_by_id(cls, db: Session, pk: int) -> TeamMember | None:
        return db.scalar(select(TeamMember).where(TeamMember.id == pk, TeamMember.deleted_at.is_(None)))

    @classmethod
    def save(cls, db: Session, m: TeamMember) -> TeamMember:
        db.add(m)
        db.flush()
        return m

    @classmethod
    def delete_soft(cls, db: Session, m: TeamMember) -> None:
        m.deleted_at = func.now()
        db.flush()