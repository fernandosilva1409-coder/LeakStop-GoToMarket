import { OVERHEAD_KEYS, norm, catLabel } from "./calculations";
import { computeWeatherCorrelation } from "./weatherAnalytics";

// Typed, read-only tools for the chat assistant. Every one of them reads from
// the `context` object built once per request by loadChatContext() — no tool
// runs its own SQL, so there is no way for the model to ask for a query
// outside this shape. Tenant isolation itself comes from a stronger layer:
// loadChatContext() only ever sees rows the requesting user's Supabase
// session (and its RLS policies) can see in the first place.

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clampLimit = (n, fallback = 10, max = 25) => Math.min(Math.max(Number(n) || fallback, 1), max);
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function isoWeekKey(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  target.setDate(target.getDate() - dayNr + 3); // nearest Thursday decides the ISO year
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const week = 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

const OVERHEAD_LABELS = {
  kitchenLabor: "Labor — kitchen", tableLabor: "Labor — dining room", otherLabor: "Labor — other",
  payrollTax: "Payroll taxes", buildingCost: "Rent / building", energyCost: "Electricity",
  gasCost: "Gas", waterCost: "Water", wasteCollection: "Waste collection",
  cleaningSupplies: "Cleaning supplies", softwareAdmin: "Software / admin", otherCost: "Other costs",
};

export const CHAT_TOOLS = [
  {
    name: "get_business_summary",
    description: "Get the restaurant's overall KPIs for the tracked period: total revenue, waste cost, average full margin, overhead, menu size, and purchase totals. Call this first for any general question about how the business is doing.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_dish_performance",
    description: "Get individual menu dishes with price, cost, margin and units sold, ranked by a metric. Use 'margin' (lowest full-margin % first — the most concerning/worst-margin dishes) or 'bestMargin' (highest full-margin % first — the best-margin dishes) for profitability questions, 'revenue' (highest revenue first) for best-sellers by money, or 'popularity' (most units sold first) for best-sellers by volume. If asked for both the best and worst dishes, call this twice with 'bestMargin' and 'margin'.",
    input_schema: {
      type: "object",
      properties: {
        sortBy: { type: "string", enum: ["margin", "bestMargin", "revenue", "popularity"] },
        limit: { type: "integer", description: "Max dishes to return, default 10, max 25." },
      },
      required: ["sortBy"],
      additionalProperties: false,
    },
  },
  {
    name: "get_waste_and_shortage_alerts",
    description: "Get the current ingredient waste alerts (bought more than was used) and shortage alerts (used more than was bought), each with a ready-to-read explanation and, for waste, the cost impact.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_purchases_breakdown",
    description: "Get purchase spend grouped by supplier, by item, or by month.",
    input_schema: {
      type: "object",
      properties: { by: { type: "string", enum: ["supplier", "item", "month"] } },
      required: ["by"],
      additionalProperties: false,
    },
  },
  {
    name: "get_sales_breakdown",
    description: "Get sales grouped by menu category, by dish, or by month. Grouping by category also includes profit (revenue minus full cost) and average margin % per category — use that, not revenue alone, when asked which category is most profitable, since the highest-revenue category is not necessarily the most profitable one.",
    input_schema: {
      type: "object",
      properties: { by: { type: "string", enum: ["category", "dish", "month"] } },
      required: ["by"],
      additionalProperties: false,
    },
  },
  {
    name: "get_sales_by_weekday",
    description: "Get sales grouped by day of the week (Monday–Sunday), with total units sold and the top-selling dishes for each day. Use this for questions about which dishes sell more on a given day, or about weekly sales patterns.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional menu category to filter to (matches partially, e.g. 'carne' matches 'Pratos Carne'). Omit for all categories." },
        limit: { type: "integer", description: "Top dishes to return per day, default 3, max 10." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_sales_trend",
    description: "Get a sales time series (units sold AND revenue per period) grouped by week or month, optionally filtered to one menu category or one exact dish name. Use this for questions about trends or growth over time — e.g. how a category or dish, or the whole business, performed week by week or month by month across the year. Prefer the revenue figures over units when the question is about growth, performance, or money in general terms, not specifically about volume.",
    input_schema: {
      type: "object",
      properties: {
        groupBy: { type: "string", enum: ["week", "month"] },
        category: { type: "string", description: "Optional menu category to filter to (matches partially, e.g. 'peixe' matches 'Pratos Peixe'). Omit for all categories." },
        dish: { type: "string", description: "Optional exact dish name to filter to. Omit for all dishes." },
      },
      required: ["groupBy"],
      additionalProperties: false,
    },
  },
  {
    name: "get_overhead_breakdown",
    description: "Get the restaurant's fixed monthly overhead costs broken down by category (labor, rent, utilities, etc.) and the method used to spread them across dishes (even per dish, or weighted by prep time).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_weather_sales_correlation",
    description: "Get sales (units and revenue) broken down by historical weather condition (clear/cloudy/rain/snow/storm/fog) and by daily high-temperature band (cold/mild/warm/hot) for the restaurant's own location, using only days that have both sales and weather data. Use this for any question about whether or how weather affects sales. If the restaurant hasn't set a location in Settings yet, or the two datasets don't overlap, this returns why instead of numbers — relay that plainly rather than guessing.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional menu category to filter to (matches partially, e.g. 'bebidas' matches 'BEBIDAS'). Omit for all categories." },
        dish: { type: "string", description: "Optional exact dish name to filter to. Omit for all dishes." },
      },
      additionalProperties: false,
    },
  },
];

