"use client";

import { useState } from "react";

export function CheckoutButton({ productId }: { productId: string }) {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string>();
  const [loading, setLoading] = useState(false);
  async function checkout() {
    setLoading(true); setNotice(undefined);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, email }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to start checkout.");
      window.location.assign(body.url);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to start checkout."); setLoading(false); }
  }
  return <div className="space-y-3"><label className="label">Email for your receipt<input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label><button className="btn-primary w-full" onClick={checkout} disabled={loading || !email}>{loading ? "Opening secure checkout…" : "Buy securely"}</button>{notice && <p role="alert" className="text-sm text-neutral-600">{notice}</p>}<p className="text-center text-xs leading-5 text-neutral-500">Your card details are handled by the payment provider. Access is granted only after verified payment.</p></div>;
}
