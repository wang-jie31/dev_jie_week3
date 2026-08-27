"""中间件：CORS（前台/后台本地端口）、请求日志、统一时区。"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from .config import settings


class CORSMiddleware(BaseHTTPMiddleware):
    """本地部署：允许 WEB_PORT / ADMIN_PORT 跨域访问 API。"""

    def __init__(self, app):
        super().__init__(app)
        self.allowed_origins = {
            f"http://localhost:{settings.WEB_PORT}",
            f"http://127.0.0.1:{settings.WEB_PORT}",
            f"http://localhost:{settings.ADMIN_PORT}",
            f"http://127.0.0.1:{settings.ADMIN_PORT}",
        }

    async def dispatch(self, request: Request, call_next) -> Response:
        origin = request.headers.get("origin", "")
        if request.method == "OPTIONS":
            # 预检请求直接放行
            response = Response()
        else:
            response = await call_next(request)
        if origin in self.allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """安全响应头（第 8 步 S-34，对齐《02-开发技术文档》§12.5）。

    - X-Content-Type-Options: nosniff          防 MIME 嗅探
    - X-Frame-Options: DENY                      防点击劫持（后台独立域，非 iframe 嵌入）
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy: camera=(), microphone=(), geolocation=()  默认收紧
    - CSP：放宽后台管理调用 API（本地端口联调），script 仅自源 + 内联（React/Vite 内联脚本）；
      生产由 Nginx 在 server 层补充 HSTS（§12.5，HTTPS 强制由网关承载）。
    """

    _DEFAULT_CSP = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: http://127.0.0.1:8000 http://localhost:8000; "
        "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000; "
        "font-src 'self' data: https://cdn.jsdelivr.net; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none'"
    )

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = self._DEFAULT_CSP
        return response


class RequestLogMiddleware(BaseHTTPMiddleware):
    """简单请求日志：method path status 耗时。"""

    async def dispatch(self, request: Request, call_next) -> Response:
        import time

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        print(f"[req] {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f}ms)")
        return response