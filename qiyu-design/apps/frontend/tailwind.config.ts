import type { Config } from "tailwindcss";

/**
 * 栖屿设计 · Tailwind 配置
 * 颜色/字体直接映射《UIUX设计文档.md》§2 design tokens，
 * 与 packages/ui/src/tokens.css 保持同源（CSS 变量）。
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        yolk: "#F7D06A",
        "yolk-d": "#EDB93F",
        ink: "#4A3F30",
        "ink-2": "#3A3226",
        muted: "#9A8C75",
        "muted-bg": "#EFEAE0",
        cream: "#FFFDF6",
        sand: "#F9F3E6",
        gold: "#C8951F",
        "brand-red": "#C73E3A",
        orange: "#C0732B",
        purple: "#7E57C2",
      },
      fontFamily: {
        serif: ["Noto Serif SC", "Source Han Serif SC", "serif"],
        sans: ["Noto Sans SC", "Inter", "system-ui", "sans-serif"],
        en: ["Inter", "Noto Sans SC", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        eyebrow: "0.18em",
      },
      boxShadow: {
        card: "0 2px 12px rgba(74,63,48,0.08)",
        pop: "0 8px 24px rgba(74,63,48,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;