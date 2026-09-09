import { stripe } from "../../../lib/stripe";
import { requireRestaurantMember } from "../../../lib/apiAuth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { restaurantId, customerEmail, plan } = req.body;
  if (!restaurantId) return res.status(400).json({ error: "Missing restaurantId" });

  const { error: authError } = await requireRestaurantMember(req, restaurantId);
  if (authError) return res.status(403).json({ error: authError });

  const priceId = plan === "annual"
    ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL
    : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: customerEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 5 },
      // Lets Stripe collect and validate a business Tax ID (NIF in Portugal,
      // VAT elsewhere) on the invoice — required for a customer's own
      // accounting to treat this as a deductible business expense.
      tax_id_collection: { enabled: true },
      metadata: { restaurantId },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?checkout=cancelled`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: "Could not create checkout session" });
  }
}
