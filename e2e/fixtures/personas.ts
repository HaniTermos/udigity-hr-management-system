/**
 * Seed personas (backend/src/db/seed.ts). Emails only: the password is never stored here.
 * Set E2E_PASSWORD in the shell to the dev seed password; login journeys are skipped otherwise.
 */
export type Role = 'owner' | 'data_entry' | 'call_center' | 'developer';

export interface Persona {
  key: string;
  email: string;
  name: string;
  role: Role;
  /** Landing route after a completed sign-in (AC-AUTH-001 / AC-AUTH-006). */
  landing: string;
}

export const personas = {
  owner: { key: 'owner', email: 'rana.haddad@udigity.demo', name: 'Rana Haddad', role: 'owner', landing: '/' },
  dataEntry: { key: 'dataEntry', email: 'karim.saleh@udigity.demo', name: 'Karim Saleh', role: 'data_entry', landing: '/my-day' },
  callCenterMaya: { key: 'callCenterMaya', email: 'maya.khoury@udigity.demo', name: 'Maya Khoury', role: 'call_center', landing: '/my-day' },
  callCenterOmar: { key: 'callCenterOmar', email: 'omar.nassar@udigity.demo', name: 'Omar Nassar', role: 'call_center', landing: '/my-day' },
  developerLina: { key: 'developerLina', email: 'lina.aoun@udigity.demo', name: 'Lina Aoun', role: 'developer', landing: '/my-day' },
  developerSami: { key: 'developerSami', email: 'sami.fares@udigity.demo', name: 'Sami Fares', role: 'developer', landing: '/my-day' },
} as const satisfies Record<string, Persona>;

export function seedPassword(): string | undefined {
  return process.env.E2E_PASSWORD || undefined;
}

/** Owner TOTP secret for the seeded test factor (test value only; see test-strategy §2). */
export function ownerTotpSecret(): string | undefined {
  return process.env.E2E_OWNER_TOTP_SECRET || undefined;
}

export const journeysEnabled = process.env.E2E_JOURNEYS === '1';
