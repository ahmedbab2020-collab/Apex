import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/server";
import { fulfillPaidOrder } from "@/lib/orders";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  let eventId: string | undefined;
  try {
    const event = await getPaymentProvider().verifyWebhook(raw, request.headers.get("stripe-signature"));
    eventId = event.eventId;
    const admin = createAdminClient();
    const { error: inserted } = await admin.from("webhook_events").insert({ provider: "stripe", provider_event_id: event.eventId, status: "received" });
    if (inserted && inserted.code !== "23505") throw inserted;
    // Claim the event. A retried event after a previous failure can be processed again;
    // concurrent deliveries cannot both claim it.
    const { data: claim, error: claimError } = await admin.from("webhook_events")
      .update({ status: "processing", error_message: null })
      .eq("provider", "stripe").eq("provider_event_id", event.eventId)
      .in("status", ["received", "failed"])
      .select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claim) return NextResponse.json({ received: true, duplicate: true });
    if (event.type === "checkout.paid" && event.orderId) await fulfillPaidOrder(event.orderId, event.providerPaymentId);
    if (event.type === "charge.refunded" && event.providerPaymentId) {
      const { data: payment } = await admin.from("payments").select("order_id").eq("provider_payment_id", event.providerPaymentId).maybeSingle();
      if (payment) { await admin.from("payments").update({ status: "refunded" }).eq("order_id", payment.order_id); await admin.from("orders").update({ status: "refunded" }).eq("id", payment.order_id); }
    }
    await admin.from("webhook_events").update({ status: event.type === "ignored" ? "ignored" : "processed", processed_at: new Date().toISOString() }).eq("provider", "stripe").eq("provider_event_id", event.eventId);
    return NextResponse.json({ received: true });
  } catch (error) {
    if (eventId) {
      try {
        const admin = createAdminClient();
        await admin.from("webhook_events").update({ status: "failed", error_message: "Fulfillment failed; provider retry required." }).eq("provider", "stripe").eq("provider_event_id", eventId);
      } catch {
        // Preserve the original non-2xx response for the provider retry.
      }
    }
    // Signature failures are deliberately terse; webhook providers retry non-2xx responses.
    return NextResponse.json({ error: "Webhook verification or fulfillment failed." }, { status: 400 });
  }
}
