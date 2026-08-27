/**
 * 线索留言管理（S-18）
 *
 * 功能：
 * - kind 分流 tabs：全部 / 预约(appointment) / 留言(message)
 * - 状态 chips 筛选：new / contacted / converted / closed（点击即查）
 * - 右上 keyword 搜索 + 统一分页条（上/下页 + 总数）
 * - 点击行 → 右侧详情抽屉：
 *   - 基本信息（称呼/电话/预算/来源页/备注）
 *   - threads 沟通时间线（类型徽标 + 内容 + 操作人 + 时间，只追加不删）
 *   - 底部追加表单（type 5 选 1 + 内容）与状态流转按钮（按状态机展示可达状态）
 * - 状态流转触发 PATCH，服务器 4003 非法流转以红字提示
 *
 * 依赖：leadApi（lib/api.ts）；token 缺失时 leadApi 自动 401 跳 /login
 */
import { useEffect, useState } from "react";
import { leadApi, BizError } from "../lib/api";
import type { MessageListItem, MessageDetail, ThreadItem } from "../lib/api";
import PageSizeSelect from "../components/PageSizeSelect"; // 每页条数选择器（5/10/20/50）

const KIND_TABS = [
  { key: "", label: "全部" },
  { key: "appointment", label: "预约" },
  { key: "message", label: "留言" },
] as const;

const STATUS_CHIPS: { key: string; label: string; className: string }[] = [
  { key: "", label: "全部状态", className: "chip-default" },
  { key: "new", label: "新线索", className: "chip-new" },
  { key: "contacted", label: "已联系", className: "chip-contacted" },
  { key: "converted", label: "已转化", className: "chip-converted" },
  { key: "closed", label: "已关闭", className: "chip-closed" },
];

const THREAD_TYPES: { key: string; label: string }[] = [
  { key: "phone", label: "电话" },
  { key: "wechat", label: "微信" },
  { key: "sms", label: "短信" },
  { key: "email", label: "邮件" },
  { key: "note", label: "备注" },
];

/** 状态机可达迁移（与后端 §4.3 一致） */
const NEXT_STATUS: Record<string, string[]> = {
  new: ["contacted", "closed"],
  contacted: ["converted", "closed", "new"],
  converted: [],
  closed: [],
};

const KIND_LABEL: Record<string, string> = {
  appointment: "预约",
  message: "留言",
};

const STATUS_LABEL: Record<string, string> = {
  new: "新线索",
  contacted: "已联系",
  converted: "已转化",
  closed: "已关闭",
};

const PAGE_SIZE = 20;

