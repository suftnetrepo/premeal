-- Create the subscriptions feature flag row explicitly, so every database
-- built from migrations has it at its intended value (disabled) without
-- relying on the seed. Must match FEATURE_FLAG_DEFAULTS in
-- src/lib/feature-flag-definitions.ts. ON CONFLICT leaves an existing row —
-- and whatever an admin has set it to — untouched.
INSERT INTO "FeatureFlag" ("id", "key", "enabled", "description", "updatedAt")
VALUES (gen_random_uuid()::text, 'subscriptions', false, 'Eaneri+ customer subscriptions (free delivery + 5% off)', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
