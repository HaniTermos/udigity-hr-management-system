# Authorization matrix: the access-engine contract

| Field | Value |
|---|---|
| Owner | Security Lead (`docs/security/`) |
| Date | 2026-10-23 (BL-06 rows added 2026-10-26 by INT-BE; V-01/R2-02/R2-03 rows added 2026-10-26 by BE-LEAD; Security Lead review pending) |
| Status | **CONTRACT.** Every backend agent implements authorization **only** through the shared access engine (MOD-access, ADR-017) using the action names below. To change a rule, post a REQUEST to the Security Lead |
| Sources | `phase2/shared-baseline.md` §4, §6 C, §10 (R-01, R-02, R-11); `phase2/batch2/batch2-spec.md` Table RT, VT-1..VT-6; `architecture-b.md` §6–§7, SEQ-01..15; `policy-defaults.md` |
| Roles | `owner` (O), `data_entry` (DE), `call_center` (CC), `developer` (DV). One role per employee (IC-01). Custom roles (migration 014) are additive and governed by §3.11 only |

**Legend**
- **Y** allowed (subject to the row rule). **N** denied with 403 `PERMISSION_DENIED`. **Own** = only the user's own record (actor = `req.user.id`). **Asg** = only while currently assigned. **Ctx** = context-limited (VT-5): only the listed fields and actions, only on that surface.
- **DEMO** = the row depends on a policy flag or setting. Its current value is a **demonstration default** ("Demonstration alternative — not approved", `policy-defaults.md`). Code must read the flag and keep the other branch where the flag is marked FLAG. Rows without DEMO are Confirmed baseline rules or Security defaults.
- **2FA** = Owner session must be `active` (2FA complete). This applies to **every** Owner row. Under R-11 (DEMO, default R11-a) a pending Owner session can call only the auth routes.

---

## 1. Engine contract (must be used by every module)

```ts
// MOD-access: the only implementation of WF-ACCESS-001 (C5).
check(user, action: Action, resource: { type, id } | LoadedResource): Promise<Decision>
scopeFilter(user, action: Action, resourceType): Promise<SqlPredicate>   // applied in WHERE before COUNT/ORDER/LIMIT
type Decision =
  | { outcome: 'full' | 'owner' }
  | { outcome: 'context', row: 1|2|3|4|5|6, fields: string[], actions: Action[] }
  | { outcome: 'existence_only' }                       // duplicate preview only
  | { outcome: 'denied', code: 'PERMISSION_DENIED' | 'HIDDEN_BY_POLICY' | 'NOT_FOUND' | 'STATE_FORBIDS' }
```

Rules:
1. **Every route declares one action** (`route(…, { action: 'business.read' })`). At startup the app fails if a mounted `/api` route has no declared action. The only exceptions are the public auth routes listed in §3.1 and the health probes.
2. **Load the resource, call `check`, then act**, all in the same transaction as the write. Never authorize on IDs from the request body without loading them.
3. Lists, search, queues, calendars, dashboards and exports use `scopeFilter`. **Count after filtering.**
4. `check` and `scopeFilter` are generated from one rule table. VT-7 worked evaluations run as contract tests against both forms.
5. The access-facts view (ADR-017 A-2) is read-only and owned by MOD-access. It is the only cross-module read.
6. Denials: 404 `NOT_FOUND` (does not exist, or wrong type), 403 `PERMISSION_DENIED` (steps 4–6), 403 `HIDDEN_BY_POLICY` (steps 7–8), 409/422 `STATE_FORBIDS` (step 9). **No field values in any denial body.** Denials of business resources are logged at info level with ids only.
7. The actor always comes from the session. Server-owned fields are never taken from the body (threat model ID-2).

### 1.1 Evaluation order (VT-1, with R-01)

