/**
 * 登录日志页（S-30，全员可见：admin/sales/design/cs）
 *
 * - 分页表格：时间/账号/姓名/IP/设备（UA）
 * - 导出 CSV：/login-logs/export 返回 {csv}，创建 Blob 下载（UTF-8 BOM 保证 Excel 中文不乱码）
 */
import { useCallback, useEffect, useState } from "react";
import { orgApi, BizError } from "../lib/api";
import type { LoginLogItem } from "../lib/api";
import PageSizeSelect from "../components/PageSizeSelect"; // 每页条数选择器（5/10/20/50）

export default function LoginLogsPage() {
  const [items, setItems] = useState<LoginLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20); // 每页条数（可切换 5/10/20/50）
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await orgApi.loginLogs({ page, page_size: pageSize });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof BizError ? e.message : "加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function doExport() {
    try {
      const res = await orgApi.exportLoginLogs();
      const blob = new Blob(["\ufeff" + res.csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `login-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("登录日志已导出（含 UTF-8 BOM，Excel 可直接打开）");
    } catch (e) {
      setNotice(e instanceof BizError ? e.message : "导出失败");
    }
  }

  return (
    <>
      <header className="admin-header">
        <h1>登录日志</h1>
        <div className="header-actions">
          <span className="hint">共 {total} 条</span>
          <button className="btn btn-ink" onClick={doExport}>
            导出 CSV
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {notice && <p className="notice-line">{notice}</p>}

      <div className="panel table-panel">
        {loading && items.length === 0 ? (
          <p className="hint">加载中…</p>
        ) : items.length === 0 ? (
          <p className="hint">暂无登录记录。</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>登录时间</th>
                <th>账号</th>
                <th>姓名</th>
                <th>IP 地址</th>
                <th>设备（User-Agent）</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => (
                <tr key={log.id}>
                  <td className="log-time">
                    {log.login_time ? new Date(log.login_time).toLocaleString() : "—"}
                  </td>
                  <td className="td-main">{log.username || "—"}</td>
                  <td>{log.name || "—"}</td>
                  <td className="td-phone">{log.ip || "—"}</td>
                  <td className="log-ua">{log.user_agent || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pager">
        <PageSizeSelect
          value={pageSize}
          onChange={(n) => {
            setPageSize(n);
            setPage(1); // 切换每页条数后回到第一页（loadList 依赖 pageSize 自动重载）
          }}
        />
        <span className="pager-info">
          第 {page} 页 / 共 {Math.max(1, Math.ceil(total / pageSize))} 页
        </span>
        <div className="pager-btns">
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          <button
            className="btn"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    </>
  );
}