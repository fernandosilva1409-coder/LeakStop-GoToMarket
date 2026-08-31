import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import Button from "./Button";
import Input from "./Input";

const BATCH_SIZE = 25;

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

// Shared by the Purchases and Sales pages: upload an invoice/report PDF,
// Claude extracts structured line items server-side, the user reviews and
// corrects them here, then confirms before anything is written — extraction
// mistakes on financial data must be caught before they hit cost/margin math.
export default function PdfImportPanel({ type, restaurantId, copy, onImported, className = "" }) {
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | working | preview | importing
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

  const columns = type === "purchase" ? PURCHASE_COLUMNS : SALE_COLUMNS;
  const table = type === "purchase" ? "purchases" : "sales";
  const today = new Date().toISOString().slice(0, 10);

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    setDoneMessage("");
    setStatus("working");
    try {
      const pdfBase64 = await fileToBase64(file);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/import/extract-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ restaurantId, type, pdfBase64 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || copy.pdfReadError);

      const date = body.date || today;
      const rows = (body.items || []).map((it) =>
        type === "purchase"
          ? {
              item: it.item || "", quantity: it.quantity ?? "", unit: it.unit || "un",
              unit_price: it.unit_price ?? "", date, supplier: body.supplier || "",
            }
          : { dish_name: it.dish_name || "", quantity: it.quantity ?? "", date }
      );
      if (!rows.length) {
        setError(copy.pdfNoItems);
        setStatus("idle");
      } else {
        setItems(rows);
        setStatus("preview");
      }
    } catch (err) {
      setError(err.message || copy.pdfReadError);
      setStatus("idle");
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
  };

  const handleConfirm = async () => {
    setStatus("importing");
    setError("");
    const payloads = items.map((row) =>
      type === "purchase"
        ? {
            restaurant_id: restaurantId, item: row.item, quantity: Number(row.quantity) || 0,
            unit: row.unit || "un", unit_price: Number(row.unit_price) || 0, date: row.date,
            supplier: row.supplier ? row.supplier.trim() || null : null,
          }
        : { restaurant_id: restaurantId, dish_name: row.dish_name, quantity: Number(row.quantity) || 0, date: row.date }
    );
    try {
      for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
        const chunk = payloads.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from(table).insert(chunk);
        if (insertError) throw insertError;
      }
      setDoneMessage(copy.importedCount(payloads.length));
      setItems([]);
      setStatus("idle");
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
          {status === "working" ? copy.extractingPdf : copy.choosePdfFile}
        </Button>
        <input ref={fileInputRef} type="file" accept="application/pdf" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />
        {doneMessage && <p className="text-sm text-good">{doneMessage}</p>}
      </div>
      {error && <p className="mt-2 text-sm text-danger-text">{error}</p>}

      {status === "preview" && items.length > 0 && (
        <div className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-sunken text-left font-mono text-[11px] uppercase tracking-wide text-muted">
                  {columns.map((c) => <th key={c.key} className="px-2 py-2">{copy[c.labelKey] || c.key}</th>)}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={idx} className="border-b border-surface-border/60 last:border-0">
                    {columns.map((c) => (
                      <td key={c.key} className="px-2 py-1.5">
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
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={handleConfirm} disabled={status === "importing"}>
              {status === "importing" ? copy.importing : copy.confirmImport}
            </Button>
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={status === "importing"}>
              {copy.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
