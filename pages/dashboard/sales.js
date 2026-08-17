import { useEffect, useState } from "react";
import { Search, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import DashboardNav from "../../components/DashboardNav";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";

const PAGE_SIZE = 20;
const EMPTY_FORM = { id: null, dishName: "", quantity: "", date: "" };
const INPUT = "rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none";
const BTN = "rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-40";

export default function SalesPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.sales;

  const loadPage = async (restaurantId, pageIdx, searchTerm) => {
    setLoading(true);
    const from = pageIdx * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("sales")
      .select("*", { count: "exact" })
      .eq("restaurant_id", restaurantId)
      .order("date", { ascending: false })
      .range(from, to);
    if (searchTerm.trim()) query = query.ilike("dish_name", `%${searchTerm.trim()}%`);
    const { data, count } = await query;
    setRows(data || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => {
    if (restaurant) loadPage(restaurant.id, page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    loadPage(restaurant.id, 0, search);
  };

  const resetForm = () => { setForm(EMPTY_FORM); setFormError(""); };

  const startEdit = (row) => {
    setFormError("");
    setForm({ id: row.id, dishName: row.dish_name, quantity: row.quantity, date: row.date });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dishName.trim() || !form.date) { setFormError(t.dishDateRequired); return; }
    setSaving(true);
    setFormError("");
    const payload = {
      restaurant_id: restaurant.id, dish_name: form.dishName.trim(),
      quantity: Number(form.quantity) || 0, date: form.date,
    };
    const query = form.id
      ? supabase.from("sales").update(payload).eq("id", form.id)
      : supabase.from("sales").insert(payload);
    const { error } = await query;
    setSaving(false);
    if (error) { setFormError(error.message); return; }
    resetForm();
    loadPage(restaurant.id, page, search);
  };

  const handleDelete = async (row) => {
    await supabase.from("sales").delete().eq("id", row.id);
    if (form.id === row.id) resetForm();
    loadPage(restaurant.id, page, search);
  };

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="min-h-screen bg-ink-bg">
      <DashboardNav lang={lang} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-paper">{t.title}</h1>

        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-ink-border bg-ink-panel p-5">
          <p className="font-semibold text-paper">{form.id ? t.editSale : t.newSale}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input placeholder={t.dishName} value={form.dishName} onChange={(e) => setForm({ ...form, dishName: e.target.value })} required className={`${INPUT} min-w-[160px] flex-[2]`} />
            <input placeholder={t.colQuantity} type="number" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={`${INPUT} w-28`} />
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className={`${INPUT} w-40`} />
          </div>
          {formError && <p className="mt-2 text-sm text-danger-text">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60">
              {saving ? dash.common.saving : form.id ? t.saveChanges : t.addSale}
            </button>
            {form.id && (
              <button type="button" onClick={resetForm} className="rounded-lg border border-ink-border2 px-4 py-2 text-sm font-medium text-paper hover:border-brass">
                {dash.common.cancel}
              </button>
            )}
          </div>
        </form>

        <form onSubmit={handleSearchSubmit} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input placeholder={t.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} className={`${INPUT} w-full pl-9`} />
          </div>
          <button type="submit" className="rounded-lg border border-ink-border2 px-4 py-2 text-sm font-medium text-paper hover:border-brass">
            {dash.common.search}
          </button>
        </form>

        <div className="mt-6 overflow-hidden rounded-xl border border-ink-border bg-ink-panel">
          {loading ? (
            <p className="p-5 text-sm text-muted">{dash.common.loading}</p>
          ) : rows.length === 0 ? (
            <p className="p-5 text-sm text-muted">{t.noSales}</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-border text-left font-mono text-[11px] uppercase tracking-wide text-faint">
                    <th className="px-4 py-3">{t.colDate}</th>
                    <th className="px-4 py-3">{t.colDish}</th>
                    <th className="px-4 py-3">{t.colQuantity}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-ink-border/60 last:border-0 hover:bg-ink-bg/40">
                      <td className="px-4 py-3 font-mono text-muted">{r.date}</td>
                      <td className="px-4 py-3 font-medium text-paper">{r.dish_name}</td>
                      <td className="px-4 py-3 font-mono text-muted">{r.quantity}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => startEdit(r)} className="rounded-lg p-1.5 text-muted hover:bg-ink-bg hover:text-paper">
                            <Pencil size={15} />
                          </button>
                          <button type="button" onClick={() => handleDelete(r)} className="rounded-lg p-1.5 text-danger-text hover:bg-danger-bg">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center gap-3 border-t border-ink-border px-4 py-3">
                <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={`${BTN} border border-ink-border2 text-paper hover:border-brass`}>
                  {dash.common.previous}
                </button>
                <span className="font-mono text-xs text-faint">{t.pageInfo(page + 1, totalPages, total)}</span>
                <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className={`${BTN} border border-ink-border2 text-paper hover:border-brass`}>
                  {dash.common.next}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
