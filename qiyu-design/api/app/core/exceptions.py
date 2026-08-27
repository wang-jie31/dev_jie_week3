"""业务异常与统一错误响应（错误码设计见《02-开发技术文档.md》§5.1）。

错误码分段：
  1xxx 公共（4000 沿用文档示例为业务校验码？见下）
  2xxx 内容域  3xxx 线索域  4xxx 项目/交付域  5xxx 系统内部

文档约定：业务性失败返回 HTTP 200 + code != 0 的 JSON，
  便于前端按 code 分支（如状态机非法迁移返回 4003）。
"""

from fastapi import Request
from fastapi.responses import JSONResponse


class BizError(Exception):
    """业务错误：HTTP 200 + {code, message}（前端按 code 分支）。"""

    def __init__(self, code: int, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


class ForbiddenError(BizError):
    """权限不足（RBAC 拒绝）。HTTP 200 + 业务码。"""

    def __init__(self, message: str = "权限不足") -> None:
        super().__init__(4031, message)


def register_exception_handlers(app) -> None:
    @app.exception_handler(BizError)
    async def _biz_error_handler(request: Request, exc: BizError):
        return JSONResponse(
            status_code=200,
            content={"code": exc.code, "message": exc.message, "data": None},
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception):
        # 生产环境不泄漏堆栈
        return JSONResponse(
            status_code=500,
            content={"code": 5001, "message": "服务器内部错误", "data": None},
        )