/**
 * 首页轮播图管理（S-04 内容域后台 · 2026-08-27 功能补全）
 *
 * 对照前台 static/prototype/index-v7.html 首页轮播区设计：
 * - 列表：缩略图 / 标题 / 英文标题 / 文案 / 排序 / 启用 / 操作
 * - 新建 / 编辑走弹窗：图片可上传 + 截图裁剪（16:9 横幅比例）
 * - 字段与前台 HeroCarousel 一一对应（image/title/en/desc/link/link_label/link2/link2_label）
 * - 排序：上移 / 下移直接换位，编辑弹窗也可填 sort 数字
 * - 保存调用 orgApi.updateSiteConfig({ home_banners }) → 后端 revalidate("site")
 *   触发前台 ISR 即时刷新（ADR-001）
 *
 * 数据源：orgApi.siteConfig / orgApi.updateSiteConfig（后端 /admin/site-config）
 */
import { useEffect, useState } from "react";
import { orgApi, BizError } from "../lib/api";
import ImageCropUpload from "../components/ImageCropUpload"; // 图片上传 + 裁剪

/** 轮播图单项（与后端 SiteConfig.home_banners JSON、前台 HeroSlide 对应） */
interface HomeBanner {
  image: string; // 大图 URL（宽幅横幅）
  title?: string; // 主标题（中文）
  en?: string; // 英文小标题
  desc?: string; // 副文案
  link?: string; // 主按钮链接
  link_label?: string; // 主按钮文案
  link2?: string; // 次按钮链接
  link2_label?: string; // 次按钮文案
  sort?: number; // 排序（升序）
  enabled?: boolean; // 是否启用（关闭后前台不展示）
}

/** 空表单（新建时使用，sort 自动取最大+1） */
function emptyForm(nextSort: number): HomeBanner {
  return {
    image: "",
    title: "",
    en: "",
    desc: "",
    link: "",
    link_label: "查看案例",
    link2: "",
    link2_label: "联系我们",
    sort: nextSort,
    enabled: true,
  };
}

