"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export async function updateProfile(form:FormData){const user=await assertActiveUser();const displayName=z.string().trim().min(1).max(100).parse(form.get("displayName"));const supabase=await createClient();const {error}=await supabase.from("profiles").update({display_name:displayName}).eq("id",user.id);if(error)throw new Error(error.message);revalidatePath("/dashboard/profile");}
