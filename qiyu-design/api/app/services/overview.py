"""概览看板聚合查询（S-21，§6.4.2）。

对齐《02-开发技术文档》§6.4.2 + §9.6 核心 SQL：
- kpi：cases_total/cases_delta、packages_total、messages_total/messages_delta、
        projects_total/projects_active、team_count、sites_count（环比 delta=本月 vs 上月新增）
- north_star：valid_leads_this_month（本月线索数，北极星指标）
- message_status_dist / project_status_dist：按状态分组计数
- trend_6m：近 6 个月双序列（projects 新增 / appointments 预约），date_trunc 按月
- designer_rank：设计师项目数排行 TOP
- 性能：v1 直查主库（ADR-013），P95 ≤ 400ms
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.content import Case, Package, TeamMember
from app.models.delivery import ConstructionSite, Project
from app.models.lead import Message
from app.models.org import Staff


def _month_start(dt: datetime) -> datetime:
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _delta(session: Session, model, created_col) -> int:
    """环比：本月新增 - 上月新增。"""
    now = datetime.now()
    this_month = _month_start(now)
    last_month_start = (this_month - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_cnt = session.execute(
        select(func.count()).select_from(model).where(created_col >= this_month)
    ).scalar_one()
    last_cnt = session.execute(
        select(func.count()).select_from(model).where(created_col >= last_month_start, created_col < this_month)
    ).scalar_one()
    return int(this_cnt - last_cnt)


def compute_overview(db: Session) -> dict:
    now = datetime.now()
    this_month = _month_start(now)

    # ---------- KPI ----------
    cases_total = db.execute(select(func.count()).select_from(Case).where(Case.deleted_at.is_(None))).scalar_one()
    cases_delta = _delta(db, Case, Case.created_at)
    packages_total = db.execute(
        select(func.count()).select_from(Package).where(Package.deleted_at.is_(None))
    ).scalar_one()
    messages_total = db.execute(
        select(func.count()).select_from(Message).where(Message.deleted_at.is_(None))
    ).scalar_one()
    messages_delta = _delta(db, Message, Message.created_at)
    projects_total = db.execute(
        select(func.count()).select_from(Project).where(Project.deleted_at.is_(None))
    ).scalar_one()
    projects_active = db.execute(
        select(func.count())
        .select_from(Project)
        .where(Project.deleted_at.is_(None), Project.status.notin_(["done", "cancelled"]))
    ).scalar_one()
    team_count = db.execute(select(func.count()).select_from(TeamMember)).scalar_one()
    sites_count = db.execute(select(func.count()).select_from(ConstructionSite)).scalar_one()

    # ---------- 北极星：本月有效线索 ----------
    valid_leads_this_month = db.execute(
        select(func.count()).select_from(Message).where(
            Message.deleted_at.is_(None),
            Message.created_at >= this_month,
            Message.status.in_(["new", "contacted", "converted"]),
        )
    ).scalar_one()

    # ---------- 状态分布 ----------
    msg_dist_rows = db.execute(
        select(Message.status, func.count().label("cnt"))
        .where(Message.deleted_at.is_(None))
        .group_by(Message.status)
    ).all()
    message_status_dist = [{"status": s, "count": int(c)} for s, c in msg_dist_rows]

    proj_dist_rows = db.execute(
        select(Project.status, func.count().label("cnt"))
        .where(Project.deleted_at.is_(None))
        .group_by(Project.status)
    ).all()
    project_status_dist = [{"status": s, "count": int(c)} for s, c in proj_dist_rows]

    # ---------- 近 6 月双序列（projects 新增 / appointments 预约） ----------
    months: list[str] = []
    trend_map: dict[str, dict] = {}
    for i in range(5, -1, -1):
        m = (now - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        key = f"{m.year:04d}-{m.month:02d}"
        months.append(key)
        trend_map[key] = {"month": key, "projects": 0, "appointments": 0}

    proj_rows = db.execute(
        select(func.date_trunc("month", Project.created_at).label("m"), func.count().label("cnt"))
        .where(Project.deleted_at.is_(None), Project.created_at >= _month_start(now - timedelta(days=180)))
        .group_by("m")
    ).all()
    for m, c in proj_rows:
        key = m.strftime("%Y-%m") if m else ""
        if key in trend_map:
            trend_map[key]["projects"] = int(c)

    msg_rows = db.execute(
        select(func.date_trunc("month", Message.created_at).label("m"), func.count().label("cnt"))
        .where(Message.deleted_at.is_(None), Message.kind == "appointment", Message.created_at >= _month_start(now - timedelta(days=180)))
        .group_by("m")
    ).all()
    for m, c in msg_rows:
        key = m.strftime("%Y-%m") if m else ""
        if key in trend_map:
            trend_map[key]["appointments"] = int(c)

    trend_6m = [trend_map[k] for k in months]

    # ---------- 设计师排行 TOP ----------
    rank_rows = db.execute(
        select(func.coalesce(Project.designer_name, "未分配").label("name"), func.count().label("cnt"))
        .where(Project.deleted_at.is_(None), Project.status.notin_(["cancelled"]))
        .group_by("name")
        .order_by(func.count().desc())
        .limit(10)
    ).all()
    designer_rank = [{"designer": n, "count": int(c)} for n, c in rank_rows]

    return {
        "kpi": {
            "cases_total": int(cases_total),
            "cases_delta": cases_delta,
            "packages_total": int(packages_total),
            "messages_total": int(messages_total),
            "messages_delta": messages_delta,
            "projects_total": int(projects_total),
            "projects_active": int(projects_active),
            "team_count": int(team_count),
            "sites_count": int(sites_count),
        },
        "north_star": {"valid_leads_this_month": int(valid_leads_this_month)},
        "message_status_dist": message_status_dist,
        "project_status_dist": project_status_dist,
        "trend_6m": trend_6m,
        "designer_rank": designer_rank,
    }