// Every flag the code reads, with the value it falls back to when its row
// is missing. Kept free of the Prisma client so prisma/seed.ts can import it
// too, and stays in sync with the row it creates.
//
// The database row is the source of truth — the seed and a migration both
// create it explicitly. `enabled` here is only the safety net for a database
// where that row is somehow missing, so pick the value that's safe to launch
// with: an unfinished or deliberately-held-back feature must default to
// false, or a missing row silently switches it on in production.
//
// Adding a key to FEATURE_FLAGS without an entry here is a type error, so a
// new flag can't ship without a deliberate default.
export const FEATURE_FLAGS = {
  SUBSCRIPTIONS: "subscriptions",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export const FEATURE_FLAG_DEFAULTS: Record<
  FeatureFlagKey,
  { enabled: boolean; description: string }
> = {
  // Held back until there's real repeat-order data to price it against.
  subscriptions: {
    enabled: false,
    description: "Eaneri+ customer subscriptions (free delivery + 5% off)",
  },
};
