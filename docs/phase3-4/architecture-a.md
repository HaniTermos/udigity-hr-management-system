# Phase 3 — Architecture A: context, containers, modules, jobs, audit, deployment, traceability

| Field | Value |
|---|---|
| Author | Architecture Agent A |
| Date | 2026-10-20 |
| Status | **Proposed — Phase 3, not approved.** Nothing here is an approved business policy. |
| Brief | `docs/phase3-4/brief.md` (P34-1) |
| Baseline | Phase 2 approved (SB-3). Unresolved policies stay pending and are cited by DEC ID or "(no DEC ID)". |
| Board | Architecture board, FigJam `YKQi8IAz6sOGoLqwolHKPk`, sections 01, 02, 03, 07, 08, 09 |
| Companion | `docs/phase3-4/architecture-b.md` (Agent B: ERD, integrity constraints, authorization flow, SEQ-01..15, transaction matrix) |

**Revision A-2 (2026-10-20), after review `reviews/phase3-review.md` and brief §8 rulings AR-01..AR-10.** This revision applies AR-02, AR-03, AR-06, AR-07, AR-08 and AR-09, plus three optional minors from review §5. The Figma MCP quota is exhausted, so **the board still shows revision A-1**. Where the board and this document differ, this document is newer. §14 lists every board change that is pending.

**Revision A-3 (2026-10-20), after `reviews/reconciliation.md` and brief §8 rulings AR-11..AR-16.** Applied: AR-11, AR-13, AR-14, AR-15 and AR-16. Also fixed: the J-05 "exactly once" wording, `accepted_opportunity.created` declared audit-only, and the RX-13 filter mechanism. Documents only; the new board edits are in §14.6.

This document explains the diagrams. It does not repeat every label. Where Agent B owns a topic (the Access check decision flow, entity constraints, sequences), this document points to it and does not redefine it.

---

## 0. Board inventory (node IDs)

| Section (lease) | Item | Node ID |
|---|---|---|
| 01 System Context `1:5` | D01 System Context (wrapper) | `3:53` (diagram `4:2`, title `3:54`, meta `3:55`) |
| 02 Containers & Trust Boundaries `1:8` | D02 Containers & Trust Boundaries | `7:111` (diagram `6:53`) |
| | D02b Authenticated request path | `8:569` |
| 03 Modular Monolith `1:11` | D03a Domain module dependencies | `12:1273` |
| | D03b Platform and cross-cutting modules | `14:1330` |
| | T03 Module catalogue (table, 18 rows x 8 cols) | `33:2792` (title `33:3081`) |
| 07 Jobs, Notifications & Audit `1:23` | D07a Reminder scheduling and dispatch | `21:2064` |
| | D07b Scheduled jobs on PostgreSQL job tables | `23:2144` |
| | T07a Job catalogue (table) | `36:3622` (title `36:3621`) |
| | T07b Audit event catalogue (table) + audit design note | `36:3833` (title `36:3831`, note `36:3832`) |
| 08 Deployment & Recovery `1:26` | D08a Deployment topology | `25:2217` (diagram `24:2144`) |
| | D08b Release and migration procedure | `27:2294` |
| | D08c Backup, restore and restore verification | `29:2379` |
| | T08a Containers table | `38:4639` (title `38:4638`) |
| | T08b Backup scope table | `38:4769` (title `38:4768`) |
| 09 Traceability & Risks `1:29` | T09a ADR register | `39:4847` (title `39:4846`) |
| | T09b Traceability | `39:5077` (title `39:5076`) |
| | T09c Risk register | `39:5239` (title `39:5238`) |
| | T09d Readiness checklist | `39:5445` (title `39:5444`) |

Section sizes: I enlarged only my own sections, and only downwards (01 unchanged 8000x3000; 02 8000x4497; 03 8000x4626; 07 8000x6203; 08 8000x7362; 09 8000x5998). Widths stay 8000, so they don't overlap their neighbours. Rows sit 16 000 px apart, so the vertical growth stays clear of the row below.

---

## 1. System context (D01)

**What the diagram shows.** The four application roles reach one system through a single HTTPS entry. They are Owner/Admin (mandatory 2FA), Data Entry, Call Center and Developer, one role per employee. The system sends mail through an external email provider (password resets, credential setup, reminders, alerts). It also copies encrypted backups to an off-server destination.

**Why the operator is drawn separately.** The infrastructure operator is not an application role (brief §3). The operator never logs in to the application as an operator. They reach the host through SSH to deploy, migrate, back up and restore. The diagram shows this path as an orange dashed line through a separate entry point. If the operator is also an employee (for example the Owner), they use the application like any other employee, through HTTPS, with their own role.

**What is deliberately absent.**
- Telephony, social-media scraping and payroll/accounting (brief §3; ART-01 §1).
- Multi-tenancy: one company.
- A customer portal.

**Known rendering limitation.** The label "SSH: deploy, backup, restore" is placed by the layout engine near the Developer node, but the orange line clearly runs from the operator. I recoloured the operator connectors and added a legend line rather than regenerating.

---

## 2. Containers, trust boundaries and request handling (D02, D02b)

### 2.1 Containers

| Container | Role | Owns business logic? |
|---|---|---|
| Browser | Renders UI; holds only the session cookie | No |
| Reverse proxy | TLS termination, HTTP to HTTPS redirect, security headers. Routes `/` to Next.js and `/api` to Express, on **one origin** | No |
| Next.js web | Page rendering (server and client components), form UX, client-side validation for convenience only | **No.** Never queries PostgreSQL and holds no DB credentials |
| Express API | All domain modules, authentication, authorization, Access check, audit | **Yes, the only owner** (ADR-002) |
| Background worker | Same codebase and image as the API, started with a different command. Runs reminders, notifications, outbox consumers, scheduled checks | Runs module code, never its own rules |
| PostgreSQL | Business data, operational history, sessions, job/outbox tables, audit trail | — |
| Backup runner | Scheduled dumps, WAL archiving, encryption, upload, restore drills | No |
| Email provider (external) | Delivery of all outbound mail | No |
| Off-server backup storage (external) | Encrypted backup copies | No |

**Attachment storage is not included.** Deal agreement and payment evidence attachments are unresolved (DEC-018), so ADR-012 proposes adding a private volume or bucket only if DEC-018 approves attachments. Profile photos (ART-01 §3) are small. The proposal is to store a size-limited image as a database blob in MOD-employees, served through Express. This avoids a file store for one field. It is an implementation-level proposal and is easy to revisit.

### 2.2 Who owns logic and authorization; same-origin

- **Express owns everything that decides.** Business rules, state transitions, the Access check (WF-ACCESS-001), audit writing and email triggering all live in Express domain modules.
- **Next.js is presentation only.** When it renders on the server, it calls the Express API over the private network and forwards the user's cookie, so Express still makes every decision. No Next.js API routes or server actions implement business operations. This removes the "duplicated business APIs" risk the brief warns about.
- **Same origin.** The proxy serves the UI and the API under one host name. Consequences:
  - The session cookie is first-party and HttpOnly, Secure, SameSite=Lax (or Strict), with a host-only prefix.
  - CORS is not needed.
  - CSRF is mitigated three ways: SameSite, an Origin/Referer check on every mutating request, and a per-session CSRF token on mutations.

### 2.3 How sessions work (account state is not session state)

ADR-003 proposes **opaque, server-side sessions stored in PostgreSQL**, not JWTs:
- **Login** (WF-AUTH-001) creates a session row with state `Active` for non-Owner roles. For the Owner it is `Pending 2FA verification` (or `Pending 2FA enrollment`).
- **Every request** (D02b):
  1. Looks up the session.
  2. Checks its idle and absolute expiry.
  3. **Re-reads the account status** (SM-ACCOUNT-001).
  4. Applies the Pending-2FA restriction.
  5. Checks CSRF/origin for mutations.
  6. Then runs authorization: role/action first, then the Access check per resource.
- **Account state and session state stay separate.** A deactivated account is refused at step 3 even if a session row still says Active. Revocation (WF-EMP-001 M3, WF-AUTH-002) also marks the session rows Ended (reason revoked). If that write fails, the request-time account check still denies access, which satisfies WF-EMP-001's "refused at authorization time" requirement.
- **Pending 2FA scope is R-11 (→ USER).** D02b shows only the always-allowed set (submit factor, start recovery, logout) and labels everything else "pending R-11". Neither R11-a nor R11-b is selected.
- Durations, the 2FA method, lockout thresholds and the password policy are implementation decisions (ART-01 §3) and are listed in the readiness checklist.

**Why not JWT.** Deactivation and password reset must revoke access immediately. Stateless tokens would need a deny-list, which recreates server-side state. With ~6 users, one indexed lookup per request costs nothing.

### 2.4 Trust zones

1. **Untrusted:** employee devices and browsers.
2. **Public edge:** the proxy is the only container with published ports (443, plus 80 for redirect and the ACME challenge).
3. **Private Docker network:** web, api, worker, migrate and backup containers. No published ports.
4. **Private data zone:** PostgreSQL, never published, reachable only from the private network.

Separate database roles limit damage:
- `app`: no UPDATE/DELETE on the audit table.
- `migration`: DDL.
- `backup`: read and replication.

---

## 3. Modular monolith (D03a, D03b, T03)

### 3.1 Module list and naming

The brief's list maps to these modules. I added one module, MOD-access (justified below).

| Brief name | Module |
|---|---|
| identity | MOD-identity |
| employees | MOD-employees |
| (access evaluation) | **MOD-access** (added) |
| audit/admin | MOD-admin (audit trail + company/attendance settings) |
| attendance | MOD-attendance |
| targets/work | MOD-work |
| businesses | MOD-business |
| duplicates | MOD-duplicates |
| corrections | MOD-corrections |
| calling assignments | MOD-assignment |
| reservations | MOD-reservation |
| calls/follow-ups | MOD-calls |
| deals | MOD-deals |
| meetings | MOD-meetings |
| projects/tasks | MOD-projects |
| notifications | MOD-notifications |
| reports/exports | MOD-reports |
| (jobs, outbox, idempotency) | **MOD-platform** (added in A-2, AR-02) |

**MOD-platform (added in A-2, AR-02).** This module holds technical infrastructure only. It contains no business rules and no business data:
- **Jobs component:** the BackgroundJob table, the Outbox table, the scheduler and the outbox relay.
- **Request layer:** IdempotencyRecord (actor, operation, key → stored result), request/correlation ids, and the unit-of-work factory.

