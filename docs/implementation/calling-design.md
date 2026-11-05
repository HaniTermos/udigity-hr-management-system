# Calling backend design (BE3) — Increment 2 draft for review

| Field | Value |
|---|---|
| Owner | BE3 (modules `assignment`, `reservation`, `calls`) |
| Status | **Increment 4 implemented.** Migrations 300–350 applied; routes/services live; ORCH-4 decisions applied (token in clear with holder check, separate inbound-DNC route, `call_attempt.list_opportunities`). Assignment actions use the matrix names `calling.assign/reassign/unassign/autofill` (GET list and reassign-impact are guarded by `calling.assign`). Contract: board `BE3-C1` |
| Sources | plan.md sections 3-6, 8; arch-b SEQ-09/10/11/13, ERD-3; Phase 2 batch 3 (WF-CALL-001..003, SM-ASSIGNMENT/RESERVATION/FOLLOWUP-001); policy-defaults.md |
| Policy labelling | Every number or branch below marked **DEMO** is "Demonstration alternative — not approved (docs/policy-defaults.md)" and is read from the flag registry, never from `process.env`. The only approved rule is **U-01** |

## 1. Files delivered

| Item | Path |
|---|---|
| Migrations (drafts) | `backend/src/db/migrations/300_assignment_calling_assignments.sql.draft`, `310_calls_business_calling_states…`, `320_reservation_contact_reservations…`, `330_calls_call_attempts…`, `340_calls_follow_ups…`, `350_calls_outcome_reopenings…` |
| Schemas + DTOs + `defineActions` | `backend/src/modules/{assignment,reservation,calls}/schemas.ts` |
| Schema tests (no DB) | `backend/src/modules/calls/schemas.test.ts` |

The runner (`backend/src/db/migrate.ts`) filters `file.endsWith('.sql')`, so `.sql.draft` files are never applied. Activation (Increment 4, or earlier by TL decision) is a rename; the drafts were dry-run in a scratch database on the Docker test container (stub `employees`/`businesses`, twice for idempotency, plus checks of the one-active-reservation index and the append-only trigger), and the scratch database was dropped.

Dependencies on other ranges: `businesses(id)` (BE2, 2xx) and `employees(id)` (001). If BE2 names the table differently, only the FK lines change. BE2's `access_facts` view reads `business_calling_states.last_touchpoint_at` and the open `calling_assignments` / `follow_ups` rows; any column rename needs a REQUEST to BE2 (plan 3.1).

## 2. Data model

| Table (owner module) | Key invariants (enforced by the database) |
|---|---|
| `calling_assignments` (assignment) | History rows. **One open row per business** (partial unique `ended_at IS NULL`). Unassigned = no open row |
| `business_calling_states` (calls) | PK = `business_id` (1:1). `outcome` in pending/on_hold/needs_another_call/rejected/accepted; CHECK: Rejected never has the D2 callback marker (B1); holds `last_touchpoint_at` (DEC-001 Alt B input) |
| `contact_reservations` (reservation) | **One `active` row per business** (partial unique). End columns consistent with `state`; override requires reason + Owner id |
| `call_attempts` (calls) | **Append-only** (trigger rejects UPDATE/DELETE). Unique `(agent_id, idempotency_key)`. Rejected requires a reason. `reservation_id` nullable only for the save-after-loss branch |
| `follow_ups`, `follow_up_changes` (calls) | **One `scheduled` row per business** (B3-Q04). State/timestamps consistent. Change history per reschedule/reassign |
| `outcome_reopenings` (calls) | `reopen` only from rejected (DEC-016), `requeue` only from accepted (B3-Q12); reason mandatory |

All FKs to employees/businesses are `ON DELETE RESTRICT`. Mutable aggregates carry `version`, `created_at`, `updated_at`. No destructive statements.

Review points raised by this draft:
1. `lease_token` is stored in clear (random UUID, holder-only, never logged or audited). A hashed token would make "same holder re-entry returns the existing row" impossible without rotating the token, which would break the other tab. Reviewer (Security) may prefer hash + rotate.
2. Stored state names are lower-case snake (`active`, `scheduled`); the UI labels them.
3. `follow_ups.cancel_source` has no `outcome_accepted` value: D4 working default is "Accepted keeps open follow-ups" (plan 6.2).

## 3. Actions (VT-3) and endpoints

Declared in each `schemas.ts` with `defineActions` (roles; admin = Owner + completed 2FA). Names follow the `<resource>.<verb>` rule of `shared/access.ts`; the authz-matrix section 3.7 rows map as shown.