| Step | Check | Fails with |
|---|---|---|
| 1 | Account active (re-read on every request) | 401, session ended |
| 2 | Session valid (idle and absolute expiry) | 401 `SESSION_EXPIRED` |
| 2b | Owner with 2FA pending: admin always denied. Everything else depends on R-11 (DEMO, default R11-a = deny all except auth routes) | 403 `OWNER_2FA_REQUIRED` |
| 3 | Resolve role | — |
| 4 | Action allowed for the role (tables §3) | 403 `PERMISSION_DENIED` |
| — | **Owner skips 5–8** (R-01) | — |
| 5 | Base scope for the role (§2) | 403 `PERMISSION_DENIED` |
| 6 | Required relation (assignment, creator, assigned Developer, own record) | 403 `PERMISSION_DENIED` |
| 7 | 15-day window (§2.1) passes → full | go to 8 |
| 8 | Active-work exception row (§2.2) → context-limited | 403 `HIDDEN_BY_POLICY` |
| 9 | Resource state allows the action (Rejected = do-not-call, archived, terminal states). **Applies to the Owner too** | `STATE_FORBIDS` |
| 10 | Outcome: full / context / owner. Owner reads of a hidden business's **detail** are audited `business_access.owner_viewed_hidden` (OI-05, DEMO, setting on) | — |

## 2. Row-level rules

### 2.1 Visibility timer (step 7)

| Rule | Value | Flag |
|---|---|---|
| Timer basis | Business `created_at`. No reset (DEC-001 Alt A) | **DEMO** `visibility.timerBasis = creation\|inactivity`. Alt B uses `max(created_at, last_touchpoint_at)` with touchpoints `call_attempt.logged` and `follow_up.scheduled` only |
| Day-16 boundary | Hidden from 00:00 company time on `created_date + 15` (OI-04) | **DEMO** (timezone NEEDS VALUE) |
| Applies to | Every non-Owner role, per user, per resource. There is no global flag (C2) | Confirmed |
| Duplicate matching | Ignores visibility. The whole DB, including archived records (C3, OI-26) | Confirmed / DEMO (archived) |

### 2.2 Active-work exceptions (step 8). DEC-002 Alt B on all rows (**DEMO**)

| Row | Fact that must hold now | Who | Surface | Allowed (Ctx) | Ends |
|---|---|---|---|---|---|
| 1 | Deal record in stage Accepted opportunity | Assigned CC agent; assigned DV (DEC-005 Alt 1) | Hand-off / deal record | CC: calling actions, hand-off updates, assign DV, meetings, flag correction. DV: read contact and notes, meetings, discovery, signature and payment facts, flag correction. **No master-data edit** | Deal closes (→ row 2) or becomes Not proceeding |
| 2 | Business has a closed deal | All DVs and O | Closed-deal list only | Read the relevant phones and notes; commercial updates per DEC-006; flag correction. No directory search | Project Completed + 15 days |
| 3 | Active project | Assigned DVs | Project board | Project and task actions; flag correction | Project Completed |
| 4 | Completed project | Assigned DVs | Project board | Read-only history; flag correction | 15 days after delivery |
| 5 | Scheduled callback follow-up | Responsible CC agent | Calling workspace, calendar | Open in the workspace, log an attempt, complete, reschedule or cancel the follow-up, flag correction | Callback time + 48 h |
| 6 | Open data-correction request | DE | Correction queue | Read the business; apply the request (the **only** Ctx master-data edit); close or reject | Request terminal |

Context-limited items never appear in general business search (Table RT rule 4).

### 2.3 Base scope and relation (steps 5–6)

| Role | Base scope | Relation | Flag |
|---|---|---|---|
| O | Everything | None | Confirmed (C1, R-01) |
| DE | Any business (DE-1), limited by §2.1–2.2 | None | **DEMO** `dataEntry.scope = DE-1\|DE-2` (DE-2 = own-created plus correction queue) |
| CC | Businesses **currently assigned** to the agent; their deal records before closure (row 1) | Current assignee. **B7: checked on every calling action, the assignee included.** Assigned but hidden → Owner sees "assigned but inaccessible"; no auto-reassignment | Confirmed / Proposed (B7) |
| DV | Closed-deal list (company-wide, row 2); projects and tasks where assigned; deal records before closure **only if assigned** | Assigned Developer | **DEMO** `deals.developerPreClosure = assigned\|closedOnly` (DEC-005 Alt 1) |

