import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "../../lib/supabaseClient";
import { formatMoney, num } from "../../lib/calculations";
import { useRestaurant } from "../../lib/useRestaurant";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import { normalizeWidget } from "../../lib/widgetChart";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";

function WidgetCard({ widget, t, currency, onDelete }) {
  const normalized = normalizeWidget(widget.tool_name, widget.tool_input, widget.data);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-heading" title={widget.title}>{widget.title}</p>
        <button type="button" onClick={onDelete} className="shrink-0 text-muted hover:text-danger-text">
          <Trash2 size={15} />
        </button>
      </div>

      {normalized.kind === "kpis" && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {normalized.items.map((it) => (
            <div key={it.label} className="rounded-xl bg-surface-sunken px-3 py-2.5">
              <p className="truncate font-mono text-[10px] uppercase tracking-wide text-muted">{t.kpiLabels[it.label] || it.label}</p>
              <p className="mt-0.5 font-mono text-lg font-bold text-heading">
                {it.money ? formatMoney(it.value, currency) : it.pct ? `${num(it.value, 0)}%` : num(it.value, 0)}
              </p>
            </div>
          ))}
        </div>
      )}

      {normalized.kind === "bar" && normalized.items.length > 0 && (
        <div className="mt-4 min-w-0">
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
                domain={[(min) => Math.min(0, min), (max) => Math.max(0, max)]}
                tick={{ fill: "#8B897A", fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }} axisLine={{ stroke: "#E7E4DA" }} tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: "#FFFFFF", border: "1px solid #E7E4DA", borderRadius: 8, fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}
                labelStyle={{ color: "#26251C" }}
                formatter={(v) => (normalized.money ? formatMoney(v, currency) : normalized.pct ? `${num(v, 0)}%` : num(v, 0))}
              />
              <Bar dataKey="value">
                {normalized.items.map((_, i) => <Cell key={i} fill="#C99A3D" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-wide text-muted">
            {t.barValueLabels[normalized.valueLabel] || normalized.valueLabel}
          </p>
        </div>
      )}

      {normalized.kind === "list" && (
        normalized.items.length > 0 ? (
          <ul className="mt-4 space-y-1.5 text-sm text-heading">
            {normalized.items.map((it, i) => (
              <li key={i}><strong className="font-semibold">{it.label}:</strong> <span className="text-muted">{it.detail}</span></li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">—</p>
        )
      )}

      {normalized.kind === "raw" && <p className="mt-4 text-sm text-muted">—</p>}
    </Card>
  );
}

export default function AnalyticsPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.analytics;
  const currency = restaurant?.currency || "EUR";

  useEffect(() => {
    if (!restaurant) return;
    (async () => {
      const { data } = await supabase
        .from("analytics_widgets")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false });
      setWidgets(data || []);
      setLoading(false);
    })();
  }, [restaurant]);

  const handleDelete = async (id) => {
    if (!window.confirm(t.deleteConfirm)) return;
    await supabase.from("analytics_widgets").delete().eq("id", id);
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  return (
    <PageShell lang={lang}>
      <h1 className="text-2xl font-bold text-heading">{t.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.subtitle}</p>

      {loading ? (
        <p className="mt-6 text-sm text-muted">{dash.common.loading}</p>
      ) : widgets.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t.emptyState}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {widgets.map((w) => (
            <WidgetCard key={w.id} widget={w} t={t} currency={currency} onDelete={() => handleDelete(w.id)} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
