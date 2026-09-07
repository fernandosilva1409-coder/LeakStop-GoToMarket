import { supabase } from "./supabaseClient";

// Client-side helper shared by every write path (Purchases/Menu — manual,
// CSV, PDF) to resolve a batch of distinct item names to Product ids via
// /api/products/resolve, before inserting purchases/dish_ingredients rows.
// Returns a Map<name, productId|null> (null when resolution failed — the
// caller should still insert the row, just without a product_id, matching
// the "additive, nullable" design of the products link).
export async function resolveProductIds(restaurantId, items) {
  if (!items.length) return new Map();
  const { data: { session } } = await supabase.auth.getSession();
  try {
    const res = await fetch("/api/products/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ restaurantId, items }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "resolve failed");
    return new Map(Object.entries(body.products || {}));
  } catch (err) {
    console.error("resolveProductIds failed:", err);
    return new Map();
  }
}
