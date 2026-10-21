# Phase 3 Independent Architecture Review (RA)

| Field | Value |
|---|---|
| Reviewer | Independent Architecture Reviewer. I authored none of the reviewed material. |
| Date | 2026-10-20 |
| Scope | `docs/phase3-4/architecture-a.md`, `docs/phase3-4/architecture-b.md` (incl. Appendix A), checked against brief P34-1 §1, §3, §5, §6, SB-3 (contracts A–G, R-01..R-13), Batch 1 §7–§13, Batch 3 and Batch 4 specs |
| Passes | One |
| Status | Review findings only. **This review approves nothing.** Phase 3 stays Proposed and goes to the user. |

## 1. Verdict

**Changes required before the A + B merge.** The overall shape matches the constraints:
- A monolith with an in-process worker on PostgreSQL job tables, and no broker or Redis (justified).
- Express owns logic and authorization. Next.js is UI only, on one origin.
- Docker Compose on one VPS. Only the proxy is public, and PostgreSQL is private.
- Secrets are injected at runtime, and there is no production SQL or code.
- The seven required separations are kept.
- DEC-017 and C-01 are left visibly undecided.
- Phase 2 IDs and audit event names are preserved. I spot-checked 34 event names used by B against the Phase 2 specs, and all of them exist.

Ten findings still need fixing (one Blocker and nine Major):
- **Ownership:** A and B disagree on which module owns several entities, and some entities have no owner at all.
- **Phase 2 conflicts:** two of A's transaction examples contradict Phase 2.
- **Unreconciled mechanisms:** A and B describe deactivation revocation, exports and access-fact access differently.
- **Recovery:** the backup key handling makes the automated restore drill impossible as written.
- **Board:** the section 06 deliverable on the board is incomplete.

## 2. Required fixes