It is the named owner the review asked for, for BackgroundJob, Outbox and IdempotencyRecord.

**Why MOD-access is its own module.** Contract C5 requires one single definition of the Access check. Putting it inside MOD-identity would mix authentication with resource visibility. Putting it inside each domain module would create many definitions. MOD-access implements SM-VISIBILITY-001 once. Agent B (section 05) owns the decision flow it implements.

### 3.2 Boundary rules (ADR-006)

1. Each module owns its tables. The proposal is one PostgreSQL schema per module. No module writes another module's tables. Reads across modules go through the owner's public query operations, or through read-only views the owner publishes (for MOD-reports).
   - **One documented exception (AR-06, ADR-006/ADR-017 amendment):** MOD-access owns a read-only **access-facts view**. A migration owned by MOD-access creates it, and it selects the visibility facts directly from other modules' tables. The facts are assignment, follow-ups/callbacks, deal and project links, open correction requests, creation and R-07 timer events, and archive/deleted state.
   - This view is the single source for `scopeFilter` (list, search, calendar and export filtering in SQL, before count, sort and paging) and for per-resource `check`. One source keeps the two consistent.
   - It is read-only, so no module's data is ever written by MOD-access.
   - Any migration that changes a column the view reads must update the view in the same release. A contract test runs the VT-7 worked evaluations against both `check` and `scopeFilter`.
2. Modules call each other **in-process** through a public interface: one entry file per module, enforced by a dependency lint rule.
3. A user command runs in **one database transaction** (unit of work) created at the API edge and passed to each called module. Atomic multi-module saves therefore never need a shared table write. Examples (corrected per AR-03):
   - **WF-CALL-003.** One transaction holds: reservation token validated, call attempt, outcome, follow-up or D2 marker, deal record (E5), audit and outbox events.
     - The reservation is released in a **separate step after the save commits**.
     - If that release fails, nothing is lost: the reservation expires on its own (SM-RESERVATION-001).
   - **WF-CALL-001 reassignment.** One transaction holds: assignment change, follow-up transfer (MOD-calls operation invoked by MOD-assignment), audit and outbox events.
     - An Active reservation is a **precondition**: the Owner chooses Wait, or Owner override through WF-CALL-002, as a separate command.
     - The reassignment save never releases a reservation implicitly.
4. Side effects after commit (emails, reminders, project provisioning, session revocation follow-up) go through the **transactional outbox** (ADR-007).
5. **Dependencies form a directed acyclic graph.** D03a draws it. Three potential cycles were broken deliberately:
   - **Deals vs projects.** MOD-deals does not call MOD-projects. It emits `deal.closed` after commit, and MOD-projects consumes it. This also implements F3: closure stays committed if provisioning fails.
   - **Calls vs reservation.** MOD-calls orchestrates Start Contact: it checks outcome and access, then calls `reservation.acquire`. MOD-reservation never calls back into MOD-calls.
   - **Access vs everything (A-2, AR-06).** MOD-access no longer calls provider ports in domain modules. It reads its own read-only access-facts view (rule 1 exception), so it has no code dependency on any domain module. Domain modules call `access.check` and `access.scopeFilter`.
   - **Employees vs identity (AR-04).** MOD-employees does not call MOD-identity. It commits the status or role change plus an outbox event. Identity consumes `account.deactivated` and `account.role_changed` and revokes sessions asynchronously. Access ends at once anyway, because every request re-checks account status.
   - **Calls vs assignment (A-2, AR-07).** MOD-calls never calls MOD-assignment.
     - Calls learns the current assignee only through the Access check (assignment is a fact in the access-facts view).
     - Assignment-relevant outcome changes are published as the outbox event `call_outcome.changed`, which MOD-assignment consumes.
     - For reassignment, MOD-assignment invokes the MOD-calls operation `transferFollowUps(tx, …)`, so the edge runs one way only.
   - **Business vs duplicates (A-2, AR-02).** MOD-business owns the normalized match keys. MOD-duplicates is a stateless rule service (normalization and match classification per DEC-013) that reads and writes no tables.
     - MOD-business calls `duplicates.normalize` to compute the keys.
     - It then queries its own key index, including hidden records (C3).
     - It then calls `duplicates.classify` on the candidates.
     - MOD-duplicates never calls MOD-business.
   - **Admin vs attendance (A-2, AR-02 as reworded by AR-11).** AttendanceSettingsVersion is owned by MOD-attendance. The settings **screen** calls the MOD-attendance operation directly. MOD-admin has no code dependency on MOD-attendance, so MOD-attendance's use of `audit.record` creates no cycle.
   - **Business vs calls.** MOD-business may call `calls.initCallingState(tx, businessId)` in the creation transaction, so the outcome is explicitly Pending. NEW_LEAD is not stored (C-02). MOD-calls never calls MOD-business, so this edge is acyclic.

#### 3.2.1 Module dependency adjacency (A-2, AR-07)

"Depends on" means it calls a public operation of the module synchronously, or reads a view that module owns. Outbox consumption is not a dependency: the producer does not know its consumers.

Every module also depends on MOD-platform (unit of work, outbox writer, job enqueue, idempotency) and on MOD-admin (`audit.record`). Those two depend on nothing, so they are not repeated in each row.

| Module | Depends on (synchronous) | Consumes outbox events (async, not a dependency) |
|---|---|---|
| MOD-platform | — | — (runs the outbox relay) |
| MOD-admin | — | — |
| MOD-employees | — | — |
| MOD-identity | MOD-employees | `account.created`, `account.deactivated`, `account.role_changed` |
| MOD-access | MOD-employees; own access-facts view (reads other schemas read-only, AR-06) | — |
| MOD-duplicates | MOD-access (preview shaping per DEC-003) | — |
| MOD-reservation | MOD-access | — |
| MOD-deals | MOD-employees, MOD-access | — |
| MOD-calls | MOD-reservation, MOD-deals, MOD-access | — |
| MOD-business | MOD-duplicates, MOD-calls (`initCallingState`), MOD-access | — |
| MOD-corrections | MOD-business, MOD-access | — |
| MOD-assignment | MOD-calls (`transferFollowUps`, outcome read), MOD-reservation (read Active state only), MOD-employees, MOD-access | `call_outcome.changed` |
| MOD-work | MOD-assignment, MOD-employees, MOD-access | — |
| MOD-attendance | MOD-access (own-record checks) | — |
| MOD-meetings | MOD-deals, MOD-access | — |
| MOD-projects | MOD-deals (read), MOD-access | `deal.closed` |
| MOD-notifications | MOD-employees, MOD-access | All reminder and notification events (§4.6) |
| MOD-reports | Read-only query ports/views of all domain modules, MOD-access | — |

**No cycles.** The table is in topological order: every row depends only on rows above it, plus MOD-platform and MOD-admin. MOD-reports is a sink, and so is MOD-notifications (it is only consumed through the outbox). This replaces the edge list implied by D03a. D03a must be redrawn: see §14.

### 3.3 What D03a and D03b show

> **A-2 note:** the board diagrams are revision A-1. Where they differ from this text, §3.2.1 is authoritative:
> - D03a still shows MOD-assignment "releases reservation on reassignment" and MOD-business → MOD-duplicates "check and update match keys".
> - D03b still shows "reads visibility facts via provider ports".
>
> The corrections are listed in §14.

- **D03a** shows only domain-to-domain calls. Solid arrows are synchronous calls inside the caller's transaction. The dashed arrow is the after-commit `deal.closed` event (F2 provisioning trigger pending). Contract tags (B3, B8, E5) mark where an edge implements a Phase 2 contract:
  - MOD-work hands Call Center items to MOD-assignment (B8: only WF-CALL-001 writes assignments).
  - MOD-calls creates the deal record in the same save (E5).
- **D03b** shows how every domain module uses the platform:
  - MOD-identity for the current principal.
  - MOD-access per resource (C2).
  - MOD-admin to append an audit row in the same transaction.
  - The outbox for domain events.
  - MOD-notifications claims outbox and reminder rows and re-checks recipient status and access at send time (C6).
  - MOD-reports reads module query ports and filters export rows through MOD-access (C2), even for the Owner, so a later role extension cannot bypass it.

### 3.4 Module catalogue

The full catalogue is table T03 on the board. It has eight columns: responsibility and owned entities, public operations, dependencies, events/jobs, authorization duties, transaction boundary, and must-not-own. The essentials are below.

