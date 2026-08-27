"use client";

/**
 * 案例列表客户端组件（S-12）：筛选 chips 交互 + 排序 + 分页条
 * 筛选变化自动回第 1 页（翻页/搜索通过 router.push 实现，服务端渲染保持 SEO）
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CaseCard } from "@/components/Cards";
import Pager from "@/components/Pager";
import type { Paginated, CaseListItem } from "@/lib/api";

interface Props {
  data: Paginated<CaseListItem>;
  page: number;
  pageSize: number;
  active: {
    cat?: string;
    style?: string;
    house_type?: string;
    area_range?: string;
    sort?: string;
  };
  options: {
    styles: string[];
    houseTypes: string[];
    areaRanges: string[];
  };
}

export default function ClientCaseList({ data, page, pageSize, active, options }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      // 筛选变化自动回第 1 页
      const params = new URLSearchParams(searchParams.toString());
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
      if (key !== "page") params.delete("page");
      router.push(`/cases?${params.toString()}`);
    },
    [router, searchParams],
  );

  const catOptions = [
    { value: "private", label: "私宅" },
    { value: "small", label: "小户型" },
    { value: "apartment", label: "公寓改造" },
  ];

  return (
    <div className="mt-10">
      {/* 筛选条 */}
      <div className="space-y-4 rounded-2xl border border-[#F0E3BE] bg-cream p-6">
        {/* 分类 */}
        <FilterGroup label="分类">
          <FilterChip active={!active.cat} onClick={() => setParam("cat", undefined)} label="全部" />
          {catOptions.map((c) => (
            <FilterChip
              key={c.value}
              active={active.cat === c.value}
              onClick={() => setParam("cat", active.cat === c.value ? undefined : c.value)}
              label={c.label}
            />
          ))}
        </FilterGroup>

        {/* 风格 */}
        <FilterGroup label="风格">
          <FilterChip active={!active.style} onClick={() => setParam("style", undefined)} label="全部" />
          {options.styles.map((s) => (
            <FilterChip
              key={s}
              active={active.style === s}
              onClick={() => setParam("style", active.style === s ? undefined : s)}
              label={s}
            />
          ))}
        </FilterGroup>

        {/* 户型 */}
        <FilterGroup label="户型">
          <FilterChip active={!active.house_type} onClick={() => setParam("house_type", undefined)} label="全部" />
          {options.houseTypes.map((h) => (
            <FilterChip
              key={h}
              active={active.house_type === h}
              onClick={() => setParam("house_type", active.house_type === h ? undefined : h)}
              label={h}
            />
          ))}
        </FilterGroup>

        {/* 面积 */}
        <FilterGroup label="面积">
          <FilterChip active={!active.area_range} onClick={() => setParam("area_range", undefined)} label="全部" />
          {options.areaRanges.map((a) => (
            <FilterChip
              key={a}
              active={active.area_range === a}
              onClick={() => setParam("area_range", active.area_range === a ? undefined : a)}
              label={a}
            />
          ))}
        </FilterGroup>

        {/* 排序 */}
        <div className="flex items-center justify-between border-t border-[#F0E3BE] pt-4">
          <span className="w-16 shrink-0 text-[13px] font-medium text-ink">排序</span>
          <div className="flex gap-2">
            <SortChip active={!active.sort || active.sort === "latest"} onClick={() => setParam("sort", "latest")} label="最新发布" />
            <SortChip active={active.sort === "hottest"} onClick={() => setParam("sort", "hottest")} label="最热浏览" />
          </div>
        </div>
      </div>

      {/* 结果网格 */}
      {data.items.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((c) => (
            <CaseCard key={c.id} item={c} />
          ))}
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-[#F0E3BE] bg-cream py-16 text-center">
          <span className="text-[14px] text-muted">没有找到匹配的案例</span>
          <button
            onClick={() => router.push("/cases")}
            className="rounded-full border border-[#F0E3BE] px-4 py-2 text-[13px] text-ink hover:bg-sand"
          >
            清除筛选
          </button>
        </div>
      )}

      {/* 分页条（共用规范） */}
      <Pager total={data.total} page={page} pageSize={pageSize} onChange={(p) => setParam("page", String(p))} />
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-16 shrink-0 pt-2 text-[13px] font-medium text-ink">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
        active
          ? "bg-gradient-to-br from-yolk to-yolk-d font-medium text-ink"
          : "border border-[#F0E3BE] text-ink hover:bg-sand"
      }`}
    >
      {label}
    </button>
  );
}

function SortChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
        active
          ? "bg-gradient-to-br from-yolk to-yolk-d font-medium text-ink"
          : "border border-[#F0E3BE] text-ink hover:bg-sand"
      }`}
    >
      {label}
    </button>
  );
}