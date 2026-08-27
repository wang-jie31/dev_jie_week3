/**
 * slug 工具（2026-08-27 修复 422）
 *
 * 背景：后台新建案例/套餐/新闻时，若标题为中文，旧逻辑
 * `form.title.replace(/\s+/g, "-").toLowerCase()` 会生成含中文的 slug，
 * 不满足后端 `^[a-z0-9][a-z0-9-]*$` 校验 → 422 新建失败。
 *
 * 方案：优先取标题中已有的 ASCII 片段（英文/数字，如 "loft"、"2026"）；
 * 纯中文标题则用「qiyu-<时间戳36进制>」兜底，保证 slug 仅含 [a-z0-9-]。
 */

/**
 * 由标题生成合法 ASCII slug：
 * - 优先保留英文/数字片段（如 "loft-9平" → "loft-9"）
 * - 全中文标题 → `qiyu-<时间戳36进制>`（时间戳转 36 进制可缩短长度）
 */
export function genSlug(title: string): string {
  const ascii = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // 非 ASCII/数字 → 连字符
    .replace(/^-+|-+$/g, "") // 去首尾连字符
    .slice(0, 60);
  // 标题含英文/数字 → 直接用；否则用 qiyu-时间戳兜底
  return ascii || `qiyu-${Date.now().toString(36)}`;
}
