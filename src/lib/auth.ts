import { timingSafeEqual, createHmac } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
export { hashPassword, verifyPassword } from "@/lib/password";

const SESSION_COOKIE = "premeal_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Add one to your .env file (any long random string)."
    );
  }
  return secret;
}

// ---------------------------------------------------------------------------
// Sessions
//
// The token holds `${userId}.${sessionVersion}.${expiryMs}.${signature}`.
// The signature is an HMAC-SHA256 over the first three parts using
// AUTH_SECRET, so a client can't forge or extend a session without knowing
// the secret. This is intentionally simple — no external session store
// needed for an app this size — but it means rotating AUTH_SECRET
// invalidates all sessions, and revocation only happens via sessionVersion
// (see getCurrentUser() below), not per-token.
//
// The exact same signed token now serves two delivery mechanisms: the web
// app gets it as an httpOnly cookie (can't be read by JS, immune to XSS
// token theft); the mobile app gets the same token in the login/signup
// JSON response body instead, since a native app has no concept of a
// browser cookie jar, and sends it back as `Authorization: Bearer <token>`
// on every request. getCurrentUser() below accepts either.
// ---------------------------------------------------------------------------

function sign(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("hex");
}

function createSessionToken(userId: string, sessionVersion: number): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${sessionVersion}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Exposed for API routes that need to return a token in the response body for mobile clients — see login/signup routes. */
export function createAuthToken(userId: string, sessionVersion: number): string {
  return createSessionToken(userId, sessionVersion);
}

function verifySessionToken(token: string): { userId: string; sessionVersion: number } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, sessionVersionStr, expiresAtStr, signature] = parts;
  const payload = `${userId}.${sessionVersionStr}.${expiresAtStr}`;
  const expected = sign(payload);

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const sessionVersion = Number(sessionVersionStr);
  if (!Number.isFinite(sessionVersion)) return null;

  return { userId, sessionVersion };
}

/**
 * Call from a Route Handler or Server Action after a successful
 * login/signup/password-reset. Needs the user's current sessionVersion —
 * pass the freshly-loaded user's value rather than re-querying here, since
 * the caller almost always already has it.
 */
export async function setSessionCookie(userId: string, sessionVersion: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(userId, sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Read the current session, if any, from Server Components/Route Handlers. Checks the cookie first (web), then falls back to an Authorization: Bearer header (mobile). */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  let token = store.get(SESSION_COOKIE)?.value;

  if (!token) {
    const headerList = await headers();
    const authHeader = headerList.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length);
    }
  }

  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;

  // A password reset bumps User.sessionVersion, which immediately
  // invalidates every cookie signed with the old version — this is what
  // "log out everywhere" means in a stateless-token system with no
  // server-side session store to individually revoke. Applies the same
  // way to a mobile bearer token, since it's the identical signed value.
  if (user.sessionVersion !== session.sessionVersion) return null;

  return user;
}
