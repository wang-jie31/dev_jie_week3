"use client";

/**
 * 招聘列表客户端（S-14）：分类 chips（社会/校园）切换调用接口回源
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { CareerItem } from "@/lib/api";

interface Props {
  items: CareerItem[];
  active: { cat?: string };
}

const CATS = [
  { value: "social", label: "社会招聘" },
  { value: "campus", label: "校园招聘" },
];

export default function ClientCareers({ items, active }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === undefined || value === "") params.delete("cat");
      else params.set("cat", value);
      router.push(`/careers?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="mt-10">
      {/* 分类 chips */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#F0E3BE] bg-cream p-6">
        <button
          onClick={() => setParam(undefined)}
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
            onClick={() => setParam(active.cat === c.value ? undefined : c.value)}
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

      {/* 职位列表 */}
      {items.length > 0 ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {items.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl border border-[#F0E3BE] bg-cream p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-gradient-to-br from-yolk to-yolk-d px-3 py-1 text-[11px] font-medium text-ink">
                  {job.category === "social" ? "社会招聘" : "校园招聘"}
                </span>
                {job.type && <span className="text-[11px] text-muted">{job.type}</span>}
              </div>
              <h3 className="mt-3 font-serif text-[16px] font-bold text-ink">{job.title}</h3>
              <p className="mt-1.5 text-[12px] text-muted">
                {job.location || "上海"} · 全职
              </p>
              {job.duties && (
                <p className="mt-3 line-clamp-3 text-[12px] leading-[1.85] text-muted">
                  {job.duties}
                </p>
              )}
              <a
                href="mailto:career@qiyu.design"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#F0E3BE] px-4 py-2 text-[12px] text-ink transition-colors hover:bg-sand"
              >
                投递简历
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-[#F0E3BE] bg-cream py-16 text-center">
          <span className="text-[14px] text-muted">该分类下暂无在招职位</span>
          <button
            onClick={() => router.push("/careers")}
            className="rounded-full border border-[#F0E3BE] px-4 py-2 text-[13px] text-ink hover:bg-sand"
          >
            查看全部职位
          </button>
        </div>
      )}

      {/* 投递提示 */}
      <div className="mt-10 rounded-2xl border border-[#F0E3BE] bg-cream p-6">
        <p className="font-en text-[11px] uppercase tracking-[0.18em] text-gold">HOW TO APPLY</p>
        <p className="mt-2 text-[13px] leading-[1.9] text-muted">
          将简历与作品集发送至 <span className="text-ink">career@qiyu.design</span>，
          邮件标题注明「应聘岗位 + 姓名」。我们通常会在 3 个工作日内回复。
        </p>
      </div>
    </div>
  );
}