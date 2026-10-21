# Decision Pack — open choices before building

| Field | Value |
|---|---|
| Date | 2026-10-20 |
| Status | **For the user to answer. Nothing in this file is decided or approved.** |
| Sources | `phase2/shared-baseline.md` (SB-3), `phase2/reviews/batch5-integration.md` §(e), `phase3-4/architecture-a.md` §6.3, §7, §10, §11, `phase3-4/architecture-b.md` §10–§11, `phase3-4/reviews/reconciliation.md` §5, `decisions.md` (ART-11 D1–D20) and the Phase 2 batch specs where they record alternatives |
| Time | About 15 minutes. Tick a box or write a value on each **Your answer** line. Leave a line blank to keep it pending |

**How to read this file**
- **Alternatives** are copied as recorded. Board 01 recorded alternatives only for DEC-001, DEC-002, DEC-005 and DEC-026. Every other set comes from the Phase 2 specs, where the authors marked it *drafted* or *ART-01-derived*. A few questions have no recorded alternatives at all; for those this file says so and lists the options the documents mention.
- **"ART-11 Dn"** is an earlier AI proposal (Tier 4, unapproved). It is cited for reference only.
- **"Recommendation, not a decision"** is the pack author's suggestion. It selects nothing. Only your answer selects.
- **Where your answer goes:** Groups A, B and C below. The ADR table is part of Group A.

---

## Group A — Blocks building (foundation: access engine, identity, data model)

### A1. ADR acceptance (ADR-001..019, all Proposed; architecture-a §7)

Recommendation, not a decision: **accept all as written.** They fit a 5–6 person tool on one VPS, and none of them selects a business policy. ADR-012 and ADR-013 wait on DEC-018 and Group C by design.

| ADR | What it says (short) | Accept | Amend (note) |
|---|---|---|---|
| 001 | Modular monolith: one Express codebase, one image, two processes (api, worker) | ☐ | ☐ |
| 002 | Express modules own logic and authorization; Next.js is UI only; one origin behind the proxy | ☐ | ☐ |
| 003 | Server-side sessions in PostgreSQL; HttpOnly cookie; idle + absolute expiry; Pending-2FA state; CSRF protection | ☐ | ☐ |
| 004 | No Redis or broker; PostgreSQL holds sessions, jobs, outbox, rate limits | ☐ | ☐ |
| 005 | Worker on PostgreSQL job tables (SKIP LOCKED, leases, idempotent keys) | ☐ | ☐ |
| 006 | Module-owned schemas, no cross-module writes, one transaction per command (amended: access-facts view; adjacency table) | ☐ | ☐ |
| 007 | Transactional outbox for after-commit side effects | ☐ | ☐ |
| 008 | Append-only audit in the same transaction; insert/select-only grants; no secrets | ☐ | ☐ |
| 009 | Store UTC; company IANA timezone; event/trigger/delivery times kept apart | ☐ | ☐ |
| 010 | Exports synchronous and streamed, never stored, with caps | ☐ | ☐ |
| 011 | Docker Compose on one VPS; only the proxy is public; runtime secrets | ☐ | ☐ |
| 012 | No attachment storage until DEC-018 | ☐ | ☐ |
| 013 | Encrypted off-server backups; VPS holds only the public key; restore drills off the VPS; parameters from Group C | ☐ | ☐ |
| 014 | Forward-only migrations in a one-off container; backup first; expand/contract | ☐ | ☐ |
| 015 | JSON logs; `/healthz`, `/readyz`, `/health/worker`; external uptime check | ☐ | ☐ |
| 016 | Office check: client IP only from the trusted proxy header; geolocation is user-supplied evidence; mode per DEC-009 | ☐ | ☐ |
| 017 | One access engine (`check`, `scopeFilter`) over a read-only access-facts view; Owner path R-01 | ☐ | ☐ |
| 018 | Optimistic version checks on edits; database uniqueness for invariants | ☐ | ☐ |
| 019 | MOD-platform owns jobs, outbox and idempotency; cross-module side effects only via outbox | ☐ | ☐ |

**Your answer:** ☐ Accept all ☐ Accept all except the rows marked Amend

---

### A2. DEC-001 — 15-Day Policy Trigger Basis
- **Question:** What starts, and what resets, the 15-day timer that hides a business from a non-owner?
- **Alternatives (Board 01):**
  - **Alt A:** creation-based, no reset.
  - **Alt B:** inactivity-based; resets on a call attempt or a scheduled callback (events `call_attempt.logged`, `follow_up.scheduled`; edits and notes never reset, R-07).
  - (ART-11 D9 proposes a third option, a per-user timer from creation or assignment. It is not a Board alternative.)
