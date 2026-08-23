import { computeRecommendations } from "./calculations";
import { fetchAllRows } from "./supabaseUtils";
import { ensureWeatherData, loadWeatherData } from "./weather";
import { getCachedAnalysis } from "./analysisCache";

// Fetches everything the chat tools read from, once per request. `analysis`
// now comes from the same server-side cache the Dashboard uses (see
// lib/analysisCache.js) instead of being recomputed from every raw sales/
// purchases row on every single chat message — a restaurant with a large
// history would otherwise pay that full cost on every turn of a conversation.
export async function loadChatContext(supabase, restaurant) {
  const analysis = await getCachedAnalysis(supabase, restaurant);
  const currency = restaurant.currency || "EUR";
  const lang = restaurant.language || "pt";
  const recs = computeRecommendations(analysis, currency, lang);

  // computeAnalysis's return doesn't carry the raw overhead input back out,
  // so get_overhead_breakdown needs its own small, single-row fetch here
  // regardless of the analysis cache.
  const { data: overheadRow } = await supabase.from("overhead_settings").select("*").eq("restaurant_id", restaurant.id).single();
  const overhead = overheadRow ? {
    kitchenLabor: overheadRow.kitchen_labor, tableLabor: overheadRow.table_labor, otherLabor: overheadRow.other_labor,
    payrollTax: overheadRow.payroll_tax, buildingCost: overheadRow.building_cost, energyCost: overheadRow.energy_cost,
    gasCost: overheadRow.gas_cost, waterCost: overheadRow.water_cost, wasteCollection: overheadRow.waste_collection,
    cleaningSupplies: overheadRow.cleaning_supplies, softwareAdmin: overheadRow.software_admin, otherCost: overheadRow.other_cost,
    method: overheadRow.method || "even",
  } : { method: "even" };

  const saleRows = await fetchAllRows(() => supabase.from("sales").select("*").eq("restaurant_id", restaurant.id));
  const sales = (saleRows || []).map((s) => ({ dish: s.dish_name, quantity: s.quantity, date: s.date }));

  const hasLocation = !!(restaurant.latitude && restaurant.longitude);
  let weather = [];
  if (hasLocation) {
    const saleDates = sales.map((s) => s.date).filter(Boolean).sort();
    const minDate = saleDates[0];
    const maxDate = saleDates[saleDates.length - 1];
    if (minDate && maxDate) {
      await ensureWeatherData(supabase, restaurant, minDate, maxDate).catch(() => {});
      weather = await loadWeatherData(supabase, restaurant.id, minDate, maxDate).catch(() => []);
    }
  }

  return { analysis, recs, overhead, currency, sales, weather, hasLocation };
}