| ID | Severity | Doc + section | Evidence | Fix |
|---|---|---|---|---|
| RA-01 | **Blocker** | A §3.4 + §10 item 10; B §2 ERD-1/ERD-5, §4 | A: "every ERD entity has exactly one owning module" is still "Pending reconciliation". Several of B's entities have no owner in A, or a conflicting owner. B, ERD-5: "BackgroundJob rows … Agent A owns scheduling" (no module named). A: MOD-admin owns "company/attendance settings" vs B: "AttendanceSettingsVersion … MOD-attendance". A: MOD-duplicates owns "Normalized match keys" vs B: "BusinessPhone.normalizedNumber is globally unique" (in MOD-businesses). | Give every entity in §3 of this review exactly one owner. That covers BackgroundJob, the outbox (missing from B's ERD), IdempotencyRecord, ExportRecord (see RA-05), AttendanceSettingsVersion and the company timezone, the match keys or BusinessPhone uniqueness, and rate-limit/failed-login counters. Add a platform module (or MOD-admin) for the job, outbox and idempotency tables. Decide where the DR-8 unique index lives and which module writes it. |
| RA-02 | Major | B §4 (Owner column), §3, §1 header note | B uses `MOD-targets`, `MOD-businesses`, `MOD-assignments`, `MOD-reservations`, `MOD-audit`. A uses `MOD-work`, `MOD-business`, `MOD-assignment`, `MOD-reservation`, `MOD-admin`. B itself says "if A's names differ, A's names win". | Rename in B (doc, ERD and entity catalogue on the board) to A's names (table in §3 of this review). |
| RA-03 | Major | A §3.2 rule 3 (and D03a if it is drawn the same way) | "WF-CALL-003: call attempt + outcome + follow-up … + deal record (E5) + **reservation release**" and "WF-CALL-001: reassignment + follow-up move + **reservation release**". Batch 3 WF-CALL-003 step 7 says "After the save succeeds, System releases the reservation… A failed release is harmless". WF-CALL-001 step 4 makes an Active reservation a Wait/Override choice through WF-CALL-002, not a release. B §8 principle 3 and SEQ-09/SEQ-11 follow Phase 2. | Remove release from both unit-of-work examples. Release is a separate step after commit. For reassignment, an Active reservation is a Wait or Override precondition (WF-CALL-002). |
| RA-04 | Major | A §3.2 rule 5 ("Employees vs identity"), §2.3; B SEQ-03 | A: "MOD-employees does not call MOD-identity. Identity consumes `account.deactivated`…" (after commit, through the outbox). B SEQ-03: "status Deactivated + all sessions Ended (`revoked`) + audit **in one transaction**". B's version needs MOD-employees to write the Session table or call identity, which A forbids. | Pick one design and use it in both documents. Option 1: revocation through the outbox after commit, with the request-time account check as the guarantee (A). Option 2: an in-transaction call to an identity operation, which reverses the dependency rule. The same choice applies to role change (M2). Update SEQ-03's transaction and audit lines to match. |
| RA-05 | Major | A §4.5, ADR-010; B ERD-5, §10, SEQ-15 | A: exports are "streamed … **not stored on disk**", and storing files "would create sensitive data at rest". B: "ExportRecord stores … a short-lived file reference", "Export files: Short-lived (24 h) file", "Short-lived download". | Use A's ADR-010 throughout B: no stored file, and ExportRecord holds metadata only. Drop it entirely if the audit row `report.exported` is enough. Redraw SEQ-15 (Appendix A) without "complete file reference / short-lived download". If B wants stored files, it must raise a change against ADR-010 instead. |
| RA-06 | Major | A §3.2 rule 1 and rule 5 ("Access vs everything"), ADR-017; B §1 S-8, §6 design proposals | A: MOD-access gets facts through "visibility-fact provider ports" that domain modules implement. Cross-module reads are allowed only through public operations or views "for MOD-reports". B: "a read-only 'access facts' view joins the facts" across modules. Both A (`scopeFilter`) and B (`scopePredicate`) need an **SQL** predicate applied before count, sort and paging. Ports alone cannot supply that, and a cross-schema view breaks A's rule 1 as written. | Describe the single WF-ACCESS-001 implementation one way in both documents. Proposal: each module publishes its own read-only fact view, MOD-access composes them, and ADR-006 rule 1 is amended to allow MOD-access to read them. Ports are kept for per-resource evaluation, and both compiled forms are tested against the VT-7 evaluations. Align the operation names (`check`/`scopeFilter` vs `evaluate`/`scopePredicate`). |
| RA-07 | Major | A §3.2 rule 5, D03a/T03; B SEQ-06, SEQ-09, SEQ-11 | A says "Dependencies form a directed acyclic graph" but lists only three broken cycles, and the edge list is not in the text. B's sequences need these edges inside one transaction: business→calls ("via MOD-calls the calling state `pending`"), and assignment→calls (follow-up transfer/cancel, the D2 marker, and "lock calling-state row"). Calls must also know the current assignee (WF-CALL-002), which gives calls→assignment and so a likely **assignment↔calls cycle**. | List all module edges in A's text. Show how assignment↔calls and business↔calls stay acyclic, for example through fact ports, or by moving the follow-up mutation for reassignment into a calls operation that assignment invokes, with no reverse call. Confirm D03a matches. |
| RA-08 | Major | A §6.1 Secrets, §4.3 J-11, §6.3 Restore verification | "The backup container gets only the encryption **public** key; the private key is kept off the VPS." But "J-11 Restore drill [is] run by the backup container" and "Scheduled drills restore the latest backup into a scratch container". A drill on the VPS cannot decrypt the backup, so scheduled verification is impossible as designed. | Choose one: (a) run drills off the VPS where the private key lives (an operator workstation or a separate drill host), or (b) stage a separate drill key and accept the trade-off explicitly. Update J-11, D08c and the RISK-03 mitigation to match. |
| RA-09 | Major | A §4.2, §3.2 rule 4, J-03/J-07; B §8 principle 1, SEQ-11, SEQ-13, SEQ-14 | A: after-commit work goes through the **outbox**. `deal.closed` is consumed by MOD-projects, and reminders are planned from an outbox event. B instead inserts named **jobs** in the same transaction: "reminder-planning job", "handoff-notification job", "F2 Alt Auto: insert provisioning job". B's ERD has BackgroundJob but no outbox. The brief asks for events and jobs to be named consistently. | Agree one mechanism per side effect (outbox event vs direct job row) and one catalogue of event and job names, shared by A's T07a and B's matrix and sequences. Name the provisioning trigger once (event `deal.closed` → J-07, or a job), still under pending F2. |
| RA-10 | Major | B §12, header; brief §6 (Agent B: "one readable diagram each") | "SEQ-12..SEQ-15 are **not on the board**", "SEQ-11 … not screenshotted", "No … `get_figjam` read-back of the three sections", "sections 04/05/06 were not enlarged". | Generate SEQ-12..15 from Appendix A (after the RA-05 and RA-09 corrections). Inspect SEQ-11, read back sections 04–06, and enlarge the section frames. Until then, section 06 is an incomplete deliverable. |

