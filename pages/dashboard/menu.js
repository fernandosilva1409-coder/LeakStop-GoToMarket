import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { Plus, X, Pencil, Trash2, Upload } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import DashboardNav from "../../components/DashboardNav";
import { formatMoney } from "../../lib/calculations";

const EMPTY_FORM = { id: null, name: "", category: "", price: "", prepTime: "", ingredients: [{ name: "", qty: "", unit: "g" }] };
const INPUT = "rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none";

export default function MenuPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [csvStatus, setCsvStatus] = useState("");
  const fileInputRef = useRef(null);

  const loadDishes = async (restaurantId) => {
    const [{ data: dishRows }, { data: ingredientRows }] = await Promise.all([
      supabase.from("dishes").select("*").eq("restaurant_id", restaurantId).order("name"),
      supabase.from("dish_ingredients").select("*"),
    ]);
    const byDish = {};
    (ingredientRows || []).forEach((ing) => {
      byDish[ing.dish_id] = byDish[ing.dish_id] || [];
      byDish[ing.dish_id].push(ing);
    });
    setDishes((dishRows || []).map((d) => ({ ...d, ingredients: byDish[d.id] || [] })));
    setLoading(false);
  };

  useEffect(() => {
    if (restaurant) loadDishes(restaurant.id);
  }, [restaurant]);

  const startEdit = (dish) => {
    setFormError("");
    setForm({
      id: dish.id, name: dish.name, category: dish.category || "",
      price: dish.price, prepTime: dish.prep_time ?? "",
      ingredients: dish.ingredients.length
        ? dish.ingredients.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit }))
        : [{ name: "", qty: "", unit: "g" }],
    });
  };

  const resetForm = () => { setForm(EMPTY_FORM); setFormError(""); };

  const updateIngredient = (idx, field, value) => {
    setForm((f) => {
      const ingredients = f.ingredients.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing));
      return { ...f, ingredients };
    });
  };
  const addIngredientRow = () => setForm((f) => ({ ...f, ingredients: [...f.ingredients, { name: "", qty: "", unit: "g" }] }));
  const removeIngredientRow = (idx) => setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("O nome do prato é obrigatório."); return; }
    setSaving(true);
    setFormError("");

    const ingredients = form.ingredients.filter((i) => i.name.trim());
    const payload = {
      restaurant_id: restaurant.id, name: form.name.trim(), category: form.category.trim() || null,
      price: Number(form.price) || 0, prep_time: form.prepTime === "" ? null : Number(form.prepTime),
      updated_at: new Date().toISOString(),
    };

    let dishId = form.id;
    if (dishId) {
      const { error } = await supabase.from("dishes").update(payload).eq("id", dishId);
      if (error) { setFormError(error.message); setSaving(false); return; }
      await supabase.from("dish_ingredients").delete().eq("dish_id", dishId);
    } else {
      const { data, error } = await supabase.from("dishes").insert(payload).select().single();
      if (error) { setFormError(error.message); setSaving(false); return; }
      dishId = data.id;
    }

    if (ingredients.length) {
      const rows = ingredients.map((i) => ({ dish_id: dishId, name: i.name.trim(), qty: Number(i.qty) || 0, unit: i.unit || "g" }));
      const { error } = await supabase.from("dish_ingredients").insert(rows);
      if (error) { setFormError(error.message); setSaving(false); return; }
    }

    setSaving(false);
    resetForm();
    loadDishes(restaurant.id);
  };

  const handleDelete = async (dish) => {
    await supabase.from("dishes").delete().eq("id", dish.id);
    if (form.id === dish.id) resetForm();
    loadDishes(restaurant.id);
  };

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvStatus("A importar…");
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data, errors }) => {
        if (errors.length) { setCsvStatus(`Erro a ler o CSV: ${errors[0].message}`); return; }
        await importCsvRows(data);
      },
    });
  };

  // Expected columns: dish, category, price, prep_time, ingredient, qty, unit
  // One row per ingredient — dish-level columns repeated on every row for that dish.
  const importCsvRows = async (rows) => {
    const byDish = {};
    rows.forEach((r) => {
      const name = (r.dish || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      byDish[key] = byDish[key] || {
        name, category: (r.category || "").trim() || null,
        price: Number(r.price) || 0, prepTime: r.prep_time === "" || r.prep_time == null ? null : Number(r.prep_time),
        ingredients: [],
      };
      const ingName = (r.ingredient || "").trim();
      if (ingName) byDish[key].ingredients.push({ name: ingName, qty: Number(r.qty) || 0, unit: (r.unit || "g").trim() });
    });

    const existingByName = {};
    dishes.forEach((d) => { existingByName[d.name.toLowerCase()] = d; });

    let imported = 0;
    for (const key of Object.keys(byDish)) {
      const group = byDish[key];
      const existing = existingByName[key];
      const payload = {
        restaurant_id: restaurant.id, name: group.name, category: group.category,
        price: group.price, prep_time: group.prepTime, updated_at: new Date().toISOString(),
      };
      let dishId;
      if (existing) {
        dishId = existing.id;
        await supabase.from("dishes").update(payload).eq("id", dishId);
        await supabase.from("dish_ingredients").delete().eq("dish_id", dishId);
      } else {
        const { data } = await supabase.from("dishes").insert(payload).select().single();
        dishId = data.id;
      }
      if (group.ingredients.length) {
        const ingRows = group.ingredients.map((i) => ({ dish_id: dishId, name: i.name, qty: i.qty, unit: i.unit }));
        await supabase.from("dish_ingredients").insert(ingRows);
      }
      imported++;
    }
    setCsvStatus(`${imported} prato(s) importado(s).`);
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadDishes(restaurant.id);
  };

  if (restaurantLoading) return <p className="p-10 text-muted">A carregar…</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  return (
    <div className="min-h-screen bg-ink-bg">
      <DashboardNav />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-paper">Menu</h1>

        <div className="mt-6 rounded-xl border border-dashed border-ink-border2 bg-ink-panel p-5">
          <p className="font-semibold text-paper">Importar CSV</p>
          <p className="mt-1 font-mono text-[11.5px] text-muted">
            Colunas esperadas: dish, category, price, prep_time, ingredient, qty, unit — uma linha por
            ingrediente, com os campos do prato repetidos em cada linha. Pratos com o mesmo nome são atualizados.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button" onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-1.5 rounded-lg border border-ink-border2 px-3 py-1.5 text-sm font-semibold text-paper hover:border-brass hover:text-brass"
            >
              <Upload size={15} /> Escolher ficheiro
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
          </div>
          {csvStatus && <p className="mt-2 text-sm text-muted">{csvStatus}</p>}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-ink-border bg-ink-panel p-5">
          <p className="font-semibold text-paper">{form.id ? "Editar prato" : "Novo prato"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input placeholder="Nome do prato" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={`${INPUT} min-w-[160px] flex-[2]`} />
            <input placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${INPUT} min-w-[120px] flex-1`} />
            <input placeholder="Preço" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={`${INPUT} w-24`} />
            <input placeholder="Tempo prep. (min)" type="number" step="0.5" value={form.prepTime} onChange={(e) => setForm({ ...form, prepTime: e.target.value })} className={`${INPUT} w-36`} />
          </div>

          <p className="mb-1 mt-4 font-mono text-[11px] uppercase tracking-wide text-muted">Ingredientes</p>
          {form.ingredients.map((ing, idx) => (
            <div key={idx} className="mb-1.5 flex gap-2">
              <input placeholder="Ingrediente" value={ing.name} onChange={(e) => updateIngredient(idx, "name", e.target.value)} className={`${INPUT} flex-[2]`} />
              <input placeholder="Qtd" type="number" step="0.001" value={ing.qty} onChange={(e) => updateIngredient(idx, "qty", e.target.value)} className={`${INPUT} w-24`} />
              <select value={ing.unit} onChange={(e) => updateIngredient(idx, "unit", e.target.value)} className={`${INPUT} w-24`}>
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="l">l</option>
                <option value="unit">unit</option>
              </select>
              <button type="button" onClick={() => removeIngredientRow(idx)} className="rounded-lg px-2 text-danger-text hover:bg-danger-bg">
                <X size={16} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addIngredientRow} className="mt-1 flex items-center gap-1 text-sm font-semibold text-good hover:text-good/80">
            <Plus size={14} /> ingrediente
          </button>

          {formError && <p className="mt-2 text-sm text-danger-text">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60">
              {saving ? "A guardar…" : form.id ? "Guardar alterações" : "Adicionar prato"}
            </button>
            {form.id && (
              <button type="button" onClick={resetForm} className="rounded-lg border border-ink-border2 px-4 py-2 text-sm font-medium text-paper hover:border-brass">
                Cancelar
              </button>
            )}
          </div>
        </form>

        {loading ? (
          <p className="mt-6 text-sm text-muted">A carregar pratos…</p>
        ) : dishes.length === 0 ? (
          <p className="mt-6 text-sm text-muted">Ainda não tens pratos no menu.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dishes.map((d) => (
              <div
                key={d.id}
                className="rounded border border-ink-border2/40 bg-paper p-4 text-ink-bg"
                style={{
                  backgroundImage: "radial-gradient(circle, #1B1D19 3px, transparent 3px)",
                  backgroundPosition: "top -3px left 0, top -3px left 100%",
                  backgroundSize: "16px 16px",
                  backgroundRepeat: "repeat-x",
                }}
              >
                <div className="flex items-start justify-between gap-2 border-b border-dashed border-ink-border2/60 pb-2">
                  <div>
                    <p className="text-sm font-bold">{d.name}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-wide text-ink-border2">{d.category || "—"}</p>
                    <p className="mt-1 font-mono text-xs text-ink-border2">{formatMoney(d.price, restaurant.currency)} · {d.ingredients.length} ingrediente{d.ingredients.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => startEdit(d)} className="rounded p-1 text-ink-bg/60 hover:text-ink-bg">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => handleDelete(d)} className="rounded p-1 text-danger-fill/80 hover:text-danger-fill">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {d.ingredients.length > 0 && (
                  <ul className="mt-2 space-y-0.5 font-mono text-[11.5px] text-ink-bg/70">
                    {d.ingredients.map((ing) => (
                      <li key={ing.id}>{ing.name} — {ing.qty}{ing.unit}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
