// LeakStop calculation engine — ported from the validated prototype (tested against
// real data from "Tás Cá Dentro"). No React, no browser APIs: safe to run on the
// server (API routes) or in the browser.
//
// NOTE on currency: the prototype used a module-level mutable CURRENT_CURRENCY,
// which is fine in a single-user browser artifact but unsafe on a server that
// handles concurrent requests for different restaurants. Every function here
// takes currency/formatting as an explicit parameter instead.

export const norm = (s) => (s || "").trim().toLowerCase();
export const num = (n, d = 2) => (Number(n) || 0).toFixed(d);
export const catLabel = (c) => (c && c.trim()) ? c.trim() : "Uncategorized";

export const CURRENCY_SYMBOLS = { EUR: "€", USD: "$", GBP: "£", BRL: "R$" };
export const formatMoney = (n, currency = "EUR") =>
  `${CURRENCY_SYMBOLS[currency] || "€"}${(Number(n) || 0).toFixed(2)}`;

export const OVERHEAD_KEYS = [
  "kitchenLabor", "tableLabor", "otherLabor", "payrollTax",
  "buildingCost", "energyCost", "gasCost", "waterCost", "wasteCollection",
  "cleaningSupplies", "softwareAdmin", "otherCost",
];

export function periodDaysFromSales(sales) {
  // Deliberately not Math.max(...times)/Math.min(...times) — spreading a
  // large array as call arguments blows V8's call-stack limit (confirmed:
  // throws "Maximum call stack size exceeded" around ~120k+ sales rows,
  // which a multi-year restaurant history can easily reach).
  let minT = Infinity, maxT = -Infinity, found = false;
  for (const s of sales) {
    const t = new Date(s.date).getTime();
    if (isNaN(t)) continue;
    found = true;
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }
  if (!found) return 30; // no usable dates — treat the monthly figure as-is
  const span = Math.round((maxT - minT) / 86400000) + 1;
  return Math.max(span, 1);
}

// Unit handling: mass (g/kg) and volume (ml/l) are normalized to a common base (g, ml)
// so entries in different units for the same ingredient still compare correctly.
// Anything else (unit, portion, box, etc.) is treated as its own dimension —
// mixing two different count-like units for the same ingredient is flagged, not guessed at.
export function classifyUnit(unit) {
  const u = norm(unit);
  if (["g", "gram", "grams"].includes(u)) return { dim: "mass", base: "g", factor: 1 };
  if (["kg", "kilogram", "kilograms"].includes(u)) return { dim: "mass", base: "g", factor: 1000 };
  if (["ml", "milliliter", "milliliters", "millilitre", "millilitres"].includes(u)) return { dim: "volume", base: "ml", factor: 1 };
  if (["l", "liter", "liters", "litre", "litres"].includes(u)) return { dim: "volume", base: "ml", factor: 1000 };
  const raw = u || "unit";
  return { dim: `count:${raw}`, base: raw, factor: 1 };
}

export const toBase = (qty, unit) => {
  const c = classifyUnit(unit);
  return { value: (Number(qty) || 0) * c.factor, base: c.base, dim: c.dim };
};

export const formatQty = (value, base) => {
  if (base === "g" && value >= 1000) return `${num(value / 1000, 2)} kg`;
  if (base === "ml" && value >= 1000) return `${num(value / 1000, 2)} l`;
  if (base === "g" || base === "ml") return `${num(value, 1)} ${base}`;
  return `${num(value, Number.isInteger(value) ? 0 : 1)} ${base}`;
};