### 2.4 Related resources (Table RT inheritance)

| Resource | Inherits from | Owned-item redaction (shown as a redacted row to its owner when the business is hidden) |
|---|---|---|
| Edit history entry | Business (fields limited by the outcome, OI-11) | — |
| Call attempt | Business (+ rows 1, 5) | Attempting agent |
| Follow-up | Business (+ row 5) | Responsible agent |
| Contact reservation | Business. No exception row | — (holder name visible only to users with business access) |
| Deal record | Business (+ rows 1, 2; DEC-005) | — |
| Meeting | Deal record. Attendance alone grants nothing (OI-29) | Attendee (time kept) |
| Project | Closed deal (+ rows 3, 4) | — |
| Task | Project | Task owner |
| Data-correction request | Business (+ row 6) | Requester (status visible, business redacted, OI-09) |
| Notification / reminder | Referenced resource, **evaluated at send time** (C6) | Suppressed, not redacted. The Owner sees the suppression (D6) |
| Export row | Its resource type, per row | — |
| Duplicate preview | Special: existence only for an unreadable match (DEC-003 (i), **DEMO**) | — |

---

## 3. Role × resource × action

### 3.1 Identity and session (MOD-identity)

| Action | O | DE | CC | DV | Notes |
|---|---|---|---|---|---|
| `auth.login`, `auth.password_reset.request`, `auth.password_reset.complete` | public | public | public | public | Rate-limited. Generic responses |
| `auth.2fa.verify`, `auth.2fa.enroll` | Own (pending) | N | N | N | Enrollment needs an operator enrollment token (threat model AU-8). Owner 2FA is Confirmed. TOTP method is **DEMO** |
| `auth.2fa.recovery.use` | Own (pending) | N | N | N | **DEMO** (OQ-12: 10 codes) |
| `auth.me`, `auth.logout`, `auth.2fa.status` | Own | Own | Own | Own | Allowed while pending |
| `auth.password.change` | Own | Own | Own | Own | Needs the current password. Ends other sessions. Route guard `requireAction('auth.password.change')` and code-matrix row added 2026-10-26 (V-01, BE-LEAD). A pending Owner is refused by `authenticate` (R11-a) |
| `auth.password_reset.assist` | Y | N | N | N | The Owner never sees a password (SEQ-02) |
| `session.revoke` (others) | Y | N | N | N | Audited `session.revoked` |
| `auth.session.revoke_all` | Own | Own | Own | Own | Ends every own session (CR1-03 "Sign out of all devices"). Added BL-06 (BE1-R4), as declared |
| `employee.issue_2fa_enrollment_token` | Y | N | N | N | AU-8: one-time enrollment token for another Owner. Added BL-06, as declared |
| `employee.manage_own_recovery_codes` | Own | N | N | N | AU-9: regenerate own recovery codes, step-up TOTP. Added BL-06, as declared |

### 3.2 Employees and profile (MOD-employees)

| Action | O | DE | CC | DV | Notes |
|---|---|---|---|---|---|
| `employee.list`, `employee.read` | Y | N | N | N | Directory is Owner only (Confirmed) |
| `employee.create`, `employee.update` (name, email, role, department) | Y | N | N | N | Role change ends sessions (`account.role_changed`) |
| `employee.deactivate` / `employee.activate` | Y (not self; not the last active Owner) | N | N | N | Version check. Reactivation does not restore assignments (OQ-14, **DEMO**) |
| `employee.read_open_items` | Y | N | N | N | OWN-003 open-work impact (BE4-R5 ops). Added BL-06 (BE1-R4), as declared |
| `role.list`, `role.read`, `role.create`, `role.update`, `role.delete`, `permission.list` | Y | N | N | N | Roles & Permissions Studio (SCR-OWN-012, migration 014). Admin + 2FA. Never grantable (§3.11). Added 2026-10-28 (F-ACCESS, A-19) |
| `profile.read` | Own | Own | Own | Own | |
| `profile.update` (photo, phone) | Own | Own | Own | Own | **DEMO** (OQ-13). Photo upload rules: threat model §5.8. Guards `PATCH /api/employees/me` (was `profile.read`; fixed 2026-10-26, BE-LEAD) |

