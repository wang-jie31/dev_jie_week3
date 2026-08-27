/**
 * PageSizeSelect —— 每页条数选择器（2026-08-27 功能补全）
 *
 * 用户需求：分页管理要能自己选择每页显示几条（5/10/20/50 每页）。
 * 用法：
 * ```tsx
 * <PageSizeSelect value={pageSize} onChange={(n) => { setPageSize(n); setPage(1); }} />
 * ```
 * 复用 admin.css 的 .sel 样式，与筛选下拉框视觉一致。
 */

const OPTIONS = [5, 10, 20, 50]; // 可选每页条数

interface Props {
  value: number; // 当前每页条数
  onChange: (size: number) => void; // 切换回调（页面负责重置 page=1）
}

export default function PageSizeSelect({ value, onChange }: Props) {
  return (
    <label className="page-size-select" title="每页显示条数">
      <span className="hint">每页</span>
      <select
        className="sel sel-page-size"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n} 条
          </option>
        ))}
      </select>
    </label>
  );
}
