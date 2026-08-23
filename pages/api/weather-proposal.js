import { anthropic, CHAT_MODEL } from "../../lib/anthropic";
import { requireRestaurantMember } from "../../lib/apiAuth";
import { fetchAllRows } from "../../lib/supabaseUtils";
import { ensureWeatherData, loadWeatherData, fetchForecast, weatherCondition, tempBand } from "../../lib/weather";
import { computeWeatherCorrelation, computeDishWeatherSensitivity, buildDishInfo } from "../../lib/weatherAnalytics";

const LANGUAGE_NAMES = { pt: "Portuguese", en: "English", de: "German", fr: "French", es: "Spanish" };
const CACHE_MS = 24 * 60 * 60 * 1000;

function buildSystemPrompt(restaurant) {
  const languageName = LANGUAGE_NAMES[restaurant.language] || "Portuguese";
  return [
    'You write a short weekly "weather proposal" for the Weather page of LeakStop, a restaurant analytics app.',
    `You are writing for "${restaurant.name}" only, using the real historical weather-vs-sales data and 7-day forecast provided as JSON.`,
    "Think it through, don't just parrot the raw numbers: a dish's \"best condition\" is only meaningful if it's backed by a reasonable number of days — if a suggestion rests on very few days (say, under 5), say so plainly and hedge it, rather than stating it as a confident fact. If a forecasted condition has no direct historical match and the data uses a temperature-band estimate instead, mention that it's an estimate.",
    "Each forecast day already includes its correct weekday name — use that field verbatim when referring to a day, never compute or guess the weekday from the date yourself.",
    "Write 3 to 5 short sentences: a one-line outlook for the coming week (which days look best/worst and why, in revenue terms), then concrete, reasoned prep/menu suggestions for the strongest signals only (don't list every dish) — explain the *why* in one clause, not just the dish name.",
    `Monetary values are already in ${restaurant.currency || "EUR"} — don't convert or relabel them.`,
    "Plain prose only — no markdown, no bullet points, no headers, no bold.",
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

  if (!restaurant.latitude || !restaurant.longitude) {
    return res.status(400).json({ error: "No location set for this restaurant" });
  }

  const isFresh = restaurant.weather_proposal && restaurant.weather_proposal_at
    && Date.now() - new Date(restaurant.weather_proposal_at).getTime() < CACHE_MS;
  if (isFresh) {
    return res.status(200).json({ proposal: restaurant.weather_proposal, generatedAt: restaurant.weather_proposal_at, cached: true });
  }

  try {
    const [dishRows, saleRows, excludedRows] = await Promise.all([
      fetchAllRows(() => supabase.from("dishes").select("*").eq("restaurant_id", restaurant.id)),
      fetchAllRows(() => supabase.from("sales").select("*").eq("restaurant_id", restaurant.id)),
      fetchAllRows(() => supabase.from("excluded_categories").select("*").eq("restaurant_id", restaurant.id)).catch(() => []),
    ]);
    const dishInfoByName = buildDishInfo((dishRows || []).map((d) => ({ name: d.name, category: d.category, price: d.price })));
    const sales = (saleRows || []).map((s) => ({ dish: s.dish_name, quantity: s.quantity, date: s.date }));
    const excludedCategories = (excludedRows || []).map((r) => r.category);

    const saleDates = sales.map((s) => s.date).filter(Boolean).sort();
    const minDate = saleDates[0];
    const maxDate = saleDates[saleDates.length - 1];
    let weather = [];
    if (minDate && maxDate) {
      await ensureWeatherData(supabase, restaurant, minDate, maxDate).catch(() => {});
      weather = await loadWeatherData(supabase, restaurant.id, minDate, maxDate).catch(() => []);
    }

    const { byCondition, byTemperature } = computeWeatherCorrelation(sales, weather, dishInfoByName);
    const sensitivity = computeDishWeatherSensitivity(sales, weather, dishInfoByName, { excludedCategories }).slice(0, 8);
    const forecast = await fetchForecast(restaurant.latitude, restaurant.longitude).catch(() => []);

    if (!forecast.length || (!byCondition.length && !byTemperature.length)) {
      return res.status(400).json({ error: "Not enough data to write a proposal yet" });
    }

    const forecastSummary = forecast.map((day) => ({
      date: day.date,
      // Spelled out explicitly — don't make the model compute the weekday
      // from an ISO date itself, it's an easy place for it to get it wrong.
      weekday: new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
      condition: weatherCondition(day.code),
      tempBand: tempBand(day.tempMax),
      tempMax: day.tempMax,
      tempMin: day.tempMin,
    }));

    const payload = { currency: restaurant.currency || "EUR", forecast: forecastSummary, byCondition, byTemperature, dishSensitivity: sensitivity };

    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 400,
      system: [{ type: "text", text: buildSystemPrompt(restaurant), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    const proposal = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const generatedAt = new Date().toISOString();

    await supabase.from("restaurants").update({ weather_proposal: proposal, weather_proposal_at: generatedAt }).eq("id", restaurant.id);

    return res.status(200).json({ proposal, generatedAt, cached: false });
  } catch (err) {
    console.error("Weather proposal error:", err);
    return res.status(500).json({ error: "Could not generate the proposal" });
  }
}
