import { anthropic, EXTRACTION_MODEL } from "../../../lib/anthropic";
import { requireRestaurantMember } from "../../../lib/apiAuth";
import { fetchAllRows } from "../../../lib/supabaseUtils";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const PURCHASE_TOOL = {
  name: "record_purchase_items",
  description: "Records the purchase line items extracted from a supplier invoice or delivery note.",
  input_schema: {
    type: "object",
    properties: {
      supplier: { type: "string", description: "The supplier/vendor company name shown on the document's letterhead." },
      date: { type: "string", description: "The invoice/order date shown on the document, formatted YYYY-MM-DD." },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string", description: "Product name/description exactly as shown on the invoice." },
            quantity: { type: "number", description: "The quantity purchased, in the unit given." },
            unit: { type: "string", description: "Short unit label, e.g. kg, g, l, ml, un, cx." },
            unit_price: { type: "number", description: "Price per unit, EXCLUDING VAT/tax, as shown on the invoice line." },
          },
          required: ["item", "quantity", "unit", "unit_price"],
        },
      },
    },
    required: ["supplier", "date", "items"],
  },
};

const SALE_TOOL = {
  name: "record_sale_items",
  description: "Records the sale line items (dishes/products sold, with quantities) extracted from a sales report.",
  input_schema: {
    type: "object",
    properties: {
      date: { type: "string", description: "The report/sale date shown on the document, formatted YYYY-MM-DD." },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dish_name: { type: "string", description: "Name of the dish/product sold, exactly as shown." },
            quantity: { type: "number", description: "Total quantity sold." },
          },
          required: ["dish_name", "quantity"],
        },
      },
    },
    required: ["date", "items"],
  },
};

const PURCHASE_INSTRUCTIONS = [
  "Extract every distinct product line from this supplier invoice or delivery note as one purchase item.",
  "Skip subtotal, discount, packaging-deposit, delivery-fee, and other non-product summary rows.",
  "unit_price must be the price EXCLUDING VAT/tax for that line — this document may show VAT separately (a rate and amount, possibly in a summary table); always use the pre-VAT unit/line price, never a VAT-inclusive total.",
  "Pick quantity and unit consistently per line: if a line is priced per weight (a per-kg/per-litre price alongside a weight/volume column), use that weight/volume as quantity and \"kg\"/\"l\" as unit; if priced per discrete package or unit, use the unit count as quantity and a short unit label (un, cx, g, ml, etc.) as unit. Never mix the two for the same line.",
  "Infer supplier from the document's letterhead/issuer name (the company selling the goods, not the buyer), and date from the invoice/order date shown — if both a document date and a print/processing date appear, use the document/order date.",
].join(" ");

const SALE_INSTRUCTIONS = [
  "Extract every distinct dish/product sold from this sales report as one row, with its total quantity.",
  "Ignore prices, totals, and tax entirely — only dish name and quantity matter here.",
  "Infer the date from the report's date.",
].join(" ");

const MENU_TOOL = {
  name: "record_menu_dishes",
  description: "Records dishes and their recipes (ingredients + quantities) extracted from technical recipe sheets (fichas técnicas) or a menu document.",
  input_schema: {
    type: "object",
    properties: {
      dishes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Dish name exactly as titled on the card." },
            category: { type: "string", description: "Section/category the card belongs to (e.g. Antipasti, Massas, Sobremesas)." },
            price: { type: "number", description: "Selling price if shown anywhere on the document; 0 if this card is only an internal recipe/base component never sold directly to a customer (e.g. a sauce used inside other dishes)." },
            prep_time_minutes: { type: "number", description: "Estimated prep time in minutes if not stated: judge from the dish's real complexity (a plated cold starter ~5-10, fresh pasta with a cooked sauce ~15-20, a slow-braised main ~25-35, a drink/dessert assembled from pre-made components ~2-5)." },
            ingredients: {
              type: "array",
              description: "Only ingredients with an actual quantity on the card. Skip any line marked \"q.b.\" (to taste / as needed) entirely — it can't be costed.",
              items: {
                type: "object",
                properties: {
                  recipe_name: { type: "string", description: "Ingredient name exactly as written on the card." },
                  recipe_qty: { type: "number", description: "Quantity as written, already converted from a batch yield down to ONE serving: if the card states a yield like \"70-80 doses\" (use the midpoint) or \"1,2 L\" for N doses, divide every quantity on that card by the dose count. If the card already says \"1 dose\", use the amount as-is." },
                  recipe_unit: { type: "string", description: "Unit as written on the card (g, kg, ml, l, un, fatia, folha, dente, pacote, etc.), after the per-serving division above." },
                  matched_purchase_item: { type: ["string", "null"], description: "The EXACT name (character-for-character) of one entry from the provided purchase list, if you're confident it's the same real-world product this ingredient refers to. Null if no purchase in the list is plausibly the same product." },
                  qty: { type: "number", description: "The quantity to actually store — see the conversion rules in the instructions. Equal to recipe_qty if matched_purchase_item is null." },
                  unit: { type: "string", description: "The unit to actually store — see the conversion rules. Equal to recipe_unit if matched_purchase_item is null." },
                  match_confidence: { type: "string", enum: ["high", "medium", "low", "none"], description: "Your confidence that matched_purchase_item is genuinely the same product and the size/price assumption behind qty/unit is sound." },
                },
                required: ["recipe_name", "recipe_qty", "recipe_unit", "qty", "unit", "match_confidence"],
              },
            },
          },
          required: ["name", "price", "ingredients"],
        },
      },
    },
    required: ["dishes"],
  },
};