| Module | Owns (conceptual entities) | Key duties and limits |
|---|---|---|
| MOD-identity | Credentials, sessions, 2FA factor and recovery material, reset/credential-setup tokens, failed-login counters | Authentication only. Enforces the Pending-2FA restriction. Never exposes secrets. Does not own role, profile or status |
| MOD-employees | Employee profile, single role, account status, change history | Owner + 2FA. Last-Owner guard (Proposed). Open-items listing for deactivation (WF-EMP-001 M3) is composed at the API edge (A-2). The deactivation screen's endpoint queries each owning module's `openItemsFor(employeeId)` read operation, so MOD-employees calls no domain module and the graph stays acyclic. Never reassigns work automatically (WF-EMP-001) |
| MOD-platform | BackgroundJob, Outbox, IdempotencyRecord, scheduler state, worker heartbeat | Technical only. Idempotency on every write endpoint. Outbox relay (J-03). No business rules |
| MOD-access | Policy configuration placeholders (DEC-001/002/003/005); the read-only access-facts view (AR-06) | `check` and `scopeFilter` (SQL predicate for lists, search, calendars, exports), both evaluated on the access-facts view. Owner path R-01. No stored global visibility flag (C2) |
| MOD-admin | Audit trail (AuditEvent); non-attendance company settings, e.g. company name | Audit is INSERT-only. Hosts the settings screen, but attendance settings belong to MOD-attendance (AR-02) |
| MOD-attendance | Sessions, correction records beside originals, correction requests (only under DEC-011 Alt B), work summaries, **AttendanceSettingsVersion** (company timezone, working days, shift, grace, office IP/geofence, verification mode; WF-ADMIN-001) | One open session per employee. Office gating with no Owner exemption (F-04). Punctuality is derived, never stored as a state. DEC-026 alternatives are configuration branches, none selected. Settings edits require Owner + 2FA and apply to future sessions (Proposed). Other modules (e.g. reminders, reports) read the company timezone through MOD-attendance's query operation |
| MOD-work | Targets, work lists, allocation proposals | Progress is derived (DEC-020). Automatic allocation pending DEC-021. Never writes calling assignments (B8). No attendance gating (A1) |
| MOD-business | Business master data, phones, social accounts and manual metrics, website, notes, categories, edit history, **normalized match keys** (e.g. normalized phone, normalized name; the DR-8 unique index lives here) | Save, duplicate check, match keys, edit history and audit in one transaction. Deletion/archiving pending C-01. Does not own calling outcome or commercial stage |
| MOD-duplicates | **Nothing (stateless, AR-02).** Owns the matching rules: normalization, exact vs similar name, branches (DEC-013) | `normalize`, `classify`, `preview` (shaped per DEC-003 through MOD-access). Reads and writes no tables. The whole-database check (C3) runs on MOD-business's key index |
| MOD-corrections | Data-correction requests (SM-DATAFIX-001) | Applies changes only through MOD-business's edit command |
| MOD-assignment | Calling assignments and history | Only writer of assignments (B8). "Assigned but inaccessible" (B7) is derived. No automatic reassignment (R-02) |
| MOD-reservation | Reservation instances, lease, token/version | One Active per business. Expiry evaluated lazily on every read. A sweep job only records `expired`. Lease values pending DEC-004 |
| MOD-calls | Call attempts, business calling status (outcome + D2 marker), follow-ups | Access check on every calling action (B7). Writes no deal rows itself; asks MOD-deals |
| MOD-deals | Deal records: stage, handoff, developer attribute, signature/payment facts, closure, not-proceeding | Closure guard accepted + signed + paid. Authority pending DEC-006 / DEC-005 (R-12). No money fields until DEC-018 |
| MOD-meetings | Meetings, attendees, notes, reschedule history | Reminders via outbox. A failed reminder never changes the meeting |
| MOD-projects | Projects, tasks, milestones, project developer assignment | Idempotent provisioning per deal. Cardinality pending DEC-017. **One** task table (no duplicate work-item table) |
| MOD-notifications | Reminder instances, notification delivery records, templates; **in-app inbox read state** (A-3, AR-14, Proposed: a read flag / `readAt` per recipient notification) | System sends; Owner sees failures (D6). Never changes follow-ups or meetings (D5). Inbox operations: `listMine`, `unreadCount`, `markRead`, `markAllRead`. The list **re-checks access at read time** through `access.check`, so items about records the user can no longer access are hidden and not counted. The inbox exists only if in-app presentation is adopted (no DEC ID, WF-NOTIFY-001). Owner-only `sendAgain(reminderId)` (AR-13) |
| MOD-reports | **ExportRecord** (metadata only: actor, format, filters, row count, time; no file, AR-05); optional daily stock snapshots (OQ-17) | Owner + 2FA. Read-only towards domain data. G1 distinctions in every widget and export |

Other entities named by Agent B, for completeness (A-2):
- **MOD-calls:** OutcomeReopening and FollowUpChange.
- **MOD-deals:** DealDeveloperAssignment and ClosureReview (DEC-006 Alt B).
- **MOD-meetings:** MeetingChange.
- **MOD-projects:** ProjectChange and ProjectDeveloperAssignment.
- **MOD-identity:** SecurityToken, TwoFactorFactor, failed-login and rate-limit counters.

The separations the brief asks for are kept by ownership:
- **Account vs session:** MOD-employees vs MOD-identity.
- **Attendance state vs punctuality:** stored session state vs derived classification in MOD-attendance.
- **Assignment vs call outcome vs commercial stage:** MOD-assignment vs MOD-calls vs MOD-deals.
- **Follow-up vs reminder delivery:** MOD-calls vs MOD-notifications.
- **Project vs task lifecycle:** two state models inside MOD-projects, with separate status columns.
- **Visibility timer origin vs exception policy:** two independent configuration inputs of MOD-access (DEC-001, DEC-002).
- **Master data vs operational history:** MOD-business owns master data and edit history. Call attempts, follow-ups, deals, attendance and audit are owned elsewhere and are append-oriented.

**Reconciliation with Agent B.** Entity names in this document are conceptual. Agent B's ERD is authoritative for entity names and constraints. The readiness checklist (item 10) requires that every ERD entity has exactly one owning module from the list above.

---

## 4. Background processing, notifications and jobs (D07a, D07b, T07a)

### 4.1 Choice: PostgreSQL-backed jobs, no broker (ADR-004, ADR-005)

The worker shares the codebase and image with the API and runs as its own container. Work items are rows in PostgreSQL:
- **Reminder instances** are themselves the jobs (SM-REMINDER-001 state, `trigger_at`, attempt count, source version).
- **Notification deliveries** are rows without a state model (R-08).
- **Outbox rows** carry domain events.
- A **generic job table** holds recurring and retryable work.

Workers claim rows with `FOR UPDATE SKIP LOCKED` and a lease. A crashed run becomes claimable again when its lease expires.

**Justification:**
- Load is a handful of jobs per minute.
- Jobs are created in the same transaction as the business change, so a follow-up and its reminder plan commit or roll back together.
- Backups already cover the job tables.
- No extra service to secure and run.

Redis or a broker would add a second state store and a consistency gap without a measured need. Revisit only if measured latency or contention requires it.

### 4.2 Reminder scheduling, rescheduling and cancellation (D07a)

1. **Intake in the same transaction.** Saving a follow-up or meeting change writes the source row and an outbox event together. Nothing is planned for rolled-back changes.
2. **Planning** depends on the change type:
   - New: create a reminder (Scheduled).
   - Rescheduled, or responsible user / recipient changed (`follow_up.reassigned`): cancel pending reminders for that source, then create new ones.
   - Completed or cancelled: cancel pending reminders.
3. **Dispatch at trigger time.** The worker claims a due reminder and re-checks:
   - **Source version and open state.** If changed, the reminder is Cancelled as stale.
   - **Late run.** If the run happens after the business event time (worker downtime), the late-run policy decides: send labelled late, or skip. This is pending (B3-Q08, no DEC ID) and drawn as a yellow branch.
   - **Recipient account Active and recipient still passes the Access check** (C6). If not, the reminder is Suppressed.
4. **Send:**
   - Provider accepted: Sent.
   - Transient error: Retry pending with backoff. Each retry repeats the re-check.
   - Permanent error or retries exhausted: Failed.
5. **Failure visibility (D6).** Suppressed or Failed raises an Owner "notification-delivery failure" item. A loop guard stops failure-of-a-failure notifications.
6. **Independence (D5).** No delivery outcome changes, erases or blocks the follow-up or meeting.
7. **"Send again" (A-3, AR-13, Proposed).** Failed and Suppressed remain terminal (SM-REMINDER-001 unchanged).
   - On the delivery-failure monitor, the Owner (2FA complete) can choose **Send again** for a Failed or Suppressed reminder.
   - This creates a **new reminder instance** for the same source, with the current source version, the current recipient and trigger time = now. It goes through the normal dispatch path, including the full C6 re-check.
   - It is refused if the source is no longer open (follow-up or meeting completed or cancelled).
   - Audited as `reminder.scheduled` on the new instance, with the Owner as actor and a reference to the original instance. The name is Phase 2's; the actor and the link are Proposed.
   - There is no "Mark reviewed" action, because no backing field exists.

**Three times are kept apart** (ADR-009). Each is a separate field:
- The **business event time**: the follow-up or meeting time.
- The **job trigger time**: event time minus lead time. The lead time is pending (no DEC ID).
- The **delivery time**: when the provider accepted the message.

All are stored in UTC and interpreted in the company IANA timezone (setting from WF-ADMIN-001, DEC-007).

**At-least-once delivery.** If the worker crashes after the provider accepted a message but before recording Sent, the retry could send a duplicate. Mitigations:
- A per-reminder idempotency key passed to the provider, where it supports one.
- Otherwise, accept a rare duplicate (RISK-04).

### 4.3 Scheduled jobs (D07b, T07a)

A one-minute scheduler tick inside the worker computes due slots in company time. It inserts a job row keyed by (job type, slot) and ignores the insert if the row already exists. Restarts or a second worker therefore never run the same slot twice. Handlers are idempotent by job key.

