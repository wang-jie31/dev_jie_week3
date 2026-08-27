"""后台内容域路由（需 JWT + RBAC，第 3 步；org 域接口第 7 步在此追加）。

对齐《02-开发技术文档》§6.4：
  - cases/packages/news/careers/team 五组 CRUD + status PATCH + 上下架
  - 写权限：admin/design（careers 仅 admin）——服务端 require_role 唯一权威（第 7 步接入完整 RBAC，此处先断言角色字段）
统一响应 {code, message, data}；列表支持分页（缺省全量）。
"""

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BizError
from app.core.revalidate import revalidate
from app.services.content import StorageBackend, storage_backend
from app.schemas.content import (
    ApiListResponse,
    ApiResponse,
    CareerCreate,
    CareerOut,
    CareerUpdate,
    CaseCreate,
    CaseOut,
    CaseUpdate,
    NewsCreate,
    NewsOut,
    NewsUpdate,
    PackageCreate,
    PackageDetailOut,
    PackageOut,
    PackageUpdate,
    TeamMemberCreate,
    TeamMemberOut,
    TeamMemberUpdate,
)
from app.services.content import CareerService, CaseService, NewsService, PackageService, TeamMemberService
from app.services.lead import get_message
from app.models.delivery import ConstructionSite, Project
from app.models.org import Staff
from app.schemas.delivery import ProjectCreate, ProjectUpdate, SiteCreate, SiteUpdate

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# ---------- RBAC 占位（第 7 步 org 域完善为 require_role 依赖） ----------

CONTENT_WRITE_ROLES = ("admin", "design")   # cases/packages/news/team 写权限
CAREER_WRITE_ROLES = ("admin",)             # careers 写权限（§6.4.6）


def _require(roles: tuple[str, ...], user: dict) -> None:
    """服务端角色断言（第 7 步替换为 deps.require_role 后行为不变）。"""
    role = (user or {}).get("role", "")
    if role not in roles:
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("权限不足")


def _ok(data=None) -> dict:
    return {"code": 0, "message": "ok", "data": data}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)) -> dict:
    """当前登录用户信息（第 7 步补全 staff 详情）。"""
    return _ok(current_user)


# ==================== cases ====================

