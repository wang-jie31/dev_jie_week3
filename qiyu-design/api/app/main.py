"""栖屿设计 FastAPI 入口。

启动：uvicorn app.main:app --reload --port 8000
文档：/docs（Swagger UI）、/openapi.json（契约生成源，S-05 使用）
"""

from fastapi import FastAPI

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.middleware import CORSMiddleware, RequestLogMiddleware, SecurityHeadersMiddleware
from app.routers import admin, auth, public

app = FastAPI(
    title="栖屿设计 API",
    description="栖屿设计 · 室内设计企业网站前后端接口（FastAPI）",
    version="0.1.0",
    openapi_url="/openapi.json",
)

# 顺序：最外层安全头（先执行，保证所有响应都带上）→ 请求日志 → CORS
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLogMiddleware)
app.add_middleware(CORSMiddleware)

register_exception_handlers(app)

app.include_router(public.router)
app.include_router(admin.router)
app.include_router(auth.router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {
        "name": settings.SITE_NAME,
        "docs": "/docs",
        "openapi": "/openapi.json",
        "health": "/api/v1/health",
    }