import { requireRestaurantMember } from "../../../lib/apiAuth";
import { createProductResolver } from "../../../lib/products";

// Resolves a batch of raw item names to Product ids. Menu ingredients (no
// `source`) can create a new product, anchored to a matching purchase, when
// one doesn't exist yet; purchase line items (`source: "purchase"`) only
// ever link to a product that already exists — a purchase never spawns one
// on its own, so items that are never used in a recipe (packaging, cleaning
// supplies, ...) don't clutter the Products page.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { restaurantId, items } = req.body || {};
  if (!restaurantId || !Array.isArray(items)) {
    return res.status(400).json({ error: "Missing restaurantId or items" });
  }

  const { error: authError, supabase } = await requireRestaurantMember(req, restaurantId);
  if (authError) return res.status(403).json({ error: authError });

  const resolveMenu = createProductResolver({ supabase, restaurantId, kind: "menu" });
  const resolvePurchase = createProductResolver({ supabase, restaurantId, kind: "purchase" });
  const products = {};
  for (const it of items) {
    const name = (it?.name || "").trim();
    if (!name || products[name] !== undefined) continue;
    try {
      const resolve = it.source === "purchase" ? resolvePurchase : resolveMenu;
      products[name] = await resolve(name);
    } catch (err) {
      console.error("resolve product failed for", name, err);
      products[name] = null;
    }
  }
  return res.status(200).json({ products });
}
