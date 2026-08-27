/**
 * robots.txt（第 8 步 S-32）
 *
 * - 允许公网爬虫抓取全部前台公开内容
 * - 禁止 /admin（后台管理域，内网/VPN 可达，公网爬虫不应索引）
 * - sitemap 指向 /sitemap.xml
 */
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}