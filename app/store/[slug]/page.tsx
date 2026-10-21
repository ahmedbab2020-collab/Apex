import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; return { title: `Store — ${slug}` }; }
export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: store } = await supabase.from("stores").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (!store) notFound();
  const { data: products } = await supabase.from("products").select("title,slug,price_minor,currency,category,cover_url,stores!inner(slug,name)").eq("store_id", store.id).eq("status", "published").order("published_at", { ascending: false });
  return <main><section className="border-b"><div className="container-page py-12"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-center gap-5">{store.logo_url ? <img src={store.logo_url} alt="" className="size-16 rounded-full object-cover" /> : <div className="flex size-16 items-center justify-center rounded-full bg-neutral-100 text-xl font-medium">{store.name[0]}</div>}<div><p className="eyebrow">Creator storefront</p><h1 className="mt-1 text-4xl font-semibold tracking-tight">{store.name}</h1></div></div>{store.website_url && <Link className="btn-secondary" href={store.website_url} rel="noreferrer">Visit website</Link>}</div>{store.description && <p className="mt-7 max-w-2xl leading-7 text-neutral-600">{store.description}</p>}</div></section><section className="container-page py-12"><h2 className="text-2xl font-semibold">Products</h2>{products?.length ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <ProductCard key={product.slug} product={product} />)}</div> : <div className="mt-6"><EmptyState title="Nothing published yet" detail="This creator has not published any products yet." /></div>}</section></main>;
}
