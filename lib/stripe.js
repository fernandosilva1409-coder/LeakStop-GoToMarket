import Stripe from "stripe";

// Server-only: never import this file from a page component or the browser bundle.
// The secret key must never reach the client.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});
