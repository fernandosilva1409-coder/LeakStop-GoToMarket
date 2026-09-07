import { anthropic, ANALYSIS_MODEL } from "./anthropic";
import { norm, classifyUnit } from "./calculations";

// Full match-or-create tool: used when we don't already know the real
// purchase unit (e.g. a brand-new product first seen from a menu
// ingredient, with no purchase history yet) — the AI has to infer
// purchase_unit itself, not just package size.
const RESOLVE_TOOL = {
  name: "resolve_product",
  description: "Decides whether an item name (from a purchase or a recipe ingredient) refers to an existing Product for this restaurant, or is a genuinely new product that needs its own purchase-unit/package-size metadata recorded.",
  input_schema: {
    type: "object",
    properties: {
      matched_product_name: {
        type: ["string", "null"],
        description: "The EXACT name of one entry from the provided existing-products list, if you're confident this is the same real-world product (ignore minor wording/brand differences). Null if genuinely new.",
      },
      purchase_unit: {
        type: "string",
        description: "Only meaningful if matched_product_name is null: the unit this product is normally bought in — a real weight/volume unit (kg, g, l, ml) if it's priced by weight/volume, or a whole-package unit (un, cx, etc.) if it's bought as one priced package.",
      },
      package_qty: {
        type: ["number", "null"],
        description: "Only set if matched_product_name is null AND purchase_unit is a whole-package unit (not already kg/g/l/ml): the size of ONE package, inferred from the item's own name/label (e.g. \"1kg\", \"5LT\", \"400g\"). Null when purchase_unit is already a real weight/volume unit — no conversion is needed.",
      },
      package_unit: {
        type: ["string", "null"],
        description: "The unit package_qty is expressed in (g, kg, ml, l, ...). Null exactly when package_qty is null.",
      },
    },
    required: ["purchase_unit"],
  },
};

// Narrower tool: used when the caller already KNOWS the real purchase unit
// (hintUnit came straight off an actual purchase row) — the AI only needs
// to decide the match, and — when the known unit is a whole-package unit
// like "un"/"cx" — the package size. It must never invent a different
// purchase_unit than the one we already know is correct.
const RESOLVE_TOOL_KNOWN_UNIT = {
  name: "resolve_product",
  description: "Decides whether an item name refers to an existing Product for this restaurant, and — if it's a genuinely new product purchased as a whole package — infers that package's real size.",
  input_schema: {
    type: "object",
    properties: {
      matched_product_name: {
        type: ["string", "null"],
        description: "The EXACT name of one entry from the provided existing-products list, if you're confident this is the same real-world product (ignore minor wording/brand differences). Null if genuinely new.",
      },
      package_qty: {
        type: ["number", "null"],
        description: "The size of ONE package, inferred from the item's own name/label (e.g. \"1kg\", \"5LT\", \"400g\"). Null if you can't confidently infer a size.",
      },
      package_unit: {
        type: ["string", "null"],
        description: "The unit package_qty is expressed in (g, kg, ml, l, ...). Null exactly when package_qty is null.",
      },
    },
    required: [],
  },
};

