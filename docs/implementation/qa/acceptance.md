# Acceptance criteria — Udigity Management System (full build)

| Field | Value |
|---|---|
| Owner | QA Lead (`docs/implementation/qa/`) |
| Date | 2026-10-23 |
| Status | CONTRACT for every implementation agent ([QA-1] on the coordination board). Changes go through a REQUEST to QA |
| Sources | `phase_2_workflows_and_state_machines.md` (approved 2026-10-20), `phase2/shared-baseline.md` (SB-2, contracts A–G, rulings R-01..R-13), `phase2/batch2..4/*-spec.md`, `phase3-4/screen-inventory.md`, `phase6/handoff-ready.md`, `phase6/interaction-spec.md`, `phase7/flows/*.md`, `policy-defaults.md` |
| Test levels | **U** unit · **A** API (supertest against the Docker test DB) · **E** E2E (Playwright). See `test-strategy.md` |

## 0. How to read this file

**Criterion tags.** Every criterion carries exactly one source tag:

| Tag | Meaning |
|---|---|
| `[baseline]` | Confirmed rule or approved Phase 2 baseline contract (SB-2 / ART-01). Not a flag. |
| `[APPROVED U-01]` | The only explicit user decision on a pending policy: **Accepted keeps the contact reservation** (2026-10-23). |
| `[flag-dependent (demonstration default)]` | Depends on a pending policy. The value tested is the demonstration alternative in `policy-defaults.md`, **not an approved rule**. The flag / setting key follows in backticks. When the flag changes, the criterion changes; the test must read the active value from config, not hard-code it. |
| `[impl-default]` | Implementation choice from `policy-defaults.md` §8 (CFG). Not business policy; still configurable. |
| `[NEEDS VALUE]` | Company value not supplied. Tests use the placeholder and assert the "Not configured" state when it is absent. |

**Rules for testers.**
- A criterion tagged flag-dependent must be tested **for the default branch**, and the test name must contain `[demo-default]`. Where both branches are built (`FLAG`), the other branch gets one API test that runs with the flag switched.
- UI that renders a flag-dependent behaviour must show the label "Demonstration alternative — not approved" (coordination rule). Policy chips are hidden in production builds (`policy-defaults.md` handoff note) — test both.
- "Audited" means: exactly one row in `audit_events` with the named event, actor, entity, request id, written **in the same transaction** as the change (a failed change leaves no audit row and vice versa). Event names are Proposed (G2) unless noted.
- "Hidden" and "denied" responses never contain the business name, id, field values or counts.

**ID scheme.** `AC-<MODULE>-nnn`. Modules: AUTH, PERM, VIS, BIZ, DUP, DFIX, CAT, ATT, ACOR, CALL, RES, OUT, FUP, DNC, DEAL, MEET, CLOSE, PROJ, TASK, RPT, EXP, AUD, NOTIF, EMP, SET, UI.

---

## 1. Authentication and sessions (SCR-AUTH-001..004, SCR-SHR-011, SCR-SHR-013) — WF-AUTH-001/002, SM-SESSION-001

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-AUTH-001 | an active Data Entry, Call Center or Developer account | they sign in with valid credentials | a session in state Active is created; they land on My Day (`/my-day`) or the safe `redirect` target; `session.created` audited | `[baseline]` | A, E |
| AC-AUTH-002 | an active Owner with an enrolled TOTP factor | they sign in with valid credentials | the session is Pending 2FA verification; the UI shows SCR-AUTH-002; `twoFactorStep = 'verify'` | `[baseline]` | A, E |
| AC-AUTH-003 | an active Owner with no factor | they sign in | the session is Pending 2FA enrollment; the UI shows SCR-AUTH-003 enrollment; `twoFactorStep = 'enroll'` | `[baseline]` | A, E |
| AC-AUTH-004 | a session pending 2FA | it calls any Owner/admin route (employees, reports, exports, audit, settings) | 403; no data | `[baseline]` (admin denied before 2FA) | A |
| AC-AUTH-005 | a session pending 2FA | it calls a non-admin route (e.g. check-in, business list) | denied (R11-a: nothing until 2FA) | `[flag-dependent (demonstration default)]` `OWNER_PENDING_2FA_SCOPE=R11-a` | A |
| AC-AUTH-006 | a pending Owner | they submit a valid TOTP code | session becomes Active; lands on SCR-OWN-001 (`/`) or `redirect`; `session.second_factor_verified` audited | `[baseline]` method TOTP `[impl-default]` | A, E |
| AC-AUTH-007 | a pending Owner | they submit a wrong code | inline "Code is incorrect or expired"; session stays pending; `session.second_factor_failed` audited | `[baseline]` | A, E |
| AC-AUTH-008 | wrong credentials or a deactivated account | sign-in is submitted | one generic banner ("Email or password is incorrect."); never reveals whether the email exists; password field cleared; no session; `login.failed` audited | `[baseline]` | A, E |
| AC-AUTH-009 | 5 failed attempts for one account within 15 min | a 6th attempt is made (even with the right password) | refused with `TOO_MANY_ATTEMPTS` for 15 min; same threshold for 2FA codes; per-IP rate limit applies | `[impl-default]` `IMPL-LOCKOUT` | A |
| AC-AUTH-010 | an Active session | 2 h pass without activity, or 12 h pass in total | the next request returns 401 and the UI shows SCR-SHR-013 (or the in-app dialog mid-edit); unsaved input is not saved; sign-in again shows the return notice | `[impl-default]` `IMPL-SESSION` | A, E |
| AC-AUTH-011 | a pending-2FA session | 10 min pass | the session ends | `[impl-default]` | A |
| AC-AUTH-012 | any authenticated POST/PUT/PATCH/DELETE | it is sent without a matching `X-CSRF-Token` | 403 `CSRF_FAILED`; nothing changes | `[impl-default]` (§9.3 contract) | A |
| AC-AUTH-013 | a signed-in user | they sign out | session Ended (`logged_out`); `session.ended`/`session.logged_out` audited; protected pages redirect to `/login?redirect=…` | `[baseline]` | A, E |
| AC-AUTH-014 | no session cookie | a protected page is requested | `307 /login?redirect=<path>`; the redirect target accepted after login is a same-origin path only (open-redirect guard) | `[baseline]` | E |
| AC-AUTH-015 | any email (known or unknown) | "Request link" on SCR-AUTH-004 | the API answers 202 for both; the UI shows the neutral "queued" copy, never "sent"; `password_reset.requested` audited only for a known account | `[baseline]` | A, E |
| AC-AUTH-016 | a reset link | it is used once within 60 min with a password ≥ 12 characters | the password changes; **all** sessions of that account end; lockout cleared; `password_reset.completed` audited | `[impl-default]` `IMPL-PASSWORD` | A, E |
| AC-AUTH-017 | a reset link that is expired, already used or malformed | it is opened or submitted | expired-link state with "Request a new link"; password unchanged | `[impl-default]` | A, E |
| AC-AUTH-018 | a new password shorter than 12 characters | reset is completed | rejected with a field error; nothing changes | `[impl-default]` | A, E |
| AC-AUTH-019 | an Owner completing enrollment | they confirm a valid TOTP code | factor stored; session Active; `two_factor.enrolled` audited. Recovery codes (10, single use) are shown once | `[flag-dependent (demonstration default)]` OQ-12/C2 (recovery codes **not built yet** — test is `fixme` until delivered) | A, E |
| AC-AUTH-020 | a 2FA verify request | `NODE_ENV=production` | the dev bypass (any 6-digit code) is **off** | `[baseline]` security | U, A |
| AC-AUTH-021 | a user hits a route their role lacks | — | SCR-SHR-011 "Permission denied" with "Go to My Day" / Back; an Owner pending 2FA sees "Continue to 2FA" | `[baseline]` | E |
| AC-AUTH-022 | the Owner deactivates a signed-in employee | that employee makes any request | 401; SCR-SHR-013 with "Back to sign in" only | `[baseline]` | A, E |

## 2. Role permissions (who can see and do what) — SB-2 §4, VT-3, policy defaults

Route-level action names live in `docs/security/authz-matrix.md` ([SEC-1]). This table is the behavioural contract; any disagreement between the two is a defect to raise on the board, not a choice for the implementer.

Each row is one acceptance criterion `AC-PERM-<row>`: **Given** a signed-in user of the column's role (Owner with 2FA complete), **when** they attempt the action via UI and API, **then** "Yes" succeeds (subject to the visibility rules in §3) and "No" returns 403 "Permission denied", hides the control in the UI, and leaves no data change. Tested at level A (every cell) and E (one denied + one allowed cell per role).

