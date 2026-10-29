# Udigity Management System — Policy Decisions

Status of every open item from §20 of the product description (plus the archiving question in §2.1).
Each entry has a **proposed default** and the reasoning. Items marked **NEEDS INPUT** depend on facts only the company knows.

Legend (D-sections, history): `PROPOSED` = recommended default, awaiting sign-off · `NEEDS INPUT` = requires company-specific values · `APPROVED` = signed off.

> **Authority (updated 2026-10-29):** the **approved source** is the Owner's policy baseline [policy-baseline-2026-10-29.md](policy-baseline-2026-10-29.md) (ART-15, tier 1). The section "Approved decisions (2026-10-29 baseline)" below records it against the canonical IDs. The canonical decision IDs are **DEC-001 … DEC-026** (FigJam Board 01, section `28:534`), extended here with **DEC-027 … DEC-034** for baseline topics that had no DEC ID. D1–D20 are section labels only. The D-sections further below (ART-11) are the earlier **unapproved AI proposals** (tier 4); where they conflict with the baseline they are **superseded and kept as history** (see "Supersession log").
>
> _Previous note (2026-10-20, history):_ every item in this file is an unapproved AI proposal (source tier 4). D-numbers are local labels for proposals only; they do not replace or redefine DEC IDs.

## Approved decisions (2026-10-29 baseline)

Source: ART-15, Owner message 2026-10-29. "§Dn" = section of the baseline. Status `APPROVED — company input pending` = the policy is approved but enforcement waits for the listed company values (baseline §"Company inputs still required"); do not activate it with assumed values. "Board alternatives" = Board 01 / decision-pack alternatives; "policy-defaults" = the 2026-10-23 delegated working default (not approved).