| Action | Roles | Endpoint(s) |
|---|---|---|
| `calling_assignment.list/assign/reassign/unassign/autofill` | Owner (admin, except list) | `/api/calling-assignments` ... |
| `calling_assignment.queue_read` | Owner, Call Center | `GET /api/calling/queue` |
| `business.calling_workspace` | Owner, Call Center | `GET /api/calling/businesses/:id/workspace` |
| `reservation.acquire/renew/release` | Owner, Call Center | `POST /api/reservations`, `/:id/renew`, `/:id/release` |
| `reservation.override` | Owner (admin) | `POST /api/reservations/:id/override` |
| `call_attempt.log` | Owner, Call Center | `POST /api/calling/attempts` |
| `call_attempt.list_do_not_call`, `.list_opportunities` | Owner, Call Center | `GET /api/calling/do-not-call`, `/opportunities` |
| `business.calling_reopen`, `.calling_requeue` | Owner (admin) | `POST /api/calling/businesses/:id/reopen`, `/requeue` |
| `follow_up.read/create/reschedule/complete/cancel` | Owner, Call Center | `/api/follow-ups` |

Every handler also calls `access.check` / `scopeFilter` (B7: **including for the assignee**, on acquire, every renew, log, and every follow-up action). Call Center users see only businesses assigned to them (or follow-ups they are responsible for); the Owner skips scope but not resource state (Rejected = do-not-call for the Owner too). Review point: `call_attempt.list_opportunities` is a read of deals composed through a BE4 read op; if BE4 prefers a `deal.*` action, rename in one place.

## 4. Assignment state machine (SM-ASSIGNMENT-001)

States: Unassigned, Assigned (exactly one active Call Center agent). Commands (Owner + 2FA only, B3-Q01/B8):

| From | Command | Guards | To | Writes (one transaction) |
|---|---|---|---|---|
| Unassigned | assign / autofill accepted | business not Rejected (B1), has a phone (B2), not archived (B4), no open deal (B6/DEC-017), assignee active Call Center | Assigned | new row; audit `calling_assignment.assigned`; outbox `calling_assignment.assigned` |
| Assigned | reassign | as above, new agent differs; row `version` matches; **no Active reservation** (Owner first chooses Wait or Override; the save never releases a reservation, AR-03); reason; an explicit choice for the open follow-up (transfer preselected in the UI, no server default, B3-Q03) | Assigned (new) | lock calling-state row; end old row (`reassigned`), insert new; follow-up per choice via `calls.service` (transfer -> `follow_up.reassigned`, cancel with reason -> `follow_up.cancelled` and D2 marker if it was the last, keep -> allowed with warning); audit `calling_assignment.reassigned` + follow-up audits; outbox events |
| Assigned | unassign (B3-Q15) | same reservation + follow-up resolution | Unassigned | end row (`unassigned`); audit `calling_assignment.unassigned` |
| Assigned | keep as is (B7 item) | business "assigned but inaccessible" | Assigned | audit `calling_assignment.retained` |

Non-transitions: assignee deactivated or losing access (stays Assigned, derived flags `assigneeInactive` / `assignedButInaccessible`, no auto-reassignment). Outcome, reservation and deal changes never touch the assignment. `POST /reassign-impact` is a read-only preview (current row + version, open follow-up, callback marker, Active reservation, ineligible items).

## 5. Reservation state machine (SM-RESERVATION-001)

States: `active`; terminal `released`, `expired`, `overridden`. Renewal is a self-transition. "No reservation" is the absence of an active row. A new acquire always creates a new row.

### 5.1 Parameters (DEMO, DEC-004 — settings `reservation.*`)

| Setting | Default | Meaning |
|---|---|---|
| `leaseSeconds` | 300 | Lease length; every renew sets `lease_expires_at = min(now + lease, idle deadline, max-total deadline)` |
| `heartbeatSeconds` | 60 | Client renews at this interval while the workspace is open |
| `idleMinutes` | 15 | No user input for this long ends the reservation |
| `idleWarningMinutes` | 13 | "Expiring" warning shown from here |
| `maxTotalMinutes` | 60 | Hard cap per window; extended only by an explicit "Keep working" renewal |
| `ownerOverride` | true | Owner may override (reason required) |

### 5.2 Transitions