| # | Action | Owner | Data Entry | Call Center | Developer | Tag |
|---|---|---|---|---|---|---|
| 01 | Employee directory, create/edit/deactivate employees | Yes | No | No | No | `[baseline]` |
| 02 | Own profile: photo and phone editable; name, email, role read-only | Yes | Yes | Yes | Yes | `[flag-dependent (demonstration default)]` OQ-13 |
| 03 | Check in / check out (own attendance only) | Yes (no exemption from office check) | Yes | Yes | Yes | `[baseline]`; F-04 |
| 04 | Request attendance correction | — | Yes | Yes | Yes | `[flag-dependent (demonstration default)]` `attendance.employeeRequests` (DEC-011 Alt B) |
| 05 | Approve/reject/adjust attendance | Yes | No | No | No | `[baseline]` |
| 06 | Create business | Yes | Yes | No | No | `[baseline]` |
| 07 | Edit business master data | Yes | Yes | No | No | `[baseline]` |
| 08 | Archive / restore business (no hard delete for anyone) | Yes | No | No | No | `[flag-dependent (demonstration default)]` C-01 |
| 09 | Browse business directory | Yes (incl. hidden) | Yes, any business, subject to 15-day rule (DE-1) | Assigned businesses only | No directory; context-limited via deals/projects | DE-1 `[flag-dependent (demonstration default)]` `OI-02 DE-1|DE-2`; rest `[baseline]` |
| 10 | Submit data-correction request | Yes | No (edits directly) | Yes | Yes | CC/Dev `[baseline]`; DE No `[flag-dependent (demonstration default)]` OI-24 |
| 11 | Review/resolve data-correction requests | Yes | Yes | No | No | `[baseline]` |
| 12 | Create / rename / deactivate categories | Yes | No (picks; "Other" + note) | No | No | `[flag-dependent (demonstration default)]` DEC-015 CA-A |
| 13 | Assign / reassign / unassign calling | Yes | No | No | No | `[flag-dependent (demonstration default)]` B3-Q01, B3-Q15 |
| 14 | Auto-fill queues (Owner-triggered) | Yes | No | No | No | `[flag-dependent (demonstration default)]` DEC-021 |
| 15 | Start Contact / renew / release reservation | Yes | No | Assignee only | No | `[flag-dependent (demonstration default)]` DEC-004, B3-Q02 |
| 16 | Override another user's reservation (reason required) | Yes | No | No | No | `[flag-dependent (demonstration default)]` DEC-004, B3-Q14 |
| 17 | Log call attempt / set calling outcome | Yes | No | Assignee holding the reservation | No | `[baseline]` |
| 18 | Schedule / reschedule / complete / cancel follow-up | Yes | No | Assignee / responsible user | No | `[baseline]` |
| 19 | Reopen a Rejected (do-not-call) business | Yes (reason) | No | No (control disabled) | No | `[flag-dependent (demonstration default)]` DEC-016 |
| 20 | Assign Developer to a deal record | Yes | No | Yes | No | `[baseline]` E2 |
| 21 | View accepted opportunity before closure | Yes | No | Accepting/assigned agent | Assigned Developer only, read-only master data | `[flag-dependent (demonstration default)]` `deals.developerPreClosure=assigned` (DEC-005 Alt 1) |
| 22 | Schedule / reschedule / record meeting | Yes | No | Yes | Assigned Developer | `[flag-dependent (demonstration default)]` DEC-005 Alt 1 |
| 23 | Record signature / payment | Yes | No | No | Assigned Developer | `[flag-dependent (demonstration default)]` OQ-03, DEC-005 Alt 1, R-12 |
| 24 | Request closure verification | — | No | No | Yes | `[flag-dependent (demonstration default)]` `deals.closureMode=ownerVerify` |
| 25 | Verify & finalize closure / reject verification / remove a recorded fact | Yes | No | No | No | `[flag-dependent (demonstration default)]` DEC-006 Alt B |
| 26 | Mark deal Not proceeding (reason) | Yes | No | No | Assigned Developer | `[flag-dependent (demonstration default)]` OQ-03 |
| 27 | View company-wide closed-deal list | Yes | No | No | Yes (eligible) | `[baseline]` |
| 28 | Update project status / tasks | Yes (any) | No | No | Assigned projects only (any task in them) | `[flag-dependent (demonstration default)]` OQ-06 |
| 29 | Assign Developers to a project | Yes | No | No | No | `[flag-dependent (demonstration default)]` OQ-08 |
| 30 | Owner dashboard, reports, **exports** | Yes | No | No | No | `[baseline]` |
| 31 | Audit log (read-only) | Yes | No | No | No | `[baseline]` |
| 32 | Settings (schedule, office check, notifications) | Yes | No | No | No | `[baseline]` |
| 33 | Targets & work lists (set) | Yes | No | No | No | `[baseline]` |
| 34 | Delivery monitor, "Send again" (reminders) | Yes | No | No | No | `[flag-dependent (demonstration default)]` AR-13 ("Mark reviewed" not built) |

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-PERM-100 | the access check (WF-ACCESS-001) | any resource of the 11 types (business, call attempt, follow-up, reservation, deal record, meeting, project, task, notification, export row, duplicate preview) is read | the same evaluation order VT-1 applies; the Owner skips steps 5–8 but is still bound by resource state (a Rejected business is do-not-call for the Owner too) | `[baseline]` R-01, R-06 | U, A |
| AC-PERM-101 | a Call Center or Developer user | they try to edit master data | denied; the UI offers "Request correction" (SCR-SHR-009) instead | `[baseline]` | A, E |
| AC-PERM-102 | Data Entry | they try to change a calling outcome or commercial stage | 403 | `[baseline]` | A |
| AC-PERM-103 | a work list | a user has not checked in | work lists and work actions are fully usable (attendance gating not adopted) | `[baseline]` A1 | E |

## 3. Visibility — 15-day hidden-record rules (WF-ACCESS-001, SM-VISIBILITY-001)

Test harness requirement: the API must accept an injectable clock in the test environment (REQUEST to backend, see `test-strategy.md` §4). All dates below are company-timezone calendar dates (placeholder `Asia/Beirut` `[NEEDS VALUE]`).

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-VIS-001 | a business created on day D, and a non-Owner who passes role and scope checks | they read it on any date up to D+14 (until 23:59:59 company time) | full access per role | `[flag-dependent (demonstration default)]` `visibility.timerBasis=creation` (DEC-001 Alt A), OI-04 | U, A |
| AC-VIS-002 | the same business | it is read at 00:00 on D+15 or later with no active-work exception | denied "Record hidden by policy" (SCR-SHR-012); no name, id or field in the payload | `[flag-dependent (demonstration default)]` DEC-001 Alt A, OI-04, OI-10 | U, A, E |
| AC-VIS-003 | a hidden business | calls are logged, follow-ups scheduled, or master data edited | the timer does **not** reset (creation-based, no reset) | `[flag-dependent (demonstration default)]` DEC-001 Alt A | A |
| AC-VIS-004 | `visibility.timerBasis=inactivity` | `call_attempt.logged` or `follow_up.scheduled` occurs | the window restarts from that event; edits, notes and status tweaks never reset it (`lastTouchpointAt` stored in both modes) | `[flag-dependent (demonstration default)]` alternate branch, R-07 | A |
| AC-VIS-005 | the Owner (2FA complete) | they read any business of any age | full access; opening the **detail** of a business hidden for others writes `business_access.owner_viewed_hidden`; list rows do not | `[baseline]` C1; audit `[flag-dependent (demonstration default)]` OI-05 (SET on) | A |
| AC-VIS-006 | a hidden business | a non-Owner lists, searches, pages or counts | the row is omitted **and not counted** (totals, tab counts, badges, pagination) | `[baseline]` C2 | A, E |
| AC-VIS-007 | a hidden business | a non-Owner opens its direct URL or a stale link/notification | SCR-SHR-012 "Record hidden by policy" for timer denials; "Permission denied" for role/scope denials; `business_access.denied` audited | `[flag-dependent (demonstration default)]` OI-10 | A, E |
| AC-VIS-008 | exception row 1: deal record in Accepted opportunity | day ≥ D+15 | assigned Developer and Call Center agent keep context-limited access in the hand-off / deal surface until the deal closes (→ row 2) or is Not proceeding | `[flag-dependent (demonstration default)]` DEC-002 Alt B row 1, OI-18 | A |
| AC-VIS-009 | exception row 2: business has a closed deal | day ≥ D+15 | all Developers and the Owner see it **in the closed-deal list only** (no directory search, no master edit) until its project is Completed + 15 days | `[flag-dependent (demonstration default)]` DEC-002 Alt B row 2, OI-18 | A, E |
| AC-VIS-010 | row 3: active project | day ≥ D+15 | assigned Developer(s) keep access on the project board | `[flag-dependent (demonstration default)]` DEC-002 row 3 | A |
| AC-VIS-011 | row 4: completed project | 15 days after delivery | the business becomes hidden for Developers | `[flag-dependent (demonstration default)]` DEC-002 row 4 | A |
| AC-VIS-012 | row 5: scheduled callback | day ≥ D+15 | the responsible agent keeps context-limited access (calling workspace, calendar; may log the call) until callback date-time + 48 h | `[flag-dependent (demonstration default)]` DEC-002 row 5, OI-27 | A |
| AC-VIS-013 | row 6: open data-correction request | day ≥ D+15 | Data Entry sees it in the correction queue only and may apply that request (the only context-limited master-data edit) until the request is terminal | `[flag-dependent (demonstration default)]` DEC-002 row 6, OI-27 | A, E |
| AC-VIS-014 | an item owned by the user (follow-up, meeting, notification) on a business now hidden for them | they view their calendar / notifications | the item is shown with the business **redacted**; browsed list rows are omitted | `[flag-dependent (demonstration default)]` OI-07 | A, E |
| AC-VIS-015 | the requester's own correction request after the business is hidden | they view it | the request status is visible; the business is redacted | `[flag-dependent (demonstration default)]` OI-09 | A |
| AC-VIS-016 | an assigned business hidden for its assignee | the Owner views SCR-OWN-007 | it is flagged "assigned but inaccessible"; no automatic reassignment happens | `[baseline]` B7/R-02 | A, E |
| AC-VIS-017 | no request-access button | a hidden record is shown | SCR-SHR-012 has no "request access" action | `[flag-dependent (demonstration default)]` OI-06 | E |
| AC-VIS-018 | a notification or reminder | it is opened or sent | access is re-checked at read/send time; if gone, SCR-SHR-012 (stale link) opens / the send is Suppressed | `[baseline]` C6, AR-14 | A, E |

