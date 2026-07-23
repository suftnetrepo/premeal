import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  code: z.string().min(3).max(30),
  description: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.number().int().positive(),
  minOrderCents: z.number().int().positive().optional(),
  maxDiscountCents: z.number().int().positive().optional(),
  restaurantId: z.string().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  maxRedemptionsPerCustomer: z.number().int().positive().default(1),
});

export async function GET() {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;

  const promoCodes = await prisma.promoCode.findMany({
    include: { restaurant: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ promoCodes });
}

export async function POST(request: Request) {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.discountType === "PERCENTAGE" && parsed.data.discountValue > 100) {
    return NextResponse.json({ error: "A percentage discount can't exceed 100." }, { status: 400 });
  }

  try {
    const promoCode = await prisma.promoCode.create({
      data: {
        ...parsed.data,
        code: parsed.data.code.trim().toUpperCase(),
        validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : undefined,
        validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : undefined,
      },
    });
    return NextResponse.json({ promoCode }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A code with that name already exists" }, { status: 409 });
  }
}
