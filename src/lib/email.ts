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

/** Presence only — never logs the actual key/address values. */
function envPresence(): { hasApiKey: boolean; hasFromEmail: boolean } {
  return {
    hasApiKey: Boolean(process.env.BREVO_API_KEY),
    hasFromEmail: Boolean(process.env.BREVO_FROM_EMAIL),
  };
}

async function sendViaBrevo(to: string, subject: string, html: string, context: string): Promise<void> {
  const { hasApiKey, hasFromEmail } = envPresence();
  console.log(
    `[email] send attempt — context="${context}" to=${to} subject="${subject}" ` +
      `BREVO_API_KEY=${hasApiKey ? "present" : "MISSING"} BREVO_FROM_EMAIL=${hasFromEmail ? "present" : "MISSING"}`
  );

  const sender = getSender();
  const result = await sender.sendEmail({
    to: [{ email: to }],
    sender: { name: "Pre-Meal", email: fromAddress() },
    subject,
    htmlContent: html,
  });

  if (!result.success) {
    console.error(
      `[email] send FAILED — context="${context}" to=${to} subject="${subject}" ` +
        `status=${result.status ?? "n/a"} error="${result.error}"`
    );
    throw new Error(`Brevo error sending to ${to}: ${result.error}`);
  }

  console.log(
    `[email] send SUCCEEDED — context="${context}" to=${to} subject="${subject}" messageId=${result.messageId ?? "n/a"}`
  );
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
export async function sendEmail(to: string, subject: string, html: string, context: string = subject): Promise<void> {
  try {
    await sendViaBrevo(to, subject, html, context);
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) {
      // The one failure mode that previously left zero trace anywhere —
      // never reaches Brevo (so nothing shows in its dashboard), and was
      // rethrown here without queueing (so nothing showed in
      // EmailQueueItem either). Exactly the silent-failure signature this
      // logging exists to catch.
      console.error(
        `[email] send ABORTED — context="${context}" to=${to} subject="${subject}" reason="BREVO_API_KEY or BREVO_FROM_EMAIL not set"`
      );
      throw err;
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[email] send failed after retries, queueing for later — context="${context}" to=${to} subject="${subject}" error="${message}"`
    );
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
      await sendViaBrevo(item.to, item.subject, item.html, `queued retry: ${item.subject}`);
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
