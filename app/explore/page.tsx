import type { Metadata } from "next";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";

export const metadata: Metadata = { title: "Explore products" };
export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; page?: string }> }) {
  const { q = "", category = "", page = "1" } = await searchParams;
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  let products: any[] = [];
  if (hasSupabase) {
    const supabase = await createClient();
    let query = supabase.from("products").select("title,slug,price_minor,currency,category,cover_url,stores!inner(slug,name)").eq("status", "published").order("published_at", { ascending: false });
    if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
    if (category) query = query.eq("category", category);
    const { data } = await query.range((currentPage - 1) * 12, currentPage * 12 - 1);
    products = data ?? [];
  }
  return <main className="container-page py-12"><p className="eyebrow">Marketplace</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Find your next great tool.</h1><form className="mt-8 grid gap-3 rounded-xl border bg-neutral-50 p-4 md:grid-cols-[1fr_180px_auto]"><label className="sr-only" htmlFor="q">Search products</label><input id="q" className="input !mt-0" name="q" defaultValue={q} placeholder="Search products" /><label className="sr-only" htmlFor="category">Category</label><input id="category" className="input !mt-0" name="category" defaultValue={category} placeholder="Category" /><button className="btn-primary">Search</button></form>{products.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((p) => <ProductCard key={`${p.stores?.slug}-${p.slug}`} product={p} />)}</div> : <div className="mt-8"><EmptyState title="No matching products" detail="Try a different search or visit again as creators publish their work." /></div>}{products.length === 12 && <div className="mt-8 flex justify-end"><a className="btn-secondary" href={`/explore?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&page=${currentPage + 1}`}>Next page</a></div>}</main>;
}
