"""0003_packages_area_step_coefficient_jsonb: 面积系数改为 JSONB 对象（2026-08-27 修复 422）

Revision ID: 0003_packages_area_step_coefficient_jsonb
Revises: 0002_site_config_home_banners
Create Date: 2026-08-27

说明：后台「新增套餐」报 422 的根因——
  原型 admin.html 与前端 PackagesPage 都把面积区间系数存为对象
  {"<60":1,"60-90":1.15,"90-120":1.3,">120":1.5}，
  而 packages.area_step_coefficient 列为 Numeric(4,2) 单值，Pydantic 校验失败。
  本迁移将该列改为 JSONB，并把旧单值数据转换为默认四档对象。
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

revision = "0003_pkg_area_coef_jsonb"
down_revision = "0002_site_config_home_banners"
branch_labels = None
depends_on = None

DEFAULT_COEF = '{"<60":1,"60-90":1.15,"90-120":1.3,">120":1.5}'


def upgrade() -> None:
    # 旧数据（Numeric 单值）转成 JSONB 四档对象；NULL/空统一用默认对象
    # 注意：不用 JSON 字符串字面量（冒号 ":1" 会被 SQLAlchemy 误解析为绑定参数），
    #       全部改用 jsonb_build_object 函数式构造。
    # 顺序：先 DROP DEFAULT（旧默认 '1.0' 无法转 jsonb）→ 再 ALTER TYPE → 最后 SET 新默认。
    op.execute(
        "ALTER TABLE packages ALTER COLUMN area_step_coefficient DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE packages "
        "ALTER COLUMN area_step_coefficient TYPE JSONB "
        "USING CASE "
        "  WHEN area_step_coefficient IS NULL THEN jsonb_build_object("
        "    '<60', 1, '60-90', 1.15, '90-120', 1.3, '>120', 1.5) "
        "  ELSE jsonb_build_object('<60', area_step_coefficient, "
        "    '60-90', area_step_coefficient, "
        "    '90-120', area_step_coefficient, "
        "    '>120', area_step_coefficient) "
        "END"
    )
    # 重置默认值（NOT NULL 保持）
    op.execute(
        "ALTER TABLE packages ALTER COLUMN area_step_coefficient "
        "SET DEFAULT jsonb_build_object("
        "'<60', 1, '60-90', 1.15, '90-120', 1.3, '>120', 1.5)"
    )


def downgrade() -> None:
    # 回滚：JSONB → Numeric(4,2)，取第一档 <60 系数（或 1.0）
    op.execute(
        sa.text(
            "ALTER TABLE packages "
            "ALTER COLUMN area_step_coefficient TYPE NUMERIC(4,2) "
            "USING COALESCE((area_step_coefficient->>'<60')::numeric, 1.0)"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE packages ALTER COLUMN area_step_coefficient "
            "SET DEFAULT 1.0"
        )
    )