| Event | Actor | Guards | Result |
|---|---|---|---|
| Acquire (`POST /api/reservations`, Idempotency-Key required) | assignee or Owner | access check (B7); business not Rejected, not archived; **lazy expiry**: in the same transaction, a lapsed active row for the business is flipped to `expired` (reason `lease_elapsed`/`idle`/`max_total`, audit written here, once); then insert | `active` + new `leaseToken`; audit `contact_reservation.acquired` |
| Acquire while another user holds it | any | partial unique index violation (database arbiter) | 409 `RESERVATION_CONFLICT`, `details = { holderName, acquiredAt, leaseExpiresAt }` (name shown only to users with business access) |
| Acquire by the same holder again (second tab/device) | holder | active row has the same holder | existing row returned (`reentry: true`), no new audit |
| Renew / heartbeat | holder | `(id, leaseToken)` match, `state = active`, lease not lapsed, access still passes (B7), idle and max-total deadlines not reached | `last_renewed_at`, `last_activity_at`, `lease_expires_at` updated; only an operational log line |
| Renew after loss | holder | any guard fails | 409 `RESERVATION_LOST`; the row is flipped to `expired` if it was lapsed (reasons `idle`, `max_total`, `access_denied`, `lease_elapsed`) |
| Release | holder | token match | `released` (`released`); audit `contact_reservation.released`. Repeat on an already released row is a no-op 200 |
| Call save (post-commit step) | system for holder | save committed | `released` (`call_saved`), **separate transaction after the save (AR-03)**; a failure only lets the lease lapse |
| Override | Owner + 2FA | reason mandatory; flag `ownerOverride` | `overridden`; audit `contact_reservation.overridden`; outbox/in-app notice to the holder (B3-Q14); the holder's later save follows the save-after-loss branch |
| Expiry sweep (J-05, every 60 s) | system | `UPDATE … SET state='expired' … WHERE state='active' AND (lease_expires_at < now OR idle/max deadline passed)`; conditional, so exactly one writer (sweep or acquire) records `contact_reservation.expired` | `expired`; housekeeping only. Correctness never depends on the sweep |
| Tab switch / blur | — | — | no transition (not a release, not idle) |
| Holder deactivated | — | — | no immediate action: renewals stop, reservation lapses at lease end (<= 5 min under the default, B3-Q06) |

### 5.3 Idle and max-total rules

* The heartbeat body carries `idleSeconds` (seconds since the last user input measured on the client; blur is not idle). The server sets `last_activity_at = max(previous, now - idleSeconds)`. A heartbeat from a page with no user input does **not** extend the idle deadline, but does extend the lease up to that deadline.
* `idle deadline = last_activity_at + idleMinutes`; `idleWarning` is true from `idleWarningMinutes`. When `now >= idle deadline` the reservation ends `expired` (`idle`).
* `max-total deadline = max_window_started_at + maxTotalMinutes`. The renew response carries `maxTotalWarning`. Only a renewal with `keepWorking: true` restarts the window (`max_window_started_at = now`); after the deadline without it the reservation ends `expired` (`max_total`).
* The client must not trust its own timers: the response fields `leaseExpiresAt`, `idleExpiresAt`, `maxTotalExpiresAt` are the truth.
* Clock: all deadlines use the database clock (`now()` in SQL); tests use the clock override requested in QA-2.

## 6. Attempt, outcome and follow-up save (SEQ-11 / SEQ-13)

`POST /api/calling/attempts` with `Idempotency-Key` (required), body = `LogAttemptBody` (discriminated by outcome). Attempt time is server now (B3-Q07). Every attempt carries one of four outcomes (B3-Q13).

Validation before the transaction (400/422): D2 (Needs another call = follow-up XOR callback marker), Rejected reason, Accepted note >= `calls.acceptedNoteMinLength` (DEMO 10), follow-up time in the future and responsible user an active Call Center agent or Owner, `keepReservation` forbidden for Rejected.