## 4. Business data (SCR-DE-001, -002, -004, SCR-SHR-008, -010) — WF-BIZ-001/002

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-BIZ-001 | Data Entry on SCR-DE-002 | they save with name blank, no category, or no social account | all failed rules are reported together in an error summary whose links focus the fields; nothing is saved | `[baseline]` VR-1/2/7 | A, E |
| AC-BIZ-002 | a business with no phone | it is saved | it saves; it shows "No phone" and is **not eligible for calling** | `[flag-dependent (demonstration default)]` B2 PH-2 | A, E |
| AC-BIZ-003 | a phone entered without country code | it is saved | it is normalised with the default country code (placeholder +961) `[NEEDS VALUE]`; the same normalised phone twice on one record collapses with a notice | `[flag-dependent (demonstration default)]` VR-4/VR-6 | U, A |
| AC-BIZ-004 | follower count or last-post date | the user selects Unknown | stored as null + "Unknown"; never 0; `metrics_recorded_at` stored; last-post date not in the future | `[flag-dependent (demonstration default)]` DEC-014, DEC-023 | U, A, E |
| AC-BIZ-005 | "Has website" unticked | the form is saved | URL cleared and hidden; ticked requires a well-formed URL | `[baseline]` VR-11 | A, E |
| AC-BIZ-006 | a valid new business | it is saved | outcome Pending, assignment Unassigned (no stored NEW_LEAD); toast; redirect to SCR-SHR-008; `business.created` audited | `[flag-dependent (demonstration default)]` C-02 | A, E |
| AC-BIZ-007 | an edit of a record changed by someone else since load | Save is pressed | SCR-SHR-014 save conflict; nothing overwritten silently; "Re-apply my edits" / "Reload latest" behave per interaction spec; `business.save_conflicted` | `[baseline]` | A, E |
| AC-BIZ-008 | a successful edit | it saves | edit history rows (field, before, after, who, when); history readable by users who pass the access check, limited to fields they may see | `[baseline]`; OI-11 `[flag-dependent (demonstration default)]` | A, E |
| AC-BIZ-009 | Data Entry | they look for delete | no delete control; API DELETE returns 403/405 | `[baseline]` | A, E |
| AC-BIZ-010 | an archived business | — | it leaves calling and the directory default view, stays in the duplicate check, Owner can restore; history kept | `[flag-dependent (demonstration default)]` C-01, OI-26 | A |
| AC-BIZ-011 | SCR-SHR-010 search by name, normalised phone or handle | there are hidden matches | results and the empty state give no hint of hidden matches | `[flag-dependent (demonstration default)]` DEC-003 | A, E |

## 5. Duplicate checks (SCR-DE-003 samples 101:5214 / 101:6168) — DR-1..DR-9

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-DUP-001 | any stored business (visible, hidden or archived) with phone P | another business is created or edited with a phone normalising to P | the save is blocked; `business.duplicate_blocked` audited; nothing saved | `[baseline]` DR-1/2/3, C3; archived `[flag-dependent (demonstration default)]` OI-26 | A, E |
| AC-DUP-002 | phone P on branch A | a new business uses P on branch B | blocked (phone blocks across branches) | `[flag-dependent (demonstration default)]` OI-14 | A |
| AC-DUP-003 | a business "Glow Salon", branch empty | a new "glow  salon" (normalised equal) with same branch is saved | blocked | `[flag-dependent (demonstration default)]` DEC-013 NM-B | U, A |
| AC-DUP-004 | the same name with a **different** branch | it is saved | allowed | `[flag-dependent (demonstration default)]` DEC-013 NM-B | A |
| AC-DUP-005 | a name with trigram similarity ≥ 0.6 to an existing one (not equal) | it is saved | a non-blocking warning lists possible matches the user may read; Continue saves (`business.similar_name_confirmed`), Cancel saves nothing | `[flag-dependent (demonstration default)]` DEC-013 SN-1, SET threshold | U, A, E |
| AC-DUP-006 | a match the user **can** read | the block appears | dialog shows "already exists" + a preview within the user's permissions + "Open existing business" (confirms discarding input) + "Back to form" (values kept); focus moves to the dialog title; Esc returns to the form | `[baseline]` DR-9 | E |
| AC-DUP-007 | a match the user **cannot** read (hidden) | the block appears | **existence only**: "already exists", no id, no fields, no primary action, no escalation | `[flag-dependent (demonstration default)]` DEC-003 (i) | A, E |
| AC-DUP-008 | the Owner | a block appears | the Owner sees the full match | `[baseline]` C1 | A |
| AC-DUP-009 | any role, including the Owner | the dialog is shown | there is no bypass / override / merge control; the API has no override parameter | `[baseline]` DR-5/DR-6 | A, E |
| AC-DUP-010 | a record being edited | its own phone/name is re-saved | it does not match itself | `[baseline]` DR-7 | A |
| AC-DUP-011 | two concurrent saves (create/create, edit/edit, edit/create) with the same normalised phone | both commit at once | exactly one succeeds; the other receives the duplicate block (DB-level uniqueness, not only an app check) | `[baseline]` DR-8 | A |
| AC-DUP-012 | a save fails after the check (network) | Retry is pressed | the duplicate check re-runs | `[baseline]` | E |
| AC-DUP-013 | a correction applied through SCR-DE-005 that changes a phone into a duplicate | Apply is pressed | existence-only error; request stays In review | `[baseline]` + DEC-003 default | A |

## 6. Data-correction requests (SCR-SHR-009, SCR-DE-005, SCR-DE-006) — SM-DATAFIX-001

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-DFIX-001 | Call Center, Developer or Owner with access to a business | they submit issue type + description | state Submitted; "Correction requested" count increases; Data Entry (shared queue) and Owner notified immediately; `data_correction_request.submitted` | `[baseline]`; recipients `[flag-dependent (demonstration default)]` OI-20 | A, E |
| AC-DFIX-002 | an open request already exists on that business | another is submitted | a warning is shown; it never blocks | `[baseline]` | E |
| AC-DFIX-003 | two reviewers | both start review | the first wins (In review); the second sees "already in review"; `review_started` once | `[flag-dependent (demonstration default)]` OI-19 | A |
| AC-DFIX-004 | In review | the reviewer applies changes via SCR-DE-004 in request context | in one save: business updated (+ edit history), request Resolved, requester informed in-app; `data_correction_request.resolved` + `business.updated` | `[flag-dependent (demonstration default)]` OI-19 | A, E |
| AC-DFIX-005 | In review | "No change needed" with a note / "Reject" with a reason | Closed – no change needed / Rejected; note or reason mandatory; requester informed | `[flag-dependent (demonstration default)]` OI-19 | A, E |
| AC-DFIX-006 | Submitted or In review | the requester withdraws | Withdrawn (UI state is undesigned — derived from the Submitted pattern and labelled) | `[flag-dependent (demonstration default)]` | A, E |
| AC-DFIX-007 | a terminal request | any change is attempted | refused; terminal states never reopen | `[flag-dependent (demonstration default)]` OI-19 | A |
| AC-DFIX-008 | a reviewer is deactivated | — | their In review requests return to Submitted (`released`) | `[flag-dependent (demonstration default)]` N-4 | A |
| AC-DFIX-009 | the queue SCR-DE-006 | "Open" tab | Open = Submitted + In review; redacted rows not clickable and not counted | `[baseline]` | E |
| AC-DFIX-010 | an open request | — | it does not block assignment or contact; it shows as a queue flag | `[baseline]` B5 | A |

## 7. Categories (SCR-DE-007) — WF-BIZ-003

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-CAT-001 | the Owner | they add a category whose normalised name exists | inline error; Add disabled | `[baseline]` | A, E |
| AC-CAT-002 | Data Entry | they open SCR-DE-007 or call the API | Permission denied | `[flag-dependent (demonstration default)]` DEC-015 CA-A | A, E |
| AC-CAT-003 | a category in use | the Owner removes it | it is **deactivated**, not deleted; stays on existing businesses; no longer selectable; `category.deactivated` | `[flag-dependent (demonstration default)]` C-01 CR-1 | A, E |
| AC-CAT-004 | any state | — | an "Other" category always exists and cannot be deactivated | `[flag-dependent (demonstration default)]` OI-21 | A |

## 8. Attendance check-in / check-out (SCR-SHR-001..004, SCR-OWN-004) — WF-ATT-001/002/003, SM-ATTENDANCE-001

