# Delivery backend design (BE4, Increment 2 draft)

Scope: `deals`, `meetings`, `projects` (+ tasks). Status: **draft for review**. Nothing here is applied: the migrations are `*.sql.draft` (`backend/src/db/migrate.ts` only reads files ending in `.sql`) and the services are still stubs. Sources: plan §3, §4, §6, §8, §10; arch-a/arch-b delivery sections; batch4 state models; interaction-spec Developer section; policy-defaults.

Every policy below is **"Demonstration alternative — not approved (docs/policy-defaults.md)"**. The only approved rule in the system is U-01 (Accepted keeps reservation), which does not touch this module.

## 1. Files

| File | Content |
|---|---|
| `backend/src/db/migrations/400_deals_core.sql.draft` | `deals`, `deal_developer_assignments`, `closure_reviews`, `deal_changes` |
| `backend/src/db/migrations/410_meetings.sql.draft` | `meetings`, `meeting_attendees`, `meeting_changes` |
| `backend/src/db/migrations/420_projects_tasks.sql.draft` | `projects`, `project_developer_assignments`, `project_changes`, `tasks`, `project_provisioning_states` |
| `modules/{deals,meetings,projects}/schemas.ts` | Zod `.strict()` request schemas, DTOs, `defineActions` |

Promotion: rename `.sql.draft` to `.sql` after review. Order 400, 410, 420 is FK order (they also need BE2 `businesses` and BE3 `call_attempts` tables, so they must follow ranges 2xx and 3xx; `deals` references both).

## 2. Deal stage machine (SM-COMMERCIAL-001)

Stored `deals.stage`: `accepted_opportunity`, `signed`, `paid`, `signed_and_paid`, `closed`, `not_proceeding`. Developer assigned or not, meeting arranged, closure-verification requested and "project exists" are **not** stages (attribute, derived, review row, derived).

```
accepted_opportunity --signature--> signed --payment--> signed_and_paid --finalize--> closed (terminal)
accepted_opportunity --payment----> paid   --signature-> signed_and_paid
signed / paid / signed_and_paid --remove fact (Owner, reason)--> previous stage
any non-closed --not proceeding (reason)--> not_proceeding --reopen (Owner, reason)--> accepted_opportunity
```

| Command (`POST /api/deals/:id/…`) | Action | From | Guard | Audit / outbox |
|---|---|---|---|---|
| (E5 internal) `createAcceptedOpportunity(ctx, input)` | — | start | called by MOD-calls in its tx; unique `accepted_attempt_id`; DEC-017 partial unique index; returns existing deal on replay | audit `accepted_opportunity.created` (counted once); outbox `opportunity.developer_assigned` if a Developer was given |
| `developer` | `deal.assign_developer` | any open stage | active Developer; Owner, or Call Center on its own accepted deal | `opportunity.developer_assigned` / `_reassigned` (E-08); closes previous `deal_developer_assignments` row |
| `signature` | `deal.record_signature` | `accepted_opportunity`, `paid` | date + reference; Owner or assigned Developer (DEC-005 flag) | `deal.signature_recorded` |
| `payment` | `deal.record_payment` | `accepted_opportunity`, `signed` | date + reference; optional amount+currency together; currency must be in `deals.currencies` else `409 POLICY_NOT_CONFIGURED` | `deal.payment_recorded` |
| `closure-request` | `deal.request_closure_verification` | `signed_and_paid` | only `ownerVerify`; one open request | `deal.closure_requested` + outbox E-13 |
| `closure-verify` | `deal.verify_closure` | `signed_and_paid` | Owner, `ownerVerify`; verifies **and** finalizes in one tx | `deal.closed` + outbox E-14 |
| `closure-reject` | `deal.reject_closure` | `signed_and_paid` | Owner, reason; stage unchanged | `deal.closure_rejected` |
| `finalize` | `deal.finalize` | `signed_and_paid` | see §3 | `deal.closed` + outbox E-14 |
| `not-proceeding` | `deal.mark_not_proceeding` | any non-closed | reason; cancels pending meeting reminders through `meeting.cancelled`-style planner event only for Scheduled meetings (meetings stay as they are, see §6) | `deal.marked_not_proceeding` |
| `reopen` | `deal.reopen_not_proceeding` | `not_proceeding` | Owner, reason; fails `409 CONFLICT_DUPLICATE` if the business already has another open deal | `deal.reopened` |
| (extra) `remove-fact` | `deal.remove_fact` | `signed`, `paid`, `signed_and_paid` | Owner, reason; stage reverts, values kept in `deal_changes` | `deal.fact_removed` |

