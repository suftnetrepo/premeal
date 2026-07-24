import Link from "next/link";
import { LogoutButton } from "./logout-button";
import type { User } from "@prisma/client";

export function DriverShell({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/driver/dashboard" className="font-bold text-stone-900 flex items-center gap-1.5">
            <span className="text-orange-600">🍽️</span> Pre-Meal <span className="text-stone-400 font-normal">Driver</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-400 hidden sm:inline">{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