## 3. A↔B module name and ownership table

A's names win, as both documents agree. "Rename" means B must rename only. "Conflict" means one owner must be chosen.

| Entity (B ERD) or table (A) | B owner | A owner | Status |
|---|---|---|---|
| Target, WorkItem | MOD-targets | MOD-work | Rename |
| Business, BusinessPhone, SocialAccount, Category, BusinessEditHistory | MOD-businesses | MOD-business | Rename |
| BusinessPhone.normalizedNumber / Business.normalizedName (duplicate keys) | MOD-businesses (columns) | MOD-duplicates ("normalized match keys") | **Conflict** (RA-01) |
| CallingAssignment | MOD-assignments | MOD-assignment | Rename |
| ContactReservation | MOD-reservations | MOD-reservation | Rename |
| AuditEvent | MOD-audit | MOD-admin | Rename |
| AttendanceSettingsVersion (and company timezone) | MOD-attendance | MOD-admin ("company/attendance settings") | **Conflict** (RA-01) |
| ExportRecord (with 24 h file) | not stated | none (MOD-reports owns only snapshots; nothing stored) | **Conflict + unowned** (RA-05) |
| BackgroundJob | "Agent A" (no module) | generic job table, no module | **Unowned** (RA-01) |
| IdempotencyRecord | not stated | not in catalogue | **Unowned** (RA-01) |
| Outbox | absent from ERD | outbox rows, no module | **Missing in B + unowned** (RA-01, RA-09) |
| Daily stock snapshot (OQ-17) | absent from ERD | MOD-reports | Missing in B (Proposed, optional) |
| Rate-limit / failed-login counters | Session.factorFailCount only | MOD-identity; ADR-004 "rate-limit counters" in PostgreSQL | Missing in B (minor) |
| OutcomeReopening, FollowUpChange | MOD-calls (implied) | MOD-calls (not listed by name) | Confirm in T03 |
| DealDeveloperAssignment, ClosureReview | MOD-deals | MOD-deals ("developer attribute"; ClosureReview not listed) | Confirm in T03 |
| MeetingChange; ProjectChange, ProjectDeveloperAssignment, Task | MOD-meetings; MOD-projects | same | Match |
| Employee; Credential, TwoFactorFactor, Session, SecurityToken | (MOD-employees implied); MOD-identity | MOD-employees; MOD-identity | Match |
| AttendanceSession, AttendanceCorrection | MOD-attendance | MOD-attendance | Match |
| DataCorrectionRequest | MOD-corrections | MOD-corrections | Match |
| BusinessCallingState, CallAttempt, FollowUp | MOD-calls | MOD-calls | Match |
| Deal; Meeting, MeetingAttendee | MOD-deals; MOD-meetings | same | Match |
| Reminder, NotificationDelivery | MOD-notifications | MOD-notifications | Match |
| Access operations | `evaluate` / `scopePredicate` | `check` / `scopeFilter` | Rename one side (RA-06) |