Rules common to every command: one transaction containing change + `deal_changes` row (where listed in the migration check constraint) + audit + outbox; body carries `version` (§4.5); repeating a command already in the target state is a no-op 200; `Idempotency-Key` required (plan §4.7); `access.check(deal)` inside the tx. DB check constraints back the guards (`deals_signed_has_fact`, `deals_paid_has_fact`, `deals_closed_needs_both`).

Not-proceeding keeps the call outcome Accepted; Owner re-queue is BE3's (B3-Q12). Closed deals never reopen (OQ-15); repeat business is a new deal.

Decisions for review:
1. **Reopen target.** OQ-15 says "back to Accepted opportunity". Because the stage is stored, reopen clears the signature/payment columns and writes the previous values to `deal_changes`; the Developer re-records them. The alternative (restore the previous stage) is a one-line change.
2. **Extra table `deal_changes`** and extra command `remove-fact` are not in ERD-4 / plan §4.1. `remove-fact` is required by interaction-spec SCR-DEV-002 ("Remove recorded fact…"). If rejected, history stays in audit only.

## 3. Closure under both flag modes (`deals.closureMode`, DEC-006)

| | `ownerVerify` (default, Alt B) | `direct` (Alt A) |
|---|---|---|
| Developer | records signature + payment, then **requests verification** (`closure-request`) | records signature + payment, then **finalizes** |
| Owner | sees "Closure verification requested", **verifies** (= finalizes) or **rejects with reason**; may also finalize directly with no request | may finalize |
| `finalize` by Developer | `403 PERMISSION_DENIED` | allowed (assigned Developer) |
| `closure-request` | allowed, one open at a time | `409 STATE_CONFLICT` (not available in this mode) |
| `closure-verify` / `closure-reject` | Owner only | `409 STATE_CONFLICT` |
| Rejected review | stage stays `signed_and_paid`; Developer sees the rejected banner (latest `closure_reviews` row = `rejected`); may request again | n/a |
| `deals.closure_mode` written at close | `ownerVerify` | `direct` |
| Outbox | E-13 `deal.closure_requested` (Owner item), E-14 `deal.closed` | E-14 only |

Both modes share the same guard: stage is `signed_and_paid` (accepted + signed + paid, order independent OQ-05) and DEC-005 is satisfied for the actor. A flag flip while a request is open leaves the review row readable; `direct` ignores open requests and a later `finalize` marks them `verified` implicitly (not modelled: they are left as history). Tests run each command in both modes.

`deals.developerPreClosure` (DEC-005): `assigned` = the assigned Developer can read, schedule meetings and record signature/payment before closure; `closedOnly` = Developers see only `closed` deals, cannot record facts or schedule meetings; the Developer actions in the table above return `403 PERMISSION_DENIED` and the notification to the Developer is suppressed (arch-b SEQ-13). In that mode only the Owner records facts (this is the R-12 conflict, flagged, not decided here).

## 4. Project provisioning — E-14 / J-07 under F2 (`projects.autoProvision`)

Closure commits **first** (F3). `deals` never calls `projects`; it only emits `deal.closed` (E-14) in the closing transaction.

