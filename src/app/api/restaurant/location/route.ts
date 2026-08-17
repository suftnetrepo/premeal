import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { geocodeAddress, GeocodingNotConfiguredError } from "@/lib/geocoding";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({
  name: z.string().min(1).max(80),
  address: z.string().min(1),
  deliveryRadiusKm: z.number().positive().max(100),
  // £0 is a legitimate choice (a restaurant offering free delivery
  // themselves) — only the upper bound guards against a stray typo like
  // an extra zero, not against undercutting.
  deliveryFeeCents: z.number().int().min(0).max(2000),
  // £0 minimum order is a legitimate choice too (no minimum at all) —
  // same reasoning, the upper bound just catches an obvious typo.
  minOrderCents: z.number().int().min(0).max(10000),
  // 0 is the default/legitimate "no extra notice required" choice — the
  // upper bound (60) is just a sanity cap against a stray typo, not a
  // real product limit.
  minimumLeadTimeDays: z.number().int().min(0).max(60),
  description: z.string().max(500).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal("")),
});

export async function GET() {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const {
    name,
    address,
    latitude,
    longitude,
    deliveryRadiusKm,
    deliveryFeeCents,
    minOrderCents,
    minimumLeadTimeDays,
    imageUrl,
    description,
    phone,
    contactEmail,
    // Read-only here — the hygiene certificate section on this same
    // settings page has its own dedicated submit endpoint
    // (POST /api/restaurant/hygiene-certificate), same split as the
    // restaurant photo above (also read here, written elsewhere).
    hygieneCertificateLevel,
    hygieneCertificateDocumentUrl,
    hygieneCertificateStatus,
    hygieneCertificateSubmittedAt,
    hygieneCertificateRejectionReason,
  } = result.restaurant;
  return NextResponse.json({
    name,
    address,
    latitude,
    longitude,
    deliveryRadiusKm,
    deliveryFeeCents,
    minOrderCents,
    minimumLeadTimeDays,
    imageUrl,
    description,
    phone,
    contactEmail,
    hygieneCertificateLevel,
    hygieneCertificateDocumentUrl,
    hygieneCertificateStatus,
    hygieneCertificateSubmittedAt,
    hygieneCertificateRejectionReason,
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
        // The slug (Restaurant.slug) is deliberately left untouched here
        // — restaurant pages route by permanent database id, not slug
        // (confirmed against src/app/restaurants/[id]/page.tsx), so
        // renaming has nothing to break. Re-deriving the slug from a new
        // name would just be extra risk (a uniqueness collision to
        // handle) for a value nothing actually depends on.
        name: parsed.data.name.trim(),
        address: geocoded.formattedAddress,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        deliveryRadiusKm: parsed.data.deliveryRadiusKm,
        deliveryFeeCents: parsed.data.deliveryFeeCents,
        minOrderCents: parsed.data.minOrderCents,
        minimumLeadTimeDays: parsed.data.minimumLeadTimeDays,
        description: parsed.data.description || null,
        phone: parsed.data.phone || null,
        contactEmail: parsed.data.contactEmail || null,
      },
    });

    return NextResponse.json({
      name: restaurant.name,
      address: restaurant.address,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      deliveryRadiusKm: restaurant.deliveryRadiusKm,
      deliveryFeeCents: restaurant.deliveryFeeCents,
      minOrderCents: restaurant.minOrderCents,
      minimumLeadTimeDays: restaurant.minimumLeadTimeDays,
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
