import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Shared by dashboard/index.js, recommendations.js, sales.js, purchases.js.
// Calls /api/restaurant-analysis instead of fetching+computing client-side —
// the server caches the all-time analysis (invalidated by DB triggers on
// write, see supabase/schema.sql) so a restaurant with hundreds of
// thousands of sales/purchase rows never ships them all to the browser just
// to render a KPI card. `rangeDays` (30/90/365, or omitted for all-time)
// is filtered at the database on the server, not client-side — so
// switching the period is now a network call instead of an instant local
// re-filter, in exchange for never loading full history into the browser.
export function useAnalysis(restaurant, rangeDays) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurant) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/restaurant-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ restaurantId: restaurant.id, rangeDays }),
      });
      const body = await res.json();
      if (!active) return;
      if (res.ok) setAnalysis(body.analysis);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [restaurant?.id, rangeDays]);

  return { analysis, loading };
}
