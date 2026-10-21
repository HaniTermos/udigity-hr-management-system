# Udigity Management System — Policy Decisions

Status of every open item from §20 of the product description (plus the archiving question in §2.1).
Each entry has a **proposed default** and the reasoning. Items marked **NEEDS INPUT** depend on facts only the company knows.

Legend: `PROPOSED` = recommended default, awaiting sign-off · `NEEDS INPUT` = requires company-specific values · `APPROVED` = signed off.

> **Authority:** every item in this file is an **unapproved AI proposal** (source tier 4; see [artifact-register.md](artifact-register.md)). The canonical decision IDs are **DEC-001 … DEC-026** on FigJam Board 01 (section `28:534`). D-numbers are local labels for proposals only; they do not replace or redefine DEC IDs.

## Mapping to the DEC register

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

**D items with no DEC counterpart. These are new proposals; no DEC ID has been assigned:**

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

v1 = **manual assignment + an Owner-triggered "Auto-fill queues" action**:

- Takes unassigned, non-rejected businesses, oldest first.
- Distributes round-robin across active Call Center agents, up to a configurable daily queue size per agent (default 40).
- Never moves a business that has an open follow-up or an active reservation.
- Runs only when the Owner clicks it (no silent background reassignment). A scheduled daily run can be enabled later.

## D9. Fifteen-day visibility — PROPOSED

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

1. Working days, shift start time, and timezone (D1)
2. Whether the office has a static public IP, and what it is (D2)
3. Default country code for phone normalization (D11)