## 4. Checks that passed (summary)

- **Constraints (brief §3):** all respected. Synchronous exports and PostgreSQL jobs are justified, and the attachment store is deferred to DEC-018.
- **Separations:** all seven are present, in A §3.4 and B §3 (punctuality derived, outcome vs stage vs assignment, FollowUp vs Reminder, Project vs Task status, DEC-001 vs DEC-002 slots, master data vs history).
- **ERD:**
  - DEC-017 is drawn as a labelled alternative (IC-20).
  - C-01 `recordStatus` is marked pending.
  - There is one Task table, and WorkItem is a pointer only.
  - Cardinalities match Batch 3 and 4: at most one open assignment, at most one Active reservation, E5 deal per accepted attempt, Deal–Project 0..1 (Proposed).
- **Authorization flow:** it follows VT-1 with R-01 (Owner skips steps 5–8, not 1–4 or 9). R-11 is shown with both branches. Every surface in Table RT is covered.
- **SEQ-01..15:** each states authorization, transaction, concurrency, failure, audit and retry. The exceptions are SEQ-12..15, which are not drawn (RA-10), and SEQ-03 and SEQ-15, whose content conflicts with A (RA-04, RA-05).
- **Jobs:** job time, event time and delivery time are separate (ADR-009). Recipient and access are re-checked at every attempt (C6). D5 and D6 hold. Failed jobs are visible to the Owner as "dead". The late-run policy (B3-Q08) is pending.
- **Deployment:** public vs private zones, TLS through ACME, health and readiness checks, `unless-stopped` restarts, forward-only migrations behind a pre-migration backup, encrypted off-server backups and restore drills (but see RA-08). RPO/RTO are PENDING, and ART-11 D19 is labelled unapproved.
- **Pending policies:** none is selected. The placeholders `target.assigned` and `settings.updated` are labelled as needing G2 approval.

## 5. Optional minors

- A §6.1: `/readyz` includes "worker heartbeat fresh". If the proxy or uptime check gates traffic on `/readyz`, a worker outage would make the UI look down. Report worker health separately.
- A §6.3 "Real restore" step 3–4 assumes WAL replay to a point in time, but WAL archiving is "only if the chosen RPO needs it". Make the restore steps conditional.
- B SEQ-13 says "suppressed/redacted", while A §4.4 proposes suppression over redaction. Align them (both are Proposed).
- B SEQ-10 marks a lapsed Active row Expired during acquire, while A J-05 says only the sweep records `contact_reservation.expired`. State which path writes the audit row so it is written exactly once.
- B SEQ-03: the "not self, not last Owner" guards are Proposed in Batch 4 and should be tagged that way.
- B §10 says "Employee deletion is part of C-01". C-01 in SB-3 concerns business deletion and archiving. Cite it as a related open question rather than widening C-01.
- B §10 retention windows (90/180/30 days, 48 h) are labelled Proposed. Make sure they appear on the user decision list next to A's "Recovery objectives" so they are not read as settled.

## 6. Limits of this review

- **The architecture board was not visually inspected.** The Figma MCP quota is exhausted, so no Figma tool was called. Everything here is based only on the two documents. Board-only content was not checked: T03 edges and cells, T07a/T07b, the IC-01..IC-28 table, the 20-row transaction/concurrency matrix and the leakage table. Board inspection is pending.
- The transaction/concurrency matrix and the integrity-constraint table are judged only from the principles and highlights in B §5 and §8.
- I did not re-verify all Phase 2 IDs. I spot-checked the contracts, rulings, DEC-026 alternatives, the WF-CALL-001/002/003 release rules, WF-EMP-001 revocation and 34 audit event names.
- One pass only. No software exists, and nothing was tested.
