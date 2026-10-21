# Phase 2 Batch 2 — Open items, decision dependencies, baseline change requests (DRAFT, repair attempt 1)

**Baseline: SB-2.** Status: DRAFT, not re-reviewed. Author: Agent 2. Companion to [batch2-spec.md](batch2-spec.md), [batch2-mermaid.md](batch2-mermaid.md), [repair-log.md](repair-log.md).
Nothing here is approved. Nothing has been tested. No DEC ID is created or changed; questions without a DEC ID are marked "(no DEC ID)".

---

## 1. Open questions

| # | Question | Where it matters | Current handling | Needs |
|---|---|---|---|---|
| OI-01 | **DEC-013 alternatives are not on Board 01.** Drafted Alt NM-A/NM-B/NM-C and Alt SN-1/SN-2 are used and labelled "(drafted)" in spec and diagrams. Alt NM-B needs a branch field not in ART-01 §6.1. Alt SN-1 coincides with ART-11 D11 (Tier 4) | WF-BIZ-001 Part 2, WF-BIZ-002 Part A, DR-4 | Unselected orange branches | USER: accept, replace or extend the set; DEC-013 decision |
| OI-02 | **Data Entry base access scope** (ART-01 §2.2 "approved visibility scope", undefined; no DEC ID) | SM-VISIBILITY-001 step 5 (VT-2); WF-BIZ-002; correction queue | Drafted Alt DE-1 any business / Alt DE-2 own-created plus correction queue | USER decision; a DEC ID is an orchestrator matter |
| OI-03 | **Phone mandatory at creation** (B2; no DEC ID); normalization method and default country code | VR-4, VR-5, DR-3; calling eligibility | Drafted Alt PH-1 / PH-2 | USER decision; company country code |
| OI-04 | **"Day 16" boundary**: calendar days in company timezone (DEC-007) or 15 × 24 h | Step 7 | Undefined; flagged | USER (no DEC ID) |
| OI-05 | **Owner reads of hidden records audited?** (C1 "subject to audit") | WF-ACCESS-001; `business_access.owner_viewed_hidden` | Conditional event | USER |
| OI-06 | **"Unless extended"** (DEC-002 rows 1–3 Alt A) / ART-01 §8 temporary access requests: no mechanism, no DEC ID; overlaps DEC-003 escalation | Step 8 | Mentioned only | USER |
| OI-07 | **Owned related item on a hidden business** (own follow-up, attempt, meeting, task): redact or omit? (no DEC ID) | Table RT; WF-ACCESS-001 Part 2 | Proposed: redact owned items only; list rows the user merely browses are always omitted and not counted | USER; Agent 3/4 alignment |
| OI-08 | **Correction queue under DEC-002 row 6 Alt A**: Owner-only review; does Data Entry see a redacted row? | WF-BIZ-002 Part B (BIZ2B-e) | Proposed: Owner-only review, redacted row for Data Entry | USER (follows DEC-002 row 6) |
| OI-09 | **Requester's own request** after the business is hidden to them | Table RT; WF-BIZ-002 Part B | Proposed: status visible, business redacted | USER |
| OI-10 | **Direct-URL denial wording**: "Record hidden by policy" confirms existence; alternatives "Permission denied" or "Not found" | WF-ACCESS-001 Part 1 | Proposed split: hidden-by-policy for timer denials, permission denied otherwise | USER |
| OI-11 | **Previous values in edit history for non-owner roles.** Aligned with SB-2 §11 (history visible to anyone who passes the Access check, incl. context-limited), with a Proposed limit: only fields the outcome allows | WF-ACCESS-001 Part 1; VT-3 | Aligned with SB-2 §11 + field limit | USER confirms the field limit and previous-value visibility |
| OI-12 | **Website checkbox cannot express "unknown"** although "missing website information" is a correction example | VR-11 | Binary per ART-01; flagged | USER |
| OI-13 | **Social accounts in duplicate checks** (not an ART-01 §7 rule) | DR-1 | Not checked | USER |
| OI-14 | **Shared phones across branches** conflict with Alt NM-B if branches share a number (phone blocking is Confirmed) | DR-3 vs DR-4 | Flagged | USER under DEC-013 |
| OI-15 | **Creation form as existence oracle** for hidden records (inherent to the Confirmed whole-database check) | WF-BIZ-001 Part 2; DEC-003 | `business.duplicate_blocked` records whether the match was hidden, for Owner review | Awareness under DEC-003 |
| OI-16 | **DEC-015 drafted alternatives** (Alt CA-A/B/C) and **category removal as its own question** (no DEC ID; drafted Alt CR-1 deactivate / CR-2 delete-if-unused). No longer presented as C-01; C-01 may only influence it | WF-BIZ-003 | Unselected, labelled "(drafted)" | USER |
| OI-17 | **DEC-001 Alt B details**: (a) start at creation before any reset (interpretation); (b) does a no-answer (On hold) `call_attempt.logged` reset? (unanswered calls could keep a record visible indefinitely); (c) does `follow_up.rescheduled` count, given R-07 names only `call_attempt.logged` and `follow_up.scheduled`?; (d) basis per business | VT-4 | (a) tagged Proposed interpretation; (b)–(d) flagged | USER under DEC-001 |
| OI-18 | **DEC-002 details not on Board 01**: end of rows 1–2; "who" for rows 3–5 (implied); row 2 field set | VT-5 | Marked Unresolved / implied | USER; Agent 4 for stage/project ends |
| OI-19 | **SM-DATAFIX-001 choices** (all Proposed): In review as concurrency guard; Closed – no change needed separate from Rejected (request); withdraw from Submitted and In review; mandatory rejection reason; no reopening | §8 | As listed | Reviewer/USER confirmation |
| OI-20 | **Correction-request notifications**: recipients, timing, channel and outcome notice to requester (no DEC ID); dispatched by WF-NOTIFY-001 without a state model (R-08) | WF-BIZ-002 Part B | "reviewers" (shared queue, Proposed) | Notification decision (no DEC ID) |
| OI-21 | **Mandatory name and category** (VR-1, VR-2) Proposed; empty category list blocks creation | WF-BIZ-001 Part 1 | Proposed | USER |
| OI-22 | **"Business no longer operating"** cannot use archiving until C-01 is decided | BIZ2B-c | Note or close with note | C-01 |
| OI-23 | **Follower metrics**: DEC-014 (Unknown mechanism), DEC-023 (history) | VR-9, VR-10 | Explicit Unknown, never 0 (Confirmed principle) | DEC-014, DEC-023 |
| OI-24 | **May Data Entry submit correction requests?** (ART-01 §14 lists CC, Developer, Owner) | VT-3 | Proposed: not needed | USER |
| OI-25 | **ART-11 D9 per-user timer** is a third option outside DEC-001 Alt A/B (C-04); not drawn | VT-4 | Mentioned only | USER/orchestrator |
| OI-26 | **Archived businesses in the duplicate scope** if C-01 adopts archiving | DR-2 | Proposed derivation: included | C-01 |
| OI-27 | **Context-limited actions per DEC-002 row** (new column in VT-5), e.g. may Data Entry edit under row 6 Alt B (Proposed: only the apply step), may an agent log a call under row 5 Alt B (Proposed: yes) | VT-5; WF-ACCESS-001 Part 1 edit branch; WF-BIZ-002 Part A | Proposed per row, tied to DEC-002 | USER, with DEC-002 |
| OI-28 | **DEC-024 scope**: "Social Media Platform Ingestion Priority" may relate to the platform list but has no defined scope; no meaning assigned | VR-8 | "Possibly related, scope undefined" | USER |
| OI-29 | **Meeting attendance alone does not grant access** (Table RT, Proposed). Under DEC-005 Alt 2 a Developer attendee could not open the meeting's deal record (Batch 4 OQ-02) | Table RT meeting row | Proposed; redacted calendar entry for attendees | USER with R-12; Agent 4 |

