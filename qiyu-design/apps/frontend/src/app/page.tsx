/**
 * 首页（S-14）—— 对齐原型 index-v7：
 * Hero（把家住成温馨的样子）→ 4 优势卡 → 服务套餐网格 → 精选案例大卡（奇偶翻转）→
 * 最新资讯预览 → CTA（准备好把小家变成刚刚好的样子了吗？）
 * 数据源：api.home()（featured_cases / published_packages / news_preview / about_summary）
 */
import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { CaseCard, PackageCard, NewsRow } from "@/components/Cards";
import { seoMetadata } from "@/lib/seo";
import HeroCarousel from "@/components/HeroCarousel"; // 首页轮播（对齐原型 index-v7 图片格式）

export const revalidate = 60; // 首页 ISR 60s

export const metadata: Metadata = seoMetadata({
  title: "栖屿设计 QIYU · 室内设计",
  description:
    "栖屿设计（QIYU）—— 专注私宅/小户型/公寓空间的室内设计事务所。原创案例、套餐服务、设计流程一站式呈现。",
  path: "/",
});

const ADVANTAGES = [
  {
    en: "Cozy Home Design",
    zh: "温馨小宅定制",
    desc: "专注独居小家设计，用收纳、采光与材质打造舒适日常。",
  },
  {
    en: "Small Space, Big Warmth",
    zh: "小空间 · 大温暖",
    desc: "30–70㎡ 也能住出通透与松弛，让小空间变成刚刚好的家。",
  },
  {
    en: "Clear Pricing, Easy Mind",
    zh: "透明套餐 · 安心决策",
    desc: "按房间 / 户型 / 风格打包，预算一眼看清，决策不再焦虑。",
  },
  {
    en: "Tailored for Solo",
    zh: "为独居量身定制",
    desc: "聚焦一人居的空间与情感需求，把好设计带给更多人。",
  },
];

const PROCESS = [
  { en: "01", zh: "问卷沟通", desc: "问卷 → 沟通 → 上门量房 → 签合同" },
  { en: "02", zh: "方案设计", desc: "平面布局 → 效果图 → 预算确认" },
  { en: "03", zh: "落地施工", desc: "主材陪购 → 施工跟踪 → 节点验收" },
  { en: "04", zh: "软装交付", desc: "家具软装进场 → 整体摆场 → 拎包入住" },
];

