/**
 * 前台 API 客户端（第 4 步）
 *
 * 统一对接 FastAPI 公开接口（/api/v1）：
 * - 解包 {code, message, data} 统一响应
 * - 服务端（SSR/SSG）环境下指向后端绝对地址
 * - 配套 ISR：列表/详情页用 revalidate 标签按内容域刷新
 *
 * 后端地址：本机联调 8000；生产由 NEXT_PUBLIC_API_BASE 环境变量覆盖
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

/** 统一响应解包：code!==0 抛业务错误；直接返回 data */
async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.message || `HTTP ${res.status}`);
  }
  if (body?.code !== 0) {
    throw new Error(body?.message || `业务错误 code=${body?.code}`);
  }
  return body.data as T;
}

/** 通用 GET（带超时）——支持 tags 标签式 ISR（S-33：后端 revalidateTag 可即时失效） */
async function get<T>(path: string, revalidate?: number, tags?: string[]): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    // ISR：若调用方传入 revalidate 秒数，则走 Next 数据缓存（并附加 tags 供 revalidateTag 失效）
    ...(revalidate
      ? { next: { revalidate, tags } }
      : { cache: "no-store" as const }),
    headers: { Accept: "application/json" },
  });
  return unwrap<T>(res);
}

/** 通用 POST（JSON） */
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return unwrap<T>(res);
}

// ---------- 类型（与 packages/api-types 契约同源，此处仅引用视图需要字段） ----------

export interface CaseListItem {
  id: number;
  slug: string;
  category: "private" | "small" | "apartment";
  title: string;
  cover: string;
  summary?: string | null;
  style_tags: string[];
  house_type_tags: string[];
  area_range?: string | null;
  location?: string | null;
  area?: number | null;
  year?: number | null;
  designer?: string | null;
  studio?: string | null;
  price_per_sqm: number;
  price_note?: string | null;
  is_featured: boolean;
  view_count: number;
  status: string;
}

export interface CaseDetail extends CaseListItem {
  gallery: string[];
  video_url?: string | null;
  content?: string | null;
  material_notes?: string | null;
  prev?: Pick<CaseListItem, "slug" | "title" | "cover" | "category"> | null;
  next?: Pick<CaseListItem, "slug" | "title" | "cover" | "category"> | null;
}

export interface PackageListItem {
  id: number;
  slug: string;
  name: string;
  type: "single_space" | "whole_house" | "style";
  cover: string;
  summary?: string | null;
  applicable_house_type?: string | null;
  price_per_sqm: number;
  price_from: number;
  area_step_coefficient: number;
  price_note?: string | null;
}

export interface PackageDetail extends PackageListItem {
  description?: string | null;
  process_steps: { id: number; step_no: number; title: string; description?: string | null }[];
}

export interface NewsItem {
  id: number;
  slug: string;
  category: "company" | "industry";
  title: string;
  cover: string;
  summary?: string | null;
  content?: string | null;
  published_at?: string | null;
}

export interface TeamMember {
  id: number;
  name: string;
  title?: string | null;
  avatar?: string | null;
  specialty?: string | null;
  bio?: string | null;
  order: number;
}

export interface CareerItem {
  id: number;
  title: string;
  category: "social" | "campus";
  location?: string | null;
  type?: string | null;
  duties?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page?: number | null;
  pageSize?: number | null;
}

/** 首页轮播图条目（后端 site_config.home_banners 配置，2026-08-27 功能补全） */
export interface HomeBannerItem {
  id?: number;
  image: string; // 全幅图（推荐 w=1920&q=80）
  title: string; // 主标题（支持 \n 换行）
  en?: string; // 英文小标
  desc?: string; // 副文案
  link?: string; // 主按钮跳转
  link_label?: string; // 主按钮文案
  link2?: string; // 次按钮跳转
  link2_label?: string; // 次按钮文案
  sort?: number; // 排序
  enabled?: boolean; // 是否启用
}

export interface HomeData {
  home_banners?: HomeBannerItem[]; // 首页轮播图（后台「首页轮播图」管理页配置）
  featured_cases: CaseListItem[];
  published_packages: PackageListItem[];
  news_preview: NewsItem[];
  about_summary: string;
}

export interface SiteConfig {
  id: number;
  company_intro?: string | null;
  brand_intro?: string | null;
  process_intro?: string | null;
  contact_info: Record<string, string>;
  social_links: { name: string; url: string }[];
  history_items?: { year: string; title: string; description?: string }[];
}

// ---------- 公开端点 ----------

export const api = {
  home: (r?: number) => get<HomeData>("/api/v1/home", r ?? 60, ["cases", "packages", "news", "site"]),
  cases: (params: Record<string, string | number | undefined>, r?: number) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<CaseListItem>>(`/api/v1/cases${q ? `?${q}` : ""}`, r ?? 30, ["cases"]);
  },
  caseDetail: (slug: string, r?: number) =>
    get<CaseDetail>(`/api/v1/cases/${slug}`, r ?? 30, ["cases"]),
  bumpCaseView: (slug: string) => post<{ view_count: number; dedup: boolean }>(`/api/v1/cases/${slug}/view`, {}),
  packages: (params: Record<string, string | number | undefined>, r?: number) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<PackageListItem>>(`/api/v1/packages${q ? `?${q}` : ""}`, r ?? 30, ["packages"]);
  },
  packageDetail: (slug: string, r?: number) =>
    get<PackageDetail>(`/api/v1/packages/${slug}`, r ?? 30, ["packages"]),
  news: (params: Record<string, string | number | undefined>, r?: number) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<NewsItem>>(`/api/v1/news${q ? `?${q}` : ""}`, r ?? 60, ["news"]);
  },
  newsDetail: (slug: string, r?: number) => get<NewsItem>(`/api/v1/news/${slug}`, r ?? 60, ["news"]),
  team: (r?: number) => get<TeamMember[]>("/api/v1/team", r ?? 60, ["team"]),
  careers: (params: Record<string, string | undefined>, r?: number) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<CareerItem[]>(`/api/v1/careers${q ? `?${q}` : ""}`, r ?? 60, ["careers"]);
  },
  site: (r?: number) => get<SiteConfig>("/api/v1/site", r ?? 60, ["site"]),
  contactInfo: (r?: number) => get<Record<string, unknown>>("/api/v1/about/contact-info", r ?? 60, ["site"]),
  /** S-16 公开提交留言/预约：POST /api/v1/messages（限流 10 次/分/IP，3004 时抛错） */
  submitMessage: (input: {
    name: string;
    phone: string;
    kind?: "appointment" | "message";
    content?: string;
    budget?: string;
    source_page?: string;
  }) =>
    post<{ id: number }>("/api/v1/messages", {
      name: input.name,
      phone: input.phone,
      kind: input.kind || "appointment",
      content: input.content || "",
      budget: input.budget || null,
      source_page: input.source_page || null,
    }),
};

/** slug 列表（SSG generateStaticParams 用）：拉取全量后取 slug */
export async function listCaseSlugs(): Promise<string[]> {
  try {
    const data = await api.cases({ page: "1", pageSize: "100" }, 3600);
    return data.items.map((c) => c.slug);
  } catch {
    return [];
  }
}

export async function listPackageSlugs(): Promise<string[]> {
  try {
    const data = await api.packages({ page: "1", pageSize: "100" }, 3600);
    return data.items.map((p) => p.slug);
  } catch {
    return [];
  }
}

export async function listNewsSlugs(): Promise<string[]> {
  try {
    const data = await api.news({ page: "1", pageSize: "100" }, 3600);
    return data.items.map((n) => n.slug);
  } catch {
    return [];
  }
}