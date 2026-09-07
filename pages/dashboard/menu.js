import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { Plus, X, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { formatMoney } from "../../lib/calculations";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import { downloadCsvTemplate } from "../../lib/csv";
import { fetchAllRows } from "../../lib/supabaseUtils";
import { resolveProductIds } from "../../lib/resolveProducts";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";
import CsvImportPanel from "../../components/ui/CsvImportPanel";
import MenuPdfImportPanel from "../../components/ui/MenuPdfImportPanel";
import Field from "../../components/ui/Field";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";

const TEMPLATE_HEADER = ["dish", "category", "price", "prep_time", "ingredient", "qty", "unit"];
const TEMPLATE_ROWS = [
  ["Grilled Chicken", "Main Courses", "12.50", "15", "Chicken breast", "200", "g"],
  ["Grilled Chicken", "Main Courses", "12.50", "15", "Olive oil", "10", "ml"],
  ["Caesar Salad", "Salads", "8.90", "10", "Lettuce", "150", "g"],
  ["Caesar Salad", "Salads", "8.90", "10", "Parmesan", "20", "g"],
];

const EMPTY_FORM = { id: null, name: "", category: "", price: "", prepTime: "", ingredients: [{ name: "", qty: "", unit: "g" }] };

function DishForm({ t, dash, title, form, setForm, updateIngredient, addIngredientRow, removeIngredientRow, onSubmit, onCancel, saving, formError, submitLabel, compact }) {
  return (
    <form onSubmit={onSubmit} className="min-w-0">
      <p className="font-semibold text-heading">{title}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Field label={t.dishName} className={compact ? "w-full" : "min-w-[160px] flex-[2]"}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label={t.category} className={compact ? "min-w-[100px] flex-1" : "min-w-[120px] flex-1"}>
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </Field>
        <Field label={t.price} className={compact ? "w-20" : "w-24"}>
          <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </Field>
        <Field label={t.prepTime} className={compact ? "w-24" : "w-36"}>
          <Input type="number" step="0.5" value={form.prepTime} onChange={(e) => setForm({ ...form, prepTime: e.target.value })} />
        </Field>
      </div>

      <p className="mb-1 mt-4 font-mono text-[11px] uppercase tracking-wide text-muted">{t.ingredients}</p>
      {form.ingredients.map((ing, idx) => (
        <div key={idx} className="mb-1.5 flex flex-wrap gap-2">
          <Input placeholder={t.ingredientPlaceholder} value={ing.name} onChange={(e) => updateIngredient(idx, "name", e.target.value)} className={compact ? "min-w-[100px] flex-1" : "flex-[2]"} />
          <Input placeholder={t.qty} type="number" step="0.001" value={ing.qty} onChange={(e) => updateIngredient(idx, "qty", e.target.value)} className="w-20" />
          <Select value={ing.unit} onChange={(e) => updateIngredient(idx, "unit", e.target.value)} className="w-20">
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="ml">ml</option>
            <option value="l">l</option>
            <option value="unit">unit</option>
          </Select>
          <button type="button" onClick={() => removeIngredientRow(idx)} className="rounded-xl px-2 text-danger-text hover:bg-danger-bg">
            <X size={16} />
          </button>
        </div>
      ))}
      <button type="button" onClick={addIngredientRow} className="mt-1 flex items-center gap-1 text-sm font-semibold text-good hover:text-good/80">
        <Plus size={14} /> {t.addIngredient}
      </button>

      {formError && <p className="mt-2 text-sm text-danger-text">{formError}</p>}
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? dash.common.saving : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {dash.common.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}

export default function MenuPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [csvStatus, setCsvStatus] = useState("");
  const [csvProgress, setCsvProgress] = useState(null);
  const [importTab, setImportTab] = useState("csv");
  const [pdfImportBusy, setPdfImportBusy] = useState(false);
  const fileInputRef = useRef(null);

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.menu;

  const loadDishes = async (restaurantId) => {
    const [dishRows, ingredientRows] = await Promise.all([
      fetchAllRows(() => supabase.from("dishes").select("*").eq("restaurant_id", restaurantId).order("name")),
      fetchAllRows(() => supabase.from("dish_ingredients").select("*")),
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
    if (!form.name.trim()) { setFormError(t.dishNameRequired); return; }
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
      const productIds = await resolveProductIds(
        restaurant.id,
        ingredients.map((i) => ({ name: i.name.trim(), unit: i.unit }))
      );
      const rows = ingredients.map((i) => {
        const name = i.name.trim();
        return { dish_id: dishId, name, qty: Number(i.qty) || 0, unit: i.unit || "g", product_id: productIds.get(name) || null };
      });
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
    setCsvStatus(t.importing);
    setCsvProgress(null);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data, errors }) => {
        if (errors.length) { setCsvStatus(`${t.csvReadError} ${errors[0].message}`); return; }
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

    const allIngredients = [];
    Object.values(byDish).forEach((g) => g.ingredients.forEach((i) => allIngredients.push({ name: i.name, unit: i.unit })));
    const productIds = await resolveProductIds(restaurant.id, allIngredients);

    const dishKeys = Object.keys(byDish);
    setCsvProgress({ current: 0, total: dishKeys.length });
    let imported = 0;
    for (const key of dishKeys) {
      const group = byDish[key];
      const existing = existingByName[key];
      const payload = {
        restaurant_id: restaurant.id, name: group.name, category: group.category,
        price: group.price, prep_time: group.prepTime, updated_at: new Date().toISOString(),
      };
      let dishId;
      if (existing) {
        dishId = existing.id;
        const { error: updateError } = await supabase.from("dishes").update(payload).eq("id", dishId);
        if (updateError) { setCsvProgress(null); setCsvStatus(`${dash.common.csvSaveError} ${updateError.message} (${t.importedCount(imported)})`); loadDishes(restaurant.id); return; }
        await supabase.from("dish_ingredients").delete().eq("dish_id", dishId);
      } else {
        const { data, error: insertError } = await supabase.from("dishes").insert(payload).select().single();
        if (insertError) { setCsvProgress(null); setCsvStatus(`${dash.common.csvSaveError} ${insertError.message} (${t.importedCount(imported)})`); loadDishes(restaurant.id); return; }
        dishId = data.id;
      }
      if (group.ingredients.length) {
        const ingRows = group.ingredients.map((i) => ({ dish_id: dishId, name: i.name, qty: i.qty, unit: i.unit, product_id: productIds.get(i.name) || null }));
        const { error: ingError } = await supabase.from("dish_ingredients").insert(ingRows);
        if (ingError) { setCsvProgress(null); setCsvStatus(`${dash.common.csvSaveError} ${ingError.message} (${t.importedCount(imported)})`); loadDishes(restaurant.id); return; }
      }
      imported++;
      setCsvProgress({ current: imported, total: dishKeys.length });
    }
    setCsvProgress(null);
    setCsvStatus(t.importedCount(imported));
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadDishes(restaurant.id);
  };

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  return (
    <PageShell lang={lang}>
      <h1 className="text-2xl font-bold text-heading">{t.title}</h1>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (importTab === "pdf" && pdfImportBusy && !window.confirm(dash.common.confirmLeaveImport)) return;
            setImportTab("csv");
          }}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${importTab === "csv" ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-card text-muted shadow-soft hover:text-heading"}`}
        >
          {t.tabCsv}
        </button>
        <button
          type="button" onClick={() => setImportTab("pdf")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${importTab === "pdf" ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-card text-muted shadow-soft hover:text-heading"}`}
        >
          {t.tabPdf}
        </button>
      </div>

      {importTab === "csv" ? (
        <CsvImportPanel
          title={t.importCsv}
          columnsHint={t.csvColumns}
          chooseFileLabel={t.chooseFile}
          downloadLabel={t.downloadTemplate}
          status={csvStatus}
          progress={csvProgress}
          fileInputRef={fileInputRef}
          onFile={handleCsvFile}
          onDownloadTemplate={() => downloadCsvTemplate("leakstop-menu-template.csv", TEMPLATE_HEADER, TEMPLATE_ROWS)}
        />
      ) : (
        <MenuPdfImportPanel
          restaurantId={restaurant.id}
          existingDishes={dishes}
          copy={{ ...dash.common, ...t }}
          onImported={() => loadDishes(restaurant.id)}
          onBusyChange={setPdfImportBusy}
          className="mt-6"
        />
      )}

      {!form.id && (
        <Card className="mt-6">
          <DishForm
            t={t} dash={dash} title={t.newDish} form={form} setForm={setForm}
            updateIngredient={updateIngredient} addIngredientRow={addIngredientRow} removeIngredientRow={removeIngredientRow}
            onSubmit={handleSubmit} saving={saving} formError={formError} submitLabel={t.addDish}
          />
        </Card>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-muted">{t.loadingDishes}</p>
      ) : dishes.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t.noDishesYet}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dishes.map((d) =>
            form.id === d.id ? (
              <Card key={d.id} className="min-w-0">
                <DishForm
                  t={t} dash={dash} title={t.editDish} form={form} setForm={setForm}
                  updateIngredient={updateIngredient} addIngredientRow={addIngredientRow} removeIngredientRow={removeIngredientRow}
                  onSubmit={handleSubmit} onCancel={resetForm} saving={saving} formError={formError} submitLabel={t.saveChanges}
                  compact
                />
              </Card>
            ) : (
              <Card key={d.id} className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-heading">{d.name}</p>
                    {d.category && (
                      <span className="mt-1 inline-block rounded-full bg-brass/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-brass">
                        {d.category}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => startEdit(d)} className="rounded-lg p-1 text-muted hover:bg-surface-sunken hover:text-heading">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => handleDelete(d)} className="rounded-lg p-1 text-danger-text hover:bg-danger-bg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-2 font-mono text-xs text-muted">
                  {formatMoney(d.price, restaurant.currency)}
                  {d.prep_time ? ` · ${t.prepTimeMin(d.prep_time)}` : ""} · {t.ingredientCount(d.ingredients.length)}
                </p>
                {d.ingredients.length > 0 && (
                  <ul className="mt-3 space-y-0.5 border-t border-surface-border pt-3 font-mono text-[11.5px] text-muted">
                    {d.ingredients.map((ing) => (
                      <li key={ing.id}>{ing.name} — {ing.qty}{ing.unit}</li>
                    ))}
                  </ul>
                )}
              </Card>
            )
          )}
        </div>
      )}
    </PageShell>
  );
}
