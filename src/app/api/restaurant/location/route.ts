import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { geocodeAddress, GeocodingNotConfiguredError } from "@/lib/geocoding";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({
  address: z.string().min(1),
  deliveryRadiusKm: z.number().positive().max(100),
  // £0 is a legitimate choice (a restaurant offering free delivery
  // themselves) — only the upper bound guards against a stray typo like
  // an extra zero, not against undercutting.
  deliveryFeeCents: z.number().int().min(0).max(2000),
  description: z.string().max(500).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal("")),
});

export async function GET() {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const {
    address,
    latitude,
    longitude,
    deliveryRadiusKm,
    deliveryFeeCents,
    imageUrl,
    description,
    phone,
    contactEmail,
  } = result.restaurant;
  return NextResponse.json({
    address,
    latitude,
    longitude,
    deliveryRadiusKm,
    deliveryFeeCents,
    imageUrl,
    description,
    phone,
    contactEmail,
  });
}

export async function POST(request: Request) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const geocoded = await geocodeAddress(parsed.data.address);
    if (!geocoded) {
      return NextResponse.json({ error: "Couldn't find that address — try being more specific." }, { status: 404 });
    }

    const restaurant = await prisma.restaurant.update({
      where: { id: result.restaurant.id },
      data: {
        address: geocoded.formattedAddress,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        deliveryRadiusKm: parsed.data.deliveryRadiusKm,
        deliveryFeeCents: parsed.data.deliveryFeeCents,
        description: parsed.data.description || null,
        phone: parsed.data.phone || null,
        contactEmail: parsed.data.contactEmail || null,
      },
    });

    return NextResponse.json({
      address: restaurant.address,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      deliveryRadiusKm: restaurant.deliveryRadiusKm,
      deliveryFeeCents: restaurant.deliveryFeeCents,
      description: restaurant.description,
      phone: restaurant.phone,
      contactEmail: restaurant.contactEmail,
    });
  } catch (err) {
    if (err instanceof GeocodingNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return unexpectedErrorResponse(err, "Could not save settings");
  }
}
