/**
 * 工作台概览看板（S-24，§9 数据可视化）
 *
 * 数据：GET /api/v1/admin/overview（S-21 聚合）
 * - KPI 卡 8 项（含环比 delta 上下箭头）
 * - 北极星指标卡（本月有效线索）
 * - 项目 9 态环形图（§9.1 配色，SVG 自包含）
 * - 近 6 月双序列柱状图（项目绿 #3C8C4E / 预约蓝 #2F6DB5）
 * - 设计师项目排行横向条（深墨 #4A3F30）
 * - 全图无第三方图表库，空态均有文案
 */
import { useEffect, useState } from "react";
import { deliveryApi, BizError } from "../lib/api";
import type { OverviewData } from "../lib/api";

const STATUS_COLORS: Record<string, string> = {
  lead: "#9A8C75",
  measuring: "#2F6DB5",
  designing: "#7E57C2",
  quoting: "#E0A458",
  signed: "#3C8C4E",
  constructing: "#C0732B",
  acceptance: "#2F8F9D",
  done: "#4A3F30",
  cancelled: "#C0392B",
};

const STATUS_LABEL: Record<string, string> = {
  lead: "线索",
  measuring: "量房",
  designing: "设计",
  quoting: "报价",
  signed: "签约",
  constructing: "施工",
  acceptance: "验收",
  done: "完成",
  cancelled: "取消",
};

interface KpiDef {
  key: string;
  label: string;
  deltaKey?: string;
}

const KPI_DEFS: KpiDef[] = [
  { key: "projects_total", label: "项目总数" },
  { key: "projects_active", label: "进行中项目" },
  { key: "cases_total", label: "案例数", deltaKey: "cases_delta" },
  { key: "packages_total", label: "套餐数" },
  { key: "messages_total", label: "留言总数", deltaKey: "messages_delta" },
  { key: "team_count", label: "团队成员" },
  { key: "sites_count", label: "在建工地" },
];