function buildMenuInstructions(purchaseSummary) {
  return [
    "Extract every dish/recipe card on this document. Technical recipe sheets typically show: a dish name, a section header (Bases, Antipasti, Massas, Pratos Carne, Sobremesas, ...), a yield line like \"30-40 doses\" or \"1 dose\", and an ingredient list with quantities (some marked \"q.b.\" = to taste, unquantifiable).",
    "Per-serving conversion: divide every quantity on a card by its dose count (use the midpoint for a range) so recipe_qty/recipe_unit is always for ONE serving of that dish — except when the card itself already labels a sub-section \"(1 dose)\", which is already per-serving regardless of the card's overall yield.",
    "Skip \"q.b.\" ingredient lines entirely — do not invent a quantity for them.",
    "",
    "Matching against real purchases (this is the important part): you're given this restaurant's actual distinct purchased items below, each with its unit and average price paid. For every ingredient with a real quantity, decide if one of these is plausibly the same product (same core ingredient, ignore minor descriptive differences). If yes, set matched_purchase_item to that EXACT string and compute qty/unit as follows:",
    "  - If the purchase's unit is a real weight/volume unit (kg, g, l, ml): convert recipe_qty/recipe_unit into that SAME unit (or the matching dimension — kg and g are both fine since they're mass; l and ml are both fine since they're volume). For a count-based recipe line (e.g. \"2 fatias\", \"1 dente\", \"1 un\" of a whole small item), estimate a realistic per-piece weight (e.g. a thin cured-meat slice ~10-20g, a whole small tomato/apple ~150-180g, a garlic clove ~5g) and multiply.",
    "  - If the purchase's unit is a whole-package count unit (un, cx — meaning it was bought as one priced package, not by weight): you must express usage as a FRACTION OF ONE PACKAGE. First infer that package's real size from its own name/label (look for an explicit weight/volume like \"1KG\", \"5LT\", \"3kg\", \"400g\", \"15 dúzias\", \"25F(45GR)\") — if a label has a pattern like \"1kg*10\", sanity-check with the average price whether the purchased unit is the small size (1kg) or the multiplied case (10kg) by comparing the implied per-kg/per-litre price against what's realistic for that product; the average price given is your only way to catch this, so use it. Then qty = (recipe amount in the same dimension) / (package size in that dimension), unit = the purchase's own unit string (\"un\"/\"cx\").",
    "  - If you cannot confidently match or size a purchase, set matched_purchase_item to null and just pass recipe_qty/recipe_unit through unchanged as qty/unit, with match_confidence \"none\".",
    "  - Never silently store a gram/ml quantity against a purchase you know was bought as a whole \"un\"/\"cx\" package — that mismatch makes cost tracking silently report zero for that ingredient everywhere it's used, which is the exact bug this matching step exists to prevent.",
    "",
    "This restaurant's real purchased items (name | unit | average price paid):",
    purchaseSummary,
  ].join("\n");
}

// Same "mass" | "volume" | "count:<label>" classification calculations.js
// uses for cost matching — lets us deterministically catch the case where
// Claude names a real purchased item but returns a unit dimension that
// doesn't match how that item was actually bought (its self-reported
// match_confidence doesn't reliably catch this on its own).
function classifyDim(unit) {
  const u = String(unit || "").trim().toLowerCase();
  if (u === "g" || u === "kg") return "mass";
  if (u === "ml" || u === "l") return "volume";
  return `count:${u || "unit"}`;
}

