/**
 * Dev-only UI conveniences. All OFF by default.
 *
 * NEXT_PUBLIC_ENABLE_DEV_PERSONAS=true  -> shows the persona switcher (header menu + login quick-fill)
 *                                         and pre-fills the seed password on the login form.
 *
 * It is ignored in production builds even when set, so seed credentials never ship in a prod bundle
 * by accident. NEXT_PUBLIC_* values are inlined at build time.
 */
export const DEV_PERSONAS_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_DEV_PERSONAS === 'true';

/** Seed password from backend/src/db/seed.ts. Only referenced when DEV_PERSONAS_ENABLED. */
export const DEV_SEED_PASSWORD = DEV_PERSONAS_ENABLED
  ? process.env.NEXT_PUBLIC_DEV_SEED_PASSWORD || 'Password123!'
  : '';
