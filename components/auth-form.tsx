"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [message, setMessage] = useState<string>();
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";
  async function submit(formData: FormData) {
    setLoading(true); setMessage(undefined);
    try {
      const supabase = createClient();
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: String(formData.get("name") ?? "") }, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? "/dashboard")}` } });
        if (error) throw error;
        setMessage("Check your email to verify your account, then return here to log in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(next ?? "/dashboard");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to continue."); }
    finally { setLoading(false); }
  }
  return <form action={submit} className="card mx-auto w-full max-w-md space-y-5 p-6 sm:p-8"><div><p className="eyebrow">{isSignup ? "Create your account" : "Welcome back"}</p><h1 className="mt-2 text-2xl font-semibold">{isSignup ? "Start selling your work" : "Log in to your account"}</h1></div>{isSignup && <label className="label">Name<input className="input" required name="name" autoComplete="name" /></label>}<label className="label">Email<input className="input" required name="email" type="email" autoComplete="email" /></label><label className="label">Password<input className="input" required minLength={8} name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} /></label>{!isSignup && <Link className="block text-sm underline underline-offset-4" href="/forgot-password">Forgot your password?</Link>}<button className="btn-primary w-full" disabled={loading}>{loading ? "Please wait…" : isSignup ? "Create account" : "Log in"}</button>{message && <p role="status" className="rounded-lg bg-neutral-100 p-3 text-sm">{message}</p>}<p className="text-center text-sm text-neutral-500">{isSignup ? "Already have an account?" : "New to MONO MARKET?"} <Link className="text-black underline" href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Start selling"}</Link></p></form>;
}