Settings precondition: until timezone, schedule and office mode are saved on SCR-OWN-011, attendance checks are inactive and the UI shows "Not configured" `[NEEDS VALUE]`.

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-ATT-001 | an active employee, no open session, request from an allow-listed office IP (read from the trusted proxy header) | they check in | one Open session with server time and verification result; flow shows Verifying → Success; top-bar chip updates; `attendance.checked_in` | `[baseline]`; mode `[flag-dependent (demonstration default)]` DEC-009 IP-only `[NEEDS VALUE]` office IP | A, E |
| AC-ATT-002 | check-in at 09:10 or earlier on Mon–Fri | — | punctuality On time; at 09:11 or later Late (derived, not a state); late arrival sends no notification | `[flag-dependent (demonstration default)]` DEC-007 09:00, DEC-008 10 min; F-09 | U, A |
| AC-ATT-003 | no schedule configured | they check in | session opens with punctuality "Unclassified" | `[baseline]` | A |
| AC-ATT-004 | a Saturday/Sunday or company holiday | they check in | punctuality "Non-working day"; no missing-check-in alert that day | `[flag-dependent (demonstration default)]` DEC-022 `[NEEDS VALUE]` holidays | A |
| AC-ATT-005 | a non-office IP and no remote exception | they check in | rejected; no session; failure shown with Retry check; attempt audited; no self-service "request remote exception" button | `[flag-dependent (demonstration default)]` DEC-009, DEC-010 | A, E |
| AC-ATT-006 | an Owner-granted remote exception for that employee and date | they check in from outside | session recorded with flag `remote` | `[flag-dependent (demonstration default)]` DEC-010 | A |
| AC-ATT-007 | an Open session from an earlier day | they check in | blocked ("open session") with a link to SCR-SHR-004 / the correction form; no second session | `[baseline]` | A, E |
| AC-ATT-008 | two simultaneous check-in requests from two devices | — | exactly one Open session exists (DB constraint) | `[baseline]` F-06 | A |
| AC-ATT-009 | an Open session, office IP | they check out with "Work completed" ≥ 10 characters | session Closed; duration computed; derived vs 9 h; summary stored; `attendance.checked_out` | `[baseline]`; summary `[flag-dependent (demonstration default)]` DEC-012 | A, E |
| AC-ATT-010 | an Open session | "Work completed" is empty or < 10 chars | inline error; session stays Open | `[flag-dependent (demonstration default)]` DEC-012 | A, E |
| AC-ATT-011 | an Open session and a failing office check at checkout | Check out is pressed (button never pre-disabled) | summary collected first; session **closed provisionally** at the attempted time, flagged with the reason; Owner review item created (not an email); next check-in not blocked; `attendance.checkout_provisional` | `[flag-dependent (demonstration default)]` `attendance.failedCheckout=provisional` (DEC-026 Alt B), F-02 | A, E |
| AC-ATT-012 | checkout save fails | — | session stays Open; Retry offered | `[baseline]` | A, E |
| AC-ATT-013 | an Open session still open at shift end + 6 h on a working day | the scheduled job runs | flagged `missing checkout`; **never auto-closed** | `[flag-dependent (demonstration default)]` D5 | A |
| AC-ATT-014 | a working day with no check-in by shift start + grace + 30 min | the job runs | Owner alerted (missing check-in); appears on SCR-OWN-004; "not checked in" ≠ "absent" in reports | `[flag-dependent (demonstration default)]` NOTIF; `[baseline]` G1 | A |
| AC-ATT-015 | SCR-OWN-004 | the Owner views today | office-check result shown as "Recorded · mode …", never "Passed" while the mode is a demonstration default; mobile offers a day/employee filter | `[baseline]` (handoff note) | E |
| AC-ATT-016 | the owner checks in | — | same office check as everyone (no Owner exemption) | `[flag-dependent (demonstration default)]` F-04 | A |

## 9. Attendance corrections (SCR-SHR-004, -005, SCR-OWN-005) — WF-ATT-003 Part 2, SM-CORRECTION-001

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-ACOR-001 | a closed or open own session | the employee submits proposed times + reason | validated (checkout after check-in, no overlap, not in the future); state Submitted; Owner notified immediately; `attendance_correction.submitted` | `[flag-dependent (demonstration default)]` `attendance.employeeRequests` (DEC-011 Alt B) | A, E |
| AC-ACOR-002 | a request for a still-open earlier session | it is submitted | the session closes **provisionally** at the proposed time (pending review) and check-in is allowed | `[flag-dependent (demonstration default)]` F-01 | A, E |
| AC-ACOR-003 | Submitted | the Owner approves | in one save: request Approved, correction record beside the **unchanged original**, effective value shown with "adjusted"; punctuality re-derived from the effective time; `attendance_correction.approved` + `attendance.corrected` | `[baseline]` original kept; F-03 `[flag-dependent (demonstration default)]` | A, E |
| AC-ACOR-004 | Submitted | the Owner rejects without a reason | refused; with a reason → Rejected; employee notified; original stands (if the session was open, the Owner sets the effective time or "unknown") | `[flag-dependent (demonstration default)]` DEC-011 Alt B, F-01 | A, E |
| AC-ACOR-005 | Submitted | the employee withdraws | Withdrawn (undesigned state, labelled) | `[flag-dependent (demonstration default)]` | A, E |
| AC-ACOR-006 | the Owner | they adjust a session directly with a reason | correction record; original kept; `attendance.corrected` | `[baseline]` | A, E |
| AC-ACOR-007 | corrected times overlapping another session or in the future | Save | rejected; nothing changes | `[baseline]` | A |
| AC-ACOR-008 | a missing check-in | the Owner creates a retroactive session with a reason | session created; audited | `[flag-dependent (demonstration default)]` N-2 | A |
| AC-ACOR-009 | `attendance.employeeRequests=false` | — | "Request correction" button and SCR-SHR-005 are absent; the Owner-only path (Alt A) works | `[flag-dependent (demonstration default)]` alternate branch | A, E |

## 10. Calling assignment (SCR-OWN-007, -008, SCR-CC-001) — WF-CALL-001, SM-ASSIGNMENT-001

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-CALL-001 | selected businesses | the Owner assigns them to an active Call Center agent | eligible items Assigned; result banner shows assigned count + excluded items with reasons (Rejected, no phone, archived, open deal, inactive agent); assignee notified (in-app + email "New assignment"); `calling_assignment.assigned` | `[baseline]` B1/B3; B2/B4/B6 `[flag-dependent (demonstration default)]` | A, E |
| AC-CALL-002 | a business with an Active reservation or open follow-ups | the Owner chooses Reassign… | SCR-OWN-008 opens first; Reassign stays disabled until the reservation choice (Wait/Override) and each follow-up choice (Transfer preselected / Cancel with reason / Keep) are made | `[flag-dependent (demonstration default)]` B3-Q03 | E |
| AC-CALL-003 | a reassignment | it saves | old row ended, new row created; follow-ups handled as chosen; new assignee notified; previous agent gets an in-app notice only; `calling_assignment.reassigned` | `[flag-dependent (demonstration default)]` OWN-008 | A |
| AC-CALL-004 | "Auto-fill queues" | the Owner triggers it | unassigned, non-rejected, eligible businesses, oldest first, round-robin over active agents, ≤ 40 per agent per day; never moves a business with an open follow-up or active reservation; shortfall shown; no background run | `[flag-dependent (demonstration default)]` DEC-021 (SET queue size) | A |
| AC-CALL-005 | an assigned agent | they open SCR-CC-001 | only their assigned, accessible businesses appear, in derived buckets (New, Callbacks due today, Overdue, …); Rejected only in the view-only "Rejected: do not call" list | `[baseline]` | A, E |
| AC-CALL-006 | Unassign | the Owner unassigns | Unassigned; follow-up choice applied; `calling_assignment.unassigned` | `[flag-dependent (demonstration default)]` B3-Q15 | A |
| AC-CALL-007 | an agent is deactivated | — | their assignments stay; flagged for the Owner; reservation ends at lease end (≤ 5 min) | `[flag-dependent (demonstration default)]` B3-Q06 | A |

## 11. Contact reservation / lease (SCR-CC-002, -003, -005) — WF-CALL-002, SM-RESERVATION-001

