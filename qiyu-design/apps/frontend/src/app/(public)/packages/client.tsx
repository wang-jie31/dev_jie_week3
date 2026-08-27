"use client";

/**
 * 套餐列表客户端（S-13）：类型筛选 chips + 3 卡网格 + 分页条
 * 筛选变化自动回第 1 页；router.push 保持服务端渲染（SEO）
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { PackageCard } from "@/components/Cards";
import Pager from "@/components/Pager";
import type { Paginated, PackageListItem } from "@/lib/api";

interface Props {
  data: Paginated<PackageListItem>;
  page: number;
  pageSize: number;
  active: { type?: string };
}

const TYPES = [
  { value: "single_space", label: "单空间定制" },
  { value: "whole_house", label: "全屋整装" },
  { value: "style", label: "风格定制" },
];

export default function ClientPackageList({ data, page, pageSize, active }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
      if (key !== "page") params.delete("page"); // 筛选变化自动回第 1 页
      router.push(`/packages?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="mt-10">
      {/* 类型筛选条 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#F0E3BE] bg-cream p-6">
        <button
          onClick={() => setParam("type", undefined)}
          className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
            !active.type
              ? "bg-gradient-to-br from-yolk to-yolk-d font-medium text-ink"
              : "border border-[#F0E3BE] text-ink hover:bg-sand"
          }`}
        >
          全部
        </button>
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setParam("type", active.type === t.value ? undefined : t.value)}
            className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
              active.type === t.value
                ? "bg-gradient-to-br from-yolk to-yolk-d font-medium text-ink"
                : "border border-[#F0E3BE] text-ink hover:bg-sand"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 结果网格 */}
      {data.items.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((p) => (
            <PackageCard key={p.id} item={p} />
          ))}
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-[#F0E3BE] bg-cream py-16 text-center">
          <span className="text-[14px] text-muted">该分类下暂无套餐</span>
          <button
            onClick={() => router.push("/packages")}
            className="rounded-full border border-[#F0E3BE] px-4 py-2 text-[13px] text-ink hover:bg-sand"
          >
            查看全部套餐
          </button>
        </div>
      )}

      {/* 分页条 */}
      <Pager total={data.total} page={page} pageSize={pageSize} onChange={(p) => setParam("page", String(p))} />
    </div>
  );
}