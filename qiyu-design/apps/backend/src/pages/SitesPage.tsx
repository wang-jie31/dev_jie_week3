/**
 * 工地管理（S-23）
 *
 * 功能：
 * - 列表：keyword 搜索 + 统一分页条
 * - 表格：工地名/地址/负责人/电话/关联项目/备注
 * - 新建/编辑弹窗
 * - 删除：确认后硬删（后端自动将关联项目 site_id 置 NULL，§6.4.10）
 */
import { useEffect, useState } from "react";
import { deliveryApi, BizError } from "../lib/api";
import type { SiteItem } from "../lib/api";
import PageSizeSelect from "../components/PageSizeSelect"; // 每页条数选择器（5/10/20/50）

const PAGE_SIZE = 10;

interface SiteForm {
  name: string;
  address: string;
  supervisor: string;
  phone: string;
  remark: string;
}

const EMPTY_FORM: SiteForm = {
  name: "",
  address: "",
  supervisor: "",
  phone: "",
  remark: "",
};

export default function SitesPage() {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE); // 每页条数（可切换 5/10/20/50）
  const [items, setItems] = useState<SiteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SiteItem | null>(null);
  const [form, setForm] = useState<SiteForm>(EMPTY_FORM);

  async function loadList() {
    setLoading(true);
    setError("");
    try {
      const data = await deliveryApi.sites({
        keyword: keyword || undefined,
        page,
        page_size: pageSize,
      });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof BizError ? e.message : "加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  function search() {
    setPage(1);
    loadList();
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(s: SiteItem) {
    setEditing(s);
    setForm({
      name: s.name,
      address: s.address ?? "",
      supervisor: s.supervisor ?? "",
      phone: s.phone ?? "",
      remark: s.remark ?? "",
    });
    setModalOpen(true);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await deliveryApi.updateSite(editing.id, { ...form });
        setNotice("工地已更新");
      } else {
        await deliveryApi.createSite({ ...form });
        setNotice("工地已创建");
      }
      setModalOpen(false);
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "保存失败");
    }
  }

  async function doDelete(s: SiteItem) {
    if (
      !window.confirm(
        `确认删除工地「${s.name}」？将硬删，且关联项目自动解绑 site_id。`
      )
    )
      return;
    try {
      await deliveryApi.deleteSite(s.id);
      setNotice("工地已删除（关联项目已解绑）");
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "删除失败");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <header className="admin-header">
        <h1>工地管理</h1>
        <div className="header-actions">
          <span className="hint">共 {total} 个工地</span>
          <button className="btn btn-ink" onClick={openCreate}>
            + 新建工地
          </button>
        </div>
      </header>

      <div className="filter-bar">
        <div className="filter-search">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="搜索工地名 / 地址 / 负责人"
            className="search-input"
          />
          <button className="btn btn-ink" onClick={search}>
            搜索
          </button>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}
      {notice && <p className="notice-line">{notice}</p>}

      <div className="panel table-panel">
        {loading && items.length === 0 ? (
          <p className="hint">加载中…</p>
        ) : items.length === 0 ? (
          <p className="hint">暂无工地。点击「新建工地」创建第一个。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>工地名称</th>
                <th>地址</th>
                <th>负责人</th>
                <th>电话</th>
                <th>关联项目</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td className="td-id">{s.id}</td>
                  <td className="td-main">{s.name}</td>
                  <td className="td-ellipsis">{s.address || "—"}</td>
                  <td>{s.supervisor || "—"}</td>
                  <td className="td-phone">{s.phone || "—"}</td>
                  <td>{s.project_id != null ? `#${s.project_id}` : "—"}</td>
                  <td className="td-ellipsis">{s.remark || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => openEdit(s)}>
                        编辑
                      </button>
                      <button className="btn btn-danger" onClick={() => doDelete(s)}>
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
            setPage(1); // 切换每页条数后回到第一页（useEffect 自动重载）
          }}
        />
        <span className="pager-info">
          共 {total} 条 · 第 {page}/{totalPages} 页
        </span>
        <div className="pager-btns">
          <button
            className="btn btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </button>
          <button
            className="btn btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </div>

      {modalOpen && (
        <div className="drawer-mask" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editing ? `编辑工地 ${editing.name}` : "新建工地"}</h2>
              <button className="drawer-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={saveForm} className="modal-body">
              <label className="modal-field">
                <span>工地名称 *</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：浦东阳光花园工地"
                />
              </label>
              <label className="modal-field">
                <span>地址</span>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </label>
              <div className="modal-grid">
                <label className="modal-field">
                  <span>负责人</span>
                  <input
                    value={form.supervisor}
                    onChange={(e) => setForm({ ...form, supervisor: e.target.value })}
                  />
                </label>
                <label className="modal-field">
                  <span>电话</span>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
              </div>
              <label className="modal-field">
                <span>备注</span>
                <textarea
                  rows={3}
                  value={form.remark}
                  onChange={(e) => setForm({ ...form, remark: e.target.value })}
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