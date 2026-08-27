/**
 * 前台页脚（第 4 步）—— 对齐原型：品牌列 / 快速链接 / 联系 / 社媒矩阵
 * 社媒矩阵：微信·抖音·小红书·视频号 圆形按钮（SVG，禁用 emoji —— 强制项）
 */
import Link from "next/link";

const SOCIALS = [
  { name: "微信", label: "wechat" },
  { name: "抖音", label: "douyin" },
  { name: "小红书", label: "xiaohongshu" },
  { name: "视频号", label: "channels" },
];

function SocialIcon({ name }: { name: string }) {
  // 24px 圆形描边 + 名称首字（禁用 emoji，SVG/文字替代）
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F0E3BE] text-[12px] font-medium text-ink transition-colors hover:bg-sand">
      {name.slice(0, 1)}
    </span>
  );
}

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[#F0E3BE] bg-cream">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        {/* 品牌列 */}
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yolk">
              <span className="font-serif text-lg font-extrabold text-ink">栖</span>
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-[15px] font-extrabold text-ink">栖屿设计</span>
              <span className="block font-en text-[10px] tracking-[0.18em] text-muted">
                QIYU DESIGN
              </span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-[13px] leading-[1.85] text-muted">
            专注独居青年的温馨小家定制 —— 私宅 / 小户型 / 公寓空间一体化设计服务。
          </p>
        </div>

        {/* 快速链接 */}
        <div>
          <p className="font-en text-[11px] uppercase tracking-[0.18em] text-muted">Quick Links</p>
          <ul className="mt-4 space-y-2.5 text-[13px] text-ink">
            <li><Link href="/cases" className="hover:text-yolk-d">案例展示</Link></li>
            <li><Link href="/packages" className="hover:text-yolk-d">服务套餐</Link></li>
            <li><Link href="/news" className="hover:text-yolk-d">新闻资讯</Link></li>
            <li><Link href="/about" className="hover:text-yolk-d">关于我们</Link></li>
          </ul>
        </div>

        {/* 联系 */}
        <div>
          <p className="font-en text-[11px] uppercase tracking-[0.18em] text-muted">Contact</p>
          <ul className="mt-4 space-y-2.5 text-[13px] text-ink">
            <li>上海市 · 栖屿设计工作室</li>
            <li>021-XXXX-XXXX</li>
            <li>hello@qiyu.design</li>
          </ul>
        </div>

        {/* 社媒矩阵 */}
        <div>
          <p className="font-en text-[11px] uppercase tracking-[0.18em] text-muted">Social</p>
          <div className="mt-4 flex gap-2.5">
            {SOCIALS.map((s) => (
              <a
                key={s.name}
                href="#"
                aria-label={s.name}
                className="rounded-full transition-transform hover:-translate-y-0.5"
              >
                <SocialIcon name={s.name} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[#F0E3BE]">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-2 px-6 py-5 text-[12px] text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} 栖屿设计 QIYU DESIGN · 保留所有权利</p>
          <p className="font-en tracking-[0.12em]">DESIGNED WITH CARE FOR SOLO LIVING</p>
        </div>
      </div>
    </footer>
  );
}