| Job | Notes |
|---|---|
| J-01 Reminder dispatch, J-02 Notification dispatch, J-03 Outbox relay | See §4.2 |
| J-04 Attendance exception check (WF-ATT-003 Part 1) | Runs only on scheduled working days. Flags missing check-in after shift start + grace, and missing checkout after shift end. **Never auto-closes a session.** **Policy-gated:** without DEC-007, DEC-008 and DEC-022 it records "Not configured" instead of guessing. Thresholds and recipients are pending (F-05, no DEC ID). G1 holds: "not checked in" is never reported as absent unless it is a scheduled working day |
| J-05 Reservation expiry sweep | Correctness never depends on it: acquire/renew/save compare the lease expiry directly. **The `contact_reservation.expired` audit row is written exactly once, by whichever transaction flips the row from Active to Expired.** That is either an acquire that finds the lease lapsed, or this sweep. A conditional update guarantees a single writer (§4.6.2). The sweep covers reservations nobody touches again |
| J-06 Session expiry and cleanup | Request-time checks are authoritative |
| J-07 Project provisioning retry | Only under F2 Alt Auto. The Owner sees "Project provisioning pending" (F3) and can retry manually |
| J-08 Daily report snapshot (Proposed) | Needed only if period comparison of stock metrics is wanted (WF-REPORT-001 D3, OQ-17) |
| J-09 Worker heartbeat | Feeds `/health/worker`, which is separate from `/readyz` (A-2) |
| J-10 Backup | Run by the **backup container** on the VPS, not the app worker, so a broken app release cannot stop backups. It holds only the encryption public key (§6) |
| J-11 Restore drill | **Runs off the VPS (A-2, AR-08)**, in a separate restore environment (a small separate host or the operator's workstation). That environment holds the private decryption key, which never sits on the VPS |
| J-12 Retention purge (`platform.retention_purge`) | Purges technical rows past their retention: ended sessions, used tokens, completed jobs, processed outbox rows, idempotency records. Retention values are Agent B's Proposed windows, pending user decision. Never purges audit, operational history or business data |

**Failed jobs are visible.** Exhausted jobs become `dead` and appear in an Owner-visible "delivery and job failures" list, together with D6 delivery failures. Operators also see them in logs.

### 4.4 Re-checking recipient status and access at send time (C6, D5, D6)

MOD-notifications never trusts the state at scheduling time. At each send attempt it:
1. Reloads the recipient's account status (MOD-employees).
2. Calls `access.check(recipient, view, relatedBusiness)` (MOD-access).
3. Builds the message only from fields the recipient may see.

Choosing suppression over redaction when access fails follows Agent 3's proposal in WF-NOTIFY-001 and stays Proposed.

### 4.5 Exports: synchronous (ADR-010)

Exports (WF-REPORT-001) are generated **synchronously** in the API request and streamed to the Owner's browser. They are not stored on disk.

**Why:**
- Data volumes are small: one company, thousands of businesses at most.
- Exports are Owner-only.
- Storing generated files would create sensitive data at rest that needs its own retention and access rules.
- Synchronous generation also gives the "no partial file" behaviour naturally.

**Guardrails:**
- Row and time caps.
- `report.export_failed` audited on failure.
- `report.exported` recorded only after the file is fully produced.
- The same filters as on screen, passed through the MOD-access scope filter (C2).

**Revisit trigger:** if PDF generation exceeds the cap, switch to an async job and add stored-file retention. WF-REPORT-001 D4 already describes that variant.

An **ExportRecord** row (MOD-reports, metadata only) and the `report.exported` audit row are written after the file is fully produced. No file is ever stored (AR-05).

### 4.6 Canonical outbox-event and job catalogue (A-2, AR-09 — single catalogue, owned by Agent A)

**One mechanism per side effect:**
- **Cross-module side effects:** the command writes an **outbox event** in its transaction (MOD-platform Outbox). It never inserts rows owned by another module. The outbox relay (J-03) delivers each event to its registered consumers. Each consumer is idempotent per event id and creates its own rows: Reminder, NotificationDelivery, or a BackgroundJob of its own module.
- **Own-module deferred work:** a module may enqueue a BackgroundJob of its own kind in the same transaction, through `platform.jobs.enqueue(tx, kind, dedupeKey)`.
- **Event names = Phase 2 G2 audit names** wherever the fact already has one. The audit row and the outbox row are written together but are different records: audit is permanent, outbox rows are purged after processing (J-12).

#### 4.6.1 Outbox events and consumers

| # | Outbox event (producer) | Consumer → resulting work | Pending policy |
|---|---|---|---|
| E-01 | `account.created` (MOD-employees) | MOD-identity issues credential-setup token → MOD-notifications security email (family "security") | Setup method: implementation decision |
| E-02 | `account.deactivated`, `account.role_changed` (MOD-employees) | MOD-identity revokes all sessions (`session.revoked`); retried by the relay until it succeeds | — (AR-04) |
| E-03 | `password_reset.requested`, `password_reset.assistance_triggered` (MOD-identity; token created in the same tx) | MOD-notifications security email with the reset link; deduplicated by token id | Token duration: implementation decision |
| E-04 | `password_reset.completed`, `two_factor.recovery_succeeded` (MOD-identity) | Security confirmation email (Proposed) | Proposed only |
| E-05 | `follow_up.scheduled`, `.rescheduled`, `.reassigned`, `.completed`, `.cancelled` (MOD-calls) | **Reminder planner** in MOD-notifications creates or cancels Reminder rows (what Agent B called the "reminder-planning job") | Lead time, recipients, B3-Q08 (no DEC ID) |
| E-06 | `meeting.scheduled`, `.rescheduled`, `.cancelled`, `.held`, `.missed` (MOD-meetings) | Reminder planner (plans or cancels meeting reminders) | Same |
| E-07 | `calling_assignment.assigned`, `.reassigned` (MOD-assignment) | NotificationDelivery "new assignment" to the assignee | Timing, recipients (no DEC ID) |
| E-08 | `opportunity.developer_assigned`, `.developer_reassigned` (MOD-deals; also emitted inside the Accepted save) | NotificationDelivery "developer handoff" (Agent B's "handoff-notification job") | Same |
| E-09 | `data_correction_request.submitted` (MOD-corrections) | NotificationDelivery "data-correction request" | Recipients (Data Entry and/or Owner) |
| E-10 | `attendance_correction.submitted` (MOD-attendance) | NotificationDelivery "attendance correction awaiting review" to the Owner | Only if DEC-011 Alt B |
| E-11 | `attendance.checkout_provisional`, `attendance.checkout_pending_review` (MOD-attendance) | NotificationDelivery Owner review item (Agent B's "Owner review notification job") | Only if DEC-026 Alt B/C |
| E-12 | `attendance.missing_checkin_detected`, `attendance.missing_checkout_detected` (MOD-attendance, from J-04) — **placeholder names, not in Phase 2 G2; need approval** | NotificationDelivery missing check-in / missing checkout alerts | DEC-007/008/022, F-05 |
| E-13 | `deal.closure_requested` (MOD-deals) | NotificationDelivery Owner closure-verification item | Only if DEC-006 Alt B |
| E-14 | `deal.closed` (MOD-deals) | MOD-projects provisioning consumer (**F2 Alt Auto only**). Creates the project idempotently per deal. On failure: `project.provisioning_failed` + own job `projects.provision_retry` (J-07). This replaces Agent B's "insert provisioning job" in the closure transaction | F2, DEC-017 |
| E-15 | `project.provisioning_failed` (MOD-projects) | NotificationDelivery to the Owner (F3) | — |
| E-16 | `call_outcome.changed` (MOD-calls) | MOD-assignment (AR-07) updates queue eligibility, e.g. Rejected leaves normal calling (B1). Any effect on open follow-ups stays D4 policy | D4 (no DEC ID) |
| E-17 | `reminder.failed`, `reminder.suppressed`, `notification.failed`, `notification.suppressed` (MOD-notifications) | NotificationDelivery "notification-delivery failure" to the Owner (D6). The loop guard skips failures of this alert | Channel (no DEC ID) |

Security emails (E-01, E-03, E-04) are NotificationDelivery rows with family **security**:
- Account-status rule: no email to a deactivated account (WF-AUTH-002 R2).
- There is no business Access check, because they concern no business.
- They are excluded from `notification.*` report counts. Their audit is the `password_reset.*` / account event.

#### 4.6.2 Job kinds (BackgroundJob.kind, MOD-platform table; each kind owned by one module)

| Job | Kind | Owner | Trigger |
|---|---|---|---|
| J-01 | (Reminder rows, not BackgroundJob) | MOD-notifications | `trigger_at` due |
| J-02 | (NotificationDelivery rows) | MOD-notifications | Created by outbox consumers |
| J-03 | `platform.outbox_relay` | MOD-platform | Continuous poll |
| J-04 | `attendance.exception_check` | MOD-attendance | Scheduled, company time |
| J-05 | `reservation.expiry_sweep` | MOD-reservation | Every minute |
| J-06 | `identity.session_cleanup` | MOD-identity | Every 15 min |
| J-07 | `projects.provision_retry` | MOD-projects | After provisioning failure |
| J-08 | `reports.daily_snapshot` | MOD-reports | Daily (Proposed, OQ-17) |
| J-09 | `platform.heartbeat` | MOD-platform | Every minute |
| J-10 | (backup container, not an app job) | Operator | Container schedule |
| J-11 | (off-VPS restore environment, not an app job) | Operator | Schedule pending |
| J-12 | `platform.retention_purge` | MOD-platform | Daily |

**Reservation `expired` is written exactly once** (review minor). Whichever path first moves an elapsed Active reservation to Expired writes the state change and `contact_reservation.expired` in the same transaction: an acquire that finds it lapsed, or the J-05 sweep. A conditional update (`state = Active and expires_at < now`) guarantees exactly one writer.

**Direct commands that are not outbox events (A-3):**
- **`accepted_opportunity.created`** is **audit-only**. Per E5 (R-05), the deal record is created inside the same Accepted save, by MOD-calls calling `deals.createAcceptedOpportunity(tx)`. No consumer needs an event: the handoff notification is driven by `opportunity.developer_assigned` (E-08), whether the Developer is chosen in the same save or later. MOD-reports counts accepted opportunities from the deal records and this audit event (§5A), not from the outbox.
- **Reminder "Send again"** (AR-13) is a direct MOD-notifications command. It creates a new Reminder row in its own module, so no outbox event is needed.

Agent B references these names (E-xx, J-xx, kinds) and does not define others.

### 4.7 Asynchronous vs synchronous UI states (A-3, AR-15)

| Action | Mode | What the UI may show at save time | Later outcome surface |
|---|---|---|---|
| Report export (ADR-010) | **Synchronous, streamed** | An in-request progress state only ("Preparing download"). No "generating / ready later" list and no separate download step | The error is shown in the same request; `report.export_failed` is audited |
| Password reset / assistance email (E-03) | Asynchronous (outbox) | "Reset link queued", never "sent" | Delivery failure appears in the Owner delivery-failure list (E-17, D6) |
| Credential-setup email (E-01) | Asynchronous | "Invitation queued" | Same |
| Project provisioning under F2 Alt Auto (E-14) | Asynchronous | "Closed · project provisioning pending" (derived) | The project link appears once provisioned; failure shows "Project provisioning pending" to the Owner with retry (F3, J-07) |
| Reminders and notifications | Asynchronous | Only the source save result (the follow-up or meeting is saved) | Reminder state and delivery-failure monitor |
| Session revocation after deactivation (E-02) | Asynchronous, but access ends immediately via the request-time account check | "Deactivated" | No user-facing pending state needed |

---

## 5. Audit design (T07b)

- **One append-only audit table owned by MOD-admin.** Each owning module calls `audit.record` inside its own transaction, so a change and its audit row commit or roll back together. No audit is lost on crash, and no audit row exists for a rolled-back change.
- **Append-only by construction (G3):**
  - The application DB role has INSERT and SELECT only on the table.
  - No UPDATE or DELETE path exists in any API.
  - The audit explorer (WF-REPORT-002) is read-only.
  - Attempts to modify through any interface are refused. Their audit (Proposed) uses the existing `audit_log.access_denied`.
  - Optional tamper evidence, a per-row hash chain, is Proposed and not required.
- **Record fields (Proposed):**
  - Event name.
  - `occurred_at` (UTC).
  - Actor: employee id or System, plus the role held at that time.
  - Session id and request/correlation id.
  - Entity type and id.
  - Changed fields before/after, with secrets redacted.
  - Reason, where the workflow requires one.
  - Source workflow.
  - Client IP, for security events only.
- **Never stored:** passwords, reset tokens, 2FA secrets or recovery codes (WF-REPORT-002 security rule).
- **Edit history is not the audit trail.** Edit history (SB-2 §11) is visible to users who pass the Access check for the business and lives in MOD-business. The audit trail is Owner-only.
- **Correction semantics.** Attendance corrections are stored beside the original (WF-ATT-003), and deal facts removed in error stay in audit (WF-DEAL-002 B3). Corrections are new rows, never overwrites.
- **Catalogue.** T07b lists every event from the Phase 2 G2 tables of Batches 2, 3 and 4, grouped by owning module, with source workflow and report counting.
  - Batch 1 has no G2 table. Its names come from its transition tables (`attendance.*`, `attendance_correction.*`).
  - Two Batch 1 audit points have no name in Phase 2: the target save (WF-WORK-001) and the settings change (WF-ADMIN-001). I show them as **placeholders** `target.assigned` and `settings.updated`. Like all names, they need approval (G2).
- **Operational logs are separate from audit.** `contact_reservation.acquire_conflicted` and `.renewed` are operational logs (Agent 3 proposal), not audit rows.
- **Retention:** pending (OQ-19). Audit export: open (OQ-18). Optional `audit_log.viewed`: OQ-18. Owner reads of hidden records (`business_access.owner_viewed_hidden`) are audited only if OI-05 decides so.

---

## 5A. Dashboard metric catalogue (A-3, AR-16)

MOD-reports **only reads**. It uses each owning module's read-only query operation or view, never their tables directly. Definitions are copied from WF-REPORT-001's G1 table and SB-3 §11. "Snapshot" means the current state; "period" means events in the selected date range, in company time.

If a policy is missing, a metric shows "Not configured / policy pending", never zero (WF-REPORT-001 D2). Comparing stock metrics across past periods needs J-08 daily snapshots (OQ-17, Proposed); without them the comparison shows "not available".

| Metric (tile) | Definition | Source entity / event | Owning module (read op) | Pending |
|---|---|---|---|---|
| Total businesses / businesses added in period | Count of business records / `business.created` in period | Business; `business.created` | MOD-business | C-01 (archived excluded?) |
| Pending, On hold, Callback requests, Rejected businesses (snapshot) | Businesses whose current calling outcome is that value | BusinessCallingState | MOD-calls | "Callback requests" definition B3-Q11 |
| Unassigned businesses (snapshot), kept apart from Pending | Businesses with no open calling assignment | CallingAssignment | MOD-assignment | C-02 |
| **Accepted opportunities (snapshot, B-1)** | Deal records **currently** in stage "Accepted opportunity" (excludes Signed, Paid, Closed deal, Not proceeding). Not an outcome snapshot | Deal (stage) | MOD-deals | Stage names (no DEC ID) |
| Accepted in period vs Closed in period (G1) | `accepted_opportunity.created` in period (counted once) vs `deal.closed` in period | Audit events / Deal | MOD-deals (via audit) | DEC-006 |
| Closed deals (snapshot) | Deal records currently Closed deal | Deal | MOD-deals | — |
| Closed vs Completed project (G1) | `deal.closed` vs `project.status_changed` to Completed | Deal / Project | MOD-deals, MOD-projects | DEC-019 |
| Delivered vs Completed (kept apart) | Projects in Delivered vs Completed | Project status | MOD-projects | DEC-019 |
| Call attempts vs businesses contacted (G1) | Count of `call_attempt.logged` in period vs **distinct businesses** with ≥1 attempt in period | CallAttempt | MOD-calls | — |
| Businesses needing corrections | Distinct businesses with ≥1 open data-correction request | DataCorrectionRequest | MOD-corrections | — |
| Employees checked in / checked out (snapshot) | Open or closed session today | AttendanceSession | MOD-attendance | — |
| Not checked in vs absent on a scheduled day (G1) | No session right now (derived) vs missing check-in on a scheduled working day (J-04) | AttendanceSession + schedule | MOD-attendance | DEC-007, DEC-008, DEC-022 |
| Missing checkouts, late arrivals, recorded hours | Derived from sessions and settings | AttendanceSession, AttendanceSettingsVersion | MOD-attendance | DEC-007, DEC-008, DEC-022, DEC-026 |
| Assigned targets / target completion | Target value vs counted actions by their own timestamp (A2) | Target + source events | MOD-work | DEC-020, DEC-025 |
| **Development workload** (per Developer, three sub-counts, SB-3 §11) | (1) deal records in a non-terminal stage with them as assigned Developer; (2) projects in Scheduled, In progress, Waiting for client or Blocked with them assigned; (3) open tasks assigned to them. Assignment events are history only and not counted | Deal; Project; Task | MOD-deals; MOD-projects (projects, tasks) | DEC-019 |
| Reminder / notification delivery failures | `reminder.failed` and `reminder.suppressed`; `notification.failed` and `notification.suppressed`, reported separately. Security emails excluded | Reminder, NotificationDelivery | MOD-notifications | — |
| Revenue | **Not shown** until DEC-018 approves financial fields | — | — | DEC-018 |

**Cross-module list filters (A-3, RX-13).** A filter that uses another module's data is composed at the API edge, the same way as the deactivation open-items list. An example is the Data Entry business list filtered by correction status:
- The endpoint asks MOD-corrections for the business ids with open requests (read operation).
- It passes them to `business.search` as an id filter, together with `access.scopeFilter`.
- MOD-business never calls MOD-corrections, so the corrections → business edge stays one-way.

The Data Entry base scope (no DEC ID) is a pending input to `scopeFilter` step 5.

## 6. Deployment and recovery (D08a, D08b, D08c, T08a, T08b)

### 6.1 Topology (D08a, T08a)

Docker Compose runs on one VPS (ADR-011):
- `proxy`: public.
- `web`, `api`, `worker`, `migrate` (one-off), `db`, `backup`: private network only.

The host firewall allows 443, 80 (redirect and ACME) and SSH, with SSH restricted to key-only and ideally to known source addresses. The proxy obtains and renews the TLS certificate automatically through ACME. That edge is not drawn, because the architecture layout forbids proxy-to-external edges; the header notes it.

**Secrets.** DB role passwords, the session signing secret, the email provider key, storage credentials and the backup encryption key are injected at runtime from root-only files on the host (or Docker secrets). They never appear in images, compose labels, diagram labels, environment files in git, or logs. The backup container gets only the encryption **public** key; the private key is kept off the VPS.

**Persistence:**
- A named volume for the database.
- A certificate volume for the proxy.
- A short-retention staging volume for backups.

All app containers are stateless.

**Logs:** JSON to stdout with request ids, collected by Docker with size-based rotation. No request bodies, secrets or personal data in query strings.

**Health:**
- `/healthz` (liveness) on web and api.
- `/readyz` on api: database reachable and schema at the expected migration version. **A-2 (review minor):** worker health is no longer part of `/readyz`, so a worker outage cannot make the UI look down. It is reported separately at `/health/worker` (heartbeat age), which the uptime check monitors.
- `pg_isready` for db.
- Age of the last successful backup for the backup container.
- An optional external uptime check alerts the operator.

**Restart policy:** `unless-stopped` for long-running containers. The migrate container runs once per release.

### 6.2 Releases and migrations (D08b, ADR-014)

1. Images are built in CI and tagged by version.
2. On the VPS: pull, then take an on-demand backup and verify it before migrating. If verification fails, stop.
3. The one-off `migrate` container runs **forward-only, versioned migrations** with the migration role, each in its own transaction where PostgreSQL allows. A failed migration rolls back and the old version keeps running.
4. Restart api, worker and web. Then health/readiness checks and a smoke test: login, Owner 2FA, one read, worker heartbeat.
5. On failure, roll back the **images** to the previous tag. Destructive schema changes use expand-then-contract across two releases, so the previous image stays compatible and down-migrations are never needed. The restore procedure is used only if data was damaged.

No production SQL is part of Phase 3.

### 6.3 Backup and restore (D08c, T08b, ADR-013)

**Scope (T08b):**
- The whole PostgreSQL database: all module schemas, including operational history, audit, settings, reminders and jobs.
- The repository with compose and proxy config and the runbook, without secrets.

Secrets are held separately (operator's password manager or sealed offline copy) because a restore cannot start without them. TLS certificates are re-issued, and images are rebuildable. Deal attachments are not applicable unless DEC-018 approves them.

**Off-server destination proposal:** encrypted S3-compatible object storage with a different provider or region from the VPS, and versioned/immutable buckets where available.

**Method (proposal, parameters pending):**
- A scheduled base backup or logical dump.
- Continuous WAL archiving only if the chosen RPO needs it.
- Encrypt, checksum and upload.
- Alert the operator and Owner on any failure.

**Key custody (A-2, AR-08).** The VPS holds only the encryption **public** key. The private decryption key exists only in the **off-VPS restore environment**: a small separate host, or the operator's workstation with an encrypted disk. A sealed offline copy is kept with the other secrets. A compromised VPS therefore cannot read old backups.

**Restore verification (off the VPS, AR-08):**
- Scheduled drills (J-11) run in the restore environment, not on the VPS. Each drill:
  1. Fetches the latest backup (and WAL, if archived) from object storage.
  2. Decrypts it with the private key.
  3. Restores it into a scratch PostgreSQL container there.
- The drill checks migration level, row counts per module, the tail of the audit trail, and that the app image boots read-only against it.
- The result (pass/fail, timestamp, backup id) is reported to the operator and Owner. A missed or failed drill raises an alert.
- A backup that has never been restored is not counted as verified.

**Real restore:**
1. Owner and operator choose the restore point.
2. Stop api and worker and show a maintenance page.
3. In the restore environment, fetch and decrypt the backup, and the WAL if archived.
4. Restore. **If WAL archiving is enabled**, replay to the chosen point. Otherwise the restore point is the latest base backup (review minor).
5. Load the restored data into the production database. Either stream it over SSH from the restore environment, or temporarily provide the decrypted dump to a replacement VPS and delete it afterwards. The private key itself never goes to the VPS.
6. Verify, then restart.
7. Revoke all sessions: everyone logs in again, and the Owner repeats 2FA.
8. Tell users the data-loss window.

**RPO/RTO, retention and drill frequency are PENDING the user** ("Recovery objectives", no DEC ID). ART-11 D19 (nightly dump + WAL, 14/8/6 retention, RPO 15 min, RTO 4 h) is an **unapproved proposal** and is cited only as an option. OQ-12 (an Owner who cannot recover 2FA) needs a documented operator procedure. That procedure must verify identity outside the application and is also pending.

---

## 7. ADR register (all Proposed)

| ADR | Decision | Reason | Revisit when |
|---|---|---|---|
| ADR-001 | Modular monolith: one Express codebase, one image, two processes (api, worker) | Scale; brief constraint | — |
| ADR-002 | Express domain modules own business logic and authorization. Next.js is UI only. One origin through the proxy | No duplicated rules; single audit point | — |
| ADR-003 | Server-side sessions in PostgreSQL. Opaque HttpOnly/Secure/SameSite cookie. Idle + absolute expiry. Pending-2FA state. CSRF via SameSite + Origin + token | Immediate revocation | — |
| ADR-004 | No Redis or broker. PostgreSQL holds sessions, jobs, outbox, rate-limit counters | Tiny load; one store to back up | Measured contention |
| ADR-005 | Worker container on PostgreSQL job tables (SKIP LOCKED, leases, idempotent scheduler keys) | Transactional with business data | — |
| ADR-006 | Module-owned schemas; in-process public operations; one unit-of-work transaction per command; no cross-module writes; dependency lint. **Amended A-2 (AR-06):** one exception to cross-module reads, namely MOD-access's read-only access-facts view (§3.2 rule 1). **Amended A-2 (AR-03, AR-07):** the reservation release is never inside the call or reassignment transaction; dependencies follow the §3.2.1 adjacency table | Atomic multi-module saves without shared writes | — |
| ADR-007 | Transactional outbox for after-commit side effects | Nothing sent for rolled-back changes; F3 | — |
| ADR-008 | Append-only audit in the same transaction; INSERT/SELECT-only grants; no secrets | G3 | Retention decided (OQ-19) |
| ADR-009 | UTC storage; company IANA timezone; event / trigger / delivery times kept apart | WF-NOTIFY-001; DST safety | — |
| ADR-010 | Synchronous streamed exports, not stored, with caps | Small data; no sensitive files at rest | Cap exceeded |
| ADR-011 | Docker Compose on one VPS; only proxy public; runtime secrets | Brief; cost | Availability needs exceed one host |
| ADR-012 | No attachment storage until DEC-018 | Do not store unapproved data | DEC-018 decided |
| ADR-013 | Encrypted off-server backups; parameters pending. **Amended A-2 (AR-08):** the VPS holds only the public key; restore drills and decryption run in an off-VPS restore environment that holds the private key | Survive VPS loss; a compromised VPS cannot read old backups | RPO/RTO decided |
| ADR-014 | Forward-only migrations in a one-off container; backup first; expand/contract | Safe image rollback | — |
| ADR-015 | JSON logs, `/healthz`, `/readyz` (DB + schema only), `/health/worker` (heartbeat, separate since A-2), external uptime check | Sufficient for one VPS | Incidents show gaps |
| ADR-016 | Office verification inputs: client IP only from the trusted proxy header; browser geolocation treated as user-supplied evidence; mode per DEC-009 | Spoofing resistance | DEC-009 decided |
| ADR-017 | One MOD-access engine; operations `check` and `scopeFilter`; Owner path R-01. **Amended A-2 (AR-06):** both operations evaluate against a read-only access-facts database view owned by MOD-access (created by its migration), which replaces the provider ports. A VT-7 contract test covers both operations | C5; no leaks through lists, search, exports or notifications; SQL filtering before paging | — |
| ADR-019 (A-2) | MOD-platform owns BackgroundJob, Outbox and IdempotencyRecord. Cross-module side effects go only through outbox events; a module enqueues BackgroundJobs only for its own work. Catalogue in §4.6 (AR-09) | One mechanism per side effect; named owners (AR-02) | — |
| ADR-018 | Optimistic version checks on edits; database uniqueness for invariants (specifics owned by Agent B section 06) | "Save conflict" state required (ART-01 §18) | — |

---

## 8. Traceability (T09b)

| Workflow / model | Modules | Architecture elements | Diagram |
|---|---|---|---|
| WF-ATT-001, WF-ATT-002, SM-ATTENDANCE-001 | MOD-attendance, MOD-admin | ADR-016, ADR-009, ADR-008; DEC-026 branches as configuration | D03a |
| WF-ATT-003, SM-CORRECTION-001 | MOD-attendance, MOD-notifications | J-04, J-02 | D07b, D07a |
| WF-ADMIN-001 | MOD-admin | ADR-008, ADR-016 | D03b |
| WF-WORK-001 | MOD-work, MOD-assignment (B8) | ADR-006 | D03a |
| WF-BIZ-001..003, SM-DATAFIX-001 | MOD-business, MOD-duplicates, MOD-corrections | ADR-006, ADR-018 | D03a |
| WF-ACCESS-001, SM-VISIBILITY-001 | MOD-access + its access-facts view (A-2) | ADR-017 (amended), ADR-002 | D02b, D03b (flow: section 05) |
| WF-CALL-001, SM-ASSIGNMENT-001 | MOD-assignment | ADR-006, J-02 | D03a |
| WF-CALL-002, SM-RESERVATION-001 | MOD-reservation, MOD-calls | J-05, ADR-018 | D03a, D07b |
| WF-CALL-003, WF-REJECT-001 | MOD-calls, MOD-deals, MOD-reservation | ADR-006 (one transaction including the E5 deal record) | D03a |
| WF-FOLLOW-001, SM-FOLLOWUP-001 | MOD-calls, MOD-notifications | ADR-007, J-01 | D07a |
| WF-NOTIFY-001, SM-REMINDER-001 | MOD-notifications | ADR-005, ADR-007, ADR-009, J-01..J-03 | D07a |
| WF-DEAL-001, SM-MEETING-001 | MOD-deals, MOD-meetings, MOD-notifications | J-01 | D03a, D07a |
| WF-DEAL-002, SM-COMMERCIAL-001 | MOD-deals, MOD-projects | ADR-007, J-03, J-07 (F3) | D03a |
| WF-PROJ-001, SM-PROJECT-001, SM-TASK-001 | MOD-projects | — | D03a |
| WF-AUTH-001, WF-AUTH-002, SM-SESSION-001 | MOD-identity, MOD-notifications (email) | ADR-003, ADR-002, ADR-007 | D02, D02b |
| WF-EMP-001, SM-ACCOUNT-001 | MOD-employees, MOD-identity | Request-time status check; ADR-007 revocation follow-up | D02b, D03b |
| WF-REPORT-001 | MOD-reports, MOD-access | ADR-010, J-08 | D03b |
| WF-REPORT-002 | MOD-admin | ADR-008 | D03b |
| UC-REP-006 Backup | backup container | ADR-013, ADR-014, J-10, J-11 | D08a, D08c |

Every Phase 2 workflow and state model in the SB-3 inventory appears in at least one row.

---

## 9. Risk register (T09c)

| Risk | Description | L | I | Mitigation | Decision owner |
|---|---|---|---|---|---|
| RISK-01 | Visibility policies DEC-001/002/003/005 undecided; MOD-access cannot be finished | H | H | Policy placeholders; engine built against VT-7 worked evaluations | User |
| RISK-02 | Single VPS is a single point of failure | M | H | Off-server backups; restore runbook; agreed RTO | User (RTO) |
| RISK-03 | Backups never test-restored | M | H | Scheduled drills in the off-VPS restore environment with a verification checklist; alert on a missed drill (A-2, AR-08) | Operator |
| RISK-17 (A-2) | The private backup key is lost: no restore is possible | L | H | Sealed offline copy alongside the other secrets; key presence checked at every drill | Operator |
| RISK-18 (A-2) | Access-facts view drifts from the source schemas after a migration | M | H | Migration review rule; VT-7 contract test in CI on every release | Architect |
| RISK-04 | Duplicate reminder after worker crash between send and record | M | L | Idempotency key; accept rare duplicate | Architect |
| RISK-05 | Email deliverability (SPF, DKIM, DMARC, provider blocks) | M | M | Domain authentication; D6 failure visibility | Operator |
| RISK-06 | Office verification spoofing (forged headers, fake location) | M | M | ADR-016; DEC-009 mode; failed attempts audited | User (DEC-009) |
| RISK-07 | Module boundaries erode | M | M | Schema per module; dependency lint; review | Architect |
| RISK-08 | Owner locked out after losing 2FA (OQ-12) | L | H | Recovery codes; out-of-band operator procedure; possibly a second Owner (pending) | User |
| RISK-09 | Timezone/DST errors in attendance and reminders | M | M | UTC storage; IANA zone; DST tests | Architect |
| RISK-10 | Secrets leak via repo, image or logs | L | H | Runtime secret files; secret scanning; log redaction | Operator |
| RISK-11 | Hidden data leaks through lists, search, exports or notifications | M | H | All surfaces use the MOD-access scope (C2, C6); per-surface tests | Architect |
| RISK-12 | Synchronous PDF export too slow | L | L | Caps; switch to async | Architect |
| RISK-13 | R-10, R-11, R-12 unresolved affect identity and deals | M | M | Configurable branches; decide before build | User |
| RISK-14 | Audit growth with undefined retention (OQ-19) | L | M | Indexing; later partitioning; retention decision | User |
| RISK-15 | Single-operator knowledge | M | M | Runbook in repo; drill run by a second person | Owner |
| RISK-16 | VPS disk fills (DB, logs, backup staging) | M | H | Rotation; staging retention; disk alert | Operator |

---

## 10. Implementation-readiness checklist (T09d)

| # | Item | Status | Blocks build? |
|---|---|---|---|
| 1 | User reviews ADR-001..018 (accept or amend) | Open | Yes |
| 2 | Visibility: DEC-001, DEC-002, DEC-003, DEC-005 | Open | Yes (MOD-access) |
| 3 | Attendance: DEC-007..DEC-012, DEC-022, DEC-026 | Open | Partly (skeleton possible) |
| 4 | Notification timing, recipients, retry, escalation (no DEC ID) | Open | Yes (J-01/J-02 values) |
| 5 | Recovery objectives: RPO, RTO, retention, drill frequency (no DEC ID) | Open | Yes before go-live |
| 6 | C-01 deletion vs archiving | Open | Yes (delete paths) |
| 7 | DEC-006, DEC-017, DEC-018, F2, R-12 | Open | Yes (deals, projects) |
| 8 | R-10, R-11 | Open | R-11 yes (identity) |
| 9 | G2 event names approved, including placeholders `target.assigned`, `settings.updated` | Open | No |
| 10 | Agent B ERD: every entity owned by exactly one module | A side done in A-2 (§3.4 incl. MOD-platform, AR-02). Agent B renames per AR-01 and adds Outbox to its ERD | Yes, until B confirms |
| 16 | Placeholder outbox names `attendance.missing_checkin_detected` / `attendance.missing_checkout_detected` approved (G2) | Open | No |
| 17 | Off-VPS restore environment chosen (separate host or operator workstation) | Open | Yes before go-live |
| 11 | Providers chosen: VPS, email, object storage, domain/DNS | Open | Yes (deployment) |
| 12 | Office static IP known (if IP mode) | Open | Yes (if IP mode) |
| 13 | Implementation decisions: 2FA method, session durations, lockout, password policy | Open | Yes (identity) |
| 14 | Screen inventory mapped to modules (Phase 4 reconciliation) | Pending | No |
| 15 | Independent architecture review (RA) | Waiting | Yes |

---

## 11. Decisions that need the user

- Accept, amend or reject ADR-001..ADR-018. In particular:
  - Server-side sessions in PostgreSQL (ADR-003).
  - No Redis or broker (ADR-004).
  - Synchronous exports (ADR-010).
  - No attachment store until DEC-018 (ADR-012).
  - Off-server encrypted object storage for backups (ADR-013).
- Recovery objectives: RPO, RTO, backup retention, drill frequency (no DEC ID; ART-11 D19 is only a proposal).
- Notification timing, recipients, retry count/backoff, late/short-notice reminder policy (B3-Q08), and in-app presentation (no DEC ID).
- R-11 (Pending-2FA Owner scope). It affects the request pipeline in D02b.
- Whether profile photos may be stored as small database blobs (implementation proposal, §2.1).
- Hosting providers (VPS, email, object storage) and the office static IP (needed if DEC-009 selects IP mode).
- The unrecoverable Owner 2FA procedure (OQ-12), and whether a second Owner account should exist.
- (A-2) Where the off-VPS restore environment lives: a separate small host or the operator's workstation (AR-08).
- (A-2) Approval of the placeholder outbox names `attendance.missing_checkin_detected` / `attendance.missing_checkout_detected`, and the retention windows used by J-12.

All business-policy DECs referenced above (DEC-001..026, C-01, F2, R-10, R-12) stay **pending**. This document selects none of them.

---

## 12. Residual issues and notes for the orchestrator

- **No blocking contradictions** with Phase 2 were found.
- **Placeholders, not new IDs:** `target.assigned` and `settings.updated` (Batch 1 audit points without G2 names). Approval is needed under G2.
- **Added module MOD-access** beyond the brief's list (justified in §3.1). Agent B's section 05 defines its decision flow.
- **Cosmetic rendering defects I accepted** (none misleading after the fixes):
  - D01: the operator SSH label sits near the Developer node. Mitigated by orange operator connectors and a legend.
  - D02, D08a: the label "Reads and writes, one transaction per command" / "SQL, app role" overlaps another edge label near the email provider.
  - D02b: one diamond's text is truncated ("passes for th…"). The full text is in the readback.
  - D03a: the MOD-calls → MOD-reservation connector loops back over the MOD-calls box. Two repair attempts were made (spreading nodes, re-routing the deal.closed connector via bottom magnets). Labels are now readable; the loop remains.
  - D07a: the label "Rescheduled or recipient changed" overlaps the "Cancel pending reminders" box. The auto-coloured red/green Yes/No edges on the late-run decision were neutralised to grey so "No" is not read as failure.
  - Architecture-layout diagrams do not render subgraph titles (trust-zone names). The headers state the zones in text.
- **D08b placement fix:** D08b was first placed beside D08a, which widened section 08 to 8860 px and briefly overlapped section 09. I moved it below D08a and restored the width to 8000 px.
- **A-2 changes (rulings AR-02, AR-03, AR-06, AR-07, AR-08, AR-09):**
  - Added MOD-platform.
  - Moved AttendanceSettingsVersion to MOD-attendance, so the `settings.updated` placeholder for attendance settings is now emitted by MOD-attendance.
  - Moved match keys to MOD-business and made MOD-duplicates stateless.
  - Added ExportRecord to MOD-reports.
  - Corrected the reservation-release examples.
  - Replaced provider ports with the MOD-access access-facts view (ADR-006/017 amendments).
  - Added the adjacency table §3.2.1.
  - Moved the restore drill off the VPS (ADR-013 amendment).
  - Added the single outbox-event and job catalogue §4.6 (ADR-019).
  - Applied review minors: `/readyz` excludes the worker; WAL replay is conditional; `contact_reservation.expired` is written exactly once.
- **Settings wording (resolved by AR-11):** the settings screen calls the MOD-attendance operation directly. MOD-admin has no code dependency on MOD-attendance.
- **A-3 changes (rulings AR-11, AR-13, AR-14, AR-15, AR-16, plus two reconciliation fixes):**
  - AR-11 wording.
  - Reminder "Send again" (§4.2).
  - Conditional in-app inbox (§3.4, §4.4).
  - Async UI states (§4.7).
  - Metric catalogue (§5A).
  - J-05 "exactly once" wording.
  - `accepted_opportunity.created` declared audit-only (§4.6).
  - RX-13 correction-status filter mechanism (§3.2.1).
- **Orchestrator-created header text** in my sections (`1:7`, `1:10`, `1:13`, `1:25`, `1:28`, `1:31`, "Status: in progress") was left untouched.

---

## 13. Verification

**Created (FigJam, file `YKQi8IAz6sOGoLqwolHKPk`):**
- 10 diagrams: D01, D02, D02b, D03a, D03b, D07a, D07b, D08a, D08b, D08c. Each was generated with `generate_diagram` while holding the arch-board lock, wrapped in place in a new section with a header (title + Status/related IDs/pending DECs), and moved into my leased section. The lock was released after each batch of generations; it was never held by another agent when I tried to acquire it.
- 10 FigJam tables: T03, T07a, T07b, T08a, T08b, T09a, T09b, T09c, T09d. T07b also has an audit design text note.
- One failed generation attempt (D08a with a proxy→ACME edge) was rejected by the tool's validator and created no nodes. The D02b first attempt failed on a Mermaid parse error and created no nodes.

**Read back (`get_figjam`):**
- Sections 01, 02, 03 and 08: full XML read. It confirmed node hierarchy, shape texts, connector endpoints and labels, and all table cell contents for T03, T08a and T08b.
- Section 07: output saved to file. I verified it programmatically: 38 connectors, 35 shapes, and the expected sections and table structure. I did not read every table cell.
- Section 09: output saved to file. I verified table IDs, row/column counts (19x6, 20x4, 17x6, 16x4 = 360 cells, matching the read-back cell count) and titles. **I did not read the full cell text back.** Contents match the script input reproduced in §7–§10.

**Visually inspected (`get_screenshot`):**
- D01 (before and after recolouring).
- D02, D02b.
- D03a (three times, across two repair attempts).
- D03b.
- The commercial sub-area of D03a.
- Section 07 overview and D07a at high resolution.
- Section 08 overview, which covers D08a, D08b and D08c.
- Sections 03 and 09 overviews, the T03 table and the T08a table.

**Not visually inspected:**
- D07a after the Yes/No recolouring (the change was a stroke colour only; confirmed by script output).
- D07b at high resolution (seen only in the section overview).
- Note: after D03b was moved down to clear D03a, a section 03 overview screenshot confirmed there is no overlap.
- T07a, T07b, T08b, T09a–T09d at a resolution where cell text is legible (seen only in overviews).

**A-2 revision (documents only):**
- No Figma tool was called, because the quota is exhausted (orchestrator instruction).
- The board still shows revision A-1. None of the A-2 changes are on the board, read back or visually inspected; they are listed in §14.
- Agent B's `architecture-b.md` was read for job and event names only, and was not edited.

**No software was built or tested.** All behaviour described is intended behaviour.

---

## 14. Board updates pending quota reset (for the Figma operator)

All nodes are on board `YKQi8IAz6sOGoLqwolHKPk`. Table cell coordinates are (row, column), zero-based, with row 0 the header. "→" separates old text from new text. If a regenerated diagram is easier than editing connectors, regenerate inside the same wrapper under the arch-board lock and delete only the old A-1 diagram node named.

### Section 03 `1:11`

**D03a `12:1273`:**
1. Connector `11:1274` (MOD-assignment → MOD-reservation): "releases reservation on reassignment" → "reads Active reservation (Wait or Owner override, WF-CALL-002)".
2. Connector `11:1282` (MOD-calls → MOD-reservation): "validates token, releases after save" → "validates token in tx; release is a separate step after commit".
3. Connector `11:1266` (MOD-business → MOD-duplicates): "check and update match keys, same tx" → "normalize and classify (rules only; keys stay in MOD-business)".
4. Shape `11:1216`: "MOD-business: business master data, categories, edit history" → "MOD-business: business master data, categories, edit history, match keys".
5. Shape `11:1219`: "MOD-duplicates: normalized match keys, duplicate check" → "MOD-duplicates: matching rules only (stateless, DEC-013)".
6. Shape `11:1246`: "MOD-admin: company and attendance settings" → "MOD-attendance settings (AttendanceSettingsVersion)". Alternatively, delete the shape and connector `11:1250`, because attendance now owns its settings.
7. Connector `11:1250`: "reads schedule and office settings" → delete (the dependency no longer exists).
8. Add connector MOD-business (`11:1216`) → MOD-calls (`11:1226`): "initCallingState in creation tx".
9. Add connector MOD-assignment (`11:1223`) → MOD-calls (`11:1226`) label, replacing `11:1270`'s text: "reads outcome, moves follow-ups" → "transferFollowUps; outcome read".
10. Add a dashed connector MOD-calls → MOD-assignment: "event call_outcome.changed (outbox, async)".
11. Meta `12:1275`: append "Revision A-2: adjacency per architecture-a.md §3.2.1; reservation release after commit (AR-03); match keys in MOD-business (AR-02)."

**D03b `14:1330`:**
1. Connector `13:1315`: "reads visibility facts via provider ports" → "reads own read-only access-facts view (AR-06)". Better: re-point it so it no longer ends on "All domain modules", and add a cylinder "Access-facts view (owned by MOD-access, read-only)".
2. Shape `13:1287`: "MOD-admin: audit trail and settings" → "MOD-admin: audit trail (+ settings screen)".
3. Shape `13:1291`: "Outbox and job tables" → "MOD-platform: Outbox, BackgroundJob, IdempotencyRecord".
4. Meta `14:1332`: replace the sentence "To avoid a dependency cycle, it reads visibility facts … through provider ports that domain modules implement (dashed)." → "It evaluates check and scopeFilter on its own read-only access-facts view (AR-06, ADR-017 amended)."

**T03 `33:2792` (module catalogue):**
1. Insert a new row after row 0, MOD-platform. Cells, in column order:
   - "MOD-platform"
   - "BackgroundJob, Outbox, IdempotencyRecord, scheduler state, heartbeat"
   - "jobs.enqueue(tx, kind, key), outbox.write(tx, event), idempotency guard, unitOfWork"
   - "none (leaf)"
   - "J-03 outbox relay, J-09 heartbeat, J-12 retention purge"
   - "Technical only; no business rules"
   - "Joins caller's tx"
   - "Business data or rules"
2. Row 2 (MOD-employees), column 2: "…openItems (via provider ports)" → "…(open items composed at API edge from each module's openItemsFor)".
3. Row 3 (MOD-access), column 1: append "; read-only access-facts view (AR-06)". Column 3: "MOD-employees; visibility-fact provider ports implemented by domain modules" → "MOD-employees; own access-facts view (read-only)".
3. Row 4 (MOD-admin), column 1: "…company settings: timezone, working days, shift, grace, office IP/geofence, verification mode (WF-ADMIN-001)" → "Append-only audit trail; non-attendance company settings; hosts the settings screen".
4. Row 5 (MOD-attendance), column 1: append "; AttendanceSettingsVersion (timezone, working days, shift, grace, office IP/geofence, verification mode)". Column 3: "MOD-admin (settings)" → "MOD-access".
5. Row 7 (MOD-business), column 1: append "; normalized match keys (DR-8 unique index)".
6. Row 8 (MOD-duplicates):
   - Column 1 → "Stateless matching rules (normalization, exact/similar/branch per DEC-013); owns no tables".
   - Column 2 → "normalize, classify, preview per DEC-003".
   - Column 6 → "No tables; runs inside caller's tx".
7. Row 10 (MOD-assignment):
   - Column 3 → "MOD-calls (transferFollowUps), MOD-reservation (read only), MOD-employees".
   - Column 6: "Reassign + follow-up move + reservation release in one tx" → "Reassign + follow-up transfer in one tx; Active reservation = Wait or Owner override".
8. Row 12 (MOD-calls), column 6: "Attempt + outcome + follow-up/marker + deal record + reservation release in one tx" → "Attempt + outcome + follow-up/marker + deal record in one tx; reservation released after commit".
9. Row 17 (MOD-reports), column 1: append "; ExportRecord (metadata only, no file)".

### Section 07 `1:23`

**T07a `36:3622` (job catalogue):**
1. Row 3 (J-03), column 3 → "Delivers outbox events E-01..E-17 to consumers (architecture-a.md §4.6.1)".
2. Row 9 (J-09), column 3: "Updates heartbeat; readiness check reports a stale worker" → "Updates heartbeat; reported at /health/worker (not /readyz)".
3. Row 11 (J-11):
   - Column 0 → "J-11 Restore drill (off-VPS restore environment)".
   - Column 3 → "Fetch, decrypt with private key (never on VPS), restore into scratch container, verify".
4. Insert a row before the "Not a job: exports" row:
   - "J-12 Retention purge"
   - "Daily"
   - "-"
   - "Purges processed outbox, completed jobs, ended sessions, used tokens, idempotency records"
   - "-"
   - "Retry"
   - "ADR-019"
   - "Retention windows (pending)"

**New table T07c** "Outbox events and consumers (canonical, A-2)": place below T07b and enlarge section 07 downwards. Use columns # | Outbox event (producer) | Consumer → work | Pending policy, with the 17 rows E-01..E-17 copied verbatim from §4.6.1. Add a title text "T07c — Canonical outbox-event catalogue (AR-09; Agent B references these names)".

**T07b `36:3833`:** Row 5 (MOD-admin), column 1: "Settings change 'audited as a security setting change' (no name; placeholder settings.updated); …" → "audit_log.access_denied; audit_log.viewed (optional, OQ-18)". Row 3 (MOD-attendance), column 1: append "; attendance settings change (placeholder settings.updated, WF-ADMIN-001)".

**D07b `23:2144`:** No change required.

### Section 08 `1:26`

**D08a `25:2217`:**
1. Shape `24:2164`: "backup container: dump, WAL ship, restore drill" → "backup container: dump, WAL ship, encrypt with public key".
2. Meta `25:2219`: append "A-2: restore drills and decryption run in an off-VPS restore environment holding the private key (AR-08). /readyz excludes worker health."

**D08c `29:2379`:**
1. Shape `28:2304`: "Encrypt and checksum, key held off-server too" → "Encrypt with public key and checksum; private key only off-VPS".
2. Section `28:2323` name: "2. Restore drill, frequency pending" → "2. Restore drill in off-VPS restore environment, frequency pending".
3. Shape `28:2314`: "Restore latest backup into scratch container" → "Fetch and decrypt latest backup off-VPS, restore into scratch container".
4. Shape `28:2330`: "Fetch backup and WAL from object storage" → "In restore environment: fetch and decrypt backup, and WAL if archived".
5. Shape `28:2333`: "Restore database, replay WAL to chosen point" → "Restore database; replay WAL only if archiving enabled".
6. Meta `29:2381`: append "A-2 (AR-08): private key never on the VPS; drills off-VPS."

**T08a `38:4639`:**
1. Cell (3,4) api health: "/healthz liveness; /readyz = DB reachable + schema at expected migration + worker heartbeat fresh" → "/healthz liveness; /readyz = DB reachable + schema at expected migration; worker health at /health/worker".
2. Cell (4,4) worker: "Heartbeat row (read by /readyz) + container CLI check" → "Heartbeat row (read by /health/worker) + container CLI check".

**T08b `38:4769`:** Cell (3,2): "Kept separately in the operator's password manager / sealed offline copy" → "Kept separately (password manager / sealed offline copy); backup private key lives only in the off-VPS restore environment".

### Section 09 `1:29`

**T09a `39:4847` (ADR register):**
1. Row 6 (ADR-006), column 2: append "Amended A-2: one read-only exception, the MOD-access access-facts view (AR-06); reservation release never in the call or reassignment tx (AR-03); adjacency §3.2.1 (AR-07)".
2. Row 13 (ADR-013), column 2: append "Amended A-2: drills and decryption off-VPS; private key never on VPS (AR-08)".
3. Row 15 (ADR-015), column 2: "/healthz, /readyz; worker heartbeat" → "/healthz, /readyz (DB + schema), /health/worker".
4. Row 17 (ADR-017), column 2: "One MOD-access engine; facts via provider ports; list and export scope as SQL filters; Owner path R-01" → "One MOD-access engine; check and scopeFilter evaluated on its read-only access-facts view (AR-06); Owner path R-01".
5. Append a row:
   - "ADR-019"
   - "Platform jobs and outbox"
   - "MOD-platform owns BackgroundJob, Outbox, IdempotencyRecord; cross-module side effects only via outbox events; catalogue §4.6"
   - "One mechanism per side effect (AR-02, AR-09)"
   - "Direct job rows for other modules"
   - "-"

**T09b `39:5077`:** Row 6, column 1: "MOD-access + provider ports" → "MOD-access + access-facts view". Column 2: "ADR-017, ADR-002" → "ADR-017 (amended), ADR-002".

**T09c `39:5239`:**
1. Row 3 (RISK-03), column 4: "Scheduled restore drills with verification checklist" → "Off-VPS restore drills with verification checklist; alert on missed drill".
2. Append two rows:
   - RISK-17: "Private backup key lost" | Low | High | "Sealed offline copy; key presence checked at each drill" | Operator.
   - RISK-18: "Access-facts view drifts from source schemas" | Medium | High | "Migration review rule; VT-7 contract test in CI" | Architect.

**T09d `39:5445`:**
1. Row 10, column 2: "Pending reconciliation" → "A side done (A-2); B renames per AR-01".
2. Append two rows:
   - Row 16: "Placeholder outbox names attendance.missing_checkin_detected / missing_checkout_detected approved" | Open | No.
   - Row 17: "Off-VPS restore environment chosen" | Open | "Yes before go-live".

### All sections

After the edits:
- Enlarge sections 07 and 09 downwards only (width stays 8000) if the new rows or table overflow.
- Read back with `get_figjam` and take a screenshot of D03a, D03b, D08c and the changed tables.
- Then update §13 of this document.

### 14.6 Additional board edits from revision A-3 (AR-11..AR-16)

**Section 03 `1:11`, T03 `33:2792`:**
1. Row 16 (MOD-notifications):
   - Column 1: append "; in-app inbox read flag (Proposed, only if in-app presentation adopted, AR-14)".
   - Column 2: append "; listMine, unreadCount, markRead, markAllRead (read-time access re-check); sendAgain (Owner, AR-13)".
2. D03a meta `12:1275`: append "Settings screen calls MOD-attendance directly; MOD-admin has no code dependency on it (AR-11)."

**Section 07 `1:23`:**
1. T07a `36:3622`, row 5 (J-05), column 3: "Marks Expired and audits contact_reservation.expired" → "Marks lapsed reservations Expired; the expired audit row is written once by whichever tx flips the row (acquire or sweep)". Column 4: "None needed: lazy expiry check on every read is authoritative" → "Lazy check authoritative; conditional update = single writer".
2. T07a `36:3622`, row 1 (J-01), column 5: append "; Owner 'Send again' creates a new reminder instance (Failed stays terminal, AR-13)".
3. New table T07d "Async vs sync UI states (AR-15)" below T07c: copy the 6 rows of §4.7 verbatim.
4. T07c (new, from §14): add a footnote text under it: "accepted_opportunity.created is audit-only (E5: deal created in the same save); Send again is a direct command, not an outbox event".
5. D07a `21:2064` meta `21:2066`: append "Owner 'Send again' on Failed/Suppressed creates a new reminder instance (AR-13, Proposed)."

**Section 09 `1:29` (or section 07 if space is preferred):**
1. New table T09e "Dashboard metric catalogue (AR-16)": columns Metric | Definition | Source entity / event | Owning module | Pending, with the 17 rows of §5A copied verbatim, plus a title text "T09e — Dashboard metric catalogue (MOD-reports reads only)".
2. T09b `39:5077`: append row "WF-REPORT-001 metrics | MOD-reports (reads MOD-business, MOD-calls, MOD-assignment, MOD-deals, MOD-projects, MOD-corrections, MOD-attendance, MOD-work, MOD-notifications) | §5A, J-08 (OQ-17) | T09e".
