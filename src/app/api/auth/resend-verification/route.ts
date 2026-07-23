import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/account-verification";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterSeconds } = await checkRateLimit(`resend-verification:${ip}`, 5, 60 * 60_000);
  if (!allowed) return rateLimitResponse(retryAfterSeconds!);

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  if (user.emailVerifiedAt) {
    return NextResponse.json({ error: "This email is already verified." }, { status: 409 });
  }

  try {
    await sendVerificationEmail(user);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return unexpectedErrorResponse(err, "Could not resend verification email");
  }
}