| DEC | Title | Approved choice | Baseline § | Status | Relation to prior alternatives |
|---|---|---|---|---|---|
| DEC-001 | 15-Day Policy Trigger Basis | Data Entry: 15 elapsed days from creation; editing does not restart. Call Center: 15 elapsed days from assignment; reassignment ends the old agent's access and starts the new agent's window. Calls, notes, edits never reset. Owner exempt | D9 | APPROVED | **Third option (not an existing alternative)**: neither Alt A (creation, no reset) nor Alt B (inactivity). Same as ART-11 D9's alternative minus D9's "or last edited it". Supersedes policy-defaults Alt A and OI-25 |
| DEC-002 | Active-Work Visibility Exceptions | Assigned CC agent: callback access through callback time + 48 h. Assigned Developer: accepted opportunity while assigned and active. Correction requester: while their request is open. Closed deal with active project: Developers while active and 15 days after completion. All subject to role permissions; no access for former assignees from past interaction; one server-side policy everywhere (lists, search, detail, calendar, notifications, reports, exports, API); no leak via counts/previews/cache | D9 | APPROVED | **Close to Board Alt B, not identical**: row 5 (callback + 48 h) and row 4 (completed + 15 days) match Alt B. Row 1 names the assigned Developer only (Alt B: Developer + Call Center). Rows 2–3 merged: closed deal visible while its project is active (Alt B row 2: closed deal exempt company-wide). Row 6: the *requester* keeps access (Alt B: Data Entry correction queue). Conflicts with D9's "open follow-up" rule (S-02) |
| DEC-003 | Hidden Record Match Revelation Scope | Reveal only "This business already exists", matched field type (phone/name), business name and category, creation date. No phones, socials, notes, assignee. No access granted. "Request Owner review" with optional explanation, audited, no automatic access. General temporary-access grants out of scope | D10 | APPROVED | Decision-pack options **(ii) ART-11 D10 + (iii) escalation** (Board recorded no alternatives). Supersedes policy-defaults (i) existence only |
| DEC-004 | Contact Reservation Lease Duration & Idle Rule | Lease 5 min renewed by a 60 s heartbeat; release after 15 min without input (warning at 13); tab switch is not a release; max 60 min then "Keep working"; Owner force-release with reason. Reservation ownership and expiry enforced server-side (§D8) | D8 | **APPROVED (Owner selection 2026-10-29)** | Baseline §D8: present the exact existing proposal; do not invent or silently approve a duration |
| DEC-005 | Developer Scoping Access to Accepted Opportunities | Accepted opportunities: assigned Developer and Owner only, with contact details, relevant call notes, client requirements. No general directory browsing. Project visibility grants no right over financial verification or others' attendance | D15 | APPROVED | **Matches Alt 1** (assigned scoping access) |
| DEC-006 | Authority to Record or Approve Commercial Closure | Developer may submit "payment received" for Owner verification; only Owner verification makes the deal commercially closed; Owner may record and verify directly | D16 | APPROVED | **Matches Alt B** (Owner verification; decision-pack B10) |
| DEC-007 | Workday Schedule & Hours | 9 h per scheduled working day; proposed Mon–Fri from 09:00, timezone Asia/Beirut; shift end = start + 9 h; "today", targets, attendance dates, report boundaries in company timezone; one company schedule (per-employee recurring shifts out of scope); history keeps schedule context | D1 | APPROVED — company input pending (working days, start time, timezone) | Matches ART-11 D1 with proposed values filled in; values still to be confirmed |
| DEC-008 | Late Arrival Grace Period | 10 minutes; late strictly after start + grace; grace does not reduce the 9 h duration | D1 | APPROVED | Matches ART-11 D1 grace row |
| DEC-009 | Office Restriction Mechanism | Public IP/CIDR allowlist; client-IP headers trusted only from explicitly trusted proxies; network-location check, not proof of presence; login/ordinary access not office-gated; geolocation fallback disabled; no stable IP → separate explicit decision (never silent geofencing or allow-all) | D2 | APPROVED — company input pending (static-IP availability, IP/CIDR values) | Matches ART-01 §4.2 mode "IP only" and ART-11 D2, **without** D2's optional "IP OR geofence" fallback (S-06). Resolves C-03 |
| DEC-010 | Remote Work Permissions & Verification Fallback | Sign-in from anywhere; attendance actions need office verification unless the Owner grants a remote exception (employee + date/range), reason required, audited, labelled remote; employees cannot grant their own | D3 | APPROVED | Matches ART-11 D3 (adds mandatory reason + audit) |
| DEC-011 | Attendance Correction Authority | Employee requests with proposed times + reason; Owner approves/rejects; Owner may adjust directly with mandatory reason; originals preserved; corrections separate, effective value with "adjusted" marker; no overlapping/invalid sessions; all audited | D4 | APPROVED | **Matches Alt B** (employee request; decision-pack B5) |
| DEC-012 | Checkout Work Report Requirement | "Work completed" required, ≥ 10 non-whitespace characters; outstanding tasks, blockers, notes optional; target progress automatic; Owner may complete it as a correction with a recorded reason | D6 | APPROVED | Matches ART-11 D6 (tightened to non-whitespace characters; adds Owner completion) |
| DEC-013 | Name-Only Duplicate Blocking & Branch Handling | Name: normalize case, whitespace, punctuation; exact normalized name + normalized branch blocks; similar names (pg_trgm ≥ 0.6) warn only and respect visibility. Optional branch field; same name, different branch allowed; both branches absent = duplicate. Phone: E.164, exact match on any business phone blocks, also across branches; Owner resolves shared numbers. Exclude edited record; concurrency-safe uniqueness; detect existing collisions before constraints; no auto-merge/delete | D11 | APPROVED — company input pending (default phone country code; do not normalize real data with an assumed code) | **Matches NM-B + SN-1** (decision-pack B2) and ART-11 D11 |
| DEC-014 | Unknown Social Media Metrics Handling | Followers / last-post date may be unknown; unknown ≠ zero, shown explicitly; observation time stored; unknown is its own report/filter bucket, excluded from averages | D13 | APPROVED | Matches ART-11 D13 and Board "Proposed" |
| DEC-015 | Category Management Authority | Owner creates, renames, deactivates (never deletes); Data Entry selects; "Other" + suggestion in notes; historical association kept; future delegation needs an explicit policy change, not a hidden toggle | D12 | APPROVED | **Matches CA-A** (decision-pack B4) |
| DEC-016 | Rejected Record Reopening Authority | Owner only; mandatory reason; outcome back to pending; call history kept; audited; reopening does not assign | D14 | APPROVED | Matches "Owner only" (decision-pack B8; ART-11 D14). Board recorded no alternatives |
| DEC-017 | Multiple Deals / Services per Business | Multiple deals over time; at most one active opportunity/deal at a time; at most one delivery project per verified closed deal; project created only after verified closure, idempotently | D17 | APPROVED | Matches "Single open deal only" branch (decision-pack A7) and ART-11 D17. Re-queue after not proceeding (B6) not addressed |
| DEC-018 | Financial Field Governance & Evidence | First payment received (deposit counts) = closure, not full settlement; evidence: agreement reference + payment date; file attachments optional in v1; amount and currency optional, currency required when amount exists; missing ≠ zero; Owner controls verified financial changes; prior values preserved and audited; revenue reports separate contract amount, payments received, missing values | D16 | APPROVED | Matches ART-11 D16 / decision-pack B11 recommendation, with additions. Note: "attachments optional in v1" vs ADR-012 "no attachment storage" — not reconciled here |
| DEC-019 | Service Delivery State Machine | Project states Not started → In progress → Completed; On hold from an active state; cancellation needs an Owner reason and keeps history; Owner may reopen a completed project with a reason; completion ≠ financial settlement | D17 | APPROVED | **Third option (not an existing alternative)**: differs from the Board-proposed / ART-01 §13 status list used in policy-defaults (Scheduled, In progress, Waiting for client, Blocked, Delivered, Completed) (S-10) |
| DEC-020 | Daily Target Metric Definitions | Credit the actor; company-timezone dates. Data Entry: valid businesses created, once per record. Call Center: distinct businesses with ≥ 1 logged contact attempt that day. Developer: tasks completed per week. Secondary metrics shown, not targets. Edits don't count; reopen/complete cycles don't inflate. No invented quotas | D7 | APPROVED — company input pending (numeric targets) | Matches ART-11 D7 |
| DEC-021 | Automated Work Allocation Logic | Manual assignment + Owner-triggered "Auto-fill queues": eligible, unassigned, non-rejected, oldest first, round-robin over active agents; queue cap 40 **current eligible assigned businesses** per agent (a cap, not a quota); never move businesses with an open follow-up, active reservation, accepted opportunity or active deal; no scheduled automatic reassignment in v1; explicit reassignment audited | D8 | APPROVED | Matches ART-11 D8 / Board "Proposed" in shape; **cap changed** from "daily queue size" to a current-stock cap (S-04) |
| DEC-022 | Weekly Rest Days & Scheduled Days Off | Owner maintains company holidays and approved employee days off; both suppress missing-check-in alerts and attendance obligations for that employee/date; per-employee recurring shifts out of scope | D1 | APPROVED — company input pending (working days, initial holiday calendar or Owner confirmation) | Extends decision-pack B6 recommendation; supersedes policy-defaults "no per-employee days off in v1" (S-11) |
| DEC-023 | Follower-Count Tracking Granularity | Latest values + observation timestamps; full history and trend charts deferred | D13 | APPROVED | Matches policy-defaults / ART-11 D13 (partial). Board recorded no alternatives |
| DEC-024 | Social Media Platform Ingestion Priority | Manual entry and links for the currently supported platforms; automated ingestion deferred; no scraping or third-party ingestion purchase authorized | D13 | APPROVED | Relation to board alternatives not verifiable (Board title only; meaning was undefined, OI-28) |
| DEC-025 | Target Allocation Frequency & Review Cycle | Daily targets on scheduled working days; weekly targets Mon–Sun in company timezone; Owner sets numeric targets and reviews weekly; no retroactive changes | D7 | APPROVED — company input pending (numeric targets per role, or confirmation they stay unset) | Matches policy-defaults DEC-025 / ART-11 D7 |
| DEC-026 | Failed Checkout Handling Policy | Authenticated checkout failing office verification closes provisionally at the server-received attempt time, marked pending review with the failure reason; no bypass of auth/CSRF/validation; no request received → no invented checkout; Owner confirms or corrects | D5 | APPROVED | **Matches Alt B** (closed provisionally + Owner review) with Alt C's "pending review" label. Open point: whether a provisional pending-review session counts as "unresolved" for §D5's next-check-in block (S-18) |
| **DEC-027** (new) | Missing-checkout flag | Sessions still open at scheduled shift end + 6 h flagged "missing checkout"; never auto-closed with a guessed time; no new check-in while a previous session is unresolved; correction-request action shown on the check-in screen; no trapping without a resolution path | D5 | APPROVED | Matches ART-11 D5 (part), previously no DEC ID |
| **DEC-028** (new) | Commercial stage list and transitions | accepted → meeting scheduled → proposal sent → signed → payment pending verification → verified closed; forward stages may be skipped; non-closed opportunity may be marked lost with a reason | D16 | APPROVED | Differs from ART-11 D16 stage names (S-08) and from policy-defaults OQ-03/05/15 row |
| **DEC-029** (new) | Notifications: timing, recipients, delivery | All events in-app; email secondary. Follow-up digest: agent at shift start. Due: agent −15 min. Overdue: agent +1 h, Owner daily digest. Meetings: assigned Developer + CC agent −24 h and −1 h. Missing check-in: Owner at start + grace + 30 min, working days only. Missing checkout: employee at shift end + 1 h, Owner next scheduled morning digest. Assignment/handoff: assignee immediately. Data correction request: responsible Data Entry employee + Owner. Attendance correction request: Owner. Delivery failure: Owner in-app, deduplicated. Background delivery, bounded retries; failure never rolls back the action; current access respected; states queued / provider-accepted / delivered (where confirmed) / failed / test-captured; no usable tokens in logs; real-email tests need approved recipients | D18 | APPROVED | Matches ART-11 D18 timings (no value differences); adds delivery rules |
| **DEC-030** (new) | Backup and recovery objectives | Nightly DB backup + continuous WAL archiving; encrypted, outside the app server; retention 14 daily / 8 weekly / 6 monthly; RPO ≤ 15 min; RTO ≤ 4 h; restore drill before launch and at least quarterly; monitor backup/WAL failures; separate backup credentials. Objectives until demonstrated; nightly-only needs an explicit pre-launch exception; provider/spend/infra need separate approval | D19 | APPROVED (objectives; provider pending separately) | Matches ART-11 D19 values; supersedes decision-pack C1 / policy-defaults C1 "RPO 24 h, no WAL at first" (S-14) |
| **DEC-031** (new) | Archiving, deletion and restoration | No hard deletes via the normal application; archive/deactivate businesses, employees, deals, categories; relationships/history kept; deactivation revokes access and blocks login; call attempts, attendance events, audit keep originals (additive corrections); Owner restores subject to validation and duplicate checks; no automatic restore of sessions, credentials, MFA secrets; archived phones/names stay in duplicate detection; privacy/legal erasure needs a separate procedure; no blanket indefinite retention | D20 | APPROVED | Matches ART-11 D20 / decision-pack A6 "archive". **Supersedes Board 01 `27:443` "Business Deletion: Owner Only [Confirmed]"** (S-01). Resolves C-01 |
| **DEC-032** (new) | Fixed roles | Four roles: Owner, Data Entry, Call Center, Developer; no custom-role management | Fixed v1 scope | APPROVED | Supersedes the user-added custom roles/roles page (S-19) |
| **DEC-033** (new) | Break tracking | No break tracking in v1 | Fixed v1 scope | APPROVED | Supersedes the user-added breaks feature (S-19) |
| **DEC-034** (new) | Exports | Synchronous streaming exports with bounded resource protection | Fixed v1 scope | APPROVED | Matches ADR-010 / AR-15 |

