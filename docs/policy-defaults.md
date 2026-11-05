# Policy defaults — working defaults for every pending policy

> **Status clarified by the user (2026-10-23):** these are **demonstration alternatives** for the prototype and for a configurable first build. They are **not approved policies** unless the user explicitly approved an item. As of 2026-10-23 the only explicit approval is "Accepted keeps the contact reservation". Every prototype step that depends on one of these must be labelled "Demonstration alternative, not approved".


Owner-delegated working defaults (user message 2026-10-23: 'do it as it suits u'). Not individually confirmed by the user. Each can be changed; implementation should keep them configurable where cheap.

| Field | Value |
|---|---|
| Date | 2026-10-23 |
| Authority | The Owner approved Phase 6 on 2026-10-23 and delegated all still-pending business policies ("do it as it suits u"). The Owner explicitly decided one item: **"Accepted keeps the contact reservation"**. Everything else here is a delegated working default. |
| Does not edit | `decision-pack.md` and `decisions.md` stay as they are. This file records the choices. Where it conflicts with a "pending / select none" note in `phase6/handoff-ready.md` §9 or in the screen specs, this file wins for implementation. Keep the alternative code paths only where the "how configurable" column says so. |
| Selection order | 1 user decision / approved Phase 2 baseline → 2 `decision-pack.md` "Recommendation, not a decision" → 3 `decisions.md` D-item proposal, Board 01 "Proposed" status, Phase 2 "current handling" proposal, or the Phase 6 primary design → 4 placeholder marked **NEEDS VALUE** |

**Source codes:** `USER` explicit user decision · `SB` approved Phase 2 baseline (SB-1/SB-2 incl. rulings R-01..R-09) · `DP-xx` decision-pack recommendation (section) · `Dn` decisions.md proposal · `B01-P` Board 01 status "Proposed" · `PH2` Phase 2 "current handling" / Agent proposal in the open-item tables (`phase2/batch2/open-items.md`, `phase2/batch3/dependencies-and-open-items.md`, `phase2/batch4/dependencies-and-open-items.md`, `phase2/batch1-maintenance.md`) · `P6` option drawn as primary in Phase 6 (`phase6/screens/*-spec.md`, `phase6/handoff-ready.md`) · `NEW` chosen here (no source offered a choice; simplest safe option for a 5–6 person company).

**Configurability codes:** `SET` Owner setting in SCR-OWN-011 (or a settings row) · `CFG` server config / env value · `FLAG` feature flag, both branches kept · `CODE` code change needed to reverse (cheap) · `DATA` reversal needs a data migration (costly; noted).

---

## 1. Explicit user decisions

| ID | Question | Working default | Source | Why (one line) | Reversible / how configurable | Screens affected |
|---|---|---|---|---|---|---|
| U-01 (CC-003 "Accepted keeps reservation?", no DEC ID) | Does "Save, keep reservation" stay available on the Accepted outcome? | **Yes.** Accepted keeps the reservation option, like Needs another call and On hold. Only Rejected hides it | USER (2026-10-23); `callcenter-spec.md` N43-5 | The agent often continues the handoff (developer assignment, first meeting) right after acceptance | CODE (one outcome→button rule) | SCR-CC-003, SCR-CC-005, SCR-CC-007 |
| U-02 (Phase 6 approval) | Is the Phase 6 screen set approved for build? | Yes, approved 2026-10-23, with the recorded gaps in `handoff-ready.md` | USER | — | — | all |
| U-03 (Phase 2 baseline) | Do the SB-1/SB-2 baseline rules and rulings R-01..R-09 hold? | Yes, as already approved (Confirmed + Proposed rulings R-01..R-09, contracts A1, B1–B8, C1–C6, D1–D6, E1–E5, F1–F3) | USER / SB | Already approved | — | all |

## 2. Decision register DEC-001 … DEC-026

