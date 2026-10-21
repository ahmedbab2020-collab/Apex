import Stripe from "stripe";
import type { CreateCheckoutInput, PaymentProvider, VerifiedPayment } from "@/lib/payments/types";

export class StripeProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Stripe is not configured.");
    this.stripe = new Stripe(key);
  }

  async createCheckout(input: CreateCheckoutInput) {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.buyerEmail,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.orderId,
      metadata: { order_id: input.orderId },
      payment_intent_data: { metadata: { order_id: input.orderId } },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: input.amountMinor,
          product_data: { name: input.productTitle }
        }
      }]
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { id: session.id, url: session.url };
  }

  async verifyWebhook(rawBody: string, signature: string | null): Promise<VerifiedPayment> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature) throw new Error("Missing Stripe webhook signature configuration.");
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid" || !session.metadata?.order_id) {
        return { eventId: event.id, type: "ignored" };
      }
      return {
        eventId: event.id,
        type: "checkout.paid",
        orderId: session.metadata.order_id,
        providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id
      };
    }
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      return { eventId: event.id, type: "charge.refunded", providerPaymentId: intent };
    }
    return { eventId: event.id, type: "ignored" };
  }

  async refund(providerPaymentId: string, amountMinor?: number) {
    await this.stripe.refunds.create({ payment_intent: providerPaymentId, ...(amountMinor ? { amount: amountMinor } : {}) });
  }
}
