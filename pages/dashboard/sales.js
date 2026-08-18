import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { Search, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import { downloadCsvTemplate, normalizeCsvDate } from "../../lib/csv";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";
import CsvImportPanel from "../../components/ui/CsvImportPanel";
import Field from "../../components/ui/Field";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

const PAGE_SIZE = 20;
const CSV_BATCH_SIZE = 25;
const EMPTY_FORM = { id: null, dishName: "", quantity: "", date: "" };

const TEMPLATE_HEADER = ["dish_name", "quantity", "date"];
const TEMPLATE_ROWS = [
  ["Grilled Chicken", "5", "2026-08-01"],
  ["Caesar Salad", "3", "2026-08-01"],
];

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
  const [csvStatus, setCsvStatus] = useState("");
  const [csvProgress, setCsvProgress] = useState(null);
  const fileInputRef = useRef(null);

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

  // Expected columns: dish_name, quantity, date — one row per sale.
  const importCsvRows = async (csvRows) => {
    const skipped = [];
    const payload = csvRows
      .filter((r) => (r.dish_name || "").trim() && r.date)
      .map((r) => {
        const date = normalizeCsvDate(r.date);
        if (!date) skipped.push(r.dish_name);
        return { restaurant_id: restaurant.id, dish_name: r.dish_name.trim(), quantity: Number(r.quantity) || 0, date };
      })
      .filter((r) => r.date);

    setCsvProgress({ current: 0, total: payload.length });
    let inserted = 0;
    for (let i = 0; i < payload.length; i += CSV_BATCH_SIZE) {
      const chunk = payload.slice(i, i + CSV_BATCH_SIZE);
      const { error } = await supabase.from("sales").insert(chunk);
      if (error) {
        setCsvProgress(null);
        setCsvStatus(`${dash.common.csvSaveError} ${error.message} (${t.importedCount(inserted)})`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setPage(0);
        loadPage(restaurant.id, 0, search);
        return;
      }
      inserted += chunk.length;
      setCsvProgress({ current: inserted, total: payload.length });
    }
    setCsvProgress(null);
    setCsvStatus(skipped.length ? `${t.importedCount(inserted)} — ${skipped.length} ${t.skippedBadDate}` : t.importedCount(inserted));
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPage(0);
    loadPage(restaurant.id, 0, search);
  };

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <PageShell lang={lang}>
      <h1 className="text-2xl font-bold text-heading">{t.title}</h1>

      <CsvImportPanel
        title={t.importCsv}
        columnsHint={t.csvColumns}
        chooseFileLabel={t.chooseFile}
        downloadLabel={t.downloadTemplate}
        status={csvStatus}
        progress={csvProgress}
        fileInputRef={fileInputRef}
        onFile={handleCsvFile}
        onDownloadTemplate={() => downloadCsvTemplate("leakstop-sales-template.csv", TEMPLATE_HEADER, TEMPLATE_ROWS)}
      />

      <Card className="mt-6">
        <form onSubmit={handleSubmit}>
          <p className="font-semibold text-heading">{form.id ? t.editSale : t.newSale}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Field label={t.dishName} className="min-w-[160px] flex-[2]">
              <Input value={form.dishName} onChange={(e) => setForm({ ...form, dishName: e.target.value })} required />
            </Field>
            <Field label={t.colQuantity} className="w-28">
              <Input type="number" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <Field label={t.colDate} className="w-40">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </Field>
          </div>
          {formError && <p className="mt-2 text-sm text-danger-text">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? dash.common.saving : form.id ? t.saveChanges : t.addSale}
            </Button>
            {form.id && (
              <Button type="button" variant="secondary" onClick={resetForm}>
                {dash.common.cancel}
              </Button>
            )}
          </div>
        </form>
      </Card>

      <form onSubmit={handleSearchSubmit} className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder={t.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9" />
        </div>
        <Button type="submit" variant="secondary">{dash.common.search}</Button>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl bg-surface-card shadow-soft">
        {loading ? (
          <p className="p-5 text-sm text-muted">{dash.common.loading}</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t.noSales}</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left font-mono text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">{t.colDate}</th>
                  <th className="px-4 py-3">{t.colDish}</th>
                  <th className="px-4 py-3 text-right">{t.colQuantity}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-sunken">
                    <td className="px-4 py-3 font-mono text-muted">{r.date}</td>
                    <td className="px-4 py-3 font-medium text-heading">{r.dish_name}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted">{r.quantity}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => startEdit(r)} className="rounded-lg p-1.5 text-muted hover:bg-surface-sunken hover:text-heading">
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

            <div className="flex items-center gap-3 border-t border-surface-border px-4 py-3">
              <button
                type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-heading hover:border-brass disabled:opacity-40"
              >
                {dash.common.previous}
              </button>
              <span className="font-mono text-xs text-muted">{t.pageInfo(page + 1, totalPages, total)}</span>
              <button
                type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-heading hover:border-brass disabled:opacity-40"
              >
                {dash.common.next}
              </button>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
