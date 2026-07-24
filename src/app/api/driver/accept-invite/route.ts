import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptDriverInviteBySignup, InvalidInviteTokenError } from "@/lib/drivers";
import { setSessionCookie, createAuthToken } from "@/lib/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterSeconds } = await checkRateLimit(`driver-accept-invite:${ip}`, 10, 60 * 60_000);
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
    const driver = await acceptDriverInviteBySignup(parsed.data.token, parsed.data.name, parsed.data.password);
    await setSessionCookie(driver.id, driver.sessionVersion);
    const token = createAuthToken(driver.id, driver.sessionVersion);
    return NextResponse.json({
      user: { id: driver.id, name: driver.name, email: driver.email, role: driver.role },
      token,
    });
  } catch (err) {
    if (err instanceof InvalidInviteTokenError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return unexpectedErrorResponse(err, "Could not set up your driver account");
  }
}
