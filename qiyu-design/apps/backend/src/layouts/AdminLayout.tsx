import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  authApi,
  clearToken,
  clearRefreshToken,
  getRefreshToken,
  getToken,
  setToken,
  setRefreshToken,
} from "../lib/api";
import type { AdminMe } from "../lib/api";

/**
 * 后台主布局（S-29 角色侧边栏 + 2026-08-27 一级导航可折叠）
 *
 * - 会话守卫：无 token → 跳 /login；有 token → 调 /admin/me 拉取当前用户
 * - RBAC 分组导航（权限矩阵 §8.1）：
 *   概览（全员） / 内容管理（admin+design） / 客户与交付（admin+sales+design/cs） / 人力与资源（admin）
 * - **一级导航可展开/收起**：点击分组标题切换子项显隐，状态存 localStorage
 *   （key: qiyu_admin_nav_collapsed），默认全部展开。
 * - 侧边栏底部：当前角色 + 账号名 + 退出登录（吊销 refresh 后清 token 跳 /login）
 */
type Role = "admin" | "design" | "sales" | "cs";

const ROLE_LABEL: Record<Role, string> = {
  admin: "管理员",
  design: "设计师",
  sales: "销售",
  cs: "客服",
};

interface NavGroup {
  label: string;
  key: string; // 折叠状态 localStorage 键名用
  roles: Role[];
  items: { to: string; label: string; end?: boolean }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "概览",
    key: "overview",
    roles: ["admin", "design", "sales", "cs"],
    items: [{ to: "/", label: "工作台", end: true }],
  },
  {
    label: "内容管理",
    key: "content",
    roles: ["admin", "design"],
    items: [
      { to: "/cases", label: "案例管理" },
      { to: "/packages", label: "套餐管理" },
      { to: "/news", label: "新闻管理" },
      { to: "/careers", label: "招聘管理" },
      { to: "/team", label: "团队管理" },
      { to: "/banners", label: "首页轮播图" },
    ],
  },
  {
    label: "客户与交付",
    key: "delivery",
    roles: ["admin", "sales", "cs", "design"],
    items: [
      { to: "/messages", label: "线索留言" },
      { to: "/projects", label: "项目交付" },
      { to: "/sites", label: "工地管理" },
    ],
  },
  {
    label: "人力与资源",
    key: "org",
    roles: ["admin", "design", "sales", "cs"],
    items: [
      { to: "/departments", label: "部门管理" },
      { to: "/accounts", label: "账号管理" },
      { to: "/logs", label: "登录日志" },
      { to: "/site", label: "站点设置" },
    ],
  },
];

// 折叠状态 localStorage 键前缀
const NAV_COLLAPSED_KEY = "qiyu_admin_nav_collapsed";

/** 读取某个分组是否折叠（默认展开 false） */
function readCollapsed(key: string): boolean {
  try {
    const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, boolean>;
      return map[key] === true;
    }
  } catch {
    /* 解析失败按默认 */
  }
  return false;
}

/** 写入某个分组的折叠状态 */
function writeCollapsed(key: string, collapsed: boolean) {
  try {
    const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, boolean>;
    map[key] = collapsed;
    localStorage.setItem(NAV_COLLAPSED_KEY, JSON.stringify(map));
  } catch {
    /* localStorage 不可用时静默 */
  }
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [ready, setReady] = useState(false);
  // 分组折叠状态：key → 是否收起（初始化读 localStorage）
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV_GROUPS.forEach((g) => {
      init[g.key] = readCollapsed(g.key);
    });
    return init;
  });

  // 切换某个一级导航的展开/收起并持久化
  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeCollapsed(key, next[key]); // 写入 localStorage，刷新后保持
      return next;
    });
  }

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { replace: true });
      return;
    }
    authApi
      .me()
      .then((u) => {
        setMe(u);
        setReady(true);
      })
      .catch(() => {
        // access 失效：尝试用 refresh 续期
        const refresh = getRefreshToken();
        if (refresh) {
          authApi
            .refresh(refresh)
            .then((r) => {
              setToken(r.access_token);
              setRefreshToken(r.refresh_token);
              return authApi.me();
            })
            .then((u) => {
              setMe(u);
              setReady(true);
            })
            .catch(() => {
              clearToken();
              clearRefreshToken();
              navigate("/login", { replace: true });
            });
        } else {
          clearToken();
          clearRefreshToken();
          navigate("/login", { replace: true });
        }
      });
  }, [navigate]);

  async function doLogout() {
    const refresh = getRefreshToken();
    try {
      if (refresh) await authApi.logout(refresh);
    } catch {
      /* 即便吊销失败也本地清除 */
    }
    clearToken();
    clearRefreshToken();
    navigate("/login", { replace: true });
  }

  if (!ready) {
    return (
      <div className="admin-shell">
        <div className="admin-main" style={{ textAlign: "center", paddingTop: 80 }}>
          <p className="hint">会话校验中…</p>
        </div>
      </div>
    );
  }

  const role = (me?.role ?? "cs") as Role;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">栖屿设计 · 管理后台</div>
        <nav>
          {NAV_GROUPS.filter((g) => g.roles.includes(role)).map((group) => {
            // 当前分组是否收起（用于控制子项显隐与箭头方向）
            const isCollapsed = collapsed[group.key] === true;
            return (
              <div className="nav-group" key={group.key}>
                {/* 一级导航标题：点击切换展开/收起（对齐原型 admin.html：紧凑文本行 + 左侧小 caret ▾） */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className={`nav-group-label flex w-full items-center justify-between ${isCollapsed ? "collapsed" : ""}`}
                  aria-expanded={!isCollapsed}
                >
                  <span>
                    {/* 小字号 caret：展开时 ▾ 向下（默认），收起时旋转 90° 向右 */}
                    <span className="nav-caret" aria-hidden="true">▾</span>
                    {group.label}
                  </span>
                </button>
                {/* 二级导航子项：收起时隐藏 */}
                {!isCollapsed && (
                  <div className="nav-group-items">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) => (isActive ? "active" : "")}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-role">{ROLE_LABEL[role]}</span>
            <span className="sidebar-name">{me?.name ?? me?.username}</span>
          </div>
          <button className="btn btn-ghost sidebar-logout" onClick={doLogout}>
            退出登录
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}