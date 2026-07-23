import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie, createAuthToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/account-verification";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["CUSTOMER", "RESTAURANT_OWNER"]),
  restaurantName: z.string().min(1).optional(),
  cuisine: z.string().min(1).optional(),
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

  if (input.role === "RESTAURANT_OWNER" && (!input.restaurantName || !input.cuisine)) {
    return NextResponse.json(
      { error: "restaurantName and cuisine are required for restaurant owners" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
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