export default async function HomePage() {
  const data = await api.home(60);

  // 将后端轮播配置（home_banners）映射为 HeroCarousel 的 slides；
  // 后台「首页轮播图」未配置时，HeroCarousel 内部使用原型默认三张。
  const banners = (data.home_banners ?? []).map((b) => ({
    image: b.image,
    en: b.en,
    title: b.title,
    desc: b.desc,
    link: b.link,
    linkLabel: b.link_label,
    link2: b.link2,
    link2Label: b.link2_label,
  }));

  return (
    <div>
      {/* Hero 轮播（参考原型 index-v7：全幅图 1920×80 + 箭头 + 圆点 + 自动播放；数据由后台首页轮播图管理） */}
      <HeroCarousel items={banners} />

      {/* 4 优势卡 */}
      <section className="mx-auto max-w-[1200px] px-6">
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ADVANTAGES.map((a) => (
            <div
              key={a.en}
              className="rounded-2xl border border-[#F0E3BE] bg-cream p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-yolk to-yolk-d">
                <span className="font-en text-[13px] font-bold text-ink">✦</span>
              </span>
              <p className="mt-4 font-en text-[10px] uppercase tracking-[0.18em] text-gold">{a.en}</p>
              <h3 className="mt-1.5 font-serif text-[16px] font-bold text-ink">{a.zh}</h3>
              <p className="mt-2 text-[12px] leading-[1.85] text-muted">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 服务套餐 */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16">
        <SectionHeader
          en="SERVICE PACKAGES"
          zh="服务套餐"
          desc="弱化平方米计价，按房间 / 户型 / 风格打包，预算一眼看清。"
          href="/packages"
        />
        {data.published_packages.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.published_packages.slice(0, 3).map((p) => (
              <PackageCard key={p.id} item={p} />
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-[#F0E3BE] bg-cream p-8 text-center text-[13px] text-muted">
            套餐内容整理中，欢迎预约咨询。
          </p>
        )}
      </section>

      {/* 精选案例 */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16">
        <SectionHeader
          en="FEATURED CASES"
          zh="精选案例"
          desc="为独居青年打造的一居、开间、小两居 —— 找到和你同频的那一套。"
          href="/cases"
        />
        {data.featured_cases.length > 0 ? (
          <div className="mt-8 space-y-6">
            {data.featured_cases.slice(0, 3).map((c, i) => (
              <FeaturedCase key={c.id} item={c} flip={i % 2 === 1} />
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-[#F0E3BE] bg-cream p-8 text-center text-[13px] text-muted">
            案例整理中，敬请期待。
          </p>
        )}
      </section>

      {/* 最新资讯 */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16">
        <SectionHeader
          en="LATEST NEWS"
          zh="最新资讯"
          desc="栖屿动态与行业观察，陪你一起把小家越住越好。"
          href="/news"
        />
        {data.news_preview.length > 0 ? (
          <div className="mt-8 space-y-4">
            {data.news_preview.slice(0, 3).map((n) => (
              <NewsRow key={n.id} item={n} />
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-[#F0E3BE] bg-cream p-8 text-center text-[13px] text-muted">
            资讯发布中，敬请关注。
          </p>
        )}
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16">
        <div className="flex flex-col items-center gap-5 rounded-3xl bg-[#4A3F30] px-8 py-14 text-center">
          <p className="eyebrow text-yolk">READY TO MOVE IN</p>
          <h2 className="max-w-lg font-serif text-[1.6rem] font-bold leading-snug text-cream">
            准备好把小家，变成刚刚好的样子了吗？
          </h2>
          <p className="max-w-md text-[13px] leading-[1.9] text-cream/70">
            留下你的需求，顾问 24 小时内联系你 —— 免费量房，报价无隐藏项。
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href="/about#contact" className="btn-yolk rounded-full px-6 py-3 text-[14px] font-semibold">
              预约免费咨询
            </Link>
            <Link
              href="/packages"
              className="rounded-full border border-cream/40 px-6 py-3 text-[14px] font-medium text-cream transition-colors hover:bg-cream/10"
            >
              查看套餐
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-8 text-center">
            <Stat num="500+" label="服务方案" />
            <Stat num="100%" label="专属定制" />
            <Stat num="4步" label="标准流程" />
          </div>
        </div>
      </section>

      {/* 品牌摘要（来自 site_config.about_summary） */}
      {data.about_summary && (
        <section className="mx-auto max-w-[1200px] px-6 pt-12">
          <p className="mx-auto max-w-2xl text-center text-[13px] leading-[1.95] text-muted">
            {data.about_summary}
          </p>
        </section>
      )}
    </div>
  );
}

function SectionHeader({
  en,
  zh,
  desc,
  href,
}: {
  en: string;
  zh: string;
  desc: string;
  href: string;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="font-en text-[11px] uppercase tracking-[0.18em] text-gold">{en}</p>
        <h2 className="mt-2 font-serif text-[1.75rem] font-bold text-ink">{zh}</h2>
        <p className="mt-2 max-w-xl text-[13px] leading-[1.85] text-muted">{desc}</p>
      </div>
      <Link href={href} className="shrink-0 rounded-full border border-[#F0E3BE] px-4 py-2 text-[13px] text-ink transition-colors hover:bg-sand">
        查看全部 →
      </Link>
    </div>
  );
}

function FeaturedCase({
  item,
  flip,
}: {
  item: {
    slug: string;
    title: string;
    category: string;
    summary?: string | null;
    style_tags?: string[];
    area?: number | null;
    location?: string | null;
    price_per_sqm: number;
    price_note?: string | null;
  };
  flip: boolean;
}) {
  const CAT_LABEL: Record<string, string> = { private: "私宅", small: "小户型", apartment: "公寓改造" };
  return (
    <Link
      href={`/cases/${item.slug}`}
      className={`group grid items-stretch gap-0 overflow-hidden rounded-3xl border border-[#F0E3BE] bg-cream transition-all hover:shadow-[var(--shadow-soft)] lg:grid-cols-2 ${
        flip ? "lg:[direction:rtl]" : ""
      }`}
    >
      {/* 封面 */}
      <div className="flex aspect-[4/3] items-center justify-center bg-sand text-[13px] text-muted lg:aspect-auto">
        <span className="font-en tracking-[0.18em]">QIYU · CASE</span>
      </div>
      {/* 内容 */}
      <div className="flex flex-col justify-center p-8 lg:p-12 lg:[direction:ltr]">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-yolk px-3 py-1 text-[11px] font-medium text-ink">
            {CAT_LABEL[item.category] || item.category}
          </span>
          {item.style_tags?.[0] && (
            <span className="rounded-full border border-[#F0E3BE] px-3 py-1 text-[11px] text-muted">
              {item.style_tags[0]}
            </span>
          )}
        </div>
        <h3 className="mt-4 font-serif text-[1.5rem] font-bold leading-snug text-ink group-hover:text-yolk-d">
          {item.title}
        </h3>
        <p className="mt-3 text-[13px] leading-[1.9] text-muted">
          {item.summary || "从量房到软装，把空间变成刚刚好的家。"}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          {item.area && <span>{item.area}㎡</span>}
          {item.location && <span>{item.location}</span>}
          {Number(item.price_per_sqm) > 0 && <span>¥{item.price_per_sqm}/㎡ 起</span>}
        </div>
        <span className="btn-yolk mt-6 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold">
          查看详情
        </span>
      </div>
    </Link>
  );
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-en text-[1.4rem] font-bold text-yolk">{num}</p>
      <p className="mt-1 text-[12px] text-cream/70">{label}</p>
    </div>
  );
}