/**
 * 站点设置页（S-30，仅 admin）
 *
 * - 公司简介 / 品牌介绍 / 流程介绍：三段长文本（site_config 单例，PUT 全量替换 history_items）
 * - 联系方式 contact_info（JSON 对象）、社交链接 social_links（数组，含 label/url）
 * - 发展历程 history_items：动态行，year/title/description/sort（新行无 id，后端全量替换）
 */
import { useEffect, useState } from "react";
import { orgApi, BizError } from "../lib/api";

interface HistoryRow {
  id?: number;
  year: string;
  title: string;
  description: string;
  sort: string;
}

interface SocialRow {
  label: string;
  url: string;
}

interface CfgForm {
  company_intro: string;
  brand_intro: string;
  process_intro: string;
  contact: { phone: string; email: string; address: string; wechat: string };
  socials: SocialRow[];
  history: HistoryRow[];
}

const EMPTY_FORM: CfgForm = {
  company_intro: "",
  brand_intro: "",
  process_intro: "",
  contact: { phone: "", email: "", address: "", wechat: "" },
  socials: [],
  history: [],
};

export default function SiteConfigPage() {
  const [form, setForm] = useState<CfgForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const d = await orgApi.siteConfig();
        setForm({
          company_intro: d.company_intro ?? "",
          brand_intro: d.brand_intro ?? "",
          process_intro: d.process_intro ?? "",
          contact: {
            phone: String((d.contact_info as Record<string, unknown>)?.phone ?? ""),
            email: String((d.contact_info as Record<string, unknown>)?.email ?? ""),
            address: String((d.contact_info as Record<string, unknown>)?.address ?? ""),
            wechat: String((d.contact_info as Record<string, unknown>)?.wechat ?? ""),
          },
          socials: (d.social_links ?? []).map((s) => ({
            label: String(s.label ?? ""),
            url: String(s.url ?? ""),
          })),
          history: (d.history_items ?? []).map((h) => ({
            id: h.id,
            year: h.year,
            title: h.title,
            description: h.description ?? "",
            sort: String(h.sort ?? 0),
          })),
        });
      } catch (e) {
        setError(e instanceof BizError ? e.message : "加载站点配置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateContact(k: keyof CfgForm["contact"], v: string) {
    setForm({ ...form, contact: { ...form.contact, [k]: v } });
  }

  function addSocial() {
    setForm({ ...form, socials: [...form.socials, { label: "", url: "" }] });
  }
  function patchSocial(i: number, k: keyof SocialRow, v: string) {
    const next = form.socials.map((s, idx) => (idx === i ? { ...s, [k]: v } : s));
    setForm({ ...form, socials: next });
  }
  function removeSocial(i: number) {
    setForm({ ...form, socials: form.socials.filter((_, idx) => idx !== i) });
  }

  function addHistory() {
    setForm({
      ...form,
      history: [...form.history, { year: "", title: "", description: "", sort: "0" }],
    });
  }
  function patchHistory(i: number, k: keyof HistoryRow, v: string) {
    const next = form.history.map((h, idx) => (idx === i ? { ...h, [k]: v } : h));
    setForm({ ...form, history: next });
  }
  function removeHistory(i: number) {
    setForm({ ...form, history: form.history.filter((_, idx) => idx !== i) });
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const body = {
        company_intro: form.company_intro,
        brand_intro: form.brand_intro,
        process_intro: form.process_intro,
        contact_info: form.contact,
        social_links: form.socials.filter((s) => s.label.trim() || s.url.trim()),
        history_items: form.history
          .filter((h) => h.year.trim() || h.title.trim())
          .map((h) => ({
            id: h.id,
            year: h.year.trim(),
            title: h.title.trim(),
            description: h.description.trim() || null,
            sort: Number(h.sort) || 0,
          })),
      };
      await orgApi.updateSiteConfig(body);
      setNotice("站点配置已保存（前台首页/关于页即时生效）");
    } catch (err) {
      setNotice(err instanceof BizError ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-header">
        <h1>站点设置</h1>
        <span className="hint">site_config 单例 · 仅 admin 可编辑</span>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {notice && <p className="notice-line">{notice}</p>}

      {loading ? (
        <p className="hint">加载中…</p>
      ) : (
        <form onSubmit={saveForm} className="settings-blocks">
          <section className="settings-block">
            <h3>公司简介</h3>
            <p className="block-hint">展示于首页「关于栖屿」区域与关于页。</p>
            <label className="form-field">
              <span>公司简介</span>
              <textarea
                rows={4}
                value={form.company_intro}
                onChange={(e) => setForm({ ...form, company_intro: e.target.value })}
              />
            </label>
          </section>

          <section className="settings-block">
            <h3>品牌与流程</h3>
            <p className="block-hint">品牌介绍用于首页品牌区；流程介绍用于「服务流程」板块。</p>
            <label className="form-field">
              <span>品牌介绍</span>
              <textarea
                rows={3}
                value={form.brand_intro}
                onChange={(e) => setForm({ ...form, brand_intro: e.target.value })}
              />
            </label>
            <label className="form-field" style={{ marginTop: 12 }}>
              <span>流程介绍</span>
              <textarea
                rows={3}
                value={form.process_intro}
                onChange={(e) => setForm({ ...form, process_intro: e.target.value })}
              />
            </label>
          </section>

          <section className="settings-block">
            <h3>联系方式</h3>
            <p className="block-hint">展示于页脚与联系页。</p>
            <div className="form-grid">
              <label className="form-field">
                <span>电话</span>
                <input
                  value={form.contact.phone}
                  onChange={(e) => updateContact("phone", e.target.value)}
                  placeholder="如：0574-8888-6666"
                />
              </label>
              <label className="form-field">
                <span>邮箱</span>
                <input
                  value={form.contact.email}
                  onChange={(e) => updateContact("email", e.target.value)}
                  placeholder="如：hello@qiyu.design"
                />
              </label>
              <label className="form-field">
                <span>地址</span>
                <input
                  value={form.contact.address}
                  onChange={(e) => updateContact("address", e.target.value)}
                  placeholder="如：宁波市鄞州区某某大厦"
                />
              </label>
              <label className="form-field">
                <span>微信号</span>
                <input
                  value={form.contact.wechat}
                  onChange={(e) => updateContact("wechat", e.target.value)}
                  placeholder="如：qiyu-design"
                />
              </label>
            </div>
          </section>

          <section className="settings-block">
            <h3>社交链接</h3>
            <p className="block-hint">页脚社交图标链接；值为空的行保存时自动丢弃。</p>
            <div className="dynamic-rows">
              {form.socials.map((s, i) => (
                <div className="dynamic-row" key={i}>
                  <input
                    placeholder="名称（如：小红书）"
                    value={s.label}
                    onChange={(e) => patchSocial(i, "label", e.target.value)}
                  />
                  <input
                    placeholder="URL（如：https://…）"
                    value={s.url}
                    onChange={(e) => patchSocial(i, "url", e.target.value)}
                  />
                  <button type="button" className="btn btn-danger" onClick={() => removeSocial(i)}>
                    删除
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost" style={{ marginTop: 10 }} onClick={addSocial}>
              + 添加链接
            </button>
          </section>

          <section className="settings-block">
            <h3>发展历程</h3>
            <p className="block-hint">关于页时间轴；保存时按现有 id 全量替换。</p>
            <div className="dynamic-rows">
              {form.history.map((h, i) => (
                <div className="dynamic-row" key={i}>
                  <input
                    placeholder="年份（如：2019）"
                    style={{ width: 90 }}
                    value={h.year}
                    onChange={(e) => patchHistory(i, "year", e.target.value)}
                  />
                  <input
                    placeholder="标题（如：品牌创立）"
                    style={{ flex: 2 }}
                    value={h.title}
                    onChange={(e) => patchHistory(i, "title", e.target.value)}
                  />
                  <input
                    placeholder="描述"
                    style={{ flex: 3 }}
                    value={h.description}
                    onChange={(e) => patchHistory(i, "description", e.target.value)}
                  />
                  <button type="button" className="btn btn-danger" onClick={() => removeHistory(i)}>
                    删除
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost" style={{ marginTop: 10 }} onClick={addHistory}>
              + 添加历程
            </button>
          </section>

          <div className="settings-save">
            <button type="submit" className="btn btn-ink" disabled={saving}>
              {saving ? "保存中…" : "保存配置"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}