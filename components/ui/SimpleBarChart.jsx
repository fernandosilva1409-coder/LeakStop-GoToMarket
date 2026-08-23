import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatMoney, num } from "../../lib/calculations";
import { paletteColor } from "../../lib/chartColors";

// The bar-chart rendering half of WidgetChart, pulled out so pages that need
// a standalone chart (not tied to a chat tool call) can reuse the same look.
//
// `categorical` switches each bar to a distinct color from CHART_PALETTE
// (plus a legend) — use it when bars represent independent entities
// (ingredients, dishes, categories, conditions…). Leave it off for a single
// time-ordered series (e.g. a monthly trend), where one accent color reads
// correctly and multi-color would falsely imply grouping.
export default function SimpleBarChart({ items, valueLabel, money, pct, currency, height = 200, categorical = false }) {
  // Values arriving here are often raw float sums (e.g. 1806.7442137310775
  // from repeated cost accumulation) — recharts' auto tick generator can
  // produce garbage axis labels from that much floating-point noise, so
  // round to cents/whole units once, at the chart boundary, before it ever
  // reaches recharts' scale math.
  const safeItems = useMemo(
    () => (items || []).map((it) => ({ ...it, value: Math.round((Number(it.value) || 0) * 100) / 100 })),
    [items]
  );

  const yDomain = useMemo(() => {
    const values = safeItems.map((it) => it.value);
    return [Math.min(0, ...values), Math.max(0, ...values)];
  }, [safeItems]);

  if (safeItems.length === 0) return <p className="text-sm text-muted">—</p>;

  const formatValue = (v) => (money ? formatMoney(v, currency) : pct ? `${num(v, 0)}%` : num(v, 0));

  return (
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={safeItems} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E4DA" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#8B897A", fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}
            axisLine={{ stroke: "#E7E4DA" }} tickLine={false}
            interval={0} angle={-20} textAnchor="end" height={50}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: "#8B897A", fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }} axisLine={{ stroke: "#E7E4DA" }} tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E7E4DA", borderRadius: 8, fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}
            labelStyle={{ color: "#26251C" }}
            formatter={formatValue}
          />
          <Bar dataKey="value" isAnimationActive={false}>
            {safeItems.map((_, i) => <Cell key={i} fill={categorical ? paletteColor(i) : "#C99A3D"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {valueLabel && <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-wide text-muted">{valueLabel}</p>}
      {categorical && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
          {safeItems.map((it, i) => (
            <span key={it.label} className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: paletteColor(i) }} />
              {it.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
