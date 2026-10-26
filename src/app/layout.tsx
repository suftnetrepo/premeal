import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "./components/nav";
import { Footer } from "./components/footer";
import { RestaurantShell } from "./components/restaurant-shell";
import { AdminShell } from "./components/admin-shell";
import { DriverShell } from "./components/driver-shell";
import { EmailVerificationBanner } from "./components/email-verification-banner";
import { getCurrentUser } from "@/lib/auth";
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, SITE_KEYWORDS, OG_IMAGE, getSiteUrl, absoluteUrl, jsonLdString } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_GB",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: "/",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ea580c",
};

const siteJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/plain_logo.png"),
    description: SITE_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "en-GB",
    publisher: { "@id": absoluteUrl("/#organization") },
  },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(siteJsonLd) }} />
        {user?.role === "RESTAURANT_OWNER" ? (
          <RestaurantShell user={user}>{children}</RestaurantShell>
        ) : user?.role === "ADMIN" ? (
          <AdminShell user={user}>{children}</AdminShell>
        ) : user?.role === "DRIVER" ? (
          <DriverShell user={user}>{children}</DriverShell>
        ) : (
          <>
            <Nav />
            {user && !user.emailVerifiedAt && <EmailVerificationBanner email={user.email} />}
            <div className="flex-1 flex flex-col">{children}</div>
            <Footer />
          </>
        )}
      </body>
    </html>
  );
}