Also stated in the baseline as unchanged (no new ID): mandatory MFA baseline; existing approved visual designs remain approved (see ART-16).

### DEC-004 — awaiting Owner selection

No canonical register entry approved DEC-004 values: Board 01 status "Proposed" with values undecided (`phase2/batch3/batch3-spec.md:176`); `policy-defaults.md:3` states its entries are not approved; `implementation/status-2026-10-23.md:118` flags the settings page's "15 Minutes (Approved Default)" label as unapproved. The only explicit Owner decision near this topic is U-01 "Accepted keeps the contact reservation" (`policy-defaults.md:25`), which does not set lease or idle values.

Exact existing proposal (`policy-defaults.md:36`, delegated working default 2026-10-23):

> **Lease 5 min, renewed by a heartbeat every 60 s while the contact workspace is open. Idle rule: no user input for 15 min ends the reservation (warning "Expiring" at 13 min). Tab switch / blur is not a release. Max total 60 min, then renew by explicit "Keep working". Owner force override allowed, reason required.**

Same values as configuration defaults (`implementation/plan.md:267-272`): `POLICY_RESERVATION_LEASE_SECONDS=300`, `POLICY_RESERVATION_HEARTBEAT_SECONDS=60`, `POLICY_RESERVATION_IDLE_MINUTES=15`, `POLICY_RESERVATION_IDLE_WARNING_MINUTES=13`, `POLICY_RESERVATION_MAX_TOTAL_MINUTES=60`, `POLICY_RESERVATION_OWNER_OVERRIDE=true`.

