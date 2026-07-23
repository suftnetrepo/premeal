import Link from "next/link";
import { AdminSidebarNav } from "./admin-sidebar-nav";
import { EmailVerificationBanner } from "./email-verification-banner";
import type { User } from "@prisma/client";

export function AdminShell({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <AdminSidebarNav />

      <div className="flex-1 flex flex-col sm:pl-16 pb-16 sm:pb-0">
        <header className="border-b border-stone-200 bg-white">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link href="/admin" className="font-bold text-stone-900 flex items-center gap-1.5">
              <span className="text-orange-600">🍽️</span> Pre-Meal
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">Admin</span>
              <span className="text-sm text-stone-400 hidden sm:inline">{user.name}</span>
            </div>
          </div>
        </header>

        {!user.emailVerifiedAt && <EmailVerificationBanner email={user.email} />}

        <div className="flex-1 flex flex-col">{children}</div>
      </div>
    </div>
  );
}
