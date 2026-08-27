/**
 * 套餐管理（S-04 内容域后台 · 第 8 步补齐）
 *
 * 对照 static/prototype/admin.html 的套餐管理设计：
 * - 筛选器：类型(单空间/整屋/风格) + 状态 + 关键字
 * - 表格：封面/套餐名/类型/适用户型/单价/起价/状态/操作
 * - 操作：上架↔下架 / 编辑 / 删除；新建/编辑走弹窗（含面积阶梯系数）
 * 数据源：contentApi.packages（后端 /admin/packages）
 */
import { useEffect, useState } from "react";
import { contentApi, BizError } from "../lib/api";
import type { PackageItem } from "../lib/api";
import ImageCropUpload from "../components/ImageCropUpload"; // 封面图上传 + 裁剪
import { genSlug } from "../lib/slug"; // 中文标题 → 合法 ASCII slug（防 422）
import PageSizeSelect from "../components/PageSizeSelect"; // 每页条数选择器（5/10/20/50）

const TYPE_LABELS: Record<string, string> = {
  single_space: "单空间",
  whole_house: "整屋",
  style: "风格",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已上架",
  offline: "已下架",
};

interface PkgForm {
  name: string;
  slug: string;
  type: string;
  status: string;
  cover: string;
  summary: string;
  description: string;
  applicable_house_type: string;
  price_per_sqm: string;
  price_from: string;
  price_note: string;
  coef_lt60: string;
  coef_6090: string;
  coef_90120: string;
  coef_gt120: string;
  process_steps: string;
}

const EMPTY_FORM: PkgForm = {
  name: "",
  slug: "",
  type: "single_space",
  status: "draft",
  cover: "",
  summary: "",
  description: "",
  applicable_house_type: "",
  price_per_sqm: "",
  price_from: "",
  price_note: "",
  coef_lt60: "1",
  coef_6090: "1.15",
  coef_90120: "1.3",
  coef_gt120: "1.5",
  process_steps: "",
};

