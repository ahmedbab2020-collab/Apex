import { StripeProvider } from "@/lib/payments/stripe";
import type { PaymentProvider } from "@/lib/payments/types";

export function getPaymentProvider(): PaymentProvider {
  if (process.env.STRIPE_SECRET_KEY) return new StripeProvider();
  throw new Error("Payments are disabled until STRIPE_SECRET_KEY is configured. No order was charged.");
}