### USER questions (SB-2 → USER items affecting Batch 2)
- **R-11:** may an Owner session waiting for 2FA perform non-administrative business actions? Shown as Reading R11-a / R11-b (VT-1 step 2b; WF-BIZ-001 Part 1; SM-VISIBILITY-001 Part 1; scenario 4). Under R11-b the scope a pending-2FA Owner would have without the C1 bypass is also undefined.
- **R-12:** DEC-005 Alt 2 vs Developers recording signature/payment before closure (DEC-006). Noted on every DEC-005 Alt 2 appearance (VT-2, VT-3, VT-7, Table RT, WF-ACCESS-001 Part 2, SM-VISIBILITY-001 Part 1).

---

## 2. Unresolved-decision dependencies (summary)

| Decision | Status (SB-2) | Batch 2 artifacts affected | How shown |
|---|---|---|---|
| DEC-001 timer basis | Unresolved (Alt A/B) | SM-VISIBILITY-001 Part 2; WF-BIZ-001; WF-BIZ-002 A | Two orange branches; Alt B reset events per R-07 |
| DEC-002 exceptions (6 rows) | Unresolved table | SM-VISIBILITY-001 Part 2; Table RT; WF-BIZ-002 B; WF-ACCESS-001 Part 2 | Orange node per row; VT-5 actions column Proposed |
| DEC-003 hidden revelation (incl. escalation) | Unresolved | WF-BIZ-001 Part 2; WF-ACCESS-001 Part 3 | Yellow; "already exists" Confirmed; escalation "only if adopted" |
| DEC-005 developer pre-closure (+ R-12 → USER) | Unresolved (Alt 1/2) | VT-2, VT-3, Table RT; WF-ACCESS-001 Part 2 | Labelled Alt 1 / Alt 2 edges |
| DEC-013 | Unresolved | WF-BIZ-001 Part 2; WF-BIZ-002 A | Drafted Alt NM-A/B/C, SN-1/SN-2 |
| DEC-014 | Proposed | VR-9, VR-10 | Yellow |
| DEC-015 | Unresolved | WF-BIZ-003; WF-BIZ-001 Part 1 | Drafted Alt CA-A/B/C |
| DEC-016 | Unresolved | VT-3 (reopen rejected) | Table cell |
| DEC-023 | Unresolved | VR-9 | Yellow |
| DEC-024 | Proposed | VR-8 note only | "Possibly related, scope undefined" |
| C-01 business deletion vs archiving | Unresolved (no DEC ID) | Step 9; VT-3; DR-2; SM-DATAFIX-001; BIZ2B-c | Policy-dependent |
| Category removal | Unresolved (no DEC ID) | WF-BIZ-003 | Drafted Alt CR-1/CR-2 |
| C-02 | Unresolved (no DEC ID) | WF-BIZ-001 end state | "Unassigned + calling outcome Pending" |
| B2 phone mandatory | Unresolved (no DEC ID) | WF-BIZ-001 Part 1; WF-BIZ-002 A | Drafted Alt PH-1/PH-2 |
| Data Entry base scope | Unresolved (no DEC ID) | VT-2 | Drafted Alt DE-1/DE-2 |
| R-11 | → USER | VT-1 step 2b; WF-BIZ-001; WF-BIZ-003 preconditions | Reading R11-a / R11-b |
| R-12 | → USER | DEC-005 Alt 2 everywhere | Note |
| Notification timing | Unresolved (no DEC ID) | WF-BIZ-002 B; WF-BIZ-003 (Alt CA-C); B7 Owner item | "no DEC ID" |

