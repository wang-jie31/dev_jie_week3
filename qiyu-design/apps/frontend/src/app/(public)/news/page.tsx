/**
 * 新闻列表页（S-14）—— Hero → 分类 chips（企业/行业）→ 列表（左图右文）→ 分页条
 */
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { NewsRow } from "@/components/Cards";
import { seoMetadata } from "@/lib/seo";
import ClientNewsList from "./client";

export const revalidate = 60;

export const metadata: Metadata = seoMetadata({
  title: "新闻资讯",
  description: "栖屿设计动态与行业观察 —— 企业新闻、行业资讯、装修干货，陪你一起把小家越住越好。",
  path: "/news",
});

export interface NewsListSearchParams {
  cat?: string;
  page?: string;
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<NewsListSearchParams>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const pageSize = 10;
  const data = await api.news(
    { cat: sp.cat, page: String(page), pageSize: String(pageSize) },
    60,
  );

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-16">
      {/* 页头 Hero */}
      <section className="relative mt-6 flex min-h-[200px] flex-col justify-center overflow-hidden rounded-3xl bg-[#4A3F30] px-8 py-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4A3F30] to-[#6B5D4B]" />
        <div className="relative">
          <p className="eyebrow text-yolk">NEWS · 新闻资讯</p>
          <h1 className="mt-3 font-serif text-[2.2rem] font-extrabold leading-tight text-cream">
            栖屿动态 · 行业观察
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-[1.9] text-cream/75">
            陪你一起把小家越住越好 —— 企业新闻与行业资讯，一网打尽。
          </p>
        </div>
      </section>

      <ClientNewsList data={data} page={page} pageSize={pageSize} active={{ cat: sp.cat }} />
    </div>
  );
}