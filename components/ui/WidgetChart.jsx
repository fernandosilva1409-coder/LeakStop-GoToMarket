import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatMoney, num } from "../../lib/calculations";
import { normalizeWidget } from "../../lib/widgetChart";

// Renders a Chat with Your Data tool result (name + input + output) as a
// KPI grid, bar chart, or plain list — shared by the inline chat preview
// and the pinned cards on the Analytics page so both stay visually identical.
export default function WidgetChart({ toolName, toolInput, data, currency, labels }) {
  const normalized = useMemo(() => normalizeWidget(toolName, toolInput, data), [toolName, toolInput, data]);
  const yDomain = useMemo(() => {
    if (normalized.kind !== "bar") return undefined;
    const values = normalized.items.map((it) => it.value);
    return [Math.min(0, ...values), Math.max(0, ...values)];
  }, [normalized]);

  if (normalized.kind === "kpis") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {normalized.items.map((it) => (
          <div key={it.label} className="rounded-xl bg-surface-sunken px-3 py-2.5">
            <p className="truncate font-mono text-[10px] uppercase tracking-wide text-muted">{labels.kpiLabels[it.label] || it.label}</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-heading">
              {it.money ? formatMoney(it.value, currency) : it.pct ? `${num(it.value, 0)}%` : num(it.value, 0)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (normalized.kind === "bar" && normalized.items.length > 0) {
    return (
      <div className="min-w-0">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={normalized.items} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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
              formatter={(v) => (normalized.money ? formatMoney(v, currency) : normalized.pct ? `${num(v, 0)}%` : num(v, 0))}
            />
            <Bar dataKey="value" isAnimationActive={false}>
              {normalized.items.map((_, i) => <Cell key={i} fill="#C99A3D" />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-wide text-muted">
          {labels.barValueLabels[normalized.valueLabel] || normalized.valueLabel}
        </p>
      </div>
    );
  }

  if (normalized.kind === "list" && normalized.items.length > 0) {
    return (
      <ul className="space-y-1.5 text-sm text-heading">
        {normalized.items.map((it, i) => (
          <li key={i}><strong className="font-semibold">{it.label}:</strong> <span className="text-muted">{it.detail}</span></li>
        ))}
      </ul>
    );
  }

  return <p className="text-sm text-muted">—</p>;
}
