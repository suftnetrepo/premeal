import { prisma } from "@/lib/db";
import { BrevoEmailSender } from "@/lib/brevo-email-sender";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email isn't configured. Add BREVO_API_KEY and BREVO_FROM_EMAIL to your .env.");
    this.name = "EmailNotConfiguredError";
  }
}

let cachedSender: BrevoEmailSender | null = null;

function getSender(): BrevoEmailSender {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new EmailNotConfiguredError();
  // Cached across calls within the same server instance — no need to
  // reconstruct the client (and re-set the API key) on every send.
  if (!cachedSender) cachedSender = new BrevoEmailSender(key);
  return cachedSender;
}

function fromAddress(): string {
  const from = process.env.BREVO_FROM_EMAIL;
  if (!from) throw new EmailNotConfiguredError();
  return from;
}

async function sendViaBrevo(to: string, subject: string, html: string): Promise<void> {
  const sender = getSender();
  const result = await sender.sendEmail({
    to: [{ email: to }],
    sender: { name: "Pre-Meal", email: fromAddress() },
    subject,
    htmlContent: html,
  });

  if (!result.success) {
    throw new Error(`Brevo error sending to ${to}: ${result.error}`);
  }
}

/**
 * Sends one email. Tries immediately, with a few fast in-request retries
 * for transient failures baked into BrevoEmailSender itself — the common
 * case (Brevo is up) never touches the database at all. If it's still
 * failing after those immediate retries (a real, possibly extended
 * outage), it's queued in EmailQueueItem so processEmailQueue() can
 * retry it later — surviving a server restart, unlike the in-request
 * retries above. Still throws either way, so existing caller-side
 * logging (see safeSend() in src/lib/notifications.ts) is unchanged.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await sendViaBrevo(to, subject, html);
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) throw err;

    const message = err instanceof Error ? err.message : "Unknown error";
    try {
      await prisma.emailQueueItem.create({
        data: { to, subject, html, attempts: 1, lastError: message },
      });
    } catch (queueErr) {
      console.error("[email] Could not queue failed email for retry:", queueErr);
    }
    throw err;
  }
}

/**
 * Retries every queued email that hasn't exhausted its attempts.
 * Intended to run on the same schedule as the other background sweeps —
 * see scripts/expire-orders-worker.ts (local dev) and
 * src/app/api/cron/sweep/route.ts (deployed).
 */
export async function processEmailQueue(): Promise<{ sent: number; failed: number; gaveUp: number }> {
  const pending = await prisma.emailQueueItem.findMany({
    where: { status: "PENDING" },
    take: 50,
  });

  let sent = 0;
  let failed = 0;
  let gaveUp = 0;

  for (const item of pending) {
    try {
      await sendViaBrevo(item.to, item.subject, item.html);
      await prisma.emailQueueItem.update({
        where: { id: item.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      sent++;
    } catch (err) {
      const attempts = item.attempts + 1;
      const message = err instanceof Error ? err.message : "Unknown error";
      const exhausted = attempts >= item.maxAttempts;
      await prisma.emailQueueItem.update({
        where: { id: item.id },
        data: {
          attempts,
          lastError: message,
          status: exhausted ? "FAILED" : "PENDING",
        },
      });
      if (exhausted) {
        gaveUp++;
        console.error(`[email-queue] Giving up on email to ${item.to} after ${attempts} attempts:`, message);
      } else {
        failed++;
      }
    }
  }

  return { sent, failed, gaveUp };
}