| ID | Question | Working default | Source | Why (one line) | Reversible / how configurable | Screens affected |
|---|---|---|---|---|---|---|
| DEC-001 | What starts and resets the 15-day timer? | **Alt A: creation-based, no reset.** Day-16 boundary per OI-04 | DP-A2 | Predictable, cannot be gamed; DEC-002 keeps active work visible | FLAG (`visibility.timerBasis = creation|inactivity`); Alt B needs `lastTouchpointAt` (store it now, cheap) | SCR-DE-001, SCR-SHR-008, SCR-SHR-010, SCR-SHR-012, SCR-CC-001/002, SCR-OWN-007, all lists/exports |
| DEC-002 | Which active work keeps a business visible after day 15? | **Alt B on all 6 rows:** (1) accepted opportunity → assigned Developer + Call Center agent; (2) closed deal → Developers company-wide + Owner, closed-deal list only; (3) active project → project board; (4) completed project → hidden 15 days after delivery; (5) scheduled callback → until callback date-time + 48 h; (6) open correction request → Data Entry correction queue until resolved | DP-A3 | People must not lose records they are working on; Alt A's "extended" path does not exist | SET per row would be costly; CODE (rows are rules in the access engine) | SCR-DE-006, SCR-DEV-001/002/005/006, SCR-CC-004, SCR-CC-007, SCR-SHR-007, SCR-SHR-012, SCR-OWN-009 |
| DEC-003 | What does a duplicate block on a hidden record reveal? | **(i) Existence only:** "already exists", no id, no fields, no escalation action | DP-B1; P6 (sample 101:6168) | Leaks nothing; the user can ask the Owner in person | CODE (payload change) | SCR-DE-002, SCR-DE-003, SCR-DE-005, SCR-SHR-010, SCR-SHR-012 |
| DEC-004 | Reservation lease duration and idle rule | **Lease 5 min, renewed by a heartbeat every 60 s while the contact workspace is open. Idle rule: no user input for 15 min ends the reservation (warning "Expiring" at 13 min). Tab switch / blur is not a release. Max total 60 min, then renew by explicit "Keep working". Owner force override allowed, reason required.** | B01-P (values undecided); P6 SCR-CC-005 states (Expiring/Expired/Network loss/Override); `interaction-spec.md` (durations illustrative) | Short lease frees abandoned contacts fast; idle rule avoids hoarding without punishing tab switches | SET (lease, idle, max, warning minutes) | SCR-CC-002, SCR-CC-003, SCR-CC-005, SCR-OWN-007, SCR-OWN-008 |
| DEC-005 | Can a Developer see an accepted opportunity before closure? | **Alt 1: assigned scoping access** (assigned Developer only; business master data read-only; may schedule meetings, record discovery, signature and payment on the deal record) | DP-A4; R-12 removed by it | The Developer runs discovery; avoids the R-12 conflict | FLAG (`deals.developerPreClosure = assigned|closedOnly`) | SCR-DEV-001/002/003/004/008, SCR-CC-007, SCR-SHR-008 |
| DEC-006 | Who records / approves commercial closure? | **Alt B: Owner verification.** Developer requests verification; Owner verifies and finalizes, or rejects with a reason. Owner may finalize directly | DP-B10; D16 | Closure drives revenue reporting; review is cheap at this volume | FLAG (`deals.closureMode = ownerVerify|direct`) | SCR-DEV-001, SCR-DEV-002, SCR-DEV-008, Owner deal review (RW-04), SCR-OWN-001 |
| DEC-007 | Workday schedule and hours | **Mon–Fri, 09:00–18:00 (9 h, Confirmed), one company schedule. Timezone NEEDS VALUE (placeholder `Asia/Beirut`).** | D1; product-description §attendance | One schedule covers a 6-person office | SET (working days, shift start, timezone); 9 h fixed | SCR-OWN-011, SCR-OWN-004, SCR-SHR-001/002/003/004, SCR-OWN-001 — **NEEDS VALUE** |
| DEC-008 | Late arrival grace period | **10 minutes** | D1 | Absorbs normal lateness; flags real lateness | SET | SCR-OWN-011, SCR-SHR-002, SCR-SHR-004, SCR-OWN-004 — **NEEDS VALUE** (confirm) |
| DEC-009 | Office restriction mechanism | **Office network (IP allowlist) only**, client IP read from the trusted proxy header (ADR-016). Fallback mode "IP or location" available but off. **Office IP NEEDS VALUE** | D2; ADR-016; P6 SCR-OWN-011 RadioCards | Geolocation is spoofable and noisy; an IP check is zero-friction | SET (mode: IP / geofence / IP or location / IP and location / disabled; IP list) | SCR-OWN-011, SCR-SHR-002, SCR-SHR-003, SCR-OWN-004 — **NEEDS VALUE** |
| DEC-010 | Remote work permission and verification fallback | **Login from anywhere; attendance actions need the office check. Owner can grant a remote attendance exception per employee per date / date range; such sessions are labelled `remote`.** No self-service "request remote exception" button in v1 (employee asks the Owner) | D3 | Keeps the office rule real while allowing approved remote days | SET (exceptions); FLAG for the self-request button | SCR-SHR-002, SCR-SHR-003, SCR-OWN-004, SCR-OWN-011 |
| DEC-011 | Attendance correction authority | **Alt B: employee request → Owner approves/rejects with reason; Owner may also adjust directly.** Originals never overwritten; effective value shown with "adjusted" marker. F-01 handling below | DP-B5; D4 (decisions.md) | The employee knows the real times; the Owner still decides | FLAG (`attendance.employeeRequests`) | SCR-SHR-004, SCR-SHR-005, SCR-OWN-005, SCR-OWN-004, SCR-SHR-002 |
| DEC-012 | Is the checkout work report mandatory? | **Mandatory, short:** "Work completed" ≥ 10 characters; outstanding tasks, blockers, notes optional; target progress filled by the system | D6 | Gives the Owner a daily record at low effort | SET (required on/off, min length) | SCR-SHR-003, SCR-SHR-015, SCR-SHR-001 |
| DEC-013 | Name-only duplicate blocking and branches | **NM-B + SN-1:** normalized name + branch blocks; same name with a different branch allowed; trigram similarity ≥ 0.6 warns only. Optional `branch / location` field. Phone still blocks across branches (OI-14) | DP-B2; D11 | Real chains have branches; a warning catches typos without blocking | SET (similarity threshold); CODE for NM-A/NM-C | SCR-DE-002, SCR-DE-003, SCR-DE-004, SCR-DE-005 |
| DEC-014 | Unknown social media metrics | **Nullable follower count and last-post date with an explicit "Unknown" option; shown as "Unknown", never 0; `metrics_recorded_at` stored; unknown is its own report bucket, excluded from averages** | B01-P; D13 | Avoids false zeros | CODE | SCR-DE-002, SCR-DE-004, SCR-SHR-008, SCR-OWN-009 |
| DEC-015 | Category management authority | **CA-A: Owner only** (create, rename, deactivate). Data Entry picks; uses "Other" + note to suggest | DP-B4; D12 | Prevents near-duplicate categories | FLAG (CA-B would add one permission) | SCR-DE-007, SCR-DE-002, SCR-DE-004 |
| DEC-016 | Who may reopen a Rejected (do-not-call) business? | **Owner only, mandatory reason; outcome returns to Pending; history kept; audited** | DP-B8; D14 | No new request workflow needed | CODE | SCR-CC-008, SCR-CC-001 |
| DEC-017 | More than one deal per business? | **One open deal at a time, many over time; at most one project per closed deal.** Re-queue after Not proceeding: **yes, Owner only** (see B3-Q12) | DP-A7; D17 | One commercial thread per client, still allows repeat business | CODE (DB partial unique index; DATA to relax later is cheap) | SCR-CC-003, SCR-CC-007, SCR-DEV-001/002, SCR-OWN-006, SCR-OWN-007 |
| DEC-018 | Financial fields and evidence | **A deposit counts as payment; agreement reference + payment date recorded; optional amount + currency; no attachments in v1 (ADR-012)** | DP-B11; D16 | Enables revenue reporting without document storage | SET (currency list); CODE for attachments | SCR-DEV-002, SCR-DEV-008, SCR-OWN-009, SCR-OWN-001 |
| DEC-019 | Service delivery (project) state machine | **Statuses: Scheduled, In progress, Waiting for client, Blocked, Delivered, Completed; non-linear transitions; Completed only from Delivered; open tasks warn, do not block (OQ-10)** | B01-P; SB (ART-01 §13); P6 SCR-DEV-005/006 | Matches the drawn board | CODE (enum) | SCR-DEV-005, SCR-DEV-006, SCR-DEV-007, SCR-OWN-001, SCR-SHR-015 |
| DEC-020 | Daily target metric definitions | **Data Entry: businesses created that passed validation (daily). Call Center: distinct businesses contacted, ≥ 1 logged attempt (daily). Developer: tasks completed (weekly). Counted by the actor, by company-timezone date. Secondary metrics shown, not targeted** | D7 | Edits don't pad numbers; developer work is not daily | SET (target values); CODE (metric definitions) | SCR-OWN-006, SCR-SHR-001, SCR-OWN-001, SCR-SHR-015 |
| DEC-021 | Automated work allocation | **Manual assignment + Owner-triggered "Auto-fill queues":** unassigned, non-rejected, eligible businesses, oldest first, round-robin over active agents up to 40 per agent per day; never moves a business with an open follow-up or active reservation; no background run | B01-P; D8 | No silent reassignment; one click for the Owner | SET (queue size; scheduled run off) | SCR-OWN-007, SCR-OWN-006, SCR-CC-001 |
| DEC-022 | Weekly rest days and days off | **One company schedule (Sat–Sun off with DEC-007 Mon–Fri) + company holiday list; no per-employee days off in v1 (Owner uses a remote/absence note)** | DP-B6 | Least setup for 6 people | SET (working days, holiday list) | SCR-OWN-011, SCR-OWN-004, SCR-SHR-001/002/004, SCR-OWN-001 — **NEEDS VALUE** (holiday dates) |
| DEC-023 | Follower-count tracking granularity | **Latest value only + `metrics_recorded_at`; no history table in v1** (edit history / audit already keeps old values) | D13 (partial); NEW | Avoids a snapshot model nobody has asked for | CODE (add history table later; no backfill possible before that) | SCR-DE-002, SCR-DE-004, SCR-SHR-008 |
| DEC-024 | Social media platform ingestion priority | **No behaviour in v1.** Platform list is a fixed, Owner-editable list; no import/ingestion feature | NEW (scope undefined, OI-28) | No defined meaning, so nothing is built | SET (platform list) | SCR-DE-002 (platform picker only) — **UNRESOLVED meaning** |
| DEC-025 | Target allocation frequency and review cycle | **Targets set by the Owner per role; daily for Data Entry and Call Center, weekly for Developers; changes apply from the next period; Owner reviews weekly on the dashboard** | D7; NEW (review cycle) | Matches DEC-020 periods; no extra workflow | SET | SCR-OWN-006, SCR-OWN-001, SCR-SHR-001 |
| DEC-026 | Failed checkout verification | **Alt B: closed provisionally with the attempted time, flagged with the failure reason, plus an Owner review item.** Summary collected at the attempt (F-02). Never blocks the next check-in | DP-B7; D5 | Never leaves a session open; the Owner still reviews | FLAG (`attendance.failedCheckout = provisional|block|hold`) | SCR-SHR-003, SCR-SHR-004, SCR-OWN-005, SCR-OWN-004, SCR-OWN-001 |

