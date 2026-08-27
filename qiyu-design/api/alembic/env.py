"""Alembic 迁移环境：从项目根 .env 读取 DATABASE_URL，离线模式执行迁移。"""

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# 让 alembic 可以 import app.core.config（读取 .env）
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # api/
PROJECT_ROOT = os.path.dirname(BASE_DIR)  # qiyu-design/
sys.path.insert(0, BASE_DIR)

config = context.config

# 日志配置（alembic.ini -> [loggers]）
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 数据库 URL 优先读项目根 .env，其次读 /root/.env，再次读 api/.env
def _load_env_file(path: str) -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

for p in (os.path.join(PROJECT_ROOT, ".env"),
          os.path.join(PROJECT_ROOT, "..", ".env"),
          os.path.join(BASE_DIR, ".env")):
    _load_env_file(p)

sqlalchemy_url = os.environ.get("DATABASE_URL")
if sqlalchemy_url:
    config.set_main_option("sqlalchemy.url", sqlalchemy_url)

target_metadata = None  # 迁移使用显式 op 写法（对应数据库设计文档 20 表 DDL），不依赖 autogenerate


def run_migrations_offline() -> None:
    """离线模式：只生成 SQL 脚本，不连接数据库。"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式：连接数据库执行迁移。"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()