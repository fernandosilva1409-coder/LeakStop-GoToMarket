import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Upload, X, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { resolveProductIds } from "../../lib/resolveProducts";
import Button from "./Button";
import Input from "./Input";

const CONFIDENCE_STYLE = {
  high: "bg-good/10 text-good",
  medium: "bg-warn-bg text-warn-text",
  low: "bg-danger-bg text-danger-text",
  none: "bg-danger-bg text-danger-text",
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

async function hashFile(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const norm = (v) => String(v ?? "").trim().toLowerCase();

/**
 * PDF import for the Menu page (fichas técnicas / recipe sheets), sharing
 * the extraction/review/confirm shape of PdfImportPanel but with a
 * fundamentally different data shape underneath: a dish here is a card
 * with nested ingredients, not a flat row, so it needs its own review UI.
 *
 * The extraction step also cross-checks every ingredient against this
 * restaurant's real purchase history (see /api/import/extract-pdf's menu
 * branch) so units come back already compatible with cost tracking —
 * directly targeting the "ingredient units don't match the purchase" class
 * of bug that previously required manual SQL fixes to untangle.
 */
export default function MenuPdfImportPanel({ restaurantId, existingDishes, copy, onImported, onBusyChange, className = "" }) {
  const fileInputRef = useRef(null);
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | working | preview | importing
  const [dishes, setDishes] = useState([]); // review-stage dishes, each with _isNew/_include
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [fileProgress, setFileProgress] = useState(null);

  const busy = status === "working" || status === "importing" || (status === "preview" && dishes.length > 0);

  useEffect(() => { onBusyChange?.(busy); }, [busy]);

  useEffect(() => {
    if (!busy) return undefined;
    const handleBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    const handleRouteChangeStart = (url) => {
      if (url === router.asPath) return;
      if (window.confirm(copy.confirmLeaveImport)) return;
      router.events.emit("routeChangeError");
      // eslint-disable-next-line no-throw-literal
      throw "routeChange aborted by MenuPdfImportPanel guard";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    router.events.on("routeChangeStart", handleRouteChangeStart);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      router.events.off("routeChangeStart", handleRouteChangeStart);
    };
  }, [busy, router, copy.confirmLeaveImport]);

  const existingByName = {};
  (existingDishes || []).forEach((d) => { existingByName[norm(d.name)] = d; });

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError("");
    setDoneMessage("");
    setStatus("working");
    const { data: { session } } = await supabase.auth.getSession();

    const newDishes = [];
    const failedNames = [];
    const skippedNotes = [];
    for (let i = 0; i < files.length; i++) {
      setFileProgress({ current: i + 1, total: files.length });
      try {
        const hash = await hashFile(files[i]);
        const { data: existingImport } = await supabase
          .from("pdf_imports").select("created_at")
          .eq("restaurant_id", restaurantId).eq("kind", "menu").eq("file_hash", hash)
          .maybeSingle();
        if (existingImport) {
          skippedNotes.push(copy.fileAlreadyImported(files[i].name, new Date(existingImport.created_at).toLocaleDateString()));
          continue;
        }
        const pdfBase64 = await fileToBase64(files[i]);
        const res = await fetch("/api/import/extract-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ restaurantId, type: "menu", pdfBase64 }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || copy.pdfReadError);

        (body.dishes || []).forEach((d) => {
          const isExisting = !!existingByName[norm(d.name)];
          newDishes.push({
            _include: true,
            _isExisting: isExisting,
            _sourceFile: { name: files[i].name, hash },
            name: d.name || "",
            category: d.category || "",
            price: d.price ?? 0,
            prepTime: d.prep_time_minutes ?? "",
            ingredients: (d.ingredients || []).map((ing) => ({
              _include: true,
              name: ing.matched_purchase_item || ing.recipe_name || "",
              qty: ing.qty ?? ing.recipe_qty ?? "",
              unit: ing.unit || ing.recipe_unit || "g",
              confidence: ing.match_confidence || "none",
              recipeName: ing.recipe_name,
              recipeQty: ing.recipe_qty,
              recipeUnit: ing.recipe_unit,
            })),
          });
        });
      } catch {
        failedNames.push(files[i].name);
      }
    }
    setFileProgress(null);

    const notes = [];
    if (failedNames.length) notes.push(`${copy.pdfReadError} ${failedNames.join(", ")}`);
    if (skippedNotes.length) notes.push(...skippedNotes);
    if (notes.length) setError(notes.join(" "));

    if (!newDishes.length) {
      if (!notes.length) setError(copy.pdfNoItems);
      setStatus("idle");
    } else {
      setDishes((prev) => [...prev, ...newDishes]);
      setStatus("preview");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateDish = (idx, key, value) => {
    setDishes((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));
  };
  const updateIngredient = (dishIdx, ingIdx, key, value) => {
    setDishes((prev) => prev.map((d, i) => {
      if (i !== dishIdx) return d;
      const ingredients = d.ingredients.map((ing, j) => (j === ingIdx ? { ...ing, [key]: value } : ing));
      return { ...d, ingredients };
    }));
  };
  const removeIngredient = (dishIdx, ingIdx) => {
    setDishes((prev) => prev.map((d, i) => (i === dishIdx ? { ...d, ingredients: d.ingredients.filter((_, j) => j !== ingIdx) } : d)));
  };
  const removeDish = (idx) => setDishes((prev) => prev.filter((_, i) => i !== idx));
  const toggleDish = (idx) => setDishes((prev) => prev.map((d, i) => (i === idx ? { ...d, _include: !d._include } : d)));

  const handleCancel = () => {
    setDishes([]);
    setError("");
    setStatus("idle");
  };

  const handleConfirm = async () => {
    setStatus("importing");
    setError("");
    const toImport = dishes.filter((d) => d._include);
    const allIngredients = [];
    toImport.forEach((d) => d.ingredients.forEach((ing) => { if (ing._include && ing.name.trim()) allIngredients.push({ name: ing.name.trim(), unit: ing.unit }); }));
    const productIds = await resolveProductIds(restaurantId, allIngredients);
    try {
      for (const dish of toImport) {
        const payload = {
          restaurant_id: restaurantId, name: dish.name.trim(), category: dish.category.trim() || null,
          price: Number(dish.price) || 0, prep_time: dish.prepTime === "" ? null : Number(dish.prepTime),
          updated_at: new Date().toISOString(),
        };
        let dishId = existingByName[norm(dish.name)]?.id;
        if (dishId) {
          const { error: updErr } = await supabase.from("dishes").update(payload).eq("id", dishId);
          if (updErr) throw updErr;
          await supabase.from("dish_ingredients").delete().eq("dish_id", dishId);
        } else {
          const { data, error: insErr } = await supabase.from("dishes").insert(payload).select().single();
          if (insErr) throw insErr;
          dishId = data.id;
        }
        const ingRows = dish.ingredients
          .filter((ing) => ing._include && ing.name.trim())
          .map((ing) => {
            const name = ing.name.trim();
            return { dish_id: dishId, name, qty: Number(ing.qty) || 0, unit: ing.unit || "g", product_id: productIds.get(name) || null };
          });
        if (ingRows.length) {
          const { error: ingErr } = await supabase.from("dish_ingredients").insert(ingRows);
          if (ingErr) throw ingErr;
        }
      }

      const fileMap = new Map();
      toImport.forEach((d) => { if (d._sourceFile) fileMap.set(d._sourceFile.hash, d._sourceFile.name); });
      if (fileMap.size) {
        const { data: { session } } = await supabase.auth.getSession();
        const importRows = Array.from(fileMap.entries()).map(([hash, name]) => ({
          restaurant_id: restaurantId, kind: "menu", filename: name, file_hash: hash,
          row_count: toImport.filter((d) => d._sourceFile?.hash === hash).length,
          imported_by: session?.user?.id || null,
        }));
        await supabase.from("pdf_imports").upsert(importRows, { onConflict: "restaurant_id,kind,file_hash", ignoreDuplicates: true });
      }

      setDoneMessage(copy.menuImportedCount(toImport.length));
      setDishes([]);
      setStatus("idle");
      onImported?.();
    } catch (err) {
      setError(err.message || copy.pdfReadError);
      setStatus("preview");
    }
  };

  return (
    <div className={`rounded-2xl border border-dashed border-surface-border bg-surface-sunken p-5 ${className}`}>
      <p className="font-semibold text-heading">{copy.importMenuPdf}</p>
      <p className="mt-1 font-mono text-[11.5px] text-muted">{copy.reviewExtractedMenu}</p>
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

      {status === "preview" && dishes.length > 0 && (
        <div className="mt-4 space-y-3">
          {dishes.map((dish, dishIdx) => (
            <div
              key={dishIdx}
              className={`rounded-xl border border-surface-border p-3 ${!dish._include ? "opacity-50" : ""} ${dish._isExisting ? "bg-warn-bg/20" : "bg-surface-card"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <input type="checkbox" checked={dish._include} onChange={() => toggleDish(dishIdx)} className="h-4 w-4" />
                <Input value={dish.name} onChange={(e) => updateDish(dishIdx, "name", e.target.value)} className="min-w-[160px] flex-[2] text-sm font-semibold" />
                <Input value={dish.category} onChange={(e) => updateDish(dishIdx, "category", e.target.value)} placeholder={copy.category} className="w-32 text-xs" />
                <Input type="number" step="0.01" value={dish.price} onChange={(e) => updateDish(dishIdx, "price", e.target.value)} placeholder={copy.price} className="w-24 text-xs" />
                <Input type="number" step="0.5" value={dish.prepTime} onChange={(e) => updateDish(dishIdx, "prepTime", e.target.value)} placeholder={copy.prepTime} className="w-24 text-xs" />
                {dish._isExisting && (
                  <span className="rounded-full bg-warn-bg px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-warn-text">
                    {copy.dishExistsWillReplace}
                  </span>
                )}
                <button type="button" onClick={() => removeDish(dishIdx)} className="ml-auto rounded p-1 text-danger-text hover:bg-danger-bg">
                  <X size={14} />
                </button>
              </div>

              {dish.ingredients.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-surface-border pt-2">
                  {dish.ingredients.map((ing, ingIdx) => (
                    <div key={ingIdx} className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${CONFIDENCE_STYLE[ing.confidence] || CONFIDENCE_STYLE.none}`} title={ing.recipeName !== ing.name ? `${copy.recipeSays}: ${ing.recipeQty} ${ing.recipeUnit} "${ing.recipeName}"` : undefined}>
                        {copy.matchLabels[ing.confidence] || copy.matchLabels.none}
                      </span>
                      <Input value={ing.name} onChange={(e) => updateIngredient(dishIdx, ingIdx, "name", e.target.value)} className="min-w-[140px] flex-[2] text-xs" />
                      <Input type="number" step="0.000001" value={ing.qty} onChange={(e) => updateIngredient(dishIdx, ingIdx, "qty", e.target.value)} className="w-24 text-xs" />
                      <Input value={ing.unit} onChange={(e) => updateIngredient(dishIdx, ingIdx, "unit", e.target.value)} className="w-16 text-xs" />
                      <button type="button" onClick={() => removeIngredient(dishIdx, ingIdx)} className="rounded p-1 text-danger-text hover:bg-danger-bg">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={handleConfirm} disabled={status === "importing"}>
              {status === "importing" ? copy.importing : copy.confirmImportMenu}
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