## 3. Questions with no DEC ID — architecture, rulings, delivery

| ID | Question | Working default | Source | Why (one line) | Reversible / how configurable | Screens affected |
|---|---|---|---|---|---|---|
| ADR-001..019 | Accept the Proposed ADRs? | **Accept all as written** (ADR-012 = no attachments, per DEC-018; ADR-013 parameters per C1 below) | DP-A1 | Fit one VPS and a 6-person team | — | all |
| R-10 | Calling-outcome rules: new `SM-OUTCOME-001` or table? | **Keep the table in WF-CALL-003** | DP-B9 | Docs only; avoids reopening the inventory | — | none |
| R-11 | What may an Owner session do while waiting for 2FA? | **R11-a: nothing until 2FA** (including check-in) | DP-A5 | One rule in the request pipeline; 2FA takes seconds | FLAG (both readings drawn) | SCR-AUTH-001, SCR-AUTH-002, SCR-SHR-011, SCR-SHR-002 |
| R-12 | DEC-005 Alt 2 vs Developer recording signature/payment | **Resolved by DEC-005 Alt 1:** Owner and assigned Developer record signature/payment before closure | DP-A4 | Conflict disappears under Alt 1 | follows DEC-005 flag | SCR-DEV-002, SCR-DEV-008 |
| R-13 | Meeting "Missed" state | **Adopt "Missed"** (with "Needs rearranging"); rescheduling stays an event | SB (Proposed); P6 SCR-DEV-003/004 | Already drawn; distinguishes no-shows | CODE (enum) | SCR-DEV-003, SCR-DEV-004 |
| R-06 | Resource types the access check must cover | **The 11 types as listed** (business, call attempt, follow-up, reservation, deal record, meeting, project, task, notification, export row, duplicate preview) | SB | Baseline rule | — | all |
| C-01 | Business delete vs archive (+ employees, categories) | **Archive only** (status + who/when; Owner can restore). Archived businesses stay in the duplicate check (OI-26) and leave calling. Employees: deactivate only. Categories: **CR-1 deactivate** | DP-A6; D20 | History must not silently become permanent deletion | CODE | SCR-DE-001, SCR-DE-004, SCR-DE-007, SCR-OWN-002/003, SCR-OWN-007 |
| C-02 | Stored `NEW_LEAD` vs "Unassigned + Pending" | **No stored NEW_LEAD; new business = Unassigned + outcome Pending** | SB (SB-2 §5) | Keeps assignment and outcome separate | CODE | SCR-CC-001, SCR-OWN-007, SCR-DE-002 |
| D4 | Open follow-ups when the outcome becomes Rejected or Accepted | **Rejected: open follow-ups are cancelled by the system in the same save (reason "Business marked do-not-call"). Accepted: open follow-ups stay open; the agent completes or cancels them** | NEW | Do-not-call must stop calls; acceptance often still needs a callback | CODE | SCR-CC-003, SCR-CC-004, SCR-CC-006, SCR-CC-008 |
| B2 / OI-03 | Is a phone mandatory? Default country code | **PH-2 optional;** business without a phone shows "No phone" and is not eligible for calling. **Default country code NEEDS VALUE (placeholder +961)** | DP-B3 | Social-media leads often have no listed number | SET (country code) | SCR-DE-001, SCR-DE-002, SCR-DE-004, SCR-OWN-006, SCR-OWN-007 — **NEEDS VALUE** |
| F2 | Project provisioning trigger | **Auto:** the project board is created at verified closure (job J-07) | DP-B12; D17 | No closed deal is forgotten | FLAG (`projects.autoProvision`) | SCR-DEV-008, SCR-DEV-005, SCR-OWN-001 |
| F3 | Provisioning failure | **Closure stays committed; failure shown to the Owner as "Closed deal without project" with retry** | SB (R-09 contract F3) | Baseline | — | SCR-DEV-008, SCR-OWN-001 |
| NOTIF (B13, F-05, N-6) | Notification timing, recipients, retries, in-app list | **D18 table as the starting configuration** (follow-up digest at shift start; due −15 min; overdue +1 h, Owner in daily digest; meeting −24 h and −1 h; missing check-in at shift start + grace + 30 min on working days; missing checkout employee at shift end + 1 h, Owner next-morning digest; assignment/handoff and correction requests immediately; delivery failure in-app to Owner). **In-app list yes (AR-14). Email retries: 3 (after 1 min, 10 min, 60 min), then Failed.** Project Developer assignment also sends "New assignment" (N-6). DEC-026 review items appear in the Owner review list, not as email | DP-B13; D18 | Already configurable; tune later | SET (all times, retries) | SCR-SHR-007, SCR-OWN-012, SCR-OWN-004, SCR-CC-004, SCR-DEV-003 |
| Overdue threshold (CC, no DEC ID) | When does a follow-up become Overdue? | **Overdue = 1 h after the follow-up time** (same as D18 overdue alert); "Due today" = same company-local date | D18; NEW | One number for chip and alert | SET | SCR-CC-004, SCR-CC-001, SCR-SHR-001 |
| C1 (recovery) | RPO / RTO / retention / drill / restore environment | **RPO 24 h (nightly encrypted dump, no WAL at first); RTO 4 h; retention 14 daily / 8 weekly / 6 monthly; quarterly restore drill; restore environment = operator workstation** | DP-C1; D19 | One operator can run it; add WAL if a day of call logs proves too costly | CFG | none (runbook) — **NEEDS VALUE** (backup storage provider) |
| OQ-12 / C2 | Owner loses 2FA | **Recovery codes (10, single use) + written out-of-band operator procedure; no second Owner account** | DP-C2 | Avoids lockout without doubling the strongest account | CODE | SCR-AUTH-003 |
| C3 / OQ-19 | Retention windows; audit retention | **Accept windows:** sessions 90 d, ended reservations 90 d, reminders/notifications 180 d, jobs 30 d, tokens 30 d after expiry, idempotency 48 h; operational history indefinite; **audit kept indefinitely** | DP-C3 | Small volume; deleting later is easier than recovering | CFG | SCR-OWN-010 |
| OQ-03/05/15 (commercial transitions) | Commercial stage list and transitions | **Stages: Accepted opportunity → (meeting/discovery) → Signed / Paid in any order (OQ-05) → Closed (verified, DEC-006); Not proceeding from any non-closed stage, reason required.** See OQ-03, OQ-05, OQ-15 rows | D16 (adapted to SB stage names); PH2 | Uses the drawn stage names | CODE | SCR-DEV-001, SCR-DEV-002, SCR-DEV-008 |