export default function BannersPage() {
  const [items, setItems] = useState<HomeBanner[]>([]); // 轮播列表（按 sort 升序）
  const [loading, setLoading] = useState(false); // 加载中
  const [error, setError] = useState(""); // 错误提示
  const [notice, setNotice] = useState(""); // 成功提示
  const [modalOpen, setModalOpen] = useState(false); // 弹窗开关
  const [editing, setEditing] = useState<number | null>(null); // 正在编辑的下标（null=新建）
  const [form, setForm] = useState<HomeBanner>(emptyForm(1)); // 弹窗表单

  // 加载站点配置 → 取出 home_banners 按 sort 升序
  async function loadList() {
    setLoading(true);
    setError("");
    try {
      const cfg = await orgApi.siteConfig();
      const list = (cfg.home_banners ?? []).slice();
      list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      setItems(list);
    } catch (e) {
      setError(e instanceof BizError ? e.message : "加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 持久化整组轮播配置（保存后前端 ISR 自动刷新，接口异步化不再卡顿）
  async function persist(next: HomeBanner[]) {
    try {
      await orgApi.updateSiteConfig({ home_banners: next });
      setNotice("首页轮播图已保存，首页将自动刷新");
      loadList();
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "保存失败");
    }
  }

  function openCreate() {
    const nextSort = items.length ? Math.max(...items.map((i) => i.sort ?? 0)) + 1 : 1;
    setEditing(null);
    setForm(emptyForm(nextSort));
    setModalOpen(true);
  }

  function openEdit(idx: number) {
    setEditing(idx);
    setForm({ ...items[idx] });
    setModalOpen(true);
  }

  // 弹窗保存：新建 push / 编辑替换对应项
  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.image) {
      setNotice("请上传轮播图片");
      return;
    }
    const next = items.slice();
    if (editing === null) next.push(form);
    else next[editing] = form;
    next.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    setModalOpen(false);
    await persist(next);
  }

  // 删除单项（数组内移除后整体保存）
  async function doDelete(idx: number) {
    const b = items[idx];
    if (!window.confirm(`确认删除轮播「${b.title || b.en || "未命名"}」？此操作不可恢复。`)) return;
    const next = items.slice();
    next.splice(idx, 1);
    await persist(next);
  }

  // 上移 / 下移：交换相邻两项后保存（排序即时生效）
  async function move(idx: number, dir: -1 | 1) {
    const next = items.slice();
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    // 同步交换 sort 值，保证排序语义一致
    const t = next[idx].sort;
    next[idx].sort = next[target].sort;
    next[target].sort = t;
    await persist(next);
  }

  // 启用 / 停用切换
  async function toggleEnabled(idx: number) {
    const next = items.slice();
    next[idx] = { ...next[idx], enabled: !(next[idx].enabled ?? true) };
    await persist(next);
  }

  return (
    <>
      <header className="admin-header">
        <h1>首页轮播图</h1>
        <div className="header-actions">
          <span className="hint">共 {items.length} 张</span>
          <button className="btn btn-ink" onClick={openCreate}>
            + 新增轮播图
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {notice && <p className="notice-line">{notice}</p>}

      <div className="panel table-panel">
        {loading && items.length === 0 ? (
          <p className="hint">加载中…</p>
        ) : items.length === 0 ? (
          <p className="hint">暂无轮播图，点击「新增轮播图」上传首页横幅图片。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>图片</th>
                <th>标题</th>
                <th>英文标题</th>
                <th>文案</th>
                <th>排序</th>
                <th>启用</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b, i) => (
                <tr key={`${b.image}-${i}`}>
                  <td>
                    {b.image ? (
                      <img
                        className="thumb thumb-wide"
                        src={b.image}
                        alt=""
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://placehold.co/120x68";
                        }}
                      />
                    ) : (
                      <span className="thumb thumb-empty">无图</span>
                    )}
                  </td>
                  <td className="td-main">{b.title || "—"}</td>
                  <td>{b.en || "—"}</td>
                  <td className="td-sub">{b.desc || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" disabled={i === 0} onClick={() => move(i, -1)} title="上移">
                        ↑
                      </button>
                      <span className="hint">{b.sort ?? i + 1}</span>
                      <button
                        className="btn btn-ghost"
                        disabled={i === items.length - 1}
                        onClick={() => move(i, 1)}
                        title="下移"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      className={`btn btn-ghost ${(b.enabled ?? true) ? "is-active" : "is-off"}`}
                      onClick={() => toggleEnabled(i)}
                    >
                      {(b.enabled ?? true) ? "启用" : "停用"}
                    </button>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost" onClick={() => openEdit(i)}>
                        编辑
                      </button>
                      <button className="btn btn-danger" onClick={() => doDelete(i)}>
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

      {modalOpen && (
        <div className="drawer-mask" onClick={() => setModalOpen(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editing !== null ? "编辑轮播图" : "新增轮播图"}</h2>
              <button className="drawer-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={saveForm} className="modal-body">
              <label className="modal-field">
                <span>横幅图片 *（可上传 / 裁剪，16:9）</span>
                {/* 图片上传 + 截图裁剪：选中本地图 → 裁成 16:9 横幅 → 上传回填 image 字段 */}
                <ImageCropUpload
                  value={form.image}
                  onChange={(url) => setForm({ ...form, image: url })}
                  folder="banners"
                  aspect={16 / 9}
                  label="轮播横幅"
                  placeholder="点击上传横幅图片（16:9）"
                />
              </label>
              <div className="modal-grid">
                <label className="modal-field">
                  <span>主标题</span>
                  <input
                    value={form.title ?? ""}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="如：栖屿设计 · 温暖人间"
                  />
                </label>
                <label className="modal-field">
                  <span>英文标题</span>
                  <input
                    value={form.en ?? ""}
                    onChange={(e) => setForm({ ...form, en: e.target.value })}
                    placeholder="如：Qiyu Design Studio"
                  />
                </label>
              </div>
              <label className="modal-field">
                <span>副文案</span>
                <textarea
                  rows={2}
                  value={form.desc ?? ""}
                  onChange={(e) => setForm({ ...form, desc: e.target.value })}
                  placeholder="一句话描述，展示在横幅上"
                />
              </label>
              <div className="modal-grid">
                <label className="modal-field">
                  <span>主按钮链接</span>
                  <input
                    value={form.link ?? ""}
                    onChange={(e) => setForm({ ...form, link: e.target.value })}
                    placeholder="如：/cases"
                  />
                </label>
                <label className="modal-field">
                  <span>主按钮文案</span>
                  <input
                    value={form.link_label ?? ""}
                    onChange={(e) => setForm({ ...form, link_label: e.target.value })}
                    placeholder="如：查看案例"
                  />
                </label>
              </div>
              <div className="modal-grid">
                <label className="modal-field">
                  <span>次按钮链接</span>
                  <input
                    value={form.link2 ?? ""}
                    onChange={(e) => setForm({ ...form, link2: e.target.value })}
                    placeholder="如：/about"
                  />
                </label>
                <label className="modal-field">
                  <span>次按钮文案</span>
                  <input
                    value={form.link2_label ?? ""}
                    onChange={(e) => setForm({ ...form, link2_label: e.target.value })}
                    placeholder="如：联系我们"
                  />
                </label>
              </div>
              <div className="modal-grid">
                <label className="modal-field">
                  <span>排序（数字越小越靠前）</span>
                  <input
                    type="number"
                    value={form.sort ?? 0}
                    onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
                  />
                </label>
                <label className="modal-field">
                  <span>启用</span>
                  <select
                    value={String(form.enabled ?? true)}
                    onChange={(e) => setForm({ ...form, enabled: e.target.value === "true" })}
                  >
                    <option value="true">启用</option>
                    <option value="false">停用</option>
                  </select>
                </label>
              </div>
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