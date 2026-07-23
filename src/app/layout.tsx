import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "./components/nav";
import { Footer } from "./components/footer";
import { RestaurantShell } from "./components/restaurant-shell";
import { AdminShell } from "./components/admin-shell";
import { EmailVerificationBanner } from "./components/email-verification-banner";
import { getCurrentUser } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pre-Meal",
  description: "Order today, eat when you want.",
};

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
        {user?.role === "RESTAURANT_OWNER" ? (
          <RestaurantShell user={user}>{children}</RestaurantShell>
        ) : user?.role === "ADMIN" ? (
          <AdminShell user={user}>{children}</AdminShell>
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