## 4. Calling questions (Batch 3, B3-Q01..Q16)

| ID | Question | Working default | Source | Why (one line) | Reversible / how configurable | Screens affected |
|---|---|---|---|---|---|---|
| B3-Q01 | Who may assign / reassign businesses? | **Owner only** | PH2 | Only confirmed capability | CODE | SCR-OWN-007, SCR-OWN-008 |
| B3-Q02 | Is Start Contact limited to assignee + Owner? | **Yes** | PH2 | ART-01 §2.3 + DEC-004 permission row | CODE | SCR-CC-002, SCR-CC-005 |
| B3-Q03 | Open follow-ups on reassignment | **Owner chooses per follow-up (Transfer / Cancel with reason / Keep); "Transfer to new assignee" is preselected** | PH2; NEW (preselect) | No orphaned callbacks; one click in the common case | CODE (UI default) | SCR-OWN-008 |
| B3-Q04 | More than one open follow-up per business? | **No: at most one open follow-up per business;** scheduling another reschedules the open one | NEW | One next step per client; simpler calendar and reminders | CODE (partial unique index) | SCR-CC-004, SCR-CC-006, SCR-CC-003 |
| B3-Q05 | Save arrives after the reservation was lost | **Alt B: keep the attempt row and notes only; the outcome is not applied;** the agent is told to reopen the contact | NEW (both drawn on SCR-CC-005) | A real call is never lost; no outcome race with the new holder | FLAG | SCR-CC-003, SCR-CC-005 |
| B3-Q06 | Holder deactivated: reservation ends when? | **At lease end** (≤ 5 min under DEC-004); sessions are revoked immediately anyway | PH2 | Agent 3 proposal; short lease makes it moot | CODE | SCR-OWN-003, SCR-CC-005 |
| B3-Q07 | Edit or backdate the attempt time? | **No: attempt time = server now; not editable** | PH2 | Attempts are immutable facts (D20) | CODE | SCR-CC-003 |
| B3-Q08 | Reminder whose trigger time is already past | **Send immediately if the event is still in the future; skip (state "Skipped", visible to the Owner) if the event time has passed** | NEW | Late but useful reminders still go; useless ones don't | CODE | SCR-OWN-012, SCR-SHR-007 |
| B3-Q09 | Request lifecycle if DEC-016 picks request-and-approve | **Not needed** (DEC-016 = Owner only) | DP-B8 | Moot | — | SCR-CC-008 |
| B3-Q10 | Do-not-call received outside a call | **Agent or Owner logs an attempt with channel "Inbound / other" and outcome Rejected (reason required)** | NEW | Reuses the existing outcome path and audit | CODE | SCR-CC-003, SCR-CC-008 |
| B3-Q11 | "Callback requests" metric | **Businesses currently in Needs another call (stock snapshot)** | NEW | Matches the tile wording; no period ambiguity | CODE | SCR-OWN-001, SCR-OWN-009 |
| B3-Q12 / OQ-04 / B6 | Can Accepted change back; outcome when deal does not proceed; re-queue | **Agents cannot change Accepted. On Not proceeding the outcome stays Accepted; the Owner may re-queue (outcome → Pending, history kept, reason required)** | NEW; DEC-017 | Repeat business possible; one owner of the decision | CODE | SCR-OWN-007, SCR-DEV-002, SCR-CC-008 |
| B3-Q13 (C-02 sub) | Attempt logged without changing the outcome? | **No: every attempt records one of the four outcomes** (On hold covers no answer) | P6 SCR-CC-003 (four RadioCards, no "Pending") | Clean metrics; matches the design | CODE | SCR-CC-003 |
| B3-Q14 | Override: reason mandatory? how is the holder told? | **Reason mandatory; holder sees the in-app "Overridden by Owner" notice** | PH2; P6 SCR-CC-005 | Already drawn | CODE | SCR-CC-005, SCR-OWN-007 |
| B3-Q15 | Owner "Unassign" action | **Yes, Owner only** | PH2 | Agent 3 proposal; cleans queues | CODE | SCR-OWN-007 |
| B3-Q16 | Mandatory outcome fields | **Needs another call: follow-up or D2 marker. Rejected: reason. Accepted: client-needs note (min 10 chars). On hold: none** | PH2 (proposed fields); NEW | Minimum for a usable handoff | SET (min length) / CODE | SCR-CC-003 |
| B7 / "Assignee inactive" | Business assigned but hidden for its assignee | **Shown to the Owner as a flag; no automatic reassignment** | SB (R-02) | Baseline | — | SCR-OWN-007, SCR-CC-001 |