**Owner answer (2026-10-29):** ☑ Approve as above. DEC-004 is **APPROVED** with exactly these values.

### Supersession log (2026-10-29)

Earlier text stays where it lived; this log records what the baseline changes. "PD" = policy-defaults.md (working defaults, not approved).

| # | Superseded text (brief) | Where it lived | Now | Baseline § |
|---|---|---|---|---|
| S-01 | "Business Deletion: Owner Only [Confirmed]" | Board 01 `27:443` (ART-04); artifact-register C-01 | Archive-only, no hard deletes in the normal application (DEC-031) | D20 |
| S-02 | Callback exception "They have an open follow-up on it" | decisions.md D9 | Callback time + 48 h (DEC-002) | D9 |
| S-03 | Data Entry timer "from the time they created the record (or last edited it)" | decisions.md D9 | From creation; editing does not restart (DEC-001) | D9 |
| S-04 | "up to a configurable daily queue size per agent (default 40)"; PD "up to 40 per agent per day" | decisions.md D8; PD DEC-021 | Cap of 40 current eligible assigned businesses per agent; also never move accepted opportunities / active deals (DEC-021) | D8 |
| S-05 | "A scheduled daily run can be enabled later" | decisions.md D8 | No scheduled automatic reassignment in v1 (DEC-021) | D8 |
| S-06 | Fallback setting "IP OR geofence" (off by default); PD mode list incl. geofence | decisions.md D2; PD DEC-009 | Geolocation fallback disabled; no stable IP → separate explicit decision (DEC-009) | D2 |
| S-07 | "Existence only … no escalation action" | PD DEC-003 | Matched field type, name, category, creation date + "Request Owner review" (DEC-003) | D10 |
| S-08 | Stages "accepted → meeting scheduled → proposal sent → signed → paid (closed)"; PD "Signed / Paid in any order (OQ-05) → Closed; Not proceeding" | decisions.md D16; PD OQ-03/05/15 row | "… signed → payment pending verification → verified closed", forward skips, "lost" with reason (DEC-028). Whether OQ-05 order-independence still holds is not stated | D16 |
| S-09 | "Who closes: Developer marks `paid` → `closed — pending verification`" | decisions.md D16 | Developer submits "payment received"; only Owner verification closes (DEC-006) — same intent, different state naming | D16 |
| S-10 | Project statuses "Scheduled, In progress, Waiting for client, Blocked, Delivered, Completed"; OQ-11 "no Cancelled status in v1" | PD DEC-019, OQ-11 | Not started → In progress → Completed, On hold, Owner cancellation with reason (DEC-019) | D17 |
| S-11 | "no per-employee days off in v1" | PD DEC-022 | Owner maintains approved employee days off (DEC-022) | D1 |
| S-12 | DEC-001 "Alt A: creation-based"; OI-25 "ART-11 D9 per-user timer: Not adopted" | PD DEC-001, OI-25 | Per-role creation/assignment basis (DEC-001) | D9 |
| S-13 | DEC-002 "Alt B on all 6 rows" (row 1 Developer + CC agent; row 6 Data Entry queue) | PD DEC-002 | Rows as in DEC-002 above | D9 |
| S-14 | "RPO 24 h (nightly encrypted dump, no WAL at first)" | PD C1; decision-pack C1 recommendation | WAL archiving, RPO ≤ 15 min; nightly-only needs an explicit exception; drill also before launch (DEC-030). D19 values (14/8/6, 15 min, 4 h) unchanged | D19 |
| S-15 | "Work completed (min. 10 characters)" | decisions.md D6; PD DEC-012 | ≥ 10 **non-whitespace** characters (DEC-012) | D6 |
| S-16 | Placeholder country code +961 as working value | PD B2, VAL-CC | Must be confirmed; do not normalize real data with an assumed code (DEC-013) | D11 |
| S-17 | DEC-024 "UNRESOLVED meaning; no behaviour in v1" | PD DEC-024, OI-28 | Manual entry + links; automated ingestion deferred (DEC-024) | D13 |
| S-18 | DEC-026 "Never blocks the next check-in"; F-01 "pending request does not block" | PD DEC-026, F-01 | "Prevent a new check-in while a previous session remains unresolved" (DEC-027). **Interpretation needed:** whether a provisional / correction-pending session is "unresolved" | D5 |
| S-19 | User-added custom roles / roles page and break tracking (built: coordination.md FX-ACCESS, FX-BE-C10) | Implementation; memory "user additions" | Four fixed roles, no custom-role management, no break tracking (DEC-032, DEC-033). Code follow-up needed (not done here) | Fixed v1 scope |
| S-20 | DEC-004 "15 Minutes (Approved Default)" label | `frontend/src/app/settings/page.tsx:148` (per status-2026-10-23.md:118) | Not approved; DEC-004 awaits Owner selection | D8 |

