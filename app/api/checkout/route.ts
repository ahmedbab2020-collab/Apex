import { NextResponse, type NextRequest } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";
import { assertSameOrigin } from "@/lib/csrf";
import { enforceRateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  try {
    await assertSameOrigin();
    enforceRateLimit(request.headers.get("x-forwarded-for") ?? "unknown", 8);
    const input = checkoutSchema.parse(await request.json());
    // Fail before writing any order when a real provider is not enabled.
    const provider = getPaymentProvider();
    const admin = createAdminClient();
    const { data: product, error: productError } = await admin
      .from("products")
      .select("id,title,price_minor,currency,status,stores!inner(id,slug,is_published)")
      .eq("id", input.productId)
      .single();
    const store = product && (Array.isArray(product.stores) ? product.stores[0] : product.stores);
    if (productError || !product || product.status !== "published" || !store?.is_published) {
      return NextResponse.json({ error: "This product is not available for purchase." }, { status: 404 });
    }
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const { data: profile } = await admin.from("profiles").select("is_suspended").eq("id", user.id).single();
      if (profile?.is_suspended) return NextResponse.json({ error: "This account is suspended." }, { status: 403 });
    }
    const { data: settings } = await admin.from("platform_settings").select("commission_bps,fixed_fee_minor,supported_currencies").eq("id", true).single();
    if (!settings?.supported_currencies?.includes(product.currency)) return NextResponse.json({ error: "This product currency is unavailable." }, { status: 422 });
    const { data: order, error: orderError } = await admin.from("orders").insert({
      customer_id: user?.id ?? null,
      customer_email: input.email.toLowerCase(),
      status: "pending",
      currency: product.currency,
      subtotal_minor: product.price_minor,
      total_minor: product.price_minor,
      commission_bps: settings.commission_bps,
      fixed_fee_minor: settings.fixed_fee_minor
    }).select("id").single();
    if (orderError || !order) throw new Error("Unable to create an order.");
    const { error: itemError } = await admin.from("order_items").insert({ order_id: order.id, product_id: product.id, product_title: product.title, unit_amount_minor: product.price_minor, currency: product.currency });
    if (itemError) { await admin.from("orders").update({ status: "failed" }).eq("id", order.id); throw new Error("Unable to create order item."); }
    try {
      const session = await provider.createCheckout({ orderId: order.id, productTitle: product.title, amountMinor: product.price_minor, currency: product.currency, buyerEmail: input.email, successUrl: `${env.NEXT_PUBLIC_APP_URL}/checkout/success?order=${order.id}`, cancelUrl: `${env.NEXT_PUBLIC_APP_URL}/store/${(store as any).slug ?? ""}?checkout=cancelled` });
      const { error: paymentError } = await admin.from("payments").insert({ order_id: order.id, provider: "stripe", provider_checkout_id: session.id, status: "pending" });
      if (paymentError) throw paymentError;
      await admin.from("orders").update({ checkout_session_id: session.id }).eq("id", order.id);
      return NextResponse.json({ url: session.url });
    } catch (paymentError) {
      await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
      throw paymentError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start checkout.";
    const status = message.includes("disabled") ? 503 : message.includes("Too many") ? 429 : message.includes("Cross-site") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
