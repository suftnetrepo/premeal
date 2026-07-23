import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword, InvalidTokenError } from "@/lib/password-reset";
import { setSessionCookie, createAuthToken } from "@/lib/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterSeconds } = await checkRateLimit(`reset-password:${ip}`, 10, 60 * 60_000);
  if (!allowed) return rateLimitResponse(retryAfterSeconds!);

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.password?.[0] ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const user = await resetPassword(parsed.data.token, parsed.data.password);
    // Log them straight in with a fresh session — the sessionVersion bump
    // inside resetPassword() already invalidated every other cookie, so
    // this is a genuinely new session, not a reuse of an old one.
    await setSessionCookie(user.id, user.sessionVersion);
    const authToken = createAuthToken(user.id, user.sessionVersion);
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: authToken,
    });
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return unexpectedErrorResponse(err, "Could not reset password");
  }
}
