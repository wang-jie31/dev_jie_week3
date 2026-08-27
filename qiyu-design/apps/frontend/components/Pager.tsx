"use client";

/**
 * 统一分页条（前台 + 后台共用同一实现思路，第 4 步前台版）
 *
 * 规范（UIUX §6.7 / §7.7 + 方案 §7.4）：
 * - 有数据即显示（1 页也显示）
 * - 每页默认 10 条
 * - 圆角胶囊；当前页嫩黄渐变底 + 墨色文字；页码浅米描边 hover 米色底
 * - 上一页/下一页边界禁用态（浅米）
 * - 右下角「共 N 条 · 第 X/Y 页」
 * - 翻页 scrollTo 平滑回顶；筛选变化自动回第 1 页（调用方重置 page=1）
 */
import { useCallback } from "react";

interface PagerProps {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
}

/** 页码窗口：总页码少时全展开；多时首尾 + 中部窗口 */
function pageWindow(current: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < totalPages - 2) pages.push("...");
  pages.push(totalPages);
  return pages;
}

export default function Pager({ total, page, pageSize, onChange }: PagerProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const go = useCallback(
    (p: number) => {
      if (p < 1 || p > totalPages || p === page) return;
      onChange(p);
      // 翻页平滑回顶
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onChange, page, totalPages],
  );

  // 有数据即显示（1 页也显示）
  if (total <= 0) return null;

  return (
    <div className="mt-12 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* 上一页 */}
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="rounded-full border border-[#F0E3BE] px-4 py-2 text-[13px] text-ink transition-colors hover:bg-sand disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
        >
          上一页
        </button>

        {/* 页码胶囊 */}
        {pageWindow(page, totalPages).map((p, idx) =>
          p === "..." ? (
            <span key={`e-${idx}`} className="px-1.5 text-[13px] text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              aria-current={p === page ? "page" : undefined}
              className={`h-9 min-w-9 rounded-full px-2 text-[13px] transition-colors ${
                p === page
                  ? "bg-gradient-to-br from-yolk to-yolk-d font-semibold text-ink"
                  : "border border-[#F0E3BE] text-ink hover:bg-sand"
              }`}
            >
              {p}
            </button>
          ),
        )}

        {/* 下一页 */}
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="rounded-full border border-[#F0E3BE] px-4 py-2 text-[13px] text-ink transition-colors hover:bg-sand disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
        >
          下一页
        </button>
      </div>

      {/* 右下角计数 */}
      <p className="text-[12px] text-muted">
        共 {total} 条 · 第 {page}/{totalPages} 页
      </p>
    </div>
  );
}