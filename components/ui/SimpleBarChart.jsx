import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatMoney, num } from "../../lib/calculations";
import { paletteColor } from "../../lib/chartColors";

const COUNT_OPTIONS = ["5", "10", "all"];

// The bar-chart rendering half of WidgetChart, pulled out so pages that need
// a standalone chart (not tied to a chat tool call) can reuse the same look.
//
// `categorical` switches each bar to a distinct color from CHART_PALETTE
// (plus a legend) — use it when bars represent independent entities
// (ingredients, dishes, categories, conditions…). Leave it off for a single
// time-ordered series (e.g. a monthly trend), where one accent color reads
// correctly and multi-color would falsely imply grouping.
//
// `showCountFilter` adds a self-contained Top 5/10/All pill row — only
// meaningful (and only shown) for categorical charts with enough bars to
// need trimming; a chronological series must never be re-sorted/truncated
// by value, so the caller opts in explicitly rather than this being
// automatic. Callers that already have their own external count control
// (e.g. the Dashboard waste chart) should leave this off.
export default function SimpleBarChart({ items, valueLabel, money, pct, currency, height = 200, categorical = false, showCountFilter = false, countLabels }) {
  const [topN, setTopN] = useState("10");

  const sorted = useMemo(
    () => (categorical ? [...(items || [])].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)) : (items || [])),
    [items, categorical]
  );
  const canFilter = showCountFilter && categorical && sorted.length > 8;
  const visible = canFilter && topN !== "all" ? sorted.slice(0, Number(topN)) : sorted;

  // Values arriving here are often raw float sums (e.g. 1806.7442137310775
  // from repeated cost accumulation) — recharts' auto tick generator can
  // produce garbage axis labels from that much floating-point noise, so
  // round to cents/whole units once, at the chart boundary, before it ever
  // reaches recharts' scale math.
  const safeItems = useMemo(
    () => visible.map((it) => ({ ...it, value: Math.round((Number(it.value) || 0) * 100) / 100 })),
    [visible]
  );

  const yDomain = useMemo(() => {
    const values = safeItems.map((it) => it.value);
    return [Math.min(0, ...values), Math.max(0, ...values)];
  }, [safeItems]);

  if (safeItems.length === 0) return <p className="text-sm text-muted">—</p>;

  const formatValue = (v) => (money ? formatMoney(v, currency) : pct ? `${num(v, 0)}%` : num(v, 0));
  const countLabel = (key) => countLabels?.[key === "all" ? "topAll" : `top${key}`] || (key === "all" ? "All" : `Top ${key}`);

  return (
    <div className="min-w-0">
      {canFilter && (
        <div className="mb-2 flex justify-end gap-1.5">
          {COUNT_OPTIONS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTopN(key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                topN === key ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-sunken text-muted hover:text-heading"
              }`}
            >
              {countLabel(key)}
            </button>
          ))}
        </div>
      )}
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