**Auto (`true`, default):**
1. MOD-projects consumer `projects.provision` (J-03 relay, idempotent per event id + consumer) runs in its own tx: `INSERT INTO projects (deal_id, business_id, name, status='scheduled', provisioned_by='auto') ON CONFLICT (deal_id) DO NOTHING`. Name default: business name + deal code. Writes `project_changes('provisioned')` and audit `project.provisioned`, marks `project_provisioning_states.resolved_at`.
2. On failure the consumer records/updates `project_provisioning_states` (`attempts`, `last_error_code`, `next_attempt_at`), emits outbox `project.provisioning_failed` (E-15, Owner notified) and enqueues job `projects.provision_retry` (J-07) with backoff (`1 m, 5 m, 30 m, 2 h`, then `dead`; visible to Owner). J-07 re-runs step 1; the unique `projects.deal_id` absorbs duplicates.
3. Owner sees "Closed deal without project" (derived: `closed` deal with no `projects` row) and the **Retry** button `POST /api/projects/:id/provision-retry` where **`:id` is the deal id** (the project does not exist yet; path kept from plan §4.1, deviation noted). Retry resets `next_attempt_at` and runs one attempt inline.

**Manual (`false`):**
- The consumer does nothing (it reads the flag when it handles the event; events already relayed are not replayed). No J-07 jobs are created.
- The Owner or an assigned Developer calls `POST /api/projects { dealId, … }` (`project.create_manual`). The service requires `deal.stage='closed'`, no existing project (else `409 CONFLICT_DUPLICATE`), and writes `provisioned_by='manual'`.
- While `autoProvision` is `true`, `POST /api/projects` returns `409 STATE_CONFLICT` ("Projects are created automatically").
- The derived "Closed deal without project" state is the normal waiting state, shown without an error tone.

In both modes the new project has status `scheduled`, no Developer (the Owner assigns, OQ-07/OQ-08; the closing Developer is **not** auto-assigned), and `GET /api/deals/:id` reports `projectProvisioning` = `not_applicable | provisioned | pending | failed`.

Requests to others: BE5 (consumer registration and `projects.provision_retry` job kind in `platform.ts`), BE2 (access-facts view reads `projects.business_id/status/completed_at`, `project_developer_assignments` current rows, `deals.stage/assigned_developer_id/closed_at`).

## 5. Projects and tasks (SM-PROJECT-001 / SM-TASK-001)

Project statuses and `PROJECT_TRANSITIONS` (in `projects/schemas.ts`, single source for guards and `allowedNextStatuses`):

| From | To |
|---|---|
| scheduled | in_progress, waiting_for_client, blocked |
| in_progress | scheduled, waiting_for_client, blocked, **delivered** |
| waiting_for_client | in_progress, scheduled, blocked |
| blocked | in_progress, scheduled, waiting_for_client |
| delivered | in_progress (rework), **completed** |
| completed | none (read-only; Owner `POST /:id/reopen` to in_progress with reason, OQ-15) |

Status changes are the command `POST /api/projects/:id/status` (`to`, `version`, `note`, `acknowledgeOpenTasks`), never a PATCH. `waiting_for_client` and `blocked` require a note (stored in `status_note`, DB check). Delivered is offered only from `in_progress`. No Cancelled status (OQ-11). Access: Owner, or a Developer currently in `project_developer_assignments` (OQ-06), any task in the project.

**Task statuses are `todo`, `in_progress`, `done`, `cancelled` only.** "Waiting for client" is a **project** status. A task that depends on the client has `client_dependency = true` (+ optional note) and the UI shows the **"Client dependency"** chip next to its normal status (as in the P7 dialog: "Content upload · To do · Client dependency"). It never appears as a column or a status value, and setting it does not change the project status. Milestone is `is_milestone` (OQ-09). Board drag sends `PATCH /api/tasks/:id { status, version }`; `cancelled` requires `cancelReason`; `done → in_progress` is Reopen; creating or changing tasks on a Completed project is `409 STATE_CONFLICT`.

## 6. Meetings (SM-MEETING-001)

