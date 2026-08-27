/**
 * 后台 API 客户端（S-18 线索域引入，第 7 步 org 域复用）
 *
 * - 统一自动附加 `Authorization: Bearer <token>`（token 存 localStorage: qiyu_admin_token）
 * - 统一解包 {code, message, data}；code!==0 抛 BizError（含 code，页面可映射 3004/4003 等）
 * - HTTP 401 统一跳转 /login（会话过期）
 *
 * 后端地址：本机联调 8000；生产由 VITE_API_BASE 覆盖（vite.config 注入 import.meta.env）
 */

const API_BASE: string =
  (import.meta.env?.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:8000";

const TOKEN_KEY = "qiyu_admin_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** 业务错误：后端返回 {code, message} 但 code!==0 */
export class BizError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "BizError";
    this.code = code;
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  if (res.status === 401) {
    clearToken();
    // 会话过期：跳登录（保留当前路径供第 7 步回跳）
    const redirect = encodeURIComponent(location.pathname + location.search);
    location.href = `/login?redirect=${redirect}`;
    throw new BizError(401, "登录已过期，请重新登录");
  }
  if (!res.ok) {
    const msg =
      (body as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    throw new BizError(res.status, msg);
  }
  const d = body as { code?: number; message?: string; data?: T } | null;
  if (!d || d.code !== 0) {
    throw new BizError(d?.code ?? -1, d?.message ?? "请求失败");
  }
  return d.data as T;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers() });
  return unwrap<T>(res);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body ?? {}),
  });
  return unwrap<T>(res);
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body ?? {}),
  });
  return unwrap<T>(res);
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body ?? {}),
  });
  return unwrap<T>(res);
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: headers(),
  });
  return unwrap<T>(res);
}

// ---------- 通用上传（2026-08-27 图片上传 + 裁剪组件依赖） ----------

export interface UploadResult {
  url: string;
  storage_key: string;
  mime: string;
  size: number;
}

/**
 * 通用文件上传：POST /api/v1/admin/upload
 * - FormData 字段名固定为 `file`，目录通过 query 参数 `folder` 指定
 * - 不能带 Content-Type（浏览器自动生成 multipart boundary），仅带 Accept + Authorization
 * - 返回 {url, storage_key, mime, size}，表单字段保存 url 即可
 */
export async function uploadFile(file: Blob, folder: string): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  const h: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `${API_BASE}/api/v1/admin/upload?folder=${encodeURIComponent(folder)}`,
    { method: "POST", headers: h, body: fd }
  );
  return unwrap<UploadResult>(res);
}

// ---------- 类型 ----------

export interface MessageListItem {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  budget?: string | null;
  content?: string | null;
  source_page?: string | null;
  kind: "appointment" | "message";
  status: "new" | "contacted" | "converted" | "closed";
  note?: string | null;
  created_at: string | null;
  thread_count: number;
}

export interface ThreadItem {
  id: number;
  type: "phone" | "wechat" | "sms" | "email" | "note";
  content: string;
  author: string;
  created_at: string | null;
}