| S-21 | "Per-employee recurring shift schedules remain out of scope for v1"; launch schedule Mon–Fri 09:00 | Baseline §D1 | Owner answer 2026-10-29: company default schedule plus an optional per-employee **start time** and **working days** set by the Owner (employees start 08:00 or 09:00). Timezone Asia/Beirut; 9 h duration, grace and holidays stay company-wide (DEC-007, DEC-022) | D1 |
| S-22 | "Office attendance uses a configured public IP/CIDR allowlist"; no stable IP → separate decision | Baseline §D2 | Owner answer 2026-10-29: no static office IP → **dynamic DNS hostname** of the office router, resolved by the server (cached ≤ 5 min, last-known IPs kept ≤ 60 min on failure, then fail closed); IP/CIDR list still accepted. Never allow-all, no geolocation (DEC-009) | D2 |
| S-23 | "Encrypted storage outside the application server" | Baseline §D19 | **Owner-approved exception 2026-10-29:** encrypted backups in a backup container **on the same server**. Risk accepted: losing the server or disk loses the database and its backups together. Off-server copy (`RCLONE_REMOTE`) remains the upgrade path (DEC-030) | D19 |
| S-24 | S-18 interpretation | This log | Owner answer 2026-10-29 (via the delivered implementation): a provisional / pending-review checkout does **not** block the next check-in; an open session from an earlier day does | D5 |

**Owner answers to the company-input questions (2026-10-29):**

| # | Question | Answer |
|---|---|---|
| 1 | Schedule | Asia/Beirut; per-employee start time (08:00 or 09:00) and working days, set by the Owner (S-21) |
| 2 | Holidays | Owner enters them in Settings before attendance enforcement begins |
| 3 | Office network | No static IP → dynamic DNS hostname (S-22) |
| 4 | Default phone country code | **None** — every phone number is entered with its country code |
| 5 | Numeric targets | Unset; the Owner creates them on the Targets page |
| 6 | DEC-004 | Approved as proposed (above) |
| — | Accepted opportunities | Keep baseline: assigned Developer + Owner only (Call Center loses the Opportunities page) |
| — | Grace precision | To the second (late iff check-in > start + grace) |
| — | Invitation (set-password) link | 72 hours (password reset links: 30 minutes) |
| — | Closure evidence | As baseline: agreement reference + payment date required; signature date and payment reference optional |
| — | Restore with an inactive category | The Owner picks an active category during restore (audited) |
| — | Hosting / email / backups | VPS; Brevo or SendGrid SMTP; backups on the same server (S-23) |

**D-proposal values checked with no change:** grace 10 min (D1), missing-checkout flag shift end + 6 h (D5), queue cap value 40 (D8; meaning changed, S-04), similar-name threshold 0.6 (D11), all D18 notification timings, D19 retention 14/8/6, RPO 15 min with WAL, RTO 4 h.

## Mapping to the DEC register

_History (2026-10-20). Board status and relations below predate the baseline; current status is in "Approved decisions (2026-10-29 baseline)" above._

Matched by meaning. "Exact" means D answers the same question as the DEC; it does not mean the DEC is resolved.

