import { AuthForm } from "@/components/auth-form";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const { next } = await searchParams; return <main className="container-page py-16"><AuthForm mode="login" next={next} /></main>; }
