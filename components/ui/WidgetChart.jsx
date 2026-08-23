import { useMemo } from "react";
import { formatMoney, num } from "../../lib/calculations";
import { normalizeWidget } from "../../lib/widgetChart";
import SimpleBarChart from "./SimpleBarChart";

// Renders a Chat with Your Data tool result (name + input + output) as a
// KPI grid, bar chart, or plain list — shared by the inline chat preview
// and the pinned cards on the Analytics page so both stay visually identical.
export default function WidgetChart({ toolName, toolInput, data, currency, labels }) {
  const normalized = useMemo(() => normalizeWidget(toolName, toolInput, data), [toolName, toolInput, data]);

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
      <SimpleBarChart
        items={normalized.items}
        money={normalized.money}
        pct={normalized.pct}
        currency={currency}
        categorical={normalized.categorical}
        valueLabel={labels.barValueLabels[normalized.valueLabel] || normalized.valueLabel}
      />
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
