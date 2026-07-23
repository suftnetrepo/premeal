import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { geocodeAddress, GeocodingNotConfiguredError } from "@/lib/geocoding";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({
  address: z.string().min(1),
  deliveryRadiusKm: z.number().positive().max(100),
});

export async function GET() {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const { address, latitude, longitude, deliveryRadiusKm, imageUrl } = result.restaurant;
  return NextResponse.json({ address, latitude, longitude, deliveryRadiusKm, imageUrl });
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
      },
    });

    return NextResponse.json({
      address: restaurant.address,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      deliveryRadiusKm: restaurant.deliveryRadiusKm,
    });
  } catch (err) {
    if (err instanceof GeocodingNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return unexpectedErrorResponse(err, "Could not save location");
  }
}
