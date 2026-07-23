import { NextResponse } from "next/server";
import { z } from "zod";
import { geocodeAddress, GeocodingNotConfiguredError } from "@/lib/geocoding";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({ address: z.string().min(1) });

// Intentionally open (no auth) — it's a read-only lookup with no side
// effects. Rate limited per IP since each call costs against the Mapbox
// quota (see src/lib/rate-limit.ts for the limiter itself).
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterSeconds } = await checkRateLimit(`geocode:${ip}`, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterSeconds!);

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  try {
    const result = await geocodeAddress(parsed.data.address);
    if (!result) {
      return NextResponse.json({ error: "Couldn't find that address" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GeocodingNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return unexpectedErrorResponse(err, "Could not look up that address");
  }
}
