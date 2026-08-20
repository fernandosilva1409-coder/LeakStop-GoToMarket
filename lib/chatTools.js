import { OVERHEAD_KEYS } from "./calculations";

// Typed, read-only tools for the chat assistant. Every one of them reads from
// the `context` object built once per request by loadChatContext() — no tool
// runs its own SQL, so there is no way for the model to ask for a query
// outside this shape. Tenant isolation itself comes from a stronger layer:
// loadChatContext() only ever sees rows the requesting user's Supabase
// session (and its RLS policies) can see in the first place.

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clampLimit = (n, fallback = 10, max = 25) => Math.min(Math.max(Number(n) || fallback, 1), max);
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    description: "Get individual menu dishes with price, cost, margin and units sold, ranked by a metric. Use 'margin' (lowest full-margin % first — the most concerning dishes) for profitability questions, 'revenue' (highest revenue first) for best-sellers by money, or 'popularity' (most units sold first) for best-sellers by volume.",
    input_schema: {
      type: "object",
      properties: {
        sortBy: { type: "string", enum: ["margin", "revenue", "popularity"] },
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
    description: "Get sales grouped by menu category, by dish, or by month.",
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
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_overhead_breakdown",
    description: "Get the restaurant's fixed monthly overhead costs broken down by category (labor, rent, utilities, etc.) and the method used to spread them across dishes (even per dish, or weighted by prep time).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function sortDishes(rows, sortBy) {
  if (sortBy === "revenue") return [...rows].sort((a, b) => b.sold * b.price - a.sold * a.price);
  if (sortBy === "popularity") return [...rows].sort((a, b) => b.sold - a.sold);
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
      if (input?.by === "category") return salesStats.byCategory.map((c) => ({ category: c.category, revenue: round(c.revenue), units: c.units }));
      if (input?.by === "dish") return salesStats.topDishes.map((d) => ({ dish: d.dish, revenue: round(d.revenue), units: d.units }));
      return salesStats.byMonth.map((m) => ({ month: m.month, revenue: round(m.revenue), units: m.units }));
    }

    case "get_sales_by_weekday": {
      const byWeekday = {};
      for (const s of context.sales || []) {
        if (!s.date) continue;
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
          .slice(0, 3)
          .map(([dish, units]) => ({ dish, units: round(units) }));
        return { weekday, totalUnits: round(bucket.totalUnits), topDishes };
      });
    }

    case "get_overhead_breakdown":
      return {
        currency,
        method: overhead.method || "even",
        monthlyTotal: round(analysis.monthlyOverheadTotal),
        breakdown: OVERHEAD_KEYS.map((key) => ({ category: OVERHEAD_LABELS[key] || key, amount: round(overhead[key]) })),
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
