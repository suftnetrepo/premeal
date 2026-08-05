import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, setSessionCookie, createAuthToken } from "@/lib/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { verifyRecaptcha, recaptchaFailureResponse } from "@/lib/recaptcha";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Optional — see verifyRecaptcha()'s doc comment for why a missing
  // token isn't treated as a rejection (the live mobile app has no way to
  // produce one yet).
  recaptchaToken: z.string().optional(),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterSeconds } = await checkRateLimit(`login:${ip}`, 10, 15 * 60_000);
  if (!allowed) return rateLimitResponse(retryAfterSeconds!);

  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Per-IP alone only stops one IP hammering many accounts — it does
  // nothing against many IPs (or a botnet) each making a few attempts
  // against the same ONE target account, which never trips any single
  // IP's own budget. This is additive to the IP check above, not a
  // replacement, keyed on the submitted email itself (lowercased for a
  // consistent bucket key — login's own lookup below is exact-case, this
  // key doesn't need to match that, just be stable) so it catches that
  // pattern regardless of how the attempts are spread across IPs. Applied
  // unconditionally, before the user lookup, whether or not the email
  // actually has an account — gating only real accounts would itself leak
  // which emails exist, via which requests get rate-limited.
  const emailKey = `login-account:${parsed.data.email.toLowerCase()}`;
  const accountLimit = await checkRateLimit(emailKey, 10, 15 * 60_000);
  if (!accountLimit.allowed) return rateLimitResponse(accountLimit.retryAfterSeconds!);

  const recaptcha = await verifyRecaptcha(parsed.data.recaptchaToken, "login");
  if (!recaptcha.ok) {
    console.warn(`[login] reCAPTCHA rejected request from ${ip}: ${recaptcha.reason}`);
    return recaptchaFailureResponse();
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Deliberately identical error for "no such user" and "wrong password" so a
  // login form can't be used to enumerate which emails have accounts.
  const invalid = () => NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

  if (!user) return invalid();

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return invalid();

  await setSessionCookie(user.id, user.sessionVersion);

  // The web client relies on the httpOnly cookie above and ignores this;
  // a mobile client has no cookie jar, so it stores this token instead
  // (in expo-secure-store, not AsyncStorage — same reasoning as httpOnly
  // for the cookie: don't put an auth token somewhere ordinary app code
  // or a compromised dependency could read it in plaintext) and sends it
  // back as `Authorization: Bearer <token>` on every request.
  const token = createAuthToken(user.id, user.sessionVersion);

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token,
  });
}
