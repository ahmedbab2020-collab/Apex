"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function setSuspension(form: FormData) {
  await requireAdmin(); const id=z.string().uuid().parse(form.get("profileId")); const suspended=z.enum(["true","false"]).parse(form.get("suspended")) === "true";
  const admin=createAdminClient(); const {error}=await admin.from("profiles").update({is_suspended:suspended}).eq("id",id); if(error)throw new Error(error.message); revalidatePath("/admin");
}
export async function setRole(form: FormData) {
  const actor=await requireAdmin(); const id=z.string().uuid().parse(form.get("profileId")); const role=z.enum(["user","creator","admin"]).parse(form.get("role")); if(id===actor.id&&role!=="admin")throw new Error("You cannot remove your own administrator access.");
  const admin=createAdminClient();const {error}=await admin.from("profiles").update({role}).eq("id",id);if(error)throw new Error(error.message);revalidatePath("/admin");
}
export async function setStorePublication(form: FormData){await requireAdmin();const id=z.string().uuid().parse(form.get("storeId"));const isPublished=z.enum(["true","false"]).parse(form.get("isPublished"))==="true";const supabase=await createClient();const {error}=await supabase.from("stores").update({is_published:isPublished}).eq("id",id);if(error)throw new Error(error.message);revalidatePath("/admin");}
export async function setProductStatus(form: FormData){await requireAdmin();const id=z.string().uuid().parse(form.get("productId"));const status=z.enum(["draft","published","archived"]).parse(form.get("status"));const supabase=await createClient();const {error}=await supabase.from("products").update({status}).eq("id",id);if(error)throw new Error(error.message);revalidatePath("/admin");}
export async function savePlatformSettings(form:FormData){await requireAdmin();const value=z.object({commissionBps:z.coerce.number().int().min(0).max(10000),fixedFeeMinor:z.coerce.number().int().min(0),minimumPayoutMinor:z.coerce.number().int().min(0),currencies:z.string().regex(/^[A-Z]{3}(,[A-Z]{3})*$/)}).parse({commissionBps:form.get("commissionBps"),fixedFeeMinor:form.get("fixedFeeMinor"),minimumPayoutMinor:form.get("minimumPayoutMinor"),currencies:form.get("currencies")});const supabase=await createClient();const {error}=await supabase.from("platform_settings").update({commission_bps:value.commissionBps,fixed_fee_minor:value.fixedFeeMinor,minimum_payout_minor:value.minimumPayoutMinor,supported_currencies:value.currencies.split(",")}).eq("id",true);if(error)throw new Error(error.message);revalidatePath("/admin");}
