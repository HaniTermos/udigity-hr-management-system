# Review 03: backend calling and delivery (BE3 + BE4)

| Field | Value |
|---|---|
| Reviewer | Reviewer 3 (read-only) |
| Date | 2026-10-28 |
| Scope | `backend/src/modules/{assignment,reservation,calls,deals,meetings,projects}/**`; migrations 300–350 and 400–430 |
| References | `docs/implementation/calling-design.md`, `docs/implementation/delivery-design.md`, `docs/phase_2_workflows_and_state_machines.md`, `docs/security/authz-matrix.md`, `docs/policy-defaults.md`, `docs/security/review-inc3-7.md` |
| Test run | `delivery.api.test.ts` on `udigity_test_r3`: **2 failed / 49 passed** (same 2 as the baseline) |

Policy labelling: only U-01 ("Accepted keeps reservation") is approved. Every other flag mentioned here (DEC-004/005/006, D2, D4, B3-Q05, OQ-15, F2 …) is a demonstration alternative and is reviewed only for *both-branch correctness*, not for its value.

## 1. The two failing tests — root cause

**Both failures have one cause, and it sits outside this slice: `backend/src/modules/access/rules.ts:236-240`.** The `developer` branch of `buildRuleFragments` now reads:

```ts
case 'developer': {
  scope = 'TRUE';
  relation = 'TRUE';
  windowForRole = window();   // ← grants `full` on every business inside the 15-day window
```

Authz-matrix §2.3 gives Developers **no base window**. A Developer reaches a business only through DEC-002 rows 1 to 4: an assigned pre-closure deal, a closed deal, or an active or completed project. With the window granted, `access.check` returns `level: 'full'` for **any** business created in the last 15 days. The `owner`/`human_resources` default branch was copied for `developer` ("staff roles can read active businesses in the company directory"). `access.test.ts:296` still expects the old fragment `(TRUE AND FALSE AND FALSE)`. That is also why the access tests fail in the baseline.

| Test | What happens | Why |
|---|---|---|
| DEC-005 `closedOnly`, `delivery.api.test.ts:489` | `GET /api/deals/:id` by the Developer on a closed deal returns `access: 'full'`, but `'context_limited'` (row 2) is expected | The test business is minutes old, so `window` is TRUE and `check` returns `full` before any exception row is considered (`access/service.ts:117`) |
| not-proceeding cancels meetings, `delivery.api.test.ts:525` | The second `not-proceeding` by the Developer returns 200 (no-op), but 403 is expected | View 903 drops `not_proceeding` deals, so with correct rules the Developer has no grant and `authorize()` fails. With the window grant, `authorize()` passes. `assertOwnerOrAssignedDeveloper` passes because the DV is still `assigned_developer_id`, and the stage is already `not_proceeding`, so the command is a no-op 200. The meeting-cancellation part of this test **passes**: the outbox consumer works |

Fix (BE2): restore `relation`/`window` for `developer` so the role gets no window. Grants then come only from rows R1 to R4. Separately, the service-layer confinement in deals hides most of this. `developerMayReadDeal` makes `getDeal(dv2)` still answer 403. So list and scope leakage to Developers is the real exposure: `scopeFilter` on `business`, `meeting` and `project` lists, and `checkMany` callers. It is a P0 for the access reviewer.

## 2. Findings

