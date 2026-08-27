/**
 * 案例详情页（S-12）—— SSG + ISR 60s
 * 布局：面包屑 → 标题区（分类 tag · 标题 · 摘要）→ 图集网格（开发期占位）→
 *       项目信息块（面积/风格/户型/设计师/造价）→ 正文 → 上下篇导航 → 浏览量上报（client）
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { api, listCaseSlugs } from "@/lib/api";
import { fmtPrice } from "@/components/Cards";
import { articleJsonLd, breadcrumbJsonLd, canonical, seoMetadata } from "@/lib/seo";
import ViewCounter from "./view-counter";

export const revalidate = 60; // 详情页 60s
export const dynamicParams = true; // 新案例动态生成（ISR）

const CAT_LABEL: Record<string, string> = {
  private: "私宅",
  small: "小户型",
  apartment: "公寓改造",
};

export async function generateStaticParams() {
  const slugs = await listCaseSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const item = await api.caseDetail(slug, 3600);
    return seoMetadata({
      title: item.title,
      description: item.summary || `${item.title} · ${item.area ?? ""}㎡ · ${
        item.style_tags?.[0] ?? ""
      }风格案例`,
      path: `/cases/${slug}`,
      ogType: "article",
    });
  } catch {
    return seoMetadata({ title: "案例详情", path: `/cases/${slug}` });
  }
}

/** 正文按段落渲染（后端 Text 纯文本，按空行分段） */
function renderContent(content?: string | null) {
  if (!content) return null;
  const paras = content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length === 0) return null;
  return (
    <div className="space-y-4">
      {paras.map((p, i) => (
        <p key={i} className="text-[14px] leading-[2.05] text-ink/85">
          {p}
        </p>
      ))}
    </div>
  );
}

