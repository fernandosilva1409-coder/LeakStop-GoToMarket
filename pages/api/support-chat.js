import { anthropic, CHAT_MODEL } from "../../lib/anthropic";
import { requireAuth } from "../../lib/apiAuth";

const LANGUAGE_NAMES = { pt: "Portuguese", en: "English", de: "German", fr: "French", es: "Spanish" };
const MAX_HISTORY_MESSAGES = 20;

const KNOWLEDGE = `
LeakStop is a food-cost and margin analytics app for a single restaurant per account. Pages, in the left sidebar:

- Dashboard: KPI cards (total revenue, waste cost, food-cost margin, full margin, % of sales not matched to a menu dish), a bar chart of the top wasted ingredients by cost, a searchable table of ingredient purchased/used/waste/shortage (rows with mismatched units — e.g. an ingredient bought in "kg" but used in "unit" on a recipe — show a "fix units" badge instead of numbers, because waste can't be computed across incompatible units), a table of purchased items that never matched any recipe ingredient, and a searchable, category-filterable dish profitability table (food cost, overhead per plate, full cost, price, full margin).
- Menu: add/edit/delete dishes (name, category, price, prep time in minutes) each with a list of ingredients (name, quantity, unit — g/kg/ml/l/unit/etc). CSV import expects columns: dish, category, price, prep_time, ingredient, qty, unit — one row per ingredient, with the dish's own fields repeated on every one of its ingredient rows. A dish with no ingredients has no food-cost/margin data and is excluded from cost calculations until a recipe is added.
- Compras (Purchases): log what was bought — item, quantity, unit, unit price, date, supplier. CSV import expects: item, quantity, unit, unit_price, date, supplier.
- Vendas (Sales): log what was actually sold — dish name (must match a Menu dish name to be counted in margin calculations; a name that doesn't match shows up as "unmatched sales"), quantity, date. CSV import expects: dish_name, quantity, date.
- Overhead: fixed monthly costs (kitchen/dining-room/other labor, payroll taxes, rent, electricity, gas, water, waste collection, cleaning supplies, software/admin, other) and how to spread them across dishes — evenly per dish sold, or weighted by each dish's prep time (dishes that take longer to make absorb more overhead).
- Recomendações: classifies every dish with a recipe into Star (popular + profitable), Plowhorse (popular but thin margin — consider a small price increase), Puzzle (profitable but underordered — promote it more), or Dog (both unpopular and unprofitable — rework, reprice, or drop it), based on comparing each dish to the median of its own category. Also lists waste alerts (bought much more of an ingredient than recipes account for) and shortage alerts (sold more than purchases can explain).
- Chat with Your Data: an AI assistant that answers questions about THIS restaurant's own real numbers — sales, purchases, margins, waste, trends by week/month/weekday, supplier costs — by calling read-only tools over the restaurant's data. Answers can be pinned as a chart to the Análises page.
- Análises: charts and KPIs the user has pinned from Chat with Your Data, saved permanently until deleted.
- Definições: restaurant's display language and currency (applies across the whole dashboard).
- Subscription: a 5-day free trial, then a flat monthly fee, managed through Stripe from the Dashboard page ("Subscrever"/manage subscription button). No self-serve integrations (POS systems, accounting software, etc.) exist yet.

There is no separate "support ticket" system — this chat is the support channel. If someone needs something this chat genuinely can't resolve (a bug, a billing dispute, a data-correction request, an integration request), say so plainly and tell them their message has been noted, without inventing a ticket number, email address, or promised response time that doesn't exist.
`.trim();

function buildSystemPrompt(language) {
  const languageName = LANGUAGE_NAMES[language] || "Portuguese";
  return [
    'You are the support assistant for LeakStop, a restaurant food-cost and margin analytics app. You help users understand how to use the product — not their restaurant\'s data (a separate "Chat with Your Data" assistant handles that).',
    "You have no tools and no access to any restaurant's data, billing details, or account status — never guess or invent numbers, account state, or what a specific user has done. If asked about their own data, tell them to use \"Chat with Your Data\" instead.",
    "Here is everything you know about how LeakStop works:",
    KNOWLEDGE,
    "Keep answers short and concrete — a few sentences, not a manual. This is a chat panel, not a report.",
    "This chat panel renders plain text only, not markdown — never use **bold**, bullet/dash lists, or headers. Write plain sentences, and use a plain \"em — dash\" or commas to separate items instead of a list.",
    `Always respond in ${languageName}, regardless of the language of these instructions. If replying in Portuguese, use European Portuguese with the informal "tu" register (e.g. "tens", "podes", "a tua conta"), never Brazilian Portuguese or "você".`,
  ].join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { language, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing messages" });
  }

  const { error: authError } = await requireAuth(req);
  if (authError) return res.status(403).json({ error: authError });

  const conversation = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));
  if (conversation.length === 0 || conversation[conversation.length - 1].role !== "user") {
    return res.status(400).json({ error: "Last message must be from the user" });
  }

  try {
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 512,
      system: [{ type: "text", text: buildSystemPrompt(language), cache_control: { type: "ephemeral" } }],
      messages: conversation,
    });
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return res.status(200).json({ reply: text });
  } catch (err) {
    console.error("Support chat error:", err);
    return res.status(500).json({ error: "Could not reach the assistant" });
  }
}
