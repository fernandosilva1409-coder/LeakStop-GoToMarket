import { useEffect, useState } from "react";
import { ChefHat, Users, MoreHorizontal, Building2, Zap, Droplet, CircleDollarSign } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import DashboardNav from "../../components/DashboardNav";

const FIELDS = [
  { key: "kitchen_labor", label: "Mão de obra — cozinha", icon: ChefHat },
  { key: "table_labor", label: "Mão de obra — sala", icon: Users },
  { key: "other_labor", label: "Mão de obra — outra", icon: MoreHorizontal },
  { key: "payroll_tax", label: "Encargos sobre salários", icon: CircleDollarSign },
  { key: "building_cost", label: "Renda / edifício", icon: Building2 },
  { key: "energy_cost", label: "Eletricidade", icon: Zap },
  { key: "gas_cost", label: "Gás", icon: Zap },
  { key: "water_cost", label: "Água", icon: Droplet },
  { key: "waste_collection", label: "Recolha de resíduos", icon: MoreHorizontal },
  { key: "cleaning_supplies", label: "Produtos de limpeza", icon: MoreHorizontal },
  { key: "software_admin", label: "Software / administrativo", icon: CircleDollarSign },
  { key: "other_cost", label: "Outros custos", icon: CircleDollarSign },
];

const emptyValues = () => Object.fromEntries(FIELDS.map((f) => [f.key, ""]));

export default function OverheadPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [values, setValues] = useState(emptyValues());
  const [method, setMethod] = useState("even");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    (async () => {
      const { data } = await supabase.from("overhead_settings").select("*").eq("restaurant_id", restaurant.id).single();
      if (data) {
        setValues(Object.fromEntries(FIELDS.map((f) => [f.key, data[f.key] ?? 0])));
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
      ...Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key]) || 0])),
    };
    const { error } = await supabase.from("overhead_settings").upsert(payload, { onConflict: "restaurant_id" });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setSaved(true);
  };

  const monthlyTotal = FIELDS.reduce((sum, f) => sum + (Number(values[f.key]) || 0), 0);

  if (restaurantLoading) return <p className="p-10 text-muted">A carregar…</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  return (
    <div className="min-h-screen bg-ink-bg">
      <DashboardNav />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-paper">Overhead</h1>
        <p className="mt-1 text-sm text-muted">Custos fixos mensais, usados para calcular a margem completa por prato.</p>

        {loading ? (
          <p className="mt-6 text-sm text-muted">A carregar…</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-ink-border bg-ink-panel p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <label key={f.key} className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <f.icon size={13} /> {f.label}
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
              <p className="mb-2 text-sm font-medium text-paper">Método de distribuição por prato</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button" onClick={() => setMethod("even")}
                  className={`rounded-lg border p-3.5 text-left ${method === "even" ? "border-brass bg-brass/10" : "border-ink-border2 hover:border-faint"}`}
                >
                  <p className="text-sm font-semibold text-paper">Igual por prato vendido</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">O mesmo overhead é somado a cada prato, independentemente do tempo de preparação.</p>
                </button>
                <button
                  type="button" onClick={() => setMethod("prepTime")}
                  className={`rounded-lg border p-3.5 text-left ${method === "prepTime" ? "border-brass bg-brass/10" : "border-ink-border2 hover:border-faint"}`}
                >
                  <p className="text-sm font-semibold text-paper">Proporcional ao tempo de preparação</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">Pratos mais demorados absorvem mais custo de mão de obra e energia.</p>
                </button>
              </div>
            </div>

            <p className="mt-6 font-mono text-lg font-bold text-paper">
              Total mensal: {monthlyTotal.toFixed(2)} {restaurant.currency}
            </p>

            {saveError && <p className="mt-2 text-sm text-danger-text">{saveError}</p>}
            {saved && <p className="mt-2 text-sm text-good">Guardado.</p>}
            <button
              type="submit" disabled={saving}
              className="mt-4 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60"
            >
              {saving ? "A guardar…" : "Guardar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