States `scheduled`, `held`, `cancelled`, `missed`. Reschedule is an event (self-transition, `reschedule_count`, `meeting_changes` before/after), allowed from `scheduled` and `missed` (missed returns to scheduled). `held`/`missed` need the start time reached; `cancel` needs a reason and is final; held allows only notes amendments. Time must not be in the past on create/reschedule; at least one attendee (checked in the service, same tx). Outbox E-06 `meeting.scheduled|rescheduled|cancelled|held|missed` (planner supersedes reminders); a reminder failure never changes the meeting (D5). Access goes through the deal check; attendance grants nothing (OI-29). Developers may create meetings only when `deals.developerPreClosure = assigned`.

When a deal becomes `not_proceeding`, its Scheduled meetings should be cancelled (reason "Deal not proceeding"). Deals cannot call meetings (meetings depends on deals, arch-a §3.2.1), so the cancellation is a MOD-meetings consumer of an outbox event `deal.not_proceeding`, which is not in `OUTBOX_EVENTS` today. Request to TL: add `deal.not_proceeding` (and `deal.closure_rejected`) to the catalogue. Until then Scheduled meetings stay and the UI marks them for the deal.

## 7. "Record delivered" open-task warning (P7, OQ-10)

`POST /api/projects/:id/status` with `to: 'delivered'` (from `in_progress`) or `to: 'completed'` (from `delivered`):

1. Lock project, check `version`, check transition.
2. Count tasks with status `todo` or `in_progress` (not done, not cancelled).
3. If the count is 0: change status, no dialog.
4. If the count is > 0 and `acknowledgeOpenTasks` is not true: **no change**; respond `422 RULE_VIOLATION` with `details = OpenTasksWarningDetails` (`code: 'OPEN_TASKS_WARNING'`, `from`, `to`, `openTaskCount`, `openTasks[]` each with title, status, `clientDependency`). The UI renders "Record delivered with open tasks?" (or "Record completed with open tasks?").
5. If acknowledged: change status only, set `delivered_at`/`completed_at`, write `project_changes('status_changed', open_task_count)`, audit `project.status_changed`. **Tasks, their owners, dates and board columns, and the deal and its closure are not touched.** The response includes `taskCounts.open` for the toast "Project delivered · 3 tasks still open".
6. It is a warning, never a block. The "Review open tasks" link and Cancel are client-only (no call).

Race: tasks may change between the 422 and the confirmed call; the confirmation recounts and records the actual number. Tests: dialog payload with open tasks; no warning with none; cancel path makes no call (status unchanged); confirm changes only the project row and history; tasks identical before/after; same for `completed`.

## 8. Endpoints, access and flags summary

Endpoints follow plan §4.1. Added or changed (for TL/FE5 acknowledgement): `POST /api/deals/:id/remove-fact`, `POST /api/projects/:id/status`, `POST /api/projects/:id/reopen`; `POST /api/projects/:id/provision-retry` takes the deal id. All other paths as catalogued. Actions are in each `schemas.ts` and map to `docs/security/authz-matrix.md`; resource-level rules (assigned Developer, DEC-005 flag, Owner-only) are enforced by `access.check` plus service guards, with a test per role.

| Flag | Branches tested |
|---|---|
| `deals.developerPreClosure` (DEC-005) | `assigned`, `closedOnly` |
| `deals.closureMode` (DEC-006) | `ownerVerify`, `direct` |
| `projects.autoProvision` (F2) | `true` (consumer + J-07 retry), `false` (manual create) |
| `deals.currencies` / `deals.defaultCurrency` (DEC-018) | empty → `409 POLICY_NOT_CONFIGURED` when an amount is sent; configured list validates |

## 9. Open points for the reviewer

1. Reopen target stage and the extra `deal_changes` table / `remove-fact` command (§2).
2. `deal.not_proceeding` / `deal.closure_rejected` outbox events are missing from `OUTBOX_EVENTS` (§6): TL request.
3. `project.provision_retry` takes a deal id in `:id` (§4).
4. `closure_reviews` has no "withdrawn"; a rejected request is simply re-requested.
5. Currency on payment is validated in the service because `deals.currencies` is a runtime setting (NEEDS VALUE), not a DB constraint.
6. BE2 must be told the columns the access-facts view reads (§4); BE5 must register the `projects.provision` consumer and the J-07 job kind.
