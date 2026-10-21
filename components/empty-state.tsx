import Link from "next/link";

export function EmptyState({ title, detail, href, action }: { title: string; detail: string; href?: string; action?: string }) {
  return <div className="card flex min-h-48 flex-col items-center justify-center px-6 text-center"><h2 className="text-lg font-medium">{title}</h2><p className="mt-2 max-w-md text-sm text-neutral-500">{detail}</p>{href && action ? <Link className="btn-primary mt-5" href={href}>{action}</Link> : null}</div>;
}
