import Link from "next/link";
import { assertActiveUser } from "@/lib/auth";

const links = [["Overview", "/dashboard"], ["My store", "/dashboard/store"], ["Products", "/dashboard/products"], ["Orders", "/dashboard/orders"], ["Customers", "/dashboard/customers"], ["Analytics", "/dashboard/analytics"], ["Earnings", "/dashboard/earnings"], ["Payment settings", "/dashboard/payment-settings"], ["Profile settings", "/dashboard/profile"]];
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await assertActiveUser();
  return <main className="container-page grid gap-8 py-8 lg:grid-cols-[220px_1fr]"><aside><p className="eyebrow">Creator dashboard</p><nav aria-label="Dashboard" className="mt-4 flex gap-1 overflow-x-auto lg:flex-col">{links.map(([label, href]) => <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-neutral-100">{label}</Link>)}</nav></aside><div className="min-w-0">{children}</div></main>;
}
