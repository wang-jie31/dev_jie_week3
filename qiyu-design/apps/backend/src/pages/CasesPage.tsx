/**
 * 案例管理（S-04 内容域后台 · 第 8 步补齐）
 *
 * 对照 static/prototype/admin.html 的案例管理设计：
 * - 筛选器：分类(private/small/apartment) + 状态 + 关键字 + 排序(最新/最热)
 * - 表格：封面/标题/分类/风格·户型/面积/参考价/精选/状态/浏览/操作
 * - 操作：上架↔下架 / 编辑 / 删除；新建/编辑走弹窗表单
 * 数据源：contentApi.cases（后端 /admin/cases）
 */
import { useEffect, useState } from "react";
import { contentApi, BizError } from "../lib/api";
import type { CaseItem } from "../lib/api";
import ImageCropUpload from "../components/ImageCropUpload"; // 封面图上传 + 裁剪
import { genSlug } from "../lib/slug"; // 中文标题 → 合法 ASCII slug（防 422）
import PageSizeSelect from "../components/PageSizeSelect"; // 每页条数选择器（5/10/20/50）

const CATEGORY_LABELS: Record<string, string> = {
  private: "私宅",
  small: "小户型",
  apartment: "公寓",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已上架",
  offline: "已下架",
};

interface CaseForm {
  title: string;
  slug: string;
  category: string;
  status: string;
  cover: string;
  summary: string;
  style_tags: string;
  house_type_tags: string;
  area_range: string;
  location: string;
  area: string;
  year: string;
  designer: string;
  studio: string;
  price_per_sqm: string;
  is_featured: boolean;
}

const EMPTY_FORM: CaseForm = {
  title: "",
  slug: "",
  category: "private",
  status: "draft",
  cover: "",
  summary: "",
  style_tags: "",
  house_type_tags: "",
  area_range: "60-90",
  location: "",
  area: "",
  year: "",
  designer: "",
  studio: "",
  price_per_sqm: "",
  is_featured: false,
};