| DEC | DEC title (from Board 01) | Board status | D item | Relation | Notes |
|---|---|---|---|---|---|
| DEC-001 | 15-Day Policy Trigger Basis | Unresolved alternative | D9 (timer part) | **Partial overlap** | D9 proposes a third alternative (count from creation or assignment, no reset). It is neither Alt A nor Alt B |
| DEC-002 | Active-Work Visibility Exceptions | Unresolved table | D9 (exceptions part), D15 | **Partial overlap + conflict** | Matches Alt B on accepted opportunities, closed deals, active projects and correction requests. **Conflicts** on callbacks: D9 says "while follow-up is open"; Alt B says "until callback datetime + 48h". D9 also keeps completed projects visible 15 days after completion (≈ Alt B row 4) |
| DEC-003 | Hidden Record Match Revelation Scope | Unresolved | D10 | **Exact + partial conflict** | D10 grants no access. UC-BIZ-003 includes "Request Escalation", which D10 does not provide |
| DEC-004 | Contact Reservation Lease Duration & Idle Rule | Proposed | — | **No D item** | |
| DEC-005 | Developer Scoping Access to Accepted Opportunities | Unresolved alternative | D15 | **Exact** | D15 recommends Alternative 1 (assigned scoping access) |
| DEC-006 | Authority to Record or Approve Commercial Closure | Unresolved | D16 (closer row) | **Partial overlap** | D16 also covers stages, payment definition and money fields |
| DEC-007 | Workday Schedule & Hours | Unresolved | D1 | **Partial overlap** | D1 also covers timezone and grace |
| DEC-008 | Late Arrival Grace Period | Unresolved | D1 (grace row) | **Exact** (sub-item) | |
| DEC-009 | Office Restriction Mechanism | Unresolved | D2 | **Exact** | |
| DEC-010 | Remote Work Permissions & Verification Fallback | Unresolved | D3; D2 fallback | **Exact** (D3) + partial (D2) | |
| DEC-011 | Attendance Correction Authority | Unresolved | D4 | **Exact** | |
| DEC-012 | Checkout Work Report Requirement | Unresolved | D6 | **Exact** | |
| DEC-013 | Name-Only Duplicate Blocking & Branch Handling | Unresolved | D11 | **Exact** | D11 also proposes phone normalization and a non-blocking similar-name warning |
| DEC-014 | Unknown Social Media Metrics Handling | Proposed | D13 | **Exact** | |
| DEC-015 | Category Management Authority | Unresolved | D12 | **Exact** | |
| DEC-016 | Rejected Record Reopening Authority | Unresolved | D14 | **Exact** | |
| DEC-017 | Multiple Deals / Services per Business | Unresolved | D17 | **Exact** | D17 also proposes automatic project creation (overlaps ART-01 §13 open item) |
| DEC-018 | Financial Field Governance & Evidence | Unresolved | D16 (evidence, money, payment rows) | **Partial overlap** | |
| DEC-019 | Service Delivery State Machine | Proposed | — | **No D item** | ART-01 §13 lists proposed statuses |
| DEC-020 | Daily Target Metric Definitions | Unresolved | D7 | **Exact** | |
| DEC-021 | Automated Work Allocation Logic | Proposed | D8 | **Exact** | |
| DEC-022 | Weekly Rest Days & Scheduled Days Off | Unresolved | D1 (working days row) | **Partial overlap** | D1 doesn't cover holidays or individual days off |
| DEC-023 | Follower-Count Tracking Granularity | Unresolved | D13 (`metrics_recorded_at`) | **Partial overlap** | D13 doesn't decide on keeping metric history |
| DEC-024 | Social Media Platform Ingestion Priority | Proposed | — | **No D item** | |
| DEC-025 | Target Allocation Frequency & Review Cycle | Unresolved | D7 (daily/weekly) | **Partial overlap** | |
| DEC-026 | Failed Checkout Handling Policy | Unresolved alternative | D5 | **Exact** | D5 also adds an auto-flag for missing checkouts (new) |

**D items with no DEC counterpart.** _(2026-10-29: these now have approved IDs: D5 part → DEC-027, D16 part → DEC-028, D18 → DEC-029, D19 → DEC-030, D20 → DEC-031; the table below is kept as history.)_ These were new proposals; no DEC ID had been assigned:

| D item | Topic | Relation |
|---|---|---|
| D5 (part) | Auto-flag open sessions as "missing checkout" | New proposal |
| D16 (part) | Commercial stage list and transitions | New proposal. No DEC covers commercial transitions |
| D18 | Notification timing and recipients | New proposal. ART-01 §20 lists this decision; the DEC register lacks it |
| D19 | Backup and recovery objectives | New proposal. ART-01 §20 lists this decision; the DEC register lacks it |
| D20 | Deletion vs archiving | New proposal; **conflicts** with Board 01 `27:443` "Business Deletion: Owner Only [Confirmed]". See artifact-register C-01 |

---

## D1. Attendance schedule — NEEDS INPUT

| Setting | Proposed default | Notes |
|---|---|---|
| Working days | _company to confirm_ (e.g. Mon–Fri or Sun–Thu) | Stored as a company setting, editable by Owner |
| Shift start | _company to confirm_ (e.g. 09:00) | |
| Required duration | 9 hours (confirmed) | |
| Timezone | _company to confirm_ (IANA name, e.g. `Asia/Beirut`) | All "today" calculations, targets, and reports use this zone |
| Late grace period | 10 minutes | Check-in after start + grace = late |