- **Recommendation, not a decision:** Alt A. It is predictable and cannot be gamed by artificial resets (Board risk note), and DEC-002 exceptions keep active work visible.
- **Affects:** MOD-access (access-facts view; Alt B needs `lastTouchpointAt`), WF-ACCESS-001, SM-VISIBILITY-001, every list/search/export.
- **Your answer:** ☐ Alt A ☐ Alt B ☐ Other: ______

### A3. DEC-002 — Active-Work Visibility Exceptions (6 rows)
- **Question:** Which kinds of active work keep a business visible after day 15, and to whom?
- **Alternatives (Board 01, per row; Table VT-5):**

| Row | Fact | Alt A | Alt B | Your pick |
|---|---|---|---|---|
| 1 | Accepted opportunity | Hidden day 16 unless extended | Exempt (assigned Developer and Call Center) | ☐ A ☐ B |
| 2 | Closed deal | Hidden day 16 unless extended | Exempt (Developers company-wide, Owner; closed-deal list only) | ☐ A ☐ B |
| 3 | Active project | Hidden day 16 unless extended | Exempt (project board) | ☐ A ☐ B |
| 4 | Completed project | Hidden day 16 | Hidden 15 days after delivery | ☐ A ☐ B |
| 5 | Scheduled callback | Hidden day 16 | Exempt until callback date-time + 48 h | ☐ A ☐ B |
| 6 | Open data-correction request | Hidden day 16 | Exempt in the correction queue (Data Entry) until resolved | ☐ A ☐ B |

- Note: "unless extended" (rows 1–3 Alt A) has no mechanism and no DEC ID (OI-06).
- **Recommendation, not a decision:** Alt B on every row. Without it, people lose records they are actively working on, and Alt A's "extended" path does not exist.
- **Affects:** MOD-access, Table RT resource types, the Developer deals screen (RX-B1), the correction queue (RX-B2), calendar, notifications.
- **Your answer:** ☐ Alt B all rows ☐ As ticked in the table

### A4. DEC-005 — Developer Scoping Access to Accepted Opportunities (+ R-12)
- **Question:** Can a Developer see an accepted opportunity before the deal closes?
- **Alternatives (Board 01):**
  - **Alt 1:** assigned scoping access (the assigned Developer only; read-only contact and notes).
  - **Alt 2:** closed-deal-only.
- **R-12 (→ USER):** Alt 2 conflicts with "Owner and Developer record signature/payment" [Confirmed: REQ-PROJ-004] and makes DEC-006 Alt A impossible. Choosing Alt 1 removes the conflict. If you choose Alt 2, also say who records signature and payment before closure.
- **Recommendation, not a decision:** Alt 1. The Developer must run the discovery meeting, and Alt 1 avoids the R-12 conflict.
- **Affects:** MOD-access, MOD-deals, MOD-meetings, SEQ-13/14, the Developer deals screen (RX-B1), OQ-02 meeting context.
- **Your answer:** ☐ Alt 1 ☐ Alt 2, and before closure signature/payment is recorded by: ______

### A5. R-11 — What may an Owner session do while waiting for 2FA?
- **Alternatives (recorded readings):**
  - **R11-a:** all business access waits for 2FA (nothing until 2FA).
  - **R11-b:** only administrative actions wait (non-admin actions such as check-in are allowed).
- **Recommendation, not a decision:** R11-a. It gives one simple rule in the request pipeline, and the Owner's 2FA step takes seconds.
- **Affects:** MOD-identity, request pipeline (D02b step 2b), SM-SESSION-001, Owner check-in.
- **Your answer:** ☐ R11-a ☐ R11-b

### A6. C-01 — Business deletion vs archiving (no DEC ID)
- **Question:** Can the Owner permanently delete a business, or only archive it? (Data Entry never deletes: Confirmed.)
- **Alternatives (architecture-b §10):**
  - **Alt archive:** status + who/when; archived rows are still duplicate-checked and excluded from calling (B4).
  - **Alt Owner hard delete:** allowed only with an explicit design for its operational history (attempts, follow-ups, deals, projects).
  - (ART-11 D20 proposes archive-only for businesses, employees, deals and categories.)
