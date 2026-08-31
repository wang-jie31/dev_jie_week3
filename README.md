# 栖屿设计 · 室内设计网站（前台官网 + 后台管理）

> 开发实施方案见 `static/docs/04-项目开发实施方案.md`（**v2.0**，文字+表格详细清晰、分步执行版；本地部署、不用 Docker；代码统一存放于当前目录新建的 `qiyu-design/` 文件夹）；环境确认见 `docs/05-环境确认记录.md`（第 1 步交付物）。

## 项目简介

一家室内设计**企业官网**，服务专长为「个人独居温馨小家定制」：
- **前台官网（apps/web）**：Next.js 15（SSG/ISR）——首页 / 案例展示 / 服务套餐 / 新闻资讯 / 招聘入口 / 关于我们（含联系预约表单）。
- **后台管理（apps/admin）**：Vite + React SPA——登录鉴权（4 角色）+ 概览看板 + 内容/客户/业务/人力五大分组 13 模块。
- **后端（api）**：FastAPI 模块化单体——公开接口 + 后台 JWT 鉴权接口，OpenAPI 为统一契约源。
- **数据库**：PostgreSQL 16 + Alembic——20 张表，JSONB+GIN 支撑案例多维标签筛选。

## 技术栈

| 层 | 选型 |
|---|---|
| 前台渲染 | Next.js 15 App Router（SSG + ISR，SEO） |
| 后台渲染 | Vite + React SPA |
| 后端 | FastAPI（模块化单体，router → service → repository） |
| 数据库 | PostgreSQL 16（Alembic 迁移） |
| 仓库 | pnpm workspace 单仓（web / admin / ui / api-types / api） |
| 鉴权 | JWT access 2h + refresh 8h（落库可撤销）+ RBAC 服务端校验 |
| 密码 | argon2id |
| 敏感信息 | 身份证 AES-256-GCM 加密落库 + 脱敏 + 访问审计 |

## 环境要求（第 1 步已确认）

| 组件 | 版本 | 状态 |
|---|---|---|
| Node.js | 22.22.2（托管版） | ✅ 已就绪 |
| pnpm | ≥9（corepack 启用） | ⚠️ 第 1 步启用 |
| Python | 3.13.12（托管版 venv） | ✅ 已就绪（方案写 3.12，3.13 兼容） |
| PostgreSQL | 16.14（EDB 安装包） | ⚠️ 安装包已下载（D:\qiyu_setup\），等待手动安装（详见 docs/05-环境确认记录.md 第 5 节） |

> Docker 本机不可用，PostgreSQL 按 Q2 兜底方案**本机直接安装**（详见 `docs/05-环境确认记录.md` §3.3）。

## 启动方式（骨架版，第 2 步 M0 完成后可用）

```bash
# 1. 起数据库（PostgreSQL 16 本机服务，连接参数见项目 .env）
#    .env: DATABASE_URL=postgresql+psycopg://postgres:<密码>@localhost:5432/qiyu

# 2. 后端（api/ 目录，venv 内）
python -m venv .venv && .venv/Scripts/pip install -r api/requirements.txt
.venv/Scripts/uvicorn api.app.main:app --reload --port 8000
#  → http://localhost:8000/docs（Swagger UI）

# 3. 数据库迁移（建 20 表）
cd api && alembic upgrade head

# 4. 前台（apps/web）
pnpm --filter web dev      # → http://localhost:3000

# 5. 后台（apps/admin）
pnpm --filter admin dev    # → http://localhost:5173
```

## 演示账号（第 7 步种子数据落地后可用）

| 角色 | 账号 | 密码 |
|---|---|---|
| 管理员 | admin | admin123 |
| 销售 | sales01 | sales123 |
| 设计 | design01 | design123 |
| 客服 | cs01 | cs123 |

## 实施步骤索引（详见方案第 10 章）

| 步骤 | 名称 | 状态 |
|---|---|---|
| 第 1 步 | 方案确认与环境准备 | ✅ 完成（2026-08-26：环境就绪、PG 16.14 安装、qiyu 库创建、.env 写入） |
| 第 2 步 | 工程骨架搭建（M0，S-01~S-05） | 🔄 进行中（当前步骤） |
| 第 3 步 | 内容域后端（M1 接口，S-06~S-10） | 待开始 |
| 第 4 步 | 内容域前台（M1 页面，S-11~S-14） | 待开始 |
| 第 5 步 | 线索域闭环（M2，S-15~S-18） | 待开始 |
| 第 6 步 | 交付域 + 概览看板（M3，S-19~S-24） | 待开始 |
| 第 7 步 | 组织域鉴权 + 数据搬迁（M4，S-25~S-31） | 待开始 |
| 第 8 步 | SEO 与安全加固（M5，S-32~S-34） | 待开始 |
| 第 9 步 | 部署与上线准备（M6，S-35~S-36） | 待开始 |
| 第 10 步 | 收尾验收与最终交付（M6，S-37~S-38） | 待开始 |

> 每步完成即交付可运行增量，经您验收确认后进入下一步。