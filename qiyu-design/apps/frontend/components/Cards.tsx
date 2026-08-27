/**
 * 前台内容卡片（第 4 步）
 * - CaseCard：案例图片卡（封面 + 分类 tag + 标题 + facts：㎡·风格·¥/㎡）
 * - PackageCard：套餐卡（类型徽章 + 标题 + summary + 双轨价格）
 * - NewsRow：新闻横向信息卡（左图右文 + 标签 + 日期）
 * 全部使用 SVG/文字而非 emoji（强制项）。
 */
import Link from "next/link";
import type { CaseListItem, PackageListItem, NewsItem } from "@/lib/api";

const CAT_LABEL: Record<string, string> = {
  private: "私宅",
  small: "小户型",
  apartment: "公寓改造",
};

const TYPE_LABEL: Record<string, string> = {
  single_space: "单空间定制",
  whole_house: "全屋整装",
  style: "风格定制",
};

/** 金额格式化：整数不带小数，其余两位 */
export function fmtPrice(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function CaseCard({ item }: { item: CaseListItem }) {
  return (
    <Link
      href={`/cases/${item.slug}`}
      className="group block overflow-hidden rounded-2xl border border-[#F0E3BE] bg-cream transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
    >
      {/* 封面 4/3 */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {/* 开发期占位图（Q4：本地 uploads 卷 + 占位图，不用 CDN） */}
        <div className="flex h-full w-full items-center justify-center bg-sand text-[13px] text-muted">
          <span className="font-en tracking-[0.18em]">QIYU · CASE</span>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-yolk px-3 py-1 text-[11px] font-medium text-ink">
          {CAT_LABEL[item.category] || item.category}
        </span>
      </div>

      {/* 信息 */}
      <div className="p-5">
        <h3 className="font-serif text-[17px] font-bold text-ink group-hover:text-yolk-d">
          {item.title}
        </h3>
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
          {item.area && <span>{item.area}㎡</span>}
          {item.style_tags?.[0] && <span>{item.style_tags[0]}</span>}
          {Number(item.price_per_sqm) > 0 && (
            <span>¥{fmtPrice(item.price_per_sqm)}/㎡</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function PackageCard({ item }: { item: PackageListItem }) {
  return (
    <Link
      href={`/packages/${item.slug}`}
      className="group block overflow-hidden rounded-2xl border border-[#F0E3BE] bg-cream transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <div className="flex h-full w-full items-center justify-center bg-sand text-[13px] text-muted">
          <span className="font-en tracking-[0.18em]">QIYU · PACKAGE</span>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-yolk px-3 py-1 text-[11px] font-medium text-ink">
          {TYPE_LABEL[item.type] || item.type}
        </span>
        {/* 最受欢迎徽章（原型：中间卡带 badge）—— type 为 whole_house 时展示 */}
        {item.type === "whole_house" && (
          <span className="absolute right-3 top-3 rounded-full bg-yolk px-3 py-1 text-[11px] font-semibold text-ink">
            最受欢迎
          </span>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-serif text-[17px] font-bold text-ink group-hover:text-yolk-d">
          {item.name}
        </h3>
        {item.summary && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-[1.7] text-muted">
            {item.summary}
          </p>
        )}
        {/* 双轨价格：单价 + 起价（有则显示，无则「后台配置」） */}
        <div className="mt-3 flex items-baseline gap-2">
          {Number(item.price_per_sqm) > 0 ? (
            <>
              <span className="font-serif text-[15px] font-bold text-ink">
                ¥{fmtPrice(item.price_per_sqm)}/㎡
              </span>
              <span className="text-[12px] text-muted">起</span>
              {Number(item.price_from) > 0 && (
                <span className="text-[12px] text-muted">
                  最低 {fmtPrice(item.price_from)} 元/套
                </span>
              )}
            </>
          ) : (
            <span className="text-[12px] text-muted">价格后台配置</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function NewsRow({ item }: { item: NewsItem }) {
  return (
    <Link
      href={`/news/${item.slug}`}
      className="group grid grid-cols-[200px_1fr] gap-5 rounded-2xl border border-[#F0E3BE] bg-cream p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-sand text-[11px] text-muted">
        <span className="font-en tracking-[0.18em]">QIYU · NEWS</span>
      </div>
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gold">
            {item.category === "company" ? "企业新闻" : "行业资讯"}
          </span>
          {item.published_at && (
            <span className="text-[11px] text-muted">
              {new Date(item.published_at).toLocaleDateString("zh-CN")}
            </span>
          )}
        </div>
        <h3 className="mt-1.5 font-serif text-[15px] font-bold text-ink group-hover:text-yolk-d">
          {item.title}
        </h3>
        {item.summary && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-[1.7] text-muted">
            {item.summary}
          </p>
        )}
      </div>
    </Link>
  );
}