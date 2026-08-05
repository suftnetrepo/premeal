import { NextResponse } from "next/server";

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

// v3 returns a continuous 0.0 (bot) – 1.0 (human) score, not a pass/fail —
// this is the cutoff below which a request is treated as bot-like. 0.5 is
// Google's own recommended default; only move it with real score data from
// this app's actual traffic showing it's miscalibrated, not a guess.
export const RECAPTCHA_SCORE_THRESHOLD = 0.5;

type SiteverifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  challenge_ts?: string;
  "error-codes"?: string[];
};

type RecaptchaResult = { ok: true } | { ok: false; reason: string };

/**
 * Verifies a reCAPTCHA v3 token server-side against Google's siteverify
 * endpoint. Three things all have to hold for this to pass:
 *  - `success` — the token is genuine, unexpired, and hasn't already been
 *    consumed by an earlier verify call (Google invalidates it on first use)
 *  - `score >= RECAPTCHA_SCORE_THRESHOLD` — see the constant above
 *  - `action === expectedAction` — without this check, a token minted for
 *    a low-stakes action could be replayed against a more sensitive one;
 *    matching it server-side (not just trusting what the client claims)
 *    is what actually closes that hole
 *
 * KNOWN, DELIBERATE GAP: a request with no token at all skips verification
 * entirely rather than being rejected. This is not an oversight — the
 * live mobile app (see README's "Mobile app foundation" section)
 * authenticates against this same signup/login API via a Bearer token,
 * not a browser, and has no way to run Google's browser-JS reCAPTCHA
 * widget to produce one. Until the mobile app has its own equivalent
 * (an app-attestation mechanism, most likely — reCAPTCHA v3 itself is
 * web-only), a missing token can't be distinguished from "this is mobile"
 * versus "this is a bot that simply didn't send one" — so it's treated as
 * the former. This is a real, known bypass: nothing today stops an
 * attacker from just omitting the field. Tightening this requires either
 * a mobile-side verification story or some other reliable web-vs-mobile
 * signal, neither of which exists yet.
 *
 * Also fails open (skips verification, with a warning) if
 * RECAPTCHA_SECRET_KEY isn't configured at all — same "don't break
 * environments where an optional external service isn't set up" reasoning
 * as src/lib/geocoding.ts's Mapbox fallback. That's fine for local dev;
 * it must be set in every real deployment.
 */
export async function verifyRecaptcha(
  token: string | undefined | null,
  expectedAction: string
): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.warn("[recaptcha] RECAPTCHA_SECRET_KEY not set — skipping verification. Must be set in production.");
    return { ok: true };
  }

  if (!token) {
    // See the "KNOWN, DELIBERATE GAP" note above — this is the mobile
    // carve-out, not a missed check.
    return { ok: true };
  }

  let data: SiteverifyResponse;
  try {
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    data = await res.json();
  } catch (err) {
    console.error("[recaptcha] siteverify request failed:", err);
    // A network blip talking to Google shouldn't be indistinguishable from
    // "this was a bot" in the logs, but it should still block the request —
    // fail closed on a broken verify call, same as a failed verification.
    return { ok: false, reason: "siteverify request failed" };
  }

  if (!data.success) {
    return { ok: false, reason: `siteverify rejected token: ${(data["error-codes"] ?? []).join(", ") || "unknown"}` };
  }
  if (data.action !== expectedAction) {
    return { ok: false, reason: `action mismatch — expected "${expectedAction}", got "${data.action}"` };
  }
  if (typeof data.score !== "number" || data.score < RECAPTCHA_SCORE_THRESHOLD) {
    return { ok: false, reason: `score ${data.score} below threshold ${RECAPTCHA_SCORE_THRESHOLD}` };
  }

  return { ok: true };
}

/**
 * Deliberately generic — must never reveal that a request was rejected
 * specifically for looking bot-like, which would just tell an attacker
 * their token/score is the thing to fix rather than anything else about
 * the request.
 */
export function recaptchaFailureResponse(): NextResponse {
  return NextResponse.json({ error: "Couldn't verify request — please try again." }, { status: 400 });
}