// ---------------------------------------------------------------------------
// Core analysis: waste, cost per plate, margins, and rollups by menu/purchases/sales.
// `dishes` shape: [{ id, name, category, price, prepTime, ingredients: [{name, qty, unit}] }]
// `purchases` shape: [{ item, quantity, unit, unitPrice, date, supplier }]
// `sales` shape: [{ dish, quantity, date }]
// `overhead` shape: { kitchenLabor, tableLabor, ..., method: "even" | "prepTime" }
// ---------------------------------------------------------------------------
export function computeAnalysis(dishes, purchases, sales, overhead = {}, excludedCategories = []) {
  const excludedSet = new Set(excludedCategories.map((c) => norm(catLabel(c))));
  const isExcluded = (d) => excludedSet.has(norm(catLabel(d.category)));
  const menuIngredientKeys = new Set();
  dishes.forEach((d) => d.ingredients.forEach((ing) => { if (norm(ing.name)) menuIngredientKeys.add(norm(ing.name)); }));

  const purchasedBase = {}, purchasedCost = {}, purchasedDims = {}, purchasedEntries = {};
  purchases.forEach((p) => {
    const k = norm(p.item);
    if (!k) return;
    const { value, base, dim } = toBase(p.quantity, p.unit);
    purchasedBase[k] = (purchasedBase[k] || 0) + value;
    purchasedCost[k] = (purchasedCost[k] || 0) + Number(p.quantity || 0) * Number(p.unitPrice || 0);
    purchasedDims[k] = purchasedDims[k] || new Set();
    purchasedDims[k].add(dim);
    purchasedEntries[k] = (purchasedEntries[k] || 0) + 1;
    purchasedEntries[k + "__base"] = base;
  });

  const dishByName = {};
  dishes.forEach((d) => { dishByName[norm(d.name)] = d; });

  const expectedBase = {};
  const expectedDims = {};
  const soldCount = {};
  let totalRevenue = 0;
  let unmatchedSalesQty = 0;
  const unmatchedSalesByName = {};
  sales.forEach((s) => {
    const dish = dishByName[norm(s.dish)];
    const q = Number(s.quantity || 0);
    soldCount[norm(s.dish)] = (soldCount[norm(s.dish)] || 0) + q;
    if (!dish) {
      if (norm(s.dish)) {
        unmatchedSalesQty += q;
        unmatchedSalesByName[s.dish] = (unmatchedSalesByName[s.dish] || 0) + q;
      }
      return;
    }
    totalRevenue += q * Number(dish.price || 0);
    dish.ingredients.forEach((ing) => {
      const k = norm(ing.name);
      const { value, dim } = toBase(ing.qty, ing.unit);
      expectedBase[k] = (expectedBase[k] || 0) + q * value;
      expectedDims[k] = expectedDims[k] || new Set();
      expectedDims[k].add(dim);
    });
  });
  dishes.forEach((d) => d.ingredients.forEach((ing) => {
    const k = norm(ing.name);
    if (!k) return;
    const { dim } = toBase(ing.qty, ing.unit);
    expectedDims[k] = expectedDims[k] || new Set();
    expectedDims[k].add(dim);
  }));

  const allKeys = Array.from(new Set([...Object.keys(purchasedBase), ...Object.keys(expectedBase), ...Array.from(menuIngredientKeys)]));

  const unitCostBase = {};
  Object.keys(purchasedBase).forEach((k) => {
    unitCostBase[k] = purchasedBase[k] > 0 ? purchasedCost[k] / purchasedBase[k] : 0;
  });

  const ingredientRows = [];
  const unmatchedRows = [];

  allKeys.forEach((k) => {
    const inMenu = menuIngredientKeys.has(k);
    const wasPurchased = purchasedBase[k] !== undefined;

    if (!inMenu && wasPurchased) {
      unmatchedRows.push({
        key: k,
        name: k.charAt(0).toUpperCase() + k.slice(1),
        spend: purchasedCost[k] || 0,
        entries: purchasedEntries[k] || 0,
        unit: purchasedEntries[k + "__base"] || "",
      });
      return;
    }
    if (!inMenu) return;

    const dims = new Set([...(purchasedDims[k] || []), ...(expectedDims[k] || [])]);
    const mismatch = dims.size > 1;

    if (mismatch) {
      ingredientRows.push({
        key: k, name: k.charAt(0).toUpperCase() + k.slice(1), status: "mismatch",
        purchased: null, used: null, waste: 0, wasteCost: 0, shortage: 0, unit: "",
      });
      return;
    }

    const base = purchasedEntries[k + "__base"] || Array.from(dims)[0]?.split(":")[1] || classifyUnit("").base;
    const purchased = purchasedBase[k] || 0;
    const used = expectedBase[k] || 0;
    const waste = Math.max(purchased - used, 0);
    const shortage = Math.max(used - purchased, 0);
    ingredientRows.push({
      key: k, name: k.charAt(0).toUpperCase() + k.slice(1), status: "ok",
      unit: base, purchased, used, waste,
      wasteCost: waste * (unitCostBase[k] || 0), shortage,
    });
  });
  ingredientRows.sort((a, b) => b.wasteCost - a.wasteCost);
  unmatchedRows.sort((a, b) => b.spend - a.spend);

  const dishRows = dishes.map((d) => {
    // Per-ingredient detail behind the dish's food cost — surfaced in the
    // UI (Dashboard/Rentabilidade) so "why is this cost X" has a concrete
    // answer instead of a black box: status distinguishes an ingredient
    // that never matched any purchase (no cost data exists at all) from
    // one that matched a real purchase but in an incompatible unit
    // dimension (e.g. grams vs. a whole purchased package) — the same
    // silent-zero failure mode that previously required manual auditing.
    const ingredientBreakdown = d.ingredients.map((ing) => {
      const k = norm(ing.name);
      const wasPurchased = purchasedBase[k] !== undefined;
      const dims = new Set([...(purchasedDims[k] || []), ...(expectedDims[k] || [])]);
      const dimensionMismatch = wasPurchased && dims.size > 1;
      const { value } = toBase(ing.qty, ing.unit);
      const contribution = !wasPurchased || dimensionMismatch ? 0 : value * (unitCostBase[k] || 0);
      const status = !wasPurchased ? "no_purchase" : dimensionMismatch ? "dimension_mismatch" : "matched";
      return {
        id: ing.id, name: ing.name, qty: ing.qty, unit: ing.unit, status, contribution,
        unitCost: wasPurchased && !dimensionMismatch ? unitCostBase[k] || 0 : null,
      };
    });
    const cost = ingredientBreakdown.reduce((sum, ing) => sum + ing.contribution, 0);
    const margin = Number(d.price || 0) - cost;
    const marginPct = d.price ? (margin / d.price) * 100 : 0;
    // Sales only reference a dish by name, so two menu items sharing a name
    // are genuinely indistinguishable from the sales data — dishByName
    // already resolves that ambiguity by picking one canonical dish per
    // name. Crediting sold-count to every same-named dish (instead of just
    // that one) would count each of their sales multiple times over in
    // totalSoldMatched and in the overhead-per-plate spread.
    const sold = dishByName[norm(d.name)] === d ? (soldCount[norm(d.name)] || 0) : 0;
    const hasRecipe = d.ingredients.length > 0;
    return { ...d, cost, margin, marginPct, sold, hasRecipe, ingredientBreakdown };
  });

  const monthlyOverheadTotal = OVERHEAD_KEYS.reduce((s, k) => s + (Number(overhead[k]) || 0), 0);
  const periodDaysUsed = periodDaysFromSales(sales);
  const totalOverhead = monthlyOverheadTotal * (periodDaysUsed / 30);
  const totalSoldAll = dishRows.reduce((s, d) => s + d.sold, 0);
  const totalWeighted = dishRows.reduce((s, d) => s + d.sold * (Number(d.prepTime) || 1), 0);
  const dishRowsFull = dishRows.map((d) => {
    let overheadPerPlate = 0;
    if (overhead.method === "prepTime" && totalWeighted > 0) {
      overheadPerPlate = (Number(d.prepTime) || 1) * (totalOverhead / totalWeighted);
    } else if (totalSoldAll > 0) {
      overheadPerPlate = totalOverhead / totalSoldAll;
    }
    const fullCost = d.cost + overheadPerPlate;
    const fullMargin = Number(d.price || 0) - fullCost;
    const fullMarginPct = d.price ? (fullMargin / d.price) * 100 : 0;
    return { ...d, overheadPerPlate, fullCost, fullMargin, fullMarginPct };
  });
  // Overhead spread (above) always uses every dish, excluded or not — opting
  // a category out of analytics shouldn't silently change other dishes'
  // numbers. Only the exposed rows/averages drop excluded categories.
  const visibleDishRows = dishRowsFull.filter((d) => !isExcluded(d));

  const totalWasteCost = ingredientRows.reduce((s, r) => s + r.wasteCost, 0);
  const avgMarginPct = visibleDishRows.length ? visibleDishRows.reduce((s, r) => s + r.marginPct, 0) / visibleDishRows.length : 0;
  const avgFullMarginPct = visibleDishRows.length ? visibleDishRows.reduce((s, r) => s + r.fullMarginPct, 0) / visibleDishRows.length : 0;
  const mismatchCount = ingredientRows.filter((r) => r.status === "mismatch").length;
  const unmatchedSalesTop = Object.entries(unmatchedSalesByName).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const menuByCategory = {};
  dishes.forEach((d) => {
    const cat = catLabel(d.category);
    menuByCategory[cat] = menuByCategory[cat] || { category: cat, count: 0, priceSum: 0, prepSum: 0, prepCount: 0 };
    menuByCategory[cat].count++;
    menuByCategory[cat].priceSum += Number(d.price) || 0;
    if (d.prepTime) { menuByCategory[cat].prepSum += Number(d.prepTime); menuByCategory[cat].prepCount++; }
  });
  const menuPrices = dishes.map((d) => Number(d.price) || 0).filter((p) => p > 0);
  const menuStats = {
    totalDishes: dishes.length,
    noRecipeCount: dishes.filter((d) => d.ingredients.length === 0).length,
    avgPrice: menuPrices.length ? menuPrices.reduce((s, p) => s + p, 0) / menuPrices.length : 0,
    minPrice: menuPrices.length ? Math.min(...menuPrices) : 0,
    maxPrice: menuPrices.length ? Math.max(...menuPrices) : 0,
    byCategory: Object.values(menuByCategory).map((c) => ({
      category: c.category, count: c.count, avgPrice: c.count ? c.priceSum / c.count : 0,
      avgPrepTime: c.prepCount ? c.prepSum / c.prepCount : null,
    })).sort((a, b) => b.count - a.count),
  };

  const supplierMap = {}, purchaseMonthMap = {}, itemSpendMap = {};
  let totalPurchaseSpend = 0;
  purchases.forEach((p) => {
    const spend = (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0);
    totalPurchaseSpend += spend;
    const sup = p.supplier || "—";
    supplierMap[sup] = supplierMap[sup] || { supplier: sup, spend: 0, count: 0 };
    supplierMap[sup].spend += spend; supplierMap[sup].count++;
    const mk = (p.date || "").slice(0, 7) || "—";
    purchaseMonthMap[mk] = (purchaseMonthMap[mk] || 0) + spend;
    const item = p.item || "—";
    itemSpendMap[item] = (itemSpendMap[item] || 0) + spend;
  });
  const purchaseStats = {
    totalSpend: totalPurchaseSpend,
    entryCount: purchases.length,
    supplierCount: Object.keys(supplierMap).length,
    bySupplier: Object.values(supplierMap).sort((a, b) => b.spend - a.spend),
    byMonth: Object.entries(purchaseMonthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([month, spend]) => ({ month, spend })),
    topItems: Object.entries(itemSpendMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([item, spend]) => ({ item, spend })),
  };

  const salesCategoryMap = {}, salesMonthMap = {}, dishRevenueMap = {};
  sales.forEach((s) => {
    const dish = dishByName[norm(s.dish)];
    const q = Number(s.quantity) || 0;
    const mk = (s.date || "").slice(0, 7) || "—";
    salesMonthMap[mk] = salesMonthMap[mk] || { units: 0, revenue: 0 };
    salesMonthMap[mk].units += q;
    if (dish) {
      const rev = q * Number(dish.price || 0);
      salesMonthMap[mk].revenue += rev;
      const cat = catLabel(dish.category);
      salesCategoryMap[cat] = salesCategoryMap[cat] || { category: cat, revenue: 0, units: 0 };
      salesCategoryMap[cat].revenue += rev; salesCategoryMap[cat].units += q;
      dishRevenueMap[s.dish] = dishRevenueMap[s.dish] || { dish: s.dish, revenue: 0, units: 0 };
      dishRevenueMap[s.dish].revenue += rev; dishRevenueMap[s.dish].units += q;
    }
  });
  const salesStats = {
    byCategory: Object.values(salesCategoryMap).sort((a, b) => b.revenue - a.revenue),
    byMonth: Object.entries(salesMonthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, revenue: v.revenue, units: v.units })),
    topDishes: Object.values(dishRevenueMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
  };

  return {
    ingredientRows, unmatchedRows, dishRows: visibleDishRows, totalWasteCost, totalRevenue,
    avgMarginPct, avgFullMarginPct, totalOverhead, monthlyOverheadTotal, periodDaysUsed,
    mismatchCount, unmatchedSalesQty, unmatchedSalesTop, menuStats, purchaseStats, salesStats,
    totalSoldMatched: totalSoldAll,
  };
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// ---------------------------------------------------------------------------
// Menu-engineering matrix (Star/Plowhorse/Puzzle/Dog) + ingredient alerts.
// Dishes are compared only within their own category — see the conversation
// history for why (mixing wine bottles and coffee on one scale broke the
// classification when first built and tested against real data).
// ---------------------------------------------------------------------------
const ALERT_TEXT = {
  pt: {
    waste: (qty, wastePct, cost, trimPct) => `A desperdiçar ${qty} (${wastePct}% do que foi comprado, ${cost}). Considera reduzir a próxima encomenda em cerca de ${trimPct}% ou verificar as doses.`,
    shortage: (qty) => `Faltaram ${qty} — as vendas provavelmente superaram o que foi comprado. Considera aumentar a próxima encomenda para não ficares sem stock a meio do serviço.`,
  },
  en: {
    waste: (qty, wastePct, cost, trimPct) => `Wasting ${qty} (${wastePct}% of what was purchased, ${cost}). Consider trimming the next order by roughly ${trimPct}% or checking portion sizes.`,
    shortage: (qty) => `Ran short by ${qty} — sales likely outpaced what was purchased. Consider increasing the next order to avoid running out mid-service.`,
  },
  de: {
    waste: (qty, wastePct, cost, trimPct) => `${qty} verschwendet (${wastePct}% des Eingekauften, ${cost}). Erwäge, die nächste Bestellung um etwa ${trimPct}% zu reduzieren oder die Portionsgrößen zu prüfen.`,
    shortage: (qty) => `${qty} zu wenig — der Verkauf hat wahrscheinlich den Einkauf übertroffen. Erwäge, die nächste Bestellung zu erhöhen, um mitten im Service nicht auszugehen.`,
  },
  fr: {
    waste: (qty, wastePct, cost, trimPct) => `${qty} gaspillé (${wastePct}% de ce qui a été acheté, ${cost}). Envisage de réduire la prochaine commande d'environ ${trimPct}% ou de vérifier les portions.`,
    shortage: (qty) => `Manque de ${qty} — les ventes ont probablement dépassé les achats. Envisage d'augmenter la prochaine commande pour éviter une rupture en plein service.`,
  },
  es: {
    waste: (qty, wastePct, cost, trimPct) => `Desperdiciando ${qty} (${wastePct}% de lo comprado, ${cost}). Considera reducir el próximo pedido en torno a ${trimPct}% o revisar las raciones.`,
    shortage: (qty) => `Faltaron ${qty} — las ventas probablemente superaron lo comprado. Considera aumentar el próximo pedido para no quedarte sin stock a mitad de servicio.`,
  },
};