### 3.3 Attendance (MOD-attendance)

| Action | O | DE | CC | DV | Notes |
|---|---|---|---|---|---|
| `attendance.check_in`, `attendance.check_out` | Own | Own | Own | Own | Office check applies to all, no Owner exemption (F-04). Mode IP allowlist (**DEMO** DEC-009). Server time only. Owner under R-11 (**DEMO**) |
| `attendance.read` | All | Own | Own | Own | |
| `attendance.correction.request` | Own | Own | Own | Own | **DEMO** flag `attendance.employeeRequests` (DEC-011 Alt B) |
| `attendance.correction.review` | Y | N | N | N | Reason required to reject. Originals kept |
| `attendance.adjust` (direct), `attendance.retroactive_create` | Y | N | N | N | Reason required. Audited (N-2, **DEMO**) |
| `attendance.remote_exception.grant` | Y | N | N | N | **DEMO** (DEC-010) |
| `attendance.failed_checkout.review` | Y | N | N | N | **DEMO** flag `attendance.failedCheckout` (DEC-026 Alt B) |
| `attendance.overview.read` | Y | N | N | N | OWN-004 monitoring. Added BL-06 (BE1-R4), as declared |
| `attendance.remote_exception.request` | Own | Own | Own | Own | **DEMO** DEC-010 flag `attendance.remoteSelfRequest`. Added BL-06 (BE1-R4), as declared |
| `attendance.break.start`, `attendance.break.end` | Own | Own | Own | Own | Breaks inside the open session (migration 021). Added 2026-10-28 (F-ACCESS, A-19), as declared |
| `attendance.break.read` | All | Own | Own | Own | Added 2026-10-28 (F-ACCESS, A-19), as declared |

### 3.4 Business directory (MOD-business)

| Action | O | DE | CC | DV | Notes |
|---|---|---|---|---|---|
| `business.list`, `business.search` | Y | Y (scope §2.3) | Asg | Ctx (row 2 list only) | `scopeFilter`. Hidden rows omitted and not counted |
| `business.read` | Y | Y (§2.1–2.2) | Asg (+ rows 1, 5) | Ctx (rows 1–4) | CC sees contact info and socials. DV sees the relevant phones and notes only |
| `business.create` | Y | Y | N | N | Duplicate block is mandatory |
| `business.duplicate_check` | Y (full match) | Y (existence only if hidden) | N | N | Rate-limited. **DEMO** DEC-003 (i), DEC-013 (name + branch blocks, similarity warns) |
| `business.update` (master data) | Y | Y (full), Ctx row 6 (apply request only) | N | N | Version check. Data Entry cannot change commercial status (Confirmed) |
| `business.archive`, `business.restore` | Y | N | N | N | Archive only, no delete (**DEMO** C-01) |
| `business.delete` | N | N | N | N | No hard delete in v1 (C-01) |
| `business.history.read` | Y | If the business check passes | If passes | If passes | Fields limited by the outcome (OI-11, **DEMO**) |
| `business.read_hidden` (detail) | Y, audited | N | N | N | OI-05 (**DEMO**, setting) |

### 3.5 Categories

| Action | O | DE | CC | DV | Notes |
|---|---|---|---|---|---|
| `category.list` | Y | Y | Y | Y | Active categories only for non-Owners |
| `category.create`, `category.rename`, `category.deactivate` | Y | N | N | N | **DEMO** flag CA-A/CA-B (DEC-015). Deactivate only (CR-1) |

