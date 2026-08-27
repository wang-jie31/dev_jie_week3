/**
 * 首页 Hero 轮播组件（2026-08-27 功能补全）
 *
 * 对齐原型 static/prototype/index-v7.html 的轮播规格：
 * - 全幅图：`https://images.unsplash.com/...?auto=format&fit=crop&w=1920&q=80`
 * - 尺寸：`min-h-[560px] max-h-[900px]`（原型 h-[85vh]），`object-cover`
 * - 交互：左右箭头 + 底部圆点 + 5s 自动播放；鼠标移入暂停、移出继续
 * - 视觉：暗色渐变叠加（左→右 from-ink/75 via-ink/40 to-ink/10），居中文案
 *
 * 使用说明：
 * - 静态轮播（默认）：图片地址与文案写死在前台，保证无后端数据也能展示。
 * - 数据轮播（可选）：传入 items=[{image, en, title, desc, link, linkLabel}]，
 *   供后台「首页图片管理」配置后实时展示。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface HeroSlide {
  /** 全幅背景图（推荐 w=1920&q=80 的 Unsplash 格式） */
  image: string;
  /** 英文小标（如 Cozy Home Design） */
  en?: string;
  /** 主标题（支持 \n 换行） */
  title: string;
  /** 副文案 */
  desc?: string;
  /** 主按钮跳转地址 */
  link?: string;
  /** 主按钮文案 */
  linkLabel?: string;
  /** 次按钮跳转地址 */
  link2?: string;
  /** 次按钮文案 */
  link2Label?: string;
}

/** 默认三张轮播（参考原型 index-v7 的图片格式与尺寸） */
const DEFAULT_SLIDES: HeroSlide[] = [
  {
    image:
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1920&q=80",
    en: "Cozy Home Design",
    title: "把小户型住成温馨的家",
    desc: "专注独居小家设计 —— 用收纳、采光与材质打造舒适日常。",
    link: "/cases",
    linkLabel: "浏览案例",
    link2: "/about#contact",
    link2Label: "预约免费咨询",
  },
  {
    image:
      "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=1920&q=80",
    en: "Small Space, Big Warmth",
    title: "一居一世界\n温馨不打挤",
    desc: "30–70㎡ 也能住出通透与松弛，让小空间变成刚刚好的家。",
    link: "/cases?category=small",
    linkLabel: "看小户型案例",
  },
  {
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1920&q=80",
    en: "Clear Pricing, Easy Mind",
    title: "透明套餐价\n安心每一步",
    desc: "按房间 / 户型 / 风格打包，预算一眼看清，决策不再焦虑。",
    link: "/about#contact",
    linkLabel: "预约咨询",
  },
];

const AUTO_PLAY_MS = 5000; // 自动播放间隔 5s（与原型一致）

export default function HeroCarousel({ items }: { items?: HeroSlide[] }) {
  // 实际渲染的轮播项：外部传入优先，否则用默认三张
  const slides = items && items.length > 0 ? items : DEFAULT_SLIDES;
  const [index, setIndex] = useState(0); // 当前幻灯片下标
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null); // 自动播放定时器

  // 切换到指定下标（自动回绕）
  const go = useCallback(
    (n: number) => {
      setIndex((n + slides.length) % slides.length);
    },
    [slides.length]
  );

  // 定时器统一管理：先清除再按需启动
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTO_PLAY_MS);
  }, [slides.length, stopTimer]);

  // 挂载后启动自动播放；切换下标时重置计时
  useEffect(() => {
    startTimer();
    return stopTimer; // 卸载时清理定时器
  }, [startTimer, stopTimer, index]);

  return (
    <section
      className="relative mt-6 h-[85vh] min-h-[560px] max-h-[900px] overflow-hidden rounded-3xl bg-ink"
      onMouseEnter={stopTimer} // 鼠标移入：暂停自动播放（原型行为）
      onMouseLeave={startTimer} // 鼠标移出：恢复自动播放
    >
      {/* 轮播轨道：flex 横排，通过 translateX 切换 */}
      <div
        className="flex h-full transition-transform duration-600 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div key={i} className="relative h-full w-full shrink-0">
            {/* 全幅背景图（原型图片格式：w=1920&q=80） */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.image}
              alt={s.title.replace(/\n/g, "")}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* 暗色渐变叠加（左强右弱，保证文字可读） */}
            <div className="absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/40 to-ink/10" />
            {/* 文案区 */}
            <div className="relative mx-auto flex h-full max-w-[1280px] flex-col justify-center px-6 pt-24 sm:px-12 lg:px-20">
              {s.en && (
                <p className="font-en text-[13px] uppercase tracking-[0.14em] text-cream/80">
                  {s.en}
                </p>
              )}
              <h1 className="mt-4 font-serif text-4xl font-black leading-tight text-cream sm:text-6xl">
                {s.title.split("\n").map((line, j) => (
                  <span key={j}>
                    {line}
                    {j < s.title.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </h1>
              {s.desc && (
                <p className="mt-5 max-w-xl text-[17px] leading-[1.85] text-cream/90">
                  {s.desc}
                </p>
              )}
              {/* 按钮组 */}
              <div className="mt-8 flex flex-wrap gap-3">
                {s.link && (
                  <Link
                    href={s.link}
                    className="btn-yolk rounded-full px-7 py-3 text-[14px] font-semibold text-ink"
                  >
                    {s.linkLabel || "了解更多"}
                  </Link>
                )}
                {s.link2 && (
                  <Link
                    href={s.link2}
                    className="inline-flex items-center justify-center rounded-full border border-cream/60 px-7 py-3 text-[14px] font-medium text-cream transition-colors duration-200 hover:bg-cream/10"
                  >
                    {s.link2Label || "了解更多"}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 左箭头：上一张 */}
      <button
        type="button"
        aria-label="上一张"
        onClick={() => go(index - 1)}
        className="absolute left-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#F0E3BE] bg-cream/85 transition-colors hover:bg-sand"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* 右箭头：下一张 */}
      <button
        type="button"
        aria-label="下一张"
        onClick={() => go(index + 1)}
        className="absolute right-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#F0E3BE] bg-cream/85 transition-colors hover:bg-sand"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* 圆点指示器：点击直达对应张 */}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`第 ${i + 1} 张`}
            onClick={() => go(i)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              i === index ? "w-7 bg-yolk" : "w-2.5 bg-cream/50 hover:bg-cream/80"
            }`}
          />
        ))}
      </div>
    </section>
  );
}