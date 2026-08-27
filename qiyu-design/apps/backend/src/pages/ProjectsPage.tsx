/**
 * 项目管理（S-22）
 *
 * 功能：
 * - 列表：status 筛选 + keyword 搜索 + 统一分页条（共 N 条 · 第 X/Y 页）
 * - 表格：code/title/client/designer/status 9 态徽章/progress 进度条/日期
 * - 行内操作：状态流转按钮（按状态机可达，见 PROJECT_TRANSITIONS）
 * - 新建/编辑弹窗：全字段表单（title 必填，其余可选）
 * - 进度 PATCH：进度条旁 +/- 或直接输入
 * - 删除：确认后软删
 *
 * 状态机（与后端 §4.3 一致）：lead→measuring→designing→quoting→signed→constructing→acceptance→done；任意非终态→cancelled
 */
import { useEffect, useState } from "react";
import { deliveryApi, BizError } from "../lib/api";
import type { ProjectItem } from "../lib/api";
import PageSizeSelect from "../components/PageSizeSelect"; // 每页条数选择器（5/10/20/50）

const STATUS_LABEL: Record<string, string> = {
  lead: "线索",
  measuring: "量房",
  designing: "设计",
  quoting: "报价",
  signed: "签约",
  constructing: "施工",
  acceptance: "验收",
  done: "完成",
  cancelled: "取消",
};

const STATUS_CLASS: Record<string, string> = {
  lead: "status-lead",
  measuring: "status-measuring",
  designing: "status-designing",
  quoting: "status-quoting",
  signed: "status-signed",
  constructing: "status-constructing",
  acceptance: "status-acceptance",
  done: "status-done",
  cancelled: "status-cancelled",
};

