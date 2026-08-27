"use client";

/**
 * 前台顶部导航（第 4 步）—— 对齐原型：sticky 浮条 + 下拉菜单
 * 一级项：首页 Logo / 案例展示(下拉 私宅·小户型·公寓改造) / 服务套餐 / 新闻资讯(下拉 企业·行业)
 *         / 招聘入口(下拉 社会·校园) / 关于我们(下拉 品牌·流程·团队·历程·联系)
 * 右侧：预约咨询按钮（btn-yolk）→ 联系页
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { label: "首页", href: "/", children: null },
  {
    label: "案例展示",
    href: "/cases",
    children: [
      { label: "私宅", href: "/cases?cat=private" },
      { label: "小户型", href: "/cases?cat=small" },
      { label: "公寓改造", href: "/cases?cat=apartment" },
    ],
  },
  { label: "服务套餐", href: "/packages", children: null },
  {
    label: "新闻资讯",
    href: "/news",
    children: [
      { label: "企业新闻", href: "/news?cat=company" },
      { label: "行业资讯", href: "/news?cat=industry" },
    ],
  },
  {
    label: "招聘入口",
    href: "/careers",
    children: [
      { label: "社会招聘", href: "/careers?cat=social" },
      { label: "校园招聘", href: "/careers?cat=campus" },
    ],
  },
  {
    label: "关于我们",
    href: "/about",
    children: [
      { label: "品牌故事", href: "/about#brand" },
      { label: "设计流程", href: "/about#process" },
      { label: "团队", href: "/about#team" },
      { label: "发展历程", href: "/about#history" },
      { label: "联系我们", href: "/about#contact" },
    ],
  },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.split("?")[0]);

  return (
    <header className="sticky top-0 z-50 px-4 pt-3">
      <nav className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between rounded-2xl border border-[#F0E3BE] bg-cream/90 px-6 shadow-[var(--shadow-card)] backdrop-blur-md">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(null)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yolk">
            <span className="font-serif text-lg font-extrabold text-ink">栖</span>
          </span>
          <span className="leading-tight">
            <span className="block font-serif text-[15px] font-extrabold text-ink">栖屿设计</span>
            <span className="block font-en text-[10px] tracking-[0.18em] text-muted">
              QIYU DESIGN
            </span>
          </span>
        </Link>

        {/* 桌面菜单 */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => item.children && setOpen(item.label)}
              onMouseLeave={() => item.children && setOpen(null)}
            >
              <Link
                href={item.href}
                className={`nav-link rounded-lg px-3 py-2 text-[14px] font-medium transition-colors ${
                  isActive(item.href) ? "text-[#C8951F]" : "text-ink hover:text-yolk-d"
                }`}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
                {item.children && <span className="ml-1 text-[10px] text-muted">▾</span>}
              </Link>
              {item.children && open === item.label && (
                <div className="absolute left-0 top-full pt-3">
                  <div className="w-44 overflow-hidden rounded-xl border border-[#F0E3BE] bg-cream shadow-[var(--shadow-pop)]">
                    {item.children.map((c) => (
                      <Link
                        key={c.label}
                        href={c.href}
                        onClick={() => setOpen(null)}
                        className="block px-4 py-2.5 text-[13px] text-ink transition-colors hover:bg-sand"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 右侧 CTA */}
        <div className="flex items-center gap-2">
          <Link href="/about#contact" className="btn-yolk hidden rounded-full px-5 py-2.5 text-[14px] sm:inline-flex">
            预约咨询
          </Link>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#F0E3BE] text-ink lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="打开菜单"
          >
            <span className="text-lg">☰</span>
          </button>
        </div>
      </nav>

      {/* 移动端菜单 */}
      {mobileOpen && (
        <div className="mx-auto mt-2 max-w-[1200px] rounded-2xl border border-[#F0E3BE] bg-cream p-4 shadow-[var(--shadow-pop)] lg:hidden">
          {NAV.map((item) => (
            <div key={item.label} className="border-b border-[#F0E3BE] last:border-0">
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between px-2 py-3 text-[14px] font-medium text-ink"
              >
                {item.label}
                {item.children && <span className="text-[10px] text-muted">▾</span>}
              </Link>
              {item.children && (
                <div className="pb-2 pl-4">
                  {item.children.map((c) => (
                    <Link
                      key={c.label}
                      href={c.href}
                      onClick={() => setMobileOpen(false)}
                      className="block py-2 text-[13px] text-muted hover:text-ink"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}