/**
 * sitemap.xml（第 8 步 S-32）
 *
 * 覆盖：静态公开页（/, /cases, /packages, /news, /about, /careers）
 *     + 已发布内容详情（cases/packages/news 按 slug）
 * 数据源：前台公开 API（listCaseSlugs / listPackageSlugs / listNewsSlugs）
 */
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { listCaseSlugs, listPackageSlugs, listNewsSlugs } from "@/lib/api";

const STATIC_ROUTES: { path: string; priority: number; changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/cases", priority: 0.9, changeFrequency: "weekly" },
  { path: "/packages", priority: 0.9, changeFrequency: "weekly" },
  { path: "/news", priority: 0.8, changeFrequency: "weekly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/careers", priority: 0.5, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [caseSlugs, packageSlugs, newsSlugs] = await Promise.all([
    listCaseSlugs(),
    listPackageSlugs(),
    listNewsSlugs(),
  ]);

  return [
    ...STATIC_ROUTES.map((r) => ({
      url: `${SITE_URL}${r.path === "/" ? "" : r.path}`,
      lastModified: new Date(),
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    ...caseSlugs.map((slug) => ({
      url: `${SITE_URL}/cases/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...packageSlugs.map((slug) => ({
      url: `${SITE_URL}/packages/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...newsSlugs.map((slug) => ({
      url: `${SITE_URL}/news/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}