import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertOwnsProduct } from "@/lib/authorization";
import { fileUploadSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

const allowedContentTypes = new Set(["application/pdf", "application/zip", "application/x-zip-compressed", "application/epub+zip", "application/octet-stream", "text/plain", "text/csv", "video/mp4"]);

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request.headers.get("x-forwarded-for") ?? "unknown", 20);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });
    const input = fileUploadSchema.parse({ productId: form.get("productId"), fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
    if (!allowedContentTypes.has(input.contentType)) return NextResponse.json({ error: "This file type is not allowed." }, { status: 415 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    await assertOwnsProduct(user.id, input.productId);
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectKey = `${user.id}/${crypto.randomUUID()}/${safeName}`;
    const { error: storageError } = await supabase.storage.from("product-files").upload(objectKey, file, { contentType: input.contentType, upsert: false });
    if (storageError) throw storageError;
    const { data: saved, error: recordError } = await supabase.from("product_files").insert({ product_id: input.productId, object_key: objectKey, original_name: input.fileName, content_type: input.contentType, size_bytes: input.size }).select("id,original_name,size_bytes").single();
    if (recordError) { await supabase.storage.from("product-files").remove([objectKey]); throw recordError; }
    return NextResponse.json({ file: saved }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 }); }
}
