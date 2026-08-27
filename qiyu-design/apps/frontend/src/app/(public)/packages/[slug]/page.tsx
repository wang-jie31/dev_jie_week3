/**
 * 套餐详情页（S-13）—— SSG + ISR 60s
 * 布局：面包屑 → 标题区（类型徽章 · 名称 · 双轨价格）→ 封面 → 特性（适用户型/面积系数）→
 *       定价说明 → 流程步骤（编号卡）→ 预约 CTA（预填套餐）→ 返回列表
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { api, listPackageSlugs } from "@/lib/api";
import { fmtPrice } from "@/components/Cards";
import { articleJsonLd, breadcrumbJsonLd, canonical, seoMetadata } from "@/lib/seo";

export const revalidate = 60;
export const dynamicParams = true;

const TYPE_LABEL: Record<string, string> = {
  single_space: "单空间定制",
  whole_house: "全屋整装",
  style: "风格定制",
};

export async function generateStaticParams() {
  const slugs = await listPackageSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const item = await api.packageDetail(slug, 3600);
    return seoMetadata({
      title: item.name,
      description: item.summary || `${item.name} · ${TYPE_LABEL[item.type] || item.type}套餐`,
      path: `/packages/${slug}`,
      ogType: "article",
    });
  } catch {
    return seoMetadata({ title: "套餐详情", path: `/packages/${slug}` });
  }
}

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let item;
  try {
    item = await api.packageDetail(slug, 60);
  } catch {
    notFound();
  }
  if (!item) notFound();

  const steps = item.process_steps ?? [];

  // S-32：JSON-LD（面包屑 + Article）注入
  const pageUrl = canonical(`/packages/${slug}`);
  const jsonLdBlocks = [
    breadcrumbJsonLd([
      { name: "首页", url: canonical("/") },
      { name: "服务套餐", url: canonical("/packages") },
      { name: item.name, url: pageUrl },
    ]),
    articleJsonLd({
      title: item.name,
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
        <Link href="/packages" className="hover:text-ink">服务套餐</Link>
        <span>/</span>
        <span className="truncate text-ink">{item.name}</span>
      </nav>

      {/* 头部：徽章 + 名称 + 双轨价格 */}
      <header className="mt-6 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-yolk px-3 py-1 text-[12px] font-medium text-ink">
              {TYPE_LABEL[item.type] || item.type}
            </span>
            {item.type === "whole_house" && (
              <span className="rounded-full border border-[#F0E3BE] px-3 py-1 text-[12px] text-gold">
                最受欢迎
              </span>
            )}
            {item.applicable_house_type && (
              <span className="rounded-full border border-[#F0E3BE] px-3 py-1 text-[12px] text-muted">
                {item.applicable_house_type}
              </span>
            )}
          </div>
          <h1 className="mt-4 font-serif text-[2rem] font-extrabold leading-tight text-ink">
            {item.name}
          </h1>
          {item.summary && (
            <p className="mt-3 max-w-2xl text-[14px] leading-[1.9] text-muted">{item.summary}</p>
          )}
        </div>

        {/* 定价卡 */}
        <div className="w-full shrink-0 rounded-2xl border border-[#F0E3BE] bg-cream p-6 md:w-[320px]">
          <p className="font-en text-[11px] uppercase tracking-[0.18em] text-muted">Pricing · 定价</p>
          <div className="mt-3 flex items-baseline gap-2">
            {Number(item.price_per_sqm) > 0 ? (
              <>
                <span className="font-serif text-[2rem] font-extrabold text-ink">
                  ¥{fmtPrice(item.price_per_sqm)}
                </span>
                <span className="text-[13px] text-muted">/㎡ 起</span>
              </>
            ) : (
              <span className="text-[14px] text-muted">价格后台配置</span>
            )}
          </div>
          {Number(item.price_from) > 0 && (
            <p className="mt-2 text-[13px] text-muted">整套约 ¥{fmtPrice(item.price_from)} 起</p>
          )}
          {item.price_note && (
            <p className="mt-3 border-t border-[#F0E3BE] pt-3 text-[12px] leading-[1.8] text-gold">
              {item.price_note}
            </p>
          )}
          {Number(item.area_step_coefficient) > 0 && (
            <p className="mt-2 text-[12px] text-muted">
              面积计价系数 ×{fmtPrice(item.area_step_coefficient)}
            </p>
          )}
          <Link
            href="/about#contact"
            className="btn-yolk mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-[14px] font-medium"
          >
            预约这款套餐
          </Link>
        </div>
      </header>

      {/* 封面（开发期占位） */}
      <div className="mt-8 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl bg-sand text-[13px] text-muted">
        {item.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <span className="font-en tracking-[0.18em]">QIYU · PACKAGE</span>
        )}
      </div>

      {/* 详细介绍 */}
      {item.description && (
        <section className="mt-10">
          <SectionTitle en="INTRODUCTION" zh="套餐介绍" />
          <div className="space-y-4">
            {item.description
              .split(/\n+/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p, i) => (
                <p key={i} className="text-[14px] leading-[2.05] text-ink/85">{p}</p>
              ))}
          </div>
        </section>
      )}

      {/* 流程步骤 */}
      <section className="mt-12">
        <SectionTitle en="PROCESS" zh="服务流程" />
        {steps.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-[#F0E3BE] bg-cream p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yolk to-yolk-d">
                  <span className="font-en text-[15px] font-bold text-ink">
                    {String(s.step_no).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 font-serif text-[15px] font-bold text-ink">{s.title}</h3>
                {s.description && (
                  <p className="mt-2 text-[12px] leading-[1.85] text-muted">{s.description}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-[#F0E3BE] bg-cream p-6 text-[13px] text-muted">
            流程步骤整理中，欢迎预约咨询获取详细服务流程。
          </p>
        )}
      </section>

      {/* 底部 CTA + 返回 */}
      <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl bg-[#4A3F30] px-8 py-10 text-center">
        <p className="eyebrow text-yolk">START YOUR PROJECT</p>
        <h2 className="max-w-md font-serif text-[1.4rem] font-bold text-cream">
          不确定选哪款？预约顾问免费帮你匹配
        </h2>
        <Link
          href={`/about#contact?package=${item.slug}`}
          className="btn-yolk rounded-full px-6 py-2.5 text-[14px] font-medium"
        >
          预约咨询
        </Link>
      </div>

      <div className="mt-8 text-center">
        <Link href="/packages" className="text-[13px] text-gold underline underline-offset-4 hover:text-[#a67e14]">
          ← 返回全部套餐
        </Link>
      </div>
    </div>
  );
}

function SectionTitle({ en, zh }: { en: string; zh: string }) {
  return (
    <div className="mb-5">
      <p className="font-en text-[11px] uppercase tracking-[0.18em] text-gold">{en}</p>
      <h2 className="mt-1 font-serif text-[1.5rem] font-bold text-ink">{zh}</h2>
    </div>
  );
}