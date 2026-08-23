import { computeAnalysis } from "./calculations";
import { fetchAllRows } from "./supabaseUtils";

// Fetches every table computeAnalysis needs and maps DB rows to the shape
// the calculation engine expects — server-only (the caller passes a
// Supabase client already scoped to the requesting user's session).
// `minDate` bounds purchases/sales at the database instead of fetching full
// history and filtering in memory (used for the Dashboard's range pills).
export async function fetchAndComputeAnalysis(supabase, restaurantId, { minDate } = {}) {
  const [dishRows, ingredientRows, purchaseRows, saleRows, { data: overheadRow }, excludedRows] = await Promise.all([
    fetchAllRows(() => supabase.from("dishes").select("*").eq("restaurant_id", restaurantId)),
    // Embedded-resource filter through the dish_id FK instead of an
    // unscoped select("*") — lets Postgres use the index on
    // dishes.restaurant_id instead of relying on RLS to filter after a
    // full-table scan across every restaurant on the platform.
    fetchAllRows(() =>
      supabase.from("dish_ingredients").select("*, dishes!inner(restaurant_id)").eq("dishes.restaurant_id", restaurantId)
    ),
    fetchAllRows(() => {
      let q = supabase.from("purchases").select("*").eq("restaurant_id", restaurantId);
      if (minDate) q = q.gte("date", minDate);
      return q;
    }),
    fetchAllRows(() => {
      let q = supabase.from("sales").select("*").eq("restaurant_id", restaurantId);
      if (minDate) q = q.gte("date", minDate);
      return q;
    }),
    supabase.from("overhead_settings").select("*").eq("restaurant_id", restaurantId).single(),
    fetchAllRows(() => supabase.from("excluded_categories").select("*").eq("restaurant_id", restaurantId)).catch(() => []),
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
  const excludedCategories = (excludedRows || []).map((r) => r.category);

  return computeAnalysis(dishes, purchases, sales, overhead, excludedCategories);
}

// restaurants.analysis_cache_at is set to null by DB triggers (see
// supabase/schema.sql) whenever sales/purchases/dishes/dish_ingredients/
// overhead_settings/excluded_categories change for this restaurant — the
// single "needs recompute" signal. No separate TTL: a trigger-invalidated
// cache is either fresh (safe to serve) or null (must recompute), for any
// current or future write path, without touching app code per mutation site.
export async function getCachedAnalysis(supabase, restaurant) {
  if (restaurant.analysis_cache && restaurant.analysis_cache_at) {
    return restaurant.analysis_cache;
  }
  const analysis = await fetchAndComputeAnalysis(supabase, restaurant.id);
  await supabase
    .from("restaurants")
    .update({ analysis_cache: analysis, analysis_cache_at: new Date().toISOString() })
    .eq("id", restaurant.id);
  return analysis;
}
