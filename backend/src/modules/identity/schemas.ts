/**
 * MOD-identity — VT-3 action declarations and the `/me` capability map. Owner: BE1.
 * Request schemas for the Increment 1 routes stay next to them in routes.ts.
 */
import { capabilitiesFor as sharedCapabilitiesFor, defineActions, type Action, type Principal } from '../../shared/access.js';

export const IDENTITY_ACTIONS = defineActions({
  // AU-8: an Owner with completed 2FA issues a one-time enrollment token for another Owner.
  'employee.issue_2fa_enrollment_token': { roles: ['owner'], admin: true, description: 'Issue 2FA enrollment token (AU-8)' },
  // AU-9: regenerate own recovery codes (step-up TOTP).
  'employee.manage_own_recovery_codes': { roles: ['owner'], admin: true, description: 'Regenerate own 2FA recovery codes' },
  // SHR-006 "Sign out everywhere" (CR1-03): end every own session. Own record only (the actor is the
  // session's employee). Not a matrix row yet (§3.1 has `session.revoke` for others): Security Lead adds it.
  'auth.session.revoke_all': {
    roles: ['owner', 'data_entry', 'call_center', 'developer'],
    description: 'Sign out of every device (own sessions)',
  },
  // V-01: SHR-006 change own password (authz-matrix §3.1, Own). A pending Owner never reaches it:
  // `authenticate` refuses every non-allowlisted route while 2FA is pending (R11-a).
  'auth.password.change': {
    roles: ['owner', 'data_entry', 'call_center', 'developer'],
    description: 'Own; current password required; ends other sessions (V-01)',
  },
});

/**
 * `/me` capabilities: every action declared in the shared registry that `can` allows (BE1-R1 done:
 * `listActions()`), so the names are exactly the authz-matrix / declared names (CR1-01, SEC R3).
 */
export function capabilitiesFor(principal: Principal): Action[] {
  return sharedCapabilitiesFor(principal);
}
