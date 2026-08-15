import { stripe } from "../../../lib/stripe";
import { requireRestaurantMember } from "../../../lib/apiAuth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { restaurantId } = req.body;
  if (!restaurantId) return res.status(400).json({ error: "Missing restaurantId" });

  const { supabase, error: authError } = await requireRestaurantMember(req, restaurantId);
  if (authError) return res.status(403).json({ error: authError });

  const { data: restaurant, error: fetchError } = await supabase
    .from("restaurants")
    .select("stripe_customer_id")
    .eq("id", restaurantId)
    .single();
  if (fetchError || !restaurant?.stripe_customer_id) {
    return res.status(400).json({ error: "Este restaurante ainda não tem uma subscrição Stripe." });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: restaurant.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal error:", err);
    res.status(500).json({ error: "Não foi possível abrir o portal de faturação." });
  }
}
