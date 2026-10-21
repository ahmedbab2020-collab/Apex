import Link from "next/link";
export default function NotFound() { return <main className="container-page py-28 text-center"><p className="eyebrow">404</p><h1 className="mt-3 text-4xl font-semibold">That page is not here.</h1><Link className="btn-primary mt-7" href="/">Return home</Link></main>; }