- Related, also open: employee deletion (the architecture offers deactivate only) and category removal (drafted Alt CR-1 deactivate / CR-2 delete only if unused).
- **Recommendation, not a decision:** Alt archive, with categories CR-1 deactivate. ART-01 §2.1 says full access must not silently become permanent deletion of history.
- **Affects:** MOD-business foreign-key rules (IC-27), delete paths, duplicate check, calling eligibility, Owner business screens.
- **Your answer:** ☐ Archive ☐ Owner hard delete  · Categories: ☐ CR-1 ☐ CR-2

### A7. DEC-017 — Multiple Deals / Services per Business
- **Question:** Can one business have more than one open deal at the same time?
- **Alternatives (recorded branches, Batch 4 WF-DEAL-001 A9; not Board alternatives):**
  - **Multiple concurrent deals allowed:** a new deal record is created.
  - **Single open deal only:** no new record; the user is shown the existing open deal.
  - (ART-11 D17 proposes many deals over time, at most one open at a time, at most one project per closed deal.)
- Also covers B6: can a business be re-queued for calling after a deal ends as "not proceeding"?
- **Recommendation, not a decision:** single open deal at a time, multiple over time. It keeps one clear commercial thread per client and still allows repeat business.
- **Affects:** data model cardinality (IC-20), SEQ-13, WF-CALL-003 Accepted path, project cardinality, re-queue (B6).
- **Your answer:** ☐ Single open only ☐ Multiple concurrent  · Re-queue after not proceeding: ☐ yes ☐ no

---

## Group B — Needed before a specific module is built

### B1. DEC-003 — Hidden Record Match Revelation Scope *(before MOD-business / MOD-duplicates)*
- **Question:** When a duplicate block hits a record the user cannot see, what does the message reveal?
- **Alternatives:** none recorded on Board 01. The documents mention:
  - (i) existence only: "already exists", no id and no fields (current architecture baseline, SEQ-08);
  - (ii) ART-11 D10: the matched field plus name, category and date created;
  - (iii) a "Request escalation" action (in UC-BIZ-003; not modelled anywhere).
- **Recommendation, not a decision:** (i). It leaks nothing, and in a company this small the user can ask the Owner directly.
- **Affects:** duplicate-blocked screen (RX-B3), SEQ-08 payload, audit `business.hidden_match_revealed` / `business.escalation_requested`.
- **Your answer:** ☐ (i) ☐ (ii) ☐ (iii) as well ☐ Other: ______

### B2. DEC-013 — Name-Only Duplicate Blocking & Branch Handling *(before MOD-business)*
- **Alternatives (drafted, Batch 2):**
  - Name: **NM-A** exact normalized name blocks / **NM-B** exact name blocks unless a branch differs (needs a branch field not in ART-01) / **NM-C** a name-only match warns and does not block.
  - Similar names: **SN-1** non-blocking warning / **SN-2** not checked.
- **Recommendation, not a decision:** NM-B + SN-1. Real chains have branches, and a warning catches typos without blocking. (Phone blocking stays Confirmed; check OI-14 if branches share a phone.)
- **Affects:** MOD-duplicates, unique indexes, business form (branch field), duplicate screens.
- **Your answer:** ☐ NM-A ☐ NM-B ☐ NM-C  · ☐ SN-1 ☐ SN-2

### B3. B2 — Is a phone mandatory when creating a business? (no DEC ID) *(before MOD-business)*
- **Alternatives (drafted):** **PH-1** mandatory / **PH-2** optional; the business is then "not eligible for calling" until a phone exists.
- Also needed: the default country code for phone normalization.
- **Recommendation, not a decision:** PH-2. ART-01 requires a social account, not a phone, and businesses found on social media often have no listed number.
- **Affects:** business form validation (VR-5), calling eligibility, queue.
- **Your answer:** ☐ PH-1 ☐ PH-2  · Country code: +____

### B4. DEC-015 — Category Management Authority *(before categories)*
- **Alternatives (drafted):** **CA-A** Owner only / **CA-B** Data Entry may also create (rename and removal stay with the Owner) / **CA-C** Data Entry suggests, Owner approves.
- **Recommendation, not a decision:** CA-A. It prevents near-duplicate categories, and the Owner is always available in a team this size.
- **Affects:** WF-BIZ-003, categories screen (DE-007), permissions.
- **Your answer:** ☐ CA-A ☐ CA-B ☐ CA-C

### B5. DEC-011 — Attendance Correction Authority *(before MOD-attendance)*
- **Alternatives (recorded in Batch 1):**
  - **Alt A, Owner-only:** the Owner enters corrected times and a reason.
  - **Alt B, employee request:** the employee submits; the Owner approves or rejects with a reason (adds SM-CORRECTION-001).
  - The Owner's direct adjustment is Confirmed in both. F-01: under Alt B, a pending request may block next-day check-in.
