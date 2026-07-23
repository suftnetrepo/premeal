import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/; // "HH:MM"

const generateSchema = z.object({
  windowStart: z.string().regex(timePattern),
  windowEnd: z.string().regex(timePattern),
  capacity: z.number().int().positive(),
  cutoffHour: z.number().int().min(0).max(23), // same-day cutoff, e.g. 15 = 3pm
  daysAhead: z.number().int().min(1).max(60).default(14),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(), // 0=Sun..6=Sat, omit = every day
});

function dateAtMidnight(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const slots = await prisma.deliverySlot.findMany({
    where: { restaurantId: result.restaurant.id, date: { gte: dateAtMidnight(0) } },
    orderBy: [{ date: "asc" }, { windowStart: "asc" }],
  });

  return NextResponse.json({
    slots: slots.map((s) => ({ ...s, remaining: s.capacity - s.bookedCount })),
  });
}

export async function POST(request: Request) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const body = await request.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < input.daysAhead; i++) {
    const date = dateAtMidnight(i);
    if (input.weekdays && !input.weekdays.includes(date.getDay())) continue;

    const cutoffAt = new Date(date);
    cutoffAt.setHours(input.cutoffHour, 0, 0, 0);

    // Upsert so re-running "generate" (e.g. after changing the default
    // schedule) doesn't crash on the existing (restaurantId, date,
    // windowStart) unique constraint — it just leaves already-booked slots
    // alone rather than overwriting their bookedCount.
    const existing = await prisma.deliverySlot.findUnique({
      where: {
        restaurantId_date_windowStart: {
          restaurantId: result.restaurant.id,
          date,
          windowStart: input.windowStart,
        },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.deliverySlot.create({
      data: {
        restaurantId: result.restaurant.id,
        date,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        capacity: input.capacity,
        cutoffAt,
      },
    });
    created++;
  }

  return NextResponse.json({ created, skipped });
}