export default function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await deliveryApi.overview());
      } catch (e) {
        setError(e instanceof BizError ? e.message : "看板加载失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <>
        <header className="admin-header">
          <h1>工作台</h1>
        </header>
        <p className="hint">看板加载中…</p>
      </>
    );
  }

  const kpi = data?.kpi ?? {};
  const north = data?.north_star?.valid_leads_this_month ?? 0;
  const projDist = data?.project_status_dist ?? [];
  const trend = data?.trend_6m ?? [];
  const rank = data?.designer_rank ?? [];
  const projTotal = projDist.reduce((s, d) => s + (d.count ?? 0), 0);

  return (
    <>
      <header className="admin-header">
        <h1>工作台</h1>
        <span className="hint">交付域 · 概览看板</span>
      </header>

      {error && <p className="error-banner">{error}</p>}

      {/* KPI 卡 */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-star">
          <div className="kpi-label">北极星 · 本月有效线索</div>
          <div className="kpi-value">{north}</div>
        </div>
        {KPI_DEFS.map((k) => {
          const v = kpi[k.key] ?? 0;
          const d = k.deltaKey ? (kpi[k.deltaKey] ?? 0) : null;
          return (
            <div key={k.key} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{v}</div>
              {d !== null && (
                <div className={`kpi-delta ${d >= 0 ? "up" : "down"}`}>
                  {d >= 0 ? "▲" : "▼"} 环比 {Math.abs(d)} 本月
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 图表区 */}
      <div className="chart-grid">
        {/* 项目 9 态环形图 */}
        <div className="panel chart-panel">
          <h2 className="chart-title">项目状态分布</h2>
          <div className="donut-wrap">
            {projTotal === 0 ? (
              <p className="hint chart-empty">暂无项目数据</p>
            ) : (
              <DonutChart dist={projDist} total={projTotal} />
            )}
          </div>
        </div>

        {/* 近 6 月趋势 */}
        <div className="panel chart-panel">
          <h2 className="chart-title">近 6 月新增趋势</h2>
          <div className="chart-body">
            <BarChartDual trend={trend} />
          </div>
        </div>

        {/* 设计师排行 */}
        <div className="panel chart-panel">
          <h2 className="chart-title">设计师项目排行</h2>
          <div className="chart-body">
            <DesignerRank rank={rank} />
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- 项目 9 态环形图（§9.1 配色） ---------- */
function DonutChart({ dist, total }: { dist: OverviewData["project_status_dist"]; total: number }) {
  const SIZE = 190;
  const R = 70;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const STROKE = 24;
  const C = 2 * Math.PI * R;

  // 按序渲染：lead → measuring → … → cancelled
  const order = Object.keys(STATUS_COLORS);
  const rows = [...dist].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status)
  );

  let acc = 0;
  const segs = rows.map((d) => {
    const frac = d.count / total;
    const len = frac * C;
    const dash = `0 ${(acc / total) * C} ${len} ${C - len - (acc / total) * C}`;
    acc += d.count;
    return { ...d, frac, dash, color: STATUS_COLORS[d.status] ?? "#9A8C75" };
  });

  return (
    <div className="donut-flex">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="项目状态分布环形图">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f0e9d8" strokeWidth={STROKE} />
        {segs.map((s, i) => (
          <circle
            key={i}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={STROKE}
            strokeDasharray={s.dash}
            transform={`rotate(-90 ${CX} ${CY})`}
            strokeLinecap="butt"
          />
        ))}
        <text x={CX} y={CY - 6} textAnchor="middle" className="donut-total">
          {total}
        </text>
        <text x={CX} y={CY + 14} textAnchor="middle" className="donut-cap">
          项目总数
        </text>
      </svg>
      <ul className="donut-legend">
        {segs.map((s) => (
          <li key={s.status}>
            <span className="dot" style={{ background: s.color }} />
            <span className="lg-label">{STATUS_LABEL[s.status] ?? s.status}</span>
            <span className="lg-num">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- 近 6 月双序列柱状图（项目绿 / 预约蓝） ---------- */
function BarChartDual({ trend }: { trend: OverviewData["trend_6m"] }) {
  const W = 420;
  const H = 200;
  const PAD_L = 30;
  const PAD_B = 28;
  const PAD_T = 16;
  const PAD_R = 8;
  const PLOT_W = W - PAD_L - PAD_R;
  const PLOT_H = H - PAD_T - PAD_B;

  const max = Math.max(1, ...trend.map((t) => Math.max(t.projects, t.appointments)));
  const n = Math.max(1, trend.length);
  const groupW = PLOT_W / n;
  const barW = Math.min(14, groupW * 0.28);

  function y(v: number) {
    return PAD_T + PLOT_H - (v / max) * PLOT_H;
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="近 6 月新增趋势柱状图">
      {/* 网格线 */}
      {[0, 0.5, 1].map((f) => {
        const gy = PAD_T + PLOT_H - f * PLOT_H;
        const label = Math.round(max * f);
        return (
          <g key={f}>
            <line x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} stroke="#eee7d6" strokeDasharray="3 3" />
            <text x={PAD_L - 6} y={gy + 3} textAnchor="end" className="axis-label">
              {label}
            </text>
          </g>
        );
      })}
      {trend.map((t, i) => {
        const gx = PAD_L + i * groupW + groupW / 2;
        return (
          <g key={t.month}>
            <rect x={gx - barW - 2} y={y(t.projects)} width={barW} height={PAD_T + PLOT_H - y(t.projects)} rx={3} fill="#3C8C4E" />
            <rect x={gx + 2} y={y(t.appointments)} width={barW} height={PAD_T + PLOT_H - y(t.appointments)} rx={3} fill="#2F6DB5" />
            <text x={gx} y={H - 8} textAnchor="middle" className="axis-label">
              {t.month.slice(2)}
            </text>
          </g>
        );
      })}
      {/* 图例 */}
      <g>
        <rect x={W - 130} y={6} width={10} height={10} rx={2} fill="#3C8C4E" />
        <text x={W - 116} y={15} className="axis-label">项目</text>
        <rect x={W - 82} y={6} width={10} height={10} rx={2} fill="#2F6DB5" />
        <text x={W - 68} y={15} className="axis-label">预约</text>
      </g>
    </svg>
  );
}

/* ---------- 设计师项目排行横向条（深墨） ---------- */
function DesignerRank({ rank }: { rank: OverviewData["designer_rank"] }) {
  const W = 420;
  const H = Math.max(40, rank.length * 30 + 10);
  const max = Math.max(1, ...rank.map((r) => r.count));
  const BAR_MAX_W = 300;

  if (rank.length === 0) {
    return <p className="hint chart-empty">暂无项目数据</p>;
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="设计师项目排行横向条形图">
      {rank.map((r, i) => {
        const y = 10 + i * 30;
        const bw = (r.count / max) * BAR_MAX_W;
        return (
          <g key={r.designer}>
            <text x={0} y={y + 12} className="rank-label" textAnchor="start">
              {r.designer}
            </text>
            <rect x={130} y={y} width={bw} height={16} rx={3} fill="#4A3F30" />
            <text x={130 + bw + 8} y={y + 12} className="rank-num">
              {r.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}