@router.get("/cases", response_model=ApiResponse[ApiListResponse[CaseOut]])
def admin_list_cases(
    cat: str | None = Query(default=None, pattern=r"^(private|small|apartment)$"),
    status: str | None = Query(default=None, pattern=r"^(draft|published|offline)$"),
    keyword: str | None = Query(default=None),
    page: int | None = Query(default=None, ge=1),
    pageSize: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    items, total = CaseService.list_admin(db, cat=cat, status=status, keyword=keyword, page=page, page_size=pageSize)
    return _ok({"items": [CaseOut.model_validate(i) for i in items], "total": total, "page": page, "pageSize": pageSize})


@router.post("/cases", response_model=ApiResponse[CaseOut])
def admin_create_case(payload: CaseCreate, db: Session = Depends(get_db),
                      user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    case = CaseService.create(db, payload)
    db.commit()
    revalidate("cases")  # S-33：后台上架 → 前台 ISR 即时刷新
    return _ok(CaseOut.model_validate(case))


@router.get("/cases/{pk}", response_model=ApiResponse[CaseOut])
def admin_get_case(pk: int, db: Session = Depends(get_db)) -> dict:
    case = CaseService.get_admin(db, pk)
    return _ok(CaseOut.model_validate(case))


@router.put("/cases/{pk}", response_model=ApiResponse[CaseOut])
def admin_update_case(pk: int, payload: CaseUpdate, db: Session = Depends(get_db),
                      user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    case = CaseService.update(db, pk, payload)
    db.commit()
    revalidate("cases")  # S-33
    return _ok(CaseOut.model_validate(case))


@router.patch("/cases/{pk}/status", response_model=ApiResponse[CaseOut])
def admin_case_status(pk: int, payload: dict, db: Session = Depends(get_db),
                      user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    status = payload.get("status")
    case = CaseService.set_status(db, pk, status)
    db.commit()
    revalidate("cases")  # S-33：上下架即时生效
    return _ok(CaseOut.model_validate(case))


@router.delete("/cases/{pk}", response_model=ApiResponse[dict])
def admin_delete_case(pk: int, db: Session = Depends(get_db),
                      user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    CaseService.delete(db, pk)
    db.commit()
    revalidate("cases")  # S-33
    return _ok({"deleted": True})


# ==================== packages ====================

@router.get("/packages", response_model=ApiResponse[ApiListResponse[PackageOut]])
def admin_list_packages(
    type: str | None = Query(default=None, pattern=r"^(single_space|whole_house|style)$"),
    status: str | None = Query(default=None, pattern=r"^(draft|published|offline)$"),
    page: int | None = Query(default=None, ge=1),
    pageSize: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    items, total = PackageService.list_admin(db, ptype=type, status=status, page=page, page_size=pageSize)
    return _ok({"items": [PackageOut.model_validate(i) for i in items], "total": total, "page": page, "pageSize": pageSize})


@router.post("/packages", response_model=ApiResponse[PackageDetailOut])
def admin_create_package(payload: PackageCreate, db: Session = Depends(get_db),
                         user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    pkg = PackageService.create(db, payload)
    db.commit()
    revalidate("packages")  # S-33
    return _ok(PackageDetailOut.model_validate(pkg))


@router.get("/packages/{pk}", response_model=ApiResponse[PackageDetailOut])
def admin_get_package(pk: int, db: Session = Depends(get_db)) -> dict:
    pkg = PackageService.get_admin(db, pk)
    return _ok(PackageDetailOut.model_validate(pkg))


@router.put("/packages/{pk}", response_model=ApiResponse[PackageDetailOut])
def admin_update_package(pk: int, payload: PackageUpdate, db: Session = Depends(get_db),
                         user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    pkg = PackageService.update(db, pk, payload)
    db.commit()
    revalidate("packages")  # S-33
    return _ok(PackageDetailOut.model_validate(pkg))


@router.patch("/packages/{pk}/status", response_model=ApiResponse[PackageOut])
def admin_package_status(pk: int, payload: dict, db: Session = Depends(get_db),
                         user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    pkg = PackageService.set_status(db, pk, payload.get("status"))
    db.commit()
    revalidate("packages")  # S-33
    return _ok(PackageOut.model_validate(pkg))


@router.delete("/packages/{pk}", response_model=ApiResponse[dict])
def admin_delete_package(pk: int, db: Session = Depends(get_db),
                         user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    PackageService.delete(db, pk)
    db.commit()
    revalidate("packages")  # S-33
    return _ok({"deleted": True})


# ==================== news ====================

@router.get("/news", response_model=ApiResponse[ApiListResponse[NewsOut]])
def admin_list_news(
    cat: str | None = Query(default=None, pattern=r"^(company|industry)$"),
    status: str | None = Query(default=None, pattern=r"^(draft|published|offline)$"),
    page: int | None = Query(default=None, ge=1),
    pageSize: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    items, total = NewsService.list_admin(db, cat=cat, status=status, page=page, page_size=pageSize)
    return _ok({"items": [NewsOut.model_validate(i) for i in items], "total": total, "page": page, "pageSize": pageSize})


@router.post("/news", response_model=ApiResponse[NewsOut])
def admin_create_news(payload: NewsCreate, db: Session = Depends(get_db),
                      user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    news = NewsService.create(db, payload)
    db.commit()
    revalidate("news")  # S-33
    return _ok(NewsOut.model_validate(news))


@router.get("/news/{pk}", response_model=ApiResponse[NewsOut])
def admin_get_news(pk: int, db: Session = Depends(get_db)) -> dict:
    news = NewsService.get_admin(db, pk)
    return _ok(NewsOut.model_validate(news))


@router.put("/news/{pk}", response_model=ApiResponse[NewsOut])
def admin_update_news(pk: int, payload: NewsUpdate, db: Session = Depends(get_db),
                      user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    news = NewsService.update(db, pk, payload)
    db.commit()
    revalidate("news")  # S-33
    return _ok(NewsOut.model_validate(news))


@router.patch("/news/{pk}/status", response_model=ApiResponse[NewsOut])
def admin_news_status(pk: int, payload: dict, db: Session = Depends(get_db),
                      user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    news = NewsService.set_status(db, pk, payload.get("status"))
    db.commit()
    revalidate("news")  # S-33
    return _ok(NewsOut.model_validate(news))


@router.delete("/news/{pk}", response_model=ApiResponse[dict])
def admin_delete_news(pk: int, db: Session = Depends(get_db),
                      user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    NewsService.delete(db, pk)
    db.commit()
    revalidate("news")  # S-33
    return _ok({"deleted": True})


# ==================== careers ====================

@router.get("/careers", response_model=ApiResponse[ApiListResponse[CareerOut]])
def admin_list_careers(
    cat: str | None = Query(default=None, pattern=r"^(social|campus)$"),
    status: str | None = Query(default=None, pattern=r"^(draft|published|offline)$"),
    page: int | None = Query(default=None, ge=1),
    pageSize: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    items, total = CareerService.list_admin(db, cat=cat, status=status, page=page, page_size=pageSize)
    return _ok({"items": [CareerOut.model_validate(i) for i in items], "total": total, "page": page, "pageSize": pageSize})


@router.post("/careers", response_model=ApiResponse[CareerOut])
def admin_create_career(payload: CareerCreate, db: Session = Depends(get_db),
                        user: dict = Depends(get_current_user)) -> dict:
    _require(CAREER_WRITE_ROLES, user)
    career = CareerService.create(db, payload)
    db.commit()
    revalidate("careers")  # S-33
    return _ok(CareerOut.model_validate(career))


@router.get("/careers/{pk}", response_model=ApiResponse[CareerOut])
def admin_get_career(pk: int, db: Session = Depends(get_db)) -> dict:
    career = CareerService.get_admin(db, pk)
    return _ok(CareerOut.model_validate(career))


@router.put("/careers/{pk}", response_model=ApiResponse[CareerOut])
def admin_update_career(pk: int, payload: CareerUpdate, db: Session = Depends(get_db),
                        user: dict = Depends(get_current_user)) -> dict:
    _require(CAREER_WRITE_ROLES, user)
    career = CareerService.update(db, pk, payload)
    db.commit()
    revalidate("careers")  # S-33
    return _ok(CareerOut.model_validate(career))


@router.patch("/careers/{pk}/status", response_model=ApiResponse[CareerOut])
def admin_career_status(pk: int, payload: dict, db: Session = Depends(get_db),
                        user: dict = Depends(get_current_user)) -> dict:
    _require(CAREER_WRITE_ROLES, user)
    career = CareerService.set_status(db, pk, payload.get("status"))
    db.commit()
    revalidate("careers")  # S-33
    return _ok(CareerOut.model_validate(career))


@router.delete("/careers/{pk}", response_model=ApiResponse[dict])
def admin_delete_career(pk: int, db: Session = Depends(get_db),
                        user: dict = Depends(get_current_user)) -> dict:
    _require(CAREER_WRITE_ROLES, user)
    CareerService.delete(db, pk)
    db.commit()
    return _ok({"deleted": True})


# ==================== team ====================

@router.get("/team", response_model=ApiResponse[list[TeamMemberOut]])
def admin_list_team(db: Session = Depends(get_db)) -> dict:
    members = TeamMemberService.list_admin(db)
    return _ok([TeamMemberOut.model_validate(m) for m in members])


@router.post("/team", response_model=ApiResponse[TeamMemberOut])
def admin_create_team(payload: TeamMemberCreate, db: Session = Depends(get_db),
                      user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    member = TeamMemberService.create(db, payload)
    db.commit()
    revalidate("team")  # S-33
    return _ok(TeamMemberOut.model_validate(member))


@router.get("/team/{pk}", response_model=ApiResponse[TeamMemberOut])
def admin_get_team(pk: int, db: Session = Depends(get_db)) -> dict:
    member = TeamMemberService.get_admin(db, pk)
    return _ok(TeamMemberOut.model_validate(member))


@router.put("/team/{pk}", response_model=ApiResponse[TeamMemberOut])
def admin_update_team(pk: int, payload: TeamMemberUpdate, db: Session = Depends(get_db),
                      user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    member = TeamMemberService.update(db, pk, payload)
    db.commit()
    revalidate("team")  # S-33
    return _ok(TeamMemberOut.model_validate(member))


@router.patch("/team/{pk}/visibility", response_model=ApiResponse[TeamMemberOut])
def admin_team_visibility(pk: int, payload: dict, db: Session = Depends(get_db),
                          user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    member = TeamMemberService.set_visibility(db, pk, bool(payload.get("active", True)))
    db.commit()
    revalidate("team")  # S-33：团队显隐即时生效
    return _ok(TeamMemberOut.model_validate(member))


@router.delete("/team/{pk}", response_model=ApiResponse[dict])
def admin_delete_team(pk: int, db: Session = Depends(get_db),
                      user: dict = Depends(get_current_user)) -> dict:
    _require(CONTENT_WRITE_ROLES, user)
    TeamMemberService.delete(db, pk)
    db.commit()
    revalidate("team")  # S-33
    return _ok({"deleted": True})


# ==================== upload（S-10 上传管道） ====================

@router.post("/upload", response_model=ApiResponse[dict])
def admin_upload(
    file: UploadFile = File(...),
    folder: str = Query(default="images", pattern=r"^[a-z0-9_-]+$"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """文件上传：MIME 白名单 + ≤10MB + 扩展名白名单 + 路径穿越防护（ADR-007）。

    - 落盘 uploads/{folder}/{uuid}.{ext}（文件名不信任原始名）
    - 写 uploads 表（owner_type=file, owner_id=NULL, uploaded_by=当前用户）
    - 返回 {url, storage_key, mime, size} 供前端表单引用
    """
    _require(CONTENT_WRITE_ROLES, user)
    rel_path = storage_backend.put(file, folder=folder)
    mime = (file.content_type or "").lower()
    # 文件大小（put 内已校验 ≤10MB）
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    url = storage_backend.url_for(rel_path)
    # 写 uploads 索引表（第 3 步先记录，owner 关联后续步骤完善）
    from app.models.upload import Upload

    upload_row = Upload(
        owner_type="file",
        owner_id=None,
        storage_key=rel_path,
        url=url,
        mime=mime,
        size=size,
        uploaded_by=user.get("id"),
    )
    db.add(upload_row)
    db.commit()
    return _ok({"url": url, "storage_key": rel_path, "mime": mime, "size": size})
# ==================== 线索域：messages（S-15） ====================
# 对齐 §6.4.7：GET 列表（kind/status/source_page/keyword/page）｜PATCH 状态流转（§4.3 迁移，违规 4003）｜POST threads 追加

LEAD_ROLES = ("admin", "sales", "cs")


@router.get("/messages", response_model=ApiResponse[ApiListResponse[dict]])
def admin_list_messages(
    kind: str | None = Query(default=None, pattern=r"^(appointment|message)$"),
    status: str | None = Query(default=None, pattern=r"^(new|contacted|converted|closed)$"),
    source_page: str | None = Query(default=None, max_length=200),
    keyword: str | None = Query(default=None, max_length=100),
    page: int | None = Query(default=None, ge=1),
    page_size: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(LEAD_ROLES, user)
    from app.services.lead import list_messages

    result = list_messages(
        db,
        kind=kind,
        status=status,
        source_page=source_page,
        keyword=keyword,
        page=page,
        page_size=page_size,
    )
    items = [
        {
            "id": m.id,
            "name": m.name,
            "phone": m.phone,
            "email": m.email,
            "budget": m.budget,
            "content": m.content,
            "source_page": m.source_page,
            "kind": m.kind,
            "status": m.status,
            "note": m.note,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "thread_count": len(m.threads),
        }
        for m in result["items"]
    ]
    return _ok({"items": items, "total": result["total"]})


@router.get("/messages/{pk}", response_model=ApiResponse[dict])
def admin_get_message(
    pk: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(LEAD_ROLES, user)
    from app.services.lead import get_message

    m = get_message(db, pk)
    if m is None:
        raise BizError(4040, "线索不存在")
    data = {
        "id": m.id,
        "name": m.name,
        "phone": m.phone,
        "email": m.email,
        "budget": m.budget,
        "content": m.content,
        "source_page": m.source_page,
        "kind": m.kind,
        "status": m.status,
        "note": m.note,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "threads": [
            {
                "id": t.id,
                "type": t.type,
                "content": t.content,
                "author": t.author,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in (m.threads or [])
        ],
    }
    return _ok(data)


@router.patch("/messages/{pk}/status", response_model=ApiResponse[dict])
def admin_update_message_status(
    pk: int,
    body: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(LEAD_ROLES, user)
    from app.services.lead import update_message_status

    new_status = (body or {}).get("status")
    if new_status not in ("new", "contacted", "converted", "closed"):
        raise BizError(3001, "状态值不合法")
    m = get_message(db, pk)
    if m is None:
        raise BizError(4040, "线索不存在")
    m = update_message_status(db, m, new_status)
    return _ok({"id": m.id, "status": m.status})


@router.post("/messages/{pk}/threads", response_model=ApiResponse[dict])
def admin_append_thread(
    pk: int,
    body: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(LEAD_ROLES, user)
    from app.services.lead import append_thread

    m = get_message(db, pk)
    if m is None:
        raise BizError(4040, "线索不存在")
    type_ = (body or {}).get("type")
    content = (body or {}).get("content")
    author = user.get("username") or user.get("id") or "staff"
    t = append_thread(db, m, type_=type_, content=content, author=str(author))
    return _ok({"id": t.id, "type": t.type, "content": t.content, "author": t.author, "created_at": t.created_at.isoformat() if t.created_at else None})


# ==================== 交付域：projects（S-19，§6.4.8） ====================
# 9 态状态机（§4.3）+ code 自动生成 QY-{yyyy}-{seq} + 进度 PATCH + 软删

DELIVERY_WRITE_ROLES = ("admin", "sales", "design")


def _project_out(p: Project) -> dict:
    return {
        "id": p.id,
        "code": p.code,
        "title": p.title,
        "client_name": p.client_name,
        "client_phone": p.client_phone,
        "designer_id": p.designer_id,
        "designer_name": p.designer_name,
        "site_id": p.site_id,
        "status": p.status,
        "budget": float(p.budget) if p.budget is not None else None,
        "area": float(p.area) if p.area is not None else None,
        "style": p.style,
        "address": p.address,
        "progress": p.progress,
        "start_date": p.start_date.isoformat() if p.start_date else None,
        "expected_end_date": p.expected_end_date.isoformat() if p.expected_end_date else None,
        "note": p.note,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("/projects", response_model=ApiResponse[ApiListResponse[dict]])
def admin_list_projects(
    status: str | None = Query(default=None, pattern=r"^(lead|measuring|designing|quoting|signed|constructing|acceptance|done|cancelled)$"),
    designer_id: int | None = Query(default=None, ge=1),
    keyword: str | None = Query(default=None, max_length=100),
    page: int | None = Query(default=None, ge=1),
    pageSize: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import ProjectService

    items, total = ProjectService.list(
        db, status=status, designer_id=designer_id, keyword=keyword, page=page, page_size=pageSize,
    )
    return _ok({"items": [_project_out(p) for p in items], "total": total, "page": page, "pageSize": pageSize})


@router.post("/projects", response_model=ApiResponse[dict])
def admin_create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import ProjectService

    p = ProjectService.create(db, payload)
    db.commit()
    return _ok(_project_out(p))


@router.get("/projects/{pk}", response_model=ApiResponse[dict])
def admin_get_project(
    pk: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import ProjectService

    p = ProjectService.get(db, pk)
    if p is None:
        raise BizError(4040, "项目不存在")
    return _ok(_project_out(p))


@router.put("/projects/{pk}", response_model=ApiResponse[dict])
def admin_update_project(
    pk: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import ProjectService

    p = ProjectService.update(db, pk, payload)
    db.commit()
    return _ok(_project_out(p))


@router.patch("/projects/{pk}/status", response_model=ApiResponse[dict])
def admin_project_status(
    pk: int,
    body: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import ProjectService

    new_status = (body or {}).get("status")
    if new_status not in ("lead", "measuring", "designing", "quoting", "signed", "constructing", "acceptance", "done", "cancelled"):
        raise BizError(3001, "状态值不合法")
    p = ProjectService.set_status(db, pk, new_status)
    db.commit()
    return _ok({"id": p.id, "status": p.status, "progress": p.progress})


@router.patch("/projects/{pk}/progress", response_model=ApiResponse[dict])
def admin_project_progress(
    pk: int,
    body: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import ProjectService

    progress = (body or {}).get("progress")
    if not isinstance(progress, int) or not 0 <= progress <= 100:
        raise BizError(3001, "进度必须在 0-100 之间")
    p = ProjectService.set_progress(db, pk, progress)
    db.commit()
    return _ok({"id": p.id, "progress": p.progress})


@router.delete("/projects/{pk}", response_model=ApiResponse[dict])
def admin_delete_project(
    pk: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import ProjectService

    ProjectService.delete(db, pk)
    db.commit()
    return _ok({"deleted": True})


# ==================== 交付域：sites（S-20，§6.4.10） ====================
# 硬删：删工地时关联 projects.site_id 置 NULL（循环外键 ON DELETE SET NULL）

def _site_out(s: ConstructionSite) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "address": s.address,
        "supervisor": s.supervisor,
        "phone": s.phone,
        "project_id": s.project_id,
        "remark": s.remark,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/sites", response_model=ApiResponse[ApiListResponse[dict]])
def admin_list_sites(
    keyword: str | None = Query(default=None, max_length=100),
    page: int | None = Query(default=None, ge=1),
    pageSize: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import SiteService

    items, total = SiteService.list(db, keyword=keyword, page=page, page_size=pageSize)
    return _ok({"items": [_site_out(s) for s in items], "total": total, "page": page, "pageSize": pageSize})


@router.post("/sites", response_model=ApiResponse[dict])
def admin_create_site(
    payload: SiteCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import SiteService

    s = SiteService.create(db, payload)
    db.commit()
    return _ok(_site_out(s))


@router.get("/sites/{pk}", response_model=ApiResponse[dict])
def admin_get_site(
    pk: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import SiteService

    s = SiteService.get(db, pk)
    if s is None:
        raise BizError(4040, "工地不存在")
    return _ok(_site_out(s))


@router.put("/sites/{pk}", response_model=ApiResponse[dict])
def admin_update_site(
    pk: int,
    payload: SiteUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import SiteService

    s = SiteService.update(db, pk, payload)
    db.commit()
    return _ok(_site_out(s))


@router.delete("/sites/{pk}", response_model=ApiResponse[dict])
def admin_delete_site(
    pk: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(DELIVERY_WRITE_ROLES, user)
    from app.services.delivery import SiteService

    SiteService.delete(db, pk)
    db.commit()
    return _ok({"deleted": True})


# ==================== 概览仪表盘 overview（S-21，§6.4.2） ====================
# 聚合：KPI（cases/packages/messages/projects/team/sites + 环比 delta）、
# north_star、message/project 状态分布、近 6 月双序列趋势、设计师排行。（§9.6 核心 SQL）

from app.services.overview import compute_overview


@router.get("/overview", response_model=ApiResponse[dict])
def admin_overview(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(("admin", "sales", "design", "cs"), user)
    data = compute_overview(db)
    return _ok(data)


# ==================== 组织域（S-25~S-28，§8.1/§7.2） ====================
# S-26 账号 / S-27 部门+日志+staff-short / S-28 站点配置
# RBAC：accounts/departments/site-config 仅 admin；login-logs 全部可读（§8.1 权限矩阵）

from typing import Any

from app.models.org import Department as DeptModel, Staff as StaffModel
from app.services.org import (
    AuthService,
    DepartmentService,
    LoginLogService,
    SiteConfigService,
    StaffService,
)
from app.schemas.org import (
    ApiResponse as OrgApiResponse,
    DepartmentCreate,
    DepartmentUpdate,
    LoginLogOut,
    SiteConfigUpdate,
    StaffCreate,
    StaffShortOut,
    StaffUpdate,
)

ORG_ADMIN_ROLE = ("admin",)
ALL_ROLES = ("admin", "sales", "design", "cs")


@router.get("/accounts", response_model=OrgApiResponse)
def admin_list_accounts(
    role: str | None = None,
    active: bool | None = None,
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """账号列表：脱敏 id_card_mask（§7.2 accounts）。仅 admin。"""
    _require(ORG_ADMIN_ROLE, user)
    items, total = StaffService.list(db, keyword=keyword, role=role, active=active, page=page, page_size=page_size)
    return _ok({"items": items, "total": total, "page": page, "page_size": page_size})


@router.post("/accounts", response_model=OrgApiResponse)
def admin_create_account(
    payload: StaffCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """新建账号：密码 argon2id 哈希；身份证 AES-GCM 加密落库。仅 admin。"""
    _require(ORG_ADMIN_ROLE, user)
    operator = {**user, "ip": request.client.host if request.client else "unknown"}
    staff_out = StaffService.create(db, payload, operator)
    return _ok(staff_out)


@router.get("/accounts/{pk}", response_model=OrgApiResponse)
def admin_get_account(
    pk: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(ORG_ADMIN_ROLE, user)
    return _ok(StaffService.get(db, pk))


@router.get("/accounts/{pk}/idcard", response_model=OrgApiResponse)
def admin_reveal_idcard(
    pk: int,
    request: Request,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """明文身份证（需审计写 sensitive_access_logs）。仅 admin。"""
    _require(ORG_ADMIN_ROLE, user)
    operator = {**user, "ip": request.client.host if request.client else "unknown"}
    plain = StaffService.reveal_id_card(db, pk, operator)
    return _ok({"id": pk, "id_card": plain})


@router.put("/accounts/{pk}", response_model=OrgApiResponse)
def admin_update_account(
    pk: int,
    payload: StaffUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(ORG_ADMIN_ROLE, user)
    operator = {**user, "ip": request.client.host if request.client else "unknown"}
    return _ok(StaffService.update(db, pk, payload, operator))


@router.patch("/accounts/{pk}/active", response_model=OrgApiResponse)
def admin_account_active(
    pk: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(ORG_ADMIN_ROLE, user)
    return _ok(StaffService.set_active(db, pk, bool(payload.get("active", True))))


@router.delete("/accounts/{pk}", response_model=OrgApiResponse)
def admin_delete_account(
    pk: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(ORG_ADMIN_ROLE, user)
    StaffService.delete(db, pk)
    return _ok({"deleted": True})


# ---------- 部门（S-27） ----------


@router.get("/departments", response_model=OrgApiResponse)
def admin_list_departments(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(ORG_ADMIN_ROLE, user)
    items = [{"id": d.id, "name": d.name, "sort": d.sort, "lead": d.lead, "description": d.description, "created_at": d.created_at} for d in DepartmentService.list(db)]
    return _ok(items)


@router.post("/departments", response_model=OrgApiResponse)
def admin_create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(ORG_ADMIN_ROLE, user)
    d = DepartmentService.create(db, payload)
    return _ok({"id": d.id, "name": d.name, "sort": d.sort, "lead": d.lead, "description": d.description, "created_at": d.created_at})


@router.put("/departments/{pk}", response_model=OrgApiResponse)
def admin_update_department(
    pk: int,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(ORG_ADMIN_ROLE, user)
    d = DepartmentService.update(db, pk, payload)
    return _ok({"id": d.id, "name": d.name, "sort": d.sort, "lead": d.lead, "description": d.description, "created_at": d.created_at})


@router.delete("/departments/{pk}", response_model=OrgApiResponse)
def admin_delete_department(
    pk: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(ORG_ADMIN_ROLE, user)
    DepartmentService.delete(db, pk)
    return _ok({"deleted": True})


# ---------- 登录日志（S-27） ----------


@router.get("/login-logs", response_model=OrgApiResponse)
def admin_list_login_logs(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """登录日志分页。全员可读（§8.1）。"""
    _require(ALL_ROLES, user)
    items, total = LoginLogService.list(db, page=page, page_size=page_size)
    return _ok({"items": [LoginLogOut.model_validate(x).model_dump() for x in items], "total": total, "page": page, "page_size": page_size})


@router.get("/login-logs/export")
def admin_export_login_logs(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """CSV 导出全部登录日志（§7.2 login-logs）。"""
    _require(ALL_ROLES, user)
    rows, _ = LoginLogService.list(db, page=1, page_size=100000)
    csv_text = LoginLogService.to_csv(rows)
    return _ok({"csv": csv_text})


# ---------- staff-short（S-27，项目表单选设计师用） ----------


@router.get("/staff-short", response_model=OrgApiResponse)
def admin_staff_short(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """精简员工列表 {id,name,role}，全员可读（§7.2）。"""
    _require(ALL_ROLES, user)
    rows = db.execute(
        select(StaffModel).where(StaffModel.active.is_(True)).order_by(StaffModel.id)
    ).scalars().all()
    return _ok([{"id": s.id, "name": s.name, "role": s.role} for s in rows])


# ---------- 站点配置（S-28，§8.1 site-config 仅 admin） ----------


@router.get("/site-config", response_model=OrgApiResponse)
def admin_get_site_config(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(ORG_ADMIN_ROLE, user)
    return _ok(SiteConfigService.get_admin(db))


@router.put("/site-config", response_model=OrgApiResponse)
def admin_update_site_config(
    payload: SiteConfigUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require(ORG_ADMIN_ROLE, user)
    return _ok(SiteConfigService.update_admin(db, payload))