export default function PackagesPage() {
  const [items, setItems] = useState<PackageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 每页条数（可切换 5/10/20/50）
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PackageItem | null>(null);
  const [form, setForm] = useState<PkgForm>(EMPTY_FORM);

  async function loadList(nextPage = 1) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (type !== "all") qs.append("type", type);
      if (status !== "all") qs.append("status", status);
      if (keyword) qs.append("keyword", keyword);
      qs.append("page", String(nextPage));
      qs.append("pageSize", String(pageSize));
      const res = await contentApi.packages(
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
  }, [type, status]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(p: PackageItem) {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      type: p.type,
      status: p.status,
      cover: p.cover ?? "",
      summary: p.summary ?? "",
      description: "",
      applicable_house_type: p.applicable_house_type ?? "",
      price_per_sqm: p.price_per_sqm != null ? String(p.price_per_sqm) : "",
      price_from: p.price_from != null ? String(p.price_from) : "",
      price_note: p.price_note ?? "",
      coef_lt60: "1",
      coef_6090: "1.15",
      coef_90120: "1.3",
      coef_gt120: "1.5",
      process_steps: "",
    });
    setModalOpen(true);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      slug: form.slug || genSlug(form.name), // 中文名称自动转 ASCII slug
      type: form.type,
      status: form.status,
      cover: form.cover,
      summary: form.summary,
      description: form.description,
      applicable_house_type: form.applicable_house_type,
      price_per_sqm: Number(form.price_per_sqm) || 0,
      price_from: Number(form.price_from) || 0,
      area_step_coefficient: {
        "<60": Number(form.coef_lt60) || 1,
        "60-90": Number(form.coef_6090) || 1,
        "90-120": Number(form.coef_90120) || 1,
        ">120": Number(form.coef_gt120) || 1,
      },
      process_steps: form.process_steps
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s, i) => ({ step_no: i + 1, title: s })),
    };
    try {
      if (editing) {
        await contentApi.updatePackage(editing.id, body);
        setNotice("套餐已更新");
      } else {
        await contentApi.createPackage(body);
        setNotice("套餐已创建");
      }
      setModalOpen(false);
      loadList(page);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "保存失败");
    }
  }

  async function toggleStatus(p: PackageItem) {
    const next = p.status === "published" ? "offline" : "published";
    try {
      await contentApi.updatePackageStatus(p.id, next);
      setNotice(`「${p.name}」已${next === "published" ? "上架" : "下架"}`);
      loadList(page);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "状态切换失败");
    }
  }

  async function doDelete(p: PackageItem) {
    if (!window.confirm(`确认删除套餐「${p.name}」？此操作不可恢复。`)) return;
    try {
      await contentApi.deletePackage(p.id);
      setNotice("套餐已删除");
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
        <h1>套餐管理</h1>
        <div className="header-actions">
          <span className="hint">共 {total} 条</span>
          <button className="btn btn-ink" onClick={openCreate}>
            + 新增套餐
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {notice && <p className="notice-line">{notice}</p>}

      <div className="panel filter-panel">
        <select className="sel" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">全部类型</option>
          <option value="single_space">单空间</option>
          <option value="whole_house">整屋</option>
          <option value="style">风格</option>
        </select>
        <select className="sel" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">全部状态</option>
          <option value="published">已上架</option>
          <option value="draft">草稿</option>
          <option value="offline">已下架</option>
        </select>
        <input
          className="input txt-filter"
          placeholder="搜索套餐名"
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
          <p className="hint">暂无套餐，点击「新增套餐」添加第一个。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>封面</th>
                <th>套餐名</th>
                <th>类型</th>
                <th>适用户型</th>
                <th>单价</th>
                <th>起价</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.cover ? (
                      <img
                        className="thumb"
                        src={p.cover}
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
                  <td className="td-main">{p.name}</td>
                  <td>
                    <span className="badge badge-amber">
                      {TYPE_LABELS[p.type] ?? p.type}
                    </span>
                  </td>
                  <td className="td-ellipsis">
                    {p.applicable_house_type || "—"}
                  </td>
                  <td>{p.price_per_sqm ? `¥${p.price_per_sqm}/㎡` : "—"}</td>
                  <td>{p.price_from ? `¥${p.price_from} 起` : "后台配置"}</td>
                  <td>
                    <button
                      className={`btn btn-ghost ${p.status === "published" ? "is-active" : "is-off"}`}
                      onClick={() => toggleStatus(p)}
                    >
                      {STATUS_LABELS[p.status] ?? p.status}
                    </button>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => openEdit(p)}>
                        编辑
                      </button>
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
              <h2>{editing ? `编辑套餐 ${editing.name}` : "新增套餐"}</h2>
              <button className="drawer-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={saveForm} className="modal-body">
              <div className="modal-grid">
                <label className="modal-field">
                  <span>套餐名 *</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如：整屋套餐"
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
                  <span>类型 *</span>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="single_space">单空间</option>
                    <option value="whole_house">整屋</option>
                    <option value="style">风格</option>
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
                  folder="packages"
                  aspect={16 / 9} // 套餐封面按 16:9 裁剪
                  label="套餐封面"
                />
              </label>
              <label className="modal-field">
                <span>一句话卖点</span>
                <textarea
                  rows={2}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </label>
              <label className="modal-field">
                <span>详情描述</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <div className="modal-grid">
                <label className="modal-field">
                  <span>适用户型</span>
                  <input
                    value={form.applicable_house_type}
                    onChange={(e) =>
                      setForm({ ...form, applicable_house_type: e.target.value })
                    }
                    placeholder="如：一居室 / 小两居"
                  />
                </label>
                <label className="modal-field">
                  <span>套餐单价（元/㎡）</span>
                  <input
                    type="number"
                    value={form.price_per_sqm}
                    onChange={(e) =>
                      setForm({ ...form, price_per_sqm: e.target.value })
                    }
                    placeholder="如 260"
                  />
                </label>
                <label className="modal-field">
                  <span>起步总价（元）</span>
                  <input
                    type="number"
                    value={form.price_from}
                    onChange={(e) =>
                      setForm({ ...form, price_from: e.target.value })
                    }
                    placeholder="最低套价"
                  />
                </label>
                <label className="modal-field">
                  <span>价格说明</span>
                  <input
                    value={form.price_note}
                    onChange={(e) =>
                      setForm({ ...form, price_note: e.target.value })
                    }
                    placeholder="自动生成，可留空"
                  />
                </label>
              </div>
              <div className="modal-grid grid-4">
                <label className="modal-field">
                  <span>系数 &lt;60㎡</span>
                  <input
                    type="number"
                    step="0.05"
                    value={form.coef_lt60}
                    onChange={(e) => setForm({ ...form, coef_lt60: e.target.value })}
                  />
                </label>
                <label className="modal-field">
                  <span>系数 60-90㎡</span>
                  <input
                    type="number"
                    step="0.05"
                    value={form.coef_6090}
                    onChange={(e) => setForm({ ...form, coef_6090: e.target.value })}
                  />
                </label>
                <label className="modal-field">
                  <span>系数 90-120㎡</span>
                  <input
                    type="number"
                    step="0.05"
                    value={form.coef_90120}
                    onChange={(e) => setForm({ ...form, coef_90120: e.target.value })}
                  />
                </label>
                <label className="modal-field">
                  <span>系数 &gt;120㎡</span>
                  <input
                    type="number"
                    step="0.05"
                    value={form.coef_gt120}
                    onChange={(e) => setForm({ ...form, coef_gt120: e.target.value })}
                  />
                </label>
              </div>
              <label className="modal-field">
                <span>流程步骤（每行一步）</span>
                <textarea
                  rows={4}
                  value={form.process_steps}
                  onChange={(e) =>
                    setForm({ ...form, process_steps: e.target.value })
                  }
                  placeholder={"需求沟通：明确空间用途\n方案设计：平面 + 效果图"}
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