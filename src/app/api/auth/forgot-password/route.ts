import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/password-reset";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterSeconds } = await checkRateLimit(`forgot-password:${ip}`, 5, 60 * 60_000);
  if (!allowed) return rateLimitResponse(retryAfterSeconds!);

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  try {
    await requestPasswordReset(parsed.data.email);
  } catch (err) {
    return unexpectedErrorResponse(err, "Could not process that request");
  }

  // Same response regardless of whether the email matched an account —
  // requestPasswordReset() itself is the thing that silently no-ops for a
  // non-existent email; this route never learns which happened.
  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link is on its way.",
  });
}
