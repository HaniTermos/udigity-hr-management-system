'use client';

import { useAuth } from '@/lib/auth';
import type { Employee } from '@/lib/auth';
import { roleDefaultAllows } from '@/lib/actions';

type Role = Employee['role'];

export interface CapabilityContext {
  role?: Role;
  capabilities: readonly string[] | null;
  can: (action: string) => boolean;
  sessionState: string | null;
}

/** Pure check, shared by the hooks and unit tests. No action means "always allowed" (e.g. My Day). */
export function actionAllowed(action: string | undefined, ctx: CapabilityContext): boolean {
  if (!action) return true;
  if (ctx.sessionState !== 'active') return false;
  if (ctx.capabilities !== null) return ctx.can(action);
  return roleDefaultAllows(action, ctx.role);
}

/** Can the signed-in user use `action`? Shows or hides nav and buttons; never replaces the server check. */
export function useCapability(action: string | undefined): boolean {
  const { user, capabilities, can, sessionState } = useAuth();
  return actionAllowed(action, { role: user?.role, capabilities, can, sessionState });
}

/** A checker for several actions at once (lists of nav items). */
export function useCapabilityCheck(): (action: string | undefined) => boolean {
  const { user, capabilities, can, sessionState } = useAuth();
  return (action) => actionAllowed(action, { role: user?.role, capabilities, can, sessionState });
}
