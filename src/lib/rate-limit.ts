import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Redis-backed when configured (works correctly across multiple server
// instances — the actual requirement once this app scales past one
// process), falling back to the original in-memory Map otherwise (fine
// for local dev, a single-instance deployment, or before Redis is set
// up). Same "primary service + graceful fallback" shape as the
// Mapbox/Nominatim geocoding split in src/lib/geocoding.ts.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

type Bucket = { count: number; resetAt: number };

// Only used when Redis isn't configured. KNOWN LIMITATION in that case:
// this Map lives in one process's memory — resets on every restart, and
// doesn't share state across multiple server instances. Set
// UPSTASH_REDIS_REST_URL/TOKEN to get a real shared limiter instead.
const memoryBuckets = new Map<string, Bucket>();

function sweepExpiredMemoryBuckets() {
  const now = Date.now();
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt <= now) memoryBuckets.delete(key);
  }
}

async function checkRateLimitRedis(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  // INCR is atomic — this is what avoids the classic "read count, check in
  // JS, then write" race under concurrent requests, same principle as the
  // capacity engine's atomic slot reservation.
  const count = await redis!.incr(key);
  if (count === 1) {
    // First hit in this window — set the expiry now that the key exists.
    await redis!.pexpire(key, windowMs);
  }

  if (count > limit) {
    const ttlMs = await redis!.pttl(key);
    return { allowed: false, retryAfterSeconds: Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000) };
  }
  return { allowed: true };
}

function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds?: number } {
  if (Math.random() < 0.01) sweepExpiredMemoryBuckets();

  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count++;
  return { allowed: true };
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  if (redis) {
    try {
      return await checkRateLimitRedis(key, limit, windowMs);
    } catch (err) {
      // Redis being briefly unreachable shouldn't take down login/signup/
      // etc. — fail open to the in-memory limiter for this one check
      // rather than blocking every request until Redis recovers.
      console.error("[rate-limit] Redis check failed, falling back to in-memory for this request:", err);
      return checkRateLimitMemory(key, limit, windowMs);
    }
  }
  return checkRateLimitMemory(key, limit, windowMs);
}

/**
 * Best-effort client IP extraction. Trusts x-forwarded-for/x-real-ip,
 * which in production only means something if requests actually pass
 * through a proxy/load balancer that sets them (true on Vercel and most
 * hosts) — this is not spoof-proof against a client hitting the origin
 * directly, but it's the standard approach for this kind of rate limiting,
 * not for anything security-critical like auth decisions.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown"; // local dev requests typically have neither header
}

export function rateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests — please try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
