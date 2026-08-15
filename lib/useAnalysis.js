import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { computeAnalysis } from "./calculations";

// Shared by dashboard/index.js and dashboard/recommendations.js: fetches every
// table computeAnalysis needs for a restaurant and maps DB rows to the shape
// the calculation engine expects.
export function useAnalysis(restaurant) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurant) return;
    let active = true;
    (async () => {
      const [{ data: dishRows }, { data: ingredientRows }, { data: purchaseRows }, { data: saleRows }, { data: overheadRow }] = await Promise.all([
        supabase.from("dishes").select("*").eq("restaurant_id", restaurant.id),
        supabase.from("dish_ingredients").select("*"),
        supabase.from("purchases").select("*").eq("restaurant_id", restaurant.id),
        supabase.from("sales").select("*").eq("restaurant_id", restaurant.id),
        supabase.from("overhead_settings").select("*").eq("restaurant_id", restaurant.id).single(),
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

      setAnalysis(computeAnalysis(dishes, purchases, sales, overhead));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [restaurant]);

  return { analysis, loading };
}