## 5. Deals, delivery and accounts (Batch 4, OQ-01..OQ-19)

| ID | Question | Working default | Source | Why (one line) | Reversible / how configurable | Screens affected |
|---|---|---|---|---|---|---|
| OQ-01 | Mandatory handoff fields at acceptance | **Business link + accepting agent + client-needs note (B3-Q16)** | PH2 + NEW | Developer needs the needs note to prepare | CODE | SCR-CC-003, SCR-CC-007 |
| OQ-02 | Developer meeting context under DEC-005 Alt 2 | **Moot** (DEC-005 Alt 1) | DP-A4 | — | follows DEC-005 flag | SCR-DEV-003/004 |
| OQ-03 | May Call Center record signature / payment / not proceeding? | **No: Owner and assigned Developer only** | NEW | Keeps commercial facts with the people who run the deal | CODE | SCR-DEV-002, SCR-CC-007 |
| OQ-05 | Must signature precede payment? | **No, order-independent; closure needs both** | PH2 | Deposits sometimes arrive first | CODE | SCR-DEV-002, SCR-DEV-008 |
| OQ-06 | Developer updates a project/task not assigned to them? | **No: only projects they are assigned to (any task in them); Owner any** | NEW | Clear responsibility; trivial to widen | CODE | SCR-DEV-005, SCR-DEV-006, SCR-DEV-007 |
| OQ-07 | One or several Developers per project? | **One or more, assigned by the Owner** | NEW; P6 per-Developer workload | Two developers may share a project | CODE | SCR-DEV-005/006, SCR-OWN-001 |
| OQ-08 | May Call Center / a Developer assign project Developers? | **Owner only** | PH2 | Only confirmed capability | CODE | SCR-DEV-005/006 |
| OQ-09 | Milestone: task attribute or entity? | **Task attribute (milestone flag + due date)** | NEW | Simplest data model | DATA (promote later) | SCR-DEV-006, SCR-DEV-007 |
| OQ-10 | Do open tasks block Delivered / Completed? | **Warn, do not block** | PH2; P6 | Already drawn | CODE | SCR-DEV-006 |
| OQ-11 | Cancelled / abandoned project status? | **Not in v1;** use Blocked + note; Owner may archive | NEW | Fewer states; DEC-019 list has none | CODE (enum) | SCR-DEV-005/006 |
| OQ-13 | Self-editable profile fields | **Photo and phone** | PH2 | Proposal | CODE | SCR-SHR-006 |
| OQ-14 | Reactivate a deactivated account? | **Yes, Owner, without restoring assignments** | PH2 | Proposal | CODE | SCR-OWN-002, SCR-OWN-003 |
| OQ-15 | Reopen Closed deal / Not proceeding deal / Completed project? | **Closed deal: never (new deal instead). Not proceeding → back to Accepted opportunity: Owner only, reason. Completed project → In progress: Owner only, reason** | NEW | Allows fixes without rewriting revenue history | CODE | SCR-DEV-002, SCR-DEV-006 |
| OQ-16 | Export of an empty result | **Export disabled when there are no rows** | P6 SCR-OWN-009 No data | Matches the drawn state | CODE | SCR-OWN-009 |
| OQ-17 | Period comparison of stock metrics | **Not in v1: "Comparison not available"** | PH2 | No snapshot tables needed | CODE (add snapshots later) | SCR-OWN-001, SCR-OWN-009 |
| OQ-18 | Audit-log viewing audited? Audit export? | **Viewing not audited; no audit export** | PH2; P6 (export disabled) | Already drawn | FLAG (export) | SCR-OWN-010 |
| OQ-12, OQ-19 | (see section 3) | — | — | — | — | — |

