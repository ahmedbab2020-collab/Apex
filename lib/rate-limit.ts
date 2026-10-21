import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function allowRequest(key: string, limit: number, windowSeconds: number) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error("Rate limit check failed.");
  return data === true;
}
