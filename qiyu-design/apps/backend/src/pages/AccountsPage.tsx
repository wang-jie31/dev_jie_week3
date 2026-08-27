/**
 * 账号管理页（S-30，仅 admin）
 *
 * - 列表：用户名/姓名/角色/部门/手机/身份证（脱敏 110***********1234）/状态/最近登录
 * - 新建/编辑弹窗：个人信息 + 角色 + 部门 + 密码（新建必填，编辑可选）
 * - 身份证：入库存 AES-256-GCM 密文；列表仅显示脱敏；「查看全量」需二次确认（写入敏感访问审计）
 * - 启停 / 删除（admin 自身不可删除，后端 4004 拦截）
 */
import { useCallback, useEffect, useState } from "react";
import { orgApi, BizError } from "../lib/api";
import type { StaffItem, DepartmentItem } from "../lib/api";
import PageSizeSelect from "../components/PageSizeSelect"; // 每页条数选择器（5/10/20/50）

interface StaffForm {
  username: string;
  name: string;
  nickname: string;
  gender: string;
  phone: string;
  address: string;
  id_card: string;
  password: string;
  role: "admin" | "design" | "sales" | "cs";
  department_id: string;
  active: boolean;
}

const EMPTY_FORM: StaffForm = {
  username: "",
  name: "",
  nickname: "",
  gender: "",
  phone: "",
  address: "",
  id_card: "",
  password: "",
  role: "design",
  department_id: "",
  active: true,
};

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  design: "设计师",
  sales: "销售",
  cs: "客服",
};

