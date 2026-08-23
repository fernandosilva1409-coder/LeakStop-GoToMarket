import { fetchAllRows } from "./supabaseUtils";

// WMO weather codes (what Open-Meteo returns) collapsed into a small set of
// human categories — enough resolution to spot a real sales pattern without
// asking the model to reason about 20+ raw numeric codes.
const WEATHER_CODE_GROUPS = {
  clear: [0],
  cloudy: [1, 2, 3],
  fog: [45, 48],
  rain: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82],
  snow: [71, 73, 75, 77, 85, 86],
  storm: [95, 96, 99],
};

export function weatherCondition(code) {
  for (const [label, codes] of Object.entries(WEATHER_CODE_GROUPS)) {
    if (codes.includes(code)) return label;
  }
  return "unknown";
}

export function tempBand(tempMax) {
  if (tempMax === null || tempMax === undefined) return null;
  if (tempMax < 12) return "cold";
  if (tempMax < 22) return "mild";
  if (tempMax < 28) return "warm";
  return "hot";
}

// Fetches and caches any missing days of historical weather for the
// restaurant's location, covering [minDate, maxDate]. No-ops if the
// restaurant hasn't set a location, or the range is already fully cached.
// Open-Meteo's free archive API needs no key and covers one date range per
// call, so this is a single HTTP request per restaurant per gap — not
// per day.
export async function ensureWeatherData(supabase, restaurant, minDate, maxDate) {
  if (!restaurant.latitude || !restaurant.longitude || !minDate || !maxDate) return;

  const { count } = await supabase
    .from("weather_daily")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id)
    .gte("date", minDate)
    .lte("date", maxDate);

  const expectedDays = Math.round((new Date(`${maxDate}T00:00:00Z`) - new Date(`${minDate}T00:00:00Z`)) / 86400000) + 1;
  if ((count || 0) >= expectedDays) return;

  // The archive API only serves fully-elapsed days (roughly a 5-day lag) —
  // clamp the request so a "sales through today" range doesn't 400.
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 6);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const fetchEnd = maxDate > cutoffKey ? cutoffKey : maxDate;
  if (fetchEnd < minDate) return;

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${restaurant.latitude}&longitude=${restaurant.longitude}&start_date=${minDate}&end_date=${fetchEnd}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`;

  let json;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    json = await res.json();
  } catch {
    return;
  }
  const daily = json?.daily;
  if (!daily?.time?.length) return;

  const rows = daily.time.map((date, i) => ({
    restaurant_id: restaurant.id,
    date,
    temp_max: daily.temperature_2m_max?.[i] ?? null,
    temp_min: daily.temperature_2m_min?.[i] ?? null,
    precipitation_mm: daily.precipitation_sum?.[i] ?? null,
    weather_code: daily.weathercode?.[i] ?? null,
  }));

  await supabase.from("weather_daily").upsert(rows, { onConflict: "restaurant_id,date" });
}

// Loads cached weather rows for a date range, mapped to the shape chat
// tools consume. Call ensureWeatherData first if you want gaps backfilled.
export async function loadWeatherData(supabase, restaurantId, minDate, maxDate) {
  if (!minDate || !maxDate) return [];
  const rows = await fetchAllRows(() =>
    supabase.from("weather_daily").select("*").eq("restaurant_id", restaurantId).gte("date", minDate).lte("date", maxDate)
  );
  return (rows || []).map((w) => ({
    date: w.date, tempMax: w.temp_max, tempMin: w.temp_min, precipitation: w.precipitation_mm, code: w.weather_code,
  }));
}
