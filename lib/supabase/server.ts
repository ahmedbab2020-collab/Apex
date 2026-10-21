import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, hasSupabase } from "@/lib/env";

export async function createClient() {
  if (!hasSupabase) throw new Error("Supabase is not configured. Copy .env.example to .env.local first.");
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items: { name: string; value: string; options: CookieOptions }[]) {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A Server Component cannot mutate cookies; middleware / route handlers refresh them.
        }
      }
    }
  });
}

/** Server-only client. Never import it from a Client Component. */
export function createAdminClient() {
  if (!hasSupabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("The server Supabase credentials are not configured.");
  }
  return createServiceClient(env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