---

## 3. Cross-batch notes for Agents 3 and 4 (via orchestrator)

- Cite "Access check (WF-ACCESS-001)". The **rules** for every R-06 resource type are now in Table RT (spec §6.1); Batches 3–4 supply only **relation facts** (responsible user, holder, attendees, assigned Developer, task owner). New actions must be added to VT-3 by request.
- **B7:** WF-CALL-001/002/003 should show "assigned but inaccessible" (derived) to the Owner and never reassign automatically; reassignment via WF-CALL-001 (B8).
- **Meetings:** attendance alone does not grant access (Table RT; OI-29, affects Batch 4 OQ-02 under DEC-005 Alt 2).
- **Owned items on hidden businesses:** redacted, not omitted (OI-07, Proposed) — follow-ups, call attempts, meetings, tasks, requests. List rows are omitted and not counted.
- WF-NOTIFY-001 decides suppress vs redact on send-time denial; suppression visible to the Owner (D6).
- WF-REPORT-001: per-row check on export rows (matches Batch 4); "businesses needing corrections" = distinct businesses with ≥1 open request.
- WF-EMP-001: deactivating a reviewer releases In-review correction requests (SM-DATAFIX-001, Proposed).

---

## 4. Baseline change requests

### 4.1 Resolved by SB-2 (rulings are Proposed, not approved)

| Former request | Ruling | How absorbed |
|---|---|---|
| BCR-1 Owner position in contract C order | **R-01** | VT-1 (Owner passes steps 1–4, skips 5–8, subject to step 9); SM-VISIBILITY-001 Part 1 `ownerJump` and Part 2 `inO` cite R-01 |
| BCR-2 visibility condition for calling eligibility | **R-02 → contract B7** | Spec §6.4, VT-2, VT-7, scenario 9; WF-ACCESS-001 Part 3 (derived "assigned but inaccessible", no automatic reassignment) |
| BCR-3 terminology (context-limited access; edit history vs audit trail) | **R-04 → SB-2 §11** | Spec §0.4 uses the SB-2 §11 wording; edit history aligned with §11 (OI-11) |

### 4.2 Open requests
None. (The Proposed field limit on edit history for context-limited access is recorded as OI-11 rather than a baseline change, because it narrows display only and does not contradict SB-2 §11.)

No request changes any shared ID, any DEC meaning, or adds an approved policy.

---

## 5. What was not done

- No Figma/FigJam writes (`generate_diagram` and `use_figma` not called). Board 01 was only read in T2a.
- Mermaid checked only by a local structural script (declared nodes, edge endpoints, labelled decision edges, node counts, classDef-name collisions, ASCII inside blocks). Not rendered.
- ART-02, ART-03, ART-07 unavailable: REQ mapping by range only.
- Nothing tested; there is no software.
