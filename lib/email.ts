type Receipt = { email: string; orderId: string; accessUrl: string; productTitle: string };

/** Optional transactional email delivery. Purchases remain fulfilled even if delivery is not configured. */
export async function sendPurchaseReceipt(receipt: Receipt) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: receipt.email,
      subject: `Your ${process.env.NEXT_PUBLIC_BRAND_NAME ?? "MONO MARKET"} purchase`,
      text: `Thanks for your purchase of ${receipt.productTitle}. Access it securely here: ${receipt.accessUrl}`
    })
  });
}
