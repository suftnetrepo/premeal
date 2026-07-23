import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/tokens";
import { hashPassword } from "@/lib/password";
import { notifyPasswordReset } from "@/lib/notifications";
import type { User } from "@prisma/client";

const TOKEN_TTL_MINUTES = 30; // shorter than email verification — this one grants account access

export class InvalidTokenError extends Error {
  constructor(message = "This reset link is invalid or has expired.") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

/**
 * Always resolves successfully regardless of whether the email matches an
 * account — the caller (the API route) gives the same response either way.
 * Only actually sends an email if a user was found; silently does nothing
 * otherwise, which is what prevents this endpoint from being usable to
 * enumerate registered emails.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const { token, tokenHash } = generateToken();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
    },
  });
  void notifyPasswordReset(updated, token);
}

/**
 * Consumes the token, sets the new password, clears the token, and bumps
 * sessionVersion — this last part is what actually logs out every other
 * device/browser that had a valid session cookie, since getCurrentUser()
 * in lib/auth.ts checks sessionVersion on every request. Returns the
 * updated user so the caller can immediately set a fresh session cookie
 * for them (correct sessionVersion baked in) rather than making them log
 * in again right after resetting.
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<User> {
  const tokenHash = hashToken(rawToken);
  const user = await prisma.user.findUnique({ where: { passwordResetTokenHash: tokenHash } });

  if (!user || !user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) {
    throw new InvalidTokenError();
  }

  const passwordHash = await hashPassword(newPassword);

  return prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      sessionVersion: { increment: 1 },
    },
  });
}
