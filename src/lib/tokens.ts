import { randomBytes, createHash } from "crypto";

/**
 * Returns a raw token (goes in the email link, never stored) and its
 * SHA-256 hash (what actually gets stored/looked-up in the DB). SHA-256
 * rather than scrypt/bcrypt deliberately — these tokens are single-use,
 * short-lived, high-entropy (32 random bytes), and looked up by exact
 * match, not verified against a slow, intentionally-expensive password
 * hash. A fast hash is the right tool here; it's still not storing the
 * raw secret at rest.
 */
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
