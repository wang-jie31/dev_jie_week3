/**
 * 部门管理页（S-30，仅 admin，2026-08-27 补充分页）
 *
 * - 列表：部门 名称/负责人/排序/描述，本地分页（每页 10 条）
 * - 新建/编辑弹窗：name 必填，lead/sort/description 可选
 * - 删除：后端将部门下员工 department_id 置 NULL（软关联），再删除部门
 */
import { useCallback, useEffect, useState } from "react";
import { orgApi, BizError } from "../lib/api";
import type { DepartmentItem } from "../lib/api";
import PageSizeSelect from "../components/PageSizeSelect"; // 每页条数选择器（5/10/20/50）

const DEFAULT_PAGE_SIZE = 10; // 默认每页显示条数

interface DeptForm {
  name: string;
  lead: string;
  sort: string;
  description: string;
}

const EMPTY_FORM: DeptForm = { name: "", lead: "", sort: "0", description: "" };

export default function DepartmentsPage() {
  const [items, setItems] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentItem | null>(null);
  const [form, setForm] = useState<DeptForm>(EMPTY_FORM);
  const [page, setPage] = useState(1); // 当前页码（本地分页）
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE); // 每页条数（可切换 5/10/20/50）

  // 本地分页：当前页切片 + 总页数
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await orgApi.departments());
      setPage(1); // 数据刷新后回到第一页
    } catch (e) {
      setError(e instanceof BizError ? e.message : "加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(d: DepartmentItem) {
    setEditing(d);
    setForm({
      name: d.name,
      lead: d.lead ?? "",
      sort: String(d.sort ?? 0),
      description: d.description ?? "",
    });
    setModalOpen(true);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = {
        name: form.name.trim(),
        lead: form.lead.trim() || null,
        sort: Number(form.sort) || 0,
        description: form.description.trim() || null,
      };
      if (editing) {
        await orgApi.updateDepartment(editing.id, body);
        setNotice(`部门「${form.name}」已更新`);
      } else {
        await orgApi.createDepartment(body);
        setNotice(`部门「${form.name}」已创建`);
      }
      setModalOpen(false);
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "保存失败");
    }
  }

  async function doDelete(d: DepartmentItem) {
    if (
      !window.confirm(
        `确认删除部门「${d.name}」？部门下员工将变为“未分配”，不会删除员工。`
      )
    )
      return;
    try {
      await orgApi.deleteDepartment(d.id);
      setNotice(`部门「${d.name}」已删除`);
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "删除失败");
    }
  }

  return (
    <>
      <header className="admin-header">
        <h1>部门管理</h1>
        <div className="header-actions">
          <span className="hint">共 {items.length} 个部门</span>
          <button className="btn btn-ink" onClick={openCreate}>
            + 新增部门
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {notice && <p className="notice-line">{notice}</p>}

      <div className="panel table-panel">
        {loading && items.length === 0 ? (
          <p className="hint">加载中…</p>
        ) : items.length === 0 ? (
          <p className="hint">暂无部门。点击「新增部门」创建第一个部门。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>排序</th>
                <th>部门名称</th>
                <th>负责人</th>
                <th>描述</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((d) => (
                <tr key={d.id}>
                  <td className="td-center">{d.sort}</td>
                  <td className="td-main">
                    <span className="dept-badge">{d.name}</span>
                  </td>
                  <td>{d.lead || "—"}</td>
                  <td className="td-ellipsis">{d.description || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => openEdit(d)}>
                        编辑
                      </button>
                      <button className="btn btn-danger" onClick={() => doDelete(d)}>
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
              <h2>{editing ? `编辑部门 ${editing.name}` : "新增部门"}</h2>
              <button className="drawer-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={saveForm} className="modal-body">
              <div className="modal-grid">
                <label className="modal-field">
                  <span>部门名称 *</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如：深化设计部"
                  />
                </label>
                <label className="modal-field">
                  <span>排序</span>
                  <input
                    type="number"
                    value={form.sort}
                    onChange={(e) => setForm({ ...form, sort: e.target.value })}
                  />
                </label>
              </div>
              <label className="modal-field">
                <span>负责人</span>
                <input
                  value={form.lead}
                  onChange={(e) => setForm({ ...form, lead: e.target.value })}
                  placeholder="如：设计一号"
                />
              </label>
              <label className="modal-field">
                <span>描述</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
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