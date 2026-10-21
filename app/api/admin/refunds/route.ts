import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";

const schema = z.object({ paymentId: z.string().uuid(), amountMinor: z.number().int().positive().optional() });
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const input = schema.parse(await request.json());
    const supabase = await createClient();
    const { data: payment } = await supabase.from("payments").select("provider_payment_id,status").eq("id", input.paymentId).single();
    if (!payment?.provider_payment_id || payment.status !== "succeeded") return NextResponse.json({ error: "This payment cannot be refunded." }, { status: 422 });
    await getPaymentProvider().refund(payment.provider_payment_id, input.amountMinor);
    return NextResponse.json({ requested: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Refund request failed." }, { status: 400 }); }
}
