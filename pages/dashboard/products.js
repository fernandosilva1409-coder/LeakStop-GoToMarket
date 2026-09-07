import { Fragment, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { formatMoney } from "../../lib/calculations";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import { fetchAllRows } from "../../lib/supabaseUtils";
import PageShell from "../../components/ui/PageShell";
import Input from "../../components/ui/Input";

export default function ProductsPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [products, setProducts] = useState([]);
  const [statsByProduct, setStatsByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [rowErrors, setRowErrors] = useState({});
  const [savingId, setSavingId] = useState(null);

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.products;

  const load = async (restaurantId) => {
    setLoading(true);
    const [productRows, purchaseRows] = await Promise.all([
      fetchAllRows(() => supabase.from("products").select("*").eq("restaurant_id", restaurantId).order("name")),
      fetchAllRows(() => supabase.from("purchases").select("product_id, unit_price").eq("restaurant_id", restaurantId).not("product_id", "is", null)),
    ]);
    const stats = {};
    (purchaseRows || []).forEach((p) => {
      const s = stats[p.product_id] || { count: 0, sum: 0, min: Infinity, max: -Infinity };
      const price = Number(p.unit_price) || 0;
      s.count += 1; s.sum += price; s.min = Math.min(s.min, price); s.max = Math.max(s.max, price);
      stats[p.product_id] = s;
    });
    setStatsByProduct(stats);
    setProducts(productRows || []);
    setLoading(false);
  };

  useEffect(() => {
    if (restaurant) load(restaurant.id);
  }, [restaurant]);

  const updateField = (id, key, value) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: value } : p)));
  };

  const saveRow = async (product) => {
    setSavingId(product.id);
    setRowErrors((prev) => ({ ...prev, [product.id]: "" }));
    const { error } = await supabase
      .from("products")
      .update({
        purchase_unit: product.purchase_unit || "un",
        package_qty: product.package_qty === "" || product.package_qty == null ? null : Number(product.package_qty),
        package_unit: product.package_unit || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);
    setSavingId(null);
    if (error) setRowErrors((prev) => ({ ...prev, [product.id]: `${t.saveError} ${error.message}` }));
  };

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  return (
    <PageShell lang={lang}>
      <h1 className="text-2xl font-bold text-heading">{t.title}</h1>
      <p className="mt-1 max-w-2xl font-mono text-[11.5px] text-muted">{t.subtitle}</p>

      <div className="mt-6 overflow-hidden rounded-2xl bg-surface-card shadow-soft">
        {loading ? (
          <p className="p-5 text-sm text-muted">{dash.common.loading}</p>
        ) : products.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t.noProducts}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left font-mono text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">{t.colName}</th>
                  <th className="px-4 py-3">{t.colPurchaseUnit}</th>
                  <th className="px-4 py-3">{t.colPackageQty}</th>
                  <th className="px-4 py-3">{t.colPackageUnit}</th>
                  <th className="px-4 py-3 text-right">{t.colPurchaseCount}</th>
                  <th className="px-4 py-3 text-right">{t.colAvgPrice}</th>
                  <th className="px-4 py-3 text-right">{t.colMinPrice}</th>
                  <th className="px-4 py-3 text-right">{t.colMaxPrice}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const s = statsByProduct[p.id];
                  return (
                    <Fragment key={p.id}>
                      <tr className="border-b border-surface-border/60 last:border-0 hover:bg-surface-sunken align-top">
                        <td className="px-4 py-3 font-medium text-heading">{p.name}</td>
                        <td className="px-2 py-2">
                          <Input
                            value={p.purchase_unit || ""} onBlur={() => saveRow(p)}
                            onChange={(e) => updateField(p.id, "purchase_unit", e.target.value)}
                            className="w-24 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" step="0.0001" value={p.package_qty ?? ""} onBlur={() => saveRow(p)}
                            placeholder={t.packageHint} title={t.packageHint}
                            onChange={(e) => updateField(p.id, "package_qty", e.target.value)}
                            className="w-24 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={p.package_unit || ""} onBlur={() => saveRow(p)}
                            onChange={(e) => updateField(p.id, "package_unit", e.target.value)}
                            className="w-20 text-xs"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted">{s?.count ?? 0}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted">
                          {s?.count ? formatMoney(s.sum / s.count, restaurant.currency) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted">
                          {s?.count ? formatMoney(s.min, restaurant.currency) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted">
                          {s?.count ? formatMoney(s.max, restaurant.currency) : "—"}
                        </td>
                      </tr>
                      {(rowErrors[p.id] || savingId === p.id) && (
                        <tr className="border-b border-surface-border/60 last:border-0">
                          <td colSpan={8} className="px-4 pb-2 text-xs">
                            {savingId === p.id
                              ? <span className="text-muted">{dash.common.saving}</span>
                              : <span className="text-danger-text">{rowErrors[p.id]}</span>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
