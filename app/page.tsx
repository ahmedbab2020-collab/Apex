import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";

export default async function HomePage() {
  let products: any[] = [];
  let stores: any[] = [];
  if (hasSupabase) {
    const supabase = await createClient();
    const [productResult, storeResult] = await Promise.all([
      supabase.from("products").select("title,slug,price_minor,currency,category,cover_url,stores!inner(slug,name)").eq("status", "published").order("published_at", { ascending: false }).limit(6),
      supabase.from("stores").select("name,slug,description,logo_url").eq("is_published", true).order("created_at", { ascending: false }).limit(4)
    ]);
    products = productResult.data ?? [];
    stores = storeResult.data ?? [];
  }
  return <main>
    <section className="container-page grid gap-10 py-20 md:grid-cols-[1.2fr_.8fr] md:py-32"><div><p className="eyebrow">For independent creators</p><h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-[-0.055em] sm:text-6xl lg:text-7xl">Your Products. Your Store. Your Business.</h1><p className="mt-7 max-w-xl text-lg leading-8 text-neutral-600">Sell your digital work with a beautiful storefront, secure delivery, and an uncomplicated path from first upload to first sale.</p><div className="mt-9 flex flex-wrap gap-3"><Link className="btn-primary" href="/signup">Start selling</Link><Link className="btn-secondary" href="/explore">Explore products</Link></div></div><div className="card hidden min-h-80 overflow-hidden bg-neutral-950 p-7 text-white md:block"><p className="eyebrow !text-neutral-400">A storefront, not just a checkout link</p><div className="mt-20 border-t border-neutral-700 pt-5"><p className="text-2xl font-medium">Designed for work worth owning.</p><p className="mt-3 text-sm leading-6 text-neutral-400">Your brand stays front and center, while the platform handles secure payments and delivery.</p></div></div></section>
    <section className="container-page py-12"><div className="mb-7 flex items-end justify-between"><div><p className="eyebrow">Discover</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Featured products</h2></div><Link href="/explore" className="text-sm underline underline-offset-4">View all</Link></div>{products.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((p) => <ProductCard key={p.slug} product={p} />)}</div> : <EmptyState title="The marketplace is just getting started" detail="Published creator products will appear here as soon as they are available." />}</section>
    <section className="container-page py-20"><div className="mb-7"><p className="eyebrow">Independent by design</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Popular creator stores</h2></div>{stores.length ? <div className="grid gap-4 md:grid-cols-2">{stores.map((store) => <Link href={`/store/${store.slug}`} key={store.slug} className="card flex items-center gap-4 p-5 transition hover:bg-neutral-50"><div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 font-medium">{store.name.slice(0, 1)}</div><div><h3 className="font-medium">{store.name}</h3><p className="mt-1 line-clamp-2 text-sm text-neutral-500">{store.description || "A creator storefront"}</p></div></Link>)}</div> : <p className="text-sm text-neutral-500">Published storefronts will be listed here.</p>}</section>
    <section id="features" className="border-y bg-neutral-50 py-20"><div className="container-page"><p className="eyebrow">Everything essential</p><div className="mt-8 grid gap-px overflow-hidden rounded-xl border bg-neutral-200 md:grid-cols-3">{[["Own your storefront", "A branded public home with a memorable URL."],["Deliver securely", "Private files are available only after verified payment."],["See the numbers", "Orders, earnings, and product performance in one dashboard."]].map(([title, copy]) => <div className="bg-white p-7" key={title}><h3 className="font-medium">{title}</h3><p className="mt-3 text-sm leading-6 text-neutral-500">{copy}</p></div>)}</div></div></section>
    <section id="pricing" className="container-page py-20"><div className="max-w-2xl"><p className="eyebrow">Straightforward economics</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">A transparent commission, recorded with every sale.</h2><p className="mt-4 text-neutral-600">The platform fee is configured by the marketplace administrator and shown in your earnings ledger. Payout availability depends on your approved payment-provider setup.</p></div></section>
    <section className="container-page pb-10"><h2 className="text-2xl font-semibold">Questions, answered</h2><div className="mt-6 grid gap-4 md:grid-cols-3">{[["Can I use my own brand?", "Yes. Your store has its own name, description, imagery, and public URL."],["How are files protected?", "Files live in a private bucket and are delivered with short-lived signed links after payment."],["When do I get paid?", "Earnings and payout status are tracked separately; payout setup depends on the chosen provider."]].map(([q,a])=><div className="card p-5" key={q}><h3 className="font-medium">{q}</h3><p className="mt-2 text-sm leading-6 text-neutral-500">{a}</p></div>)}</div></section>
  </main>;
}
