import { stripe } from "../../../lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { buffer } from "micro";

// Stripe webhooks need the raw request body to verify the signature —
// Next.js normally parses JSON automatically, so we disable that here.
export const config = { api: { bodyParser: false } };

// Uses the service role key (server-only, never exposed to the browser) so it
// can update subscription_status regardless of RLS — this route IS the trusted
// source of truth for billing state.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const restaurantId = session.metadata?.restaurantId;
      if (restaurantId) {
        await supabaseAdmin.from("restaurants").update({
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          subscription_status: "active",
        }).eq("id", restaurantId);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await supabaseAdmin.from("restaurants")
        .update({ subscription_status: sub.status })
        .eq("stripe_subscription_id", sub.id);
      break;
    }
    default:
      break; // ignore other event types
  }

  res.status(200).json({ received: true });
}
