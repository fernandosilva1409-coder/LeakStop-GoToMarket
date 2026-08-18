import { useEffect, useState } from "react";
import { ChefHat, Users, MoreHorizontal, Building2, Zap, Droplet, CircleDollarSign } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";
import Field from "../../components/ui/Field";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

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
    <PageShell lang={lang} className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-heading">{t.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.subtitle}</p>

      {loading ? (
        <p className="mt-6 text-sm text-muted">{dash.common.loading}</p>
      ) : (
        <Card className="mt-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FIELD_KEYS.map((f) => (
                <Field key={f.key} label={t.fields[f.key]} icon={f.icon}>
                  <Input
                    type="number" step="0.01" value={values[f.key]}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                </Field>
              ))}
            </div>

            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-heading">{t.distributionMethod}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button" onClick={() => setMethod("even")}
                  className={`rounded-xl border p-3.5 text-left transition-colors ${method === "even" ? "border-brass bg-brass/10" : "border-surface-border hover:border-brass/50"}`}
                >
                  <p className="text-sm font-semibold text-heading">{t.evenTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{t.evenDesc}</p>
                </button>
                <button
                  type="button" onClick={() => setMethod("prepTime")}
                  className={`rounded-xl border p-3.5 text-left transition-colors ${method === "prepTime" ? "border-brass bg-brass/10" : "border-surface-border hover:border-brass/50"}`}
                >
                  <p className="text-sm font-semibold text-heading">{t.prepTimeTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{t.prepTimeDesc}</p>
                </button>
              </div>
            </div>

            <p className="mt-6 font-mono text-lg font-bold text-heading">
              {t.monthlyTotal} {monthlyTotal.toFixed(2)} {restaurant.currency}
            </p>

            {saveError && <p className="mt-2 text-sm text-danger-text">{saveError}</p>}
            {saved && <p className="mt-2 text-sm text-good">{dash.common.saved}</p>}
            <Button type="submit" disabled={saving} className="mt-4">
              {saving ? dash.common.saving : dash.common.save}
            </Button>
          </form>
        </Card>
      )}
    </PageShell>
  );
}
