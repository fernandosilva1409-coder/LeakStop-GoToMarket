import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";
import WidgetChart from "../../components/ui/WidgetChart";
import { fetchAllRows } from "../../lib/supabaseUtils";

function WidgetCard({ widget, t, currency, onDelete }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-heading" title={widget.title}>{widget.title}</p>
        <button type="button" onClick={onDelete} className="shrink-0 text-muted hover:text-danger-text">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-4">
        <WidgetChart toolName={widget.tool_name} toolInput={widget.tool_input} data={widget.data} currency={currency} labels={t} />
      </div>
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
      const data = await fetchAllRows(() =>
        supabase.from("analytics_widgets").select("*").eq("restaurant_id", restaurant.id).order("created_at", { ascending: false })
      );
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