Single transaction (one `runCommand`):
1. Idempotency lookup (same key + same body returns the stored result; different body 409 `IDEMPOTENCY_KEY_REUSED`).
2. `access.check` (B7) on the business and resource state (not Rejected, not archived).
3. Lock the `contact_reservations` row by `(id, leaseToken)` and the `business_calling_states` row `FOR UPDATE`; verify reservation `active`, held by the actor, not lapsed; verify `stateVersion` (else 409 `VERSION_CONFLICT` with current values).
4. Insert `call_attempts` row. If `fulfilsFollowUpId` is set, mark that follow-up `completed` with `completed_by_attempt_id`.
5. Apply the outcome rules (table 6.1), update `business_calling_states` (outcome, marker, `last_touchpoint_at = now`, version + 1).
6. Follow-ups: create (B3-Q04: if one is open, it is rescheduled instead); Rejected cancels the open follow-up (D4, `cancel_source = outcome_rejected`); Accepted keeps it.
7. Accepted: call BE4 `deals.service.createAcceptedOpportunity(tx, …)` in the same transaction (DEC-017: an existing open deal returns the existing one and blocks the save with 409 `STATE_CONFLICT` showing it); developer assignment if `developerId`, else "developer not yet assigned" (E3, derived).
8. Audit (same tx): `call_attempt.logged`, `call_outcome.changed` (only if changed), `follow_up.scheduled|completed|cancelled`, `callback_marker.set|cleared`, `accepted_opportunity.created`, `opportunity.developer_assigned`. Outbox (ids only): `follow_up.scheduled|completed|cancelled`, `call_outcome.changed` (E-16), `opportunity.developer_assigned`, `deal` events owned by BE4.
9. Commit. **After commit, separate transaction:** release the reservation unless `keepReservation` (U-01). Failure of this step is reported as `reservation: 'release_failed'` and never fails the save.

### 6.1 Outcome change rules (WF-CALL-003 section 2.3.1 table)

| From \ To | on_hold | needs_another_call | rejected | accepted |
|---|---|---|---|---|
| pending | save | save (+ follow-up or marker) | save (marker cleared, open follow-up cancelled) | save (+ deal, E5) |
| on_hold | attempt only | save | save | save |
| needs_another_call | save | attempt only (new follow-up or marker) | save | save |
| rejected | forbidden (409 `STATE_CONFLICT`, do-not-call); only Owner reopen (DEC-016) | | | |
| accepted | **agents cannot change Accepted** (B3-Q12): the attempt may still be logged "attempt only" with outcome `accepted`; any other outcome is 422 `RULE_VIOLATION`. Only the Owner re-queues after the deal is Not proceeding | | | |

Same outcome as current: attempt logged, no `call_outcome.changed`.

### 6.2 U-01 (APPROVED) — "Accepted keeps reservation"

`keepReservation: true` is accepted for `on_hold`, `needs_another_call` and `accepted`; it is rejected for `rejected` (Zod `superRefine`, 400, and again in the service as 422 `RULE_VIOLATION`). One function `canKeepReservation(outcome)` is the single rule shared by the service and by the response DTO so FE4 shows the button from the same source. With `keepReservation`, the reservation is renewed (lease extended, idle activity refreshed) instead of released; it stays subject to the idle and max-total rules.

### 6.3 Save after reservation loss (B3-Q05) — flag `calls.saveAfterReservationLoss` (DEMO)

"Lost" = at lock time the reservation is not `active`, token mismatch, lapsed, or held by another user (expired, overridden, released). The decision happens inside the transaction after step 3, so there is no race with the sweep.

| Flag value | Behaviour |
|---|---|
| `keepAttemptOnly` (working default) | Insert the attempt with `reservation_held = false`, `outcome_applied = false` and the stored `reservation_id` of the lost row (when it exists), notes preserved; **do not** change outcome, marker, follow-ups, deal or developer. `last_touchpoint_at` is still updated (a real contact happened). Audit `call_attempt.logged` with `outcomeApplied: false`. Response 200 with `warning: 'outcome_not_applied'`, `reservation: 'lost'`; the client tells the agent to reopen the contact and re-apply the outcome. No outbox events |
| `reject` | Nothing is stored. 409 `RESERVATION_LOST` (code from `shared/errors.ts`); the client keeps the draft and the agent re-acquires |

Both branches: the response never leaks the new holder's identity unless the actor has business access. If the **business** also became Rejected or hidden, the save is refused in both branches (state/permission checks run first; B7).

Both branches get tests in Increment 4 (plan section 10): same request body, flag toggled via the test flag override.

## 7. Follow-up state machine (SM-FOLLOWUP-001)

Stored: `scheduled`, `completed`, `cancelled`. Derived: upcoming, due today, overdue (`scheduled_for + followUps.overdueMinutes` passed, DEMO 60), responsible inactive. Reminder outcomes never change a follow-up (D5).

