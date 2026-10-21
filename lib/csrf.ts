import { headers } from "next/headers";
import { env } from "@/lib/env";

export async function assertSameOrigin() {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin && origin !== env.NEXT_PUBLIC_APP_URL) throw new Error("Cross-site request rejected.");
}
