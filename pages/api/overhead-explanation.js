import { anthropic, ANALYSIS_MODEL } from "../../lib/anthropic";
import { requireRestaurantMember } from "../../lib/apiAuth";
import { getCachedAnalysis } from "../../lib/analysisCache";

const LANGUAGE_NAMES = { pt: "Portuguese", en: "English", de: "German", fr: "French", es: "Spanish" };
const CACHE_MS = 24 * 60 * 60 * 1000;

function buildSystemPrompt(restaurant) {
  const languageName = LANGUAGE_NAMES[restaurant.language] || "Portuguese";
  return [
    'You explain, in plain language, why the "overhead per plate" numbers on the Dashboard/Rentabilidade tab of LeakStop (a restaurant analytics app) look the way they do, for the owner of "' + restaurant.name + '".',
    "You're given the real pre-computed numbers as JSON — the monthly overhead total, how many days of sales the current data actually covers, the total units sold across all dishes in that period, which allocation method is active, and (if any) the dishes with the worst full-cost-vs-price gap. Don't invent numbers beyond what's given.",
    "The mechanism, so you reason about it correctly: monthly overhead (labour, rent, energy, etc.) is scaled to the number of days the sales data covers, then divided across dishes sold in that same period — evenly per unit sold, or weighted by prep time if that's the active method. So overhead-per-plate is mechanically high whenever total units sold in the period is small relative to the overhead total for that period — this is arithmetic, not a bug, and it's usually a sign that either the sales data only covers a partial/low-traffic slice of the business, or the overhead inputs in Definições > Overhead no longer match the restaurant's actual current scale.",
    "Be concrete: cite the actual overhead total, the actual period length, and the actual total units sold from the JSON, and reference the worst dish(es) by name if given. Then suggest one or two concrete next steps: check whether the overhead inputs match reality, check whether more sales history should be imported, or reconsider that dish's price given its real full cost.",
    "Write 3 to 5 short sentences, plain prose only — no markdown, no bullet points, no headers, no bold.",
    `Always respond in ${languageName}. If replying in Portuguese, use European Portuguese with the informal "tu" register (e.g. "tens", "podes"), never Brazilian Portuguese or "você".`,
  ].join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { restaurantId } = req.body || {};
  if (!restaurantId) return res.status(400).json({ error: "Missing restaurantId" });

  const { error: authError, supabase } = await requireRestaurantMember(req, restaurantId);
  if (authError) return res.status(403).json({ error: authError });

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants").select("*").eq("id", restaurantId).single();
  if (restaurantError || !restaurant) return res.status(404).json({ error: "Restaurant not found" });

  const isFresh = restaurant.overhead_explanation && restaurant.overhead_explanation_at
    && Date.now() - new Date(restaurant.overhead_explanation_at).getTime() < CACHE_MS;
  if (isFresh) {
    return res.status(200).json({ explanation: restaurant.overhead_explanation, generatedAt: restaurant.overhead_explanation_at, cached: true });
  }

  try {
    const [analysis, { data: overheadRow }] = await Promise.all([
      getCachedAnalysis(supabase, restaurant),
      supabase.from("overhead_settings").select("method").eq("restaurant_id", restaurantId).maybeSingle(),
    ]);

    if (!analysis?.dishRows?.length || !analysis.totalOverhead || !analysis.periodDaysUsed) {
      return res.status(400).json({ error: "Not enough data to explain overhead yet" });
    }

    const totalUnitsSold = analysis.dishRows.reduce((s, d) => s + (d.sold || 0), 0);
    const worstDishes = analysis.dishRows
      .filter((d) => d.sold > 0 && d.price > 0)
      .sort((a, b) => a.fullMarginPct - b.fullMarginPct)
      .slice(0, 3)
      .map((d) => ({
        name: d.name,
        price: Number(d.price.toFixed(2)),
        foodCost: Number(d.cost.toFixed(2)),
        overheadPerPlate: Number(d.overheadPerPlate.toFixed(2)),
        fullCost: Number(d.fullCost.toFixed(2)),
        unitsSoldInPeriod: d.sold,
      }));

    const payload = {
      currency: restaurant.currency || "EUR",
      monthlyOverheadTotal: Number(analysis.monthlyOverheadTotal.toFixed(2)),
      periodDaysCoveredBySalesData: analysis.periodDaysUsed,
      overheadTotalForThatPeriod: Number(analysis.totalOverhead.toFixed(2)),
      totalUnitsSoldInThatPeriod: totalUnitsSold,
      allocationMethod: overheadRow?.method === "prepTime" ? "weighted by prep time per dish" : "spread evenly per unit sold",
      worstFullCostVsPriceDishes: worstDishes,
    };

    const response = await anthropic.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 500,
      system: buildSystemPrompt(restaurant),
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    const explanation = response.content.find((b) => b.type === "text")?.text?.trim();
    if (!explanation) return res.status(500).json({ error: "No explanation generated" });

    const generatedAt = new Date().toISOString();
    await supabase.from("restaurants").update({ overhead_explanation: explanation, overhead_explanation_at: generatedAt }).eq("id", restaurantId);

    return res.status(200).json({ explanation, generatedAt, cached: false });
  } catch (err) {
    console.error("overhead-explanation error:", err);
    return res.status(500).json({ error: "Could not generate explanation" });
  }
}
