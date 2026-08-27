/**
 * SEO 工具集（第 8 步 S-32）
 *
 * - NEXT_PUBLIC_SITE_URL：站点绝对基址。本地联调默认 http://localhost:3000；
 *   生产由环境变量覆盖为 https://www.qiyu.example
 * - canonical 构造：拼接路径，去尾部斜杠（保留根 "/"）
 * - JSON-LD 生成：Organization（全局）/ Article（案例/套餐/新闻详情）/ BreadcrumbList（详情页面包屑）
 */
import type { Metadata } from "next";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "栖屿设计 QIYU";
export const SITE_DESC =
  "栖屿设计（QIYU）—— 专注私宅/小户型/公寓空间的室内设计事务所。原创案例、套餐服务、设计流程一站式呈现。";

/** 构造绝对 canonical URL（路径必须 / 开头；空/根返回站点基址） */
export function canonical(path: string): string {
  if (!path || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** 组织结构化数据（全站 JSON-LD，放根 layout） */
export const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "栖屿设计",
  alternateName: "QIYU Design",
  description: SITE_DESC,
  url: SITE_URL,
  areaServed: "中国",
  knowsAbout: ["室内设计", "小户型设计", "公寓改造", "全屋整装"],
};

/** 文章结构化数据（案例 / 套餐 / 新闻详情共用） */
export function articleJsonLd(params: {
  title: string;
  description?: string | null;
  url: string;
  publishedAt?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: params.title,
    description: params.description || undefined,
    url: params.url,
    mainEntityOfPage: params.url,
    ...(params.publishedAt ? { datePublished: params.publishedAt } : {}),
    author: { "@type": "Organization", name: "栖屿设计" },
    publisher: { "@type": "Organization", name: "栖屿设计", url: SITE_URL },
  };
}

/** 面包屑结构化数据（详情页） */
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/** 统一 Metadata 构造：title / description / canonical / og */
export function seoMetadata(partial: {
  title: string;
  description?: string | null;
  path: string;
  ogType?: "website" | "article";
}): Metadata {
  const url = canonical(partial.path);
  return {
    title: partial.title,
    description: partial.description || SITE_DESC,
    alternates: { canonical: url },
    openGraph: {
      title: partial.title,
      description: partial.description || SITE_DESC,
      url,
      siteName: SITE_NAME,
      type: partial.ogType || "website",
      locale: "zh_CN",
    },
  };
}