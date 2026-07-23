import { prisma } from "@/lib/db";

// Known flag keys — add a new one here as a plain string constant when you
// need to gate a new optional feature. A key with no row in the DB yet
// defaults to enabled (see isFeatureEnabled below), so introducing a new
// flag never silently turns something off before anyone's configured it.
export const FEATURE_FLAGS = {
  SUBSCRIPTIONS: "subscriptions",
} as const;

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  return flag?.enabled ?? true;
}
