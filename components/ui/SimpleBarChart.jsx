import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatMoney, num } from "../../lib/calculations";

// The bar-chart rendering half of WidgetChart, pulled out so pages that need
// a standalone chart (not tied to a chat tool call) can reuse the same look.
export default function SimpleBarChart({ items, valueLabel, money, pct, currency, height = 200 }) {
  const yDomain = useMemo(() => {
    const values = items.map((it) => it.value);
    return [Math.min(0, ...values), Math.max(0, ...values)];
  }, [items]);

  if (!items || items.length === 0) return <p className="text-sm text-muted">—</p>;

  return (
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={items} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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
            formatter={(v) => (money ? formatMoney(v, currency) : pct ? `${num(v, 0)}%` : num(v, 0))}
          />
          <Bar dataKey="value" isAnimationActive={false}>
            {items.map((_, i) => <Cell key={i} fill="#C99A3D" />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {valueLabel && <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-wide text-muted">{valueLabel}</p>}
    </div>
  );
}
