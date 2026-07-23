import { NextResponse } from "next/server";
import { suggestAddresses } from "@/lib/geocoding";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { unexpectedErrorResponse } from "@/lib/api-errors";

// Same "intentionally open" reasoning as /api/geocode — read-only, no side
// effects. Limit is more lenient than /api/geocode itself since this fires
// on every debounced keystroke during normal typing (see
// address-autocomplete.tsx's 300ms debounce), not once per submission.
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterSeconds } = await checkRateLimit(`geocode-suggest:${ip}`, 60, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterSeconds!);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const suggestions = await suggestAddresses(query);
    return NextResponse.json({ suggestions });
  } catch (err) {
    return unexpectedErrorResponse(err, "Could not fetch address suggestions");
  }
}
