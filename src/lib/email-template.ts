const BRAND = "Eaneri";
const ACCENT = "#C94F2D";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function appUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function emailButton(label: string, href: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr><td bgcolor="${ACCENT}" style="border-radius:12px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;font-family:Arial,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${escapeHtml(label)}</a></td></tr></table>`;
}

export function emailShell(content: string, preheader: string): string {
  const logoUrl = appUrl("/logo-wordmark.png");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(preheader)}</title>
<style>p{margin:0 0 16px}p:last-child{margin-bottom:0}a{color:${ACCENT}}strong{color:#191815}@media only screen and (max-width:620px){.email-shell{padding:20px 12px!important}.email-card{padding:28px 22px!important}.email-logo{width:118px!important}h1{font-size:27px!important;line-height:34px!important}}</style></head>
<body style="margin:0;padding:0;background:#F5F3EF;color:#191815">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}&#847; &zwnj; &#847; &zwnj;</div>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;background:#F5F3EF"><tr><td class="email-shell" align="center" style="padding:40px 16px">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
<tr><td style="padding:0 8px 18px"><a href="${escapeHtml(appUrl("/"))}" style="text-decoration:none"><img class="email-logo" src="${escapeHtml(logoUrl)}" width="132" alt="${BRAND}" style="display:block;width:132px;height:auto;border:0"><span style="display:none;color:${ACCENT};font:700 22px Arial,sans-serif">${BRAND}</span></a></td></tr>
<tr><td class="email-card" bgcolor="#FFFFFF" style="padding:38px 40px;border:1px solid #E6E0D8;border-radius:20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#3F3B36;box-shadow:0 10px 30px rgba(45,34,24,.06)">
${content}
</td></tr>
<tr><td style="padding:22px 16px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#817A72">Sent by ${BRAND}. Please do not share secure sign-in or payment links.<br><a href="${escapeHtml(appUrl("/"))}" style="color:${ACCENT};text-decoration:none">Visit ${BRAND}</a></td></tr>
</table></td></tr></table></body></html>`;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/h[1-6]>|<\/tr>|<\/div>/gi, "\n")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2: $1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
