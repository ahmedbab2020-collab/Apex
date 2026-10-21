"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertActiveUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOwnedStore, assertOwnsProduct } from "@/lib/authorization";
import { productSchema, storeSchema } from "@/lib/validation";

function formToStore(form: FormData) {
  return storeSchema.parse({ name: form.get("name"), slug: form.get("slug"), description: form.get("description") || "", logoUrl: form.get("logoUrl") || "", bannerUrl: form.get("bannerUrl") || "", websiteUrl: form.get("websiteUrl") || "", xUrl: form.get("xUrl") || "", isPublished: form.get("isPublished") === "on" });
}
export async function saveStore(form: FormData) {
  const user = await assertActiveUser();
  const input = formToStore(form);
  const supabase = await createClient();
  const existing = await getOwnedStore(user.id);
  const values = { name: input.name, slug: input.slug, description: input.description || "", logo_url: input.logoUrl || null, banner_url: input.bannerUrl || null, website_url: input.websiteUrl || null, x_url: input.xUrl || null, is_published: input.isPublished };
  const result = existing ? await supabase.from("stores").update(values).eq("id", existing.id) : await supabase.from("stores").insert({ ...values, owner_id: user.id });
  if (result.error) throw new Error(result.error.code === "23505" ? "That store URL is already taken." : result.error.message);
  if (!existing) {
    // Only this authenticated user is promoted, and only after a store was created.
    const admin = createAdminClient();
    await admin.from("profiles").update({ role: "creator" }).eq("id", user.id).neq("role", "admin");
  }
  revalidatePath("/"); revalidatePath("/dashboard"); revalidatePath(`/store/${input.slug}`); redirect("/dashboard/store?updated=1");
}

function formToProduct(form: FormData) {
  return productSchema.parse({ title: form.get("title"), slug: form.get("slug"), description: form.get("description"), priceMinor: form.get("priceMinor"), currency: String(form.get("currency") ?? "USD").toUpperCase(), category: form.get("category"), productType: form.get("productType"), coverUrl: form.get("coverUrl") || "", status: form.get("status") });
}
export async function createProduct(form: FormData) {
  const user = await assertActiveUser();
  const store = await getOwnedStore(user.id);
  if (!store) redirect("/dashboard/store");
  const input = formToProduct(form);
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").insert({ store_id: store.id, title: input.title, slug: input.slug, description: input.description, price_minor: input.priceMinor, currency: input.currency, category: input.category, product_type: input.productType, cover_url: input.coverUrl || null, status: input.status }).select("id").single();
  if (error || !data) throw new Error(error?.code === "23505" ? "That product URL is already in use in your store." : error?.message ?? "Unable to create product.");
  if (input.productType === "course") await supabase.from("courses").insert({ product_id: data.id, overview: input.description });
  revalidatePath("/dashboard/products"); redirect(`/dashboard/products/${data.id}`);
}
export async function updateProduct(form: FormData) {
  const user = await assertActiveUser();
  const productId = String(form.get("productId") ?? "");
  await assertOwnsProduct(user.id, productId);
  const input = formToProduct(form);
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ title: input.title, slug: input.slug, description: input.description, price_minor: input.priceMinor, currency: input.currency, category: input.category, product_type: input.productType, cover_url: input.coverUrl || null, status: input.status }).eq("id", productId);
  if (error) throw new Error(error.code === "23505" ? "That product URL is already in use in your store." : error.message);
  if (input.productType === "course") await supabase.from("courses").upsert({ product_id: productId, overview: input.description }, { onConflict: "product_id", ignoreDuplicates: true });
  revalidatePath("/dashboard/products"); revalidatePath(`/dashboard/products/${productId}`); redirect("/dashboard/products?updated=1");
}
export async function deleteProduct(form: FormData) {
  const user = await assertActiveUser();
  const productId = String(form.get("productId") ?? "");
  await assertOwnsProduct(user.id, productId);
  const supabase = await createClient();
  const { count: orderCount } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", productId);
  if (orderCount) throw new Error("This product has order history and cannot be deleted. Archive it instead.");
  const { data: files } = await supabase.from("product_files").select("object_key").eq("product_id", productId);
  if (files?.length) {
    const admin = createAdminClient();
    await admin.storage.from("product-files").remove(files.map((file) => file.object_key));
  }
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw new Error("This product has paid order history and cannot be deleted. Archive it instead.");
  revalidatePath("/dashboard/products"); redirect("/dashboard/products");
}

export async function addCourseModule(form: FormData) {
  const user = await assertActiveUser();
  const productId = String(form.get("productId") ?? "");
  await assertOwnsProduct(user.id, productId);
  const title = String(form.get("title") ?? "").trim();
  if (!title || title.length > 160) throw new Error("A module title is required.");
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id").eq("product_id", productId).maybeSingle();
  if (!course) throw new Error("Create or convert this product to a course first.");
  const { count } = await supabase.from("course_modules").select("id", { count: "exact", head: true }).eq("course_id", course.id);
  const { error } = await supabase.from("course_modules").insert({ course_id: course.id, title, position: count ?? 0 });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/products/${productId}/course`);
}

export async function addCourseLesson(form: FormData) {
  const user = await assertActiveUser();
  const productId = String(form.get("productId") ?? "");
  const moduleId = String(form.get("moduleId") ?? "");
  await assertOwnsProduct(user.id, productId);
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (!title || title.length > 160 || body.length > 10000) throw new Error("Check the lesson title and content.");
  const supabase = await createClient();
  const { data: module } = await supabase.from("course_modules").select("id,courses!inner(product_id)").eq("id", moduleId).maybeSingle();
  const course = module && (Array.isArray(module.courses) ? module.courses[0] : module.courses);
  if (!module || course?.product_id !== productId) throw new Error("Course module not found.");
  const { count } = await supabase.from("course_lessons").select("id", { count: "exact", head: true }).eq("module_id", moduleId);
  const { error } = await supabase.from("course_lessons").insert({ module_id: moduleId, title, body, position: count ?? 0, is_preview: form.get("isPreview") === "on" });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/products/${productId}/course`);
}