export default function AccountsPage() {
  const [items, setItems] = useState<StaffItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 每页条数（可切换 5/10/20/50）
  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffItem | null>(null);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);
  const [revealing, setRevealing] = useState<{ id: number; name: string } | null>(null);
  const [revealed, setRevealed] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await orgApi.accounts({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        role: roleFilter || undefined,
        active: activeFilter ? activeFilter === "true" : undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof BizError ? e.message : "加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, roleFilter, activeFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    orgApi
      .departments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(m: StaffItem) {
    setEditing(m);
    setForm({
      username: m.username,
      name: m.name,
      nickname: m.nickname ?? "",
      gender: m.gender ?? "",
      phone: m.phone ?? "",
      address: m.address ?? "",
      id_card: "",
      password: "",
      role: m.role,
      department_id: m.department_id ? String(m.department_id) : "",
      active: m.active,
    });
    setModalOpen(true);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body: Record<string, unknown> = {
        username: form.username.trim(),
        name: form.name.trim(),
        nickname: form.nickname.trim() || null,
        gender: form.gender.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        role: form.role,
        department_id: form.department_id ? Number(form.department_id) : null,
        active: form.active,
      };
      if (form.id_card.trim()) body.id_card = form.id_card.trim();
      if (form.password.trim()) body.password = form.password.trim();
      if (editing) {
        await orgApi.updateAccount(editing.id, body);
        setNotice(`账号「${form.name}」已更新`);
      } else {
        await orgApi.createAccount(body);
        setNotice(`账号「${form.name}」已创建`);
      }
      setModalOpen(false);
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "保存失败");
    }
  }

  async function toggleActive(m: StaffItem) {
    try {
      await orgApi.setAccountActive(m.id, !m.active);
      setNotice(`账号「${m.name}」已${m.active ? "禁用" : "启用"}`);
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "状态切换失败");
    }
  }

  async function doDelete(m: StaffItem) {
    if (!window.confirm(`确认删除账号「${m.name}」？该操作不可恢复。`)) return;
    try {
      await orgApi.deleteAccount(m.id);
      setNotice(`账号「${m.name}」已删除`);
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "删除失败");
    }
  }

  async function doReveal() {
    if (!revealing) return;
    try {
      const r = await orgApi.revealIdCard(revealing.id);
      setRevealed(r.id_card);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "读取身份证失败");
      setRevealing(null);
      setRevealed("");
    }
  }

  function closeReveal() {
    setRevealing(null);
    setRevealed("");
  }

  return (
    <>
      <header className="admin-header">
        <h1>账号管理</h1>
        <div className="header-actions">
          <span className="hint">共 {total} 个账号</span>
          <button className="btn btn-ink" onClick={openCreate}>
            + 新建账号
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {notice && <p className="notice-line">{notice}</p>}

      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="搜索用户名 / 姓名"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="search-input"
          style={{ minWidth: 120 }}
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部角色</option>
          <option value="admin">管理员</option>
          <option value="design">设计师</option>
          <option value="sales">销售</option>
          <option value="cs">客服</option>
        </select>
        <select
          className="search-input"
          style={{ minWidth: 110 }}
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部状态</option>
          <option value="true">启用</option>
          <option value="false">禁用</option>
        </select>
      </div>

      <div className="panel table-panel">
        {loading && items.length === 0 ? (
          <p className="hint">加载中…</p>
        ) : items.length === 0 ? (
          <p className="hint">暂无账号。点击「新建账号」添加第一位员工。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>姓名</th>
                <th>角色</th>
                <th>部门</th>
                <th>手机号</th>
                <th>身份证</th>
                <th>状态</th>
                <th>最近登录</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td className="td-main">{m.username}</td>
                  <td>{m.name}</td>
                  <td>
                    <span className={`role-badge role-${m.role}`}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  </td>
                  <td>{m.department_name ?? "—"}</td>
                  <td className="td-phone">{m.phone || "—"}</td>
                  <td className="td-phone">{m.id_card_mask ?? "—"}</td>
                  <td>
                    <button
                      className={`btn btn-ghost ${m.active ? "is-active" : "is-off"}`}
                      onClick={() => toggleActive(m)}
                    >
                      {m.active ? "启用" : "禁用"}
                    </button>
                  </td>
                  <td className="td-time">{m.last_login_at ? new Date(m.last_login_at).toLocaleString() : "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => openEdit(m)}>
                        编辑
                      </button>
                      {(m.id_card_mask ?? "") !== "" && (
                        <button
                          className="btn btn-ghost"
                          onClick={() => {
                            setRevealed("");
                            setRevealing({ id: m.id, name: m.name });
                          }}
                        >
                          查看全量
                        </button>
                      )}
                      <button className="btn btn-danger" onClick={() => doDelete(m)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pager">
        <PageSizeSelect
          value={pageSize}
          onChange={(n) => {
            setPageSize(n);
            setPage(1); // 切换每页条数后回到第一页（loadList 依赖 pageSize 自动重载）
          }}
        />
        <span className="pager-info">
          第 {page} 页 / 共 {Math.max(1, Math.ceil(total / pageSize))} 页
        </span>
        <div className="pager-btns">
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          <button
            className="btn"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </button>
        </div>
      </div>

      {modalOpen && (
        <div className="drawer-mask" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editing ? `编辑账号 ${editing.name}` : "新建账号"}</h2>
              <button className="drawer-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={saveForm} className="modal-body">
              <div className="modal-grid">
                <label className="modal-field">
                  <span>用户名 *</span>
                  <input
                    required
                    disabled={!!editing}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="如：design02"
                  />
                </label>
                <label className="modal-field">
                  <span>姓名 *</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如：王小明"
                  />
                </label>
                <label className="modal-field">
                  <span>角色</span>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value as StaffForm["role"] })
                    }
                  >
                    <option value="design">设计师</option>
                    <option value="sales">销售</option>
                    <option value="cs">客服</option>
                    <option value="admin">管理员</option>
                  </select>
                </label>
                <label className="modal-field">
                  <span>部门</span>
                  <select
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  >
                    <option value="">未分配</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="modal-field">
                  <span>手机号</span>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="11 位手机号"
                  />
                </label>
                <label className="modal-field">
                  <span>性别</span>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  >
                    <option value="">未填写</option>
                    <option value="male">男</option>
                    <option value="female">女</option>
                  </select>
                </label>
                <label className="modal-field">
                  <span>身份证号</span>
                  <input
                    value={form.id_card}
                    onChange={(e) => setForm({ ...form, id_card: e.target.value })}
                    placeholder="18 位（加密存储，列表仅显示脱敏）"
                  />
                </label>
                <label className="modal-field">
                  <span>{editing ? "密码（留空则不修改）" : "密码 *"}</span>
                  <input
                    type="password"
                    required={!editing}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editing ? "••••••" : "设置初始密码"}
                  />
                </label>
              </div>
              <label className="modal-field">
                <span>地址</span>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="如：栖屿设计工作室"
                />
              </label>
              <label className="modal-field modal-check">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span>启用（禁用后无法登录）</span>
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-ink">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {revealing && (
        <div className="drawer-mask" onClick={closeReveal}>
          <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>查看身份证全量</h2>
              <button className="drawer-close" onClick={closeReveal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="notice-line">
                ⚠️ 账号「{revealing.name}」：查看明文身份证将写入敏感访问审计日志，请谨慎操作。
              </p>
              {revealed ? (
                <p className="id-card-full">{revealed}</p>
              ) : (
                <button className="btn btn-ink" onClick={doReveal}>
                  确认查看明文
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}