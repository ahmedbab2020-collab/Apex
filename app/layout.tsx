import type { Metadata } from "next";
import Link from "next/link";
import "@/app/globals.css";
import { env, hasSupabase } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: { default: env.NEXT_PUBLIC_BRAND_NAME, template: `%s — ${env.NEXT_PUBLIC_BRAND_NAME}` },
  description: "A considered marketplace for independent digital creators."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = hasSupabase ? await getCurrentUser() : null;
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b">
          <div className="container-page flex h-16 items-center justify-between gap-5">
            <Link href="/" className="shrink-0 text-sm font-bold tracking-[0.13em]">{env.NEXT_PUBLIC_BRAND_NAME}</Link>
            <nav aria-label="Primary" className="hidden items-center gap-6 text-sm md:flex">
              <Link href="/explore">Explore</Link><Link href="/#features">Features</Link><Link href="/#pricing">Pricing</Link>
            </nav>
            <div className="flex items-center gap-2 text-sm">
              {user ? <><Link href="/dashboard" className="btn-secondary !min-h-9 !px-3">Dashboard</Link><form action={signOut}><button className="px-2 py-2 text-neutral-600 hover:text-black">Log out</button></form></> : <><Link href="/login" className="px-3 py-2">Log in</Link><Link href="/signup" className="btn-primary !min-h-9 !px-4">Start selling</Link></>}
            </div>
          </div>
        </header>
        {children}
        <footer className="mt-24 border-t py-10 text-sm text-neutral-500">
          <div className="container-page flex flex-col justify-between gap-5 sm:flex-row"><span>© {new Date().getFullYear()} {env.NEXT_PUBLIC_BRAND_NAME}</span><nav className="flex gap-5"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refunds">Refund policy</Link><Link href="mailto:support@example.com">Contact</Link></nav></div>
        </footer>
      </body>
    </html>
  );
}
