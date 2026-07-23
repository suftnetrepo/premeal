import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { sendBroadcast } from "@/lib/broadcast";
import { EmailNotConfiguredError } from "@/lib/email";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({
  audience: z.enum(["CUSTOMER", "RESTAURANT_OWNER", "ALL"]),
  subject: z.string().min(1),
  message: z.string().min(1),
});

export async function POST(request: Request) {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Subject, message, and audience are required" }, { status: 400 });
  }

  try {
    const outcome = await sendBroadcast(parsed.data.audience, parsed.data.subject, parsed.data.message);
    return NextResponse.json(outcome);
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return unexpectedErrorResponse(err, "Could not send broadcast");
  }
}
