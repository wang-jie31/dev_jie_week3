"use client";

/**
 * 新闻列表客户端（S-14）：分类 chips + 横向列表 + 分页条
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { NewsRow } from "@/components/Cards";
import Pager from "@/components/Pager";
import type { Paginated, NewsItem } from "@/lib/api";

interface Props {
  data: Paginated<NewsItem>;
  page: number;
  pageSize: number;
  active: { cat?: string };
}

const CATS = [
  { value: "company", label: "企业新闻" },
  { value: "industry", label: "行业资讯" },
];

export default function ClientNewsList({ data, page, pageSize, active }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
      if (key !== "page") params.delete("page");
      router.push(`/news?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="mt-10">
      {/* 分类 chips */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#F0E3BE] bg-cream p-6">
        <button
          onClick={() => setParam("cat", undefined)}
          className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
            !active.cat
              ? "bg-gradient-to-br from-yolk to-yolk-d font-medium text-ink"
              : "border border-[#F0E3BE] text-ink hover:bg-sand"
          }`}
        >
          全部
        </button>
        {CATS.map((c) => (
          <button
            key={c.value}
            onClick={() => setParam("cat", active.cat === c.value ? undefined : c.value)}
            className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
              active.cat === c.value
                ? "bg-gradient-to-br from-yolk to-yolk-d font-medium text-ink"
                : "border border-[#F0E3BE] text-ink hover:bg-sand"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {data.items.length > 0 ? (
        <div className="mt-8 space-y-4">
          {data.items.map((n) => (
            <NewsRow key={n.id} item={n} />
          ))}
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-[#F0E3BE] bg-cream py-16 text-center">
          <span className="text-[14px] text-muted">该分类下暂无资讯</span>
          <button
            onClick={() => router.push("/news")}
            className="rounded-full border border-[#F0E3BE] px-4 py-2 text-[13px] text-ink hover:bg-sand"
          >
            查看全部资讯
          </button>
        </div>
      )}

      <Pager total={data.total} page={page} pageSize={pageSize} onChange={(p) => setParam("page", String(p))} />
    </div>
  );
}