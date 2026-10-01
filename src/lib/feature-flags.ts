import { prisma } from "@/lib/db";
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_DEFAULTS,
  type FeatureFlagKey,
} from "@/lib/feature-flag-definitions";

export { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS, type FeatureFlagKey };

// The row's `enabled` wins whenever it exists. A missing row falls back to
// that flag's own declared default (see feature-flag-definitions.ts) rather
// than a blanket "on" — otherwise an unseeded database silently enables
// whatever the flag was meant to hold back.
export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  return flag?.enabled ?? FEATURE_FLAG_DEFAULTS[key].enabled;
}
