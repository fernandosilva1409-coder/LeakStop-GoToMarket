import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { computeAnalysis } from "./calculations";
import { fetchAllRows } from "./supabaseUtils";

function cutoffDate(rangeDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - rangeDays);
  return d.toISOString().slice(0, 10);
}

// Shared by dashboard/index.js and dashboard/recommendations.js: fetches every
// table computeAnalysis needs for a restaurant and maps DB rows to the shape
// the calculation engine expects. Fetches once per restaurant; `rangeDays`
// (30/90/365, or omitted for all-time) re-slices the already-fetched
// purchases/sales client-side, same pattern as the Weather page's range
// filter — no extra round-trip when the caller changes the period.
export function useAnalysis(restaurant, rangeDays) {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurant) return;
    let active = true;
    (async () => {
      const [dishRows, ingredientRows, purchaseRows, saleRows, { data: overheadRow }, excludedRows] = await Promise.all([
        fetchAllRows(() => supabase.from("dishes").select("*").eq("restaurant_id", restaurant.id)),
        fetchAllRows(() => supabase.from("dish_ingredients").select("*")),
        fetchAllRows(() => supabase.from("purchases").select("*").eq("restaurant_id", restaurant.id)),
        fetchAllRows(() => supabase.from("sales").select("*").eq("restaurant_id", restaurant.id)),
        supabase.from("overhead_settings").select("*").eq("restaurant_id", restaurant.id).single(),
        fetchAllRows(() => supabase.from("excluded_categories").select("*").eq("restaurant_id", restaurant.id)).catch(() => []),
      ]);
      if (!active) return;

      const ingredientsByDish = {};
      (ingredientRows || []).forEach((ing) => {
        ingredientsByDish[ing.dish_id] = ingredientsByDish[ing.dish_id] || [];
        ingredientsByDish[ing.dish_id].push({ name: ing.name, qty: ing.qty, unit: ing.unit });
      });
      const dishes = (dishRows || []).map((d) => ({
        id: d.id, name: d.name, category: d.category, price: d.price, prepTime: d.prep_time,
        ingredients: ingredientsByDish[d.id] || [],
      }));
      const purchases = (purchaseRows || []).map((p) => ({
        item: p.item, quantity: p.quantity, unit: p.unit, unitPrice: p.unit_price, date: p.date, supplier: p.supplier,
      }));
      const sales = (saleRows || []).map((s) => ({ dish: s.dish_name, quantity: s.quantity, date: s.date }));
      const overhead = overheadRow ? {
        kitchenLabor: overheadRow.kitchen_labor, tableLabor: overheadRow.table_labor, otherLabor: overheadRow.other_labor,
        payrollTax: overheadRow.payroll_tax, buildingCost: overheadRow.building_cost, energyCost: overheadRow.energy_cost,
        gasCost: overheadRow.gas_cost, waterCost: overheadRow.water_cost, wasteCollection: overheadRow.waste_collection,
        cleaningSupplies: overheadRow.cleaning_supplies, softwareAdmin: overheadRow.software_admin, otherCost: overheadRow.other_cost,
        method: overheadRow.method,
      } : {};

      const excludedCategories = (excludedRows || []).map((r) => r.category);
      setRaw({ dishes, purchases, sales, overhead, excludedCategories });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [restaurant]);

  const analysis = useMemo(() => {
    if (!raw) return null;
    let { purchases, sales } = raw;
    if (rangeDays) {
      const cutoff = cutoffDate(rangeDays);
      purchases = purchases.filter((p) => p.date >= cutoff);
      sales = sales.filter((s) => s.date >= cutoff);
    }
    return computeAnalysis(raw.dishes, purchases, sales, raw.overhead, raw.excludedCategories);
  }, [raw, rangeDays]);

  return { analysis, loading };
}