### 3.6 Data-correction requests

| Action | O | DE | CC | DV | Notes |
|---|---|---|---|---|---|
| `correction.submit` | Y | N | Y (business check passes) | Y (business check passes) | Data Entry edits directly (OI-24, **DEMO**) |
| `correction.read` | Y | Y (queue, row 6) | Own | Own | Requester sees status with the business redacted when hidden |
| `correction.withdraw` | Own | — | Own | Own | Only before In review |
| `correction.review`, `correction.apply`, `correction.reject`, `correction.close` | Y | Y | N | N | Rejection reason required (OI-19, **DEMO**) |

### 3.7 Calling (MOD-assignment, MOD-calls)

| Action | O | DE | CC | DV | Notes |
|---|---|---|---|---|---|
| `calling.queue.read` | All agents | N | Own queue (Asg) | N | |
| `calling.assign`, `calling.reassign`, `calling.unassign` | Y | N | N | N | Only through WF-CALL-001 (B8). Never moves an active reservation (**DEMO** B3-Q01, B3-Q15) |
| `calling.autofill` | Y | N | N | N | Manual trigger. 40 per agent (**DEMO** DEC-021) |
| `reservation.acquire`, `reservation.renew`, `reservation.release` | Y | N | Asg (B7) | N | Lease token validated. Lease 5 min, heartbeat 60 s, idle 15 min, max 60 min (**DEMO** DEC-004). Not allowed on Rejected |
| `reservation.override` | Y (reason required) | N | N | N | Holder is notified (**DEMO** B3-Q14) |
| `call.log_attempt`, `call.set_outcome` | Y (holder) | N | Asg + reservation holder | N | Attempt time = server now (**DEMO** B3-Q07). Save after the lease is lost keeps the attempt only (**DEMO** FLAG B3-Q05) |
| Outcome "keep reservation" button on Accepted | Y | — | Y | — | **APPROVED (USER)**: Accepted keeps the reservation option. Hidden only for Rejected |
| `business.reopen_rejected`, `business.requeue` | Y (reason required) | N | N | N | **DEMO** DEC-016, B3-Q12 |
| `follow_up.create`, `.reschedule`, `.complete`, `.cancel` | Y | N | Asg, or responsible (row 5) | N | At most one open follow-up per business (**DEMO** B3-Q04) |
| `follow_up.read` (calendar) | All | N | Own responsibility | N | |
| `call_attempt.list_do_not_call` | Y | N | Asg (`scopeFilter`) | N | CC-008. Added BL-06 (BE3-R5), as declared |
| `call_attempt.list_opportunities` | Y | N | Asg (`scopeFilter`) | N | CC-007. Added BL-06 (BE3-R5), as declared |

### 3.8 Deals, meetings, projects, tasks (MOD-deals, MOD-projects)

| Action | O | DE | CC | DV | Notes |
|---|---|---|---|---|---|
| `deal.read` (pre-closure) | Y | N | Accepting/assigned agent (row 1) | Assigned DV only | **DEMO** DEC-005 Alt 1 |
| `deal.list_closed` | Y | N | N | Y (company-wide, row 2) | Confirmed |
| `deal.assign_developer` | Y | N | Y (row 1) | N | Confirmed (E2) |
| `deal.update_stage` (discovery and transitions) | Y | N | N | Assigned DV | Data Entry never. CC no (**DEMO** OQ-03) |
| `deal.record_signature`, `deal.record_payment` | Y | N | N | Assigned DV | **DEMO** (DEC-005 Alt 1 resolves R-12; OQ-03) |
| `deal.request_closure_verification` | — | N | N | Assigned DV | **DEMO** flag `deals.closureMode = ownerVerify` (DEC-006 Alt B) |
| `deal.verify_closure`, `deal.finalize`, `deal.reject_closure` | Y | N | N | N (under `direct`: Assigned DV) | **DEMO** DEC-006 |
| `deal.mark_not_proceeding` | Y | N | N | Assigned DV | Reason required |
| `deal.reopen_not_proceeding` | Y (reason required) | N | N | N | Closed deals never reopen (**DEMO** OQ-15) |
| `meeting.create`, `.reschedule`, `.mark_missed`, `.complete` | Y | N | Row 1 | Assigned DV | **DEMO** (DEC-005, R-13 "Missed") |
| `meeting.read` | Y | N | Through the deal check | Through the deal check | Attendance alone grants nothing (OI-29) |
| `project.read`, `project.board.read` | Y | N | N | Assigned DV (rows 3, 4) | Confirmed (Developers and Owner) |
| `project.update_status` | Y | N | N | Assigned DV | Statuses per DEC-019 (**DEMO**). Completed only from Delivered |
| `project.assign_developers` | Y | N | N | N | **DEMO** OQ-08 |
| `project.reopen_completed` | Y (reason required) | N | N | N | **DEMO** OQ-15 |
| `project.provision_retry` | Y | N | N | N | F3 |
| `task.create`, `task.update`, `task.complete` | Y | N | N | Assigned DV (any task in the project) | **DEMO** OQ-06 |

