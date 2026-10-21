# Phase 3 — Architecture B: Data, Authorization and Critical Sequences

- **Author:** Architecture Agent B (database architect + application-security architect).
- **Status:** **Proposed — Phase 3, not approved.** Nothing here is reviewed or approved. No production SQL and no code: every constraint below is a conceptual description.
- **Baseline:** Phase 2 approved baseline (SB-3, 2026-10-20), brief P34-1. Phase 2 transition tables are authoritative where the Board 02 diagrams omit a transition.
- **Board:** Architecture board `YKQi8IAz6sOGoLqwolHKPk`, sections 04 (`1:14`), 05 (`1:17`), 06 (`1:20`). Node IDs are in §13. **Board work is incomplete:** the Figma MCP plan quota ran out after SEQ-11; SEQ-12..SEQ-15 exist only in this document (§9 and Appendix A). See §12.
- **Pending policies are never decided here.** DEC-017 (one vs many deals per business) and C-01 (deletion vs archiving) are modelled as alternatives. Other open items (DEC-001, -002, -003, -004, -005, -006, -011, -013, -014, -016, -018, -019, -020, -021, -023, -026, R-10, R-11, R-12, F2, D4, B3-Q05 and the rest) stay visibly pending.
- **Module names** follow Architecture Agent A's catalogue (ruling AR-01, brief §8): MOD-identity, MOD-employees, MOD-access, MOD-admin (hosts audit), MOD-attendance, MOD-work, MOD-business, MOD-duplicates, MOD-corrections, MOD-assignment, MOD-reservation, MOD-calls, MOD-deals, MOD-meetings, MOD-projects, MOD-notifications, MOD-reports, plus A's platform jobs module and platform request layer (AR-02). Access operations are `check` / `scopeFilter`. Event and job names follow A's single catalogue (AR-09).
- **P34-2 alignment (2026-10-20):** this revision applies orchestrator rulings AR-01..AR-06 and AR-09 (brief §8) after review RA. Board labels still show the old names until the Figma quota resets (§14).

## Contents
1. Design stance and assumptions
2. Conceptual ERD (five domain diagrams)
3. Entity responsibility catalogue — consolidation and separation
4. Relationships: cardinality, ownership, required/optional, deletion, policy dependencies
5. Integrity constraints
6. Authorization decision flow
7. Visibility integration and leakage controls
8. Transaction / concurrency matrix
9. Critical sequences SEQ-01..SEQ-15
10. Retention and deletion proposals
11. Decisions needing the user; residual issues; brief change requests
12. Verification
13. Board node IDs
14. Board updates pending quota reset (+ Appendix A Mermaid)

---

## 1. Design stance and assumptions