Durations are SET values; tests read them from settings and run with a fake clock.

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-RES-001 | the assignee (or Owner), business not Rejected, no Active reservation | Start Contact | one Active reservation (lease 5 min); SCR-CC-003 "Reserved by you"; `contact_reservation.acquired` | `[flag-dependent (demonstration default)]` DEC-004 | A, E |
| AC-RES-002 | two users press Start Contact concurrently | — | exactly one Active reservation; the other gets SCR-CC-005 "Contact reserved by another agent" with holder name and since-time; no instance for the loser | `[baseline]` (at most one Active) | A, E |
| AC-RES-003 | the holder in a second tab/device | Start Contact | the existing reservation is returned (not a collision) | `[flag-dependent (demonstration default)]` | A |
| AC-RES-004 | an open workspace | 60 s pass | heartbeat renews the lease (self-transition, operational log only); each renewal re-runs the access check | `[flag-dependent (demonstration default)]` DEC-004 | A |
| AC-RES-005 | no user input for 13 min | — | "Expiring" warning; at 15 min the reservation ends Expired; `contact_reservation.expired`; holder sees Expired at next sync; unsaved notes stay in the form | `[flag-dependent (demonstration default)]` DEC-004 idle rule | A, E |
| AC-RES-006 | a tab switch / window blur | — | no release, no state change | `[baseline]` | E |
| AC-RES-007 | total holding time 60 min | — | renewal requires an explicit "Keep working" | `[flag-dependent (demonstration default)]` DEC-004 max | A, E |
| AC-RES-008 | renewals fail (offline) | — | offline banner; notes kept; on reconnect: still Active → renews; Expired and free → may re-acquire (new instance); held by another → collision, draft kept, save blocked | `[baseline]` | E |
| AC-RES-009 | the Owner | Override… with a reason (destructive confirm) | Overridden; holder sees "Overridden by Owner" at next sync; label "Owner override · DEC-004 (Proposed)"; `contact_reservation.overridden`; without a reason → refused | `[flag-dependent (demonstration default)]` DEC-004, B3-Q14 | A, E |
| AC-RES-010 | Cancel contact with unsaved notes | — | warning; then Released; **no attempt logged**; `contact_reservation.released` | `[baseline]` | A, E |
| AC-RES-011 | a save that arrives after the reservation was lost (expired/overridden/released elsewhere) | Save attempt | the call attempt row and notes are kept; the outcome is **not** applied; the agent is told to reopen the contact | `[flag-dependent (demonstration default)]` B3-Q05 Alt B | A, E |
| AC-RES-012 | the business is Rejected, archived, or the user is not assignee/Owner | Start Contact | disabled in UI; API refuses (do-not-call / Permission denied) | `[baseline]` B1; `[flag-dependent (demonstration default)]` B3-Q02 | A, E |
| AC-RES-013 | the Owner on a Rejected business | Start Contact | refused (Owner is bound by do-not-call) | `[baseline]` R-01 | A |

## 12. Call attempt and outcome (SCR-CC-003) — WF-CALL-003

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-OUT-001 | an Active reservation | the agent opens the outcome panel | four RadioCards (On hold, Needs another call, Rejected, Accepted); **none preselected**; no "Pending" option; every attempt records one of the four | `[flag-dependent (demonstration default)]` B3-Q13 | E |
| AC-OUT-002 | any outcome | Save attempt succeeds | one new attempt row (time = server now, not editable); current outcome updated; reservation released **after** the commit; `call_attempt.logged` (+ `call_outcome.changed` if different) | `[baseline]`; B3-Q07 `[flag-dependent (demonstration default)]` | A, E |
| AC-OUT-003 | save fails (server/network) | — | nothing saved; form kept; reservation stays Active | `[baseline]` | A, E |
| AC-OUT-004 | the business changed since load (reassigned, outcome/follow-ups changed) | Save | Save conflict with current values; nothing overwritten | `[baseline]` | A, E |
| AC-OUT-005 | outcome **Accepted** | the footer is shown | both "Save attempt" and **"Save, keep reservation"** are available; "Save, keep reservation" logs the attempt and leaves the reservation Active | **`[APPROVED U-01]`** | A, E |
| AC-OUT-006 | outcome On hold or Needs another call | the footer is shown | "Save attempt" and "Save, keep reservation" available | `[baseline]` | E |
| AC-OUT-007 | outcome **Rejected** | the footer is shown | only "Save attempt" (it releases); no keep-reservation option | `[baseline]` (handoff note) | E |
| AC-OUT-008 | Needs another call | Save without a follow-up and without "Set later" | refused; with a follow-up → follow-up created in the same save; with "Set later" → `callback_marker.set` | `[baseline]` D2; field rule `[flag-dependent (demonstration default)]` B3-Q16 | A, E |
| AC-OUT-009 | Rejected | Save without a reason | refused; with a reason → do-not-call; any callback marker cleared; **open follow-ups cancelled by the system in the same save** (reason "Business marked do-not-call") | `[flag-dependent (demonstration default)]` B3-Q16, D4 | A, E |
| AC-OUT-010 | Accepted | Save with client-needs note < 10 characters | refused; ≥ 10 → in one save one deal record in stage Accepted opportunity (never a closed deal); open follow-ups **stay open**; `accepted_opportunity.created` once | `[baseline]` E1/E5; `[flag-dependent (demonstration default)]` B3-Q16, D4, OQ-01 | A, E |
| AC-OUT-011 | Accepted with "Decide later" | — | "Developer not yet assigned" visible on SCR-CC-007 and to the Owner | `[baseline]` E3 | A, E |
| AC-OUT-012 | Accepted with "Assign now" | an inactive or non-Developer is chosen | refused; a valid Developer → developer-handoff notification | `[baseline]` E2 | A |
| AC-OUT-013 | a business with an open deal | Accepted is saved | blocked / linked to the existing open deal; no second open deal (DB partial unique index) | `[flag-dependent (demonstration default)]` DEC-017 | A |
| AC-OUT-014 | current outcome Accepted | an agent tries to change it | refused (agents cannot change Accepted) | `[flag-dependent (demonstration default)]` B3-Q12 | A |
| AC-OUT-015 | a do-not-call request received outside a call | the agent/Owner logs channel "Inbound / other" + Rejected + reason | recorded through the same path and audit | `[flag-dependent (demonstration default)]` B3-Q10 | A |

## 13. Follow-ups (SCR-CC-004, -006) — WF-FOLLOW-001, SM-FOLLOWUP-001

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-FUP-001 | a non-Rejected business | a follow-up is scheduled in the past | inline "past time" error; nothing saved | `[baseline]` | A, E |
| AC-FUP-002 | a valid future time | Save follow-up | Scheduled; D2 marker cleared; reminders planned; toast; row moves group; `follow_up.scheduled` | `[baseline]` | A, E |
| AC-FUP-003 | an open follow-up exists | another one is scheduled | the open one is rescheduled instead (at most one open per business) | `[flag-dependent (demonstration default)]` B3-Q04 | A |
| AC-FUP-004 | a Scheduled follow-up | Reschedule with a reason | history row (old, new, by, at, reason); old reminders Cancelled; new planned; `follow_up.rescheduled` | `[baseline]` | A, E |
| AC-FUP-005 | the last open follow-up of a Needs-another-call business | it is cancelled or completed without a linked attempt | in the same save a replacement follow-up is required or the "callback to be scheduled" marker is set | `[baseline]` D2 | A, E |
| AC-FUP-006 | a follow-up | its time + 1 h passes | it shows Overdue (derived; no state change); "Due today" = same company date | `[flag-dependent (demonstration default)]` overdue threshold | U, E |
| AC-FUP-007 | Completed or Cancelled | any change | refused (terminal) | `[baseline]` | A |
| AC-FUP-008 | a reminder fails | — | the follow-up is unchanged | `[baseline]` D5 | A |
| AC-FUP-009 | a stale edit (completed by a call save meanwhile) | Save | read-only conflict (Status / Was due / Your draft + Reload) | `[baseline]` | E |

## 14. Do-not-call (SCR-CC-008) — WF-REJECT-001

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-DNC-001 | a Rejected business | anyone tries Start Contact, follow-up scheduling, assignment, auto-fill | refused; it never appears in a callable bucket | `[baseline]` B1 | A, E |
| AC-DNC-002 | a Rejected business | the Owner reopens with a reason | outcome Pending; history kept; assignment unchanged; toast; `call_outcome.reopened`; without a reason → refused | `[flag-dependent (demonstration default)]` DEC-016 | A, E |
| AC-DNC-003 | Call Center | they view SCR-CC-008 | Reopen… disabled with "Owner only" explanation; API 403 | `[flag-dependent (demonstration default)]` DEC-016 | A, E |
| AC-DNC-004 | a Rejected business | — | still matched by duplicate checks; correction requests still allowed | `[baseline]` | A |

## 15. Deals and developer hand-off (SCR-CC-007, SCR-DEV-001, -002) — WF-DEAL-001/002, SM-COMMERCIAL-001

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-DEAL-001 | a deal record without a Developer | SCR-CC-007 is shown | "Schedule first meeting" is disabled until a Developer is assigned | `[baseline]` (handoff minor) | E |
| AC-DEAL-002 | Call Center or Owner | Assign developer | developer stored; `opportunity.developer_assigned`; Developer notified (in-app + email "New assignment") | `[baseline]` E2 | A, E |
| AC-DEAL-003 | a Developer | they open SCR-DEV-001 | tab Closed deals (company-wide eligible) and tab Accepted opportunities (assigned to them only); inaccessible rows omitted and not counted | `[flag-dependent (demonstration default)]` DEC-005 Alt 1 | A, E |
| AC-DEAL-004 | `deals.developerPreClosure=closedOnly` | — | the Accepted opportunities tab is absent and pre-closure API reads are 403 | `[flag-dependent (demonstration default)]` alternate branch | A |
| AC-DEAL-005 | Accepted opportunity | signature (date + agreement reference) is recorded | stage Signed (payment outstanding); `deal.signature_recorded` | `[flag-dependent (demonstration default)]` OQ-05, DEC-018 | A, E |
| AC-DEAL-006 | Accepted opportunity | payment (date + reference, optional amount/currency; a deposit counts) is recorded first | stage Paid (signature outstanding); then signature → Signed and paid | `[flag-dependent (demonstration default)]` OQ-05, DEC-018 `[NEEDS VALUE]` currency | A, E |
| AC-DEAL-007 | any non-closed stage | Mark not proceeding without a reason | refused; with a reason → Not proceeding; calling outcome stays Accepted; pending meeting reminders cancelled; `deal.marked_not_proceeding` | `[flag-dependent (demonstration default)]` B3-Q12 | A, E |
| AC-DEAL-008 | Not proceeding | the Owner re-queues | outcome → Pending with reason, history kept; or Owner reopens deal → Accepted opportunity with reason | `[flag-dependent (demonstration default)]` B3-Q12, OQ-15 | A |
| AC-DEAL-009 | a recorded fact before closure | the Owner removes it with a reason | stage reverts; original kept in audit; `deal.fact_removed` | `[flag-dependent (demonstration default)]` | A, E |
| AC-DEAL-010 | the deal record was changed meanwhile | Save | conflict banner; "Review changes" → SCR-SHR-014; nothing overwritten | `[baseline]` | E |
| AC-DEAL-011 | Data Entry or Call Center | they try signature/payment/closure | 403 | `[baseline]` / `[flag-dependent (demonstration default)]` OQ-03 | A |

