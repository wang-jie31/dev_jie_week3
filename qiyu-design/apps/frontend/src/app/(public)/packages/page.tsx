/**
 * 套餐列表页（S-13）—— 对齐原型 + UIUX §7.4：
 * Hero → 类型筛选 chips（全部/单空间/全屋/风格）→ 3 卡网格（双轨价格 + 最受欢迎徽章）→ 分页条
 */
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { PackageCard } from "@/components/Cards";
import { seoMetadata } from "@/lib/seo";
import ClientPackageList from "./client";

export const revalidate = 30; // ISR 30s

export const metadata: Metadata = seoMetadata({
  title: "服务套餐",
  description: "栖屿设计套餐服务 —— 单空间定制 / 全屋整装 / 风格定制，双轨价格透明，按房型与风格打包，预算一眼看清。",
  path: "/packages",
});

export interface PackageListSearchParams {
  type?: string;
  page?: string;
}

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<PackageListSearchParams>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const pageSize = 9; // 套餐 3 列网格
  const data = await api.packages(
    { type: sp.type, page: String(page), pageSize: String(pageSize) },
    30,
  );

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-16">
      {/* 页头 Hero */}
      <section className="relative mt-6 flex min-h-[220px] flex-col justify-center overflow-hidden rounded-3xl bg-[#4A3F30] px-8 py-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4A3F30] to-[#6B5D4B]" />
        <div className="relative">
          <p className="eyebrow text-yolk">PACKAGES · 服务套餐</p>
          <h1 className="mt-3 font-serif text-[2.2rem] font-extrabold leading-tight text-cream">
            明码标价 · 安心选择
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-[1.9] text-cream/75">
            单空间定制 / 全屋整装 / 风格定制 —— 每平方米单价与整套起步价透明公开，报价无隐藏项。
          </p>
        </div>
      </section>

      <ClientPackageList data={data} page={page} pageSize={pageSize} active={{ type: sp.type }} />
    </div>
  );
}