| # | Stance | Why |
|---|---|---|
| S-1 | **Express domain modules own all business logic, authorization and writes.** Next.js renders UI and calls the Express API; it holds no business rules and no direct DB access. | Brief §3 API layering; one enforcement point for WF-ACCESS-001. The shared-origin and session-transport decision belongs to Architecture Agent A (section 02). |
| S-2 | **One PostgreSQL database, one schema per module is optional; each table has exactly one owning module.** Other modules read through the owner's public operations; they never write another module's table. **One documented exception (AR-06):** MOD-access owns a read-only "access facts" view (created by migration) that reads across module tables. | Brief §6 "no cross-module table writes"; ADR-006 amendment by A. |
| S-3 | **A single unit of work may span modules** when the Phase 2 spec demands "same save" (e.g. Accepted → deal record, E5). The calling module calls the deals module's public operation inside the same database transaction; the deals module performs its own insert. | Keeps atomicity without cross-module writes. |
| S-4 | **The database is the final arbiter of uniqueness races** (duplicate phone, one open session, one active reservation, one current assignment). Application pre-checks exist for good messages only. | DR-8 requires concurrency safety; app-only checks race. |
| S-5 | **Optimistic locking** (a version number per mutable aggregate) for user edits; **short pessimistic row locks** only inside a single transaction for counters and guards (calling state, reservation, Owner-count guard). | Six users, low contention; avoids long locks across user think time. |
| S-6 | **Audit rows are written in the same transaction** as the change they describe, append-only. | G3; an unaudited change cannot commit. |
| S-7 | **After-commit work goes through the transactional outbox** (A's ADR-007): the business transaction writes an outbox event; A's platform jobs module relays it (J-03) and runs the consumers and scheduled jobs (J-01..J-11). Both tables are owned by that platform module (AR-02). Data shape only is shown here. | Brief §3: no Redis/broker without need. |
| S-8 | **Access is computed, never stored.** No `visible` column anywhere (C2). MOD-access reads facts (assignment, creator, timer basis, deal stage and Developer, project status, follow-ups, open corrections, archive state) through the read-only "access facts" view **that MOD-access owns** (AR-06). That view is the source for `scopeFilter`; per-resource `check` uses the same rules. | SM-VISIBILITY-001 §7.1. |
| S-9 | **IDs are random UUIDs** for every externally visible resource. | Prevents direct-URL enumeration (WF-ACCESS-001 Part 1). |
| S-10 | **Company time.** Timestamps are stored as absolute instants; "today", "due", "late" are computed in the configured company timezone (AttendanceSettingsVersion). | A2, Batch 3 §0 "Time". |

---

## 2. Conceptual ERD

The ERD is split into five domain diagrams so each stays readable (≤ 11 entities, 5–9 attributes each). `Employee` and `Business` reappear as reference stubs in the diagrams that need them; they are defined once (diagrams ERD-1 and ERD-2). Attribute lists are conceptual: they show keys, state columns, version columns and the policy-dependent columns. Comments in quotes on the board name the pending decision.

Notation on the board: solid line = identifying / required parent; dotted line = optional or non-identifying; header line on each diagram gives Status "Proposed — Phase 3, not approved" and related WF/SM/DEC IDs.

### ERD-1 Identity, sessions, attendance and targets
Entities: Employee, Credential, TwoFactorFactor, Session, SecurityToken, AttendanceSession, AttendanceCorrection, AttendanceSettingsVersion, Target, WorkItem.

How to read it:
- **Employee** is the anchor of the whole system. `role` is one required column with four allowed values, which makes "one role per employee" structural (IC-01). `accountStatus` is SM-ACCOUNT-001 (Active / Deactivated). "Credentials not yet set" is derived from the absence of a Credential row.
- **Session** carries SM-SESSION-001 (pending 2FA enrolment, pending 2FA verification, active, ended + `endReason`). Account state and session state are two different tables (brief §3). A deactivation ends sessions; ending a session never changes the account.
- **SecurityToken** holds only a hash of reset or credential-setup tokens; the raw token exists only in the email link.
- **AttendanceSession** carries SM-ATTENDANCE-001 state (Open / Closed, plus *Closed provisionally* or *Pending review* only if DEC-026 Alt B / Alt C is chosen). It stores the facts (times, verification results, remote flag under DEC-010, summary under DEC-012) and the settings version that applied. **Punctuality, duration-vs-9 h, "missing check-in/checkout" are derived** at read time — attendance state is separate from punctuality classification.
- **AttendanceCorrection** sits beside the session and never overwrites it (Confirmed). Under DEC-011 Alt A the row is created already applied; under Alt B it carries the SM-CORRECTION-001 request state.
- **Target** and **WorkItem** (WF-WORK-001). WorkItem is a pointer (`refType`, `refId`) to the owning record plus due date and priority; it never copies task status or assignment state. Call Center work items are realised as CallingAssignment rows through WF-CALL-001 (B8); a WorkItem may reference that business for target display only.

### ERD-2 Business master data and corrections
Entities: Business, BusinessPhone, SocialAccount, Category, BusinessEditHistory, DataCorrectionRequest (+ Employee stub).
- **Business** holds master data only (ART-01 §6.1 fields), creator, timestamps and `version`. `createdAt` is the DEC-001 Alt A timer origin. `recordStatus` is drawn as **"PENDING C-01"**: it exists only if archiving is chosen.
- **BusinessPhone.normalizedNumber** is globally unique across all stored businesses, including hidden ones — this is the database-level duplicate block (IC-06, IC-09).
- **Business.normalizedName** is stored for matching; whether it is unique is **DEC-013** (IC-07, three alternatives).
- **Match keys are master data owned by MOD-business (AR-02):** `normalizedNumber`, `normalizedName` and their unique indexes are written in the business save transaction. **MOD-duplicates** is a read-only matching service: it owns the matching and normalization rules (DEC-013, DR-3/DR-4) and the preview shaping (DEC-003), and writes nothing.
- **SocialAccount**: at least one per business (IC-10). Follower count and last-post date are nullable with the meaning "Unknown", never 0 (DEC-014 mechanism pending; DEC-023 history pending).
- **Category** is referenced by id; deactivate vs delete-if-unused is the open category-removal question (no DEC ID).
- **BusinessEditHistory** is the user-visible edit history (SB-2 §11), filtered by the business Access check; distinct from the Owner-only AuditEvent.
- **DataCorrectionRequest** carries SM-DATAFIX-001 with a version for "first start-review wins".

### ERD-3 Calling, reservations and follow-ups
Entities: BusinessCallingState, CallingAssignment, ContactReservation, CallAttempt, FollowUp, FollowUpChange, OutcomeReopening (+ Business and Employee stubs).
- **BusinessCallingState** (1:1 with Business, owned by MOD-calls) holds the current calling outcome (`pending`, `on_hold`, `needs_another_call`, `rejected`, `accepted`), the D2 "callback to be scheduled" marker, `lastTouchpointAt` (DEC-001 Alt B input: latest `call_attempt.logged` / `follow_up.scheduled`, R-07), and a version. The outcome is stored as a value; its change rules stay the WF-CALL-003 table until R-10 is decided.
- **CallingAssignment** is append/close-only history. The open row (no `endedAt`) is the current assignment; Unassigned = no open row. `NEW_LEAD` is not stored (C-02).
- **ContactReservation** is one row per acquire with state Active / Released / Expired / Overridden and a random `leaseToken`. At most one Active row per business (IC-15).
- **CallAttempt** is append-only, with an optional link to the reservation (optional only to keep B3-Q05 Alt B "accept attempt after reservation loss" possible) and an idempotency key.
- **FollowUp** (SM-FOLLOWUP-001) links to the attempt that created it and the attempt that completed it. **FollowUpChange** is its reschedule/responsibility history.
- **OutcomeReopening** records each reopening of a Rejected business (who, when, why, previous and new outcome; new outcome per DEC-016).

### ERD-4 Deals, meetings, projects and tasks
Entities: Deal, DealDeveloperAssignment, ClosureReview, Meeting, MeetingAttendee, MeetingChange, Project, ProjectDeveloperAssignment, ProjectChange, Task (+ Business and CallAttempt stubs).
- **Deal** is the single deal record across commercial stages (SM-COMMERCIAL-001: accepted opportunity, signed, paid, signed and paid, closed, not proceeding). `acceptedAttemptId` is unique (the E5 save creates exactly one). `assignedDeveloperId` empty = "developer not yet assigned" (E3, derived). No money fields while DEC-018 is open.
- **Business → Deal cardinality is PENDING DEC-017**: drawn as one-to-many with the label "DEC-017: one open or many". Alt single = at most one open deal per business (partial unique), Alt many = no constraint (IC-20).
- **ClosureReview** exists only under DEC-006 Alt B.
- **Meeting** (SM-MEETING-001) with attendees and reschedule history (rescheduled is an event, R-13).
- **Project** has a unique `dealId` (at most one project per deal, Proposed); created by provisioning (F2 pending: automatic vs manual). **ProjectChange** stores status and schedule history. **ProjectDeveloperAssignment** is N:M so OQ-07 (one vs several Developers) can go either way.
- **Task** (SM-TASK-001) with `isMilestone` flag (OQ-09 pending). There is one task table; work lists reference it.

### ERD-5 Cross-cutting: notifications, jobs, audit, exports, idempotency
Entities: Reminder, NotificationDelivery, BackgroundJob, Outbox, AuditEvent, ExportRecord, IdempotencyRecord (+ Employee stub). **Outbox is added here in the text (AR-02); the board ERD-5 still lacks it until the quota resets (§14).**
- **Reminder** is SM-REMINDER-001: source type/id/version, recipient, **business event time and trigger time stored separately**, state, attempts, last error.
- **NotificationDelivery** records non-reminder alerts (R-08) and could double as the in-app list if in-app presentation is adopted (unresolved).
- **BackgroundJob** rows (kind, run-at, attempts, lease, dedupe key = job type + slot). Owned by A's **platform jobs module** (AR-02); scheduling, retry and "dead" job visibility per A §4 (J-01..J-11).
- **Outbox** rows (event id, event name from A's catalogue, aggregate type and id, payload with ids only, created at, relayed at, attempts). Written **inside** the business transaction by the module that owns the change; relayed after commit by J-03 to consumers (MOD-notifications, MOD-projects, MOD-identity, MOD-assignment). Owned by the platform jobs module (AR-02, ADR-007). Consumers are idempotent by event id.
- **AuditEvent** is append-only with actor (null = System), role, session, request id, entity reference, before/after (never secrets). Owned by **MOD-admin** (AR-01).
- **ExportRecord** is **audit metadata only** (requester, format, filters, row count, time, result) — **no file and no file reference**: exports are generated synchronously, streamed and never stored (A's ADR-010, AR-05). Owned by **MOD-reports**. If the `report.exported` audit row alone proves enough, ExportRecord can be dropped.
- **IdempotencyRecord** stores (actor, operation, key) → result for safe retries. Owned by A's **platform request layer** (AR-02).

---

## 3. Entity responsibility catalogue

The full catalogue (37 entity rows + header) is the FigJam table in section 04 (its "Owning module" column still shows the pre-AR-01 names until the quota resets). **Ownership after AR-01/AR-02 — exactly one owner per entity:**

| Owner | Entities |
|---|---|
| MOD-employees | Employee |
| MOD-identity | Credential, TwoFactorFactor, Session, SecurityToken, failed-login / rate-limit counters (Session.factorFailCount is one of them) |
| MOD-attendance | AttendanceSession, AttendanceCorrection, **AttendanceSettingsVersion incl. company timezone** (MOD-admin only provides the settings screen and calls MOD-attendance) |
| MOD-work | Target, WorkItem |
| MOD-business | Business, BusinessPhone, SocialAccount, Category, BusinessEditHistory, **match keys** (normalized phone/name and their unique indexes) |
| MOD-duplicates | none (read-only matching service; owns rules, not tables) |
| MOD-corrections | DataCorrectionRequest |
| MOD-calls | BusinessCallingState, CallAttempt, FollowUp, FollowUpChange, OutcomeReopening |
| MOD-assignment | CallingAssignment |
| MOD-reservation | ContactReservation |
| MOD-deals | Deal, DealDeveloperAssignment, ClosureReview |
| MOD-meetings | Meeting, MeetingAttendee, MeetingChange |
| MOD-projects | Project, ProjectDeveloperAssignment, ProjectChange, Task |
| MOD-notifications | Reminder, NotificationDelivery |
| MOD-admin | AuditEvent |
| MOD-reports | ExportRecord (metadata only), optional daily stock snapshot (OQ-17, A's J-08) |
| MOD-access | the read-only "access facts" view (AR-06); policy configuration slots |
| Platform jobs module (named by A) | BackgroundJob, Outbox |
| Platform request layer (named by A) | IdempotencyRecord |

The main consolidation and separation decisions, with reasoning:

| Decision | Kind | Reasoning |
|---|---|---|
| Employee = account + profile | Consolidation | 1:1 for 5–6 people; a separate "User" table adds joins without value. Secrets split out (Credential, TwoFactorFactor). |
| Role as a column, not a role table | Consolidation | Enforces one role per employee structurally (IC-01). Permissions live in code (VT-3), not in data, so a role table is not needed. |
| Credential / TwoFactorFactor split from Employee | Separation | Profile reads, exports, audit snapshots and the directory never touch secrets. |
| Session separate from Employee | Separation | Account state vs session state (brief §3). |
| One SecurityToken table for reset + setup | Consolidation | Identical lifecycle (single-use, expiring, hashed). |
| AttendanceCorrection = applied correction + (Alt B) request | Consolidation | Avoids two tables whose rows map 1:1 under Alt B and one of which is empty under Alt A. |
| Punctuality not stored | Separation (derived) | Attendance state vs punctuality classification; recomputable from settings version. |
| WorkItem as pointer | Avoid duplication | "Do not duplicate task and work-item tables": a WorkItem never stores task or assignment status; it references Task, Business or CallingAssignment. |
| Business vs BusinessCallingState | Separation | Master data vs operational history; lets MOD-business and MOD-calls each write only their own table. |
| CallingAssignment state derived from open row | Consolidation | No separate assigned/unassigned column that could disagree with history. |
| CallAttempt vs current outcome | Separation | Attempt history vs current value (ART-01 §9.3). |
| FollowUp vs Reminder | Separation | Follow-up vs reminder delivery (brief §3, D5). |
| One Deal record across stages | Consolidation | Batch 4 modelling choice 1: accepted opportunity and closed deal are stages of the same record. |
| Project separate from Deal | Separation | Project vs commercial lifecycle; closed ≠ completed (G1). |
| One ProjectChange table for status + schedule | Consolidation | Same shape (who/when/before/after/note). |
| Task with milestone flag | Consolidation (pending OQ-09) | Avoids a second near-identical table; can split later if OQ-09 says milestones are separate. |
| BusinessEditHistory vs AuditEvent | Separation | Different audiences (Access-checked users vs Owner only) and different retention. |
| Business master data vs operational history | Separation | Deleting or archiving master data (C-01) must not silently erase attempts, deals, projects. |

---

## 4. Relationships

| Relationship | Cardinality | Owner (writer) | Required? | Deletion / retention | Policy dependency |
|---|---|---|---|---|---|
| Employee – Credential | 1 : 0..1 | MOD-identity | Optional until credentials set | Replaced on change | — |
| Employee – TwoFactorFactor | 1 : 0..1 | MOD-identity | Required for Owner before admin access | Replaced on recovery | R-11 (pending-2FA scope) |
| Employee – Session | 1 : 0..n | MOD-identity | — | Ended rows purged after window | — |
| Employee – AttendanceSession | 1 : 0..n (≤ 1 Open) | MOD-attendance | — | Retained | DEC-026 states |
| AttendanceSession – AttendanceCorrection | 1 : 0..n | MOD-attendance | — | Retained, append-only | DEC-011 |
| AttendanceSettingsVersion – AttendanceSession | 1 : 0..n | MOD-attendance | Required (session records the version used) | Versions retained | DEC-007/008/009/022 |
| Employee – Target – WorkItem | 1 : n : n | MOD-work | WorkItem target optional | Retained | DEC-020, DEC-021, DEC-025 |
| Category – Business | 1 : 0..n | MOD-business | Business requires a category (Proposed VR-2) | Category removal question (no DEC ID) | DEC-015 |
| Business – BusinessPhone | 1 : 0..n | MOD-business | ≥ 1 phone is **Unresolved** (B2, no DEC ID) | With business | B2 |
| Business – SocialAccount | 1 : 1..n | MOD-business | Required (Confirmed) | With business | DEC-014, DEC-023 |
| Business – BusinessEditHistory | 1 : 1..n (start entry on create) | MOD-business | — | Retained with business | C-01 |
| Business – DataCorrectionRequest | 1 : 0..n | MOD-corrections | — | Retained; closed "business unavailable" if C-01 removes business | DEC-002 row 6, C-01 |
| Business – BusinessCallingState | 1 : 1 | MOD-calls (created inside the create transaction via MOD-calls operation) | Required | With business | R-10 |
| Business – CallingAssignment | 1 : 0..n (≤ 1 open) | MOD-assignment | — | Rows closed, never deleted | DEC-021, B6/DEC-017 |
| Business – ContactReservation | 1 : 0..n (≤ 1 Active) | MOD-reservation | — | Ended rows purged after window | DEC-004 |
| ContactReservation – CallAttempt | 0..1 : 0..n | MOD-calls | Normally required; optional only for B3-Q05 Alt B | Attempts retained | B3-Q05 |
| Business – CallAttempt | 1 : 0..n | MOD-calls | — | Retained | — |
| Business – FollowUp; CallAttempt – FollowUp | 1 : 0..n; 0..1 : 0..n (created by / completed by) | MOD-calls | — | Retained | D4, B3-Q04 (multiple open) |
| Business – Deal | 1 : 0..n **or** 1 : 0..1 open | MOD-deals | — | Retained | **DEC-017 (pending)** |
| CallAttempt – Deal | 1 : 0..1 | MOD-deals (inserted inside the call-save tx) | Required for deals created by E5 | Retained | E5 |
| Deal – DealDeveloperAssignment | 1 : 0..n | MOD-deals | Optional (E3) | Retained | DEC-005 |
| Deal – Meeting – MeetingAttendee | 1 : 0..n : 1..n | MOD-meetings | ≥ 1 attendee (Proposed) | Retained | DEC-005, OQ-02 |
| Deal – ClosureReview | 1 : 0..n | MOD-deals | Only under DEC-006 Alt B | Retained | DEC-006 |
| Deal – Project | 1 : 0..1 | MOD-projects | Created by provisioning | Retained | F2, DEC-017 |
| Project – Task | 1 : 0..n | MOD-projects | — | Retained | OQ-09, OQ-10 |
| Project – ProjectDeveloperAssignment | 1 : 0..n | MOD-projects | — | Retained | OQ-07, OQ-08 |
| Employee – AuditEvent | 0..1 : 0..n | MOD-admin | Actor null = System | Never edited; retention OQ-19 | OQ-19 |
| Employee – Reminder / NotificationDelivery | 1 : 0..n | MOD-notifications | — | Purge after window | Notification timing (no DEC ID) |

**Foreign-key deletion rule (Proposed):** every foreign key to Employee, Business, Deal and Project is *restrict* (no cascade). Because C-01 is pending, nothing in the model relies on cascading deletes of operational history; if the user later allows Owner hard delete of a business, the deletion design must state what happens to attempts, deals and projects explicitly (IC-27).

---

## 5. Integrity constraints

The board table (section 04) lists IC-01..IC-28 with colour: green = Confirmed, blue = Proposed, yellow = Pending policy. Highlights of the brief's required items:

- **One role per employee** — IC-01, Confirmed: one required role column.
- **No second open attendance session** — IC-04, Confirmed rule; the partial unique index is the mechanism. If DEC-026 Alt C (*Pending review*) is chosen, whether that state also blocks a new check-in is part of the decision (shown as pending).
- **Duplicate blocking, self-exclusion, concurrent creation** — IC-06/IC-08/IC-09. The global unique index on normalized phone makes DR-8 hold even for create/create, edit/edit on different businesses, and edit/create races. Self-exclusion comes from diffing phone rows on edit (an unchanged number keeps its row). Name blocking is DEC-013 (IC-07).
- **One active reservation per business with token/version validation** — IC-15. Renew, release and the call save all validate `(reservation id, leaseToken, state Active, lease not lapsed)`.
- **Concurrent edits** — IC-16: a version on every mutable aggregate.
- **Outcome / follow-up consistency** — IC-17 (D2), IC-18 (B1), IC-19 (E5). D4 (follow-ups on Rejected/Accepted) stays pending.
- **Closure → project provisioning** — IC-21 (closed needs signature and payment, Confirmed), IC-22 (one project per deal; closure stays committed if provisioning fails, F3).
- **Idempotent retries** — IC-23.
- **Audit attribution** — IC-24: audit row written in the same transaction; the application's database role cannot update or delete audit rows.
- **Social account and website validation** — IC-11 (platform list Confirmed; URL/handle format Proposed).

---

## 6. Authorization decision flow (section 05, Part 1)

The flowchart draws SM-VISIBILITY-001 Table VT-1 exactly, as an enforcement design. It is the **only** access definition (C5); this section adds *where* each step is enforced, not new rules.

| Step | Check | Enforced where (proposal) | On failure |
|---|---|---|---|
| 1 | Account active | Session middleware loads the employee on **every** request (status is never cached in the session) | Deny; session ended (revoked) |
| 2 | Session authenticated | Session middleware (server-side Session row, idle/absolute expiry) | Re-authenticate ("Session expired") |
| 2b | Owner with 2FA pending | Session state `pending_*` | Admin actions always denied (Confirmed). Other actions: **R-11 → USER** — R11-a deny all, R11-b allow non-admin with undefined scope. Both branches drawn |
| 3 | Resolve the single role | From Employee row | — |
| 4 | Action permitted for role on resource type (VT-3) | Route-level policy declaration per endpoint (action name) checked by MOD-access | "Permission denied"; edit attempts by Call Center/Developer offered a correction request |
| — | Owner skips 5–8 (R-01) | MOD-access | — |
| 5 | Base scope (VT-2) | MOD-access `scopeFilter` (lists) / `check` (single resource) | "Permission denied" |
| 6 | Required relation (assignment, creator, assigned Developer) | MOD-access over access-facts view | "Permission denied" |
| 7 | 15-day window from timer basis | MOD-access: Alt A `Business.createdAt`; Alt B max(createdAt, `BusinessCallingState.lastTouchpointAt`) — **DEC-001 pending**, both computed | Go to step 8 |
| 8 | Active-work exception (DEC-002 rows 1–6) | MOD-access over access-facts view; each row's Alt A / Alt B is a configuration slot that stays empty until decided | "Record hidden by policy" |
| 9 | Resource state allows the action | Owning module (Rejected = do-not-call even for Owner, C-01 status, terminal request) | Denied or read-only |
| 10 | Outcome | Full / Context-limited / Owner (audited) | — |

**Design proposals:**
- **One policy, two compiled forms.** MOD-access exposes `check(user, action, resource)` for single resources and `scopeFilter(user, action, resourceType)` for lists, both generated from the same rule table so they cannot drift. Contract tests run the VT-7 worked evaluations against both forms.
- **Access facts view (AR-06).** MOD-access is the only implementation of WF-ACCESS-001. It **owns** a read-only database view, created by its own migration, that joins the facts each step needs (current assignee, creator, timer basis inputs, deal stage and assigned Developer, project status, open follow-up responsibility and time, open correction requests, archive state if C-01 adopts it). The view is the source for `scopeFilter` (SQL predicate applied before count, sort and paging). This is the single documented exception to the no-cross-module-reads rule (read-only, view-based, owned by MOD-access; A records it as an ADR-006 amendment). Domain modules keep owning and writing their tables; nothing writes through the view.
- **No bypass for the Owner on authentication or audit.** The Owner passes steps 1–4 and 9; Owner reads of hidden records can be audited if OI-05 says so (`business_access.owner_viewed_hidden`, pending).
- **Policy slots, not guesses.** DEC-001, DEC-002 rows, DEC-003, DEC-005, R-11 and the Data Entry base scope are configuration slots with no default value. Until filled, the deployment cannot claim policy completeness (see §11).

---

## 7. Visibility integration and leakage controls (section 05, Part 2 + table)

Part 2 of the flowchart shows every surface from WF-ACCESS-001 / Table RT entering the same engine:
- **Lists, search, queues, calendars:** `scopeFilter` is applied in SQL **before** count, sort and paging; the page is then checked per row. Totals never include hidden rows.
- **Detail and direct URL:** per-request evaluation; "Not found" / "Permission denied" / "Record hidden by policy" without field values; denials logged.
- **Related records:** the engine resolves the linked business (through deal or project where needed) and applies the Table RT exception row. Owned items (own follow-up, attempt, meeting attendance, task, request) are redacted; everything else is omitted and not counted.
- **Notifications and reminders:** content is built at send time, after the account and access re-check (C6). A denied or inactive recipient leads to suppression, visible to the Owner (D6).
- **Exports:** Owner only with 2FA; per-row evaluation stays in place for future roles.
- **Duplicate preview:** matching ignores visibility (C3); the engine decides only what the warning may show (existence only + DEC-003).

The leakage-control table on the board lists, per surface, the leak risk and the control (UUIDs, no hints in empty states, no business data in logs, no-store caching, rate-limited duplicate checks, context-limited outcomes confined to their surface, B7 items Owner-only).

---

## 8. Transaction / concurrency matrix (section 06 table)

The board table lists 20 operations with transaction boundary, concurrency protection, idempotency/retry, conflict response and audit events. Principles behind it:
1. **One user action = one database transaction**, including its audit rows and its **outbox events** (A's ADR-007): the event commits with the change, so no reminder, notification, provisioning or session revocation follows a rolled-back change (WF-NOTIFY-001 precondition). After commit, A's J-03 Outbox relay hands events to consumers; reminders and notifications are dispatched by J-01 / J-02, provisioning retries by J-07, reservation expiry is recorded by J-05.
2. **External calls (email provider) never happen inside a transaction.** The worker claims a reminder / delivery / job row, commits, calls out, then records the result in a new transaction.
3. **Reservation release is a separate step after the call-save commit** (WF-CALL-003 step 7, AR-03); a failed release just lets the lease expire. A reassignment never releases a reservation: an Active reservation is a precondition answered by Wait or Owner override (WF-CALL-001 step 4, WF-CALL-002).
4. **Closure and project provisioning are separate transactions** (F3: closure stays committed if provisioning fails).
5. **Every write endpoint accepts an idempotency key**; retries return the stored result rather than repeating the change.
6. **Isolation:** default READ COMMITTED plus explicit row locks and unique constraints; exports use a REPEATABLE READ snapshot so one streamed export is internally consistent.

---

## 9. Critical sequences SEQ-01..SEQ-15

SEQ-01..SEQ-11 are each one diagram in section 06 (participants: the actor, `Browser`, `API` = Express domain module, `Access` = MOD-access policy, `DB` = PostgreSQL, `Worker` = background worker, `Email` = email provider). **SEQ-12..SEQ-15 are not on the board yet** (Figma MCP quota exhausted); their ready-to-generate Mermaid source is in Appendix A. The generator cannot draw notes, alt/else, loops or self-messages, so each diagram shows the main path and the annotation block under it states the six required properties. Where an internal API step mattered (SEQ-01 password and factor verification), it is written as small text next to the API lifeline. The text below is the full explanation.

Drawing note: the generator places lifelines 280 px apart and a message label wider than that hides its arrow. Every board sequence was therefore widened after generation (lifelines moved apart; messages stay attached), and over-long labels were shortened.

### SEQ-01 Login + Owner 2FA (WF-AUTH-001, SM-SESSION-001; UC-AUTH-001/002)
Flow: credentials posted → account and credential loaded → password verified (constant-time) → session row created in `pending_verification` (Owner) → second factor submitted → factor verified → session `active`, session id rotated → Owner workspace.
- **Authorization:** no prior auth; account must be Active. Owner gets no admin access until `active` (Confirmed). Pending-session scope for non-admin actions is R-11 → USER.
- **Transaction:** one short transaction per step (create session; update session).
- **Concurrency:** row lock on the session while incrementing the failed-factor counter; throttle per account and IP (thresholds: implementation decision).
- **Failure:** generic "email or password incorrect"; threshold exceeded → session Ended (`abandoned`/threshold); deactivated account → same generic message.
- **Audit:** `login.failed`, `session.created`, `session.second_factor_verified` / `session.second_factor_failed`, `session.ended`.
- **Retry / idempotency:** each attempt is new; a verification code is single-use (replay rejected).

### SEQ-02 Password reset (WF-AUTH-002; UC-AUTH-004)
Flow: email entered → same confirmation for any email → if an Active account exists, a token hash and an outbox event are inserted in one transaction → J-03 relays it and J-02 Notification dispatch sends the single-use link → user sets a new password → token locked and checked → hash updated, token used, **all sessions ended**, audit — one transaction. Owner-triggered assistance enters at the token step (Owner, 2FA complete); the Owner never sees a password.
- **Authorization:** self-service is anonymous but reveals nothing; assistance requires Owner + 2FA.
- **Transaction:** request (token + outbox event + audit) one tx; completion (token + hash + session end + audit) one tx — all MOD-identity tables, so no cross-module write.
- **Concurrency:** token row locked; usable only while unused and unexpired.
- **Failure:** expired/used link → "Link expired"; email failure → generic confirmation for self-service, visible failure for Owner-triggered (WF-NOTIFY-001 handling).
- **Audit:** `password_reset.requested`, `password_reset.assistance_triggered`, `password_reset.completed`, `session.revoked`.
- **Retry:** email delivery deduplicated by token id / event id; second completion with the same link fails as used. An Owner still needs 2FA after reset.

### SEQ-03 Deactivation + session revocation (WF-EMP-001 M3, SM-ACCOUNT-001, SM-SESSION-001; UC-AUTH-006) — revised per AR-04
Flow: Owner opens employee → open-items summary (assignments, follow-ups, reservation, deals/meetings, projects/tasks, attendance session, correction requests; read through module query operations) → confirm with version → guards (not self, not last active Owner — both **Proposed** in Batch 4) → **MOD-employees commits** status Deactivated + audit `account.deactivated` + outbox event `account.deactivated` in one transaction → items flagged "assignee inactive" (derived) → **access ends immediately**: every request re-checks account status (access evaluation step 1), so the employee's next request on any client is refused even before the sessions are formally ended → after commit, J-03 relays the event and **MOD-identity revokes all sessions asynchronously** (`session.revoked`) → worker later suppresses reminders addressed to them (C6, D6). Role change (M2) works the same way with `account.role_changed`.
- **Authorization:** Owner + 2FA (Confirmed).
- **Transaction:** MOD-employees tx = status + audit + outbox event. Session revocation is a separate MOD-identity tx after commit (MOD-employees never calls MOD-identity, A §3.2). No work item is moved (Confirmed: no automatic reassignment).
- **Concurrency:** employee version; last-Owner guard under lock.
- **Failure:** save conflict → reload. If revocation is delayed or fails, the outbox retries it; meanwhile the per-request account check already denies every request, so there is no access window.
- **Audit:** `account.deactivated` (in the tx), `session.revoked` (by MOD-identity after commit).
- **Retry / idempotency:** repeating the deactivation is a no-op; the revocation consumer is idempotent by event id. An Active reservation held by the employee expires at lease end (B3-Q06 pending for immediate termination).

### SEQ-04 Check-in with office verification (WF-ATT-001, SM-ATTENDANCE-001; UC-ATT-001)
Flow: Check In with idempotency key → authenticate, own attendance → office check per DEC-009 (client IP as seen by the reverse proxy and/or geofence; mode pending) → current settings version loaded → insert Open session (unique: one Open per employee) → audit → active panel with punctuality derived (Unclassified while DEC-007/008 are unset).
- **Authorization:** any active employee, own record only. Owner included (no exemption; F-04). Owner with pending 2FA: R-11.
- **Transaction:** session insert + audit in one tx.
- **Concurrency:** partial unique index prevents a second Open session even from two devices at once.
- **Failure:** verification failure with no DEC-010 remote exception → nothing stored, failed attempt audited (Proposed); open session exists → blocked, resolve via WF-ATT-003.
- **Audit:** `attendance.checked_in`; failed attempt event (Proposed name pending).
- **Retry:** same idempotency key returns the first result; a different key hits the unique index → "already checked in".
- Not gated: no business action depends on attendance (A1).

### SEQ-05 Checkout including DEC-026 branches (WF-ATT-002; UC-ATT-002)
Flow: Check Out with summary (DEC-012) and session version → own Open session locked → office check → verified: close, duration, audit → failure: **one of three unselected alternatives** drawn as three messages: Alt A keep Open + `checkout_failed`; Alt B Closed provisionally + Owner review item; Alt C Pending review + attempted time stored. The user always sees an explicit result.
- **Authorization:** session owner only.
- **Transaction:** one tx per attempt (session update + audit + optional Owner review notification job).
- **Concurrency:** row lock + version on the session.
- **Failure:** save failure keeps the session Open; invalid summary → validation loop.
- **Audit:** `attendance.checked_out`, `attendance.checkout_failed`, `attendance.checkout_provisional`, `attendance.checkout_pending_review`.
- **Retry:** repeat after success answers "already closed".

### SEQ-06 Business creation with duplicate block (WF-BIZ-001; UC-BIZ-001/002)
Flow: save with idempotency key → Access: can create (role Data Entry/Owner, R-11 for pending Owner) → validate VR-1..VR-12, normalize phones/name → one transaction inserts business, phones, socials, edit-history start and (via MOD-calls) the calling state `pending` → unique violation on a normalized phone → rollback → matched business identified → Access decides what the user may see of it → `business.duplicate_blocked` → 409 "already exists" with the allowed preview.
- **Success path (not drawn as messages):** commit; `business.created`; hand-off to WF-CALL-001 (unassigned + pending).
- **Authorization:** WF-ACCESS-001 step 4 (create), step-by-step for the preview (DR-9).
- **Transaction:** single tx; nothing is stored on a block.
- **Concurrency:** the global unique index is the atomic re-check (DR-8): two simultaneous creates → exactly one wins.
- **Failure:** validation errors kept in form; similar-name warning (DEC-013 Alt NM-C / SN-1) before save; technical failure → nothing created.
- **Audit:** `business.created` or `business.duplicate_blocked`.
- **Retry:** idempotency key returns the first outcome; retry after failure re-runs the duplicate check.

### SEQ-07 Concurrent business edit (WF-BIZ-002 Part A; UC-BIZ-004)
Flow: users A and B load the same business (version 7) → A saves name/phone change with version 7 → Access re-checked → conditional update "where version = 7", phone diff, history rows, version 8 → commit → B saves with version 7 → conditional update matches 0 rows → `business.save_conflicted` → 409 with latest values.
- **Authorization:** Access check for edit at save time (read ≠ edit; access may have expired since load → denied).
- **Transaction:** fields + phones + history + audit in one tx.
- **Concurrency:** optimistic version; phone uniqueness still enforced by the index (edit/edit on different businesses).
- **Failure:** save conflict (nothing overwritten), duplicate block, access lost.
- **Audit:** `business.updated`, `business.save_conflicted`, `business.duplicate_blocked`.
- **Retry:** only after reload with the new version.

### SEQ-08 Hidden-duplicate preview (WF-BIZ-001 Part 2, WF-ACCESS-001 Part 3; UC-BIZ-003)
Flow: duplicate check (on blur or on save) → Access: can create → match across all businesses including hidden → match B → Access evaluates read on B for this user (facts loaded) → hidden by policy → existence-only payload (no id, no fields) → `business.duplicate_blocked` → "Already exists"; any extra detail or escalation only per **DEC-003 (pending)**. Owner sees the full match (C1).
- **Authorization:** create permission + per-match read evaluation.
- **Transaction:** read-only (audit row only when it is part of a blocked save).
- **Concurrency:** none needed; final protection is the unique index in SEQ-06.
- **Failure:** rate-limited per user to prevent enumeration by probing numbers.
- **Audit:** `business.duplicate_blocked`; `business.hidden_match_revealed` only if DEC-003 reveals more.
- **Retry:** safe to repeat.

### SEQ-09 Assignment / reassignment (WF-CALL-001 Part 1, SM-ASSIGNMENT-001; UC-CALL-008)
Flow: Owner requests the impact summary (current assignment, open follow-ups, Active reservation, D2 marker) → submits reassignment with reason, follow-up choices and the assignment version → transaction: lock calling-state row (through a MOD-calls operation; MOD-assignment → MOD-calls is the only direction, AR-07) → eligibility B1, B2, B4 (C-01), B6 (DEC-017), new agent active Call Center, no Active reservation → end current row, insert new row, apply follow-up choices (transfer / cancel / keep-with-warning; no default, B3-Q03) → follow-up changes applied by MOD-calls operations, which write their own outbox events (`follow_up.reassigned` / `follow_up.cancelled`, consumed by MOD-notifications to cancel and re-plan reminders) → MOD-assignment writes audit + outbox event `calling_assignment.reassigned` → commit → J-03 relays, J-02 sends the new-assignment notification after the C6 re-check. No reservation is released by this save (AR-03).
- **Authorization:** Owner + 2FA (Confirmed); Owner bypasses scope (R-01) but not resource state (Rejected excluded).
- **Transaction:** one tx for all of the above (single save in WF-CALL-001 step 6).
- **Concurrency:** row lock on BusinessCallingState; partial unique on the open assignment; an Active reservation is a precondition → Owner chooses Wait or Override (WF-CALL-002) before the save; the save itself never releases it.
- **Failure:** conflict if assignment or reservation changed; ineligible items listed per item.
- **Audit:** `calling_assignment.reassigned` (or `assigned` / `unassigned` / `retained`), `follow_up.reassigned`, `follow_up.cancelled`, `callback_marker.set`.
- **Retry:** version-guarded; replay with the same idempotency key returns the stored result. Never automatic (B7, B8).

### SEQ-10 Reservation acquire, renew and release (WF-CALL-002, SM-RESERVATION-001; UC-CALL-002/010)
Flow: Start Contact → Access (B7, assignee included) and resource state (not Rejected) → transaction: mark a lapsed Active row as Expired, insert Active row (partial unique per business) → lease token T + expiry → "reserved by you" → renew with T: Access re-checked, conditional update extends expiry → release with T → Released.
- **Authorization:** assigned Call Center agent or Owner (DEC-004 Proposed); override Owner only.
- **Transaction:** acquire one tx; renew and release are single conditional updates.
- **Concurrency:** unique Active per business; token + state + lease time checked on every renew/save. Same holder re-entry returns the existing row.
- **Failure:** unique violation → 409 "Contact reserved by another agent" with holder name; renew after loss → "reservation no longer held"; access lost on renew → refused, lease runs out, B7 item for Owner.
- **Audit:** `contact_reservation.acquired`, `.released`, `.expired`, `.overridden`; acquire conflicts and renewals are operational logs only.
- **Retry:** renew retried until lease end; tab switching is not a release (DEC-004 idle rule pending).
- Lease duration, idle rule, maximum duration: DEC-004 (values undecided). Correctness uses the lease time in the row (lazy evaluation). **`contact_reservation.expired` is written exactly once**, by whichever transaction performs the conditional Active → Expired update: normally A's J-05 Reservation expiry sweep, or an acquire that finds a lapsed Active row and must flip it to free the unique index. *Flag for A:* A's J-05 text says only the sweep records `expired`; the acquire path above needs the same audit rule (see §11).

### SEQ-11 Outcome + follow-up (WF-CALL-003, WF-FOLLOW-001; UC-CALL-003/004)
Flow: call save with token, outcome Needs another call, follow-up time, calling-state version and idempotency key → idempotency check → Access (B7) → D2 validated (follow-up or marker) → transaction: lock reservation by token and calling state → verify reservation held and version unchanged → insert attempt, update outcome, insert follow-up, clear marker → outbox event `follow_up.scheduled` (consumed by MOD-notifications to plan reminders, A §4.2), audit, idempotency result → commit → **release reservation as a separate step after commit** (AR-03).
- **Authorization:** reservation holder (assigned agent or Owner), Access check on save.
- **Transaction:** one tx; the reservation is never released before the commit.
- **Concurrency:** token + version; stale client → B3-Q05 Alt A (reject, keep draft) / Alt B (accept attempt only) **pending**.
- **Failure:** validation error → form kept, reservation renewed; save failure → nothing stored; save conflict → current values shown.
- **Audit:** `call_attempt.logged`, `call_outcome.changed`, `follow_up.scheduled`, `callback_marker.cleared`, `contact_reservation.released`.
- **Retry:** idempotency key on the attempt makes a double-submit produce one attempt row.
- Rejected / Accepted outcomes with open follow-ups: D4 pending (no default).

### SEQ-12 Reminder dispatch + retry (WF-NOTIFY-001, SM-REMINDER-001)
Flow: worker claims a due reminder (skip-locked, lease) → loads source follow-up/meeting and compares version and state → loads recipient account status → Access re-check (C6) → sends with provider idempotency key (reminder id + attempt) → transient failure → Retry pending, attempt 2, backoff → next run repeats claim and **re-check** → accepted → Sent + audit.
- **Authorization:** system actor; recipient re-evaluated at send time.
- **Transaction:** claim tx; send outside any tx; result tx.
- **Concurrency:** skip-locked claim + lease prevent double sends by two workers; stale source version → Cancelled.
- **Failure:** retries exhausted / permanent → Failed; re-check fails → Suppressed; both raise an Owner delivery-failure notification (D6) with a loop guard. Late run after the event time → B3-Q08 pending.
- **Audit:** `reminder.scheduled`, `.sent`, `.retry_scheduled`, `.failed`, `.suppressed`, `.cancelled`.
- **Retry:** at-least-once delivery; provider key minimizes duplicates. The follow-up is never changed (D5).

### SEQ-13 Accepted-opportunity handoff (WF-CALL-003 → WF-DEAL-001; UC-CALL-007, E5)
Flow: call save with outcome Accepted, handoff context, optional Developer → Access (B7) → transaction: lock reservation and calling state → **DEC-017 open-deal check (pending: block/link vs create another)** → insert attempt, outcome accepted, deal in stage accepted_opportunity (MOD-deals operation, same tx) → developer chosen → assignment row; else "developer not yet assigned" (E3) → audit `accepted_opportunity.created` (counted once) + outbox events `accepted_opportunity.created` and, if a Developer was chosen, `opportunity.developer_assigned` → commit → reservation released as a separate step (AR-03) → J-03 relays, J-02 sends the developer handoff to the Developer only if the Developer passes the deal-record check (**DEC-005 pending**; otherwise **suppressed** (A §4.4 prefers suppression over redaction) and visible to the Owner, D6).
- **Authorization:** reservation holder; Developer assignment by Call Center or Owner (E2).
- **Transaction:** one tx for attempt + outcome + deal (+ developer assignment).
- **Concurrency:** token + version; unique `acceptedAttemptId`; DEC-017 Alt single adds a partial unique per business.
- **Failure:** any failure rolls back outcome and deal together (atomic E5); invalid Developer → pick another or defer.
- **Audit:** `call_attempt.logged`, `call_outcome.changed`, `accepted_opportunity.created`, `opportunity.developer_assigned`.
- **Retry:** idempotency key; unique accepted attempt prevents a second deal from a replay.

### SEQ-14 Closure + project provisioning (WF-DEAL-002, SM-COMMERCIAL-001, SM-PROJECT-001; UC-DEAL-003, UC-PROJ-002)
Flow: Developer (or Owner) finalizes with the deal version → Access: closure allowed under **DEC-006** (Alt A Developer/Owner; Alt B Owner after review), **DEC-005** and **R-12** → transaction: lock deal, version check, guard signature + payment recorded and stage signed_and_paid → stage closed, closer, time, audit `deal.closed` + outbox event `deal.closed` (A §3.2: MOD-deals never calls MOD-projects) → commit → under **F2 Alt Auto** MOD-projects consumes `deal.closed` (via J-03) and inserts the project (unique dealId) in Scheduled with `project.provisioned` → on repeated failure `project.provisioning_failed` and "provisioning pending" for the Owner. Under F2 Alt Manual the Owner/Developer triggers the same insert later.
- **Authorization:** see above; Data Entry never; Call Center pending (OQ-03).
- **Transaction:** closure tx; provisioning in its own tx (F3).
- **Concurrency:** deal version; unique project per deal makes provisioning retries safe.
- **Failure:** missing fact named; closure stays committed if provisioning fails.
- **Audit:** `deal.closed`, `project.provisioned`, `project.provisioning_failed`.
- **Retry:** consumer retry, then A's J-07 Project provisioning retry (and a manual Owner retry, F3); the unique index absorbs duplicates.

### SEQ-15 Authorized export (WF-REPORT-001; UC-REP-003) — revised per AR-05
Flow: Owner requests export (format, filters) → Access: Owner, active session, 2FA complete → MOD-reports runs the **same filters** as the screen in one read-only snapshot → rows pass through `scopeFilter` / per-row `check` (all pass for the Owner, C1; kept for future roles) → the file is generated **synchronously and streamed** to the Owner's browser; **nothing is stored** (A's ADR-010) → on completion an ExportRecord audit row + `report.exported` (format, filters, row count) is committed.
- **Authorization:** Owner + 2FA (Confirmed); non-Owner → `report.export_denied`.
- **Transaction:** read-only REPEATABLE READ snapshot for the data; ExportRecord + audit in a short separate tx.
- **Concurrency:** none (read); the snapshot keeps the stream internally consistent.
- **Failure:** stream aborted → client discards the partial download; `report.export_failed` audited; Owner retries.
- **Audit:** `report.exported`, `report.export_failed`, `report.export_denied`.
- **Retry / idempotency:** a retry simply regenerates from the current data (no stored file to reuse).

---

## 10. Retention and deletion proposals

All values are **Proposed** and need user approval (several touch "Recovery objectives" and OQ-19, which are open).

| Data | Proposal |
|---|---|
| Business master data | **C-01 pending.** Alt archive: status + who/when, archived rows still duplicate-checked (DR-2), excluded from calling (B4). Alt Owner hard delete: allowed only through an explicit design for its operational history (attempts, follow-ups, deals, projects). Data Entry never deletes (Confirmed). No cascades in the meantime. |
| Operational history (attempts, assignments, follow-ups, deals, meetings, projects, tasks, attendance, corrections, edit history) | Retained indefinitely in the app; never edited; corrections are new rows. |
| Employees | Deactivate only (no deletion offered); attribution kept (Confirmed). Employee deletion is a related open question (C-01 itself concerns business deletion vs archiving). |
| Sessions, reservations (ended), reminders, notification deliveries, completed jobs, security tokens, idempotency records | Technical data purged after windows: sessions 90 days, reservations 90 days, reminders/notifications 180 days, jobs 30 days, tokens 30 days after expiry, idempotency 48 h. The corresponding audit events remain. |
| Exports | **No file is stored** (ADR-010, AR-05); only the ExportRecord audit metadata is retained. |
| Audit events | Never edited or deleted by the app; retention period OQ-19 (open). Backups follow Agent A's recovery design. |
| Secrets | Password hashes overwritten on change; 2FA secrets encrypted at rest; never written to audit, logs or exports. |

---

## 11. Decisions needing the user; residual issues; brief change requests

**Decisions that directly shape the data/authorization design (none selected here):**
1. **DEC-017** one vs many open deals per business (IC-20; SEQ-13 branch; B6 re-queue).
2. **C-01** deletion vs archiving of businesses (IC-27; FK rule); employee deletion and category removal are related open questions.
3. **DEC-001 / DEC-002** timer basis and exception rows (policy slots in MOD-access; Alt B needs `lastTouchpointAt`).
4. **DEC-003** hidden-match revelation (SEQ-08 payload).
5. **DEC-004** lease duration / idle rule (reservation expiry values).
6. **DEC-005 × DEC-006 (R-12)** Developer pre-closure access vs closure authority (SEQ-13 notification, SEQ-14 authorization).
7. **R-11** Owner pending-2FA scope (step 2b).
8. **DEC-013** name blocking (IC-07); **DEC-014 / DEC-023** Unknown metrics and history.
9. **DEC-026** checkout failure (SEQ-05) and whether *Pending review* blocks a new check-in.
10. **F2** automatic vs manual provisioning (SEQ-14).
11. **B3-Q05** late save after reservation loss (CallAttempt.reservationId optionality).
12. **D4** open follow-ups on Rejected / Accepted.
13. **R-10** calling-outcome state model vs table (no data change either way).
14. Retention windows in §10 and OQ-19 audit retention.
15. Data Entry base scope (no DEC ID) — needed for the step-5 scope predicate.

**Residual issues (non-blocking):**
- **Board incomplete (Figma MCP quota):** the board still shows pre-P34-2 labels; SEQ-12..SEQ-15 not drawn; SEQ-11 not visually checked; sections 04/05/06 not enlarged; no `get_figjam` read-back. The precise operator list is §14.
- Module names now follow A's catalogue (AR-01). The names of A's platform jobs module and platform request layer are A's to give (AR-02); this document uses those descriptive names until then.
- **Event/job catalogue (AR-09) — names B relies on, for A to confirm in its single catalogue:** outbox events `account.deactivated`, `account.role_changed`, `password_reset.requested` (security email), `calling_assignment.assigned` / `.reassigned`, `follow_up.scheduled` / `.rescheduled` / `.reassigned` / `.completed` / `.cancelled`, `meeting.*`, `accepted_opportunity.created`, `opportunity.developer_assigned` / `_reassigned`, `deal.closed`; jobs J-01, J-02, J-03, J-05, J-07. **Flags for A:** (1) A's catalogue does not yet name a consumer for `password_reset.requested` / credential-setup emails (B assumes J-02); (2) J-05 says only the sweep records `contact_reservation.expired`, but an acquire that finds a lapsed Active row must flip it to free the unique index — B proposes the audit is written by whichever transaction performs the conditional Active → Expired update, so it is written exactly once; (3) `calling_assignment.*` must be published as outbox events for MOD-notifications (new-assignment notice).
- Session transport (cookie, same origin) is Agent A's. Exports follow A's ADR-010 (synchronous, streamed, never stored).
- The generator draws sequences without alt/else; failure paths are described in each annotation block and in §9, not as arrows (except SEQ-05, where the three DEC-026 alternatives are drawn as labelled messages).
- No blocking contradiction with Phase 2 was found.

**Brief change requests:** none.

---

## 12. Verification

**Created (board, inside my leased sections only; every diagram generated under the arch-board lock, wrapped in place, then moved):**
- Section 04: ERD-1..ERD-5, entity catalogue table (37 entity rows), integrity-constraint table (IC-01..IC-28, colour-coded).
- Section 05: AUTH-1 decision flow, AUTH-2 visibility integration, leakage-control table.
- Section 06: transaction/concurrency matrix table (20 operations), SEQ-01..SEQ-11 with header and six-property annotation block.
- Document: this file.

**Read back:** every diagram write returned node IDs, node counts and sizes (structural evidence from `use_figma`). A full `get_figjam` read-back of sections 04/05/06 was **not** done: the Figma MCP plan quota ran out first.

**Visually inspected (get_screenshot):** ERD-1, ERD-2, ERD-3, ERD-4, ERD-5, AUTH-1, AUTH-2, SEQ-01..SEQ-10. Defects found and fixed:
| Diagram | Defect | Fix | Attempts |
|---|---|---|---|
| ERD-1 | Tables overlapped after rows wrapped (hid Session.factorFailCount) | Tables pushed apart per column | 1 |
| ERD-4 | Business → Deal connector (the DEC-017 relation) not drawn, label only | Connector re-attached to Deal's left side | 1 |
| AUTH-2 | Six outcome edge labels stacked on one trunk (ambiguous) | Conditions moved into target node text ("IF … →"); truncated diamond/cylinder enlarged | 2 |
| SEQ-01 | Arrows hidden behind labels; two self-messages broken | Lifelines widened; broken self-message connectors removed; self-steps written as text | 1 |
| SEQ-03 | One label too long, arrow hidden | Label shortened | 1 |
| SEQ-06 | Two labels implied wrong direction (validation "to DB", success path) | Relabelled | 1 |

Remaining minor issues (not misleading, left as is): in ERD-3 the "has callbacks" line crosses the bottom of the BusinessCallingState table; in ERD-4 the DEC-017 label touches a table cell; AUTH-1 subgraph titles are not displayed; integrity table has no on-board colour legend (legend is in the table title and §5).

**P34-2 revision (document only, no Figma calls):** AR-01 renames, AR-02 ownership table (§3) and Outbox (ERD-5 text), AR-03 release-after-commit (§8, SEQ-09/11/13), AR-04 SEQ-03 asynchronous revocation, AR-05 no stored export (ERD-5, SEQ-15, §10), AR-06 MOD-access-owned access-facts view (S-2, S-8, §6), AR-09 outbox/job names (§8, sequences, §11). The board still shows the old labels; §14 lists every change.

**Not inspected / not done:**
- SEQ-11 (`84:6991`) was created but **not** screenshotted.
- SEQ-12, SEQ-13, SEQ-14, SEQ-15 are **not on the board** (Appendix A has their Mermaid).
- Leased sections 04/05/06 were **not enlarged**; their content extends below (and in 04 to the right of) the original 8000 × 3000 frames. Content does not overlap any other agent's section (04 is the rightmost section; rows 1 and 2 are 13 000 px apart), but the section backgrounds do not yet cover it.
- No final layout pass, no `get_figjam` read-back of the three sections.
- The arch-board lock was released after the last generation (16:36 local).

Nothing here is tested; there is no software.

---

## 13. Board node IDs

| Section | Item | Node |
|---|---|---|
| 04 `1:14` | ERD-1 Identity, sessions, attendance, targets | `16:1960` |
| 04 | ERD-2 Business master data and corrections | `32:2792` |
| 04 | ERD-3 Calling, reservations, follow-ups | `35:3621` |
| 04 | ERD-4 Deals, meetings, projects, tasks | `38:4850` |
| 04 | ERD-5 Cross-cutting | `42:6048` |
| 04 | Entity catalogue (title / table) | `8:111` / `8:112` |
| 04 | Integrity constraints (title / table) | `8:572` / `8:573` |
| 05 `1:17` | AUTH-1 Authorization decision flow | `45:6166` |
| 05 | AUTH-2 Visibility integration | `48:6243` |
| 05 | Leakage controls (title / table) | `10:1111` / `10:1112` |
| 06 `1:20` | Transaction/concurrency matrix (title / table) | `10:857` / `10:858` |
| 06 | SEQ-01 … SEQ-05 | `53:6313`, `57:6385`, `60:6456`, `63:6514`, `66:6575` |
| 06 | SEQ-06 … SEQ-11 | `69:6642`, `72:6722`, `75:6783`, `78:6860`, `81:6930`, `84:6991` |

---

## 14. Board updates pending quota reset (for the single Figma operator)

No Figma tool was called for the P34-2 revision. Apply these on board `YKQi8IAz6sOGoLqwolHKPk`, then screenshot each changed node. Follow brief §4 (arch-board lock around every `generate_diagram`; wrap in place; move into the leased section). After any sequence generation, widen the lifelines: shift the k-th participant column (k = 0, 1, 2 …) right by k × 320 px for 4 participants, or k × 220 px for 5–6. Messages stay attached. Then delete any connector whose endpoint is `0:1` (a broken self-message).

### 14.1 Text edits inside existing nodes
Find each node by its exact current text inside the parent given. Table cells are (row, column), zero-based, header row = 0.

| # | Section | Parent node | Kind | Old text | New text |
|---|---|---|---|---|---|
| 1 | 04 | `16:1962` (ERD-1 meta) | text | `C-01 (employees)` | `employee deletion (related to C-01)` |
| 2 | 04 | `42:6050` (ERD-5 meta; superseded if row 34 is done) | text | `Job scheduling, retry and audit design owned by Architecture Agent A (sections 07/08)` | `BackgroundJob + Outbox: platform jobs module; IdempotencyRecord: platform request layer; AuditEvent: MOD-admin; ExportRecord: MOD-reports, no file (AR-01/02/05)` |
| 3 | 04 | `8:112` (9,1) and (10,1) | table cell | `MOD-targets` | `MOD-work` |
| 4 | 04 | `8:112` (11,1) … (15,1) | table cell | `MOD-businesses` | `MOD-business` |
| 5 | 04 | `8:112` (12,2) | table cell | `Phone numbers; normalized value globally unique` | `Phone numbers; normalized value globally unique (match key owned by MOD-business; MOD-duplicates only reads)` |
| 6 | 04 | `8:112` (18,1) | table cell | `MOD-assignments` | `MOD-assignment` |
| 7 | 04 | `8:112` (19,1) | table cell | `MOD-reservations` | `MOD-reservation` |
| 8 | 04 | `8:112` (34,0) / (34,1) | table cell | `BackgroundJob` / `Worker (owned by architecture-a)` | `BackgroundJob / Outbox` / `Platform jobs module (named by A)` |
| 9 | 04 | `8:112` (35,1) | table cell | `MOD-audit` | `MOD-admin` |
| 10 | 04 | `8:112` (36,2) / (36,4) | table cell | `Export request, filters, row count, file reference` / `File expires quickly (Proposed 24 h); record retained` | `Export audit metadata: requester, format, filters, row count (no file)` / `No file is ever stored (ADR-010); record retained` |
| 11 | 04 | `8:112` (37,1) | table cell | `Shared API infrastructure` | `Platform request layer (named by A)` |
| 12 | 04 | `8:112` (1,4) | table cell | `Never hard-deleted in the app; deactivate only. Employee deletion is part of C-01 (pending). Attribution must survive` | `Never hard-deleted in the app; deactivate only. Employee deletion is a related open question (C-01 = business deletion). Attribution must survive` |
| 13 | 06 | `10:858` (2,1) | table cell | `Request: token + email job in one tx. Complete: token use + hash + end sessions + audit in one tx` | `Request: token + outbox event + audit in one tx. Complete: token use + hash + end sessions + audit in one tx` |
| 14 | 06 | `10:858` (2,3) | table cell | `Second submit of same link fails as used; email job deduplicated by token id` | `Second submit of same link fails as used; email deduplicated by event id` |
| 15 | 06 | `10:858` (3,1) | table cell | `Status + end all sessions + audit in one tx` | `MOD-employees tx: status + audit + outbox account.deactivated; MOD-identity revokes sessions after commit (AR-04)` |
| 16 | 06 | `10:858` (11,1) | table cell | `End old row + new row + follow-up choices + reminder cancels + jobs + audit in one tx` | `End old row + new row + follow-up choices (MOD-calls operations) + outbox events + audit in one tx; never releases a reservation` |
| 17 | 06 | `10:858` (14,1) | table cell | `Follow-up + history + reminder cancel + replan job in one tx` | `Follow-up + history + outbox event (MOD-notifications re-plans reminders) in one tx` |
| 18 | 06 | `10:858` (16,1) | table cell | `Stage + facts + audit (+ provisioning job under F2 Auto) in one tx` | `Stage + facts + audit + outbox deal.closed in one tx` |
| 19 | 06 | `10:858` (17,1) | table cell | `Own tx in the worker (or manual action)` | `Own tx: MOD-projects consumes deal.closed (F2 Alt Auto) or manual action; J-07 retry` |
| 20 | 06 | `10:858` (19,1) / (19,3) / (19,4) | table cell | `Read-only snapshot tx (repeatable read) + export record tx` / `Export id; regenerate on failure` / `No partial file; failure audited` | `Read-only snapshot; streamed synchronously, no file stored; ExportRecord audit tx` / `Regenerate on failure (nothing stored)` / `Aborted stream discarded; failure audited` |
| 21 | 05 | `48:6243` (AUTH-2) | shape | `Scope predicate: same rules compiled to a SQL filter` | `scopeFilter: same rules compiled to a SQL filter` |
| 22 | 05 | `47:6189` (AUTH-2 diamond) | shape | `Per-resource evaluation, SM-VISIBILITY-001 steps 1-10` | `check(): per-resource evaluation, SM-VISIBILITY-001 steps 1-10` |
| 23 | 05 | `47:6192` (AUTH-2 cylinder) | shape | `Access facts view: assignee, creator, timer basis, …` | add the prefix `MOD-access-owned read-only view. ` and keep the rest of the text unchanged |
| 24 | 06 | `57:6385` (SEQ-02) | connector | `If active account: insert token hash and email job, audit` | `If active account: token hash + outbox event + audit` |
| 25 | 06 | `57:6385` (SEQ-02) | connector | `Claim email job (dedupe by token id)` | `J-02 claims email delivery (dedupe by event id)` |
| 26 | 06 | `57:6388` (SEQ-02 annotation) | text | `request = token hash + email job + audit in one tx` / `email job deduplicated by token id` | `request = token hash + outbox event + audit in one tx` / `email deduplicated by event id` |
| 27 | 06 | `78:6860` (SEQ-09) | connector | `Begin, lock calling-state row` | `Begin, lock calling-state row (MOD-calls operation)` |
| 28 | 06 | `78:6860` (SEQ-09) | connector | `Cancel reminders, insert notify and reminder jobs` | `Follow-up changes via MOD-calls, outbox events` |
| 29 | 06 | `78:6863` (SEQ-09 annotation) | text | `+ reminder cancels + notification and reminder jobs + audit in one tx` | `+ outbox events (reminders re-planned by MOD-notifications, notification by J-02) + audit in one tx; the save never releases a reservation (AR-03)` |
| 30 | 06 | `81:6933` (SEQ-10 annotation) | text | `(expiry written by a sweeper job)` | `(expired written exactly once, by the tx that flips Active to Expired: J-05 sweep or acquire)` |
| 31 | 06 | `84:6991` (SEQ-11) | connector | `Clear marker, reminder-planning job, audit` | `Clear marker, outbox follow_up.scheduled, audit` |
| 32 | 06 | `84:6994` (SEQ-11 annotation) | text | `+ reminder-planning job +` | `+ outbox event follow_up.scheduled +` |

### 14.2 Regenerate, add, inspect, resize
| # | Section | Action |
|---|---|---|
| 33 | 06 | **Replace SEQ-03** `60:6456` with "SEQ-03 v2" from Appendix A (asynchronous revocation, AR-04). Header title: `SEQ-03 — Deactivation + session revocation (revised per AR-04)`. Annotation: the §9 SEQ-03 bullets. Delete the old wrapper only after the new one is in place. |
| 34 | 04 | **Replace ERD-5** `42:6048` with "ERD-5 v2" from Appendix A (adds Outbox; ExportRecord has no file). Keep the old header title. Use the meta text from row 2. Run the per-column table de-overlap after wrapping. |
| 35 | 06 | **Draw SEQ-12, SEQ-13, SEQ-14 and SEQ-15** from Appendix A. Header title: `SEQ-1x — <name>`. Meta: `Status: Proposed — Phase 3, not approved \| <WF/SM/UC IDs from §9>`. Annotation: the six bullets of that sequence in §9. |
| 36 | 06 | **Screenshot SEQ-11** `84:6991`. It was created but never inspected. |
| 37 | 04, 05, 06 | **Resize** leased sections `1:14`, `1:17` and `1:20` so they contain all their children, plus 120 px padding. Arrange the sequences in a 3-column grid below the matrix `10:858`. Touch no other section. |
| 38 | 04, 05, 06 | **Read back** `1:14`, `1:17` and `1:20` with `get_figjam`, and record the result in §12. |

## Appendix A — Mermaid ready to paste

**SEQ-03 v2 Deactivation + session revocation (AR-04)**
```
sequenceDiagram
    participant Owner
    participant API
    participant DB
    participant Worker
    participant EmployeeClient
    Owner->>API: POST /employees/id/deactivate with version
    API->>DB: Guard: not self, not last Owner (Proposed)
    API->>DB: Status deactivated, audit, outbox event, commit
    API-->>Owner: Deactivated, items flagged assignee inactive
    EmployeeClient->>API: Next request with old session
    API->>DB: Per-request account status check
    API-->>EmployeeClient: 401, access ends immediately
    Worker->>DB: J-03 relays account.deactivated
    Worker->>DB: MOD-identity ends all sessions, session.revoked
    Worker->>DB: At send time: reminders suppressed (C6, D6)
```

**ERD-5 v2 Cross-cutting**
```
erDiagram
    direction LR
    Employee ||--o{ Reminder : "recipient of"
    Employee ||--o{ NotificationDelivery : "recipient of"
    Employee |o..o{ AuditEvent : "acts in (null = System)"
    Employee ||--o{ ExportRecord : requests
    Employee ||--o{ IdempotencyRecord : submits
    Outbox |o..o{ Reminder : "plans via MOD-notifications"
    Outbox |o..o{ NotificationDelivery : triggers
    BackgroundJob |o..o| Outbox : "J-03 relays"
    Employee {
        uuid id PK
        string role
        string accountStatus
    }
    Reminder {
        uuid id PK
        string sourceType "follow_up / meeting"
        uuid sourceId
        int sourceVersion
        uuid recipientId FK
        datetime businessEventAt
        datetime triggerAt "job time, not event time"
        string state "scheduled / retry_pending / sent / failed / suppressed / cancelled"
        int attemptCount
    }
    NotificationDelivery {
        uuid id PK
        string eventType
        uuid recipientId FK
        string channel "unresolved"
        string result "sent / failed / suppressed"
        int attemptCount
    }
    Outbox {
        uuid eventId PK
        string eventName "A catalogue"
        string aggregateType
        uuid aggregateId
        string payload "ids only"
        datetime createdAt
        datetime relayedAt
    }
    BackgroundJob {
        uuid id PK
        string kind "J-01 to J-11"
        datetime runAt
        string state
        int attempts
        datetime leaseUntil
        string dedupeKey UK "job type + slot"
    }
    AuditEvent {
        bigint seq PK "append-only"
        datetime occurredAt
        uuid actorId FK "null = System"
        string actorRole
        string eventName
        string entityType
        uuid entityId
        string changes "never secrets"
    }
    ExportRecord {
        uuid id PK
        uuid requestedBy FK
        string format "xlsx / csv / pdf"
        string filters
        int rowCount
        string result "no file stored"
    }
    IdempotencyRecord {
        string key PK
        uuid actorId FK
        string operation
        string resultRef
        datetime expiresAt
    }
```

**SEQ-12 Reminder dispatch + retry**
```
sequenceDiagram
    participant Worker
    participant DB
    participant Access
    participant Email
    Worker->>DB: J-01 claims due reminder (skip locked)
    DB-->>Worker: Reminder R, source version 3
    Worker->>DB: Load follow-up, compare version and state
    Worker->>DB: Load recipient account status
    Worker->>Access: Recipient may see business now? (C6)
    Access-->>Worker: Allowed
    Worker->>Email: Send, provider key R plus attempt
    Email-->>Worker: Transient failure
    Worker->>DB: Retry pending, attempt 2, backoff
    Worker->>DB: Next run: claim again and re-check
    Worker->>Email: Send again
    Email-->>Worker: Accepted
    Worker->>DB: Sent, audit reminder.sent
```

**SEQ-13 Accepted-opportunity handoff**
```
sequenceDiagram
    participant Agent
    participant API
    participant Access
    participant DB
    participant Worker
    Agent->>API: POST call attempt: accepted, handoff
    API->>Access: Calling action allowed? (B7)
    API->>DB: Begin, lock reservation and calling state
    API->>DB: Open-deal check (DEC-017 pending)
    API->>DB: Insert attempt, outcome accepted, deal record
    API->>DB: Developer chosen? assignment, else not assigned
    API->>DB: Audit and outbox events, commit
    API->>DB: After commit: release reservation
    API-->>Agent: Accepted opportunity created
    Worker->>DB: J-03 relays developer_assigned event
    Worker->>Access: Developer may see deal? (DEC-005)
    Worker->>DB: J-02 sent, or suppressed and Owner sees
```

**SEQ-14 Closure + project provisioning**
```
sequenceDiagram
    participant Developer
    participant API
    participant Access
    participant DB
    participant Worker
    Developer->>API: POST finalize closure (deal version)
    API->>Access: Closure allowed? (DEC-006, DEC-005, R-12)
    API->>DB: Begin, lock deal, check version
    API->>DB: Guard: signature and payment recorded
    API->>DB: Stage closed, audit, outbox deal.closed, commit
    API-->>Developer: Closed deal
    Worker->>DB: J-03 relays deal.closed to MOD-projects
    Worker->>DB: F2 Alt Auto: insert project (unique deal)
    Worker->>DB: Audit project.provisioned
    Worker->>DB: On failure: J-07 retry, Owner sees pending
```

**SEQ-15 Authorized export (AR-05)**
```
sequenceDiagram
    participant Owner
    participant API
    participant Access
    participant DB
    Owner->>API: POST /exports (format, filters)
    API->>Access: Owner, active session, 2FA complete?
    Access-->>API: Allowed
    API->>DB: Same filters as screen, read-only snapshot
    API->>Access: scopeFilter and per-row check
    API-->>Owner: File streamed directly, nothing stored
    API->>DB: ExportRecord metadata, audit report.exported
```