## 16. Closure and project creation (SCR-DEV-002, SCR-DEV-008, SCR-OWN-012) — WF-DEAL-002, F2/F3

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-CLOSE-001 | stage Signed and paid | the assigned Developer presses "Request closure verification" | Owner review item created ("Closure verification requested" filter + dashboard count); stage unchanged; `deal.closure_requested` | `[flag-dependent (demonstration default)]` `deals.closureMode=ownerVerify` (DEC-006 Alt B), RW-04 | A, E |
| AC-CLOSE-002 | a verification request | the Owner rejects with a reason | stage stays Signed and paid; Developer sees the rejected banner; `deal.closure_rejected`; without a reason → refused | `[flag-dependent (demonstration default)]` DEC-006 Alt B | A, E |
| AC-CLOSE-003 | a verification request | the Owner presses "Verify & finalize closure" | stage Closed deal; closer and time recorded; `deal.closed` | `[flag-dependent (demonstration default)]` DEC-006 Alt B | A, E |
| AC-CLOSE-004 | signature or payment missing | finalize is attempted (any role, any API path) | blocked with the missing fact named | `[baseline]` (closed = accepted + signed + paid) | A, E |
| AC-CLOSE-005 | the Owner | they finalize directly without a request | allowed | `[flag-dependent (demonstration default)]` B5 | A |
| AC-CLOSE-006 | a Developer under Alt B | they call the finalize endpoint | 403 | `[flag-dependent (demonstration default)]` DEC-006 Alt B | A |
| AC-CLOSE-007 | a deal is closed | provisioning runs | the project board is created automatically in status Scheduled, linked to the deal; `project.provisioned`; success state shows a "pending" chip and "Open project board" stays disabled until the board exists | `[flag-dependent (demonstration default)]` `projects.autoProvision=true` (F2) | A, E |
| AC-CLOSE-008 | provisioning fails | — | closure **stays committed**; Owner sees "Closed deal without project" with Retry (SCR-OWN-012 / DEV-002); `project.provisioning_failed` | `[baseline]` F3 | A, E |
| AC-CLOSE-009 | a closed deal with a project | provisioning is retried or triggered twice | at most one project per closed deal | `[flag-dependent (demonstration default)]` DEC-017 | A |
| AC-CLOSE-010 | a closed deal | it is opened | no Finalize, Request verification or Mark not proceeding controls; it can never be reopened | `[baseline]` handoff; OQ-15 `[flag-dependent (demonstration default)]` | A, E |
| AC-CLOSE-011 | `projects.autoProvision=false` | a deal closes | success shows "Create project board"; until used, "Closed deal without project" shows to the Owner | `[flag-dependent (demonstration default)]` alternate branch | A |
| AC-CLOSE-012 | `deals.closureMode=direct` | the Developer presses "Finalize closure…" | SCR-DEV-008 Confirm; deal closes | `[flag-dependent (demonstration default)]` alternate branch | A |

## 17. Meetings (SCR-DEV-003, -004) — SM-MEETING-001

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-MEET-001 | a deal record | a meeting is scheduled/rescheduled to a past time or with no attendee | error summary + field messages; nothing saved | `[baseline]` | A, E |
| AC-MEET-002 | Scheduled | Reschedule | self-transition; previous values in history; pending reminders superseded; toast "Meeting rescheduled"; `meeting.rescheduled` | `[baseline]` R-13 | A, E |
| AC-MEET-003 | Scheduled, start time passed | Record outcome → Held | Held; discovery notes attach to the deal; `meeting.held` | `[baseline]` | A, E |
| AC-MEET-004 | Scheduled, start time passed | Record outcome → Missed | Missed; deal shows "needs rearranging"; Reschedule allowed back to Scheduled | `[flag-dependent (demonstration default)]` R-13 Missed | A, E |
| AC-MEET-005 | Scheduled | Cancel with a reason (destructive confirm) | Cancelled; reminders cancelled; not reopenable | `[baseline]` | A, E |
| AC-MEET-006 | a meeting | — | reminders by email at −24 h and −1 h to attendees; a reminder failure leaves the meeting unchanged | `[flag-dependent (demonstration default)]` NOTIF | A |

## 18. Projects and the "Record delivered" open-task warning (SCR-DEV-005, -006) — SM-PROJECT-001

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-PROJ-001 | any project status | the "Move project to" row is shown | only allowed next statuses appear; invalid transitions are never shown and the API rejects them | `[flag-dependent (demonstration default)]` DEC-019 | A, E |
| AC-PROJ-002 | an In progress project with ≥ 1 task not Done and not Cancelled | **Record delivered** is clicked | the dialog "Record delivered with open tasks?" appears with the project line, the warning "N tasks are not Done or Cancelled…", the list of open tasks (each with its status and chips), "Project status: In progress → Delivered" and the caption labelling the rule a demonstration alternative | `[flag-dependent (demonstration default)]` OQ-10 (warn, do not block), DEC-019 | E (P7 check 1) |
| AC-PROJ-003 | an In progress project with **no** open tasks | Record delivered | no dialog; status Delivered; toast | `[flag-dependent (demonstration default)]` OQ-10 | E (P7 check 2) |
| AC-PROJ-004 | the open-task dialog | Cancel / × / Esc | dialog closes; status stays In progress; nothing audited | `[flag-dependent (demonstration default)]` OQ-10 | E (P7 check 3) |
| AC-PROJ-005 | the open-task dialog | "Record delivered" (primary) | **only** the project status and its history change to Delivered; every task keeps its status, owner, dates and column; the deal record is unchanged; toast "Project delivered · N tasks still open"; exactly one `project.status_changed` | `[flag-dependent (demonstration default)]` OQ-10 | A, E (P7 check 4) |
| AC-PROJ-006 | the open-task dialog | "Review open tasks" | dialog closes; no change; board filtered to open tasks | `[flag-dependent (demonstration default)]` | E |
| AC-PROJ-007 | a Waiting for client or Blocked project | — | Record delivered is not offered; the project must resume first | `[flag-dependent (demonstration default)]` DEC-019 | A, E |
| AC-PROJ-008 | a Delivered project with open tasks | Record completed | same pattern, title "Record completed with open tasks?"; after Completed the board is read-only | `[flag-dependent (demonstration default)]` OQ-10 | A, E |
| AC-PROJ-009 | "Waiting for client…" / "Blocked…" | submitted without the note/reason | refused; with it → status changes; `project.status_changed` | `[flag-dependent (demonstration default)]` | A, E |
| AC-PROJ-010 | a Completed project | the Owner reopens with a reason | In progress; others cannot | `[flag-dependent (demonstration default)]` OQ-15 | A |
| AC-PROJ-011 | a Developer not assigned to the project | they update it | 403 | `[flag-dependent (demonstration default)]` OQ-06 | A |
| AC-PROJ-012 | the Owner assigns a Developer | — | assignment history; "New assignment" notification | `[flag-dependent (demonstration default)]` N-6 | A |

## 19. Tasks (SCR-DEV-006, -007) — SM-TASK-001

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-TASK-001 | a card | it is dragged to another column | only the task status changes; project status unchanged | `[flag-dependent (demonstration default)]` | A, E |
| AC-TASK-002 | a card dropped on Cancelled / "Cancel task…" | without a reason | refused; with reason → Cancelled | `[flag-dependent (demonstration default)]` | A, E |
| AC-TASK-003 | the drawer | due date before start date | refused | `[flag-dependent (demonstration default)]` | A, E |
| AC-TASK-004 | Done | moved to In progress | Reopen; completion kept in history | `[flag-dependent (demonstration default)]` | A |
| AC-TASK-005 | "Mark dependency resolved" | — | clears the Client dependency chip; status unchanged | `[flag-dependent (demonstration default)]` | E |
| AC-TASK-006 | a task changed meanwhile | Save | "Reload task" / "Discard my changes"; nothing overwritten | `[baseline]` | E |
| AC-TASK-007 | a milestone | — | stored as a task attribute (flag + due date) | `[flag-dependent (demonstration default)]` OQ-09 | U |

