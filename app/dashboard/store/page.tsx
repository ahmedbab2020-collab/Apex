import { requireUser } from "@/lib/auth";
import { getOwnedStore } from "@/lib/authorization";
import { StoreForm } from "@/components/store-form";
import Link from "next/link";
export default async function StoreSettingsPage() { const user = await requireUser(); const store = await getOwnedStore(user.id); return <><header className="flex items-end justify-between gap-4"><div><p className="eyebrow">Storefront</p><h1 className="mt-2 text-3xl font-semibold">My store</h1></div>{store && <Link className="btn-secondary" href={`/store/${store.slug}`}>Preview store</Link>}</header><div className="card mt-8 p-6"><StoreForm store={store} /></div></>; }
