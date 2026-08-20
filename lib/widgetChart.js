// Turns a raw Chat with Your Data tool call (name + input + output) into a
// shape the Analytics page can render, without trusting any LLM-generated
// structure — the tool surface is fixed and fully known (lib/chatTools.js),
// so this is a plain lookup, not a parser.

const DISH_VALUE_LABEL = { revenue: "revenue", popularity: "unitsSold", margin: "fullMarginPct" };

export function normalizeWidget(toolName, input, data) {
  switch (toolName) {
    case "get_business_summary":
      return {
        kind: "kpis",
        items: [
          { label: "totalRevenue", value: data.totalRevenue, money: true },
          { label: "totalWasteCost", value: data.totalWasteCost, money: true },
          { label: "avgFullMarginPct", value: data.avgFullMarginPct, pct: true },
          { label: "totalOverheadForPeriod", value: data.totalOverheadForPeriod, money: true },
          { label: "totalDishesOnMenu", value: data.totalDishesOnMenu },
          { label: "totalPurchaseSpend", value: data.totalPurchaseSpend, money: true },
        ],
      };

    case "get_dish_performance": {
      const metric = DISH_VALUE_LABEL[input?.sortBy] || "fullMarginPct";
      return {
        kind: "bar",
        valueLabel: metric,
        money: metric === "revenue",
        pct: metric === "fullMarginPct",
        items: (data || []).map((d) => ({
          label: d.name,
          value: metric === "revenue" ? d.price * d.unitsSold : d[metric],
        })),
      };
    }

    case "get_waste_and_shortage_alerts": {
      const waste = data?.waste || [];
      if (waste.length > 0) {
        return { kind: "bar", valueLabel: "wasteCost", money: true, items: waste.map((w) => ({ label: w.ingredient, value: w.cost })) };
      }
      return { kind: "list", items: (data?.shortages || []).map((s) => ({ label: s.ingredient, detail: s.detail })) };
    }

    case "get_purchases_breakdown": {
      const key = input?.by === "supplier" ? "supplier" : input?.by === "item" ? "item" : "month";
      return { kind: "bar", valueLabel: "spend", money: true, items: (data || []).map((r) => ({ label: r[key], value: r.spend })) };
    }

    case "get_sales_breakdown": {
      const key = input?.by === "category" ? "category" : input?.by === "dish" ? "dish" : "month";
      return { kind: "bar", valueLabel: "revenue", money: true, items: (data || []).map((r) => ({ label: r[key], value: r.revenue })) };
    }

    case "get_sales_by_weekday":
      return { kind: "bar", valueLabel: "unitsSold", items: (data || []).map((d) => ({ label: d.weekday, value: d.totalUnits })) };

    case "get_overhead_breakdown":
      return { kind: "bar", valueLabel: "amount", money: true, items: (data?.breakdown || []).map((b) => ({ label: b.category, value: b.amount })) };

    default:
      return { kind: "raw", items: [] };
  }
}
