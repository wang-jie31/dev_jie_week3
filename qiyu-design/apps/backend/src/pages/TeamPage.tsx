/**
 * 团队管理（S-23，2026-08-27 补充分页）
 *
 * 功能：
 * - 列表：表格显示 姓名/职位/专长/排序/展示状态
 * - 分页：每页 10 条，上一页/下一页 + 页码提示（后端返回全量，前端本地分页）
 * - 新建/编辑弹窗：name 必填，title/specialty/bio/order/active 可选
 * - 行内启停（PATCH visibility，前台是否展示）+ 删除
 * 数据源：teamApi（第 3 步团队 ORM，S-23 补齐后台页面）
 */
import { useEffect, useState } from "react";
import { teamApi, BizError } from "../lib/api";
import type { TeamAdminItem } from "../lib/api";
import ImageCropUpload from "../components/ImageCropUpload"; // 头像上传 + 裁剪
import PageSizeSelect from "../components/PageSizeSelect"; // 每页条数选择器（5/10/20/50）

const DEFAULT_PAGE_SIZE = 10; // 默认每页显示条数

interface TeamForm {
  name: string;
  title: string;
  specialty: string;
  bio: string;
  order: string;
  active: boolean;
  avatar: string; // 头像图（2026-08-27 增加上传）
}

const EMPTY_FORM: TeamForm = {
  name: "",
  title: "",
  specialty: "",
  bio: "",
  order: "0",
  active: true,
  avatar: "",
};

export default function TeamPage() {
  const [items, setItems] = useState<TeamAdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamAdminItem | null>(null);
  const [form, setForm] = useState<TeamForm>(EMPTY_FORM);
  const [page, setPage] = useState(1); // 当前页码（本地分页）
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE); // 每页条数（可切换 5/10/20/50）

  // 本地分页：当前页数据切片 + 总页数
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  async function loadList() {
    setLoading(true);
    setError("");
    try {
      setItems(await teamApi.list());
      setPage(1); // 数据刷新后回到第一页
    } catch (e) {
      setError(e instanceof BizError ? e.message : "加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(m: TeamAdminItem) {
    setEditing(m);
    setForm({
      name: m.name,
      title: m.title ?? "",
      specialty: m.specialty ?? "",
      bio: m.bio ?? "",
      order: String(m.order ?? 0),
      active: m.active,
      avatar: m.avatar ?? "",
    });
    setModalOpen(true);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = {
        ...form,
        order: Number(form.order) || 0,
        avatar: form.avatar || null, // 头像：空串存 null（后端字段可空）
      };
      if (editing) {
        await teamApi.update(editing.id, body);
        setNotice("团队成员已更新");
      } else {
        await teamApi.create(body);
        setNotice("团队成员已创建");
      }
      setModalOpen(false);
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "保存失败");
    }
  }

  async function toggleActive(m: TeamAdminItem) {
    try {
      await teamApi.setActive(m.id, !m.active);
      setNotice(`${m.name} 已${m.active ? "下架" : "上架"}（前台展示${m.active ? "关闭" : "开启"}）`);
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "状态切换失败");
    }
  }

  async function doDelete(m: TeamAdminItem) {
    if (!window.confirm(`确认删除团队成员「${m.name}」？`)) return;
    try {
      await teamApi.remove(m.id);
      setNotice("团队成员已删除");
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "删除失败");
    }
  }

  return (
    <>
      <header className="admin-header">
        <h1>团队管理</h1>
        <div className="header-actions">
          <span className="hint">共 {items.length} 名成员</span>
          <button className="btn btn-ink" onClick={openCreate}>
            + 新增成员
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {notice && <p className="notice-line">{notice}</p>}

      <div className="panel table-panel">
        {loading && items.length === 0 ? (
          <p className="hint">加载中…</p>
        ) : items.length === 0 ? (
          <p className="hint">暂无成员。点击「新增成员」添加第一位设计师。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>职位</th>
                <th>专长</th>
                <th>排序</th>
                <th>展示</th>
                <th>简介</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((m) => (
                <tr key={m.id}>
                  <td className="td-main">{m.name}</td>
                  <td>{m.title || "—"}</td>
                  <td className="td-ellipsis">{m.specialty || "—"}</td>
                  <td className="td-center">{m.order}</td>
                  <td>
                    <button
                      className={`btn btn-ghost ${m.active ? "is-active" : "is-off"}`}
                      onClick={() => toggleActive(m)}
                    >
                      {m.active ? "展示中" : "已隐藏"}
                    </button>
                  </td>
                  <td className="td-ellipsis">{m.bio || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => openEdit(m)}>
                        编辑
                      </button>
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

        {/* 分页条：每页条数 / 上一页 / 页码 / 下一页（数据超过一页才显示） */}
        {totalPages > 1 && (
          <div className="pager">
            <PageSizeSelect
              value={pageSize}
              onChange={(n) => {
                setPageSize(n);
                setPage(1); // 切换每页条数后回到第一页
              }}
            />
            <button
              className="btn btn-ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← 上一页
            </button>
            <span className="pager-info">
              第 {page} / {totalPages} 页 · 共 {items.length} 条
            </span>
            <button
              className="btn btn-ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页 →
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="drawer-mask" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editing ? `编辑成员 ${editing.name}` : "新增成员"}</h2>
              <button className="drawer-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={saveForm} className="modal-body">
              {/* 头像上传 + 裁剪（2026-08-27） */}
              <label className="modal-field">
                <span>头像（可上传 / 裁剪）</span>
                <ImageCropUpload
                  value={form.avatar}
                  onChange={(url) => setForm({ ...form, avatar: url })}
                  folder="team"
                  aspect={1} // 头像按 1:1 正方形裁剪
                  label="成员头像"
                />
              </label>
              <div className="modal-grid">
                <label className="modal-field">
                  <span>姓名 *</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如：李婉清"
                  />
                </label>
                <label className="modal-field">
                  <span>职位</span>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="如：主案设计师"
                  />
                </label>
                <label className="modal-field">
                  <span>专长</span>
                  <input
                    value={form.specialty}
                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                    placeholder="如：原木风 / 奶油风"
                  />
                </label>
                <label className="modal-field">
                  <span>排序</span>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: e.target.value })}
                  />
                </label>
              </div>
              <label className="modal-field">
                <span>简介</span>
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </label>
              <label className="modal-field modal-check">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span>前台展示（关闭即隐藏）</span>
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
    </>
  );
}