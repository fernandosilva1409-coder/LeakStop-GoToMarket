import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatMoney, num } from "../../lib/calculations";
import { paletteColor } from "../../lib/chartColors";

// Donut chart for genuine "share of a whole" data with few slices (category
// revenue split, matrix classification split). Bar charts stay the default
// for longer/ranked lists — pie slices get unreadable past ~6-8 entries.
export default function SimplePieChart({ items, money, pct, currency, height = 220, colors }) {
  if (!items || items.length === 0) return <p className="text-sm text-muted">—</p>;

  // Same rounding guard as SimpleBarChart — protects recharts' internal
  // math from raw high-precision float sums.
  const safeItems = items.map((it) => ({ ...it, value: Math.round((Number(it.value) || 0) * 100) / 100 }));
  const formatValue = (v) => (money ? formatMoney(v, currency) : pct ? `${num(v, 0)}%` : num(v, 0));
  const colorFor = (i) => (colors ? colors[i % colors.length] : paletteColor(i));

  return (
    <div className="flex min-w-0 flex-col items-center gap-3 sm:flex-row">
      <ResponsiveContainer width="100%" height={height} className="min-w-0 flex-1">
        <PieChart>
          <Pie data={safeItems} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="85%" paddingAngle={2} isAnimationActive={false}>
            {safeItems.map((_, i) => <Cell key={i} fill={colorFor(i)} stroke="#FFFFFF" strokeWidth={2} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E7E4DA", borderRadius: 8, fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}
            labelStyle={{ color: "#26251C" }}
            formatter={formatValue}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex shrink-0 flex-col gap-1.5 sm:min-w-[140px]">
        {safeItems.map((it, i) => (
          <div key={it.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(i) }} />
            <span className="min-w-0 flex-1 truncate text-heading">{it.label}</span>
            <span className="shrink-0 font-mono text-muted">{formatValue(it.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
