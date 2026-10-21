import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { CheckoutButton } from "@/components/checkout-button";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productSlug: string }> }): Promise<Metadata> { const { productSlug } = await params; return { title: productSlug.replaceAll("-", " ") }; }
export default async function ProductPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const supabase = await createClient();
  const { data: store } = await supabase.from("stores").select("id,name,slug,is_published").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (!store) notFound();
  const { data: product } = await supabase.from("products").select("*").eq("store_id", store.id).eq("slug", productSlug).eq("status", "published").maybeSingle();
  if (!product) notFound();
  return <main className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_390px]"><section><div className="aspect-[16/9] overflow-hidden rounded-xl bg-neutral-100">{product.cover_url ? <img src={product.cover_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm uppercase tracking-[.18em] text-neutral-400">{product.product_type}</div>}</div><p className="mt-8 text-sm text-neutral-500">By {store.name} · {product.category}</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">{product.title}</h1><p className="mt-7 whitespace-pre-wrap leading-7 text-neutral-700">{product.description}</p></section><aside className="card h-fit p-6 lg:sticky lg:top-6"><p className="text-3xl font-semibold">{formatMoney(product.price_minor, product.currency)}</p><p className="mt-2 text-sm text-neutral-500">One-time purchase · immediate secure access after payment</p><div className="mt-6 border-t pt-6"><CheckoutButton productId={product.id} /></div></aside></main>;
}
