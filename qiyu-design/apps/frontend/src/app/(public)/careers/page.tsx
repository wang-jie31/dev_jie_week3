/**
 * 招聘页（S-14）—— Hero → 分类 chips（社会/校园）→ 职位卡片列表 → 投递提示
 */
import { api } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";
import ClientCareers from "./client";

export const revalidate = 60;

export const metadata = seoMetadata({
  title: "加入我们 · 招聘",
  description: "栖屿设计招聘 —— 社会招聘与校园招聘，室内设计师 / 深化 / 商务等岗位持续开放。",
  path: "/careers",
});

export interface CareersSearchParams {
  cat?: string;
}

export default async function CareersPage({
  searchParams,
}: {
  searchParams: Promise<CareersSearchParams>;
}) {
  const sp = await searchParams;
  const items = await api.careers({ cat: sp.cat }, 60);

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-16">
      {/* 页头 Hero */}
      <section className="relative mt-6 flex min-h-[200px] flex-col justify-center overflow-hidden rounded-3xl bg-[#4A3F30] px-8 py-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4A3F30] to-[#6B5D4B]" />
        <div className="relative">
          <p className="eyebrow text-yolk">CAREERS · 招聘入口</p>
          <h1 className="mt-3 font-serif text-[2.2rem] font-extrabold leading-tight text-cream">
            和一群相信「独居也很温暖」的人
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-[1.9] text-cream/75">
            一起把好设计带给更多人 —— 社会招聘 + 校园招聘，欢迎加入栖屿。
          </p>
        </div>
      </section>

      <ClientCareers items={items} active={{ cat: sp.cat }} />
    </div>
  );
}