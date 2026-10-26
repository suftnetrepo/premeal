import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up — order ahead or sell your food",
  description: "Create a free Eaneri account to order scheduled food delivery, or register your restaurant to receive pre-orders.",
  alternates: { canonical: "/signup" },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