- **Recommendation, not a decision:** Alt B. The employee knows the real times, and the Owner still decides.
- **Affects:** WF-ATT-003, SM-CORRECTION-001, correction screens, Owner review queue.
- **Your answer:** ☐ Alt A ☐ Alt B

### B6. DEC-022 — Weekly Rest Days & Scheduled Days Off *(before MOD-attendance)*
- **Alternatives:** none recorded. It needs company values. ART-11 D1 proposes one company schedule with no per-employee overrides in v1.
- **Recommendation, not a decision:** one company-wide schedule plus a holiday list for v1; per-employee days off later. It covers a 6-person office with the least setup.
- **Affects:** missing check-in alerts, "absent vs not checked in" reports (G1), targets.
- **Your answer:** Working days: ______ · Holidays tracked? ☐ yes ☐ no · Individual days off in v1? ☐ yes ☐ no

### B7. DEC-026 — Failed Checkout Handling Policy *(before MOD-attendance)*
- **Alternatives (recorded):** **Alt A** blocked / **Alt B** closed provisionally, with an Owner review item / **Alt C** held for Owner review (pending review).
- Open sub-question under Alt C: does a pending-review session block the next check-in?
- **Recommendation, not a decision:** Alt B. The session is never left open, and the Owner still reviews it.
- **Affects:** SEQ-05, SM-ATTENDANCE-001 states, check-out screen, Owner review list.
- **Your answer:** ☐ Alt A ☐ Alt B ☐ Alt C (blocks next check-in? ☐ yes ☐ no)

### B8. DEC-016 — Rejected Record Reopening Authority *(before calling)*
- **Alternatives:** none recorded on Board 01. The documents mention Owner only (ART-11 D14, with a reason; outcome returns to Pending) and a request-and-approve model (B3-Q09, not modelled).
- **Recommendation, not a decision:** Owner only, with a mandatory reason, outcome back to Pending. It needs no new request workflow.
- **Affects:** WF-REJECT-001, reopen screen (CC-008).
- **Your answer:** ☐ Owner only ☐ Request and approve ☐ Other: ______ · Outcome after reopening: ______

### B9. R-10 — Calling-outcome rules: new state model or table? *(before calling)*
- **Alternatives:** approve a new ID `SM-OUTCOME-001` / keep the rules as a table inside WF-CALL-003 (current).
- **Recommendation, not a decision:** keep the table. Neither choice changes data, and the table avoids reopening the approved inventory.
- **Affects:** documentation only (WF-CALL-003).
- **Your answer:** ☐ Table ☐ SM-OUTCOME-001

### B10. DEC-006 — Authority to Record or Approve Commercial Closure *(before MOD-deals)*
- **Alternatives (from ART-01 §12 wording; not Board alternatives):**
  - **Alt A, Developer finalizes directly:** Developer or Owner selects Finalize closure.
  - **Alt B, Owner verification required:** Developer requests verification; the Owner verifies and finalizes, or rejects with a reason.
- **Recommendation, not a decision:** Alt B. Closure drives revenue reporting, and Owner review costs little at this volume.
- **Affects:** WF-DEAL-002, SM-COMMERCIAL-001, ClosureReview, Developer and Owner deal screens (RW-04).
- **Your answer:** ☐ Alt A ☐ Alt B

### B11. DEC-018 — Financial Field Governance & Evidence *(before MOD-deals)*
- **Alternatives:** none recorded. The open sub-questions are below. (ART-11 D16 proposes: a deposit counts; agreement reference + payment date as evidence; optional amount + currency; no file attachments in v1.)
- **Recommendation, not a decision:** a deposit counts; optional amount + currency; no attachments in v1 (keeps ADR-012). This makes revenue reporting possible without storing documents.
- **Affects:** deal form, closure guard, reports, backup scope (attachments).
- **Your answer:** Deposit counts as payment? ☐ yes ☐ no · Amount + currency fields? ☐ yes ☐ no · Attachments in v1? ☐ yes ☐ no

### B12. F2 — Project provisioning trigger *(before MOD-projects)*
- **Alternatives (recorded):** **Alt Auto** the system creates the project board at verified closure / **Alt Manual** Owner or Developer creates it later ("Closed deal without project" shows to the Owner).
- **Recommendation, not a decision:** Alt Auto. No closed deal is forgotten, and a failure is already visible to the Owner (F3).
- **Affects:** SEQ-14, job J-07, closure success screen (DEV-008), Owner overview.
- **Your answer:** ☐ Auto ☐ Manual

