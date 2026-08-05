import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie, createAuthToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/account-verification";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { verifyRecaptcha, recaptchaFailureResponse } from "@/lib/recaptcha";

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["CUSTOMER", "RESTAURANT_OWNER"]),
  restaurantName: z.string().min(1).optional(),
  cuisine: z.string().min(1).optional(),
  // Optional, not required — see verifyRecaptcha()'s doc comment for why
  // a missing token isn't treated as a rejection (the live mobile app has
  // no way to produce one yet).
  recaptchaToken: z.string().optional(),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `restaurant-${Date.now()}`
  );
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterSeconds } = await checkRateLimit(`signup:${ip}`, 5, 60 * 60_000);
  if (!allowed) return rateLimitResponse(retryAfterSeconds!);

  const body = await request.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const recaptcha = await verifyRecaptcha(input.recaptchaToken, "signup");
  if (!recaptcha.ok) {
    console.warn(`[signup] reCAPTCHA rejected request from ${ip}: ${recaptcha.reason}`);
    return recaptchaFailureResponse();
  }

  if (input.role === "RESTAURANT_OWNER" && (!input.restaurantName || !input.cuisine)) {
    return NextResponse.json(
      { error: "restaurantName and cuisine are required for restaurant owners" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // Same non-enumerating wording pattern as forgot-password/route.ts's
    // "If an account exists for that email, a reset link is on its way." —
    // doesn't confirm outright that this specific email is taken.
    // Residual gap, structural rather than a wording problem: unlike
    // forgot-password (response-identical either way), this route's job is
    // to actually create an account and log the caller into it, so a
    // successful signup (201, real user + token) is still distinguishable
    // from this response (409, no user/token) by status/shape alone, even
    // with generic text. Fully closing that would mean deferring signup
    // confirmation to an email click for both branches — a bigger behavior
    // change than this fix, not done here.
    return NextResponse.json(
      { error: "If an account already exists for that email, log in instead." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      ...(input.role === "RESTAURANT_OWNER"
        ? {
            restaurants: {
              create: {
                name: input.restaurantName!,
                slug: slugify(input.restaurantName!),
                cuisine: input.cuisine!,
              },
            },
          }
        : {}),
    },
  });

  await setSessionCookie(user.id, user.sessionVersion);
  void sendVerificationEmail(user);

  const token = createAuthToken(user.id, user.sessionVersion);

  return NextResponse.json(
    { user: { id: user.id, name: user.name, email: user.email, role: user.role }, token },
    { status: 201 }
  );
}