const PROJECT_TRANSITIONS: Record<string, string[]> = {
  lead: ["measuring", "cancelled"],
  measuring: ["designing", "cancelled"],
  designing: ["quoting", "cancelled"],
  quoting: ["signed", "cancelled"],
  signed: ["constructing", "cancelled"],
  constructing: ["acceptance", "cancelled"],
  acceptance: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

const PAGE_SIZE = 10;

interface ProjectForm {
  title: string;
  client_name: string;
  client_phone: string;
  designer_name: string;
  budget: string;
  area: string;
  style: string;
  address: string;
  status: string;
  progress: string;
  note: string;
}

const EMPTY_FORM: ProjectForm = {
  title: "",
  client_name: "",
  client_phone: "",
  designer_name: "",
  budget: "",
  area: "",
  style: "",
  address: "",
  status: "lead",
  progress: "0",
  note: "",
};

export default function ProjectsPage() {
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE); // 每页条数（可切换 5/10/20/50）
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectItem | null>(null);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);

  async function loadList() {
    setLoading(true);
    setError("");
    try {
      const data = await deliveryApi.projects({
        status: status || undefined,
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
  }, [status, page, pageSize]);

  function search() {
    setPage(1);
    loadList();
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(p: ProjectItem) {
    setEditing(p);
    setForm({
      title: p.title,
      client_name: p.client_name ?? "",
      client_phone: p.client_phone ?? "",
      designer_name: p.designer_name ?? "",
      budget: p.budget != null ? String(p.budget) : "",
      area: p.area != null ? String(p.area) : "",
      style: p.style ?? "",
      address: p.address ?? "",
      status: p.status,
      progress: String(p.progress),
      note: p.note ?? "",
    });
    setModalOpen(true);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = {
        ...form,
        budget: form.budget ? Number(form.budget) : null,
        area: form.area ? Number(form.area) : null,
        progress: Number(form.progress) || 0,
      };
      if (editing) {
        await deliveryApi.updateProject(editing.id, body);
        setNotice("项目已更新");
      } else {
        await deliveryApi.createProject(body);
        setNotice("项目已创建，编号自动生成");
      }
      setModalOpen(false);
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "保存失败");
    }
  }

  async function doStatus(p: ProjectItem, s: string) {
    try {
      await deliveryApi.updateProjectStatus(p.id, s);
      setNotice(`项目 ${p.code} 已流转为「${STATUS_LABEL[s]}」`);
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "流转失败");
    }
  }

  async function doProgress(p: ProjectItem, delta: number) {
    const next = Math.max(0, Math.min(100, p.progress + delta));
    if (next === p.progress) return;
    try {
      await deliveryApi.updateProjectProgress(p.id, next);
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "进度更新失败");
    }
  }

  async function doDelete(p: ProjectItem) {
    if (!window.confirm(`确认删除项目 ${p.code}？此操作不可恢复。`)) return;
    try {
      await deliveryApi.deleteProject(p.id);
      setNotice("项目已删除");
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "删除失败");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <header className="admin-header">
        <h1>项目管理</h1>
        <div className="header-actions">
          <span className="hint">共 {total} 个项目</span>
          <button className="btn btn-ink" onClick={openCreate}>
            + 新建项目
          </button>
        </div>
      </header>

      {/* 筛选区 */}
      <div className="filter-bar">
        <div className="filter-group" role="group" aria-label="状态筛选">
          <button
            className={`filter-chip chip-default ${status === "" ? "active" : ""}`}
            onClick={() => setStatus("")}
          >
            全部状态
          </button>
          {Object.entries(PROJECT_TRANSITIONS).map(([k]) => (
            <button
              key={k}
              className={`filter-chip ${status === k ? "active" : ""}`}
              onClick={() => setStatus(k)}
            >
              {STATUS_LABEL[k] ?? k}
            </button>
          ))}
        </div>
        <div className="filter-search">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="搜索编号 / 名称 / 客户"
            className="search-input"
          />
          <button className="btn btn-ink" onClick={search}>
            搜索
          </button>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}
      {notice && <p className="notice-line">{notice}</p>}

      {/* 表格 */}
      <div className="panel table-panel">
        {loading && items.length === 0 ? (
          <p className="hint">加载中…</p>
        ) : items.length === 0 ? (
          <p className="hint">暂无项目。点击「新建项目」创建第一个。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>项目名称</th>
                <th>客户</th>
                <th>设计师</th>
                <th>状态</th>
                <th>进度</th>
                <th>预算</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="td-id">{p.code}</td>
                  <td className="td-main">{p.title}</td>
                  <td>{p.client_name || "—"}</td>
                  <td>{p.designer_name || "—"}</td>
                  <td>
                    <span className={`status-badge ${STATUS_CLASS[p.status]}`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                  <td>
                    <div className="progress-cell">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="progress-num">{p.progress}%</span>
                      <button
                        className="btn-progress"
                        title="进度 -10"
                        onClick={() => doProgress(p, -10)}
                      >
                        −
                      </button>
                      <button
                        className="btn-progress"
                        title="进度 +10"
                        onClick={() => doProgress(p, 10)}
                      >
                        ＋
                      </button>
                    </div>
                  </td>
                  <td>{p.budget != null ? `¥${Number(p.budget).toLocaleString()}` : "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => openEdit(p)}>
                        编辑
                      </button>
                      {PROJECT_TRANSITIONS[p.status]?.map((s) => (
                        <button
                          key={s}
                          className="btn btn-ghost"
                          onClick={() => doStatus(p, s)}
                        >
                          转{STATUS_LABEL[s] ?? s}
                        </button>
                      ))}
                      <button className="btn btn-danger" onClick={() => doDelete(p)}>
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

      {/* 分页条 */}
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

      {/* 新建/编辑弹窗 */}
      {modalOpen && (
        <div className="drawer-mask" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editing ? `编辑项目 ${editing.code}` : "新建项目"}</h2>
              <button className="drawer-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={saveForm} className="modal-body">
              <label className="modal-field">
                <span>项目名称 *</span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="如：阳光一居改造"
                />
              </label>
              <div className="modal-grid">
                <label className="modal-field">
                  <span>客户称呼</span>
                  <input
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  />
                </label>
                <label className="modal-field">
                  <span>客户电话</span>
                  <input
                    value={form.client_phone}
                    onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  />
                </label>
                <label className="modal-field">
                  <span>设计师</span>
                  <input
                    value={form.designer_name}
                    onChange={(e) => setForm({ ...form, designer_name: e.target.value })}
                  />
                </label>
                <label className="modal-field">
                  <span>预算（元）</span>
                  <input
                    type="number"
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  />
                </label>
                <label className="modal-field">
                  <span>面积（㎡）</span>
                  <input
                    type="number"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  />
                </label>
                <label className="modal-field">
                  <span>风格</span>
                  <input
                    value={form.style}
                    onChange={(e) => setForm({ ...form, style: e.target.value })}
                  />
                </label>
                <label className="modal-field">
                  <span>状态</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="modal-field">
                  <span>进度（%）</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.progress}
                    onChange={(e) => setForm({ ...form, progress: e.target.value })}
                  />
                </label>
              </div>
              <label className="modal-field">
                <span>地址</span>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </label>
              <label className="modal-field">
                <span>备注</span>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
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