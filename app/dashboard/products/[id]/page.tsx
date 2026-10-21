import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assertOwnsProduct } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";
import { FileUpload } from "@/components/file-upload";
import { deleteProduct } from "@/app/dashboard/actions";
import Link from "next/link";
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const user = await requireUser(); try { await assertOwnsProduct(user.id,id); } catch { notFound(); } const supabase = await createClient(); const { data: product } = await supabase.from("products").select("*,product_files(id,original_name,size_bytes)").eq("id",id).single(); if (!product) notFound(); return <><header className="flex items-end justify-between"><div><p className="eyebrow">Catalog</p><h1 className="mt-2 text-3xl font-semibold">Edit product</h1></div>{product.product_type === "course" && <Link className="btn-secondary" href={`/dashboard/products/${product.id}/course`}>Edit course</Link>}</header><div className="card mt-8 p-6"><ProductForm product={product} /></div><div className="mt-6"><FileUpload productId={product.id} initialFiles={product.product_files ?? []} /></div><form action={deleteProduct} className="mt-6"><input type="hidden" name="productId" value={product.id} /><button className="text-sm text-red-700 underline" type="submit">Delete product</button></form></>; }
