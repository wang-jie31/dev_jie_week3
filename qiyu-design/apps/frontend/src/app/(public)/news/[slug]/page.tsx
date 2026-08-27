/**
 * 新闻详情页（S-14）—— SSG + ISR 60s
 * 布局：面包屑 → 标题区（分类标签 · 标题 · 发布时间）→ 封面 → 正文 → 返回列表
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { api, listNewsSlugs } from "@/lib/api";
import { articleJsonLd, breadcrumbJsonLd, canonical, seoMetadata } from "@/lib/seo";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await listNewsSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const item = await api.newsDetail(slug, 3600);
    return seoMetadata({
      title: item.title,
      description: item.summary || `${item.title} · ${
        item.category === "company" ? "企业新闻" : "行业资讯"
      }`,
      path: `/news/${slug}`,
      ogType: "article",
    });
  } catch {
    return seoMetadata({ title: "新闻详情", path: `/news/${slug}` });
  }
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let item;
  try {
    item = await api.newsDetail(slug, 60);
  } catch {
    notFound();
  }
  if (!item) notFound();

  const isCompany = item.category === "company";
  const paras = (item.content || "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pageUrl = canonical(`/news/${slug}`);
  const jsonLdBlocks = [
    breadcrumbJsonLd([
      { name: "首页", url: canonical("/") },
      { name: "新闻资讯", url: canonical("/news") },
      { name: item.title, url: pageUrl },
    ]),
    articleJsonLd({
      title: item.title,
      description: item.summary,
      url: pageUrl,
      publishedAt: item.published_at ?? null,
    }),
  ];

  return (
    <div className="mx-auto max-w-[860px] px-6 pb-16">
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
        <Link href="/news" className="hover:text-ink">新闻资讯</Link>
        <span>/</span>
        <span className="truncate text-ink">{item.title}</span>
      </nav>

      {/* 标题区 */}
      <header className="mt-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="rounded-full bg-yolk px-3 py-1 text-[11px] font-medium text-ink">
            {isCompany ? "企业新闻" : "行业资讯"}
          </span>
          {item.published_at && (
            <span className="text-[12px] text-muted">
              {new Date(item.published_at).toLocaleDateString("zh-CN")}
            </span>
          )}
        </div>
        <h1 className="mt-4 font-serif text-[1.8rem] font-extrabold leading-snug text-ink">
          {item.title}
        </h1>
        {item.summary && (
          <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-[1.9] text-muted">
            {item.summary}
          </p>
        )}
      </header>

      {/* 封面（开发期占位） */}
      <div className="mt-8 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl bg-sand text-[13px] text-muted">
        {item.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <span className="font-en tracking-[0.18em]">QIYU · NEWS</span>
        )}
      </div>

      {/* 正文 */}
      <article className="mt-8 space-y-4">
        {paras.length > 0 ? (
          paras.map((p, i) => (
            <p key={i} className="text-[14px] leading-[2.05] text-ink/85">
              {p}
            </p>
          ))
        ) : (
          <p className="text-[14px] leading-[2.05] text-muted">
            内容整理中，敬请期待。
          </p>
        )}
      </article>

      {/* 返回 */}
      <div className="mt-10 border-t border-[#F0E3BE] pt-6 text-center">
        <Link href="/news" className="text-[13px] text-gold underline underline-offset-4 hover:text-[#a67e14]">
          ← 返回资讯列表
        </Link>
      </div>
    </div>
  );
}