### 3.9 Targets, settings, notifications

| Action | O | DE | CC | DV | Notes |
|---|---|---|---|---|---|
| `target.set` | Y | N | N | N | **DEMO** DEC-020, DEC-025 |
| `target.read` | All | Own | Own | Own | |
| `work_item.read` | All | Own | Own | Own | Own = items assigned to the user. Added 2026-10-26 (R2-03, BE-LEAD); replaces the `target.read` guard on `GET /api/work-items` |
| `work_item.create` | Y | N | N | N | Owner assigns work. Audited `work_item.created` (placeholder name). Replaces `target.set` on `POST /api/work-items` (R2-03) |
| `work_item.update` | Y | Own | Own | Own | Assignee or Owner only; any other item is 404 with no data (IDOR fix R2-03). Audited `work_item.updated` (placeholder name) in the same transaction |
| `settings.read` | Y | N | N | N | Non-Owners receive only the derived values they need (for example "office check active") |
| `settings.read_public` | Y | Y | Y | Y | Derived company values only (R3). A pending Owner is denied under R11-a. Added BL-06 (BE1-R4), as declared |
| `settings.update` (schedule, office IPs, policy settings, reservation timings) | Y | N | N | N | Audited `settings.updated` with before/after. NEEDS VALUE items stay "Not configured" |
| `notification.list`, `notification.mark_read` | Own | Own | Own | Own | Access re-checked when the list is read (AR-14) |
| `reminder.monitor.read`, `reminder.send_again` | Y | N | N | N | **DEMO** AR-13 |

### 3.10 Reports, export, audit

| Action | O | DE | CC | DV | Notes |
|---|---|---|---|---|---|
| `dashboard.owner.read`, `report.read` | Y | N | N | N | Confirmed |
| `dashboard.self.read` (My Day) | Own | Own | Own | Own | Only the user's own metrics and in-scope items |
| `report.export` | Y + step-up TOTP ≤ 10 min | N | N | N | Confirmed Owner only. Row and time caps. Per-row `check` stays in place. Audit `report.exported` / `export_denied` / `export_failed`. Implemented 2026-10-26 (R2-02, BE-LEAD): `POST /api/reports/export` only (GET → 405); step-up via `totpCode` stamped on the session for 10 min; 20 exports / 10 min per Owner; 1000-row cap (`X-Export-Truncated`); 15 s statement timeout. Caps are Security defaults, not approved |
| `audit.read` | Y | N | N | N | Confirmed. Viewing is not audited (**DEMO** OQ-18) |
| `audit.export` | N | N | N | N | Not in v1 (**DEMO** OQ-18) |
| `audit.update`, `audit.delete` | N | N | N | N | Impossible: no route, a DB trigger and grants |

### 3.11 Custom roles (migration 014; user decision 2026-10-28: intentional, kept)

