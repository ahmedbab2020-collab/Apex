export type CreateCheckoutInput = {
  orderId: string;
  productTitle: string;
  amountMinor: number;
  currency: string;
  buyerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = { id: string; url: string };
export type VerifiedPayment = {
  eventId: string;
  type: "checkout.paid" | "charge.refunded" | "ignored";
  orderId?: string;
  providerPaymentId?: string;
  processingFeeMinor?: number;
};

export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(rawBody: string, signature: string | null): Promise<VerifiedPayment>;
  refund(providerPaymentId: string, amountMinor?: number): Promise<void>;
}