export function computeRecommendations(analysis, currency = "EUR", lang = "pt") {
  const alertText = ALERT_TEXT[lang] || ALERT_TEXT.pt;
  const { dishRows, ingredientRows } = analysis;
  const withRecipe = dishRows.filter((d) => d.hasRecipe);
  const noRecipe = dishRows.filter((d) => !d.hasRecipe);

  const byCategory = {};
  withRecipe.forEach((d) => {
    const cat = catLabel(d.category);
    byCategory[cat] = byCategory[cat] || [];
    byCategory[cat].push(d);
  });

  const matrix = [];
  const tooSmallCategories = [];
  Object.entries(byCategory).forEach(([cat, items]) => {
    if (items.length < 3) {
      tooSmallCategories.push({ category: cat, count: items.length });
      return;
    }
    const popMedian = median(items.map((d) => d.sold));
    const marginMedian = median(items.map((d) => d.fullMarginPct));
    const catAvgMargin = items.reduce((s, d) => s + d.fullMarginPct, 0) / items.length;
    items.forEach((d) => {
      const popular = d.sold >= popMedian;
      const profitable = d.fullMarginPct >= marginMedian;
      const cls = popular && profitable ? "star" : popular && !profitable ? "plowhorse" : !popular && profitable ? "puzzle" : "dog";
      let suggestedPrice = null;
      if ((cls === "plowhorse" || cls === "dog") && catAvgMargin < 100) {
        const raw = d.fullCost / (1 - catAvgMargin / 100);
        if (raw > d.price) suggestedPrice = Math.round(raw * 2) / 2;
      }
      matrix.push({ ...d, cls, suggestedPrice });
    });
  });

  const fmt = (n) => formatMoney(n, currency);

  const wasteAlerts = ingredientRows
    .filter((r) => r.status === "ok" && r.wasteCost > 0)
    .slice(0, 8)
    .map((r) => {
      const wastePct = r.purchased > 0 ? (r.waste / r.purchased) * 100 : 0;
      return {
        key: r.key, type: "waste", name: r.name, wasteCost: r.wasteCost,
        text: alertText.waste(formatQty(r.waste, r.unit), num(wastePct, 0), fmt(r.wasteCost), num(Math.min(wastePct, 50), 0)),
      };
    });

  const shortageAlerts = ingredientRows
    .filter((r) => r.status === "ok" && r.shortage > 0)
    .sort((a, b) => b.shortage - a.shortage)
    .slice(0, 8)
    .map((r) => ({
      key: r.key, type: "shortage", name: r.name,
      text: alertText.shortage(formatQty(r.shortage, r.unit)),
    }));

  return { matrix, wasteAlerts, shortageAlerts, noRecipe, tooSmallCategories };
}
