import "server-only";
import Stripe from "stripe";

export function stripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret);
}
