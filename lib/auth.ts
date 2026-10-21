import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role, is_suspended").eq("id", user.id).single();
  if (profile?.is_suspended) redirect("/account-suspended");
  if (profile?.role !== "admin") redirect("/dashboard");
  return user;
}

export async function assertActiveUser() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("is_suspended").eq("id", user.id).single();
  if (profile?.is_suspended) redirect("/account-suspended");
  return user;
}
