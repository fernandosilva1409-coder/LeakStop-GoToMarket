// Pure, framework-free weather x sales computations — shared by the chat
// tool (lib/chatTools.js) and the dedicated Weather page (pages/dashboard/weather.js)
// so the two surfaces can't drift into different numbers for the same question.
import { norm, catLabel } from "./calculations";
import { weatherCondition, tempBand } from "./weather";

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function buildDishInfo(dishes) {
  const map = {};
  (dishes || []).forEach((d) => { map[norm(d.name)] = { category: catLabel(d.category), price: Number(d.price) || 0 }; });
  return map;
}

// Revenue/units by weather condition and by temperature band, restricted to
// days that have both a sale and cached weather data. Optional category/dish
// filters mirror the chat tool's input schema.
export function computeWeatherCorrelation(sales, weather, dishInfoByName, { category, dish } = {}) {
  const weatherByDate = {};
  (weather || []).forEach((w) => { weatherByDate[w.date] = w; });
  if (Object.keys(weatherByDate).length === 0) return { byCondition: [], byTemperature: [] };

  const wantCategory = category ? norm(category) : null;
  const wantDish = dish ? norm(dish) : null;

  const conditionBuckets = {};
  const tempBuckets = {};
  for (const s of sales || []) {
    if (!s.date) continue;
    if (wantDish && norm(s.dish) !== wantDish) continue;
    const info = dishInfoByName[norm(s.dish)];
    if (wantCategory && !norm(info?.category || "").includes(wantCategory)) continue;
    const w = weatherByDate[s.date];
    if (!w) continue;
    const qty = Number(s.quantity) || 0;
    const revenue = qty * (info?.price || 0);

    const cond = weatherCondition(w.code);
    conditionBuckets[cond] = conditionBuckets[cond] || { days: new Set(), units: 0, revenue: 0 };
    conditionBuckets[cond].days.add(s.date);
    conditionBuckets[cond].units += qty;
    conditionBuckets[cond].revenue += revenue;

    const band = tempBand(w.tempMax);
    if (band) {
      tempBuckets[band] = tempBuckets[band] || { days: new Set(), units: 0, revenue: 0 };
      tempBuckets[band].days.add(s.date);
      tempBuckets[band].units += qty;
      tempBuckets[band].revenue += revenue;
    }
  }

  const toRows = (buckets) => Object.entries(buckets).map(([label, b]) => ({
    label, days: b.days.size,
    totalUnits: round(b.units), totalRevenue: round(b.revenue),
    avgUnitsPerDay: b.days.size ? round(b.units / b.days.size) : 0,
    avgRevenuePerDay: b.days.size ? round(b.revenue / b.days.size) : 0,
  }));

  const TEMP_ORDER = ["cold", "mild", "warm", "hot"];
  return {
    byCondition: toRows(conditionBuckets).sort((a, b) => b.avgRevenuePerDay - a.avgRevenuePerDay),
    byTemperature: toRows(tempBuckets).sort((a, b) => TEMP_ORDER.indexOf(a.label) - TEMP_ORDER.indexOf(b.label)),
  };
}

// Which dishes swing the most between their best and worst weather condition —
// the actionable "push this on rainy days, ease off that on sunny days" list.
// A dish only qualifies once it has at least `minDays` sale-days in 2+ conditions,
// so a single lucky rainy Tuesday can't crown a dish "rain-sensitive".
export function computeDishWeatherSensitivity(sales, weather, dishInfoByName, { minDays = 3, topN = 8, excludedCategories = [], category = null } = {}) {
  const weatherByDate = {};
  (weather || []).forEach((w) => { weatherByDate[w.date] = w; });
  if (Object.keys(weatherByDate).length === 0) return [];

  // Same "excluded from analytics" categories the restaurant already set in
  // Settings (drinks/bottles, where the per-plate cost model doesn't apply)
  // — a weather-driven "stock up on wine" suggestion is exactly as
  // meaningless as its margin figure, so this list skips them by default.
  // `category` narrows further to a single category, for the page's pill filter.
  const excludedSet = new Set(excludedCategories.map((c) => norm(catLabel(c))));
  const wantCategory = category ? norm(catLabel(category)) : null;

  const perDishDate = {};
  for (const s of sales || []) {
    if (!s.date || !s.dish) continue;
    if (!weatherByDate[s.date]) continue;
    perDishDate[s.dish] = perDishDate[s.dish] || {};
    perDishDate[s.dish][s.date] = (perDishDate[s.dish][s.date] || 0) + (Number(s.quantity) || 0);
  }

  const results = [];
  for (const [dishName, byDate] of Object.entries(perDishDate)) {
    const info = dishInfoByName[norm(dishName)];
    const cat = catLabel(info?.category);
    if (excludedSet.has(norm(cat))) continue;
    if (wantCategory && norm(cat) !== wantCategory) continue;
    const byCondition = {};
    for (const [date, qty] of Object.entries(byDate)) {
      const cond = weatherCondition(weatherByDate[date].code);
      byCondition[cond] = byCondition[cond] || { days: 0, units: 0 };
      byCondition[cond].days += 1;
      byCondition[cond].units += qty;
    }
    const conditions = Object.entries(byCondition)
      .filter(([, b]) => b.days >= minDays)
      .map(([condition, b]) => ({ condition, days: b.days, avgUnitsPerDay: round(b.units / b.days) }))
      .sort((a, b) => b.avgUnitsPerDay - a.avgUnitsPerDay);
    if (conditions.length < 2) continue;

    const best = conditions[0];
    const worst = conditions[conditions.length - 1];
    if (best.avgUnitsPerDay <= 0) continue;
    const swingPct = round(((best.avgUnitsPerDay - worst.avgUnitsPerDay) / best.avgUnitsPerDay) * 100);

    results.push({
      dish: dishName, category: info?.category || null, price: info?.price || 0,
      best, worst, swingPct, conditions,
    });
  }

  return results.sort((a, b) => b.swingPct - a.swingPct).slice(0, topN);
}