function buildPrompt({ name, hintUnit, hintPrice, existingProducts }) {
  const listText = existingProducts.length
    ? existingProducts
        .map((p) => `${p.name} | purchase_unit=${p.purchase_unit}${p.package_qty ? ` | 1 ${p.purchase_unit} = ${p.package_qty}${p.package_unit}` : ""}`)
        .join("\n")
    : "(no products recorded yet for this restaurant)";

  return [
    `New item name: "${name}"`,
    hintUnit ? `It appears in the source data with unit "${hintUnit}"${hintPrice ? ` at roughly ${hintPrice} per ${hintUnit}` : ""}.` : "",
    "",
    "This restaurant's existing products:",
    listText,
    "",
    "First decide: is this the SAME real-world product as one already in the list above (same core item, ignoring brand/wording differences)? If so, set matched_product_name to that exact string and ignore the other fields.",
    "",
    "If it's genuinely new, decide purchase_unit and, when relevant, its package size:",
    "  - If it's priced by weight/volume (kg, g, l, ml), purchase_unit is that unit and package_qty/package_unit stay null — no conversion is needed since recipes can use the same dimension directly.",
    "  - If it's bought as one whole priced package (un, cx, or similar count unit), infer that package's real size from the name/label itself (look for a pattern like \"1KG\", \"5LT\", \"400g\", \"15 dúzias\", \"25F(45GR)\"). If a label shows something like \"1kg*10\", use the hint price to sanity-check whether it's actually sold as the small size (1kg) or the multiplied case (10kg) — the per-kg price implied by each option should be realistic for that product.",
    "  - If you truly cannot infer a package size for a count-purchased item, set purchase_unit to the count unit anyway and leave package_qty/package_unit null (it just won't support gram/ml-level recipe conversion yet).",
  ].filter(Boolean).join("\n");
}

function buildKnownUnitPrompt({ name, hintUnit, hintPrice, existingProducts }) {
  const listText = existingProducts.length
    ? existingProducts
        .map((p) => `${p.name} | purchase_unit=${p.purchase_unit}${p.package_qty ? ` | 1 ${p.purchase_unit} = ${p.package_qty}${p.package_unit}` : ""}`)
        .join("\n")
    : "(no products recorded yet for this restaurant)";

  return [
    `New item name: "${name}" — it is bought as one whole "${hintUnit}"${hintPrice ? ` at roughly ${hintPrice} per ${hintUnit}` : ""}.`,
    "",
    "This restaurant's existing products:",
    listText,
    "",
    "First decide: is this the SAME real-world product as one already in the list above (same core item, ignoring brand/wording differences)? If so, set matched_product_name to that exact string and ignore package_qty/package_unit.",
    "",
    `If it's genuinely new, infer that one "${hintUnit}" package's real size from the item's own name/label (look for a pattern like "1KG", "5LT", "400g", "15 dúzias", "25F(45GR)"). If a label shows something like "1kg*10", use the price to sanity-check whether it's actually sold as the small size (1kg) or the multiplied case (10kg) — the per-kg price implied by each option should be realistic for that product.`,
    "If you truly cannot infer a package size, leave package_qty/package_unit null.",
  ].join("\n");
}

// Deterministic override for the "1kg*10" style label — a whole-package
// unit whose name spells out both a per-piece size AND a case multiplier.
// Confirmed this session (real Vera invoice data): the purchase's own
// recorded quantity/price is per PIECE (one bag), not per case — an LLM
// asked to pick between the two sizes gets this wrong often enough (plain
// numeric judgment call, no real ambiguity once you know the convention)
// that it's safer to just read the smaller number straight off the label
// than to ask the model to choose.
function extractPackageSizeFromLabel(name) {
  const m = String(name).match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml)\s*[x×*]\s*\d+/i);
  if (!m) return null;
  return { package_qty: parseFloat(m[1].replace(",", ".")), package_unit: m[2].toLowerCase() };
}

