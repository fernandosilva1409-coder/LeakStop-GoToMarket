import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { fetchAllRows } from "./supabaseUtils";
import { ensureWeatherData, loadWeatherData, fetchForecast } from "./weather";
import { buildDishInfo } from "./weatherAnalytics";

// Fetches everything the Weather page needs: sales + dishes (for the join),
// cached historical weather (synced from Open-Meteo if there are gaps), and a
// forecast for the next 7 days. All client-side, RLS-scoped, same pattern as
// useAnalysis.js.
//
// Returns the raw sales/weather/dishInfoByName rather than pre-computed
// correlation/sensitivity so the page can recompute those over a filtered
// date range (a range pill) without any extra network round-trip.
export function useWeatherAnalytics(restaurant) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurant) return;
    let active = true;
    (async () => {
      setLoading(true);
      const hasLocation = !!(restaurant.latitude && restaurant.longitude);

      const [dishRows, saleRows] = await Promise.all([
        fetchAllRows(() => supabase.from("dishes").select("*").eq("restaurant_id", restaurant.id)),
        fetchAllRows(() => supabase.from("sales").select("*").eq("restaurant_id", restaurant.id)),
      ]);
      if (!active) return;

      if (!hasLocation) {
        setData({ hasLocation: false });
        setLoading(false);
        return;
      }

      const dishInfoByName = buildDishInfo((dishRows || []).map((d) => ({ name: d.name, category: d.category, price: d.price })));
      const sales = (saleRows || []).map((s) => ({ dish: s.dish_name, quantity: s.quantity, date: s.date }));

      const saleDates = sales.map((s) => s.date).filter(Boolean).sort();
      const minDate = saleDates[0];
      const maxDate = saleDates[saleDates.length - 1];

      let weather = [];
      if (minDate && maxDate) {
        await ensureWeatherData(supabase, restaurant, minDate, maxDate).catch(() => {});
        weather = await loadWeatherData(supabase, restaurant.id, minDate, maxDate).catch(() => []);
      }

      const forecast = await fetchForecast(restaurant.latitude, restaurant.longitude).catch(() => []);
      if (!active) return;

      setData({ hasLocation: true, hasData: weather.length > 0, sales, weather, dishInfoByName, forecast });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [restaurant]);

  return { data, loading };
}