export default function MessagesPage() {
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE); // 每页条数（可切换 5/10/20/50）
  const [items, setItems] = useState<MessageListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadList() {
    setLoading(true);
    setError("");
    try {
      const data = await leadApi.list({
        kind: kind || undefined,
        status: status || undefined,
        keyword: keyword || undefined,
        page,
        page_size: pageSize,
      });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof BizError ? e.message : "加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, status, page]);

  function search() {
    setPage(1);
    loadList();
  }

  async function openDetail(id: number) {
    setDrawerOpen(true);
    setNotice("");
    try {
      const d = await leadApi.detail(id);
      setDetail(d);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "详情加载失败");
    }
  }

  async function doStatus(id: number, s: string) {
    try {
      await leadApi.updateStatus(id, s);
      setNotice(`已流转为「${STATUS_LABEL[s] ?? s}」`);
      setDetail((d) => (d ? { ...d, status: s as MessageDetail["status"] } : d));
      loadList(); // 同步列表状态
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "流转失败");
    }
  }

  async function doThread(type: string, content: string) {
    if (!detail) return;
    try {
      await leadApi.appendThread(detail.id, type, content);
      setNotice("沟通记录已追加");
      const d = await leadApi.detail(detail.id);
      setDetail(d);
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "追加失败");
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDetail(null);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <>
      <header className="admin-header">
        <h1>线索留言</h1>
        <span className="hint">线索域 · 共 {total} 条</span>
      </header>

      {/* 筛选区：kind tabs + status chips + keyword 搜索 */}
      <div className="filter-bar">
        <div className="filter-group" role="tablist" aria-label="线索类型">
          {KIND_TABS.map((t) => (
            <button
              key={t.key}
              className={`filter-tab ${kind === t.key ? "active" : ""}`}
              onClick={() => setKind(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="filter-group" role="group" aria-label="状态筛选">
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.key}
              className={`filter-chip ${c.className} ${status === c.key ? "active" : ""}`}
              onClick={() => setStatus(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="filter-search">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="搜索称呼 / 电话 / 内容"
            className="search-input"
          />
          <button className="btn btn-ink" onClick={search}>
            搜索
          </button>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {/* 表格 */}
      <div className="panel table-panel">
        {loading && items.length === 0 ? (
          <p className="hint">加载中…</p>
        ) : items.length === 0 ? (
          <p className="hint">暂无线索。前台「联系我们」提交后即出现在这里。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>类型</th>
                <th>称呼</th>
                <th>电话</th>
                <th>内容摘要</th>
                <th>来源</th>
                <th>状态</th>
                <th>沟通数</th>
                <th>提交时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} onClick={() => openDetail(m.id)} className="row-clickable">
                  <td className="td-id">{m.id}</td>
                  <td>
                    <span className={`kind-badge kind-${m.kind}`}>{KIND_LABEL[m.kind] ?? m.kind}</span>
                  </td>
                  <td className="td-main">{m.name}</td>
                  <td className="td-phone">{m.phone}</td>
                  <td className="td-ellipsis">{m.content || "—"}</td>
                  <td className="td-source">{m.source_page || "—"}</td>
                  <td>
                    <span className={`status-badge status-${m.status}`}>
                      {STATUS_LABEL[m.status] ?? m.status}
                    </span>
                  </td>
                  <td className="td-center">{m.thread_count}</td>
                  <td className="td-time">{m.created_at?.slice(0, 16).replace("T", " ") ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页条 */}
      <div className="pager">
        <PageSizeSelect
          value={pageSize}
          onChange={(n) => {
            setPageSize(n);
            setPage(1); // 切换每页条数后回到第一页
          }}
        />
        <span className="pager-info">
          第 {page} / {totalPages} 页 · 共 {total} 条
        </span>
        <div className="pager-btns">
          <button className="btn btn-ghost" disabled={!canGoPrev} onClick={() => setPage((p) => p - 1)}>
            上一页
          </button>
          <button
            className="btn btn-ghost"
            disabled={!canGoNext}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </div>

      {/* 详情抽屉 */}
      {drawerOpen && (
        <div className="drawer-mask" onClick={closeDrawer}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>
                {detail ? `${detail.name} · ${KIND_LABEL[detail.kind] ?? detail.kind}` : "线索详情"}
                {detail && (
                  <span className={`status-badge status-${detail.status}`}>
                    {STATUS_LABEL[detail.status] ?? detail.status}
                  </span>
                )}
              </h2>
              <button className="drawer-close" onClick={closeDrawer} aria-label="关闭">
                ×
              </button>
            </div>

            {notice && <p className="notice-line">{notice}</p>}

            {detail ? (
              <div className="drawer-body">
                {/* 基本信息 */}
                <dl className="detail-grid">
                  <div>
                    <dt>称呼</dt>
                    <dd>{detail.name}</dd>
                  </div>
                  <div>
                    <dt>电话</dt>
                    <dd>{detail.phone}</dd>
                  </div>
                  {detail.email && (
                    <div>
                      <dt>邮箱</dt>
                      <dd>{detail.email}</dd>
                    </div>
                  )}
                  {detail.budget && (
                    <div>
                      <dt>预算</dt>
                      <dd>{detail.budget}</dd>
                    </div>
                  )}
                  {detail.source_page && (
                    <div>
                      <dt>来源页</dt>
                      <dd>{detail.source_page}</dd>
                    </div>
                  )}
                  <div>
                    <dt>提交时间</dt>
                    <dd>{detail.created_at?.slice(0, 16).replace("T", " ") ?? "—"}</dd>
                  </div>
                  {detail.note && (
                    <div className="span-2">
                      <dt>备注</dt>
                      <dd>{detail.note}</dd>
                    </div>
                  )}
                  {detail.content && (
                    <div className="span-2">
                      <dt>内容</dt>
                      <dd>{detail.content}</dd>
                    </div>
                  )}
                </dl>

                {/* 沟通时间线（threads） */}
                <h3 className="section-title">沟通记录</h3>
                {detail.threads.length === 0 ? (
                  <p className="hint">暂无沟通记录 —— 通过下方表单追加第一条。</p>
                ) : (
                  <ol className="thread-timeline">
                    {detail.threads.map((t: ThreadItem) => (
                      <li key={t.id}>
                        <span className={`thread-dot thread-${t.type}`} />
                        <div className="thread-body">
                          <div className="thread-meta">
                            <span className="thread-type">
                              {THREAD_TYPES.find((x) => x.key === t.type)?.label ?? t.type}
                            </span>
                            <span className="thread-author">{t.author || "staff"}</span>
                            <span className="thread-time">
                              {t.created_at?.slice(0, 16).replace("T", " ") ?? "—"}
                            </span>
                          </div>
                          <p className="thread-content">{t.content}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {/* 追加沟通表单 */}
                <AppendThreadForm onAppend={doThread} />

                {/* 状态流转 */}
                <h3 className="section-title">状态流转</h3>
                <div className="status-actions">
                  {NEXT_STATUS[detail.status]?.length ? (
                    NEXT_STATUS[detail.status].map((s) => (
                      <button
                        key={s}
                        className={`btn btn-ink`}
                        onClick={() => doStatus(detail.id, s)}
                      >
                        转为 {STATUS_LABEL[s] ?? s}
                      </button>
                    ))
                  ) : (
                    <span className="hint">该状态为终态，不可再流转。</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="hint drawer-loading">加载中…</p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

/** 追加沟通记录表单（type 单选 + 内容 + 提交） */
function AppendThreadForm({ onAppend }: { onAppend: (type: string, content: string) => void }) {
  const [type, setType] = useState("phone");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    onAppend(type, content.trim());
    setContent("");
    // 异步提示由父级 notice 驱动；简单延时恢复 busy
    setTimeout(() => setBusy(false), 400);
  }

  return (
    <form onSubmit={submit} className="thread-form">
      <div className="thread-type-row">
        {THREAD_TYPES.map((t) => (
          <label key={t.key} className={`type-radio ${type === t.key ? "active" : ""}`}>
            <input
              type="radio"
              name="thread-type"
              value={t.key}
              checked={type === t.key}
              onChange={() => setType(t.key)}
            />
            {t.label}
          </label>
        ))}
      </div>
      <div className="thread-input-row">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录本次沟通内容（只追加不可删）"
          maxLength={500}
        />
        <button type="submit" className="btn btn-ink" disabled={busy || !content.trim()}>
          {busy ? "追加中…" : "追加"}
        </button>
      </div>
    </form>
  );
}