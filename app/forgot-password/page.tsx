"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [notice, setNotice] = useState<string>();
  async function submit(data: FormData) {
    try { const { error } = await createClient().auth.resetPasswordForEmail(String(data.get("email")), { redirectTo: `${window.location.origin}/reset-password` }); if (error) throw error; setNotice("If an account exists for that email, a reset link has been sent."); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to request reset."); }
  }
  return <main className="container-page py-16"><form action={submit} className="card mx-auto max-w-md space-y-5 p-7"><div><p className="eyebrow">Account recovery</p><h1 className="mt-2 text-2xl font-semibold">Reset your password</h1></div><label className="label">Email<input className="input" type="email" required name="email" autoComplete="email" /></label><button className="btn-primary w-full">Send reset link</button>{notice && <p role="status" className="text-sm text-neutral-600">{notice}</p>}</form></main>;
}
