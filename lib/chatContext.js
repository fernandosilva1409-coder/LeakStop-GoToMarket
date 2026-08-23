import { computeAnalysis, computeRecommendations } from "./calculations";
import { fetchAllRows } from "./supabaseUtils";

// Fetches everything the chat tools read from, once per request, and runs it
// through the same calculation engine the dashboard uses. Mirrors the mapping
// in useAnalysis.js — kept separate because that hook is React-only and this
// runs server-side inside the /api/chat route.
export async function loadChatContext(supabase, restaurant) {
  const [dishRows, ingredientRows, purchaseRows, saleRows, { data: overheadRow }, excludedRows] = await Promise.all([
    fetchAllRows(() => supabase.from("dishes").select("*").eq("restaurant_id", restaurant.id)),
    fetchAllRows(() => supabase.from("dish_ingredients").select("*")),
    fetchAllRows(() => supabase.from("purchases").select("*").eq("restaurant_id", restaurant.id)),
    fetchAllRows(() => supabase.from("sales").select("*").eq("restaurant_id", restaurant.id)),
    supabase.from("overhead_settings").select("*").eq("restaurant_id", restaurant.id).single(),
    fetchAllRows(() => supabase.from("excluded_categories").select("*").eq("restaurant_id", restaurant.id)).catch(() => []),
  ]);

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
    method: overheadRow.method || "even",
  } : { method: "even" };

  const currency = restaurant.currency || "EUR";
  const lang = restaurant.language || "pt";
  const excludedCategories = (excludedRows || []).map((r) => r.category);
  const analysis = computeAnalysis(dishes, purchases, sales, overhead, excludedCategories);
  const recs = computeRecommendations(analysis, currency, lang);

  return { analysis, recs, overhead, currency, sales };
}
