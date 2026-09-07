import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Upload, X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { resolveProductIds } from "../../lib/resolveProducts";
import Button from "./Button";
import Input from "./Input";

const BATCH_SIZE = 25;
const PREVIEW_PAGE_SIZE = 20;

const PURCHASE_COLUMNS = [
  { key: "item", labelKey: "item", type: "text" },
  { key: "quantity", labelKey: "quantity", type: "number" },
  { key: "unit", labelKey: "unit", type: "text" },
  { key: "unit_price", labelKey: "unitPrice", type: "number" },
  { key: "date", labelKey: "colDate", type: "date" },
  { key: "supplier", labelKey: "supplier", type: "text" },
];

const SALE_COLUMNS = [
  { key: "dish_name", labelKey: "dishName", type: "text" },
  { key: "quantity", labelKey: "colQuantity", type: "number" },
  { key: "date", labelKey: "colDate", type: "date" },
];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

// Content hash, not filename — filenames repeat or get renamed, but the
// same bytes always hash the same, so this is what actually identifies
// "this exact PDF was already imported" reliably.
async function hashFile(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const norm = (v) => String(v ?? "").trim().toLowerCase();
const numNorm = (v) => String(Number(v) || 0);

// Same item/dish + date + (supplier/quantity/price as applicable) — a
// tolerant-enough signature to catch "uploaded this invoice twice" without
// false-flagging every plain-quantity purchase against every other.
function signature(type, row) {
  return type === "purchase"
    ? [norm(row.item), row.date, norm(row.supplier), numNorm(row.quantity), numNorm(row.unit_price)].join("||")
    : [norm(row.dish_name), row.date, numNorm(row.quantity)].join("||");
}

// Shared by the Purchases and Sales pages: upload an invoice/report PDF,
// Claude extracts structured line items server-side, the user reviews and
// corrects them here, then confirms before anything is written — extraction
// mistakes on financial data must be caught before they hit cost/margin math.
export default function PdfImportPanel({ type, restaurantId, copy, onImported, onBusyChange, className = "" }) {
  const fileInputRef = useRef(null);
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | working | preview | importing
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [fileProgress, setFileProgress] = useState(null); // { current, total }
  const [previewPage, setPreviewPage] = useState(0);

  const columns = type === "purchase" ? PURCHASE_COLUMNS : SALE_COLUMNS;
  const table = type === "purchase" ? "purchases" : "sales";
  const today = new Date().toISOString().slice(0, 10);

  // Extraction/insert in flight, or extracted rows sitting unconfirmed in
  // preview — all three are work that a navigation away would silently
  // discard, since this component (and its local state) simply unmounts.
  const busy = status === "working" || status === "importing" || (status === "preview" && items.length > 0);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy]);

  // Guards against losing in-flight/unconfirmed PDF import work: a full
  // page unload (tab close, reload, typed URL) via beforeunload, and an
  // in-app route change (clicking another item in the dashboard menu) via
  // Next.js router events — both would otherwise unmount this component
  // and silently drop everything without the confirm-before-insert step.
  useEffect(() => {
    if (!busy) return undefined;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const handleRouteChangeStart = (url) => {
      if (url === router.asPath) return;
      if (window.confirm(copy.confirmLeaveImport)) return;
      router.events.emit("routeChangeError");
      // eslint-disable-next-line no-throw-literal
      throw "routeChange aborted by PdfImportPanel guard";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    router.events.on("routeChangeStart", handleRouteChangeStart);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      router.events.off("routeChangeStart", handleRouteChangeStart);
    };
  }, [busy, router, copy.confirmLeaveImport]);

  const extractOne = async (file, session, hash) => {
    const pdfBase64 = await fileToBase64(file);
    const res = await fetch("/api/import/extract-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ restaurantId, type, pdfBase64 }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || copy.pdfReadError);

    const date = body.date || today;
    const sourceFile = { name: file.name, hash };
    return (body.items || []).map((it) =>
      type === "purchase"
        ? {
            item: it.item || "", quantity: it.quantity ?? "", unit: it.unit || "un",
            unit_price: it.unit_price ?? "", date, supplier: body.supplier || "", _sourceFile: sourceFile,
          }
        : { dish_name: it.dish_name || "", quantity: it.quantity ?? "", date, _sourceFile: sourceFile }
    );
  };

  // Flags rows that are either repeated within the combined batch itself
  // (e.g. the same PDF selected twice) or match something already saved for
  // this restaurant (e.g. re-uploading an invoice already imported earlier)
  // — a warning, never an automatic block, since a genuine repeat purchase
  // on the same day looks identical to a duplicate upload.
  const markDuplicates = async (rows) => {
    const dates = rows.map((r) => r.date).filter(Boolean);
    if (!dates.length) return rows.map((r) => ({ ...r, _duplicate: false }));
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));
    const selectCols = type === "purchase" ? "item, date, supplier, quantity, unit_price" : "dish_name, date, quantity";
    const { data: existingRows } = await supabase
      .from(table).select(selectCols).eq("restaurant_id", restaurantId).gte("date", minDate).lte("date", maxDate);
    const existingSigs = new Set((existingRows || []).map((r) => signature(type, r)));

    const counts = {};
    rows.forEach((r) => { const s = signature(type, r); counts[s] = (counts[s] || 0) + 1; });

    return rows.map((r) => {
      const s = signature(type, r);
      return { ...r, _duplicate: counts[s] > 1 || existingSigs.has(s) };
    });
  };

  // Files are extracted one at a time (not concurrently) so each PDF gets
  // its own Claude call cleanly and a failure on one doesn't abort the
  // others — their rows just accumulate into a single combined preview.
  // Before spending a Claude call, each file's content hash is checked
  // against pdf_imports — an exact re-selection of an already-imported PDF
  // is skipped outright rather than re-extracted and merely flagged.
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError("");
    setDoneMessage("");
    setStatus("working");
    const { data: { session } } = await supabase.auth.getSession();

    const newRows = [];
    const failedNames = [];
    const skippedNotes = [];
    for (let i = 0; i < files.length; i++) {
      setFileProgress({ current: i + 1, total: files.length });
      try {
        const hash = await hashFile(files[i]);
        const { data: existing } = await supabase
          .from("pdf_imports").select("created_at")
          .eq("restaurant_id", restaurantId).eq("kind", type).eq("file_hash", hash)
          .maybeSingle();
        if (existing) {
          skippedNotes.push(copy.fileAlreadyImported(files[i].name, new Date(existing.created_at).toLocaleDateString()));
          continue;
        }
        const rows = await extractOne(files[i], session, hash);
        newRows.push(...rows);
      } catch {
        failedNames.push(files[i].name);
      }
    }
    setFileProgress(null);

    const notes = [];
    if (failedNames.length) notes.push(`${copy.pdfReadError} ${failedNames.join(", ")}`);
    if (skippedNotes.length) notes.push(...skippedNotes);
    if (notes.length) setError(notes.join(" "));

    if (!newRows.length) {
      if (!notes.length) setError(copy.pdfNoItems);
      setStatus("idle");
    } else {
      const combined = [...items, ...newRows];
      const flagged = await markDuplicates(combined);
      setItems(flagged);
      setPreviewPage(0);
      setStatus("preview");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateRow = (idx, key, value) => {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  };

  const removeRow = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleCancel = () => {
    setItems([]);
    setError("");
    setStatus("idle");
    setPreviewPage(0);
  };

  const handleConfirm = async () => {
    setStatus("importing");
    setError("");
    let productIds = new Map();
    if (type === "purchase") {
      const distinctItems = Array.from(new Map(items.map((r) => [r.item, r])).values())
        .map((r) => ({ name: r.item, unit: r.unit, price: r.unit_price, source: "purchase" }));
      productIds = await resolveProductIds(restaurantId, distinctItems);
    }
    const payloads = items.map((row) =>
      type === "purchase"
        ? {
            restaurant_id: restaurantId, item: row.item, quantity: Number(row.quantity) || 0,
            unit: row.unit || "un", unit_price: Number(row.unit_price) || 0, date: row.date,
            supplier: row.supplier ? row.supplier.trim() || null : null,
            source_filename: row._sourceFile?.name || null,
            product_id: productIds.get(row.item) || null,
          }
        : {
            restaurant_id: restaurantId, dish_name: row.dish_name, quantity: Number(row.quantity) || 0, date: row.date,
            source_filename: row._sourceFile?.name || null,
          }
    );
    try {
      for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
        const chunk = payloads.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from(table).insert(chunk);
        if (insertError) throw insertError;
      }

      // Register every distinct source PDF as imported, so re-selecting it
      // later gets skipped instead of re-processed and re-inserted.
      const fileMap = new Map();
      items.forEach((row) => { if (row._sourceFile) fileMap.set(row._sourceFile.hash, row._sourceFile.name); });
      if (fileMap.size) {
        const { data: { session } } = await supabase.auth.getSession();
        const importRows = Array.from(fileMap.entries()).map(([hash, name]) => ({
          restaurant_id: restaurantId, kind: type, filename: name, file_hash: hash,
          row_count: items.filter((r) => r._sourceFile?.hash === hash).length,
          imported_by: session?.user?.id || null,
        }));
        await supabase.from("pdf_imports").upsert(importRows, { onConflict: "restaurant_id,kind,file_hash", ignoreDuplicates: true });
      }

      setDoneMessage(copy.importedCount(payloads.length));
      setItems([]);
      setStatus("idle");
      setPreviewPage(0);
      onImported?.();
    } catch (err) {
      setError(err.message || copy.pdfReadError);
      setStatus("preview");
    }
  };

  return (
    <div className={`rounded-2xl border border-dashed border-surface-border bg-surface-sunken p-5 ${className}`}>
      <p className="font-semibold text-heading">{copy.importPdf}</p>
      <p className="mt-1 font-mono text-[11.5px] text-muted">{copy.reviewExtracted}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button" variant="secondary" icon={Upload}
          onClick={() => fileInputRef.current?.click()}
          disabled={status === "working" || status === "importing"}
        >
          {status === "working"
            ? `${copy.extractingPdf}${fileProgress ? ` (${fileProgress.current}/${fileProgress.total})` : ""}`
            : copy.choosePdfFile}
        </Button>
        <input
          ref={fileInputRef} type="file" accept="application/pdf" multiple
          onChange={(e) => handleFiles(e.target.files)} className="hidden"
        />
        {doneMessage && <p className="text-sm text-good">{doneMessage}</p>}
      </div>
      {error && <p className="mt-2 text-sm text-danger-text">{error}</p>}

      {status === "preview" && items.length > 0 && (() => {
        // Rows needing a look — duplicates — surface first; the sort is
        // stable so order within each group (and across pages) stays put.
        const sortedEntries = items
          .map((row, idx) => ({ row, idx }))
          .sort((a, b) => Number(!!b.row._duplicate) - Number(!!a.row._duplicate));
        const totalPages = Math.max(Math.ceil(sortedEntries.length / PREVIEW_PAGE_SIZE), 1);
        const safePage = Math.min(previewPage, totalPages - 1);
        const pageEntries = sortedEntries.slice(safePage * PREVIEW_PAGE_SIZE, safePage * PREVIEW_PAGE_SIZE + PREVIEW_PAGE_SIZE);

        return (
          <div className="mt-4">
            {items.some((r) => r._duplicate) && (
              <p className="mb-2 text-sm text-warn-text">{copy.duplicatesWarning(items.filter((r) => r._duplicate).length)}</p>
            )}
            <div className="overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-sunken text-left font-mono text-[11px] uppercase tracking-wide text-muted">
                    {columns.map((c) => <th key={c.key} className="px-2 py-2">{copy[c.labelKey] || c.key}</th>)}
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pageEntries.map(({ row, idx }) => (
                    <tr key={idx} className={`border-b border-surface-border/60 last:border-0 ${row._duplicate ? "bg-warn-bg/40" : ""}`}>
                      {columns.map((c, ci) => (
                        <td key={c.key} className="px-2 py-1.5">
                          {ci === 0 && row._duplicate && (
                            <span className="mb-1 block w-fit rounded-full bg-warn-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-warn-text">
                              {copy.possibleDuplicate}
                            </span>
                          )}
                          <Input
                            type={c.type} value={row[c.key]} step={c.type === "number" ? "0.0001" : undefined}
                            onChange={(e) => updateRow(idx, c.key, e.target.value)}
                            className="w-full min-w-[100px] text-xs"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5">
                        <button type="button" onClick={() => removeRow(idx)} className="rounded p-1 text-danger-text hover:bg-danger-bg">
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button" disabled={safePage === 0} onClick={() => setPreviewPage((p) => Math.max(p - 1, 0))}
                  className="rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-heading hover:border-brass disabled:opacity-40"
                >
                  {copy.previous}
                </button>
                <span className="font-mono text-xs text-muted">{copy.pageInfo(safePage + 1, totalPages, sortedEntries.length)}</span>
                <button
                  type="button" disabled={safePage + 1 >= totalPages} onClick={() => setPreviewPage((p) => Math.min(p + 1, totalPages - 1))}
                  className="rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-heading hover:border-brass disabled:opacity-40"
                >
                  {copy.next}
                </button>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <Button type="button" onClick={handleConfirm} disabled={status === "importing"}>
                {status === "importing" ? copy.importing : copy.confirmImport}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={status === "importing"}>
                {copy.cancel}
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
