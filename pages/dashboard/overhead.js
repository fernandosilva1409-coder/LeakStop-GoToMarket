import { useEffect, useState } from "react";
import { ChefHat, Users, MoreHorizontal, Building2, Zap, Droplet, CircleDollarSign } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import DashboardNav from "../../components/DashboardNav";

const FIELD_KEYS = [
  { key: "kitchen_labor", icon: ChefHat },
  { key: "table_labor", icon: Users },
  { key: "other_labor", icon: MoreHorizontal },
  { key: "payroll_tax", icon: CircleDollarSign },
  { key: "building_cost", icon: Building2 },
  { key: "energy_cost", icon: Zap },
  { key: "gas_cost", icon: Zap },
  { key: "water_cost", icon: Droplet },
  { key: "waste_collection", icon: MoreHorizontal },
  { key: "cleaning_supplies", icon: MoreHorizontal },
  { key: "software_admin", icon: CircleDollarSign },
  { key: "other_cost", icon: CircleDollarSign },
];

const emptyValues = () => Object.fromEntries(FIELD_KEYS.map((f) => [f.key, ""]));

export default function OverheadPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [values, setValues] = useState(emptyValues());
  const [method, setMethod] = useState("even");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.overhead;

  useEffect(() => {
    if (!restaurant) return;
    (async () => {
      const { data } = await supabase.from("overhead_settings").select("*").eq("restaurant_id", restaurant.id).single();
      if (data) {
        setValues(Object.fromEntries(FIELD_KEYS.map((f) => [f.key, data[f.key] ?? 0])));
        setMethod(data.method || "even");
      }
      setLoading(false);
    })();
  }, [restaurant]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaved(false);
    const payload = {
      restaurant_id: restaurant.id, method,
      updated_at: new Date().toISOString(),
      ...Object.fromEntries(FIELD_KEYS.map((f) => [f.key, Number(values[f.key]) || 0])),
    };
    const { error } = await supabase.from("overhead_settings").upsert(payload, { onConflict: "restaurant_id" });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setSaved(true);
  };

  const monthlyTotal = FIELD_KEYS.reduce((sum, f) => sum + (Number(values[f.key]) || 0), 0);

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  return (
    <div className="min-h-screen bg-ink-bg">
      <DashboardNav lang={lang} />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-paper">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>

        {loading ? (
          <p className="mt-6 text-sm text-muted">{dash.common.loading}</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-ink-border bg-ink-panel p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FIELD_KEYS.map((f) => (
                <label key={f.key} className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <f.icon size={13} /> {t.fields[f.key]}
                  </span>
                  <input
                    type="number" step="0.01" value={values[f.key]}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper focus:border-brass focus:outline-none"
                  />
                </label>
              ))}
            </div>

            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-paper">{t.distributionMethod}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button" onClick={() => setMethod("even")}
                  className={`rounded-lg border p-3.5 text-left ${method === "even" ? "border-brass bg-brass/10" : "border-ink-border2 hover:border-faint"}`}
                >
                  <p className="text-sm font-semibold text-paper">{t.evenTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{t.evenDesc}</p>
                </button>
                <button
                  type="button" onClick={() => setMethod("prepTime")}
                  className={`rounded-lg border p-3.5 text-left ${method === "prepTime" ? "border-brass bg-brass/10" : "border-ink-border2 hover:border-faint"}`}
                >
                  <p className="text-sm font-semibold text-paper">{t.prepTimeTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{t.prepTimeDesc}</p>
                </button>
              </div>
            </div>

            <p className="mt-6 font-mono text-lg font-bold text-paper">
              {t.monthlyTotal} {monthlyTotal.toFixed(2)} {restaurant.currency}
            </p>

            {saveError && <p className="mt-2 text-sm text-danger-text">{saveError}</p>}
            {saved && <p className="mt-2 text-sm text-good">{dash.common.saved}</p>}
            <button
              type="submit" disabled={saving}
              className="mt-4 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60"
            >
              {saving ? dash.common.saving : dash.common.save}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