| Event | Actor | Guards | Result / side effects |
|---|---|---|---|
| Schedule (in call save, or `POST /api/follow-ups`) | assignee, Owner | access (B7), not Rejected, future time, responsible = active Call Center or Owner; B3-Q04: an open follow-up is rescheduled, not duplicated | `scheduled`; clear D2 marker; touchpoint; audit/outbox `follow_up.scheduled` |
| Reschedule / change responsible (`PATCH`, `version`) | responsible, assignee, Owner | not Rejected; new time valid; version | change row; `follow_up.rescheduled` / `.reassigned` (reminders replaced by the planner) |
| Complete | responsible, Owner | linked attempt or note; if it is the last open follow-up of a Needs-another-call business, a replacement follow-up or marker is required in the same save (D2) | `completed`; `follow_up.completed` (+ `callback_marker.set`) |
| Cancel | responsible, Owner | reason; same D2 rule | `cancelled` (`user`); `follow_up.cancelled` |
| Outcome Rejected | system (call save) | D4 working default | `cancelled` (`outcome_rejected`) in the same save |
| Outcome Accepted | — | D4 working default | follow-ups kept |
| Reassignment | Owner | per-follow-up choice | transfer (responsible changed), cancel (`reassignment`), or keep |

Repeating a command that is already in the target state is a no-op 200 (plan 4.5). Version conflicts return 409 `VERSION_CONFLICT`.

## 8. Do-not-call, reopen, requeue, opportunities

* Rejected = do-not-call: no acquire, no scheduling, excluded from queues and assignment for **everyone including the Owner**. Inbound DNC (B3-Q10): `LogInboundRejectionBody` creates an attempt with `channel = inbound_other`, outcome `rejected`, reason required, no reservation needed; by assignee or Owner.
* Reopen (DEC-016): Owner + 2FA, reason, `stateVersion`; Rejected -> Pending; writes `outcome_reopenings (reopen)`, audit `call_outcome.reopened`. Re-queue (B3-Q12): Owner, reason; only when the business is Accepted and its deal is Not proceeding (checked through a BE4 read op); Accepted -> Pending, history kept.
* `GET /api/calling/opportunities` composes Accepted attempts with a BE4 read op for deal stage/developer; hidden businesses omitted and not counted (OI-07).

## 9. Queue buckets (derived, nothing stored)

`new_assigned` (assigned, pending, no attempts), `requires_contact` (pending/on_hold), `callback_due` (open follow-up due), `callback_to_schedule` (D2 marker), `on_hold`, `overdue_follow_up`. Accepted and Rejected businesses leave the "requires contact" buckets. `reservedByOther` is shown without the holder name unless the actor has business access.

## 10. Cross-module contracts

| Direction | Operation |
|---|---|
| BE2 -> calls | `initCallingState(tx, businessId)` in the business-insert transaction |
| assignment -> calls | lock calling-state row, `transferFollowUps`, `openItemsFor(employeeId)` (only direction, AR-07) |
| calls -> reservation | `validateLease(tx, { id, token, actorId })`, `endAfterSave(…)` |
| calls -> deals (BE4) | `createAcceptedOpportunity(tx, …)` (E5); read ops for opportunities and Not proceeding |
| calls -> platform | `outbox.emit(ctx.tx, …)`, `idempotent('calling.attempt')` |
| reservation -> platform | J-05 `reservation.expiry_sweep` handler registered through `JobQueue` |

Audit names are the Phase 2 G2 names; `call_outcome.reopened` and `calling_assignment.retained` are placeholders marked in code.

## 11. Test plan (Increment 4)

SEQ-09/10/11/13: concurrent acquire (one winner), lazy expiry on acquire, heartbeat extends lease, idle expiry with a fixed clock, max-total and "Keep working", override with reason and holder notice, release idempotent; attempt idempotency (double submit = one row), D2 validation, Rejected cancels follow-up and clears marker, Accepted keeps follow-up and creates the deal atomically (rollback of attempt when the deal insert fails), DEC-017 existing deal; **U-01** (keep for accepted/needs_another_call/on_hold, forbidden for rejected); **save-after-loss both flag values**; reassignment with active reservation (precondition), per-follow-up choices; role 403 per endpoint, hidden/not-assigned 404/403, version 409, leakage tests for the queue, follow-up list and DNC list.

## 12. Open questions for review

1. Token storage (hash vs clear), section 2.
2. Name of the opportunities action (`call_attempt.list_opportunities` vs a `deal.*` action).
3. Whether `POST /api/calling/attempts/inbound-rejection` is a separate route (schema provided: `LogInboundRejectionBody`) or the main route with `channel = inbound_other` and no reservation; the draft assumes a separate route so the main body can keep `reservationId`/`leaseToken` mandatory. The plan catalogue (4.1) lists only `POST /attempts`; TL to confirm the extra path.
4. Timer settings are SETs read through `getSetting` (BE1); until BE1 ships it, the service reads `flags[...]` defaults.
