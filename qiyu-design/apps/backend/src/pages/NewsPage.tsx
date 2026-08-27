/**
 * 新闻管理（S-04 内容域后台 · 第 8 步补齐）
 *
 * 对照 static/prototype/admin.html 的新闻管理设计：
 * - 筛选：分类(企业新闻/行业资讯) + 状态 + 关键字
 * - 表格：封面/标题/分类/发布时间/状态/操作
 * - 操作：上架↔下架 / 编辑 / 删除；新建/编辑走弹窗
 * 数据源：contentApi.news（后端 /admin/news）
 */
import { useEffect, useState } from "react";
import { contentApi, BizError } from "../lib/api";
import type { NewsItem } from "../lib/api";
import ImageCropUpload from "../components/ImageCropUpload"; // 封面图上传 + 裁剪
import { genSlug } from "../lib/slug"; // 中文标题 → 合法 ASCII slug（防 422）
import PageSizeSelect from "../components/PageSizeSelect"; // 每页条数选择器（5/10/20/50）

const CATEGORY_LABELS: Record<string, string> = {
  company: "企业新闻",
  industry: "行业资讯",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已上架",
  offline: "已下架",
};

interface NewsForm {
  title: string;
  slug: string;
  category: string;
  status: string;
  cover: string;
  summary: string;
  content: string;
}

const EMPTY_FORM: NewsForm = {
  title: "",
  slug: "",
  category: "company",
  status: "draft",
  cover: "",
  summary: "",
  content: "",
};

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
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
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [form, setForm] = useState<NewsForm>(EMPTY_FORM);

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
      const res = await contentApi.news(
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

  function openEdit(n: NewsItem) {
    setEditing(n);
    setForm({
      title: n.title,
      slug: n.slug,
      category: n.category,
      status: n.status,
      cover: n.cover ?? "",
      summary: n.summary ?? "",
      content: n.content ?? "",
    });
    setModalOpen(true);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      title: form.title,
      slug: form.slug || genSlug(form.title), // 中文标题自动转 ASCII slug
      category: form.category,
      status: form.status,
      cover: form.cover,
      summary: form.summary,
      content: form.content,
    };
    try {
      if (editing) {
        await contentApi.updateNews(editing.id, body);
        setNotice("新闻已更新");
      } else {
        await contentApi.createNews(body);
        setNotice("新闻已创建");
      }
      setModalOpen(false);
      loadList(page);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "保存失败");
    }
  }

  async function toggleStatus(n: NewsItem) {
    const next = n.status === "published" ? "offline" : "published";
    try {
      await contentApi.updateNewsStatus(n.id, next);
      setNotice(`「${n.title}」已${next === "published" ? "上架" : "下架"}`);
      loadList(page);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "状态切换失败");
    }
  }

  async function doDelete(n: NewsItem) {
    if (!window.confirm(`确认删除新闻「${n.title}」？此操作不可恢复。`)) return;
    try {
      await contentApi.deleteNews(n.id);
      setNotice("新闻已删除");
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
        <h1>新闻管理</h1>
        <div className="header-actions">
          <span className="hint">共 {total} 条</span>
          <button className="btn btn-ink" onClick={openCreate}>
            + 新增新闻
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
          <option value="company">企业新闻</option>
          <option value="industry">行业资讯</option>
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
          placeholder="搜索标题"
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
          <p className="hint">暂无新闻，点击「新增新闻」发布第一篇。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>封面</th>
                <th>标题</th>
                <th>分类</th>
                <th>发布时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id}>
                  <td>
                    {n.cover ? (
                      <img
                        className="thumb"
                        src={n.cover}
                        alt=""
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://placehold.co/74";
                        }}
                      />
                    ) : (
                      <span className="thumb thumb-empty">无图</span>
                    )}
                  </td>
                  <td className="td-main">{n.title}</td>
                  <td>
                    <span className="badge badge-blue">
                      {CATEGORY_LABELS[n.category] ?? n.category}
                    </span>
                  </td>
                  <td>{fmtDate(n.published_at)}</td>
                  <td>
                    <button
                      className={`btn btn-ghost ${n.status === "published" ? "is-active" : "is-off"}`}
                      onClick={() => toggleStatus(n)}
                    >
                      {STATUS_LABELS[n.status] ?? n.status}
                    </button>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => openEdit(n)}>
                        编辑
                      </button>
                      <button className="btn btn-danger" onClick={() => doDelete(n)}>
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
              <h2>{editing ? `编辑新闻 ${editing.title}` : "新增新闻"}</h2>
              <button className="drawer-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={saveForm} className="modal-body">
              <div className="modal-grid">
                <label className="modal-field">
                  <span>标题 *</span>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="如：栖屿设计获年度温馨人居奖"
                  />
                </label>
                <label className="modal-field">
                  <span>slug</span>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="留空自动生成"
                  />
                </label>
                <label className="modal-field">
                  <span>分类 *</span>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="company">企业新闻</option>
                    <option value="industry">行业资讯</option>
                  </select>
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
                <span>封面图（可上传 / 裁剪）</span>
                {/* 上传 + 截图裁剪组件：选中本地图 → 弹窗裁剪 → 上传回填 cover 字段 */}
                <ImageCropUpload
                  value={form.cover}
                  onChange={(url) => setForm({ ...form, cover: url })}
                  folder="news"
                  aspect={4 / 3} // 新闻封面按 4:3 裁剪
                  label="新闻封面"
                />
              </label>
              <label className="modal-field">
                <span>摘要</span>
                <textarea
                  rows={2}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </label>
              <label className="modal-field">
                <span>正文内容</span>
                <textarea
                  rows={6}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
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