Per-employee schedule overrides are **out of scope for v1**; everyone shares one company schedule.

## D2. Office verification — PROPOSED (needs office IP)

> Superseded by baseline §D2 on 2026-10-29: IP/CIDR allowlist only; the "IP OR geofence" fallback is dropped (geolocation disabled); see DEC-009, S-06.

**Office public IP allowlist only.**

- Browser geolocation is easy to spoof, often inaccurate indoors, and needs a permission prompt every device — it adds friction without real assurance.
- Requires the office to have a static public IP (or a small set). **NEEDS INPUT:** confirm the office has one.
- Fallback setting, off by default: `IP OR geofence` for offices without a static IP.
- The server reads the client IP from the reverse proxy header, configured to trust only our own proxy.

## D3. Remote access — PROPOSED

- **Login is allowed from anywhere.** Employees can view their queue, notes, calendar from home.
- **Attendance actions require office verification.**
- The Owner can grant a **remote attendance exception** for a specific employee and date (or date range). Sessions recorded under an exception are labelled `remote` in reports.

## D4. Attendance corrections — PROPOSED

**Both paths, both audited:**

- Employee submits a correction request (proposed times + reason) → Owner approves or rejects.
- Owner can also adjust directly (reason required).
- The original timestamps are never overwritten; corrections are stored as a separate record and the report shows the effective value with an "adjusted" marker.

## D5. Failed checkout verification — PROPOSED

**Record provisionally as `pending review`** (do not block).

- Blocking produces forgotten-checkout sessions, which are worse data than a flagged timestamp.
- The session closes with the attempted time, flagged with the failure reason; the Owner confirms or corrects it.
- Sessions still open at **shift end + 6 hours** are auto-flagged `missing checkout` (not auto-closed with a guessed time). The employee cannot check in again until it is resolved via D4 — the request form is shown directly on the check-in screen so they're never stuck.

## D6. Work summaries — PROPOSED

> Superseded by baseline §D6 on 2026-10-29: minimum is 10 non-whitespace characters; Owner may complete it as a correction with a reason; see DEC-012, S-15.

**Mandatory, but short.** Required: "Work completed" (min. 10 characters). Optional: outstanding tasks, blockers, notes. Target progress is filled in automatically by the system.

## D7. Targets — PROPOSED

Targets are daily unless noted; counted by the employee who performed the action, by company-timezone date.

| Role | Primary metric | Secondary (shown, not targeted) |
|---|---|---|
| Data Entry | Businesses created (that passed validation) | Correction requests resolved; records updated |
| Call Center | Distinct businesses contacted (≥1 logged attempt) | Total call attempts; accepted opportunities |
| Developer | Tasks completed — **weekly** target | Milestones delivered |

Developer work doesn't fit a daily count, hence weekly. Edits to existing records do not count toward the Data Entry primary target (prevents trivial edits padding numbers).

## D8. Automatic allocation — PROPOSED

> Superseded by baseline §D8 on 2026-10-29: cap is 40 current eligible assigned businesses per agent (not a daily size); also never moves accepted opportunities or active deals; no scheduled run in v1; see DEC-021, S-04, S-05.

v1 = **manual assignment + an Owner-triggered "Auto-fill queues" action**:

- Takes unassigned, non-rejected businesses, oldest first.
- Distributes round-robin across active Call Center agents, up to a configurable daily queue size per agent (default 40).
- Never moves a business that has an open follow-up or an active reservation.
- Runs only when the Owner clicks it (no silent background reassignment). A scheduled daily run can be enabled later.

## D9. Fifteen-day visibility — PROPOSED

> Superseded by baseline §D9 on 2026-10-29: Data Entry window runs from creation only (edits do not restart); callback exception is callback time + 48 h, not "while follow-up is open"; Developer accepted-opportunity and requester exceptions as in DEC-002; see DEC-001, DEC-002, S-02, S-03.

Purpose assumed: limit how much of the company's client data any one non-owner employee can browse over time.

**Timer origin (per user, per business):**
- Data Entry: from the time they created the record (or last edited it).
- Call Center: from the time the business was assigned to them. Reassignment starts a fresh window for the new agent and ends access for the old one.
- Developer: see exceptions below.

**Interactions do not reset the timer.** If every call reset it, active records would never hide and the rule would mean little.

**Active-work exceptions — record stays visible to that user while:**
- They have an open follow-up on it.
- It's an accepted opportunity assigned to them.
- It has an open correction request they raised (until resolved).
- It's a closed deal whose project isn't `completed` — visible to all Developers, and for 15 days after completion.

**Applies everywhere:** lists, search, detail pages, calendar, notifications, exports, and API responses — enforced in one server-side access function, not per screen.

**Temporary access requests:** not in v1. The Owner can reassign the business, which grants access via the rules above.

## D10. Hidden-record duplicate warnings — PROPOSED

> Superseded by baseline §D10 on 2026-10-29: adds an audited "Request Owner review" action (no automatic access); see DEC-003, S-07.

When creation is blocked by a record the employee can't see, show only:
- "This business already exists" + which field matched (phone / name)
- Business name and category
- Date created

No phone numbers, socials, notes, or assignee. No access is granted. The Owner sees full details.