### B13. Notification timing, recipients and retry (no DEC ID) *(before MOD-notifications)*
- **Alternatives:** none recorded. ART-11 D18 is the only concrete proposal (all times configurable):

| Event | Recipient (D18) | When (D18) |
|---|---|---|
| Follow-up digest | Agent | Daily at shift start |
| Follow-up due | Agent | 15 min before |
| Follow-up overdue | Agent; Owner in daily digest | 1 h after due |
| Meeting upcoming | Assigned Developer + Call Center agent | 24 h and 1 h before |
| Missing check-in | Owner | Shift start + grace + 30 min (working days) |
| Missing checkout | Employee; Owner | Employee at shift end + 1 h; Owner next-morning digest |
| New assignment / developer handoff | Assignee | Immediately |
| Correction request (data / attendance) | Data Entry + Owner / Owner | Immediately |
| Notification delivery failure | Owner | In-app, immediately |

- Also open: retry count and backoff; late or short-notice reminders (B3-Q08); whether there is an **in-app notification list** at all (RX-02).
- **Recommendation, not a decision:** accept the D18 table as the starting configuration, with an in-app list and 3 email retries. It is already configurable, so values can be tuned later.
- **Affects:** jobs J-01/J-02, MOD-notifications, notifications screen (SHR-007), delivery monitor (OWN-012).
- **Your answer:** ☐ D18 table as is ☐ With changes: ______ · In-app list? ☐ yes ☐ no · Retries: ____

---

## Group C — Can wait (needed before go-live, not before coding)

### C1. Recovery objectives (no DEC ID; ADR-013)
- **Alternatives:** none recorded. ART-11 D19 proposes: nightly dump + continuous WAL archiving; retention 14 daily / 8 weekly / 6 monthly; RPO 15 min (with WAL) or 24 h (without); RTO 4 h; quarterly restore drill.
- **Recommendation, not a decision:** RPO 24 h (nightly, no WAL at first), RTO 4 h, retention 14/8/6, quarterly drill. One operator can run it reliably; add WAL if losing a day of call logs proves unacceptable.
- Also choose where the off-VPS restore environment lives (AR-08).
- **Affects:** backup container, jobs J-10/J-11, runbook, RISK-02/03.
- **Your answer:** RPO: ____ · RTO: ____ · Retention: ____ · Drill: ____ · Restore env: ☐ separate small host ☐ operator workstation

### C2. OQ-12 — Owner loses 2FA and cannot recover (no DEC ID)
- **Options mentioned (architecture-a RISK-08, §11):** recovery codes; a documented out-of-band operator procedure that verifies identity outside the app; a second Owner account.
- **Recommendation, not a decision:** recovery codes plus a written operator procedure; no second Owner in v1. This avoids lockout without doubling the most powerful account.
- **Affects:** WF-AUTH-002 (003B), runbook, RISK-08.
- **Your answer:** ☐ Recovery codes ☐ Operator procedure ☐ Second Owner account (tick all that apply)

### C3. Retention windows and audit retention (OQ-19)
- **Proposed in architecture-b §10:** sessions 90 days, ended reservations 90 days, reminders/notifications 180 days, jobs 30 days, tokens 30 days after expiry, idempotency 48 h. Operational history kept indefinitely. Audit retention: open (OQ-19).
- **Recommendation, not a decision:** accept the technical windows, and keep audit indefinitely for now. The volume is small, and deleting audit later is easier than recovering it.
- **Affects:** job J-12, database size, ADR-008.
- **Your answer:** ☐ Accept windows ☐ Change: ______ · Audit kept: ☐ indefinitely ☐ ____ years

---

## Not in this pack (still pending)
- DEC-004, 007, 008, 009, 010, 012, 014, 019, 020, 021, 023, 024, 025.
- C-02 (Pending vs NEW_LEAD), D4 (open follow-ups on Rejected/Accepted), commercial-stage transitions (OQ-03/05/15), Data Entry base scope (OI-02), and the other calling, visibility and delivery questions in `phase2/reviews/batch5-integration.md` §(e).
- Implementation and provider choices: 2FA method, session lengths, lockout, password policy; VPS, email, storage and DNS providers; office static IP (if DEC-009 picks IP mode).

These can be the next pack once Groups A and B are answered.
