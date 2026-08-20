import { createClient } from "@supabase/supabase-js";

// Verifies the request's Supabase access token and confirms the user is a
// member of the given restaurant, before an API route acts on that
// restaurant's billing state. Never trust a client-supplied restaurantId
// on its own — RLS on restaurant_members enforces the actual check here.
export async function requireRestaurantMember(req, restaurantId) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Missing Authorization header" };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return { error: "Invalid session" };

  const { data: membership, error: memberError } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError || !membership) return { error: "Not a member of this restaurant" };

  return { userId: user.id, supabase };
}

// Lighter check for endpoints that don't touch any restaurant's data —
// just confirms the request carries a valid Supabase session.
export async function requireAuth(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Missing Authorization header" };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return { error: "Invalid session" };

  return { userId: user.id, supabase };
}