| ID | Sev | file:line | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|---|
| R3-01 | **P0** | `meetings/service.ts:277-315` | `createMeeting` has two unreviewed paths that write **before** `authorize()`. (a) With `businessId` and no open deal, it raw-INSERTs a `call_attempts` row (outcome `accepted`, `reservation_held` default true, no reservation) and a `deals` row whose `assigned_developer_id` is "the first attendee who is not me", with **no role check**. (b) If any attendee is an active Developer and the deal has no Developer, it runs `UPDATE deals SET assigned_developer_id` with no version bump, no `deal_developer_assignments` row, no audit and no outbox. The transaction then calls `authorize('meeting.create')`, and the access-facts view now sees the new deal or assignment, so R1 grants. | **Authorization bypass.** Any Developer, which `meeting.create` allows, can attach themselves to any unassigned open deal (by id) or create an accepted deal for **any** business (by id), and so gain R1 access. It also bypasses: the BE3 save flow (no reservation, no `business_calling_states` change, so the business stays Pending/assignable with an open deal), DNC (works on Rejected businesses), archived checks, `createAcceptedOpportunity` (no `accepted_opportunity.created` audit), module ownership (meetings writes `call_attempts`, `deals`), optimistic concurrency, and OI-29 ("attendance grants nothing"). A non-developer can also be stored as `assigned_developer_id`. | Delete both blocks. Require `dealId`, authorize first, and never change deals from meetings. If "meeting from a business" is a real product need, route it through `calls.logAttempt` (accepted) and `deals.assignDeveloper`. |
| R3-02 | P1 (cross-slice) | `access/rules.ts:236-240` | Developer role is granted the 15-day window (see §1) | Developers see every fresh business in lists and get `full` level; 2 delivery tests and the access tests fail | Restore the "no window" rule for `developer` (BE2) |
| R3-03 | P1 | `notifications/service.ts:347` vs `assignment/service.ts:119,227` | E-07 consumer reads `payload.agentId`; the assignment events emit `assigneeId` | "You were assigned" in-app notices are **never** delivered. The consumer silently skips. | Read `assigneeId` (or emit both); add a contract test emitter→consumer |
| R3-04 | P1 | `notifications/service.ts:383` vs `reservation/service.ts:346-351` | Override holder notice (B3-Q14) reads `payload.previousHolderId`; the reservation emits `holderId` | The overridden agent is never told. They learn only at the next heartbeat or save. | Align the key |
| R3-05 | P2 | `notifications/service.ts:341` | `project.provisioning_failed` (E-15) is subscribed but has **no branch**, so it is a no-op | Delivery-design §4 "Owner notified" is not implemented. Only the derived "Closed deal without project" row shows the failure. | Add the Owner branch, as for `deal.closed` |
| R3-06 | P2 | `deals/service.ts:718-720`; `shared/outbox.ts:52,55` | `deal.closure_rejected` and `call_outcome.changed` (E-16) are emitted with **no consumer** | The Developer never gets the "closure rejected" item (ORCH-2 (3)). E-16 has no reader. Events pile up as delivered and are never used. | Add the BE5 consumer for `deal.closure_rejected`; document E-16 as reporting-only or consume it |
| R3-07 | P2 | `reservation/service.ts:298-310`; `schemas.ts:136` | Security R2-10 is **only partly fixed**. `keepWorking` is now honoured only after `maxTotalWarning`, but there is no cap on the number of extensions, and `idleSeconds` is still client-reported (`0` never idles). | One agent can still hold a contact indefinitely, so the DEC-004 max-total/idle limits are client-controlled. That blocks colleagues and Owner reassign (`assignment/service.ts:180-188`). | Server-side cap (for example max N extensions per window or an absolute cap), treat `idleSeconds` as advisory, and add a per-reservation heartbeat rate limit (threat model §5.9; R2-07 is still open: no limiter on these routes) |
| R3-08 | P2 | `calls/service.ts:440-478`; `reservation/service.ts:374-377` | Security R2-12 is still open. Under `keepAttemptOnly`, a caller who **never held** the reservation (`not_found`, or `token_mismatch` on another user's active row) still inserts an attempt and bumps `last_touchpoint_at` | Under DEC-001 Alt B, touchpoints extend the visibility window, so any assignee or Owner can keep a business visible without holding it. It also pollutes attempt history. | Only take the keep-attempt branch when `lease.row` belongs to the caller (lost/expired/overridden); refuse `not_found`/foreign rows |
| R3-09 | P2 | `calls/service.ts:204-208` | Security R2-11 is still open: there is no far-future cap on follow-up `scheduledFor` | A row-5-only agent can push a callback years ahead and keep context access to a hidden business | Cap with a setting (for example 90 days), at least for non-Owners |
| R3-10 | P2 | `deals/service.ts:778-811` vs `calls/service.ts:677-714` | Deal reopen (OQ-15) does not consult the calling state, and BE3 re-queue reads deals without a lock. Sequence: deal Not proceeding → Owner re-queues (Accepted→Pending) → Owner reopens the deal | The business is now **Pending and in the queue with an open deal**. A new Accepted call then fails DEC-017 (409), and assignment eligibility (B6) flags `open_deal`. The two state machines diverge. | Either refuse reopen when the calling outcome is no longer Accepted, or on reopen require that the business was not re-queued (check `outcome_reopenings`); take the calling-state lock in both |
| R3-11 | P2 | `meetings/service.ts:232-240, 251-254` | Developer list and read confinement short-circuits on **attendance** (`isAttendee → true`) | This contradicts OI-29 / matrix §2.4 ("attendance alone grants nothing"). Under `closedOnly`, an attendee Developer still sees pre-closure meetings if any grant reaches the business. | Remove the attendee shortcut and rely on `developerMayReadDeal` |
| R3-12 | P2 | `meetings/service.ts:343-390` | Reschedule has no deal-stage guard. A `missed` meeting of a `not_proceeding` or `closed` deal can be rescheduled back to `scheduled` (create checks `OPEN_DEAL_STAGES`; reschedule does not) | The not-proceeding cancellation is undone silently, and reminders are re-planned for a dead deal | Apply the same open-deal guard on reschedule |
| R3-13 | P3 | `reservation/service.ts:226-245`; design §5.3 | Deadlines use the app clock (`clock.now()`), not the DB clock as designed | Clock skew between API instances and the worker sweep can shorten or extend leases | Use the DB `now()` or document a single-instance assumption |
| R3-14 | P3 | `platform/idempotency.ts` + `reservation/routes.ts:25` | The acquire response (with `leaseToken`) is persisted in clear in the idempotency store | Design point: the token is "never logged, audited or put in the outbox". The idempotency table is a 4th copy. | Strip `leaseToken` before storing, or exclude acquire from response caching (replay → re-entry path) |
| R3-15 | P3 | `reservation/service.ts:321-329` | Security R2-26 is still open: release skips `access.check`; renew/release on a foreign id answers `token_mismatch` (existence oracle) | Minor B7 gap | Check access; answer 404 for foreign rows |
| R3-16 | P3 | `calls/service.ts:773-784` | Security R2-27 is still open: an assignee may re-point `responsibleId` to themselves without a reason | Silent takeover of a callback | Require `reason` when the responsible changes |
| R3-17 | P3 | `assignment/service.ts:134`; `schemas.ts` | Security R2-28 is still open: `source` is client-supplied on `/assign` | Labelling and report integrity | Force `manual` on HTTP |
| R3-18 | P3 | calls/assignment list functions | Security R2-29 is still open: no `refreshAccessSettings` before `scopeFilter` (no call anywhere in this slice) | Stale settings cache (fails closed) | Call it at the top of the list reads |
| R3-19 | P3 | `projects/service.ts:287-312` | Security R2-33 is still open: `lastErrorCode` is shown to Developers | Internal error codes leak | Owner only |
| R3-20 | P3 | `calls/service.ts:865-883` | `keepReservation` for Rejected is refused only by Zod. The service silently releases instead of the designed 422 (§6.2 "again in the service") | Defence in depth only (U-01 is approved and `canKeepReservation` is shared) | Throw `ruleViolation` in `logAttempt` |
| R3-21 | P3 | `calls/opportunityPort.ts:182-188, 210-216` | `serviceInterest` is passed by calls but dropped by `AcceptedOpportunityInput`, so it never reaches the deal | Data loss (it is shown only through the attempt join) | Add it to the port, or document that it lives on the attempt |
| R3-22 | P3 | `calls/repo.ts:439-450` | Opportunity enrichment picks the *latest accepted attempt of the business*, not `deals.accepted_attempt_id` | When a business has an old Not-proceeding deal and a new deal, both rows show the new notes. Meeting-created fake attempts (R3-01) also show up. | Join on `accepted_attempt_id` |
| R3-23 | P3 | `calls/service.ts:802-815` | `applyReplacement('callback_to_be_scheduled')` sets the D2 marker for any outcome (on_hold, accepted) | The marker is meaningful only for Needs another call; it shows in the `callback_to_schedule` bucket | Allow it only for `needs_another_call` |
| R3-24 | P3 | `assignment/` | The "keep as is" / `calling_assignment.retained` command (design §4) is not implemented | Design gap (it is a placeholder) | Implement it or drop it from the design |
| R3-25 | P3 | `assignment/service.ts:249-270` | Autofill cap is counted without a lock, so two concurrent autofills for one agent can exceed `work.autofillPerAgentPerDay` | Owner-only and rare | Advisory lock per agent |
| R3-26 | P3 | `projects/service.ts:91`; `meetings/service.ts:216,255,263` | `new Date()` instead of `clock`/company TZ (`today()` is a UTC date) | `deliveryOverdue` is wrong around midnight and the test clock is ignored | Use `clock.now()` and the company TZ |
| R3-27 | P3 | `deals/service.ts:99-106`, `support.ts:55-62` | N+1 queries in `getDealSummaries` and `employeeNames` (one query per id) | Performance on lists and calendars (up to 500 meetings) | Batch with `= ANY($1)` |
| R3-28 | P3 | `deals/repo.ts:418-427` | `total` comes from `COUNT(*) OVER()` and is 0 when the page is past the end | Wrong pager total | Separate COUNT or a CTE |
| R3-29 | P3 | `notifications/service.ts:306` (wiring) | The meeting reminder planner selects attendees without `removed_at IS NULL` | Removed attendees still get reminders | Filter `removed_at IS NULL` |
| R3-30 | P3 | migration `430_meetings_business_id.sql` | `meetings.business_id` is a denormalised copy with no consistency check against `deals.business_id` | Access for meetings resolves via this column (R-06). Drift would mis-scope. | Trigger or composite FK `(deal_id, business_id)` |

### Checked and correct (no finding)

- **Reservation SM:** one active row (partial unique index is the arbiter, `ON CONFLICT DO NOTHING` then re-read); lazy expiry by conditional `UPDATE … WHERE state='active'`, so a single writer records `expired`; same-holder re-entry; renew re-checks access (B7) and ends `access_denied`; override is Owner + 2FA, reason required, flag-gated; sweep uses `SKIP LOCKED`; post-commit release is a separate transaction and never fails the save (AR-03); U-01 `keepAfterSave` refreshes idle but not max-total. The lease invariant `lease_expires_at = min(lease, idle, max)` holds on every write.
- **Outcomes (§6.1):** Rejected is DNC for everyone, Owner included; Accepted is attempt-only for agents; the E5 deal is created in the same transaction (rollback test via the port seam); D2 XOR is enforced in Zod and the service; D4 Rejected cancels the follow-up (`outcome_rejected`) and clears the marker; Accepted keeps follow-ups; version check on the calling state; lock order reservation → state → follow-up holds in every command.
- **Follow-ups:** one `scheduled` per business (index); B3-Q04 reschedule-instead-of-duplicate; complete/cancel idempotent; D2 replacement rule; responsible must be an active CC or Owner.
- **Deal SM:** stage transitions match §2 (order-independent signature/payment; remove-fact reverts; closed is terminal; not-proceeding from any open stage; Owner reopen with DEC-017 backed by `uq_deals_one_open_per_business`). Closure under `ownerVerify` (request → verify/reject, Developer finalize 403) and `direct` (request/verify/reject 409, assigned DV finalize) both match §3. `closure_mode` is stored at close.
- **Projects/tasks:** `PROJECT_TRANSITIONS`/`TASK_TRANSITIONS` match §5. Note required for waiting/blocked (Zod + DB check). Completed is read-only and Owner reopen needs a reason. The **Record-delivered warning** matches §7 exactly: 422 `RULE_VIOLATION` + `OPEN_TASKS_WARNING` details; acknowledged → only the project row + `project_changes.open_task_count`; tasks and the deal are untouched; recount on confirm.
- **Provisioning:** closure commits first; the `projects.provision` consumer runs in a savepoint; failures write state + E-15 + J-07 with 1m/5m/30m/2h backoff, then dead; `projects.deal_id UNIQUE` absorbs duplicates; manual mode refuses while auto is on.
- **Migrations 300–350, 400–430:** idempotent DDL, FKs `RESTRICT`, append-only trigger on `call_attempts`, state-consistency checks on every SM table. No destructive statements; the 430 `UPDATE` backfill is safe.

## 3. Wiring map

### Cross-module calls

| From → To | Operation | Where | Status |
|---|---|---|---|
| BE2 businesses → calls | `initCallingState(db, id)` in the business-insert transaction | `businesses/service.ts:715` | Wired |
| calls → reservation | `validateLease`, `endAfterSave`, `keepAfterSave` (post-commit), `activeFor`, `liveHolders` | `calls/service.ts:428, 865-883` | Wired |
| reservation ← calls | `registerAcquireGuard(acquireGuard)` (not Rejected, not archived) | `calls/module.ts:158` | Wired (it throws `notImplemented` until registered: fails closed) |
| calls → deals (BE4) | `createAcceptedOpportunity(ctx, …)` in the attempt transaction via `opportunities()` port; `findOpenDeal`, `findNotProceedingDeal`, `listOpportunities` | `calls/opportunityPort.ts:206-226` | Wired (`serviceInterest` dropped, R3-21) |
| calls → meetings | `firstMeetingAtByDeal` (CC-007) | `calls/service.ts:1067` | Wired |
| assignment → calls | `lockCallingState`, `transferFollowUps`, `callingStateOf`, `openFollowUpOf` | `assignment/service.ts:19, 216, 238` | Wired |
| assignment → reservation / deals | `activeFor` (reassign precondition), `findOpenDeal` (B6) | `assignment/service.ts:180, 52` | Wired |
| deals ← projects | `registerDealProjectInfoProvider(projectInfoForDeals)` | `projects/module.ts:195` | Wired |
| meetings → deals | `getDealSummary`, `developerMayActOnDeal/ReadDeal`, **raw INSERT/UPDATE on `deals` and `call_attempts`** | `meetings/service.ts:277-315` | **Boundary violation, R3-01** |
| BE1 open items → calls/deals/projects | `openItemsFor`, `openFollowUpCounts`, `openItemsForMany` | exported | Wired (consumed by employees) |
| Access resolvers | `reservation`, `follow_up`, `call_attempt`, `deal`, `meeting`, `project`, `task` → business | each `module.ts` | Wired |

### Jobs

| Job | Registered | Handler |
|---|---|---|
| J-05 `reservation.expiry_sweep` (every 60 s) | `reservation/module.ts:90` | `sweepExpired` |
| J-07 `projects.provision_retry` (enqueue-only, backoff from enqueuer) | `projects/module.ts:205` | `runProvisionRetry` → `provisionAttempt` |

### Outbox events emitted in this slice and their consumers

| Event | Emitted by | Consumer(s) | Status |
|---|---|---|---|
| `follow_up.scheduled/rescheduled/reassigned/completed/cancelled` | calls | `notifications.reminder_planner` | OK |
| `call_outcome.changed` (E-16) | calls (save, inbound DNC, reopen/requeue) | **none** | R3-06 |
| `calling_assignment.assigned/reassigned` (E-07) | assignment | `notifications.business_events` | **Payload key mismatch, R3-03** |
| `contact_reservation.overridden` | reservation | `notifications.business_events` | **Payload key mismatch, R3-04** |
| `opportunity.developer_assigned/reassigned` (E-08) | deals | `notifications.business_events` | OK (not suppressed under `closedOnly`, design §3 says suppress; P3) |
| `deal.closure_requested` (E-13) | deals | `notifications.business_events` (Owners) | OK |
| `deal.closed` (E-14) | deals | `projects.provision`, `notifications.business_events` | OK |
| `deal.closure_rejected` | deals | **none** | R3-06 |
| `deal.not_proceeding` | deals | `meetings.cancel_for_deal_not_proceeding` → `meeting.cancelled` | OK (test passes this part) |
| `meeting.scheduled/rescheduled/cancelled/held/missed` (E-06) | meetings | `notifications.reminder_planner` | OK (removed attendees, R3-29) |
| `project.provisioning_failed` (E-15) | projects | `notifications.business_events` subscribes, **no handler branch** | R3-05 |

### Stubs or unwired code

Nothing in the slice is stubbed. `notImplemented` appears only as the fail-closed default of the acquire guard, which is replaced at init. Test seams (`setSaveAfterLossOverride`, `setOpportunityPort`, `setDeliveryPolicyForTests`, `setProvisioningFaultForTests`) are refused outside `NODE_ENV=test`. Unimplemented: `calling_assignment.retained` (R3-24). `deals.reopenTarget` is a code constant pending the registry key ([BE4-R1]).

### Timers: server-trusted or client-controlled

| Timer | Source of truth | Status |
|---|---|---|
| Lease expiry (`leaseSeconds`) | Server (`lease_expires_at`, lazy + sweep) | Trusted |
| Idle (`idleMinutes`) | **Client** `idleSeconds` (can only move activity forward; `0` = never idle) | Open, R3-07 |
| Max total (`maxTotalMinutes`) | Server window; `keepWorking` honoured only after the warning, but **unbounded repeats** | Partly open, R3-07 |
| Follow-up time | Client value, future-only check, **no upper cap** | Open, R3-09 |
| Meeting held/missed | Server (`starts_at <= ctx.now`) | Trusted |
| Attempt time | Server now (B3-Q07) | Trusted |
| Clock source | App clock (`clock.now()`), not DB `now()` | R3-13 |