## 6. Business and visibility (Batch 2, OI-02..OI-29)

| ID | Question | Working default | Source | Why (one line) | Reversible / how configurable | Screens affected |
|---|---|---|---|---|---|---|
| OI-01 | DEC-013 alternative set | Settled by DEC-013 (NM-B + SN-1) | DP-B2 | — | — | SCR-DE-002/003 |
| OI-02 | Data Entry base access scope | **DE-1: any business, subject to the DEC-001/002 timer** | P6 SCR-DE-001 (directory of all records, "Created by" filter) | Data Entry fixes records created by others | FLAG (`DE-1|DE-2`) | SCR-DE-001, SCR-SHR-008, SCR-SHR-010 |
| OI-04 | "Day 16" boundary | **Calendar days in company timezone: hidden from 00:00 on creation date + 15** | NEW | Predictable for users | CODE | all visibility screens |
| OI-05 | Owner reads of hidden records audited? | **Yes, detail opens only (not list rows)** | NEW (C1 "subject to audit") | Cheap; satisfies C1 | SET (on/off) | SCR-SHR-008, SCR-OWN-010 |
| OI-06 | "Unless extended" / temporary access requests | **None in v1;** the Owner reassigns instead | D9; DEC-002 Alt B | Alt B makes extensions unnecessary | CODE | SCR-SHR-012 (no request button) |
| OI-07 | Owned items on a hidden business | **Redact owned items; omit browsed list rows (not counted)** | PH2 | Proposal | CODE | SCR-CC-004, SCR-DEV-003, SCR-SHR-007 |
| OI-08 | Correction queue under row 6 Alt A | **Moot** (row 6 Alt B) | DP-A3 | — | — | SCR-DE-006 |
| OI-09 | Requester's own request after the business is hidden | **Status visible, business redacted** | PH2 | Proposal | CODE | SCR-SHR-009, SCR-DE-006 |
| OI-10 | Direct-URL denial wording | **"Record hidden by policy" for timer denials; "Permission denied" otherwise** | PH2; P6 SCR-SHR-011/012 | Already drawn | CODE | SCR-SHR-011, SCR-SHR-012 |
| OI-11 | Previous values in edit history for non-owners | **Visible to anyone passing the access check, limited to fields that access level allows** | PH2 | Proposal | CODE | SCR-SHR-008 |
| OI-12 | Website "unknown" | **Keep binary checkbox; missing website handled by correction requests** | PH2 | ART-01 binary | CODE | SCR-DE-002/004 |
| OI-13 | Social accounts in duplicate checks | **Not checked in v1** | PH2 | Not an ART-01 rule | CODE | SCR-DE-002 |
| OI-14 | Shared phone across branches | **Phone blocks across branches (shared number = shared business)** | D11 | Phone blocking is Confirmed | CODE | SCR-DE-003 |
| OI-15 | Creation form as existence oracle | **Accepted risk; `business.duplicate_blocked` records hidden matches for the Owner** | PH2 | Inherent to the Confirmed whole-DB check | — | SCR-OWN-010 |
| OI-16 | Category authority / removal | CA-A + CR-1 (see DEC-015, C-01) | DP-B4, DP-A6 | — | — | SCR-DE-007 |
| OI-17 | DEC-001 Alt B details | **Moot** (Alt A) | DP-A2 | — | — | — |
| OI-18 | DEC-002 details: end of rows 1–2, "who" for rows 3–5 | **Row 1 ends when the deal closes (→ row 2) or is Not proceeding. Row 2: until project Completed + 15 days. Rows 3–5: the assigned Developer(s) / assigned agent** | D9; NEW | Consistent hand-over between rows | CODE | SCR-DEV-001, SCR-CC-007 |
| OI-19 | SM-DATAFIX-001 choices | **Accept as proposed** (In review guard; "Closed – no change needed"; withdraw; mandatory rejection reason; no reopening) | PH2 | Proposal | CODE | SCR-DE-005, SCR-DE-006, SCR-SHR-009 |
| OI-20 | Correction-request notifications | **Data Entry (shared queue) + Owner immediately; requester gets an in-app outcome notice** | D18 | — | SET | SCR-SHR-007, SCR-DE-006 |
| OI-21 | Mandatory name and category | **Yes; an "Other" category always exists** | PH2; D12 | Avoids empty-list block | CODE | SCR-DE-002 |
| OI-22 | "Business no longer operating" | **Owner archives (C-01)** | DP-A6 | — | — | SCR-DE-005 |
| OI-23 | Follower metrics | See DEC-014, DEC-023 | — | — | — | — |
| OI-24 | May Data Entry submit correction requests? | **No (they edit directly)** | PH2 | Proposal | CODE | SCR-SHR-009 |
| OI-25 | ART-11 D9 per-user timer | **Not adopted** | DP-A2 | — | — | — |
| OI-26 | Archived businesses in the duplicate scope | **Included** | PH2 | Prevents re-creating archived clients | CODE | SCR-DE-003 |
| OI-27 | Context-limited actions per DEC-002 row | **Accept proposals** (e.g. row 6: Data Entry may only apply the correction; row 5: agent may log the call) | PH2 | Proposal | CODE | SCR-DE-005, SCR-CC-003 |
| OI-28 | DEC-024 scope | **UNRESOLVED** — see DEC-024 | — | — | — | — |
| OI-29 | Meeting attendance alone does not grant access | **Accept** (mostly moot under DEC-005 Alt 1) | PH2 | Proposal | CODE | SCR-DEV-003 |