function sortDishes(rows, sortBy) {
  if (sortBy === "revenue") return [...rows].sort((a, b) => b.sold * b.price - a.sold * a.price);
  if (sortBy === "popularity") return [...rows].sort((a, b) => b.sold - a.sold);
  if (sortBy === "bestMargin") return [...rows].sort((a, b) => b.fullMarginPct - a.fullMarginPct);
  return [...rows].sort((a, b) => a.fullMarginPct - b.fullMarginPct);
}

export function runChatTool(name, input, context) {
  const { analysis, recs, overhead, currency } = context;

  switch (name) {
    case "get_business_summary":
      return {
        currency,
        totalRevenue: round(analysis.totalRevenue),
        totalWasteCost: round(analysis.totalWasteCost),
        avgFullMarginPct: round(analysis.avgFullMarginPct),
        totalOverheadForPeriod: round(analysis.totalOverhead),
        periodDaysCovered: analysis.periodDaysUsed,
        totalDishesOnMenu: analysis.menuStats.totalDishes,
        dishesWithoutRecipe: analysis.menuStats.noRecipeCount,
        avgDishPrice: round(analysis.menuStats.avgPrice),
        totalPurchaseSpend: round(analysis.purchaseStats.totalSpend),
        supplierCount: analysis.purchaseStats.supplierCount,
      };

    case "get_dish_performance": {
      const limit = clampLimit(input?.limit);
      const classByDishId = Object.fromEntries((recs.matrix || []).map((d) => [d.id, d.cls]));
      const rows = analysis.dishRows.filter((d) => d.hasRecipe);
      return sortDishes(rows, input?.sortBy).slice(0, limit).map((d) => ({
        name: d.name,
        category: d.category || "Uncategorized",
        price: round(d.price),
        fullCost: round(d.fullCost),
        fullMarginPct: round(d.fullMarginPct),
        unitsSold: d.sold,
        classification: classByDishId[d.id] || null, // star | plowhorse | puzzle | dog
      }));
    }

    case "get_waste_and_shortage_alerts":
      return {
        currency,
        waste: recs.wasteAlerts.map((a) => ({ ingredient: a.name, cost: round(a.wasteCost), detail: a.text })),
        shortages: recs.shortageAlerts.map((a) => ({ ingredient: a.name, detail: a.text })),
      };

    case "get_purchases_breakdown": {
      const { purchaseStats } = analysis;
      if (input?.by === "supplier") return purchaseStats.bySupplier.map((s) => ({ supplier: s.supplier, spend: round(s.spend), purchaseCount: s.count }));
      if (input?.by === "item") return purchaseStats.topItems.map((i) => ({ item: i.item, spend: round(i.spend) }));
      return purchaseStats.byMonth.map((m) => ({ month: m.month, spend: round(m.spend) }));
    }

    case "get_sales_breakdown": {
      const { salesStats } = analysis;
      if (input?.by === "category") {
        const catMap = {};
        analysis.dishRows.filter((d) => d.hasRecipe && d.sold > 0).forEach((d) => {
          const cat = catLabel(d.category);
          catMap[cat] = catMap[cat] || { category: cat, revenue: 0, units: 0, profit: 0 };
          catMap[cat].revenue += (Number(d.price) || 0) * d.sold;
          catMap[cat].units += d.sold;
          catMap[cat].profit += d.fullMargin * d.sold;
        });
        return Object.values(catMap)
          .map((c) => ({
            category: c.category,
            revenue: round(c.revenue),
            units: round(c.units),
            profit: round(c.profit),
            avgMarginPct: c.revenue ? round((c.profit / c.revenue) * 100) : 0,
          }))
          .sort((a, b) => b.profit - a.profit);
      }
      if (input?.by === "dish") return salesStats.topDishes.map((d) => ({ dish: d.dish, revenue: round(d.revenue), units: d.units }));
      return salesStats.byMonth.map((m) => ({ month: m.month, revenue: round(m.revenue), units: m.units }));
    }

    case "get_sales_by_weekday": {
      const catByDishName = {};
      (analysis.dishRows || []).forEach((d) => { catByDishName[norm(d.name)] = catLabel(d.category); });
      const wantCategory = input?.category ? norm(input.category) : null;
      const limit = clampLimit(input?.limit, 3, 10);

      const byWeekday = {};
      for (const s of context.sales || []) {
        if (!s.date) continue;
        if (wantCategory && !norm(catByDishName[norm(s.dish)] || "").includes(wantCategory)) continue;
        const d = new Date(`${s.date}T00:00:00`);
        if (Number.isNaN(d.getTime())) continue;
        const idx = d.getDay();
        byWeekday[idx] = byWeekday[idx] || { totalUnits: 0, byDish: {} };
        byWeekday[idx].totalUnits += Number(s.quantity) || 0;
        byWeekday[idx].byDish[s.dish] = (byWeekday[idx].byDish[s.dish] || 0) + (Number(s.quantity) || 0);
      }
      return WEEKDAYS.map((weekday, idx) => {
        const bucket = byWeekday[idx];
        if (!bucket) return { weekday, totalUnits: 0, topDishes: [] };
        const topDishes = Object.entries(bucket.byDish)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([dish, units]) => ({ dish, units: round(units) }));
        return { weekday, totalUnits: round(bucket.totalUnits), topDishes };
      });
    }

    case "get_sales_trend": {
      const dishInfoByName = {};
      (analysis.dishRows || []).forEach((d) => { dishInfoByName[norm(d.name)] = { category: catLabel(d.category), price: Number(d.price) || 0 }; });
      const wantCategory = input?.category ? norm(input.category) : null;
      const wantDish = input?.dish ? norm(input.dish) : null;
      const buckets = {};
      for (const s of context.sales || []) {
        if (!s.date) continue;
        if (wantDish && norm(s.dish) !== wantDish) continue;
        const info = dishInfoByName[norm(s.dish)];
        if (wantCategory && !norm(info?.category || "").includes(wantCategory)) continue;
        const key = input?.groupBy === "week" ? isoWeekKey(s.date) : (s.date || "").slice(0, 7);
        if (!key) continue;
        const qty = Number(s.quantity) || 0;
        buckets[key] = buckets[key] || { units: 0, revenue: 0 };
        buckets[key].units += qty;
        buckets[key].revenue += qty * (info?.price || 0);
      }
      return Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0])).map(([period, v]) => ({ period, units: round(v.units), revenue: round(v.revenue) }));
    }

    case "get_overhead_breakdown":
      return {
        currency,
        method: overhead.method || "even",
        monthlyTotal: round(analysis.monthlyOverheadTotal),
        breakdown: OVERHEAD_KEYS.map((key) => ({ category: OVERHEAD_LABELS[key] || key, amount: round(overhead[key]) })),
      };

    case "get_weather_sales_correlation": {
      if (!context.hasLocation) {
        return { locationConfigured: false, note: "The restaurant hasn't set a location in Settings yet, so no weather history is available." };
      }
      if ((context.weather || []).length === 0) {
        return { locationConfigured: true, note: "No weather data overlaps with the sales history yet." };
      }

      const dishInfoByName = {};
      (analysis.dishRows || []).forEach((d) => { dishInfoByName[norm(d.name)] = { category: catLabel(d.category), price: Number(d.price) || 0 }; });

      const { byCondition, byTemperature } = computeWeatherCorrelation(
        context.sales || [], context.weather || [], dishInfoByName,
        { category: input?.category, dish: input?.dish }
      );
      return { locationConfigured: true, currency, byCondition, byTemperature };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
