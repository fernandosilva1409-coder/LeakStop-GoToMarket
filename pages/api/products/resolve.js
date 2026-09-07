import { requireRestaurantMember } from "../../../lib/apiAuth";
import { createProductResolver } from "../../../lib/products";

// Resolves a batch of raw item names (purchase line items or recipe
// ingredient names) to Product ids, creating new products (AI-assisted)
// where needed — shared by every write path (manual entry, CSV, PDF import)
// on both Purchases and Menu, so both use the exact same resolution logic
// and end up pointing at the same Product for the same real-world item.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { restaurantId, items } = req.body || {};
  if (!restaurantId || !Array.isArray(items)) {
    return res.status(400).json({ error: "Missing restaurantId or items" });
  }

  const { error: authError, supabase } = await requireRestaurantMember(req, restaurantId);
  if (authError) return res.status(403).json({ error: authError });

  const resolve = createProductResolver({ supabase, restaurantId });
  const products = {};
  for (const it of items) {
    const name = (it?.name || "").trim();
    if (!name || products[name] !== undefined) continue;
    try {
      products[name] = await resolve(name, it.unit, it.price, it.source === "purchase");
    } catch (err) {
      console.error("resolve product failed for", name, err);
      products[name] = null;
    }
  }
  return res.status(200).json({ products });
}
