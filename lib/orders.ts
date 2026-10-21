import { createAdminClient } from "@/lib/supabase/server";
import { calculateFees } from "@/lib/money";
import { sendPurchaseReceipt } from "@/lib/email";
import { env } from "@/lib/env";

/** Runs only after a verified provider webhook. Safe to call repeatedly. */
export async function fulfillPaidOrder(orderId: string, providerPaymentId?: string) {
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("*, order_items(*, products(id, title, product_type, store_id))")
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error("Order for webhook was not found.");
  if (order.status === "paid") return;
  if (order.status !== "pending") throw new Error("Order is not eligible for fulfillment.");

  const fee = calculateFees(
    order.total_minor,
    order.commission_bps,
    order.fixed_fee_minor,
    0
  );
  const { error: orderError } = await admin.from("orders").update({
    status: "paid",
    platform_fee_minor: fee.platformFeeMinor,
    paid_at: new Date().toISOString()
  }).eq("id", order.id).eq("status", "pending");
  if (orderError) throw new Error("Unable to mark order as paid.");
  if (providerPaymentId) {
    await admin.from("payments").update({ status: "succeeded", provider_payment_id: providerPaymentId }).eq("order_id", order.id);
  }

  for (const item of order.order_items ?? []) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!product) continue;
    await admin.from("download_access").upsert({
      order_item_id: item.id,
      user_id: order.customer_id,
      access_token: order.access_token
    }, { onConflict: "order_item_id" });
    if (product.product_type === "course" && order.customer_id) {
      await admin.from("enrollments").upsert({ product_id: product.id, user_id: order.customer_id }, { onConflict: "product_id,user_id" });
    }
    // This MVP accepts one product per order, so all net proceeds belong to its creator.
    await admin.from("creator_earnings").upsert({
      order_item_id: item.id,
      store_id: product.store_id,
      gross_minor: item.unit_amount_minor,
      platform_fee_minor: fee.platformFeeMinor,
      processing_fee_minor: 0,
      net_minor: fee.creatorNetMinor,
      currency: order.currency,
      status: "pending_payout"
    }, { onConflict: "order_item_id" });
  }

  const firstItem = order.order_items?.[0];
  const firstProduct = firstItem && (Array.isArray(firstItem.products) ? firstItem.products[0] : firstItem.products);
  if (firstProduct) {
    const accessUrl = `${env.NEXT_PUBLIC_APP_URL}/purchases/${order.id}?token=${order.access_token}`;
    await sendPurchaseReceipt({ email: order.customer_email, orderId: order.id, accessUrl, productTitle: firstProduct.title });
  }
}
