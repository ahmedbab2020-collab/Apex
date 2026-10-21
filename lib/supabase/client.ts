"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env, hasSupabase } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!hasSupabase) throw new Error("Supabase is not configured. Add the required public environment variables.");
  browserClient ??= createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  return browserClient;
}
