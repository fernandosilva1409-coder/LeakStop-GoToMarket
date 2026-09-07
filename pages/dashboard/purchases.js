import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { Search, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { useAnalysis } from "../../lib/useAnalysis";
import { formatMoney } from "../../lib/calculations";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import { downloadCsvTemplate, normalizeCsvDate } from "../../lib/csv";
import { resolveProductIds } from "../../lib/resolveProducts";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";
import CsvImportPanel from "../../components/ui/CsvImportPanel";
import PdfImportPanel from "../../components/ui/PdfImportPanel";
import Field from "../../components/ui/Field";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import SimpleBarChart from "../../components/ui/SimpleBarChart";

const PAGE_SIZE = 20;
const CSV_BATCH_SIZE = 25;
const EMPTY_FORM = { id: null, item: "", quantity: "", unit: "g", unitPrice: "", date: "", supplier: "" };

const TEMPLATE_HEADER = ["item", "quantity", "unit", "unit_price", "date", "supplier"];
const TEMPLATE_ROWS = [
  ["Tomatoes", "10", "kg", "1.20", "2026-08-01", "Central Market"],
  ["Olive oil", "5", "l", "6.50", "2026-08-02", "Local Supplier"],
];

export default function PurchasesPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const { analysis } = useAnalysis(restaurant);
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
  const [importTab, setImportTab] = useState("csv");
  const [pdfImportBusy, setPdfImportBusy] = useState(false);
  const fileInputRef = useRef(null);

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.purchases;

  const loadPage = async (restaurantId, pageIdx, searchTerm) => {
    setLoading(true);
    const from = pageIdx * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("purchases")
      .select("*", { count: "exact" })
      .eq("restaurant_id", restaurantId)
      .order("date", { ascending: false })
      .range(from, to);
    if (searchTerm.trim()) {
      const term = searchTerm.trim();
      query = query.or(`item.ilike.%${term}%,supplier.ilike.%${term}%`);
    }
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
    setForm({
      id: row.id, item: row.item, quantity: row.quantity, unit: row.unit,
      unitPrice: row.unit_price, date: row.date, supplier: row.supplier || "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item.trim() || !form.date) { setFormError(t.itemDateRequired); return; }
    setSaving(true);
    setFormError("");
    const itemName = form.item.trim();
    const productIds = await resolveProductIds(restaurant.id, [{ name: itemName, unit: form.unit, price: form.unitPrice, source: "purchase" }]);
    const payload = {
      restaurant_id: restaurant.id, item: itemName, quantity: Number(form.quantity) || 0,
      unit: form.unit || "g", unit_price: Number(form.unitPrice) || 0, date: form.date,
      supplier: form.supplier.trim() || null, product_id: productIds.get(itemName) || null,
    };
    const query = form.id
      ? supabase.from("purchases").update(payload).eq("id", form.id)
      : supabase.from("purchases").insert(payload);
    const { error } = await query;
    setSaving(false);
    if (error) { setFormError(error.message); return; }
    resetForm();
    loadPage(restaurant.id, page, search);
  };

  const handleDelete = async (row) => {
    await supabase.from("purchases").delete().eq("id", row.id);
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
        await importCsvRows(data, file.name);
      },
    });
  };

  // Expected columns: item, quantity, unit, unit_price, date, supplier — one row per purchase.
  const importCsvRows = async (csvRows, sourceFilename) => {
    const skipped = [];
    const cleanRows = csvRows
      .filter((r) => (r.item || "").trim() && r.date)
      .map((r) => {
        const date = normalizeCsvDate(r.date);
        if (!date) skipped.push(r.item);
        return {
          item: r.item.trim(), quantity: Number(r.quantity) || 0,
          unit: (r.unit || "g").trim(), unit_price: Number(r.unit_price) || 0, date,
          supplier: (r.supplier || "").trim() || null,
        };
      })
      .filter((r) => r.date);

    const distinctItems = Array.from(new Map(cleanRows.map((r) => [r.item, r])).values())
      .map((r) => ({ name: r.item, unit: r.unit, price: r.unit_price, source: "purchase" }));
    const productIds = await resolveProductIds(restaurant.id, distinctItems);

    const payload = cleanRows.map((r) => ({
      restaurant_id: restaurant.id, ...r, source_filename: sourceFilename || null,
      product_id: productIds.get(r.item) || null,
    }));

    setCsvProgress({ current: 0, total: payload.length });
    let inserted = 0;
    for (let i = 0; i < payload.length; i += CSV_BATCH_SIZE) {
      const chunk = payload.slice(i, i + CSV_BATCH_SIZE);
      const { error } = await supabase.from("purchases").insert(chunk);
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
  const monthlyTrend = analysis?.purchaseStats?.byMonth || [];

  return (
    <PageShell lang={lang}>
      <h1 className="text-2xl font-bold text-heading">{t.title}</h1>

      {monthlyTrend.length > 1 && (
        <>
          <p className="mb-2 mt-6 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.monthlyTrend}</p>
          <div className="mb-6 rounded-2xl bg-surface-card p-4 shadow-soft">
            <SimpleBarChart
              height={180} money currency={restaurant.currency}
              items={monthlyTrend.map((m) => ({ label: m.month, value: m.spend }))}
            />
          </div>
        </>
      )}

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
          onDownloadTemplate={() => downloadCsvTemplate("leakstop-purchases-template.csv", TEMPLATE_HEADER, TEMPLATE_ROWS)}
        />
      ) : (
        <PdfImportPanel
          type="purchase"
          restaurantId={restaurant.id}
          copy={{ ...dash.common, ...t }}
          onImported={() => { setPage(0); loadPage(restaurant.id, 0, search); }}
          onBusyChange={setPdfImportBusy}
          className="mt-6"
        />
      )}

      <Card className="mt-6">
        <form onSubmit={handleSubmit}>
          <p className="font-semibold text-heading">{form.id ? t.editPurchase : t.newPurchase}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Field label={t.item} className="min-w-[160px] flex-[2]">
              <Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} required />
            </Field>
            <Field label={t.quantity} className="w-28">
              <Input type="number" step="0.001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <Field label={t.unit} className="w-24">
              <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="l">l</option>
                <option value="unit">unit</option>
              </Select>
            </Field>
            <Field label={t.unitPrice} className="w-28">
              <Input type="number" step="0.0001" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
            </Field>
            <Field label={t.colDate} className="w-40">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </Field>
            <Field label={t.supplier} className="min-w-[160px] flex-1">
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </Field>
          </div>
          {formError && <p className="mt-2 text-sm text-danger-text">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? dash.common.saving : form.id ? t.saveChanges : t.addPurchase}
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
          <Input
            placeholder={t.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">{dash.common.search}</Button>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl bg-surface-card shadow-soft">
        {loading ? (
          <p className="p-5 text-sm text-muted">{dash.common.loading}</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t.noPurchases}</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left font-mono text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">{t.colDate}</th>
                  <th className="px-4 py-3">{t.item}</th>
                  <th className="px-4 py-3 text-right">{t.colQty}</th>
                  <th className="px-4 py-3 text-right">{t.unitPrice}</th>
                  <th className="px-4 py-3">{t.supplier}</th>
                  <th className="px-4 py-3">{t.colFile}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-sunken">
                    <td className="px-4 py-3 font-mono text-muted">{r.date}</td>
                    <td className="px-4 py-3 font-medium text-heading">{r.item}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted">{r.quantity} {r.unit}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted">{formatMoney(r.unit_price, restaurant.currency)}</td>
                    <td className="px-4 py-3 text-muted">{r.supplier || "—"}</td>
                    <td className="px-4 py-3 max-w-[140px] truncate font-mono text-xs text-muted" title={r.source_filename || ""}>{r.source_filename || "—"}</td>
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