## D11. Duplicate matching — PROPOSED

| Check | Rule | Effect |
|---|---|---|
| Phone | Normalized to E.164 (default country code from company settings); exact match against any phone on any business | **Block** |
| Name | Normalized (lowercase, trimmed, whitespace collapsed, punctuation stripped) exact match on `name + branch` | **Block** |
| Similar name | Trigram similarity ≥ 0.6 (PostgreSQL `pg_trgm`) | **Warning only** — shows possible matches, does not block |

**Branches:** add an optional `branch / location` field. "Glow Salon — Hamra" and "Glow Salon — Verdun" are distinct; two "Glow Salon" records with no branch are a duplicate. Phone numbers still block across branches (a shared number is a shared business).

The record being edited is excluded from its own checks. Uniqueness is also enforced with database constraints so two simultaneous creates can't both succeed.

## D12. Categories — PROPOSED

**Owner manages categories** (create, rename, deactivate). Data Entry picks from the list; if nothing fits they choose "Other" and suggest a category in the notes. Prevents near-duplicates like "Salon / Salons / Beauty Salon". Categories are deactivated, never deleted.

## D13. Unknown social metrics — PROPOSED

- Follower count and last-post date are **nullable**; the form has an explicit "Unknown" option.
- Displayed as "Unknown", never as 0 or a placeholder date.
- Each metric stores the date it was recorded (`metrics_recorded_at`), since follower counts go stale.
- Reports and filters treat unknown as its own bucket; averages exclude unknowns.

## D14. Reopening rejected businesses — PROPOSED

**Owner only**, with a mandatory reason. Reopening sets the outcome back to `pending`, keeps all call history, and is audited.

## D15. Developer access before closure — PROPOSED

- **Accepted opportunities:** visible only to the assigned Developer (and Owner). Includes contact info, call notes, and client needs — enough to run the consultation.
- **Closed deals:** visible to all Developers (per D9 exceptions).
- Developers never get general business-directory browsing.

## D16. Deal closure — PROPOSED

> Superseded by baseline §D16 on 2026-10-29: stages are accepted → meeting scheduled → proposal sent → signed → payment pending verification → verified closed ("lost" with reason); Developer submits "payment received", only Owner verification closes; currency required when an amount exists; see DEC-006, DEC-018, DEC-028, S-08, S-09.

**Stages:** `accepted → meeting scheduled → proposal sent → signed → paid (closed)` — any stage may also go to `lost`. Stages can be skipped forward.

| Rule | Proposal |
|---|---|
| Payment definition | First payment received (a deposit counts) |
| Who closes | Developer marks `paid` → deal is `closed — pending verification`; Owner confirms. Owner can close directly. |
| Required evidence | Agreement reference (text) and payment date. File attachments optional in v1. |
| Money fields | Store `amount` + `currency` (optional). Costs nothing now and enables revenue reporting later. |

## D17. Deals/projects per business — PROPOSED

- A business can have **multiple deals over time** (e.g. website now, app next year).
- At most **one open** (not closed/lost) opportunity or deal at a time.
- Each closed deal has **at most one project**. The project board is created automatically when a deal is verified as closed.

## D18. Notifications — PROPOSED

All events also appear in an in-app notification list. Email timing below; all times configurable.

| Event | Recipient | When |
|---|---|---|
| Follow-up digest | Agent | Daily at shift start: today's follow-ups |
| Follow-up due | Agent | 15 min before |
| Follow-up overdue | Agent; Owner in daily digest | 1 hour after due |
| Meeting upcoming | Assigned Developer + Call Center agent | 24 h and 1 h before |
| Missing check-in | Owner | Shift start + grace + 30 min (working days only) |
| Missing checkout | Employee; Owner | Employee at shift end + 1 h; Owner in next-morning digest |
| New assignment / developer handoff | Assignee | Immediately |
| Correction request (data or attendance) | Data Entry + Owner / Owner | Immediately |
| Notification delivery failure | Owner | In-app only, immediately |

Emails are sent by a background job with retries; a failed email never affects the saved follow-up (per §10).

## D19. Backups and recovery — PROPOSED

| Item | Proposal |
|---|---|
| Method | Nightly `pg_dump` + continuous WAL archiving |
| Storage | Encrypted, off the VPS (S3-compatible object storage) |
| Retention | 14 daily, 8 weekly, 6 monthly |
| RPO (max data loss) | 15 minutes (with WAL); 24 h if WAL archiving is skipped |
| RTO (time to restore) | 4 hours |
| Testing | Restore drill to a scratch environment quarterly |

## D20. Deletion vs archiving (§2.1) — PROPOSED

**No hard deletes through the application.** Businesses, employees, deals, and categories are archived/deactivated. Call attempts, attendance records, and audit entries are immutable (corrections are new records). The Owner can view and restore archived items.

---

## Still needs company input

_2026-10-29: the current list is baseline §"Company inputs still required" (schedule/timezone, holiday calendar, office IP/CIDR, phone country code, numeric targets, DEC-004). The list below is history._

1. Working days, shift start time, and timezone (D1)
2. Whether the office has a static public IP, and what it is (D2)
3. Default country code for phone normalization (D11)
