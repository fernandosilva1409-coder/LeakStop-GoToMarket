import { anthropic, ANALYSIS_MODEL } from "./anthropic";
import { norm } from "./calculations";

// Only decides matches — never asked to guess a package size or purchase
// unit. Package size is either read deterministically off the label (see
// extractPackageSizeFromLabel) or left for the user to fill in on the
// Products page: numeric label-guessing was the source of every real bug
// found while building this (10kg vs 1kg cases, "un" vs "cx" mislabeling),
// while "is this the same product" is a much safer judgment call for a
// small model.
const MATCH_TOOL = {
  name: "match_ingredient",
  description: "Decides whether a recipe ingredient name refers to an existing Product, or to an already-purchased item that doesn't have a Product yet.",
  input_schema: {
    type: "object",
    properties: {
      matched_product_name: {
        type: ["string", "null"],
        description: "The EXACT name of one entry from the existing-products list, if confident this is the same real-world item (ignore wording/brand differences). Null otherwise.",
      },
      matched_purchase_item: {
        type: ["string", "null"],
        description: "The EXACT name of one entry from the purchased-items list, if matched_product_name is null and you're confident this ingredient refers to that purchase. Null if there's no confident match either way.",
      },
    },
    required: [],
  },
};

function buildMatchPrompt({ name, existingProducts, purchaseItems }) {
  const productsText = existingProducts.length
    ? existingProducts.map((p) => p.name).join("\n")
    : "(none yet)";
  const purchasesText = purchaseItems.length
    ? purchaseItems.map((p) => `${p.name} | ${p.unit}`).join("\n")
    : "(none yet)";

  return [
    `Recipe ingredient name: "${name}"`,
    "",
    "This restaurant's existing products:",
    productsText,
    "",
    "This restaurant's purchased items without a product yet:",
    purchasesText,
    "",
    "Is this ingredient the SAME real-world item as one of the existing products (ignore wording/brand differences)? If so, set matched_product_name to that exact string.",
    "Otherwise, does it match one of the purchased items? If so, set matched_purchase_item to that exact string.",
    "If neither, leave both null — don't guess.",
  ].join("\n");
}

// Deterministic override for a "1kg*10" style label — a whole-package unit
// whose name spells out both a per-piece size AND a case multiplier.
// Confirmed against real invoice data: the purchase's own recorded
// quantity/price is per PIECE (one bag), not per case.
function extractPackageSizeFromLabel(name) {
  const m = String(name).match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml)\s*[x×*]\s*\d+/i);
  if (!m) return null;
  return { package_qty: parseFloat(m[1].replace(",", ".")), package_unit: m[2].toLowerCase() };
}

async function insertProduct({ supabase, restaurantId, name, resolved }) {
  const { data: created, error } = await supabase
    .from("products")
    .insert({ restaurant_id: restaurantId, name, ...resolved })
    .select()
    .single();

  if (error) {
    // Unique (restaurant_id, name) race — another concurrent call created it
    // first; look it up instead of failing the whole import.
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("products").select("*").eq("restaurant_id", restaurantId).ilike("name", name).maybeSingle();
      if (existing) return { productId: existing.id, created: false, product: existing };
    }
    throw error;
  }
  return { productId: created.id, created: true, product: created };
}

// Creates a Product anchored to a real purchased item (purchase_unit comes
// straight from that purchase, never guessed), then links every existing
// purchase row sharing that item name to the new product — this is the only
// place purchases ever get a product_id they didn't already have, and it
// only happens as a side effect of the item actually being used in a recipe.
async function createFromPurchaseItem({ supabase, restaurantId, purchaseItem }) {
  const labelSize = extractPackageSizeFromLabel(purchaseItem.name);
  const result = await insertProduct({
    supabase, restaurantId, name: purchaseItem.name,
    resolved: { purchase_unit: purchaseItem.unit, package_qty: labelSize?.package_qty ?? null, package_unit: labelSize?.package_unit ?? null },
  });
  if (result.created && purchaseItem.rowIds?.length) {
    for (let i = 0; i < purchaseItem.rowIds.length; i += 500) {
      const chunk = purchaseItem.rowIds.slice(i, i + 500);
      await supabase.from("purchases").update({ product_id: result.productId }).in("id", chunk);
    }
  }
  return result;
}

