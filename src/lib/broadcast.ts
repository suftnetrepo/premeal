import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { emailShell, escapeHtml } from "@/lib/email-template";

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

  const html = emailShell(
    `<p style="margin:0 0 8px;color:#C94F2D;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">From Eaneri</p>
     <h1 style="margin:0 0 22px;color:#191815;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:39px;font-weight:700;letter-spacing:-.4px">${escapeHtml(subject)}</h1>
     <div style="white-space:pre-wrap;color:#3F3B36">${escapeHtml(message)}</div>`,
    subject
  );

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      await sendEmail(recipient.email, subject, html);
      sent++;
    } catch (err) {
      console.error("[broadcast] Failed to send to a recipient:", err);
      failed++;
    }
  }

  return { sent, failed, totalRecipients: recipients.length };
}