## 7. Attendance findings (Batch 1) and Phase 3–6 review items

| ID | Question | Working default | Source | Why (one line) | Reversible / how configurable | Screens affected |
|---|---|---|---|---|---|---|
| F-01 | Under DEC-011 Alt B, does a pending request block next-day check-in? | **No.** Submitting a correction for a still-open earlier session closes it provisionally at the proposed time (pending review), so check-in is allowed. The request form opens directly from the check-in block. If rejected, the Owner sets the effective time (or "unknown") | D5; NEW | Respects "one open session"; nobody is stuck | CODE | SCR-SHR-002, SCR-SHR-004, SCR-SHR-005, SCR-OWN-005 |
| F-02 | Work summary under DEC-026 Alt B | **Collected at the checkout attempt, before verification** | NEW | The summary is never lost | CODE | SCR-SHR-003 |
| F-03 | Punctuality after a check-in correction | **Re-derived from the effective (corrected) time, with an "adjusted" marker** | D4 (decisions.md) | Reports reflect the truth; the marker keeps it honest | CODE | SCR-SHR-004, SCR-OWN-004 |
| F-04 | Owner exempt from the office check? | **No exemption** (Owner remote days via DEC-010) | SB-1 §4 | Baseline (source ART-02 unavailable) | SET (exception) | SCR-SHR-002 |
| F-05 | Alert thresholds and recipients | See NOTIF (D18) | DP-B13 | — | SET | SCR-OWN-004 |
| N-2 | Missing check-in resolution | **Owner may create a retroactive session with a reason (audited); employee may request it via DEC-011 Alt B** | NEW | Gives the alert a closing action | CODE | SCR-OWN-004, SCR-OWN-005, SCR-SHR-005 |
| D5 (missing checkout) | Open session left at shift end | **Flag `missing checkout` at shift end + 6 h; never auto-close; resolution via F-01 path** | D5; architecture J-04 | Never guess a time | SET (hours) | SCR-OWN-004, SCR-SHR-004 |
| A1 | Attendance gating of work | **Not adopted: work lists usable without check-in** | SB; P6 SCR-SHR-001 | Baseline | — | SCR-SHR-001 |
| B-1 | "Accepted opportunities" snapshot definition | **Deal records currently in stage Accepted opportunity, excluding Signed, Paid, Closed and Not proceeding** | reconciliation §5 | Recorded definition | CODE | SCR-OWN-001 |
| RW-03 | Development workload definition | **Three sub-counts: non-terminal deals with the Developer · active projects · open tasks** | SB-3 §11; P6 | Recorded definition | CODE | SCR-OWN-001, SCR-DEV-005 |
| RW-04 | Where the Owner finds closure-verification items | **Owner deal list "Closure verification requested" filter + dashboard review count** | P6 SCR-DEV-001/002 (Owner view) | Already drawn | CODE | SCR-DEV-001, SCR-DEV-002, SCR-OWN-001 |
| AR-13 | Delivery monitor "Mark reviewed" | **Not built; "Send again" only (creates a new reminder; Owner; audited)** | Phase 3–4 brief AR-13 | No backing field; Failed stays terminal | CODE | SCR-OWN-012 |
| AR-14 | In-app notifications | **Yes, with read flag; list re-checks access at read time** | Phase 3–4 brief AR-14 | Proposed design | CODE | SCR-SHR-007 |
| AR-15 | Async UI states | **"Queued/pending" for reset emails and provisioning; exports synchronous** | Phase 3–4 brief AR-15; ADR-010 | — | — | SCR-AUTH-004, SCR-DEV-008, SCR-OWN-009 |
| OWN-008 "previous agent informed?" | Is the previous agent told on reassignment? | **Yes, in-app notice only** | NEW | Avoids surprise; no email noise | SET | SCR-OWN-008, SCR-SHR-007 |
| N-4 | Deactivating a correction reviewer | **In-review data-correction requests return to Submitted; all other work stays attached and flagged** | PH2 (SM-DATAFIX-001, WF-EMP-001) | Proposal | CODE | SCR-OWN-003 |

