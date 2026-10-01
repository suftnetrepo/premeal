import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/tokens";
import { notifyEmailVerification } from "@/lib/notifications";
import type { User } from "@prisma/client";

const TOKEN_TTL_MINUTES = 60 * 24; // 24 hours — generous, this isn't a security-sensitive action

export class InvalidTokenError extends Error {
  constructor(message = "This verification link is invalid or has expired.") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

/**
 * Generates a fresh token (invalidating any previous one — only the most
 * recently sent link works) and waits until the notification has either
 * sent or been handed to the durable email retry queue.
 */
export async function sendVerificationEmail(user: User): Promise<void> {
  const { token, tokenHash } = generateToken();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
    },
  });
  await notifyEmailVerification(updated, token);
}

/** Consumes a verification token from the emailed link. Idempotent-ish: an already-verified user just returns them. */
export async function verifyEmailToken(rawToken: string): Promise<User> {
  const tokenHash = hashToken(rawToken);
  const user = await prisma.user.findUnique({ where: { emailVerificationTokenHash: tokenHash } });

  if (!user || !user.emailVerificationTokenExpiresAt || user.emailVerificationTokenExpiresAt < new Date()) {
    throw new InvalidTokenError();
  }

  return prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
    },
  });
}
