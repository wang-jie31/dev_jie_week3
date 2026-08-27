"""应用配置：从项目根 .env 读取（DATABASE_URL/JWT_SECRET/端口/UPLOAD_DIR）。"""

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# config.py 位于 api/app/core/，逐级向上：
#   parents[0]=core  parents[1]=app  parents[2]=api  parents[3]=qiyu-design
# .env 约定放在工作区根（qiyu-design 的上一级，dev_jie_week3/），故取 parents[4]
#   并向下兼容：若 parents[4] 无 .env，则退回 qiyu-design/（parents[3]）
_WS_ROOT = Path(__file__).resolve().parents[4]
PROJECT_ROOT = _WS_ROOT if (_WS_ROOT / ".env").exists() else Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- 数据库 ---
    DATABASE_URL: str = "postgresql+psycopg://postgres:CHANGE_ME@localhost:5432/qiyu"

    # --- JWT ---
    JWT_SECRET: str = "dev-only-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120  # 2h
    REFRESH_TOKEN_EXPIRE_HOURS: int = 8  # 8h

    # --- 服务端口 ---
    API_PORT: int = 8000
    WEB_PORT: int = 3000
    ADMIN_PORT: int = 5173

    # --- 上传 ---
    UPLOAD_DIR: str = "./uploads"

    # --- revalidate 回调（S-33：后台写 → 前台 ISR 即时刷新） ---
    NEXT_REVALIDATE_URL: str = "http://localhost:3000"
    NEXT_REVALIDATE_TOKEN: str = "dev-revalidate-token"

    # --- 敏感信息加密（身份证 AES-256-GCM，§5 敏感信息） ---
    # 32 字节 Base64 密钥；未配置则用 JWT_SECRET 派生（仅开发兜底）
    ID_CARD_KEY_B64: str = ""

    # --- 站点基础 ---
    SITE_NAME: str = "栖屿设计"


settings = Settings()