## 8. Implementation choices and company values

| ID | Question | Working default | Source | Why (one line) | Reversible / how configurable | Screens affected |
|---|---|---|---|---|---|---|
| IMPL-2FA | 2FA method | **TOTP authenticator app (Owner mandatory) + 10 recovery codes** | NEW | No SMS provider needed | CODE | SCR-AUTH-002, SCR-AUTH-003 |
| IMPL-SESSION | Session lengths | **Idle 2 h, absolute 12 h; pending-2FA session 10 min** | NEW | One workday per login | CFG | SCR-AUTH-001, SCR-SHR-013 |
| IMPL-LOCKOUT | Login lockout / throttle | **5 failed attempts per account in 15 min → 15 min lock; per-IP rate limit; same for 2FA codes** | NEW | Blocks guessing without long lockouts | CFG | SCR-AUTH-001, SCR-AUTH-002 |
| IMPL-PASSWORD | Password policy and reset link | **Min 12 characters, no composition rules; reset link single use, 60 min; reset signs out other sessions** | NEW | Modern guidance, low friction | CFG | SCR-AUTH-004, SCR-SHR-006 |
| VAL-TZ | Company timezone | **NEEDS VALUE** (placeholder `Asia/Beirut`) | D1 | — | SET | SCR-OWN-011 |
| VAL-IP | Office static public IP | **NEEDS VALUE** (does the office have one?) | D2 | — | SET | SCR-OWN-011 |
| VAL-HOLIDAYS | Company holiday list | **NEEDS VALUE** (empty list until entered) | DEC-022 | — | SET | SCR-OWN-011 |
| VAL-CC | Default phone country code | **NEEDS VALUE** (placeholder +961) | D11 | — | SET | SCR-OWN-011, SCR-DE-002 |
| VAL-CURRENCY | Default currency for deal amounts | **NEEDS VALUE** (placeholder USD) | DEC-018 | — | SET | SCR-DEV-002 |
| PROV-VPS / EMAIL / STORAGE / DNS | Hosting, transactional email, off-VPS backup storage, DNS | **NEEDS VALUE.** Constraint only: one VPS with Docker Compose; any SMTP-capable email service; S3-compatible storage for encrypted backups | ADR-011, ADR-013 | Provider choice is commercial | CFG | none |

---

## Coverage

| Group | Items | With a working default | NEEDS VALUE | Unresolved |
|---|---|---|---|---|
| User decisions | 3 | 3 | 0 | 0 |
| DEC-001 … DEC-026 | 26 | 25 | 4 (DEC-007, 008, 009, 022) | 1 (DEC-024: meaning undefined; "no behaviour" default) |
| Architecture, rulings, delivery (ADR, R-06/10/11/12/13, C-01, C-02, D4, B2, F2, F3, NOTIF, overdue, C1, OQ-12, C3/OQ-19, commercial stages) | 18 | 18 | 2 (B2 country code, C1 backup provider) | 0 |
| B3-Q01..Q16 (+ B7) | 17 | 17 | 0 | 0 |
| OQ-01..OQ-19 (16 rows in §5; OQ-04 under B3-Q12; OQ-12/19 in §3) | 19 | 19 | 0 | 0 |
| OI-01..OI-29 (OI-03 under B2) | 28 | 27 | 0 | 1 (OI-28 = DEC-024) |
| F-01..F-05, N-2, N-4, D5, A1, B-1, RW-03, RW-04, AR-13/14/15, OWN-008 | 16 | 16 | 0 | 0 |
| Implementation and company values | 10 | 10 | 6 (TZ, IP, holidays, country code, currency, providers) | 0 |

**Could not resolve (needs the Owner or missing source):**
1. **DEC-024** (Social Media Platform Ingestion Priority): no document defines what it means. Default is "no behaviour"; ask the Owner what it was meant to cover.
2. **Company values** (NEEDS VALUE): timezone, office static IP (and whether one exists), working days/hours confirmation, grace confirmation, holiday dates, phone country code, default currency.
3. **Providers** (NEEDS VALUE): VPS, email, backup object storage, DNS.
4. **F-04 source**: "no Owner exemption from the office check" rests on ART-02, which is unavailable. The baseline rule is applied as is.

**Handoff note:** `phase6/handoff-ready.md` §9 says to build every pending alternative behind a flag and select none. With this file, build the default above as live behaviour. Keep a flag only where the configurability column says `FLAG`. Keep the policy chips out of the production UI. Settings (`SET`) start at the values given here, except NEEDS VALUE items, which start as "Not configured" on SCR-OWN-011 (attendance checks stay inactive until the timezone, schedule and office mode are saved).
