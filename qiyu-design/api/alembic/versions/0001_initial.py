"""0001_initial: 栖屿设计 20 张表初始迁移

Revision ID: 0001_initial
Revises: (none)
Create Date: 2026-08-26

说明：本迁移严格对应《03-数据库设计文档.md》第 5 章建表 SQL——
  20 张表 + 索引（含 GIN、部分索引、复合索引）+ 循环外键追加 + site_config 单例 INSERT。
表名沿用文档 snake_case 复数（cases/case_images/packages/package_process_steps/news/
careers/messages/message_threads/departments/staff/login_logs/team_members/projects/
construction_sites/site_config/site_history_items/uploads/sensitive_access_logs/
content_view_stats/refresh_tokens）。
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---------- 1. cases 案例 ----------
    op.create_table(
        "cases",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("slug", sa.String(length=120), nullable=False, unique=True),
        sa.Column(
            "category", sa.String(length=20),
            sa.CheckConstraint("category IN ('private','small','apartment')"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("cover", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("gallery", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("video_url", sa.String(length=500)),
        sa.Column("summary", sa.Text()),
        sa.Column("content", sa.Text()),
        sa.Column("style_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("house_type_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("area_range", sa.String(length=40)),
        sa.Column("location", sa.String(length=200)),
        sa.Column("area", sa.Numeric(8, 2)),
        sa.Column("year", sa.Integer()),
        sa.Column("designer", sa.String(length=100)),
        sa.Column("studio", sa.String(length=100)),
        sa.Column("material_notes", sa.Text()),
        sa.Column("price_per_sqm", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("price_note", sa.String(length=200)),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status", sa.String(length=20),
            sa.CheckConstraint("status IN ('draft','published','offline')"),
            nullable=False, server_default="draft",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_cases_category_status", "cases", ["category", "status"])
    op.create_index("ix_cases_style_gin", "cases", ["style_tags"], postgresql_using="gin")
    op.create_index("ix_cases_house_gin", "cases", ["house_type_tags"], postgresql_using="gin")
    op.create_index(
        "ix_cases_published_view", "cases", ["status", "view_count"],
        postgresql_where=sa.text("status='published'"),
    )

    # ---------- 2. case_images 案例图片 ----------
    op.create_table(
        "case_images",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("case_id", sa.BigInteger(), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_case_images_case", "case_images", ["case_id", "sort"])

    # ---------- 3. packages 套餐 ----------
    op.create_table(
        "packages",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("slug", sa.String(length=120), nullable=False, unique=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "type", sa.String(length=20),
            sa.CheckConstraint("type IN ('single_space','whole_house','style')"),
            nullable=False,
        ),
        sa.Column("cover", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("summary", sa.String(length=500)),
        sa.Column("description", sa.Text()),
        sa.Column("applicable_house_type", sa.String(length=200)),
        sa.Column("price_per_sqm", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("price_from", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("area_step_coefficient", sa.Numeric(4, 2), nullable=False, server_default="1.0"),
        sa.Column("price_note", sa.String(length=200)),
        sa.Column(
            "status", sa.String(length=20),
            sa.CheckConstraint("status IN ('draft','published','offline')"),
            nullable=False, server_default="draft",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_packages_type_status", "packages", ["type", "status"])
    op.create_index("ix_packages_published", "packages", ["status"], postgresql_where=sa.text("status='published'"))

    # ---------- 4. package_process_steps 套餐流程步骤 ----------
    op.create_table(
        "package_process_steps",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("package_id", sa.BigInteger(), sa.ForeignKey("packages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_no", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_pkg_steps_pkg", "package_process_steps", ["package_id", "step_no"])

    # ---------- 5. news 新闻 ----------
    op.create_table(
        "news",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("slug", sa.String(length=120), nullable=False, unique=True),
        sa.Column(
            "category", sa.String(length=20),
            sa.CheckConstraint("category IN ('company','industry')"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("cover", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("summary", sa.String(length=500)),
        sa.Column("content", sa.Text()),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column(
            "status", sa.String(length=20),
            sa.CheckConstraint("status IN ('draft','published','offline')"),
            nullable=False, server_default="draft",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_news_category_status", "news", ["category", "status"])
    op.create_index("ix_news_published", "news", ["status", "published_at"], postgresql_where=sa.text("status='published'"))

    # ---------- 6. careers 招聘岗位 ----------
    op.create_table(
        "careers",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column(
            "category", sa.String(length=20),
            sa.CheckConstraint("category IN ('social','campus')"),
            nullable=False,
        ),
        sa.Column("location", sa.String(length=100)),
        sa.Column("type", sa.String(length=60)),
        sa.Column("duties", sa.Text()),
        sa.Column(
            "status", sa.String(length=20),
            sa.CheckConstraint("status IN ('draft','published','offline')"),
            nullable=False, server_default="draft",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_careers_category_status", "careers", ["category", "status"])

    # ---------- 7. messages 留言/预约 ----------
    op.create_table(
        "messages",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=120)),
        sa.Column("budget", sa.String(length=40)),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_page", sa.String(length=200)),
        sa.Column(
            "kind", sa.String(length=20),
            sa.CheckConstraint("kind IN ('appointment','message')"),
            nullable=False, server_default="appointment",
        ),
        sa.Column(
            "status", sa.String(length=20),
            sa.CheckConstraint("status IN ('new','contacted','converted','closed')"),
            nullable=False, server_default="new",
        ),
        sa.Column("note", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_messages_kind_status", "messages", ["kind", "status"])
    op.create_index("ix_messages_created", "messages", [sa.text("created_at DESC")])

    # ---------- 8. message_threads 留言跟进线程 ----------
    op.create_table(
        "message_threads",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("message_id", sa.BigInteger(), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "type", sa.String(length=20),
            sa.CheckConstraint("type IN ('phone','wechat','sms','email','note')"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author", sa.String(length=60), nullable=False, server_default="system"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_threads_msg", "message_threads", ["message_id", "created_at"])

    # ---------- 9. departments 部门 ----------
    op.create_table(
        "departments",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lead", sa.String(length=60)),
        sa.Column("description", sa.String(length=300)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_departments_sort", "departments", ["sort"])

    # ---------- 10. staff 员工账户 ----------
    op.create_table(
        "staff",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("username", sa.String(length=60), nullable=False, unique=True),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("nickname", sa.String(length=60)),
        sa.Column(
            "gender", sa.String(length=10),
            sa.CheckConstraint("gender IN ('male','female','unknown')"),
        ),
        sa.Column("department_id", sa.BigInteger(), sa.ForeignKey("departments.id", ondelete="SET NULL")),
        sa.Column(
            "role", sa.String(length=20),
            sa.CheckConstraint("role IN ('admin','sales','design','cs')"),
            nullable=False, server_default="cs",
        ),
        sa.Column("salt", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("password_hash", sa.String(length=200), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("phone", sa.String(length=20)),
        sa.Column("address", sa.String(length=300)),
        sa.Column("id_card_enc", sa.Text()),
        sa.Column("id_card_nonce", sa.String(length=40)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_staff_role", "staff", ["role"])
    op.create_index("ix_staff_dept", "staff", ["department_id"])

    # ---------- 11. login_logs 登录日志 ----------
    op.create_table(
        "login_logs",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("staff.id", ondelete="SET NULL")),
        sa.Column("username", sa.String(length=60)),
        sa.Column("name", sa.String(length=60)),
        sa.Column("ip", sa.String(length=64)),
        sa.Column("user_agent", sa.String(length=400)),
        sa.Column("login_time", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_loginlogs_user", "login_logs", ["user_id", sa.text("login_time DESC")])
    op.create_index("ix_loginlogs_time", "login_logs", [sa.text("login_time DESC")])

    # ---------- 12. team_members 团队成员 ----------
    op.create_table(
        "team_members",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("title", sa.String(length=100)),
        sa.Column("avatar", sa.String(length=500)),
        sa.Column("specialty", sa.String(length=200)),
        sa.Column("bio", sa.Text()),
        sa.Column("staff_id", sa.BigInteger(), sa.ForeignKey("staff.id", ondelete="SET NULL")),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_team_active_order", "team_members", ["active", "order"])

    # ---------- 13. projects 项目 ----------
    op.create_table(
        "projects",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("code", sa.String(length=30), nullable=False, unique=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("client_name", sa.String(length=60)),
        sa.Column("client_phone", sa.String(length=20)),
        sa.Column("designer_id", sa.BigInteger(), sa.ForeignKey("staff.id")),
        sa.Column("designer_name", sa.String(length=60)),
        sa.Column("site_id", sa.BigInteger()),  # FK 循环引用，两表建齐后 ALTER TABLE 追加
        sa.Column(
            "status", sa.String(length=20),
            sa.CheckConstraint("status IN ('lead','measuring','designing','quoting','signed','constructing','acceptance','done','cancelled')"),
            nullable=False, server_default="lead",
        ),
        sa.Column("budget", sa.Numeric(12, 2)),
        sa.Column("area", sa.Numeric(8, 2)),
        sa.Column("style", sa.String(length=60)),
        sa.Column("address", sa.String(length=200)),
        sa.Column(
            "progress", sa.Integer(),
            sa.CheckConstraint("progress BETWEEN 0 AND 100"),
            nullable=False, server_default="0",
        ),
        sa.Column("start_date", sa.Date()),
        sa.Column("expected_end_date", sa.Date()),
        sa.Column("note", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_projects_status", "projects", ["status"])
    op.create_index("ix_projects_designer", "projects", ["designer_id"])
    op.create_index("ix_projects_created", "projects", [sa.text("created_at DESC")])

    # ---------- 14. construction_sites 工地 ----------
    op.create_table(
        "construction_sites",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("address", sa.String(length=300)),
        sa.Column("supervisor", sa.String(length=60)),
        sa.Column("phone", sa.String(length=20)),
        sa.Column("project_id", sa.BigInteger()),  # FK 循环引用，两表建齐后追加
        sa.Column("remark", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_sites_project", "construction_sites", ["project_id"])

    # ---------- 循环外键：两表建齐后统一追加 ----------
    op.create_foreign_key(
        "fk_sites_project", "construction_sites", "projects",
        ["project_id"], ["id"], ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_projects_site", "projects", "construction_sites",
        ["site_id"], ["id"], ondelete="SET NULL",
    )

    # ---------- 15. site_config 站点配置（单例 id=1） ----------
    op.create_table(
        "site_config",
        sa.Column("id", sa.SmallInteger(), sa.CheckConstraint("id = 1"), primary_key=True),
        sa.Column("company_intro", sa.Text()),
        sa.Column("brand_intro", sa.Text()),
        sa.Column("process_intro", sa.Text()),
        sa.Column("contact_info", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("social_links", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.execute("INSERT INTO site_config (id) VALUES (1);")

    # ---------- 16. site_history_items 站点历程条目 ----------
    op.create_table(
        "site_history_items",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("year", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_history_sort", "site_history_items", ["sort"])

    # ---------- 17. uploads 上传文件 ----------
    op.create_table(
        "uploads",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("owner_type", sa.String(length=30), nullable=False),
        sa.Column("owner_id", sa.BigInteger()),
        sa.Column("storage_key", sa.String(length=300), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("mime", sa.String(length=80)),
        sa.Column("size", sa.Integer()),
        sa.Column("uploaded_by", sa.BigInteger(), sa.ForeignKey("staff.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_uploads_owner", "uploads", ["owner_type", "owner_id"])

    # ---------- 18. sensitive_access_logs 敏感信息访问审计 ----------
    op.create_table(
        "sensitive_access_logs",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("target_id", sa.BigInteger(), nullable=False),
        sa.Column("target_field", sa.String(length=30), nullable=False),
        sa.Column("operator_id", sa.BigInteger(), sa.ForeignKey("staff.id", ondelete="SET NULL")),
        sa.Column("operator_name", sa.String(length=60)),
        sa.Column("action", sa.String(length=20), nullable=False, server_default="read"),
        sa.Column("ip", sa.String(length=64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_sens_target", "sensitive_access_logs", ["target_id", sa.text("created_at DESC")])

    # ---------- 19. content_view_stats 内容浏览统计 ----------
    op.create_table(
        "content_view_stats",
        sa.Column(
            "content_type", sa.String(length=20),
            sa.CheckConstraint("content_type IN ('case','package','news')"),
            nullable=False,
        ),
        sa.Column("content_id", sa.BigInteger(), nullable=False),
        sa.Column("stat_date", sa.Date(), nullable=False),
        sa.Column("views", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("content_type", "content_id", "stat_date"),
    )

    # ---------- 20. refresh_tokens 刷新令牌 ----------
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("staff_id", sa.BigInteger(), sa.ForeignKey("staff.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("ip", sa.String(length=64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_refresh_staff", "refresh_tokens", ["staff_id"])


def downgrade() -> None:
    # 逆序删除（子表先于父表）
    op.drop_index("ix_refresh_staff", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_table("content_view_stats")

    op.drop_index("ix_sens_target", table_name="sensitive_access_logs")
    op.drop_table("sensitive_access_logs")

    op.drop_index("ix_uploads_owner", table_name="uploads")
    op.drop_table("uploads")

    op.drop_index("ix_history_sort", table_name="site_history_items")
    op.drop_table("site_history_items")

    op.drop_table("site_config")

    # 循环外键需在删表前解除
    op.drop_constraint("fk_projects_site", "projects", type_="foreignkey")
    op.drop_constraint("fk_sites_project", "construction_sites", type_="foreignkey")

    op.drop_index("ix_sites_project", table_name="construction_sites")
    op.drop_table("construction_sites")

    op.drop_index("ix_projects_created", table_name="projects")
    op.drop_index("ix_projects_designer", table_name="projects")
    op.drop_index("ix_projects_status", table_name="projects")
    op.drop_table("projects")

    op.drop_index("ix_team_active_order", table_name="team_members")
    op.drop_table("team_members")

    op.drop_index("ix_loginlogs_time", table_name="login_logs")
    op.drop_index("ix_loginlogs_user", table_name="login_logs")
    op.drop_table("login_logs")

    op.drop_index("ix_staff_dept", table_name="staff")
    op.drop_index("ix_staff_role", table_name="staff")
    op.drop_table("staff")

    op.drop_index("ix_departments_sort", table_name="departments")
    op.drop_table("departments")

    op.drop_index("ix_threads_msg", table_name="message_threads")
    op.drop_table("message_threads")

    op.drop_index("ix_messages_created", table_name="messages")
    op.drop_index("ix_messages_kind_status", table_name="messages")
    op.drop_table("messages")

    op.drop_index("ix_careers_category_status", table_name="careers")
    op.drop_table("careers")

    op.drop_index("ix_news_published", table_name="news")
    op.drop_index("ix_news_category_status", table_name="news")
    op.drop_table("news")

    op.drop_index("ix_pkg_steps_pkg", table_name="package_process_steps")
    op.drop_table("package_process_steps")

    op.drop_index("ix_packages_published", table_name="packages")
    op.drop_index("ix_packages_type_status", table_name="packages")
    op.drop_table("packages")

    op.drop_index("ix_case_images_case", table_name="case_images")
    op.drop_table("case_images")

    op.drop_index("ix_cases_published_view", table_name="cases")
    op.drop_index("ix_cases_house_gin", table_name="cases")
    op.drop_index("ix_cases_style_gin", table_name="cases")
    op.drop_index("ix_cases_category_status", table_name="cases")
    op.drop_table("cases")