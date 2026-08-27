/**
 * 内部 revalidate 端点（第 8 步 S-33）
 *
 * 后台写操作（案例/套餐/新闻上下架、团队 active、SiteConfig 变更）事务提交后，
 * 由后端 service 异步调用本端点，按 tag 触发 Next.js `revalidateTag`，
 * 实现「后台上架 → 前台 ISR 即时刷新」，不等 revalidate 间隔。
 *
 * 保护：仅接受 `NEXT_REVALIDATE_TOKEN`（与后端 env 一致），
 *       非 GET；返回 401 当 token 缺失/不符，405 当非 POST。
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

const REVALIDATE_TOKEN = process.env.NEXT_REVALIDATE_TOKEN || "dev-revalidate-token";

const ALLOWED_TAGS = ["cases", "packages", "news", "careers", "team", "site", "banners"] as const;

export async function POST(req: NextRequest) {
  // 1. token 校验（避免公网滥用触发缓存重建）
  const auth = req.headers.get("x-revalidate-token") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (auth !== REVALIDATE_TOKEN) {
    return NextResponse.json({ code: 4010, message: "unauthorized" }, { status: 401 });
  }

  // 2. 解析 tag
  let tag: string | null = null;
  try {
    const body = await req.json();
    tag = body?.tag ?? null;
  } catch {
    // body 非 JSON → 视为无 tag
  }
  if (!tag || !(ALLOWED_TAGS as readonly string[]).includes(tag)) {
    return NextResponse.json({ code: 3001, message: `invalid tag: ${tag}` }, { status: 400 });
  }

  // 3. 触发 revalidate
  revalidateTag(tag);

  return NextResponse.json({ code: 0, message: `revalidated: ${tag}` });
}