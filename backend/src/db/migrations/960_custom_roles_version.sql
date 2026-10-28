-- 960 custom_roles.version — MOD-access (F-ACCESS, 2026-10-28). Forward-only, additive.
-- Optimistic concurrency for the Roles & Permissions Studio (IC-16): PATCH /api/access/roles/:id carries
-- `version`; a mismatch answers 409 VERSION_CONFLICT { currentVersion }. Every committed change bumps it.
ALTER TABLE custom_roles ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