// Resolves a recipe ingredient name to a Product — the ONLY path that ever
// creates a new Product. Exact-name match against existing products first;
// then exact-name match against this restaurant's purchased items (creating
// the product from that purchase, and linking its rows); then one AI call
// as a last resort for wording differences on either side. Returns null
// (no product) when nothing matches — the ingredient just falls back to the
// existing name+dimension cost logic, exactly as if Products didn't exist.
export async function resolveProductForIngredient({ supabase, restaurantId, rawName, existingProducts, purchaseItems }) {
  const name = (rawName || "").trim();
  if (!name) return null;
  const key = norm(name);

  const exactProduct = existingProducts.find((p) => norm(p.name) === key);
  if (exactProduct) return { productId: exactProduct.id, created: false, product: exactProduct };

  const exactPurchase = purchaseItems.find((p) => norm(p.name) === key);
  if (exactPurchase) return createFromPurchaseItem({ supabase, restaurantId, purchaseItem: exactPurchase });

  if (!existingProducts.length && !purchaseItems.length) return null;

  try {
    const response = await anthropic.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 200,
      tools: [MATCH_TOOL],
      tool_choice: { type: "tool", name: MATCH_TOOL.name },
      messages: [{ role: "user", content: buildMatchPrompt({ name, existingProducts, purchaseItems }) }],
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    const out = toolUse?.input || {};
    if (out.matched_product_name) {
      const matched = existingProducts.find((p) => norm(p.name) === norm(String(out.matched_product_name).trim()));
      if (matched) return { productId: matched.id, created: false, product: matched };
    }
    if (out.matched_purchase_item) {
      const matched = purchaseItems.find((p) => norm(p.name) === norm(String(out.matched_purchase_item).trim()));
      if (matched) return createFromPurchaseItem({ supabase, restaurantId, purchaseItem: matched });
    }
  } catch (err) {
    console.error("resolveProductForIngredient AI call failed:", err);
  }
  return null;
}

// Resolves a purchase row to an EXISTING product only — exact name match,
// no AI, never creates. Purchases don't spawn products on their own; a
// product only comes into existence once the same item is actually used in
// a recipe (see resolveProductForIngredient above).
function linkExistingProduct({ rawName, existingProducts }) {
  const name = (rawName || "").trim();
  if (!name) return null;
  const exact = existingProducts.find((p) => norm(p.name) === norm(name));
  return exact ? exact.id : null;
}

// Batches product resolution across many calls sharing one restaurant.
// `kind: "menu"` fetches products + this restaurant's purchase items once
// and can create new products; `kind: "purchase"` fetches only products and
// never creates — matching the asymmetry above.
export function createProductResolver({ supabase, restaurantId, kind = "menu" }) {
  let productsPromise = null;
  let purchaseItemsPromise = null;
  const cache = new Map();

  const ensureProducts = () => {
    if (!productsPromise) {
      productsPromise = supabase.from("products").select("*").eq("restaurant_id", restaurantId).then(({ data }) => data || []);
    }
    return productsPromise;
  };

  const ensurePurchaseItems = () => {
    if (!purchaseItemsPromise) {
      purchaseItemsPromise = supabase.from("purchases").select("id, item, unit").eq("restaurant_id", restaurantId).then(({ data }) => {
        const byKey = new Map();
        (data || []).forEach((p) => {
          const itemKey = norm(p.item);
          if (!itemKey) return;
          const g = byKey.get(itemKey) || { name: p.item, unitCounts: new Map(), rowIds: [] };
          g.unitCounts.set(p.unit, (g.unitCounts.get(p.unit) || 0) + 1);
          g.rowIds.push(p.id);
          byKey.set(itemKey, g);
        });
        return Array.from(byKey.values()).map((g) => ({
          name: g.name,
          unit: Array.from(g.unitCounts.entries()).sort((a, b) => b[1] - a[1])[0][0],
          rowIds: g.rowIds,
        }));
      });
    }
    return purchaseItemsPromise;
  };

  return async function resolve(rawName) {
    const name = (rawName || "").trim();
    if (!name) return null;
    const key = norm(name);
    if (cache.has(key)) return cache.get(key);

    const products = await ensureProducts();
    const exact = products.find((p) => norm(p.name) === key);
    if (exact) { cache.set(key, exact.id); return exact.id; }

    if (kind === "purchase") {
      const id = linkExistingProduct({ rawName: name, existingProducts: products });
      cache.set(key, id);
      return id;
    }

    const purchaseItems = await ensurePurchaseItems();
    const result = await resolveProductForIngredient({ supabase, restaurantId, rawName: name, existingProducts: products, purchaseItems });
    const productId = result?.productId ?? null;
    cache.set(key, productId);
    if (result?.created) {
      products.push(result.product);
      productsPromise = Promise.resolve(products);
      // The newly-created product just absorbed one purchase item's rows —
      // drop it from the purchase-items pool so it isn't offered as a match
      // target again this batch (it's a product now, not an unlinked item).
      const absorbedKey = norm(result.product.name);
      purchaseItemsPromise = purchaseItemsPromise.then((items) => items.filter((i) => norm(i.name) !== absorbedKey));
    }
    return productId;
  };
}
