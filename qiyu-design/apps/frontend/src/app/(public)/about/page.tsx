/**
 * 关于我们页（S-14）—— 单页长滚动，锚点对齐 Header 下拉：
 * #brand（品牌故事）→ #process（设计流程）→ #team（设计团队）→ #history（发展历程）→ #contact（联系我们）
 * 数据源：api.site()（about/brand intro + process intro + history + contact）+ api.team()
 */
import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";
import ContactForm from "./contact-form";

export const revalidate = 60;

export const metadata: Metadata = seoMetadata({
  title: "关于我们 · 品牌 / 流程 / 团队 / 发展历程",
  description: "了解栖屿设计 —— 品牌故事、4 步标准设计流程、设计团队与历年发展，联系我们开启你的小家改造。",
  path: "/about",
});

export default async function AboutPage() {
  const site = await api.site(60);
  const team = await api.team(60);

  const contact = site.contact_info ?? {};
  const socials = site.social_links ?? [];
  const history = site.history_items ?? [
    { year: "2021", title: "栖屿工作室成立", description: "从一间旧民居改造开始，服务第一批独居青年。" },
    { year: "2023", title: "标准化服务流程上线", description: "4 步标准流程 + 透明套餐，覆盖 500+ 小家方案。" },
    { year: "2025", title: "全屋整装服务扩展", description: "从设计到落地一站式交付，让更多人安心入住。" },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-16">
      {/* 页头 Hero */}
      <section className="relative mt-6 flex min-h-[220px] flex-col justify-center overflow-hidden rounded-3xl bg-[#4A3F30] px-8 py-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4A3F30] to-[#6B5D4B]" />
        <div className="relative">
          <p className="eyebrow text-yolk">ABOUT US · 关于我们</p>
          <h1 className="mt-3 font-serif text-[2.2rem] font-extrabold leading-tight text-cream">
            认识栖屿，认识一群把小家当作作品的人
          </h1>
        </div>
      </section>

      {/* #brand 品牌故事 */}
      <section id="brand" className="mt-14 scroll-mt-24">
        <SectionTitle en="BRAND" zh="品牌故事" />
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <p className="text-[14px] leading-[2.05] text-ink/85">
              {site.company_intro || site.brand_intro ||
                "栖屿设计专注「个人独居温馨小家定制」，为 22–35 岁的独居青年，把一居、开间、小两居住成刚刚好的家。"}
            </p>
            <p className="text-[14px] leading-[2.05] text-muted">
              我们相信，独居不是将就，而是另一种值得认真对待的生活方式。
              每一次设计，都是从「你的日常」出发 —— 收纳、采光、材质，让每一平米都服务于真实生活。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <BrandStat num="500+" label="服务方案" />
            <BrandStat num="100%" label="专属定制" />
            <BrandStat num="4步" label="标准流程" />
          </div>
        </div>
      </section>

      {/* #process 设计流程 */}
      <section id="process" className="mt-14 scroll-mt-24">
        <SectionTitle en="PROCESS" zh="设计流程" />
        <p className="mt-1 max-w-xl text-[13px] leading-[1.85] text-muted">
          {site.process_intro || "从需求到入住，四阶段标准化服务，让你安心做「甩手掌柜」。"}
        </p>
        <div className="mt-8 space-y-4">
          {PROCESS.map((p, i) => (
            <ProcessRow key={p.en} step={p} last={i === PROCESS.length - 1} />
          ))}
        </div>
      </section>

      {/* #team 设计团队 */}
      <section id="team" className="mt-14 scroll-mt-24">
        <SectionTitle en="TEAM" zh="设计团队" />
        {team.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-[#F0E3BE] bg-cream p-6 text-center transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sand text-[15px] font-medium text-muted">
                  {t.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.avatar} alt={t.name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="font-serif">{t.name?.slice(0, 1)}</span>
                  )}
                </div>
                <h3 className="mt-3 font-serif text-[15px] font-bold text-ink">{t.name}</h3>
                {t.title && <p className="mt-1 text-[12px] text-gold">{t.title}</p>}
                {t.specialty && <p className="mt-1 text-[12px] text-muted">{t.specialty}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-[#F0E3BE] bg-cream p-8 text-center text-[13px] text-muted">
            设计团队介绍整理中。
          </p>
        )}
      </section>

      {/* #history 发展历程 */}
      <section id="history" className="mt-14 scroll-mt-24">
        <SectionTitle en="HISTORY" zh="发展历程" />
        <div className="mt-8 space-y-0">
          {history.map((h, i) => (
            <div key={`${h.year}-${h.title}`} className="flex gap-6">
              <div className="flex flex-col items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-yolk bg-cream font-en text-[11px] font-bold text-ink">
                  {h.year.slice(2)}
                </span>
                {i !== history.length - 1 && <span className="w-px flex-1 bg-[#F0E3BE]" />}
              </div>
              <div className="pb-10">
                <p className="font-en text-[12px] font-semibold tracking-[0.12em] text-gold">{h.year}</p>
                <h3 className="mt-1 font-serif text-[15px] font-bold text-ink">{h.title}</h3>
                {h.description && (
                  <p className="mt-1.5 text-[13px] leading-[1.85] text-muted">{h.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* #contact 联系我们 */}
      <section id="contact" className="mt-14 scroll-mt-24">
        <SectionTitle en="CONTACT" zh="联系我们" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            {/* 联系方式 */}
            <div className="rounded-2xl border border-[#F0E3BE] bg-cream p-8">
              <h3 className="font-serif text-[16px] font-bold text-ink">联系方式</h3>
              <ul className="mt-4 space-y-3 text-[13px] text-ink">
                <li className="flex items-center gap-2">
                  <ContactIcon label="址" />
                  {contact.address || "广州市天河区 · 珠江新城 · 栖屿设计工作室"}
                </li>
                <li className="flex items-center gap-2">
                  <ContactIcon label="话" />
                  {contact.phone || "020-XXXX-XXXX"}
                </li>
                <li className="flex items-center gap-2">
                  <ContactIcon label="邮" />
                  {contact.email || "hello@qiyu.design"}
                </li>
                <li className="flex items-center gap-2">
                  <ContactIcon label="时" />
                  {contact.hours || "周一至周日 9:00–20:00"}
                </li>
              </ul>
              <p className="mt-5 text-[12px] leading-[1.85] text-muted">
                预约即享免费量房 —— 顾问将在 24 小时内与你确认时间。
              </p>
            </div>

            {/* 广州地图（OpenStreetMap 嵌入，无需 key；坐标：广州珠江新城 23.1291, 113.2644） */}
            <div className="overflow-hidden rounded-2xl border border-[#F0E3BE] bg-cream">
              <div className="flex items-center justify-between px-6 pt-5">
                <h3 className="font-serif text-[16px] font-bold text-ink">工作室位置 · 广州</h3>
                <a
                  href="https://uri.amap.com/marker?position=113.2644,23.1291&name=%E6%A0%96%E5%B1%BF%E8%AE%BE%E8%AE%A1%E5%B7%A5%E4%BD%9C%E5%AE%A4"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[#F0E3BE] px-3 py-1.5 text-[12px] text-ink transition-colors hover:bg-sand"
                >
                  高德导航 →
                </a>
              </div>
              <iframe
                title="栖屿设计工作室位置（广州）"
                src="https://www.openstreetmap.org/export/embed.html?bbox=113.20%2C23.08%2C113.34%2C23.18&layer=mapnik&marker=23.1291%2C113.2644"
                className="mt-4 h-[280px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <p className="px-6 py-3 text-[12px] text-muted">
                广州市天河区珠江新城 —— 地铁站步行 5 分钟，欢迎预约到访。
              </p>
            </div>
          </div>

          {/* 预约免费咨询（S-17：Client 组件，真实 POST /api/v1/messages） */}
          <div className="rounded-2xl border border-[#F0E3BE] bg-cream p-8">
            <h3 className="font-serif text-[16px] font-bold text-ink">预约免费咨询</h3>
            <ContactForm />
          </div>
        </div>

        {/* 社媒矩阵 */}
        {socials.length > 0 && (
          <div className="mt-8 flex items-center gap-3">
            <span className="text-[13px] text-muted">关注我们：</span>
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F0E3BE] text-[12px] font-medium text-ink transition-colors hover:bg-sand"
              >
                {s.name.slice(0, 1)}
              </a>
            ))}
          </div>
        )}
      </section>

      <div className="mt-12 border-t border-[#F0E3BE] pt-6 text-center">
        <Link href="/packages" className="text-[13px] text-gold underline underline-offset-4 hover:text-[#a67e14]">
          先看看套餐 →
        </Link>
      </div>
    </div>
  );
}

const PROCESS = [
  { en: "01", zh: "问卷沟通", desc: "问卷 → 沟通 → 上门量房 → 签合同" },
  { en: "02", zh: "方案设计", desc: "平面布局 → 效果图 → 预算确认" },
  { en: "03", zh: "落地施工", desc: "主材陪购 → 施工跟踪 → 节点验收" },
  { en: "04", zh: "软装交付", desc: "家具软装进场 → 整体摆场 → 拎包入住" },
];

function SectionTitle({ en, zh }: { en: string; zh: string }) {
  return (
    <div>
      <p className="font-en text-[11px] uppercase tracking-[0.18em] text-gold">{en}</p>
      <h2 className="mt-1.5 font-serif text-[1.6rem] font-bold text-ink">{zh}</h2>
    </div>
  );
}

function BrandStat({ num, label }: { num: string; label: string }) {
  return (
    <div className="rounded-2xl bg-sand p-4 text-center">
      <p className="font-en text-[1.3rem] font-bold text-ink">{num}</p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  );
}

function ProcessRow({ step, last }: { step: { en: string; zh: string; desc: string }; last: boolean }) {
  return (
    <div className="flex gap-5">
      <div className="flex flex-col items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-yolk to-yolk-d font-en text-[14px] font-bold text-ink">
          {step.en}
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-[#F0E3BE]" />}
      </div>
      <div className="pb-8">
        <h3 className="font-serif text-[15px] font-bold text-ink">{step.zh}</h3>
        <p className="mt-1 text-[13px] text-muted">{step.desc}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function ContactIcon({ label }: { label: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yolk text-[12px] font-semibold text-ink">
      {label}
    </span>
  );
}