// Resolves a raw item name (from a purchase row or a recipe ingredient line)
// to a Product id — reusing exact-name matching first (cheap, matches how
// name matching already works throughout lib/calculations.js), then an
// AI-assisted match-or-create call reusing the same package-size inference
// already proven in the Menu PDF importer's matching step. Callers own their
// own `existingProducts` list (typically shared across a whole import batch
// via createProductResolver below) so repeated calls don't each re-fetch.
//
// `unitIsAuthoritative`: set true when hintUnit is literally the unit this
// item was just purchased in (a purchase row's own unit) — in that case
// purchase_unit is already known and must never be re-guessed by the AI; it
// only needs to (a) check for a match and (b) infer package size when the
// known unit is a whole-package unit. Leave false when hintUnit is merely a
// recipe/menu unit (grams etc.), which says nothing about how the product is
// actually purchased.
export async function resolveOrCreateProduct({ supabase, restaurantId, rawName, hintUnit, hintPrice, existingProducts, unitIsAuthoritative = false }) {
  const name = (rawName || "").trim();
  if (!name) return null;

  const products = existingProducts || (await supabase.from("products").select("*").eq("restaurant_id", restaurantId).then(({ data }) => data || []));

  const exact = products.find((p) => norm(p.name) === norm(name));
  if (exact) return { productId: exact.id, created: false, product: exact };

  // Fast path: we already know the real purchase unit, and it's already a
  // real weight/volume unit — no package-size conversion is possible or
  // needed, so there's nothing left to infer. Skip the AI call entirely.
  if (unitIsAuthoritative && hintUnit && classifyUnit(hintUnit).dim !== `count:${norm(hintUnit)}`) {
    return insertProduct({ supabase, restaurantId, name, resolved: { purchase_unit: hintUnit, package_qty: null, package_unit: null } });
  }

  // Fast path: a whole-package unit whose own label spells out an
  // unambiguous per-piece size (e.g. "1kg*10") — read it directly instead
  // of asking the AI to choose between the piece size and the case size.
  if (unitIsAuthoritative && hintUnit) {
    const labelSize = extractPackageSizeFromLabel(name);
    if (labelSize) {
      return insertProduct({ supabase, restaurantId, name, resolved: { purchase_unit: hintUnit, ...labelSize } });
    }
  }

  let resolved = { purchase_unit: hintUnit || "un", package_qty: null, package_unit: null };
  try {
    const tool = unitIsAuthoritative ? RESOLVE_TOOL_KNOWN_UNIT : RESOLVE_TOOL;
    const prompt = unitIsAuthoritative
      ? buildKnownUnitPrompt({ name, hintUnit, hintPrice, existingProducts: products })
      : buildPrompt({ name, hintUnit, hintPrice, existingProducts: products });
    const response = await anthropic.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 300,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: prompt }],
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    const out = toolUse?.input || {};
    if (out.matched_product_name) {
      const matched = products.find((p) => norm(p.name) === norm(String(out.matched_product_name).trim()));
      if (matched) return { productId: matched.id, created: false, product: matched };
    }
    resolved = unitIsAuthoritative
      ? { purchase_unit: hintUnit, package_qty: out.package_qty ?? null, package_unit: out.package_unit ?? null }
      : { purchase_unit: out.purchase_unit || hintUnit || "un", package_qty: out.package_qty ?? null, package_unit: out.package_unit ?? null };
  } catch (err) {
    console.error("resolveOrCreateProduct AI call failed, falling back to raw hints:", err);
  }

  return insertProduct({ supabase, restaurantId, name, resolved });
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

// Batches resolveOrCreateProduct across many calls sharing one restaurant:
// fetches the product list once, and keeps it updated in-memory as new
// products get created mid-batch so later items in the same batch (and
// near-duplicate names within it) resolve to the same new product instead
// of each spawning their own AI call / duplicate row.
export function createProductResolver({ supabase, restaurantId }) {
  let productsPromise = null;
  const cache = new Map();

  const ensureProducts = () => {
    if (!productsPromise) {
      productsPromise = supabase.from("products").select("*").eq("restaurant_id", restaurantId).then(({ data }) => data || []);
    }
    return productsPromise;
  };

  return async function resolve(rawName, hintUnit, hintPrice, unitIsAuthoritative = false) {
    const name = (rawName || "").trim();
    if (!name) return null;
    const key = norm(name);
    if (cache.has(key)) return cache.get(key);

    const products = await ensureProducts();
    const exact = products.find((p) => norm(p.name) === key);
    if (exact) { cache.set(key, exact.id); return exact.id; }

    const result = await resolveOrCreateProduct({ supabase, restaurantId, rawName: name, hintUnit, hintPrice, existingProducts: products, unitIsAuthoritative });
    cache.set(key, result.productId);
    if (result.created) {
      products.push(result.product);
      productsPromise = Promise.resolve(products);
    }
    return result.productId;
  };
}
