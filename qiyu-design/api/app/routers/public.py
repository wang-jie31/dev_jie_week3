"""公开接口路由（无需鉴权）：内容域只读 + 留言提交（第 3 步内容部分；留言 POST 第 5 步接入）。

对齐《02-开发技术文档》§6.3 公开 13 端点中内容域部分：
  /api/v1/home /cases /cases/{slug} /cases/{slug}/view /packages /packages/{slug}
  /news /news/{slug} /team /careers /site /about/contact-info
统一响应 {code, message, data}；分页参数缺省返回全量。
"""

import time
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.content import (
    ApiListResponse,
    ApiResponse,
    CaseDetailOut,
    CaseListItem,
    CaseOut,
    HomeOut,
    NewsOut,
    PackageDetailOut,
    PackageListItem,
    SiteConfigPublicOut,
    TeamMemberOut,
    CareerOut,
)
from app.services.content import CaseService, PackageService, NewsService, CareerService, TeamMemberService, SiteService
from app.core.exceptions import BizError

router = APIRouter(prefix="/api/v1", tags=["public"])


@router.get("/health", response_model=ApiResponse[dict])
def health_check() -> dict:
    """健康检查：确认 API 服务存活（文档 §6.2 公开接口）。"""
    return {"code": 0, "message": "ok", "data": {"status": "ok", "service": "qiyu-api", "version": "0.1.0"}}


@router.get("/home", response_model=ApiResponse[HomeOut])
def home(db: Session = Depends(get_db)) -> dict:
    """首页聚合：轮播图(后台配置) + 精选案例×3 + 上架套餐 + 新闻预览×3 + 关于摘要。"""
    # 首页轮播图：从 site_config.home_banners 读取（2026-08-27 功能补全，后台可管理）
    from app.models.content import SiteConfig
    from sqlalchemy import select
    cfg = db.execute(select(SiteConfig).where(SiteConfig.id == 1)).scalar_one_or_none()
    banners = (cfg.home_banners if cfg and cfg.home_banners else [])
    # 仅返回 enabled=True 且按 sort 升序
    banners = [b for b in banners if b.get("enabled", True)] if banners else []
    banners.sort(key=lambda b: b.get("sort", 0))

    featured, _ = CaseService.list_public(db, sort="latest", page=1, page_size=3)
    featured = [c for c in featured if c.is_featured][:3] or featured[:3]
    packages, _ = PackageService.list_public(db)
    news, _ = NewsService.list_public(db, page=1, page_size=3)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "home_banners": banners,  # 首页轮播图（后台配置，frontend HeroCarousel 渲染）
            "featured_cases": [CaseListItem.model_validate(c) for c in featured],
            "published_packages": [PackageListItem.model_validate(p) for p in packages],
            "news_preview": [NewsOut.model_validate(n) for n in news],
            "about_summary": "",
        },
    }


@router.get("/cases", response_model=ApiResponse[ApiListResponse[CaseListItem]])
def list_cases(
    cat: str | None = Query(default=None, pattern=r"^(private|small|apartment)$"),
    style: str | None = Query(default=None, description="风格标签，逗号分隔多值"),
    house_type: str | None = Query(default=None, description="户型标签，逗号分隔多值"),
    area_range: str | None = Query(default=None),
    sort: str = Query(default="latest", pattern=r"^(latest|hottest)$"),
    keyword: str | None = Query(default=None),
    page: int | None = Query(default=None, ge=1),
    pageSize: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    items, total = CaseService.list_public(
        db, cat=cat, style=style, house_type=house_type, area_range=area_range,
        keyword=keyword, sort=sort, page=page, page_size=pageSize,
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "items": [CaseListItem.model_validate(i) for i in items],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        },
    }


@router.get("/cases/{slug}", response_model=ApiResponse[CaseDetailOut])
def case_detail(slug: str, db: Session = Depends(get_db)) -> dict:
    case = CaseService.get_detail(db, slug)
    case, prev, nxt = CaseService.get_with_prev_next(db, case)
    data = CaseDetailOut.model_validate(case)
    data.prev = CaseListItem.model_validate(prev) if prev else None
    data.next = CaseListItem.model_validate(nxt) if nxt else None
    return {"code": 0, "message": "ok", "data": data}


_view_bucket: dict[tuple[str, str], float] = {}


@router.post("/cases/{slug}/view", response_model=ApiResponse[dict])
def bump_case_view(slug: str, request: Request, db: Session = Depends(get_db)) -> dict:
    """浏览量上报：IP+slug 60s 窗口去重（文档 §6.3.4 限流：同 IP 同 slug 60s 计 1 次）。"""
    ip = request.client.host if request.client else "unknown"
    cache_key = (slug, ip)
    now = time.time()
    bucket = _view_bucket.get(cache_key)
    if bucket is not None and now - bucket < 60:
        # 60s 内不重复计数
        case = CaseService.get_detail(db, slug)
        return {"code": 0, "message": "ok", "data": {"view_count": case.view_count, "dedup": True}}
    _view_bucket[cache_key] = now
    count = CaseService.bump_view(db, slug, ip)
    db.commit()
    return {"code": 0, "message": "ok", "data": {"view_count": count, "dedup": False}}


