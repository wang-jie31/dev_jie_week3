import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE_NAME, SITE_URL, orgJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "栖屿设计 QIYU · 室内设计",
    template: "%s · 栖屿设计",
  },
  description:
    "栖屿设计（QIYU）—— 专注私宅/小户型/公寓空间的室内设计事务所。原创案例、套餐服务、设计流程一站式呈现。",
  alternates: { canonical: "/" },
  openGraph: {
    title: "栖屿设计 QIYU · 室内设计",
    description:
      "栖屿设计（QIYU）—— 专注私宅/小户型/公寓空间的室内设计事务所。原创案例、套餐服务、设计流程一站式呈现。",
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "zh_CN",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-cream text-ink antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </body>
    </html>
  );
}