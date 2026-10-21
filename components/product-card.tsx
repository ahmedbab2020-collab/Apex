import Link from "next/link";
import { formatMoney } from "@/lib/utils";

type ProductCardProps = {
  product: { title: string; slug: string; price_minor: number; currency: string; category: string; cover_url?: string | null; stores?: { slug: string; name: string } | { slug: string; name: string }[] | null };
};

export function ProductCard({ product }: ProductCardProps) {
  const store = Array.isArray(product.stores) ? product.stores[0] : product.stores;
  if (!store) return null;
  return <article className="group overflow-hidden rounded-xl border bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
    <Link href={`/store/${store.slug}/${product.slug}`} className="block">
      <div className="aspect-[4/3] bg-neutral-100">{product.cover_url ? <img src={product.cover_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.18em] text-neutral-400">Digital product</div>}</div>
      <div className="space-y-2 p-4"><p className="text-xs text-neutral-500">{product.category}</p><h3 className="font-medium leading-tight">{product.title}</h3><div className="flex items-center justify-between gap-3 text-sm"><span className="text-neutral-500">{store.name}</span><span className="font-medium">{formatMoney(product.price_minor, product.currency)}</span></div></div>
    </Link>
  </article>;
}
