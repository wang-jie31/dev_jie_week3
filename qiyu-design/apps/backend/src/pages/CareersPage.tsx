/**
 * 招聘管理（内容域 · 第 8 步补齐）
 *
 * 对照 static/prototype/admin.html 的招聘管理设计：
 * - 筛选：分类(社会招聘/校园招聘) + 状态
 * - 表格：职位/分类/类型/地点/状态/操作
 * - 操作：上架↔下架 / 编辑 / 删除；新建/编辑走弹窗
 * 数据源：contentApi.careers（后端 /admin/careers）
 */
import { useEffect, useState } from "react";
import { contentApi, BizError } from "../lib/api";
import type { CareerItem } from "../lib/api";
import PageSizeSelect from "../components/PageSizeSelect"; // 每页条数选择器（5/10/20/50）

const CATEGORY_LABELS: Record<string, string> = {
  social: "社会招聘",
  campus: "校园招聘",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已上架",
  offline: "已下架",
};

interface CareerForm {
  title: string;
  category: string;
  location: string;
  type: string;
  duties: string;
  status: string;
}

const EMPTY_FORM: CareerForm = {
  title: "",
  category: "social",
  location: "",
  type: "",
  duties: "",
  status: "draft",
};

export default function CareersPage() {
  const [items, setItems] = useState<CareerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 每页条数（可切换 5/10/20/50）
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CareerItem | null>(null);
  const [form, setForm] = useState<CareerForm>(EMPTY_FORM);

  async function loadList(nextPage = 1) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (category !== "all") qs.append("category", category);
      if (status !== "all") qs.append("status", status);
      if (keyword) qs.append("keyword", keyword);
      qs.append("page", String(nextPage));
      qs.append("pageSize", String(pageSize));
      const res = await contentApi.careers(
        Object.fromEntries(qs.entries()) as never
      );
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof BizError ? e.message : "加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(c: CareerItem) {
    setEditing(c);
    setForm({
      title: c.title,
      category: c.category,
      location: c.location ?? "",
      type: c.type ?? "",
      duties: c.duties ?? "",
      status: c.status,
    });
    setModalOpen(true);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      title: form.title,
      category: form.category,
      location: form.location,
      type: form.type,
      duties: form.duties,
      status: form.status,
    };
    try {
      if (editing) {
        await contentApi.updateCareer(editing.id, body);
        setNotice("招聘岗位已更新");
      } else {
        await contentApi.createCareer(body);
        setNotice("招聘岗位已创建");
      }
      setModalOpen(false);
      loadList(page);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "保存失败");
    }
  }

  async function toggleStatus(c: CareerItem) {
    const next = c.status === "published" ? "offline" : "published";
    try {
      await contentApi.updateCareerStatus(c.id, next);
      setNotice(`「${c.title}」已${next === "published" ? "上架" : "下架"}`);
      loadList(page);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "状态切换失败");
    }
  }

  async function doDelete(c: CareerItem) {
    if (!window.confirm(`确认删除岗位「${c.title}」？此操作不可恢复。`)) return;
    try {
      await contentApi.deleteCareer(c.id);
      setNotice("招聘岗位已删除");
      if (items.length === 1 && page > 1) loadList(page - 1);
      else loadList(page);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "删除失败");
    }
  }

  function applyFilter() {
    loadList(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <header className="admin-header">
        <h1>招聘管理</h1>
        <div className="header-actions">
          <span className="hint">共 {total} 条</span>
          <button className="btn btn-ink" onClick={openCreate}>
            + 新增岗位
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {notice && <p className="notice-line">{notice}</p>}

      <div className="panel filter-panel">
        <select
          className="sel"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">全部分类</option>
          <option value="social">社会招聘</option>
          <option value="campus">校园招聘</option>
        </select>
        <select
          className="sel"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">全部状态</option>
          <option value="published">已上架</option>
          <option value="draft">草稿</option>
          <option value="offline">已下架</option>
        </select>
        <input
          className="input txt-filter"
          placeholder="搜索职位名称"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilter()}
        />
        <button className="btn btn-ghost" onClick={applyFilter}>
          筛选
        </button>
      </div>

      <div className="panel table-panel">
        {loading && items.length === 0 ? (
          <p className="hint">加载中…</p>
        ) : items.length === 0 ? (
          <p className="hint">暂无招聘岗位，点击「新增岗位」发布第一个。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>职位</th>
                <th>分类</th>
                <th>类型</th>
                <th>地点</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="td-main">{c.title}</td>
                  <td>
                    <span className="badge badge-blue">
                      {CATEGORY_LABELS[c.category] ?? c.category}
                    </span>
                  </td>
                  <td>{c.type || "—"}</td>
                  <td>{c.location || "—"}</td>
                  <td>
                    <button
                      className={`btn btn-ghost ${c.status === "published" ? "is-active" : "is-off"}`}
                      onClick={() => toggleStatus(c)}
                    >
                      {STATUS_LABELS[c.status] ?? c.status}
                    </button>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => openEdit(c)}>
                        编辑
                      </button>
                      <button className="btn btn-danger" onClick={() => doDelete(c)}>
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

      {totalPages > 1 && (
        <div className="pager">
          <PageSizeSelect
            value={pageSize}
            onChange={(n) => {
              setPageSize(n);
              loadList(1); // 切换每页条数后回到第一页重新请求
            }}
          />
          <button
            className="btn btn-ghost"
            disabled={page <= 1}
            onClick={() => loadList(page - 1)}
          >
            ← 上一页
          </button>
          <span className="hint">
            第 {page} / {totalPages} 页
          </span>
          <button
            className="btn btn-ghost"
            disabled={page >= totalPages}
            onClick={() => loadList(page + 1)}
          >
            下一页 →
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="drawer-mask" onClick={() => setModalOpen(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editing ? `编辑岗位 ${editing.title}` : "新增岗位"}</h2>
              <button className="drawer-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={saveForm} className="modal-body">
              <div className="modal-grid">
                <label className="modal-field">
                  <span>职位名称 *</span>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="如：主案设计师"
                  />
                </label>
                <label className="modal-field">
                  <span>分类 *</span>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="social">社会招聘</option>
                    <option value="campus">校园招聘</option>
                  </select>
                </label>
                <label className="modal-field">
                  <span>类型</span>
                  <input
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    placeholder="全职 / 实习 / 应届"
                  />
                </label>
                <label className="modal-field">
                  <span>地点</span>
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="上海 · 徐汇"
                  />
                </label>
                <label className="modal-field">
                  <span>状态</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="draft">草稿</option>
                    <option value="published">已上架</option>
                    <option value="offline">已下架</option>
                  </select>
                </label>
              </div>
              <label className="modal-field">
                <span>岗位职责</span>
                <textarea
                  rows={4}
                  value={form.duties}
                  onChange={(e) => setForm({ ...form, duties: e.target.value })}
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setModalOpen(false)}
                >
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