function NavItem({
  dir,
  title,
  slug,
  category,
}: {
  dir: "prev" | "next";
  title: string;
  slug: string;
  category: string;
}) {
  return (
    <Link
      href={`/cases/${slug}`}
      className="group flex-1 rounded-2xl border border-[#F0E3BE] bg-cream p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
    >
      <p className="font-en text-[10px] uppercase tracking-[0.18em] text-muted">
        {dir === "prev" ? "← 上一篇" : "下一篇 →"}
      </p>
      <p className="mt-2 flex items-center gap-2 text-[13px] text-muted">
        <span className="rounded-full bg-sand px-2 py-0.5 text-[11px]">
          {CAT_LABEL[category] || category}
        </span>
        <span className="truncate">{title}</span>
      </p>
      <p className="mt-1.5 font-serif text-[15px] font-bold text-ink group-hover:text-yolk-d">
        {title}
      </p>
    </Link>
  );
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let item;
  try {
    item = await api.caseDetail(slug, 60);
  } catch {
    notFound();
  }
  if (!item) notFound();

  // 相册图：无 gallery 时用 cover 兜底（对齐原型案例大图）
  const gallery = item.gallery?.length ? item.gallery : [item.cover || null];

  const pageUrl = canonical(`/cases/${slug}`);
  const jsonLdBlocks = [
    breadcrumbJsonLd([
      { name: "首页", url: canonical("/") },
      { name: "案例展示", url: canonical("/cases") },
      { name: item.title, url: pageUrl },
    ]),
    articleJsonLd({
      title: item.title,
      description: item.summary,
      url: pageUrl,
      publishedAt: null,
    }),
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-16">
      {/* JSON-LD（S-32） */}
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
      {/* 面包屑 */}
      <nav className="mt-6 flex items-center gap-2 text-[12px] text-muted" aria-label="面包屑">
        <Link href="/" className="hover:text-ink">首页</Link>
        <span>/</span>
        <Link href="/cases" className="hover:text-ink">案例展示</Link>
        <span>/</span>
        <span className="truncate text-ink">{item.title}</span>
      </nav>

      {/* 标题区 */}
      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-yolk px-3 py-1 text-[12px] font-medium text-ink">
            {CAT_LABEL[item.category] || item.category}
          </span>
          {item.style_tags?.map((s) => (
            <span key={s} className="rounded-full border border-[#F0E3BE] px-3 py-1 text-[12px] text-muted">
              {s}
            </span>
          ))}
        </div>
        <h1 className="mt-4 font-serif text-[2rem] font-extrabold leading-tight text-ink">
          {item.title}
        </h1>
        {item.summary && (
          <p className="mt-3 max-w-2xl text-[14px] leading-[1.9] text-muted">{item.summary}</p>
        )}
        <p className="mt-4 flex items-center gap-2 text-[12px] text-muted">
          <span>{item.location || "栖屿设计"}</span>
          <span className="text-[#F0E3BE]">|</span>
          <span>浏览量 {item.view_count}</span>
          <ViewCounter slug={item.slug} />
        </p>
      </header>

      {/* 图集网格（开发期占位图；Q4 接 uploads 卷真实图） */}
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {gallery.map((g, i) => (
          <div
            key={i}
            className={`flex items-center justify-center overflow-hidden rounded-2xl bg-sand text-[13px] text-muted ${
              gallery.length % 2 === 1 && i === gallery.length - 1 ? "md:col-span-2 aspect-[16/9]" : "aspect-[4/3]"
            }`}
          >
            {g ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g} alt={`${item.title} 图 ${i + 1}`} className="h-full w-full object-cover" />
            ) : (
              <span className="font-en tracking-[0.18em]">QIYU · CASE</span>
            )}
          </div>
        ))}
      </section>

      {/* 项目信息块 */}
      <section className="mt-10 grid gap-4 rounded-2xl border border-[#F0E3BE] bg-cream p-6 sm:grid-cols-2 lg:grid-cols-5">
        <InfoCell label="建筑面积" value={item.area ? `${item.area}㎡` : "—"} />
        <InfoCell label="风格" value={item.style_tags?.[0] || "—"} />
        <InfoCell label="户型" value={item.house_type_tags?.[0] || item.area_range || "—"} />
        <InfoCell label="设计师" value={item.designer || "—"} />
        <InfoCell
          label="参考造价"
          value={
            Number(item.price_per_sqm) > 0
              ? `¥${fmtPrice(item.price_per_sqm)}/㎡${item.price_note ? ` · ${item.price_note}` : ""}`
              : "后台配置"
          }
        />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px]">
        {/* 正文 */}
        <article className="min-w-0">
          {renderContent(item.content) ?? (
            <p className="text-[14px] leading-[2.05] text-muted">案例详细内容整理中，欢迎预约咨询获取完整方案。</p>
          )}

          {item.material_notes && (
            <div className="mt-8 rounded-2xl border border-[#F0E3BE] bg-sand/60 p-6">
              <p className="font-en text-[11px] uppercase tracking-[0.18em] text-gold">Material Notes · 用材说明</p>
              <div className="mt-3 text-[13px] leading-[1.9] text-ink/85">{item.material_notes}</div>
            </div>
          )}
        </article>

        {/* 侧栏 CTA */}
        <aside className="h-fit rounded-2xl bg-[#4A3F30] p-6 lg:sticky lg:top-24">
          <p className="eyebrow text-yolk">GET A QUOTE</p>
          <h3 className="mt-3 font-serif text-[18px] font-bold text-cream">
            喜欢这个案例？
          </h3>
          <p className="mt-2 text-[13px] leading-[1.85] text-cream/70">
            告诉我们在哪、多大、想要什么风格 —— 栖屿为你定制同款温馨小家。
          </p>
          <Link
            href={`/about#contact?ref_case=${item.slug}`}
            className="btn-yolk mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-[14px] font-medium"
          >
            预约免费咨询
          </Link>
          <p className="mt-3 text-center text-[11px] text-cream/50">
            全案设计约 ¥280/㎡ 起 · 免费量房
          </p>
        </aside>
      </div>

      {/* 上下篇 */}
      <nav className="mt-12 flex gap-4" aria-label="上下篇导航">
        {item.prev ? (
          <NavItem dir="prev" title={item.prev.title} slug={item.prev.slug} category={item.prev.category} />
        ) : (
          <div className="flex-1" />
        )}
        {item.next ? (
          <NavItem dir="next" title={item.next.title} slug={item.next.slug} category={item.next.category} />
        ) : (
          <div className="flex-1" />
        )}
      </nav>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-en text-[10px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-1.5 font-serif text-[14px] font-semibold text-ink">
        {value.length > 24 ? `${value.slice(0, 24)}…` : value}
      </p>
    </div>
  );
}