@router.get("/packages", response_model=ApiResponse[ApiListResponse[PackageListItem]])
def list_packages(
    type: str | None = Query(default=None, pattern=r"^(single_space|whole_house|style)$"),
    page: int | None = Query(default=None, ge=1),
    pageSize: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    items, total = PackageService.list_public(db, ptype=type, page=page, page_size=pageSize)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "items": [PackageListItem.model_validate(i) for i in items],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        },
    }


@router.get("/packages/{slug}", response_model=ApiResponse[PackageDetailOut])
def package_detail(slug: str, db: Session = Depends(get_db)) -> dict:
    pkg = PackageService.get_detail(db, slug)
    return {"code": 0, "message": "ok", "data": PackageDetailOut.model_validate(pkg)}


@router.get("/news", response_model=ApiResponse[ApiListResponse[NewsOut]])
def list_news(
    cat: str | None = Query(default=None, pattern=r"^(company|industry)$"),
    page: int | None = Query(default=None, ge=1),
    pageSize: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    items, total = NewsService.list_public(db, cat=cat, page=page, page_size=pageSize)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "items": [NewsOut.model_validate(i) for i in items],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        },
    }


@router.get("/news/{slug}", response_model=ApiResponse[NewsOut])
def news_detail(slug: str, db: Session = Depends(get_db)) -> dict:
    news = NewsService.get_detail(db, slug)
    return {"code": 0, "message": "ok", "data": NewsOut.model_validate(news)}


@router.get("/team", response_model=ApiResponse[list[TeamMemberOut]])
def list_team(db: Session = Depends(get_db)) -> dict:
    members = TeamMemberService.list_public(db)
    return {"code": 0, "message": "ok", "data": [TeamMemberOut.model_validate(m) for m in members]}


@router.get("/careers", response_model=ApiResponse[list[CareerOut]])
def list_careers(
    cat: str | None = Query(default=None, pattern=r"^(social|campus)$"),
    db: Session = Depends(get_db),
) -> dict:
    careers = CareerService.list_public(db, cat=cat)
    return {"code": 0, "message": "ok", "data": [CareerOut.model_validate(c) for c in careers]}


@router.get("/site", response_model=ApiResponse[SiteConfigPublicOut])
def site_config(db: Session = Depends(get_db)) -> dict:
    """站点配置公开输出：site_config 单例（id=1）+ site_history_items 时间轴。"""

    data = SiteService.get_public(db)
    return {"code": 0, "message": "ok", "data": data}


@router.get("/about/contact-info", response_model=ApiResponse[dict])
def about_contact_info(db: Session = Depends(get_db)) -> dict:
    """联系页信息：地址/电话/邮箱/地图坐标（独立端点便于缓存，§6.3.13）。"""
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "address": "",
            "phone": "",
            "email": "",
            "map_coords": None,
            "hours": "",
        },
    }


# ---------- 线索域：公开提交留言/预约（S-16，§6.3.12） ----------
# 错误码：3001 缺必填、3002 手机号格式、3003 内容、3004 限流（429 语义）

from pydantic import BaseModel, Field


class PublicMessageIn(BaseModel):
    r"""公开提交请求体：name/phone 必填，phone 正则 ^1[3-9]\d{9}$。"""

    name: str = Field(..., min_length=1, max_length=60)
    phone: str = Field(..., min_length=11, max_length=11)
    email: str | None = Field(default=None, max_length=120)
    budget: str | None = Field(default=None, max_length=120)
    content: str = Field(..., min_length=1, max_length=2000)
    source_page: str | None = Field(default=None, max_length=200)
    kind: str = Field(default="appointment", pattern=r"^(appointment|message)$")


@router.post("/messages", response_model=ApiResponse[dict])
def public_create_message(
    payload: PublicMessageIn,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """公开提交留言/预约：XSS 清洗 + 限流 10/min/IP + 落库 status=new（§6.3.12）。"""
    from app.services.lead import create_message_public, message_rate_limiter

    ip = request.client.host if request.client else "unknown"
    try:
        msg = create_message_public(
            db,
            name=payload.name,
            phone=payload.phone,
            email=payload.email,
            budget=payload.budget,
            content=payload.content,
            source_page=payload.source_page,
            kind=payload.kind,
            ip=ip,
        )
    except BizError as exc:
        if exc.code == 3004:
            return {
                "code": exc.code,
                "message": exc.message,
                "data": {"retry_after": message_rate_limiter.retry_after(f"{ip}:messages")},
            }
        raise
    return {"code": 0, "message": "ok", "data": {"id": msg.id}}