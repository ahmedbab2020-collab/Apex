import { createClient } from "@/lib/supabase/server";

export async function getOwnedStore(userId: string) {
  const supabase = await createClient();
  const { data: store, error } = await supabase.from("stores").select("*").eq("owner_id", userId).maybeSingle();
  if (error) throw new Error("Unable to load your store.");
  return store;
}

export async function assertOwnsProduct(userId: string, productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, store_id, stores!inner(owner_id)")
    .eq("id", productId)
    .eq("stores.owner_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Product not found or not permitted.");
  return data;
}