export default function CasesPage() {
  const [items, setItems] = useState<CaseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 每页条数（可切换 5/10/20/50）
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState("new");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CaseItem | null>(null);
  const [form, setForm] = useState<CaseForm>(EMPTY_FORM);

  async function loadList(nextPage = 1) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (category !== "all") qs.append("category", category);
      if (status !== "all") qs.append("status", status);
      if (keyword) qs.append("keyword", keyword);
      qs.append("sort", sort);
      qs.append("page", String(nextPage));
      qs.append("pageSize", String(pageSize));
      const res = await contentApi.cases(
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
  }, [category, status, sort]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(c: CaseItem) {
    setEditing(c);
    setForm({
      title: c.title,
      slug: c.slug,
      category: c.category,
      status: c.status,
      cover: c.cover ?? "",
      summary: c.summary ?? "",
      style_tags: (c.style_tags ?? []).join(", "),
      house_type_tags: (c.house_type_tags ?? []).join(", "),
      area_range: c.area_range ?? "60-90",
      location: c.location ?? "",
      area: c.area != null ? String(c.area) : "",
      year: c.year != null ? String(c.year) : "",
      designer: c.designer ?? "",
      studio: c.studio ?? "",
      price_per_sqm: c.price_per_sqm != null ? String(c.price_per_sqm) : "",
      is_featured: c.is_featured,
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
      style_tags: form.style_tags
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      house_type_tags: form.house_type_tags
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      area_range: form.area_range,
      location: form.location,
      area: form.area ? Number(form.area) : null,
      year: form.year ? Number(form.year) : null,
      designer: form.designer,
      studio: form.studio,
      price_per_sqm: Number(form.price_per_sqm) || 0,
      is_featured: form.is_featured,
    };
    try {
      if (editing) {
        await contentApi.updateCase(editing.id, body);
        setNotice("案例已更新");
      } else {
        await contentApi.createCase(body);
        setNotice("案例已创建");
      }
      setModalOpen(false);
      loadList(page);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "保存失败");
    }
  }

  async function toggleStatus(c: CaseItem) {
    const next = c.status === "published" ? "offline" : "published";
    try {
      await contentApi.updateCaseStatus(c.id, next);
      setNotice(`「${c.title}」已${next === "published" ? "上架" : "下架"}`);
      loadList(page);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "状态切换失败");
    }
  }

  async function doDelete(c: CaseItem) {
    if (!window.confirm(`确认删除案例「${c.title}」？此操作不可恢复。`)) return;
    try {
      await contentApi.deleteCase(c.id);
      setNotice("案例已删除");
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
        <h1>案例管理</h1>
        <div className="header-actions">
          <span className="hint">共 {total} 条</span>
          <button className="btn btn-ink" onClick={openCreate}>
            + 新增案例
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
          <option value="private">私宅</option>
          <option value="small">小户型</option>
          <option value="apartment">公寓</option>
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
        <select
          className="sel"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="new">最新</option>
          <option value="hot">最热</option>
        </select>
        <input
          className="input txt-filter"
          placeholder="搜索标题 / slug"
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
          <p className="hint">暂无案例，点击「新增案例」添加第一个作品。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>封面</th>
                <th>标题</th>
                <th>分类</th>
                <th>风格/户型</th>
                <th>面积</th>
                <th>参考价</th>
                <th>精选</th>
                <th>状态</th>
                <th>浏览</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.cover ? (
                      <img
                        className="thumb"
                        src={c.cover}
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
                  <td className="td-main">{c.title}</td>
                  <td>{CATEGORY_LABELS[c.category] ?? c.category}</td>
                  <td className="td-ellipsis">
                    {(c.style_tags ?? []).join(" / ") || "—"}
                  </td>
                  <td className="td-center">
                    {c.area != null ? `${c.area}㎡` : "—"}
                  </td>
                  <td>
                    {c.price_per_sqm ? `¥${c.price_per_sqm}/㎡` : "—"}
                  </td>
                  <td className="td-center">
                    {c.is_featured ? (
                      <span className="badge badge-gold">精选</span>
                    ) : (
                      <span className="hint">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      className={`btn btn-ghost ${c.status === "published" ? "is-active" : "is-off"}`}
                      onClick={() => toggleStatus(c)}
                    >
                      {STATUS_LABELS[c.status] ?? c.status}
                    </button>
                  </td>
                  <td className="td-center">{c.view_count ?? 0}</td>
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
              <h2>{editing ? `编辑案例 ${editing.title}` : "新增案例"}</h2>
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
                    placeholder="如：暖白一居 · 木语时光"
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
                    <option value="private">私宅</option>
                    <option value="small">小户型</option>
                    <option value="apartment">公寓</option>
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
                  folder="cases"
                  aspect={4 / 3} // 案例封面按 4:3 裁剪
                  label="案例封面"
                />
              </label>
              <div className="modal-grid">
                <label className="modal-field">
                  <span>风格标签（逗号分隔）</span>
                  <input
                    value={form.style_tags}
                    onChange={(e) =>
                      setForm({ ...form, style_tags: e.target.value })
                    }
                    placeholder="原木风, 奶油风"
                  />
                </label>
                <label className="modal-field">
                  <span>户型标签（逗号分隔）</span>
                  <input
                    value={form.house_type_tags}
                    onChange={(e) =>
                      setForm({ ...form, house_type_tags: e.target.value })
                    }
                    placeholder="一居室, 开间"
                  />
                </label>
                <label className="modal-field">
                  <span>面积区间</span>
                  <select
                    value={form.area_range}
                    onChange={(e) =>
                      setForm({ ...form, area_range: e.target.value })
                    }
                  >
                    <option value="<60">&lt;60㎡</option>
                    <option value="60-90">60-90㎡</option>
                    <option value="90-120">90-120㎡</option>
                    <option value=">120">&gt;120㎡</option>
                  </select>
                </label>
                <label className="modal-field">
                  <span>所在地</span>
                  <input
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="上海 · 徐汇"
                  />
                </label>
                <label className="modal-field">
                  <span>面积（㎡）</span>
                  <input
                    type="number"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    placeholder="如 75"
                  />
                </label>
                <label className="modal-field">
                  <span>年份</span>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    placeholder="2026"
                  />
                </label>
                <label className="modal-field">
                  <span>设计师</span>
                  <input
                    value={form.designer}
                    onChange={(e) =>
                      setForm({ ...form, designer: e.target.value })
                    }
                    placeholder="如：林小满"
                  />
                </label>
                <label className="modal-field">
                  <span>单价（元/㎡）</span>
                  <input
                    type="number"
                    value={form.price_per_sqm}
                    onChange={(e) =>
                      setForm({ ...form, price_per_sqm: e.target.value })
                    }
                    placeholder="如 280"
                  />
                </label>
              </div>
              <label className="modal-field">
                <span>一句话描述</span>
                <textarea
                  rows={2}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </label>
              <label className="modal-field modal-check">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) =>
                    setForm({ ...form, is_featured: e.target.checked })
                  }
                />
                <span>设为首页精选</span>
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