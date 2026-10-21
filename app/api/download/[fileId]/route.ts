import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const token = request.nextUrl.searchParams.get("token");
  const admin = createAdminClient();
  const { data: file } = await admin.from("product_files").select("id,product_id,object_key,original_name,products!inner(store_id)").eq("id", fileId).maybeSingle();
  if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  const product = Array.isArray(file.products) ? file.products[0] : file.products;
  let authorized = false;
  if (user) {
    const { data: store } = await admin.from("stores").select("owner_id").eq("id", product.store_id).maybeSingle();
    authorized = store?.owner_id === user.id;
  }
  const { data: orderItems } = await admin.from("order_items").select("id,order_id").eq("product_id", file.product_id);
  if (!authorized && orderItems?.length) {
    const ids = orderItems.map((item) => item.order_id);
    const { data: orders } = await admin.from("orders").select("id,customer_id,access_token").in("id", ids).eq("status", "paid");
    const permitted = orders?.find((order) => (user && order.customer_id === user.id) || (!!token && order.access_token === token));
    authorized = Boolean(permitted);
    if (permitted) {
      const orderItem = orderItems.find((item) => item.order_id === permitted.id);
      if (orderItem) await admin.from("download_access").update({ download_count: 1, last_downloaded_at: new Date().toISOString() }).eq("order_item_id", orderItem.id);
    }
  }
  if (!authorized) return NextResponse.json({ error: "You are not authorized to download this file." }, { status: 403 });
  const { data, error } = await admin.storage.from("product-files").createSignedUrl(file.object_key, 60, { download: file.original_name });
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Unable to prepare secure download." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
