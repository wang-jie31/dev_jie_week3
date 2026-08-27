"""0002_site_config_home_banners: 首页轮播图配置列（2026-08-27 功能补全）

Revision ID: 0002_site_config_home_banners
Revises: 0001_initial
Create Date: 2026-08-27

说明：为 site_config 单例表新增 home_banners 列（JSONB 数组），
  存首页轮播图配置 [{image,title,en,desc,link,link_label,link2,link2_label,sort,enabled}]。
  前台 GET /api/v1/home 读取并按 sort 升序、enabled=true 过滤展示；
  后台「首页轮播图」管理页读写该列，保存后 revalidate("site") 触发前台 ISR 刷新。
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_site_config_home_banners"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 首页轮播图配置（JSONB 数组，默认空数组；兼容已有单例行）
    op.add_column(
        "site_config",
        sa.Column(
            "home_banners",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("site_config", "home_banners")