// A very large tool_use input can come back from the streaming SDK with an
// array field left as an unparsed JSON string — sometimes even double-
// wrapped under the same key. Unwrap defensively rather than trust the
// field is already the array the schema promises.
function coerceDishes(raw) {
  let dishes = raw;
  if (typeof dishes === "string") {
    let parsed;
    try { parsed = JSON.parse(dishes); } catch { return []; }
    dishes = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.dishes) ? parsed.dishes : [];
  }
  return Array.isArray(dishes) ? dishes : [];
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { restaurantId, type, pdfBase64 } = req.body || {};
  if (!restaurantId || !type || !pdfBase64) {
    return res.status(400).json({ error: "Missing restaurantId, type, or pdfBase64" });
  }
  if (type !== "purchase" && type !== "sale" && type !== "menu") {
    return res.status(400).json({ error: "Invalid type" });
  }

  const { error: authError, supabase } = await requireRestaurantMember(req, restaurantId);
  if (authError) return res.status(403).json({ error: authError });

  try {
    if (type === "menu") {
      const purchaseRows = await fetchAllRows(() =>
        supabase.from("purchases").select("item, unit, quantity, unit_price").eq("restaurant_id", restaurantId)
      );
      const byItem = {};
      (purchaseRows || []).forEach((p) => {
        const k = p.item.trim();
        byItem[k] = byItem[k] || { unit: p.unit, totalQty: 0, totalCost: 0 };
        byItem[k].totalQty += Number(p.quantity) || 0;
        byItem[k].totalCost += (Number(p.quantity) || 0) * (Number(p.unit_price) || 0);
      });
      const purchaseSummary = Object.entries(byItem)
        .map(([name, v]) => `${name} | ${v.unit} | avg price ${v.totalQty > 0 ? (v.totalCost / v.totalQty).toFixed(3) : "0"}`)
        .join("\n") || "(no purchases recorded yet for this restaurant)";

      // Streamed: a full fichas-técnicas document can legitimately need
      // tens of thousands of output tokens (dozens of dishes, each with
      // several verbose per-ingredient fields), which risks the SDK's
      // non-streaming timeout.
      const response = await anthropic.messages.stream({
        model: EXTRACTION_MODEL,
        max_tokens: 32000,
        tools: [MENU_TOOL],
        tool_choice: { type: "tool", name: MENU_TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
              { type: "text", text: buildMenuInstructions(purchaseSummary) },
            ],
          },
        ],
      }).finalMessage();

      const toolUse = response.content.find((block) => block.type === "tool_use");
      if (!toolUse) return res.status(500).json({ error: "Could not extract structured data from this PDF." });
      const dishes = coerceDishes(toolUse.input?.dishes);

      // Deterministic safety net: Claude's own match_confidence isn't fully
      // reliable at this output size — independently verify that a claimed
      // match's returned unit is even the right DIMENSION for how that
      // purchase was actually recorded, and downgrade if not. This is
      // exactly the class of bug (grams stored against a whole-package
      // purchase) that made cost tracking silently zero out earlier.
      for (const dish of dishes) {
        for (const ing of dish.ingredients || []) {
          if (!ing.matched_purchase_item) continue;
          const purchase = byItem[ing.matched_purchase_item.trim()];
          if (!purchase) { ing.match_confidence = "low"; continue; }
          const purchaseDim = classifyDim(purchase.unit);
          if (purchaseDim !== classifyDim(ing.unit)) {
            ing.match_confidence = "low";
            continue;
          }
          // A single serving essentially never uses less than ~1/10000 or
          // more than a few whole packages — outside that range the match
          // is probably right but the arithmetic (dividing by an inferred
          // package size) is off by a decimal place or more, which the
          // dimension check above can't catch on its own.
          if (purchaseDim.startsWith("count:") && (ing.qty < 0.0001 || ing.qty > 3)) {
            ing.match_confidence = "low";
          }
        }
      }

      return res.status(200).json({ dishes });
    }

    const tool = type === "purchase" ? PURCHASE_TOOL : SALE_TOOL;
    const instructions = type === "purchase" ? PURCHASE_INSTRUCTIONS : SALE_INSTRUCTIONS;

    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: instructions },
          ],
        },
      ],
    });

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse) return res.status(500).json({ error: "Could not extract structured data from this PDF." });

    const { date, supplier, items } = toolUse.input || {};
    return res.status(200).json({ items: Array.isArray(items) ? items : [], date: date || null, supplier: supplier || null });
  } catch (err) {
    console.error("extract-pdf error:", err);
    return res.status(500).json({ error: "Failed to process the PDF." });
  }
}
