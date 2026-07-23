import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export type BroadcastAudience = "CUSTOMER" | "RESTAURANT_OWNER" | "ALL";

// A real production version of this needs a background job/queue —
// sending hundreds of emails synchronously inside one request risks
// hitting a serverless function's timeout. This sequential loop with a
// cap is fine for the volumes this app has today, not for real scale.
const MAX_RECIPIENTS = 500;

export async function sendBroadcast(
  audience: BroadcastAudience,
  subject: string,
  message: string
): Promise<{ sent: number; failed: number; totalRecipients: number }> {
  const recipients = await prisma.user.findMany({
    where: audience === "ALL" ? {} : { role: audience },
    select: { email: true, name: true },
    take: MAX_RECIPIENTS,
  });

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p style="color: #D85A30; font-weight: 600; margin-bottom: 4px;">Pre-Meal</p>
      <div style="white-space: pre-wrap; color: #111;">${escapeHtml(message)}</div>
    </div>
  `;

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      await sendEmail(recipient.email, subject, html);
      sent++;
    } catch (err) {
      console.error(`[broadcast] Failed to send to ${recipient.email}:`, err);
      failed++;
    }
  }

  return { sent, failed, totalRecipients: recipients.length };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}
