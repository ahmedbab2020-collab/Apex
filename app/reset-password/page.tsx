"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function ResetPasswordPage() {
  const [notice, setNotice] = useState<string>();
  async function submit(data: FormData) { try { const { error } = await createClient().auth.updateUser({ password: String(data.get("password")) }); if (error) throw error; setNotice("Password updated. You can now use it to log in."); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to reset password."); } }
  return <main className="container-page py-16"><form action={submit} className="card mx-auto max-w-md space-y-5 p-7"><div><p className="eyebrow">Account recovery</p><h1 className="mt-2 text-2xl font-semibold">Choose a new password</h1></div><label className="label">New password<input className="input" type="password" required minLength={8} name="password" autoComplete="new-password" /></label><button className="btn-primary w-full">Update password</button>{notice && <p role="status" className="text-sm text-neutral-600">{notice}</p>}</form></main>;
}