## 20. Owner dashboard and reports (SCR-OWN-001, -009) — WF-REPORT-001

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-RPT-001 | the Owner | the dashboard loads | snapshot tiles ignore the period; period widgets follow Today / 7 days / 30 days; a failing widget shows Retry and re-queries only itself | `[baseline]` | E |
| AC-RPT-002 | the dashboard and every report | — | G1 pairs are separate metrics: call attempts ≠ businesses contacted; accepted ≠ closed; closed ≠ completed project; not checked in ≠ absent; pending ≠ unassigned; delivered ≠ completed | `[baseline]` G1 | A, E |
| AC-RPT-003 | the "Accepted opportunities" tile | — | counts deal records currently in stage Accepted opportunity, excluding Signed, Paid, Closed, Not proceeding | `[flag-dependent (demonstration default)]` B-1 | A |
| AC-RPT-004 | a stock metric | a comparison is requested | "Comparison not available" | `[flag-dependent (demonstration default)]` OQ-17 | E |
| AC-RPT-005 | a metric whose policy value is NEEDS VALUE (e.g. late arrivals without schedule) | — | "Not configured / policy pending", never 0 | `[baseline]` | E |
| AC-RPT-006 | revenue | — | not shown on the dashboard | `[baseline]` (until DEC-018 approval) | E |
| AC-RPT-007 | a non-Owner | they open `/reports` or `/` dashboard | Permission denied ("Go to My Day") | `[baseline]` | A, E |
| AC-RPT-008 | Development workload | — | three sub-counts per Developer (non-terminal deals, active projects, open tasks) | `[flag-dependent (demonstration default)]` RW-03 | A |

## 21. Exports — Owner only, synchronous (SCR-OWN-009) — ADR-010

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-EXP-001 | the Owner with 2FA complete and a non-empty result | Export (Excel / CSV / PDF) | the button shows "Preparing download…" + inline info banner; the file is returned **in the same HTTP request** (no job, no "ready later" state); browser download starts; success toast | `[baseline]` sync per ADR-010 / AR-15 | A, E |
| AC-EXP-002 | an export | the file is opened | rows match the on-screen filters exactly (same query); hidden records included for the Owner; header carries the filter summary | `[baseline]` | A |
| AC-EXP-003 | an export | it succeeds | `report.exported` (actor, format, filters, row count, time) | `[baseline]` | A |
| AC-EXP-004 | Data Entry, Call Center, Developer, or an Owner pending 2FA | they call the export endpoint | 403; no file; `report.export_denied` audited; UI shows the permission-denied page | `[baseline]` | A, E |
| AC-EXP-005 | the filtered result has no rows | — | Export is disabled | `[flag-dependent (demonstration default)]` OQ-16 | E |
| AC-EXP-006 | generation fails | — | error banner in place with Try again; **no partial file**; `report.export_failed` | `[baseline]` | A, E |
| AC-EXP-007 | the audit log | — | no export control on SCR-OWN-010 | `[flag-dependent (demonstration default)]` OQ-18 | E |
| AC-EXP-008 | CSV export | a cell starts with `= + - @` | it is neutralised (CSV injection) | `[impl-default]` security | U, A |

## 22. Audit events (SCR-OWN-010) — G2/G3, WF-REPORT-002

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-AUD-001 | any row in `audit_events` | UPDATE or DELETE is attempted through any interface (API, SQL as app role) | refused (trigger + grants); attempt audited where possible | `[baseline]` G3 | A |
| AC-AUD-002 | an audited action | its business transaction rolls back | no audit row; and an audit write failure rolls back the action | `[baseline]` | A |
| AC-AUD-003 | the Owner | they open SCR-OWN-010 | paged, time-ordered list; filters re-query; a row opens a read-only drawer with Close only; no edit/delete/hide anywhere; viewing is not audited | `[baseline]`; OQ-18 `[flag-dependent (demonstration default)]` | A, E |
| AC-AUD-004 | a non-Owner or pending Owner | they call the audit API | 403; `audit_log.access_denied` | `[baseline]` | A |
| AC-AUD-005 | any audit row | — | no password, reset token, TOTP secret, recovery code or CSRF token in any field | `[baseline]` | A |
| AC-AUD-006 | any audit row | — | carries actor, timestamp, event, entity type + id, request id (`X-Request-Id`), before/after where captured; actor of a deactivated employee is never rewritten | `[baseline]` | A |

**Event catalogue (each must be emitted exactly once by the named action; names Proposed, G2).** API tests assert the event for every action in sections 1–21:

| Area | Events |
|---|---|
| Identity | `login.failed`, `session.created`, `session.second_factor_verified`, `session.second_factor_failed`, `session.ended`, `session.logged_out`, `session.expired`, `session.revoked`, `two_factor.enrolled`, `two_factor.recovery_succeeded`, `password_reset.requested`, `password_reset.completed` |
| Accounts | `account.created`, `account.updated`, `account.profile_updated`, `account.role_changed`, `account.deactivated`, `account.reactivated` |
| Attendance | `attendance.checked_in`, `attendance.checked_out`, `attendance.checkout_failed`, `attendance.checkout_provisional`, `attendance.corrected`, `attendance.provisional_resolved`, `attendance_correction.submitted/approved/rejected/withdrawn`, settings change (security setting) |
| Business | `business.created`, `business.updated`, `business.duplicate_blocked`, `business.similar_name_confirmed`, `business.save_conflicted`, `business_access.denied`, `business_access.owner_viewed_hidden`, archive/restore |
| Corrections | `data_correction_request.submitted/review_started/released/resolved/closed_no_change/rejected/withdrawn` |
| Categories | `category.created/renamed/deactivated/reactivated` |
| Calling | `calling_assignment.assigned/reassigned/unassigned/retained`, `contact_reservation.acquired/released/expired/overridden`, `call_attempt.logged`, `call_outcome.changed`, `call_outcome.reopened`, `callback_marker.set/cleared`, `accepted_opportunity.created` |
| Follow-ups | `follow_up.scheduled/rescheduled/reassigned/completed/cancelled` |
| Deals | `opportunity.developer_assigned/developer_reassigned/handoff_updated`, `deal.signature_recorded/payment_recorded/fact_removed/closure_requested/closure_rejected/closed/marked_not_proceeding` |
| Delivery | `project.provisioned/provisioning_failed/status_changed/schedule_changed/developer_assigned`, `task.created/status_changed/completed/cancelled/assigned`, `meeting.scheduled/rescheduled/cancelled/held/missed/notes_updated` |
| Reports | `report.exported/export_failed/export_denied`, `audit_log.access_denied` |
| Delivery records (not user-facing audit) | `reminder.scheduled/sent/retry_scheduled/failed/suppressed/cancelled`, `notification.sent/failed/suppressed` |

Operational log only (must **not** appear in `audit_events`): `contact_reservation.renewed`, `contact_reservation.acquire_conflicted`.

## 23. Notifications and email (SCR-SHR-007, SCR-OWN-012) — WF-NOTIFY-001, SM-REMINDER-001

No real external email in any test environment: SMTP goes to the dev/log transport (coordination rule). E2E reads mail from that sink.

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-NOTIF-001 | a follow-up | it is scheduled | email reminder to the responsible user 15 min before; daily digest at shift start lists due follow-ups | `[flag-dependent (demonstration default)]` NOTIF (D18) | A |
| AC-NOTIF-002 | a follow-up still Scheduled 1 h after its time | — | overdue email to the responsible user; the Owner gets it in the daily digest | `[flag-dependent (demonstration default)]` NOTIF | A |
| AC-NOTIF-003 | assignment, developer hand-off, project Developer assignment, data-correction request, attendance correction awaiting review | the source save commits | notification sent immediately (in-app + email) to the defined recipient; nothing is sent for a rolled-back save | `[flag-dependent (demonstration default)]` NOTIF, N-6, OI-20 | A |
| AC-NOTIF-004 | a transient send failure | — | retries at +1 min, +10 min, +60 min (3 retries), each repeating the send-time re-check; then Failed | `[flag-dependent (demonstration default)]` NOTIF retries | A |
| AC-NOTIF-005 | a reminder whose recipient is deactivated or lost access by send time | it is dispatched | Suppressed; visible to the Owner on SCR-OWN-012; source unchanged | `[baseline]` C6/D6 | A, E |
| AC-NOTIF-006 | a Failed or Suppressed delivery | — | the Owner gets an in-app delivery-failure item (not email); the failure of that item never raises another (loop guard) | `[flag-dependent (demonstration default)]` NOTIF, D6 | A |
| AC-NOTIF-007 | a reminder whose trigger time has passed at scheduling | event still in future → send immediately; event already passed → state "Skipped" visible to the Owner | `[flag-dependent (demonstration default)]` B3-Q08 | A |
| AC-NOTIF-008 | a source rescheduled / completed / cancelled / reassigned | — | pending reminders Cancelled; replacements planned for reschedule or recipient change | `[baseline]` | A |
| AC-NOTIF-009 | SCR-OWN-012 | Send again on a Failed reminder | a new reminder is created; the old row stays Failed; audited; no "Mark reviewed" control | `[flag-dependent (demonstration default)]` AR-13 | A, E |
| AC-NOTIF-010 | the in-app list (SCR-SHR-007) | an item is opened | it is marked read and access is re-checked; "Mark all as read" clears the dot | `[flag-dependent (demonstration default)]` AR-14 | A, E |
| AC-NOTIF-011 | missing checkout | — | employee notified at shift end + 1 h; Owner in next-morning digest | `[flag-dependent (demonstration default)]` NOTIF | A |
| AC-NOTIF-012 | a password reset / reset link sent by the Owner | — | email goes to the dev transport; the UI says "queued", never "sent"; the link never appears in logs in production mode | `[baseline]` | A, E |
| AC-NOTIF-013 | any email body | — | contains only data the recipient may see (no hidden business names) | `[baseline]` C6 | A |

