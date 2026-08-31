import { anthropic, EXTRACTION_MODEL } from "../../../lib/anthropic";
import { requireRestaurantMember } from "../../../lib/apiAuth";

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { restaurantId, type, pdfBase64 } = req.body || {};
  if (!restaurantId || !type || !pdfBase64) {
    return res.status(400).json({ error: "Missing restaurantId, type, or pdfBase64" });
  }
  if (type !== "purchase" && type !== "sale") {
    return res.status(400).json({ error: "Invalid type" });
  }

  const { error: authError } = await requireRestaurantMember(req, restaurantId);
  if (authError) return res.status(403).json({ error: authError });

  const tool = type === "purchase" ? PURCHASE_TOOL : SALE_TOOL;
  const instructions = type === "purchase" ? PURCHASE_INSTRUCTIONS : SALE_INSTRUCTIONS;

  try {
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