The Owner may create roles beyond the four above (e.g. `human_resources`) in the Roles & Permissions Studio. They are **additive** and never change a row of §3.1–§3.10. Code: `modules/access/dynamicService.ts`, `shared/access.ts`, `rules.ts` `default` branch.

| Rule | Contract |
|---|---|
| Default | A custom role is allowed **nothing**. `requireAction` answers `FORBIDDEN_ROLE`, the engine `(FALSE AND FALSE AND FALSE)`, `scopeFilter` matches no row. An unknown or mistyped role id behaves the same |
| Grants | A custom role holds exactly its `role_permissions` rows. Each row is validated on write and on load: the action must be a row of this document; **nobody rows** (`business.delete`, `audit.*`) are never grantable; **admin / Owner-only rows** are grantable only where this section lists them. Anything else → 400 `VALIDATION_ERROR`, nothing written |
| Grantable admin rows | `employee.list`, `employee.read`, `employee.read_open_items`, `attendance.correction.review`, `attendance.adjust`, `attendance.retroactive_create`, `attendance.remote_exception.grant`, `attendance.failed_checkout.review`, `attendance.overview.read` (code: `grantableRow` in `matrix.ts`). None can create, update, deactivate or re-role an account, change settings, read audit, export, archive, or touch roles |
| Second factor | Granting needs an active (2FA-complete) Owner session (`role.create` / `role.update` are admin rows). **Executing** a grantable admin row needs the holder's own verified second factor (`registerSecondFactorVerifier`, `shared/access.ts`); until MOD-identity registers that check the holder gets 403 `OWNER_2FA_REQUIRED` (fail closed). Non-admin grants need no second factor |
| `data_scope` | Enforced by the engine. Business-related types (R-06): `global` = any business; `assigned_only` = current assignee or assigned Developer; `self` and `department` = own-created. The 15-day window (§2.1) applies; the DEC-002 rows (§2.2) never do (they are role-specific), so no context-limited row ever reaches a custom role. Own-record types: `global` = every record; `department` = own plus records of employees in the holder's department (NULL department never matches); `self` / `assigned_only` = own. Role-level types (`category`) follow the grant; Owner-only types (`audit_event`, `setting`, `report`) stay closed |
| System roles | `owner`, `data_entry`, `call_center`, `developer` are defined by this document only. A `role_permissions` row for them is ignored on load and refused on write (400); their Studio detail shows the matrix |
| Cache | Loaded from the database at startup (`init` → `DynamicRoleCache.attach`), reloaded only **after** a role command has committed (a rolled-back command leaves no grant), refreshed every 30 s in other API/worker processes. Permission updates end every holder session (`sessions.state = ended`) |
| Audit | `role.created`, `role.updated`, `role.permissions_updated` (before/after grant lists, sessions revoked), `role.deleted` |

---

## 4. Required tests (per module, before DONE)

1. **Matrix tests:** for each action the module adds, one allowed and one denied request per role (4 roles × action). Generated from a table in the test file that mirrors this document.
2. **IDOR tests:** user A requests user B's resource by id for every `:id` route. Expect 403 or 404 with **no field values** in the body.
3. **Hidden-record tests** (any route touching a business or a Table RT resource): a record created 16 days ago (clock injected) is (a) absent from the list, (b) not counted in totals, (c) not found by search, (d) direct GET gives 403 `HIDDEN_BY_POLICY` with no data, (e) duplicate create gives existence only with no id, (f) each exception row in §2.2 grants exactly its Ctx fields.
4. **VT-7 contract test:** `check` and `scopeFilter` agree on every worked evaluation.
5. **Pending-2FA tests:** an Owner in `pending_2fa_*` gets 403 on every new route (R11-a), and on admin routes under R11-b.
6. **Mass-assignment tests:** sending `role`, `createdBy`, `assigneeId`, `version` or an actor id in the body has no effect or returns 400.
7. **Flag tests:** every DEMO flag marked FLAG has a test for each branch.
