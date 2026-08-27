/**
 * 案例列表页（S-12）—— 对齐原型 + UIUX §7.3：
 * Hero → 多维筛选 chips（分类/风格/户型/面积）+ 排序 → 图片卡网格 → 分页条
 * 筛选变化自动回第 1 页；分页条规范统一（有数据即显示/胶囊/共 N 条·第 X/Y 页）
 */
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { CaseCard } from "@/components/Cards";
import { seoMetadata } from "@/lib/seo";
import ClientCaseList from "./client";

// 风格/户型/面积选项（原型 chips 数据）
const STYLES = ["原木风", "奶油风", "工业风", "北欧风", "侘寂风"];
const HOUSE_TYPES = ["一居室", "开间", "小两居"];
const AREA_RANGES = ["<30㎡", "30-45㎡", "45-60㎡", "60-70㎡"];

export const revalidate = 30; // ISR 30s

export const metadata: Metadata = seoMetadata({
  title: "案例展示",
  description: "栖屿设计原创案例精选 —— 私宅/小户型/公寓改造实景与效果图，支持按风格/户型/面积筛选。",
  path: "/cases",
});

export interface CaseListSearchParams {
  cat?: string;
  style?: string;
  house_type?: string;
  area_range?: string;
  sort?: string;
  page?: string;
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<CaseListSearchParams>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const pageSize = 6; // 原型案例每页 6 条
  const data = await api.cases(
    {
      cat: sp.cat,
      style: sp.style,
      house_type: sp.house_type,
      area_range: sp.area_range,
      sort: sp.sort,
      page: String(page),
      pageSize: String(pageSize),
    },
    30,
  );

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-16">
      {/* 页头 Hero */}
      <section className="relative mt-6 flex min-h-[240px] flex-col justify-center overflow-hidden rounded-3xl bg-[#4A3F30] px-8 py-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4A3F30] to-[#6B5D4B]" />
        <div className="relative">
          <p className="eyebrow text-yolk">CASES · 案例展示</p>
          <h1 className="mt-3 font-serif text-[2.2rem] font-extrabold leading-tight text-cream">
            真实案例 · 温馨小家
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-[1.9] text-cream/75">
            每一套都是为独居生活量身定制 —— 私宅 / 小户型 / 公寓改造，看看我们如何把空间变成家。
          </p>
        </div>
      </section>

      {/* 筛选条 + 排序（客户端交互） */}
      <ClientCaseList
        data={data}
        page={page}
        pageSize={pageSize}
        active={{ cat: sp.cat, style: sp.style, house_type: sp.house_type, area_range: sp.area_range, sort: sp.sort }}
        options={{ styles: STYLES, houseTypes: HOUSE_TYPES, areaRanges: AREA_RANGES }}
      />
    </div>
  );
}