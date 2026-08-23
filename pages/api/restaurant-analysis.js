import { requireRestaurantMember } from "../../lib/apiAuth";
import { fetchAndComputeAnalysis, getCachedAnalysis } from "../../lib/analysisCache";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { restaurantId, rangeDays } = req.body || {};
  if (!restaurantId) return res.status(400).json({ error: "Missing restaurantId" });

  const { error: authError, supabase } = await requireRestaurantMember(req, restaurantId);
  if (authError) return res.status(403).json({ error: authError });

  try {
    let analysis;
    if (rangeDays) {
      // A bounded range is cheap enough on its own (filtered at the
      // database) that it isn't worth caching a variant per possible range.
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - Number(rangeDays));
      analysis = await fetchAndComputeAnalysis(supabase, restaurantId, { minDate: cutoff.toISOString().slice(0, 10) });
    } else {
      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants").select("*").eq("id", restaurantId).single();
      if (restaurantError || !restaurant) return res.status(404).json({ error: "Restaurant not found" });
      analysis = await getCachedAnalysis(supabase, restaurant);
    }
    return res.status(200).json({ analysis });
  } catch (err) {
    console.error("restaurant-analysis error:", err);
    return res.status(500).json({ error: "Could not compute analysis" });
  }
}