## 24. Employees and settings (SCR-OWN-002, -003, -011, SCR-SHR-006)

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-EMP-001 | the Owner | creates an employee with a duplicate email | inline error; drawer stays open | `[baseline]` | A, E |
| AC-EMP-002 | the Owner | deactivates an employee (confirm) | Deactivated; all sessions revoked; work stays attached and flagged; `account.deactivated` + `session.revoked` | `[baseline]` | A, E |
| AC-EMP-003 | the Owner | deactivates or demotes themselves or the last active Owner | refused; menu items disabled for own row | `[flag-dependent (demonstration default)]` | A, E |
| AC-EMP-004 | a stale `version` | PATCH status | 409 `VERSION_CONFLICT`; nothing changes | `[impl-default]` | A |
| AC-EMP-005 | a deactivated employee | the Owner reactivates | Active; assignments not restored | `[flag-dependent (demonstration default)]` OQ-14 (UI undesigned) | A |
| AC-EMP-006 | "Send reset link" | — | toast "Reset link queued" (never "sent") | `[baseline]` | E |
| AC-EMP-007 | a role change | — | sessions revoked; open items listed, not moved | `[flag-dependent (demonstration default)]` | A |
| AC-SET-001 | settings with NEEDS VALUE items | SCR-OWN-011 loads | they show "Not configured"; attendance checks stay inactive until timezone, schedule and office mode are saved | `[baseline]` handoff | A, E |
| AC-SET-002 | invalid values or a mode without a verifier (IP mode with empty IP list) | Save | error summary + inline errors; previous settings kept | `[baseline]` | A, E |
| AC-SET-003 | "Test office check" | — | inline result; nothing saved | `[baseline]` | E |
| AC-SET-004 | a saved settings change | — | applies to future sessions only; audited as a security setting change; Owner 2FA is shown as mandatory, not a setting | `[flag-dependent (demonstration default)]` | A |
| AC-SET-005 | profile save | — | toast "Profile saved"; theme radio applies immediately and is stored per user; password change signs out other sessions | `[flag-dependent (demonstration default)]` OQ-13, IMPL-PASSWORD | A, E |

## 25. Cross-cutting UI, accessibility and theme (SCR-SHR-011..015, all screens)

| ID | Given | When | Then | Tag | Level |
|---|---|---|---|---|---|
| AC-UI-001 | any screen in Light and Dark | axe-core runs (WCAG 2.1 A/AA rules) | zero serious or critical violations; every form control has a programmatic label | `[baseline]` | E |
| AC-UI-002 | Dark mode | any app screen loads | page and card surfaces are **navy** (hue 205°–235°, saturation ≥ 25 %), not black/grey; the sidebar is navy in both modes; all text meets 4.5:1 (3:1 for large text and UI boundaries) | `[baseline]` user directive 2026-10-23 | E |
| AC-UI-003 | any screen | the theme toggles | colours come from the semantic tokens (no hard-coded hex in components); both themes render from the same tokens | `[baseline]` handoff | U (lint), E |
| AC-UI-004 | mobile (390 px) | interactive controls | tap targets ≥ 44 px; check-in, checkout and correction are full-screen flows with a sticky footer | `[baseline]` | E |
| AC-UI-005 | a flag-dependent behaviour on screen | — | labelled "Demonstration alternative — not approved" in non-production builds; policy chips absent in production builds | `[baseline]` coordination rule | E |
| AC-UI-006 | SCR-SHR-015 | offline | Save disabled with the reason; Try again retries in place; toasts auto-dismiss except Error toasts; validation summary links focus fields | `[baseline]` | E |
| AC-UI-007 | any screen with a Figma preview | captured at the preview size (1440×900 desktop, 390×844 mobile) | visual diff against `docs/phase6/previews` is reviewed (advisory gate, see strategy) | `[baseline]` | E |
| AC-UI-008 | drawers and dialogs | open / Esc / close | focus moves into the dialog, is trapped, and returns to the trigger | `[baseline]` | E |
| AC-UI-009 | Notice/Access Context-limited/Inline | — | rendered ≥ 234 px wide | `[baseline]` DS-13d | E |

---

## 26. Per-screen index (54 screens → criteria)

| Screen | Criteria |
|---|---|
| SCR-AUTH-001 Login | AUTH-001..003, 008, 009, 013, 014; UI-001, 002 |
| SCR-AUTH-002 Owner 2FA | AUTH-004..007, 011 |
| SCR-AUTH-003 2FA enrollment & recovery | AUTH-003, 019 |
| SCR-AUTH-004 Reset password | AUTH-015..018; NOTIF-012 |
| SCR-SHR-001 My Day | PERM-103; ATT-001, 007 |
| SCR-SHR-002 Check-in | ATT-001..008, 016 |
| SCR-SHR-003 Checkout | ATT-009..012 |
| SCR-SHR-004 My attendance | ATT-007, 013; ACOR-001, 009 |
| SCR-SHR-005 Correction request | ACOR-001..005 |
| SCR-SHR-006 Profile | PERM-02; SET-005 |
| SCR-SHR-007 Notifications | NOTIF-010; VIS-014, 018 |
| SCR-SHR-008 Business detail | BIZ-007, 008; VIS-002, 005, 007 |
| SCR-SHR-009 Submit data correction | DFIX-001, 002; PERM-101 |
| SCR-SHR-010 Search results | BIZ-011; VIS-006 |
| SCR-SHR-011 Permission denied | AUTH-021; PERM-* |
| SCR-SHR-012 Hidden by policy | VIS-002, 007, 017 |
| SCR-SHR-013 Session expired | AUTH-010, 022 |
| SCR-SHR-014 Save conflict | BIZ-007; DEAL-010 |
| SCR-SHR-015 System states | UI-006 |
| SCR-OWN-001 Dashboard | RPT-001..006, 008 |
| SCR-OWN-002 Employees | PERM-01; EMP-001..006 |
| SCR-OWN-003 Employee drawer | EMP-001..007 |
| SCR-OWN-004 Attendance monitoring | ATT-013..015 |
| SCR-OWN-005 Corrections & review | ACOR-003, 004, 006..008 |
| SCR-OWN-006 Targets & work lists | PERM-33; CALL-004 |
| SCR-OWN-007 Calling assignments | CALL-001..006; VIS-016 |
| SCR-OWN-008 Reassignment impact | CALL-002, 003; RES-009 |
| SCR-OWN-009 Reports & exports | RPT-007; EXP-001..006, 008 |
| SCR-OWN-010 Audit log | AUD-001..006; EXP-007 |
| SCR-OWN-011 Settings | SET-001..004 |
| SCR-OWN-012 Delivery monitor | NOTIF-005, 006, 009; CLOSE-008 |
| SCR-DE-001 Directory | PERM-09; VIS-006; BIZ-010 |
| SCR-DE-002 Create business | BIZ-001..006; DUP-001..005 |
| SCR-DE-003 Duplicate dialog (samples only) | DUP-006..009 |
| SCR-DE-004 Edit business | BIZ-007..009; DUP-010, 011 |
| SCR-DE-005 Resolve correction | DFIX-003..005; DUP-013 |
| SCR-DE-006 Correction queue | DFIX-009; VIS-013 |
| SCR-DE-007 Categories | CAT-001..004 |
| SCR-CC-001 Calling queue | CALL-005; DNC-001 |
| SCR-CC-002 Contact workspace | RES-001..003, 012 |
| SCR-CC-003 Active contact | OUT-001..015; RES-010, 011 |
| SCR-CC-004 Follow-ups | FUP-001..006 |
| SCR-CC-005 Reservation block | RES-002, 005..009 |
| SCR-CC-006 Follow-up drawer | FUP-001..004, 009 |
| SCR-CC-007 Opportunities | DEAL-001, 002; OUT-011 |
| SCR-CC-008 Do-not-call | DNC-001..004 |
| SCR-DEV-001 Deals | DEAL-003, 004; CLOSE-001 |
| SCR-DEV-002 Deal detail | DEAL-005..011; CLOSE-002..006, 010 |
| SCR-DEV-003 Meetings | MEET-001..006 |
| SCR-DEV-004 Meeting drawer | MEET-001..005 |
| SCR-DEV-005 Projects | PROJ-001, 011, 012 |
| SCR-DEV-006 Project board | PROJ-001..010; TASK-001, 002 |
| SCR-DEV-007 Task drawer | TASK-002..006 |
| SCR-DEV-008 Finalize closure | CLOSE-003, 004, 007, 008, 011, 012 |

## 27. Known gaps that block a criterion (tracked, not invented)

- SCR-DE-003 is built only from page-30 samples; SCR-OWN-011 is Partial (C11 blocked); undesigned states (Withdrawn correction, Reactivate, Set-target form, Schedule-new meeting desktop, Scheduled/Delivered project rows) are tested for behaviour only, not visually.
- 2FA recovery codes, Outbox/J-02 email relay, the access engine (C8) and every non-identity module are not built yet (status 2026-10-23). Their criteria are `fixme` in the test suite until the owning increment lands.
- DEC-024 has no defined meaning: no criterion.