export interface MessageDetail extends MessageListItem {
  threads: ThreadItem[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page?: number | null;
}

// ---------- 内容域端点（S-04，第 8 步补全后台封装） ----------

export interface CaseItem {
  id: number;
  slug: string;
  category: "private" | "small" | "apartment";
  title: string;
  cover: string;
  gallery: string[];
  video_url?: string | null;
  summary?: string | null;
  content?: string | null;
  style_tags: string[];
  house_type_tags: string[];
  area_range?: string | null;
  location?: string | null;
  area?: number | null;
  year?: number | null;
  designer?: string | null;
  studio?: string | null;
  material_notes?: string | null;
  price_per_sqm: number;
  price_note?: string | null;
  is_featured: boolean;
  view_count: number;
  status: "draft" | "published" | "offline";
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PackageItem {
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
  status: "draft" | "published" | "offline";
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PackageDetailItem extends PackageItem {
  description?: string | null;
  process_steps?: {
    id: number;
    step_no: number;
    title: string;
    description?: string | null;
  }[];
}

export interface NewsItem {
  id: number;
  slug: string;
  title: string;
  category: "company" | "industry";
  cover: string;
  summary?: string | null;
  content?: string | null;
  published_at?: string | null;
  status: "draft" | "published" | "offline";
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CareerItem {
  id: number;
  title: string;
  category: "social" | "campus";
  location?: string | null;
  type?: string | null;
  duties?: string | null;
  status: "draft" | "published" | "offline";
  created_at?: string | null;
  updated_at?: string | null;
}

export const contentApi = {
  // 案例
  cases: (params: { category?: string; status?: string; keyword?: string; page?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<CaseItem>>(`/api/v1/admin/cases${q ? `?${q}` : ""}`);
  },
  caseDetail: (id: number) => get<CaseItem>(`/api/v1/admin/cases/${id}`),
  createCase: (body: Record<string, unknown>) =>
    post<CaseItem>("/api/v1/admin/cases", body),
  updateCase: (id: number, body: Record<string, unknown>) =>
    put<CaseItem>(`/api/v1/admin/cases/${id}`, body),
  updateCaseStatus: (id: number, status: string) =>
    patch<{ id: number; status: string }>(`/api/v1/admin/cases/${id}/status`, { status }),
  deleteCase: (id: number) => del<{ deleted: boolean }>(`/api/v1/admin/cases/${id}`),

  // 套餐
  packages: (params: { type?: string; status?: string; keyword?: string; page?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<PackageItem>>(`/api/v1/admin/packages${q ? `?${q}` : ""}`);
  },
  packageDetail: (id: number) => get<PackageDetailItem>(`/api/v1/admin/packages/${id}`),
  createPackage: (body: Record<string, unknown>) =>
    post<PackageItem>("/api/v1/admin/packages", body),
  updatePackage: (id: number, body: Record<string, unknown>) =>
    put<PackageItem>(`/api/v1/admin/packages/${id}`, body),
  updatePackageStatus: (id: number, status: string) =>
    patch<{ id: number; status: string }>(`/api/v1/admin/packages/${id}/status`, { status }),
  deletePackage: (id: number) => del<{ deleted: boolean }>(`/api/v1/admin/packages/${id}`),

  // 新闻
  news: (params: { category?: string; status?: string; keyword?: string; page?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<NewsItem>>(`/api/v1/admin/news${q ? `?${q}` : ""}`);
  },
  newsDetail: (id: number) => get<NewsItem>(`/api/v1/admin/news/${id}`),
  createNews: (body: Record<string, unknown>) =>
    post<NewsItem>("/api/v1/admin/news", body),
  updateNews: (id: number, body: Record<string, unknown>) =>
    put<NewsItem>(`/api/v1/admin/news/${id}`, body),
  updateNewsStatus: (id: number, status: string) =>
    patch<{ id: number; status: string }>(`/api/v1/admin/news/${id}/status`, { status }),
  deleteNews: (id: number) => del<{ deleted: boolean }>(`/api/v1/admin/news/${id}`),

  // 招聘
  careers: (params: { category?: string; status?: string; keyword?: string; page?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<CareerItem>>(`/api/v1/admin/careers${q ? `?${q}` : ""}`);
  },
  careerDetail: (id: number) => get<CareerItem>(`/api/v1/admin/careers/${id}`),
  createCareer: (body: Record<string, unknown>) =>
    post<CareerItem>("/api/v1/admin/careers", body),
  updateCareer: (id: number, body: Record<string, unknown>) =>
    put<CareerItem>(`/api/v1/admin/careers/${id}`, body),
  updateCareerStatus: (id: number, status: string) =>
    patch<{ id: number; status: string }>(`/api/v1/admin/careers/${id}/status`, { status }),
  deleteCareer: (id: number) => del<{ deleted: boolean }>(`/api/v1/admin/careers/${id}`),
};

// ---------- 线索域端点（S-15） ----------

export const leadApi = {
  list: (params: {
    kind?: string;
    status?: string;
    source_page?: string;
    keyword?: string;
    page?: number;
    page_size?: number; // 每页条数（5/10/20/50，2026-08-27 分页增强）
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<MessageListItem>>(
      `/api/v1/admin/messages${q ? `?${q}` : ""}`
    );
  },
  detail: (id: number) => get<MessageDetail>(`/api/v1/admin/messages/${id}`),
  updateStatus: (id: number, status: string) =>
    patch<{ id: number; status: string }>(`/api/v1/admin/messages/${id}/status`, {
      status,
    }),
  appendThread: (id: number, type: string, content: string) =>
    post<{ id: number; type: string; content: string; author: string }>(
      `/api/v1/admin/messages/${id}/threads`,
      { type, content }
    ),
};

// ---------- 交付域端点（S-19~S-21） ----------

export interface ProjectItem {
  id: number;
  code: string;
  title: string;
  client_name?: string | null;
  client_phone?: string | null;
  designer_id?: number | null;
  designer_name?: string | null;
  site_id?: number | null;
  status:
    | "lead"
    | "measuring"
    | "designing"
    | "quoting"
    | "signed"
    | "constructing"
    | "acceptance"
    | "done"
    | "cancelled";
  budget?: number | null;
  area?: number | null;
  style?: string | null;
  address?: string | null;
  progress: number;
  start_date?: string | null;
  expected_end_date?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SiteItem {
  id: number;
  name: string;
  address?: string | null;
  supervisor?: string | null;
  phone?: string | null;
  project_id?: number | null;
  remark?: string | null;
  created_at?: string | null;
}

export interface OverviewData {
  kpi: Record<string, number>;
  north_star: { valid_leads_this_month?: number };
  message_status_dist: { status: string; count: number }[];
  project_status_dist: { status: string; count: number }[];
  trend_6m: { month: string; projects: number; appointments: number }[];
  designer_rank: { designer: string; count: number }[];
}

export const deliveryApi = {
  projects: (params: {
    status?: string;
    designer_id?: number;
    keyword?: string;
    page?: number;
    page_size?: number; // 每页条数（5/10/20/50，2026-08-27 分页增强）
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<ProjectItem>>(
      `/api/v1/admin/projects${q ? `?${q}` : ""}`
    );
  },
  projectDetail: (id: number) =>
    get<ProjectItem>(`/api/v1/admin/projects/${id}`),
  createProject: (body: Record<string, unknown>) =>
    post<ProjectItem>("/api/v1/admin/projects", body),
  updateProject: (id: number, body: Record<string, unknown>) =>
    put<ProjectItem>(`/api/v1/admin/projects/${id}`, body),
  updateProjectStatus: (id: number, status: string) =>
    patch<{ id: number; status: string; progress?: number }>(
      `/api/v1/admin/projects/${id}/status`,
      { status }
    ),
  updateProjectProgress: (id: number, progress: number) =>
    patch<{ id: number; progress: number }>(
      `/api/v1/admin/projects/${id}/progress`,
      { progress }
    ),
  deleteProject: (id: number) =>
    del<{ deleted: boolean }>(`/api/v1/admin/projects/${id}`),
  sites: (params: { keyword?: string; page?: number; page_size?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<SiteItem>>(`/api/v1/admin/sites${q ? `?${q}` : ""}`);
  },
  siteDetail: (id: number) => get<SiteItem>(`/api/v1/admin/sites/${id}`),
  createSite: (body: Record<string, unknown>) =>
    post<SiteItem>("/api/v1/admin/sites", body),
  updateSite: (id: number, body: Record<string, unknown>) =>
    put<SiteItem>(`/api/v1/admin/sites/${id}`, body),
  deleteSite: (id: number) =>
    del<{ deleted: boolean }>(`/api/v1/admin/sites/${id}`),
  overview: () => get<OverviewData>("/api/v1/admin/overview"),
};

// ---------- 团队域端点（第 3 步后端已有，S-23 补齐页面） ----------

export interface TeamAdminItem {
  id: number;
  name: string;
  title?: string | null;
  avatar?: string | null;
  specialty?: string | null;
  bio?: string | null;
  staff_id?: number | null;
  order: number;
  active: boolean;
}

export const teamApi = {
  list: () => get<TeamAdminItem[]>("/api/v1/admin/team"),
  create: (body: Record<string, unknown>) =>
    post<TeamAdminItem>("/api/v1/admin/team", body),
  update: (id: number, body: Record<string, unknown>) =>
    put<TeamAdminItem>(`/api/v1/admin/team/${id}`, body),
  setActive: (id: number, active: boolean) =>
    patch<TeamAdminItem>(`/api/v1/admin/team/${id}/visibility`, { active }),
  remove: (id: number) => del<{ deleted: boolean }>(`/api/v1/admin/team/${id}`),
};

// ---------- 组织域（S-25~S-28） ----------

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    username: string;
    name: string;
    role: "admin" | "sales" | "design" | "cs";
    department_id?: number | null;
  };
}

export interface AdminMe {
  id: number;
  username: string;
  name: string;
  role: "admin" | "sales" | "design" | "cs";
  department_id?: number | null;
}

export interface StaffItem {
  id: number;
  username: string;
  name: string;
  nickname?: string | null;
  gender?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  role: "admin" | "sales" | "design" | "cs";
  active: boolean;
  phone?: string | null;
  address?: string | null;
  id_card_mask?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
}

export interface DepartmentItem {
  id: number;
  name: string;
  sort: number;
  lead?: string | null;
  description?: string | null;
  created_at?: string | null;
}

export interface LoginLogItem {
  id: number;
  user_id?: number | null;
  username?: string | null;
  name?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  login_time?: string | null;
}

export interface StaffShortItem {
  id: number;
  name: string;
  role: string;
}

export interface SiteConfigData {
  id: number;
  company_intro?: string | null;
  brand_intro?: string | null;
  process_intro?: string | null;
  contact_info: Record<string, unknown>;
  social_links: Array<Record<string, unknown>>;
  history_items: Array<{
    id?: number;
    year: string;
    title: string;
    description?: string | null;
    sort: number;
  }>;
  /** 首页轮播图配置（后台「首页轮播图」管理页读写，[{image,title,en,desc,link,link_label,link2,link2_label,sort,enabled}]） */
  home_banners?: Array<{
    image: string;
    title?: string;
    en?: string;
    desc?: string;
    link?: string;
    link_label?: string;
    link2?: string;
    link2_label?: string;
    sort?: number;
    enabled?: boolean;
  }>;
  updated_at?: string | null;
}

const REFRESH_KEY = "qiyu_admin_refresh";

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string): void {
  try {
    localStorage.setItem(REFRESH_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearRefreshToken(): void {
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

export const authApi = {
  login: (username: string, password: string) =>
    post<LoginResult>("/api/v1/admin/login", { username, password }),
  refresh: (refresh_token: string) =>
    post<{ access_token: string; refresh_token: string }>(
      "/api/v1/admin/refresh",
      { refresh_token }
    ),
  logout: (refresh_token: string) =>
    post<{ logout: boolean }>("/api/v1/admin/logout", { refresh_token }),
  me: () => get<AdminMe>("/api/v1/admin/me"),
};

export const orgApi = {
  accounts: (params: {
    keyword?: string;
    role?: string;
    active?: boolean;
    page?: number;
    page_size?: number;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<StaffItem>>(
      `/api/v1/admin/accounts${q ? `?${q}` : ""}`
    );
  },
  accountDetail: (id: number) =>
    get<StaffItem>(`/api/v1/admin/accounts/${id}`),
  revealIdCard: (id: number) =>
    get<{ id: number; id_card: string }>(`/api/v1/admin/accounts/${id}/idcard`),
  createAccount: (body: Record<string, unknown>) =>
    post<StaffItem>("/api/v1/admin/accounts", body),
  updateAccount: (id: number, body: Record<string, unknown>) =>
    put<StaffItem>(`/api/v1/admin/accounts/${id}`, body),
  setAccountActive: (id: number, active: boolean) =>
    patch<StaffItem>(`/api/v1/admin/accounts/${id}/active`, { active }),
  deleteAccount: (id: number) =>
    del<{ deleted: boolean }>(`/api/v1/admin/accounts/${id}`),
  departments: () => get<DepartmentItem[]>("/api/v1/admin/departments"),
  createDepartment: (body: Record<string, unknown>) =>
    post<DepartmentItem>("/api/v1/admin/departments", body),
  updateDepartment: (id: number, body: Record<string, unknown>) =>
    put<DepartmentItem>(`/api/v1/admin/departments/${id}`, body),
  deleteDepartment: (id: number) =>
    del<{ deleted: boolean }>(`/api/v1/admin/departments/${id}`),
  loginLogs: (params: { page?: number; page_size?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    });
    const q = qs.toString();
    return get<Paginated<LoginLogItem>>(
      `/api/v1/admin/login-logs${q ? `?${q}` : ""}`
    );
  },
  exportLoginLogs: () =>
    get<{ csv: string }>("/api/v1/admin/login-logs/export"),
  staffShort: () => get<StaffShortItem[]>("/api/v1/admin/staff-short"),
  siteConfig: () => get<SiteConfigData>("/api/v1/admin/site-config"),
  updateSiteConfig: (body: Record<string, unknown>) =>
    put<SiteConfigData>("/api/v1/admin/site-config", body),
};