# Phase 2 Batch 2 — Business Data and Visibility (specifications)

Status: **DRAFT, repair attempt 1 (task T2c-part1), not re-reviewed, not approved.** Author: Agent 2. **Baseline: SB-2** (`docs/phase2/shared-baseline.md`, incl. §10 rulings R-01..R-13 and §11 terms; all rulings are Proposed, not approved policy).
Nothing in this file is tested. There is no software. Board 02 has **not** been written.

Companion files:
- [batch2-mermaid.md](batch2-mermaid.md): Mermaid source for every diagram proposed here.
- [open-items.md](open-items.md): open questions, decision dependencies, items resolved by SB-2, remaining baseline change requests.
- [repair-log.md](repair-log.md): review defect RV2-01..RV2-23 → change made.

---

## 0. Reading guide

### 0.1 Rule status tags

| Tag | Meaning |
|---|---|
| **[Confirmed]** | Stated in ART-01 (Tier 1), or a Confirmed item in SB-2 §4/§6 |
| **[Confirmed-derived]** | Follows directly from a Confirmed rule but is not written in those words; the source is cited |
| **[Proposed]** | Agent 2 default, or an SB-2 Proposed contract/ruling. The user may change it. Not approved |
| **[Unresolved]** | No rule exists. Drawn as a branch or marked "policy-dependent" |
| **[Policy-dependent: DEC-xxx / C-0x / R-xx]** | Behaviour depends on an open decision. Alternatives are shown **unselected** |
| **→ USER** | A question SB-2 §10 reserves for the user (R-10, R-11, R-12) |

**Drafted alternatives.** Board 01 lists alternatives only for DEC-001, DEC-002 and DEC-005 (read-only nodes `24:414`, `25:430`, `26:430`); those are quoted. Every other alternative in this batch is **drafted by Agent 2** so that the branch can be drawn, is marked "(drafted)" in the text **and** in every diagram label, and is unselected:

| Local label | Question | Alternatives (drafted, unselected) |
|---|---|---|
| Alt PH-1 / PH-2 | Phone mandatory at creation (contract B2, no DEC ID) | mandatory / optional |
| Alt NM-A / NM-B / NM-C | DEC-013 name-only matching and branches | exact name blocks / exact name blocks unless branch differs / name-only match warns |
| Alt SN-1 / SN-2 | DEC-013 similar names | non-blocking warning (coincides with ART-11 D11, Tier 4) / not checked |
| Alt DE-1 / DE-2 | Data Entry base scope (no DEC ID) | any business / own-created plus correction queue |
| Alt CA-A / CA-B / CA-C | DEC-015 category authority | Owner only / Data Entry may create / Data Entry suggests, Owner approves |
| Alt CR-1 / CR-2 | Category removal behaviour (no DEC ID) | deactivate / delete only if unused |
| Reading R11-a / R11-b | R-11 (→ USER): Owner session waiting for 2FA | all business access waits for 2FA / only administrative actions wait |

None of these drafts changes any DEC meaning. Local labels (VR-, DR-, VT-, RT, BIZ1-, BIZ2A-, BIZ2B-, CAT-, OI-) are local to Batch 2 and are not canonical IDs.

### 0.2 Notation
As SB-2 §7: yellow + "(DEC-xxx)" = unresolved or proposed dependency; orange + "Alt" = unselected alternative; red = failure, rejection or denial; green = success end; blue + "(derived)" = derived classification; dotted = retry or side effect; `[[...]]` = hand-off. Flowcharts use phase groups with the actor named inside each step.

### 0.3 Sources read
- SB-2 (in full), ART-01 (in full), `phase_2_workflows_and_state_machines.md`, `phase_2_batch1_mermaid.md`, `artifact-register.md`, `decisions.md`, review `reviews/batch2-spec-review.md`, and the Access-check references in `batch3/batch3-spec.md` and `batch4/batch4-spec.md` (to align resource names; not edited).
- Board 01 (read-only): DEC-001 `24:414`, DEC-002 `25:430`, DEC-005 `26:430`, DEC index `28:534`, permission summary `27:470`, and a text search of the board. Nothing on Board 01 was edited.
- ART-11 proposals are Tier 4. They are cited only as "ART-11 proposal" and never used as rules.

### 0.4 Terminology (SB-2 §5 and §11)
- **Business** / **master data** (ART-01 §6.1 fields: name, category, phone numbers, social accounts with follower count and last-post date, has-website, website URL, extra notes) vs **operational data** (assignment, calling outcome, call attempts, follow-ups, deal records, meetings, projects, tasks). Batch 2 edits master data only.
- **Hidden (15-day)**: an access result for one user and one resource. The record stays stored and duplicate-checked. Hidden ≠ deleted ≠ archived.
- **Deal record** (SB-2 §11, E5): commercial record created when Accepted is finalized; stage "Accepted opportunity" until it progresses. A closed deal is a deal record that is accepted + signed + paid.
- **Context-limited access** (SB-2 §11): only the fields (and, per table VT-5, the actions) a context needs, without directory browsing.
- **Edit history** (SB-2 §11): field-level before/after history of a business, visible to users who pass the Access check for that business. **Audit trail** (SB-2 §11, G3): Owner-only append-only log.
- **Data-correction request**: a flag that master data is wrong. Its terminal state is written **"Rejected (request)"** so it is never confused with the calling outcome Rejected (do-not-call).
- **Access check (WF-ACCESS-001)**: the single evaluation defined by SM-VISIBILITY-001 and applied by WF-ACCESS-001 (contract C5).

---

## 1. Scope and coverage

| UC (Board 01) | Covered by | Notes |
|---|---|---|
| UC-BIZ-001 Create business | WF-BIZ-001 Part 1–2 | |
| UC-BIZ-002 Intercept duplicate & block | WF-BIZ-001 Part 2; revalidation in WF-BIZ-002 Part A | Block cannot be bypassed [Confirmed] |
| UC-BIZ-003 Hidden duplicate & request escalation | WF-BIZ-001 Part 2 (display); WF-ACCESS-001 Part 3 + SM-VISIBILITY-001 (evaluation) | Revelation scope DEC-003 unselected; escalation is part of DEC-003, **not adopted** ("only if adopted" branch) |
| UC-BIZ-004 Edit business | WF-BIZ-002 Part A | |
| UC-BIZ-005 Submit data correction | WF-BIZ-002 Part B; SM-DATAFIX-001 | |
| UC-BIZ-006 Review & resolve correction | WF-BIZ-002 Part B; SM-DATAFIX-001 | Applying re-enters Part A |
| UC-BIZ-007 Manage dynamic categories | WF-BIZ-003 | DEC-015; category removal (no DEC ID) |
| UC-BIZ-008 Search, detail & edit history | **WF-ACCESS-001 Part 1** | Decision: UC-BIZ-008 lives in WF-ACCESS-001 (read surfaces). Edit history is **recorded** in WF-BIZ-001 (start) and WF-BIZ-002 (each change) |
| UC-PROJ-001 View company-wide closed deals (visibility part) | WF-ACCESS-001 Part 2 + table RT; SM-VISIBILITY-001 VT-2, VT-5 rows 2–4 | Delivery behaviour stays in WF-PROJ-001 (Batch 4) |

REQ mapping by **range only** (ART-02 unavailable): REQ-BIZ-001..009, REQ-SEC-DUP-001..007, REQ-SEC-VIS-001..006, REQ-PROJ-001..008, REQ-AUTH-001..009, REQ-REPORT-001..006, REQ-CALL-001..011 (B7 calling actions). No SCR IDs.

---

## 2. Shared rule tables (WF-BIZ-001, WF-BIZ-002)

### 2.1 Field validation rules (VR)

| # | Rule | Status |
|---|---|---|
| VR-1 | Business name is present (not blank after trimming) | [Proposed] (field Confirmed in ART-01 §6.1; "mandatory" not stated) |
| VR-2 | Category chosen from the currently selectable categories (WF-BIZ-003); no free text | Dynamic list [Confirmed]; mandatory [Proposed]; "selectable" depends on the category-removal question (no DEC ID) |
| VR-3 | Multiple phone numbers supported | [Confirmed] |
| VR-4 | Each entered phone is well-formed and normalizable (method: no DEC ID; default country code needs company input) | [Proposed] |
| VR-5 | At least one phone mandatory at creation | **[Unresolved] (no DEC ID; contract B2).** Alt PH-1 (drafted): mandatory. Alt PH-2 (drafted): optional; the business is then "not eligible for calling" (derived, B2) until a phone exists |
| VR-6 | The same normalized phone is not entered twice on one record (collapsed with a notice) | [Proposed] |
| VR-7 | At least one social-media account | [Confirmed] (ART-01 §6.2) |
| VR-8 | Each social account has a platform from the configured list (Instagram, TikTok, Facebook, other configured platforms) and a link or handle | Platform list [Confirmed]; link/handle format [Proposed]. DEC-024 ("Social Media Platform Ingestion Priority") is **possibly related; its scope is not defined** and no meaning is assigned to it here |
| VR-9 | Follower count per account: non-negative whole number **or explicitly Unknown**; never defaulted to 0 | Manual entry [Confirmed]; "not fabricated" [Confirmed principle, ART-01 §6.2]; Unknown mechanism [Policy-dependent: DEC-014]; history vs current value [Policy-dependent: DEC-023] |
| VR-10 | Last-post date per account: a past or today date **or explicitly Unknown**; never a placeholder | As VR-9; "not in the future" [Proposed] |
| VR-11 | Has website checked ⇒ URL present and well-formed; unchecked ⇒ URL empty | URL "when a website exists" [Confirmed]; mandatory-when-checked and empty-when-unchecked [Proposed]; "unknown" not expressible (OI-12) |
| VR-12 | Extra notes optional. Created/updated by/at are set by the system | Fields [Confirmed]; system-set [Proposed] |

Diagrams draw the checks in sequence for readability; the form reports **all** failed rules together [Proposed].

### 2.2 Duplicate rules (DR)

| # | Rule | Status |
|---|---|---|
| DR-1 | The duplicate check uses phone numbers and business name | [Confirmed] (ART-01 §7) |
| DR-2 | It covers the **entire stored database, including records hidden from the user** | [Confirmed] (ART-01 §7–§8; C3) |
| DR-3 | A normalized phone equal to any phone on any other stored business blocks the save | Phone blocking [Confirmed]; normalization [Proposed] |
| DR-4 | Name handling | **[Policy-dependent: DEC-013]**, drafted alternatives (none selected): **Alt NM-A** exact normalized name blocks; **Alt NM-B** exact name blocks unless a branch/location value differs (needs a branch field **not** in ART-01 §6.1); **Alt NM-C** name-only match warns, does not block. Similar names: **Alt SN-1** non-blocking warning with possible matches (**coincides with ART-11 D11, Tier 4**); **Alt SN-2** not checked in v1 |
| DR-5 | A block cannot be bypassed by any role, including the Owner; no override control | [Confirmed] (ART-01 §2.2, §7; Board `27:449`) |
| DR-6 | No merging | [Confirmed] (ART-01 §1, §7) |
| DR-7 | On edit, the record being edited is excluded from its own check | [Confirmed] (ART-01 §7; Board `27:440`) |
| DR-8 | **Concurrency:** the duplicate check is repeated atomically inside the save for (a) every creation and (b) every edit that changes the name or a phone (including the apply step of a correction request). Two concurrent saves — create/create, edit/edit on different businesses, or edit/create — can never both store the same normalized phone (or a blocking name). The later save gets a duplicate block. Mechanism is Phase 3 | [Confirmed-derived] from DR-5 (ART-01 §7 "cannot bypass the block"; ART-01 does not mention simultaneous saves explicitly) |
| DR-9 | What the blocked user sees: "already exists" always [Confirmed]; a preview within the user's permissions when the user can read the match [Confirmed, ART-01 §7]; for a match the user cannot read, extra detail is **[Policy-dependent: DEC-003]**; the Owner always sees the full match (C1) | Mixed |

If archiving is adopted (C-01, business records), archived businesses stay stored, so DR-2 would include them [Proposed derivation]. A permanently deleted business cannot match.

---

## 3. WF-BIZ-001 — Business creation and duplicate block

- **ID / Name:** WF-BIZ-001 — Business creation, validation, duplicate block (active and hidden), save.
- **Purpose:** Add one new business with valid master data, never creating a duplicate.
- **REQ range:** REQ-BIZ-001..009, REQ-SEC-DUP-001..007, REQ-SEC-VIS-001..006 (range only).
- **UC:** UC-BIZ-001, UC-BIZ-002, UC-BIZ-003 (display part).
- **Actors:** Data Entry, Owner; System.
- **Trigger:** Data Entry or Owner selects "New business".
- **Preconditions:**
  - Account active and authenticated [Confirmed].
  - Owner session: 2FA complete for administrative access [Confirmed]. Whether an Owner session **waiting for 2FA** may create a business is **R-11 → USER**: Reading R11-a denies; Reading R11-b allows only non-administrative actions, and whether creation counts as administrative is part of the same question. Both readings are shown; neither is selected.
  - Role Data Entry or Owner [Confirmed]. Call Center and Developer have no create control [Confirmed: SB-2 §4].
  - At least one selectable category exists, else hand-off to WF-BIZ-003 [Proposed].
  - **No attendance gating** (contract A1).
- **Main path:**
  1. System checks authorization.
  2. Data Entry or Owner enters master data (metrics may be explicitly Unknown).
  3. System validates VR-1..VR-12; all errors reported together.
  4. System normalizes phones (DR-3) and name (DR-4).
  5. System checks normalized phones against every stored business (DR-2, DR-3).
  6. System applies DEC-013 name handling (DR-4) and, if adopted, the similar-name warning.
  7. No duplicate: System saves with the atomic duplicate re-check (DR-8), sets created by/at and last updated by/at.
  8. System writes `business.created`, starts the edit history with the initial values. The creation time is the timer-basis origin under DEC-001 Alt A, and also under Alt B until the first reset touchpoint [Proposed interpretation; OI-17a].
  9. The business starts **unassigned + calling outcome Pending** (C-02 separation, Proposed; owned by Batch 3). Hand-off to WF-CALL-001 (B8: only WF-CALL-001 creates assignments).
- **Alternate paths:**
  - BIZ1-a Phone policy (VR-5): under Alt PH-2 the business may be saved without a phone and is "not eligible for calling" (derived, B2).
  - BIZ1-b Similar-name or name-only warning (Alt SN-1 or Alt NM-C): the creator reviews possible matches; "different business, continue" → save; "cancel" → nothing saved. Confirmation audited [Proposed].
  - BIZ1-c Duplicate the creator can read: block; preview and link within the creator's permissions (DR-9).
  - BIZ1-d Duplicate the creator cannot read (hidden or out of scope): block; "already exists" plus only what DEC-003 permits. "Request escalation" appears only if DEC-003 adopts it (UC-BIZ-003); **not adopted**.
  - BIZ1-e Owner creating: an Owner always sees the full match (C1) and is still blocked (DR-5).
- **Errors and recovery:** permission denied (nothing saved); validation errors (form kept, corrected in a loop); no selectable category (WF-BIZ-003); concurrent duplicate at save (DR-8; treated as BIZ1-c/d); save failed (nothing created; retry re-runs the duplicate check) [Proposed]; session expired (re-authenticate).
- **Authorization:** Data Entry, Owner [Confirmed]; Owner 2FA as above (R-11).
- **Visibility/assignment:** The duplicate check ignores visibility (DR-2). What the warning reveals uses the Access check. Later access by the creator follows SM-VISIBILITY-001 (Data Entry base scope unresolved, VT-2).
- **Data changes:** New business with attribution; edit-history start; Pending/Unassigned (Batch 3 fields). Blocked attempts store nothing on any business.
- **Audit events (proposed):** `business.created`; `business.duplicate_blocked`; `business.similar_name_confirmed` (Alt NM-C/SN-1 only); `business.hidden_match_revealed` (only if DEC-003 reveals more than "already exists"); `business.escalation_requested` (only if DEC-003 adopts escalation).
- **Notification events:** None [Proposed]. DEC-003 escalation, if adopted, would need an Owner notification.
- **Postconditions:** Exactly one new business with attribution and history start, or nothing saved and the reason shown. No duplicate by phone; name duplicates per DEC-013.
- **Decision dependencies:** DEC-001, DEC-003, DEC-013, DEC-014, DEC-015, DEC-023; B2 phone (no DEC ID); R-11 (→ USER); C-01 (archived businesses in DR-2); C-02.
- **Diagrams:** WF-BIZ-001 Part 1 (19 nodes), Part 2 (24 nodes).

---

## 4. WF-BIZ-002 — Business editing and data-correction requests

### 4A. Part A — Edit master data

- **ID / Name:** WF-BIZ-002 Part A — Business edit with self-exclusion, duplicate revalidation and concurrent-edit conflict.
- **Purpose:** Correct master data without duplicates, without silent overwrites, with a full change trail.
- **REQ range:** REQ-BIZ-001..009, REQ-SEC-DUP-001..007. **UC:** UC-BIZ-004; apply step of UC-BIZ-006.
- **Actors:** Data Entry, Owner; System.
- **Trigger:** "Edit" on a business detail, or a reviewer applies a correction (Part B).
- **Preconditions:** Access check returns read **and** edit allowed (read ≠ edit). Under context-limited access, edit is allowed only as the apply step of an open correction request under DEC-002 row 6 Alt B (VT-5) [Proposed]. Owner 2FA per R-11. No attendance gating (A1).
- **Main path:**
  1. System runs the Access check for "edit master data".
  2. System loads current values and a version marker.
  3. Data Entry or Owner changes permitted master fields only. Calling outcome, assignment and commercial fields are not on this form (Data Entry cannot change commercial status [Confirmed]).
  4. System validates VR-1..VR-12. Removing the last social account is invalid [Confirmed]; removing the last phone follows VR-5.
  5. If the name or any phone changed, System re-runs the duplicate check over the entire database **excluding this record** (DR-2, DR-7) with DEC-013 name handling.
  6. System saves only if (a) the version is unchanged, (b) the Access check still passes, and (c) for name/phone changes, the atomic duplicate re-check passes (DR-8). In the same save it writes one edit-history entry per changed field (who, when, previous, new) and updates last updated by/at.
  7. System audits `business.updated`.
  8. Derived effects recalculated: calling eligibility (B2) if phones changed.
- **Alternate paths:**
  - BIZ2A-a No field changed: nothing saved, no history entry [Proposed].
  - BIZ2A-b Only non-duplicate fields changed: duplicate re-check skipped [Proposed].
  - BIZ2A-c Similar-name/name-only warning: confirm or cancel (as BIZ1-b).
  - BIZ2A-d Business has a deactivated category (Alt CR-1, drafted): may be kept unchanged; changing it requires a selectable category [Proposed].
  - BIZ2A-e Business is Rejected (do-not-call): master data may still be corrected; the calling outcome is untouched [Proposed].
- **Errors and recovery:**
  - Access denied: "Permission denied" (role/scope/assignment) or "Record hidden by policy" (window passed, no exception). Call Center and Developer are offered "Flag incorrect data" (Part B) [Confirmed: they request corrections].
  - Validation errors: corrected in a loop.
  - Duplicate found (step 5) or **concurrent duplicate at save** (DR-8): save blocked, no bypass (DR-5); preview per DR-9; the user changes the value or cancels.
  - **Save conflict** (version stale): nothing overwritten; latest values shown; the user re-applies, re-validated and re-checked. [Confirmed-derived: ART-01 §18 lists "Save conflict" and §7 is headed "Editing and concurrent changes"; "no silent overwrite" Proposed; mechanism Phase 3.]
  - Access lost since loading (window expired, reassignment, deactivation): save denied; nothing saved [Proposed: evaluation on every request].
  - Save failed (technical): no change; edits kept; retry.
- **Authorization:** Data Entry, Owner within access scope [Confirmed].
- **Visibility/assignment:** Editing never resets the 15-day timer: Alt A never resets; Alt B resets only on `call_attempt.logged` or `follow_up.scheduled` (R-07, Proposed alignment), and Board `24:414` states note edits and status tweaks do not reset.
- **Data changes:** Changed master fields; last updated by/at; edit-history entries. Created by/at never change.
- **Audit events (proposed):** `business.updated`; `business.duplicate_blocked`; `business.save_conflicted` (operational, not counted).
- **Notification events:** None [Proposed]. Loss of calling eligibility is presented in the agent's queue by Batch 3.
- **Postconditions:** One accepted version; every changed field has a history entry; no duplicate by phone exists, even under concurrency.
- **Decision dependencies:** DEC-001, DEC-002 (row 6 edit-in-context), **DEC-003** (duplicate preview), DEC-013, DEC-014, DEC-023; B2; R-07; R-11; category removal (no DEC ID).
- **Diagram:** WF-BIZ-002 Part A (20 nodes).

### 4B. Part B — Data-correction request

- **ID / Name:** WF-BIZ-002 Part B — Data-correction request submit, review, resolve.
- **Purpose:** Let users who must not edit master data report wrong data; let Data Entry or the Owner verify and fix it with a recorded result.
- **REQ range:** REQ-BIZ-001..009. **UC:** UC-BIZ-005, UC-BIZ-006.
- **Actors:** Requester: Call Center, Developer, Owner [Confirmed, ART-01 §14]. Reviewer: Data Entry, Owner [Confirmed]. System.
- **Trigger:** "Flag incorrect data" from a normal authorized workspace (calling workspace, deal record or project context, business detail), not only rejected-business screens [Confirmed, ART-01 §14].
- **Preconditions:** Requester passes the Access check (full or context-limited) on the business at submit time. Data Entry submission not stated (Proposed: not needed). **No attendance gating (A1).**
- **Main path (submit):**
  1. System runs the Access check (read).
  2. Requester chooses the field or issue type (incorrect phone, outdated social link, wrong category, missing website information, business no longer operating, other — ART-01 §14), explains, optionally suggests a value.
  3. System validates issue type and explanation present [Proposed]. Suggested values are validated only when applied.
  4. Other open requests on the business are shown; submission still allowed [Proposed: warn, not block].
  5. System saves the request as **Submitted**; the business shows "needs correction" (derived, ≥1 open request).
  6. Notification "data-correction request" to reviewers (event Confirmed, ART-01 §16; recipients/timing/channel no DEC ID; dispatched by WF-NOTIFY-001 without a state model, R-08).
- **Main path (review and resolve):**
  1. Data Entry or Owner opens the correction queue. Assignment [Proposed; ART-01 §14 "rules remain proposed"]: one shared queue; a reviewer takes a request by starting review.
  2. System runs the Access check for the reviewer. Whether an open request keeps the business visible to Data Entry is **DEC-002 row 6** (Alt A hidden day 16; Alt B exempt in queue, visible to Data Entry until resolved).
  3. Reviewer starts review → **In review**.
  4. Reviewer verifies the information.
  5. Decision: **apply changes** through Part A (validation, self-excluded duplicate re-check, atomic re-check at save DR-8, version check) → on success **Resolved** in the same save [Proposed: atomic]; **no change needed** → **Closed – no change needed** with a note [Proposed]; **request incorrect** → **Rejected (request)** with a mandatory reason [Proposed].
  6. System audits; requester informed (channel unresolved).
- **Alternate paths:**
  - BIZ2B-a Requester withdraws before resolution → **Withdrawn** [Proposed].
  - BIZ2B-b Reviewer releases, or the reviewer's account is deactivated → **Submitted** [Proposed].
  - BIZ2B-c "Business no longer operating": business archiving is unresolved (C-01). Until decided, the reviewer records it in notes (apply) or closes with a note; no deletion implied.
  - BIZ2B-d "Wrong category" where the right category does not exist: request stays In review until an authorized user adds it (WF-BIZ-003, DEC-015).
  - BIZ2B-e Under DEC-002 row 6 Alt A, a business hidden from Data Entry can be reviewed only by the Owner; Data Entry sees at most a redacted queue row [Proposed; OI-08].
  - BIZ2B-f Business archived or deleted while the request is open (C-01): closed "no change needed", reason "business unavailable" [Policy-dependent: C-01].
- **Errors and recovery:** no read access → no flag control, nothing saved; incomplete request → loop; apply blocked by duplicate (incl. concurrent, DR-8) → no merge, request stays In review, reviewer changes the value, closes or rejects ("matches existing business"); save conflict / validation error / save failure → stays In review; two reviewers → first start-review wins [Proposed; mechanism Phase 3].
- **Authorization:** Submit — Call Center, Developer, Owner with access [Confirmed]. Review — Data Entry, Owner with access [Confirmed roles; access per DEC-002 row 6].
- **Visibility/assignment:** A request grants access only as DEC-002 row 6 defines. Requester's own request after the business is hidden to them: status visible, business data redacted [Proposed; OI-09]. An open request does not block assignment or contact (contract B5).
- **Data changes:** Correction request (business, requester, issue type, explanation, suggestion, status, reviewer, resolution details, timestamps). Apply: business changes via Part A.
- **Audit events (proposed):** `data_correction_request.submitted`, `.review_started`, `.released`, `.resolved` (with `business.updated`), `.closed_no_change`, `.rejected`, `.withdrawn`.
- **Notification events:** "Data-correction request" to reviewers [event Confirmed; recipients/timing no DEC ID]; outcome to requester [Proposed]. Send-time Access re-check (C6).
- **Postconditions:** Each request ends in exactly one terminal state with attribution; applied changes have history entries; "needs correction" clears when no open request remains.
- **Decision dependencies:** DEC-002 row 6, DEC-003 (apply-block preview), DEC-013, DEC-015, C-01; notification timing (no DEC ID).
- **Diagram:** WF-BIZ-002 Part B (22 nodes). Lifecycle: SM-DATAFIX-001 (§8).

---

## 5. WF-BIZ-003 — Category management

- **ID / Name:** WF-BIZ-003 — Dynamic category management.
- **Purpose:** Keep the category list dynamic without near-duplicates and without losing existing classifications.
- **REQ range:** REQ-BIZ-001..009. **UC:** UC-BIZ-007.
- **Actors:** Owner [Confirmed]; Data Entry [Policy-dependent: DEC-015]; System.
- **Trigger:** Category management opened, or creation blocked for lack of a fitting category.
- **Preconditions:** Active account; Owner 2FA per R-11 (category management is a settings-type action; whether it is "administrative" is part of R-11). No attendance gating (A1).
- **Authority (DEC-015, drafted alternatives, none selected):** Alt CA-A (drafted) Owner only; Alt CA-B (drafted) Data Entry may also create, rename/removal stay with the Owner; Alt CA-C (drafted) Data Entry suggests, Owner approves or declines. (ART-11 D12 "Other + note" is Tier 4, not drawn.)
- **Main path (create / rename):**
  1. Authorized user enters a name.
  2. System checks: name present; **normalized name unique among all categories, including inactive** [Proposed; normalization = trim, collapse spaces, case-insensitive].
  3. System saves and audits `category.created` / `category.renamed`.
  4. Businesses reference a category by identity, so a rename shows everywhere [Proposed]. Business edit histories are not rewritten; the category audit records the rename.
- **Category removal behaviour — its own question (no DEC ID), drafted alternatives, none selected.** It is **not** C-01 (C-01 is deletion vs archiving of business records and operational history); C-01 may influence it, because ART-01 §2.1 warns that full access should not silently become permanent deletion of history.
  - **Alt CR-1 (drafted) — Deactivate:** not offered when creating a business or changing a business's category; existing businesses keep it, shown "inactive"; filters/reports still group by it; can be reactivated. Audited `category.deactivated` / `category.reactivated`.
  - **Alt CR-2 (drafted) — Delete only if unused:** blocked while any business uses it ("in use — reassign or deactivate"). Audited `category.deleted`.
- **Effect on existing businesses using a deactivated category [Proposed]:** no change, no history entry; editing other fields does not force a category change; changing the category requires a selectable one (BIZ2A-d).
- **Alternate paths:** CAT-a duplicate name matches an inactive category → offer reactivation (Alt CR-1) [Proposed]; CAT-b suggestion path (Alt CA-C): saved, Owner notified (channel unresolved), approved → create path, declined → reason recorded.
- **Errors and recovery:** permission denied; missing name; duplicate name; delete blocked while in use (Alt CR-2); concurrent creation of the same name → one category [Proposed; Phase 3]; save failed → no change, retry.
- **Authorization:** Owner [Confirmed]; Data Entry per DEC-015; Call Center/Developer: none [Proposed; Board `27:446` marks all non-owner editing Unresolved under DEC-015].
- **Visibility/assignment:** Reference data, visible to every role that can see a business [Proposed]. No 15-day rule.
- **Data changes:** Category records (name, active flag under Alt CR-1, created/updated by/at).
- **Audit events (proposed):** `category.created`, `category.renamed`, `category.deactivated`, `category.reactivated`, `category.deleted`, `category.suggested`, `category.suggestion_declined`.
- **Notification events:** category suggestion to Owner (Alt CA-C only; channel unresolved).
- **Postconditions:** No two categories share a normalized name; no business loses a category it had.
- **Decision dependencies:** DEC-015; category removal (no DEC ID; may be influenced by C-01); R-11.
- **Diagram:** WF-BIZ-003 (23 nodes).

---

## 6. WF-ACCESS-001 — Business access in every surface

WF-ACCESS-001 applies the evaluation (SM-VISIBILITY-001, §7) to **every resource type and surface**. Together they are the **single access definition** (contract C5). Batches 3–4 supply **facts** (who is responsible, assigned, attending, holding); the **rules** that turn those facts into access are defined here only.

- **ID / Name:** WF-ACCESS-001 — Business access: search, lists, detail, direct URLs, edit history, related records, calendars, deal records, projects/tasks, notifications, exports, duplicate previews, calling actions (B7).
- **Purpose:** Every place that shows or acts on business data shows only what the requesting user may see now, consistently, server-side, beyond list screens [Confirmed: ART-01 §8; C2].
- **REQ range:** REQ-SEC-VIS-001..006, REQ-BIZ-001..009, REQ-PROJ-001..008, REQ-REPORT-001..006, REQ-AUTH-001..009, REQ-CALL-001..011 (range only).
- **UC:** UC-BIZ-008; UC-PROJ-001 (visibility); UC-BIZ-003 (hidden-match evaluation).
- **Actors:** Any signed-in user; System (evaluation on every request; background senders).
- **Trigger:** Any request that reads or acts on a business or a record carrying business data.
- **Preconditions:** None beyond the request; the evaluation checks account and authentication. No attendance gating (A1).

### 6.1 Table RT — Resource types (R-06)

Every resource type below is evaluated per requesting user, per resource (C2). "Inherits" = the item is visible only if the user passes the Access check on its linked business (full or context-limited, with the context named); the DEC-002 row named is the only exception route after the 15-day window. "Relation facts" are inputs supplied by the owning batch; the rule using them is defined here.

| Resource type | Linked business via | Visibility basis | Relation facts (supplied by) | Rule (defined here) | When denied | Surfaces |
|---|---|---|---|---|---|---|
| Business | itself | SM-VISIBILITY-001 steps 1–10 | creator (Batch 2, WF-BIZ-001), current assignee (WF-CALL-001), deal/project facts (Batch 4) | VT-1..VT-6 | Omitted from lists/search and not counted; "Permission denied" / "Record hidden by policy" on direct open | List, search, detail, direct URL |
| Edit history entry | its business | Inherits | — | Visible with the business; only fields the outcome allows (SB-2 §11) [Proposed field limit] | Not shown | Business detail |
| Call attempt | its business | Inherits; DEC-002 row 5 (callback) or row 1 (accepted opportunity) may extend | attempting agent, time (Batch 3) | Visible to users who pass the check on the business; the attempting agent's **own** attempts on a business now hidden appear in personal history as a redacted row [Proposed, OI-07] | Others: omitted, not counted | Business call history, calling workspace, own activity |
| Follow-up | its business | Inherits; **DEC-002 row 5** | responsible user, scheduled time, state (Batch 3) | Visible with business access; under row 5 Alt B the responsible agent keeps context-limited access until callback + 48 h | Responsible user: redacted entry (commitment not lost, OI-07); others: omitted | Dashboard, calling queue, calendar, owner overviews |
| Contact reservation | its business | Inherits (no exception row) | holder, lease (Batch 3) | Acquire/renew/release require the actor to pass the check (B7). Others who can access the business see "reserved by another agent" with the holder name | Acquire/renew denied; others without access see nothing | Calling workspace |
| Deal record (incl. stage "Accepted opportunity" and closed deal) | its business | Inherits; **DEC-002 row 1** (accepted opportunity), **row 2** (closed deal); Developer pre-closure **DEC-005** | stage, assigned Call Center agent, assigned Developer (Batches 3–4, E5) | Before closure: actors with business access; Developer only under DEC-005 Alt 1 if assigned (read-only contact and notes, Board `26:424`); Alt 2 none (**R-12 interaction with DEC-006 → USER**). After closure: Developers company-wide, context-limited, subject to DEC-001 and row 2 [Confirmed: ART-01 §2.4 "eligible closed deals"] | Omitted from lists **and not counted**; "Permission denied"/"Record hidden by policy" on direct open | Hand-off view, deal detail, closed-deal list (UC-PROJ-001) |
| Meeting | deal record → business | Inherits from the deal record (row 1 before closure) | attendees (Batch 4) | Attendance alone does **not** grant access; the attendee must pass the deal-record check [Proposed; affects Batch 4 OQ-02 under DEC-005 Alt 2] | Attendee: redacted calendar entry (time kept); others: omitted | Calendar, deal record, meeting reminders |
| Project | closed deal → business | Inherits; **DEC-002 row 3** (active), **row 4** (completed) | status, assigned Developer (Batch 4) | Developers and Owner [Confirmed: Board `27:461`], subject to DEC-001 and rows 3–4; "Assigned to me" derived | Omitted from board lists and not counted | Delivery board, project detail |
| Task | project | Inherits from the project | task owner (Batch 4) | Visible with the project | Task owner: redacted row; others: omitted | Project board, own work list |
| Data-correction request | its business | Inherits; **DEC-002 row 6** | requester, reviewer (WF-BIZ-002) | Reviewers per row 6; requester sees own request status | Requester: status with business redacted (OI-09); reviewers under row 6 Alt A: Owner only (OI-08) | Correction queue, requester's list |
| Notification / reminder | the resource it references | Evaluated **at send time** on the referenced resource (C6) | recipient, referenced resource (WF-NOTIFY-001) | Message carries only data the recipient may see at send time | No business data; suppress vs redact decided in WF-NOTIFY-001; a suppressed reminder is visible to the Owner (D6) | Email, in-app list |
| Export row | the resource it represents | **Per-row Access check** as that resource type [Proposed, matches Batch 4 WF-REPORT-001] | requester, filters (Batch 4) | Exports are Owner only [Confirmed]; for the Owner every row passes (C1), but rows are still evaluated so a future role extension cannot bypass the check | Row excluded and not counted | XLS, CSV, PDF |
| Duplicate preview | the matched business | **Special:** matching ignores visibility (C3); the Access check decides only what is shown | — | Readable match → preview within permissions; unreadable → existence only ("already exists") + DEC-003 scope; Owner full | Existence only | Create/edit forms |

Rules common to all rows [Proposed]: (1) list and count only after evaluation; (2) a denied item is never shown with business data; (3) redaction is used only for items the user **owns** (own follow-up, attempt, meeting attendance, task, request), never for list rows the user merely browses; (4) context-limited items appear only in their context surface, never in general business search.

### 6.2 Part 1 — Search, lists, detail, direct URLs, edit history (UC-BIZ-008)
- **Lists and search:** System runs the query (role-appropriate filters; final set per ART-01 §15), evaluates every candidate **before** counting, sorting and paging [Proposed]. General business search returns **full-access** rows only; context-limited items appear only in their context surfaces (correction queue, closed-deal list, calendar) [Proposed]. No accessible rows → empty state with no hint of hidden matches.
- **Detail / direct URL:** not found (or permanently deleted, C-01) → "Not found". Else evaluate read: Denied-permission → "Permission denied"; Denied-hidden → "Record hidden by policy" (ART-01 §18 state; no field values) [Proposed message split, OI-10]; Context-limited → only the context's fields; Full / Owner → full detail with each related item re-evaluated (Table RT).
- **Direct URL under a context-limited outcome** [Proposed; OI-27]: the request renders only the granting context's view (e.g. the closed-deal entry for a Developer under DEC-002 row 2, the queue item for Data Entry under row 6). Outside that context the business detail is denied ("Permission denied"); no general business detail page is reachable through an exception.
- **Next actions from detail:**
  - **Edit:** full access + role Data Entry/Owner → WF-BIZ-002 Part A; context-limited → edit only as row 6 Alt B apply (VT-5); otherwise no edit control.
  - **Flag incorrect data:** Call Center, Developer, Owner with full or context-limited access → WF-BIZ-002 Part B.
  - **Edit history:** any user who passes the check (SB-2 §11), showing only fields that the outcome allows [Proposed field limit]. The **audit trail** is Owner-only [Confirmed] (WF-REPORT-002).
- Denied direct-URL / hidden-record requests are logged [Proposed: `business_access.denied`, not counted].

### 6.3 Part 2 — Related records and Developer deal/project lists
- Related item (call attempt, follow-up, reservation, meeting, task, correction request): System resolves the linked business (through the deal record or project where applicable) and runs the Access check including the DEC-002 row named in Table RT.
  - Allowed (full or context-limited) → shown with the allowed fields.
  - Denied → if the user **owns** the item → redacted entry ("Business hidden by policy") [Proposed, OI-07]; otherwise → omitted and not counted.
- Developer deal-record / project lists (UC-PROJ-001): deal record not closed → DEC-005: **Alt 1** and assigned to U → evaluated (context-limited, read-only); **Alt 1 not assigned, or Alt 2** → denied, row omitted and not counted (R-12 → USER). Closed → company-wide, eligibility per DEC-001 and DEC-002 rows 2–4 → evaluated; **denied rows are omitted and not counted** (no redacted list rows).

### 6.4 Part 3 — Calling actions (B7), notifications, exports, duplicate previews
- **Calling actions (contract B7, R-02, Proposed):** every calling action (open in calling workspace, acquire/renew reservation, log call attempt, finalize outcome — WF-CALL-002/003; schedule/complete follow-up — WF-FOLLOW-001) runs the Access check, **including for the assignee**. If the assignee is denied, the agent's action is refused with "Record hidden by policy" and no business data, and the business is classified **"assigned but inaccessible" (derived)** and shown to the Owner for a decision. **No automatic reassignment.** Any reassignment the Owner chooses goes through WF-CALL-001 (B8).
- **Notifications and reminders:** send-time re-check (C6); denied → no business data; suppression vs redaction decided in WF-NOTIFY-001; suppressed/failed reminders visible to the Owner (D6).
- **Exports:** Owner only [Confirmed]; per-row evaluation; denied rows excluded and not counted; export audited (WF-REPORT-001).
- **Duplicate previews:** readable match → preview; unreadable → existence only + DEC-003; Owner full.
- **Dashboards/reports:** Owner only [Confirmed]; rows still pass the check (Batch 4).

### 6.5 Workflow fields
- **Main path:** request → SM-VISIBILITY-001 per resource (Table RT) → render outcome (full / context-limited / Owner / existence-only / denied) → log denials where proposed.
- **Alternate paths:** context-limited outcomes (VT-5); Owner access (C1, R-01); owned-item redaction; send-time denial; assigned-but-inaccessible (B7).
- **Errors and recovery:** "Not found", "Permission denied", "Record hidden by policy", "Session expired" (re-authenticate). Access lost while a page is open: the next request is denied; unsaved edits are not saved.
- **Authorization:** SM-VISIBILITY-001 VT-2, VT-3.
- **Visibility/assignment:** this workflow is the visibility definition.
- **Data changes:** none (read surfaces), except denial log entries and the derived B7 classification.
- **Audit events (proposed):** `business_access.denied`; `business_access.owner_viewed_hidden` (only if Owner reads are audited, OI-05).
- **Notification events:** none of its own. The B7 Owner-decision item is presented to the Owner; its channel is the notification decision (no DEC ID).
- **Postconditions:** No surface returned business data, existence or counts that the evaluation did not allow (except the Confirmed duplicate "already exists").
- **Decision dependencies:** DEC-001, DEC-002 (rows 1–6), DEC-003, DEC-005 (+ R-12 → USER), R-11 (→ USER), C-01; Data Entry base scope (no DEC ID).
- **Diagrams:** WF-ACCESS-001 Part 1 (21 nodes), Part 2 (12 nodes), Part 3 (20 nodes).

---

## 7. SM-VISIBILITY-001 — Access evaluation model (per user, per resource)

**An evaluation model, not a lifecycle.** No stored global "visible" flag [Confirmed, C2]. The result is computed for (user U, action X, resource R, now) on every request. Drawn as a flowchart because there are no stored states.

### 7.1 What is NOT a state

| Item | What it is instead |
|---|---|
| "Hidden" / "Visible" | Derived result for one user, one resource, one time |
| "Within 15-day window" | Derived from the timer basis (DEC-001) and now |
| "Exception active" | Derived from current facts per DEC-002 rows |
| "Assigned but inaccessible" (B7) | Derived: current assignee fails the Access check |
| "Needs correction" | Derived: ≥1 open data-correction request |
| "Not eligible for calling" | Derived (B1, B2) |
| Owner access | A rule (C1, R-01), not a record attribute |
| Timer basis timestamp | An input (creation; latest reset touchpoint under Alt B), not a state |

### 7.2 Table VT-1 — Evaluation order (contract C, R-01)

The first failing step decides the outcome. Timer basis, role/assignment scope and exceptions stay separate steps.

| Step | Check | On failure | Status |
|---|---|---|---|
| 1 | U's account active | Deny; session revoked | [Confirmed] (ART-01 §3) |
| 2 | Session authenticated | Deny; re-authenticate | [Confirmed] |
| 2b | U is Owner with 2FA **still pending** | Administrative access denied [Confirmed]. Everything else is **R-11 → USER**: Reading R11-a denies all business access until 2FA; Reading R11-b blocks only administrative actions, and the scope a pending-2FA Owner would have without the C1 bypass is undefined. Both shown, neither selected | [Confirmed] admin part; rest [Unresolved: R-11] |
| 3 | Identify U's role | — | — |
| 4 | Action X permitted for the role on R's type (VT-3). Applies to the Owner too, so policy-restricted actions (e.g. business deletion, C-01) stay restricted | Deny "Permission denied"; Call Center/Developer edit attempts are offered a correction request | [Confirmed] role rules; finer action list [Proposed] |
| — | **Owner: skip steps 5–8**, go to step 9 | — | R-01 [Proposed ruling] |
| 5 | R inside the role's base scope (VT-2) | Deny "Permission denied" | Mixed |
| 6 | Required relation holds (assignment, creator, assigned developer) | Deny "Permission denied" | Mixed |
| 7 | 15-day window: now within 15 days of the timer basis (DEC-001) → full for X, go to step 9 | Go to step 8 | [Policy-dependent: DEC-001] |
| 8 | An active-work exception (DEC-002 rows 1–6) grants U access now → context-limited for the row's actions (VT-5), go to step 9 | Deny "Record hidden by policy" (Hidden for U, derived) | [Policy-dependent: DEC-002] |
| 9 | Current resource state allows X (deleted/archived per C-01; Rejected business readable but excluded from calling (B1, and still do-not-call for the Owner per R-01); terminal correction request not editable) | Deny or read-only | Mixed |
| 10 | Outcome: Full (window), Context-limited (exception), Owner access (audited, C1) | — | [Confirmed] C1; audit detail OI-05 |

Duplicate matching never calls this evaluation (DR-2); it is called only to decide what a warning shows (DR-9).

### 7.3 Table VT-2 — Base scope (step 5) and relation (step 6)

| Role | Base scope | Required relation | Status |
|---|---|---|---|
| Owner | Everything | None (steps 5–8 skipped) | [Confirmed] C1; R-01 |
| Data Entry | Business directory for create/edit/correction work | **Unresolved (no DEC ID):** Alt DE-1 (drafted) any business, then only the 15-day rule limits; Alt DE-2 (drafted) own-created plus correction-queue items | [Unresolved] (ART-01 §2.2 "approved visibility scope" undefined; ART-11 D9 Tier 4) |
| Call Center | Businesses; their deal records before closure (row 1) | Currently assigned to U. **B7:** every calling action is evaluated, the assignee included; failure → "assigned but inaccessible" (derived) for the Owner, no automatic reassignment | Assigned [Confirmed] (ART-01 §2.3); "currently" [Proposed]; B7 [Proposed, R-02] |
| Developer | Closed-deal list, projects, tasks; deal records before closure only per DEC-005 | Closed deals: none (company-wide) [Confirmed: ART-01 §2.4]; accepted opportunity: assigned Developer under DEC-005 Alt 1 (read-only contact and notes), none under Alt 2 (**R-12 → USER**: conflicts with Developers recording signature/payment before closure, DEC-006) | Mixed |

### 7.4 Table VT-3 — Action permission by role (step 4)

Rows for Batch 3–4 actions are listed here so step 4 can evaluate them (C5). Behaviour of those actions stays in their batches.

| Action | Owner | Data Entry | Call Center | Developer | Status / source |
|---|---|---|---|---|---|
| Read business (in scope) | Yes | Yes | Yes (contact info, socials) | Context-limited (relevant phones, notes) | [Confirmed] ART-01 §2 |
| Create business | Yes | Yes | No | No | [Confirmed] |
| Edit master data | Yes | Yes | No | No | [Confirmed] |
| Submit data-correction request | Yes | Not needed | Yes | Yes | [Confirmed]; Data Entry [Proposed] |
| Review / resolve correction | Yes | Yes | No | No | [Confirmed] |
| Manage categories | Yes | DEC-015 | No | No | Owner [Confirmed]; Data Entry [Unresolved: DEC-015]; CC/Dev No [Proposed] (Board `27:446` non-owner Unresolved) |
| View edit history | Yes | If passes check | If passes check | If passes check | SB-2 §11 term [Proposed] |
| View audit trail | Yes | No | No | No | [Confirmed] |
| Export | Yes | No | No | No | [Confirmed] |
| Delete / archive business | C-01 | No | No | No | Data Entry No [Confirmed]; Owner [Unresolved: C-01] |
| Assign business to a Call Center agent | Yes (via WF-CALL-001, B8) | No | No | No | [Confirmed] ART-01 §2.1; automatic allocation DEC-021 [Proposed] |
| Log call attempt / finalize calling outcome | Yes | No | Yes (assigned; B7) | No | [Confirmed] Board `27:455`; B7 [Proposed] |
| Acquire / renew / release contact reservation | Yes | No | Yes (assigned) | No | [Proposed: DEC-004] Board `27:452` |
| Override contact reservation | Yes | No | No | No | [Proposed] Board `27:452` |
| Schedule / reschedule / complete / cancel follow-up | Yes | No | Yes (assigned) | No | Call Center [Confirmed] ART-01 §2.3, §10; Owner [Confirmed-derived] ART-01 §2.1 |
| Reopen Rejected business | DEC-016 | No | DEC-016 | No | [Unresolved: DEC-016] |
| Assign Developer to deal record | Yes | No | Yes | No | [Confirmed] E2 |
| Schedule / reschedule meeting | Yes | No | Yes | DEC-005 Alt 1 (assigned) | Batch 4 [Proposed]; DEC-005 |
| Update commercial stage | Yes | No | Unresolved (Batch 4 OQ-03) | Yes, within transition rules | Developer [Confirmed] ART-01 §2.4; Data Entry No [Confirmed]; transitions (no DEC ID) |
| Record signature / payment / closure | Yes | No | Unresolved (Batch 4 OQ-03) | Yes | [Confirmed] Board `27:458` (REQ-PROJ-004); sign-off DEC-006; R-12 → USER |
| View company-wide closed-deal list | Yes | No | No [Proposed] | Yes (eligible) | [Confirmed] ART-01 §2.4 |
| View / update project and tasks | Yes | No | No | Yes | [Confirmed] Board `27:461` |

### 7.5 Table VT-4 — Timer basis (step 7; DEC-001, unselected; Board `24:414`)

| | Alt A — creation-based | Alt B — inactivity-based |
|---|---|---|
| Origin | Business creation | Business creation, then the latest reset touchpoint [Proposed interpretation; OI-17a] |
| Reset events | None | `call_attempt.logged`, `follow_up.scheduled` (R-07, Proposed alignment with Batch 3) |
| Never resets | — | Master-data edits, notes, status tweaks (Board `24:414`) |
| Board 01 risk note | Deals taking > 15 days disappear unless extended | Needs audit guards against artificial resets |
| Basis computed per | Business | Business (touchpoints by any user) |

Evaluation stays per user (Owner exempt; exceptions per user). "Day 16" boundary undefined (OI-04). ART-11 D9's per-user basis is Tier 4 and not drawn (OI-25).

### 7.6 Table VT-5 — Active-work exceptions (step 8; DEC-002, every row unresolved; Board `25:430`)

"Who" marked *implied* is not written on Board 01. The **actions** column defines what a context-limited outcome allows; it is [Proposed] and tied to the same DEC-002 row (unselected).

| Row | Fact that must hold now | Alt A | Alt B | Who (Alt B) | Surface (Alt B) | Actions allowed under the context-limited outcome [Proposed] | Ends |
|---|---|---|---|---|---|---|---|
| 1 | Deal record in stage Accepted opportunity | Hidden day 16 unless extended | Exempt | Assigned Developer and Call Center (Developer also DEC-005) | Hand-off / deal record | Call Center: calling actions, hand-off updates, Developer assignment, meetings, flag correction. Developer (DEC-005 Alt 1): read-only contact and notes, meetings, flag correction. No master-data edit | Stage leaves Accepted opportunity (Batch 4) [Unresolved] |
| 2 | Business has a closed deal | Hidden day 16 unless extended | Exempt | Developers company-wide and Owner | Closed-deal list only (Board: "not permanent business visibility") | Read relevant phones and notes; commercial/closure updates per Batch 4 and DEC-006; flag correction. No directory search, no master edit | Not stated on Board 01 [Unresolved] |
| 3 | Active project | Hidden day 16 unless extended | Exempt | Developers (*implied*; Board: "visible on Kanban board") | Project board | Project status, schedule and task actions per Batch 4; flag correction | Project completion |
| 4 | Completed project | Hidden day 16 | Hidden 15 days after delivery | Developers (*implied*) | Project board | Read-only project history; flag correction [Proposed] | 15 days after delivery |
| 5 | Scheduled callback follow-up | Hidden day 16 | Exempt | Responsible agent (*implied*) | Calling workspace, calendar | Open the business in the calling workspace, log call attempt, complete/reschedule/cancel the follow-up, flag correction | Callback date-time + 48 h |
| 6 | Open data-correction request | Hidden day 16 | Exempt in queue | Data Entry | Correction queue | Read the business; apply the request through WF-BIZ-002 Part A (the **only** context-limited master-data edit); close or reject the request | Request terminal |

"Unless extended" (rows 1–3 Alt A) has no mechanism and no DEC ID (OI-06).

### 7.7 Table VT-6 — Outcomes

| Outcome | Returned when | What surfaces may show / do |
|---|---|---|
| Full | Steps 1–7 pass, step 9 allows | All fields and actions the role permits |
| Context-limited | Step 8 grants via a row | Fields and actions per VT-5 row, only in that row's surface |
| Owner access | Owner; steps 1–4 and 9 pass | Everything; audited (C1, R-01) |
| Existence-only | Duplicate warnings for an unreadable match | "Already exists" + DEC-003 scope |
| Denied — permission | Steps 4–6 fail | "Permission denied"; no data; omitted and not counted in lists |
| Denied — hidden by policy | Steps 7–8 fail | "Record hidden by policy"; no data; omitted and not counted |
| Denied — session/account | Steps 1–2b fail | Re-authenticate / revoked / R-11 pending |
| Read-only / not allowed in state | Step 9 restricts X | Earlier outcome's data; action refused |

### 7.8 Table VT-7 — Worked evaluations (intended behaviour, not tested)

| U | R and facts | Under DEC-001 Alt A | Under DEC-001 Alt B |
|---|---|---|---|
| Call Center, assigned | Created day 0, assigned day 3, now day 10 | Full | Full |
| Call Center, assigned | Created day 0, `call_attempt.logged` day 12, now day 20, no follow-up | Step 8: nothing applies → Hidden; B7: "assigned but inaccessible" to Owner | Full (reset day 12; window to day 27) |
| Call Center, assigned | `follow_up.scheduled` on day 18 for day 22; now day 20 | Row 5: Alt A Hidden (+ B7 item) / Alt B context-limited until day 22 + 48 h | Full (reset day 18) |
| Call Center, assigned | Created day 0, assigned day 14, no contact, now day 16 | Hidden → B7 "assigned but inaccessible"; no automatic reassignment | Hidden → same B7 item |
| Call Center, **not** assigned | Any | Denied — permission (step 6) | Same |
| Developer, not assigned | Closed deal, active project, created day 0, now day 40 | Rows 2/3: Alt A Hidden (row omitted, not counted) / Alt B context-limited | Same rows after window expiry |
| Developer, assigned | Deal record in Accepted opportunity, now day 5 | DEC-005 Alt 1: **context-limited, read-only** contact and notes / Alt 2: Denied — permission (R-12 → USER) | Same |
| Data Entry | Created by U day 0, now day 20, open correction request | Row 6: Alt A Hidden / Alt B context-limited in queue (apply allowed) | Depends on touchpoints, then row 6 |
| Data Entry | Created by another user, now day 3 | Alt DE-1: Full / Alt DE-2: Denied unless in correction queue | Same |
| Owner, 2FA complete | Any business, any age | Owner access (audited) | Same |
| Owner, 2FA pending | Any business | R11-a: Denied / R11-b: undefined (→ USER) | Same |
| Any role | Business permanently deleted (C-01) | Not found | Same |

---

## 8. SM-DATAFIX-001 — Data-correction request lifecycle

**States** (all [Proposed]; ART-01 §14 "detailed request states ... remain proposed"):
- **Submitted** — waiting for a reviewer.
- **In review** — taken by one reviewer (concurrency guard; justification for the extra state).
- **Resolved** — terminal; changes applied via WF-BIZ-002 Part A.
- **Closed – no change needed** — terminal; already correct/fixed, or business unavailable (C-01). Separate from Rejected so a valid request is not counted as wrong (G1 spirit).
- **Rejected (request)** — terminal; request incorrect; reason recorded. Not the calling outcome Rejected.
- **Withdrawn** — terminal; requester cancelled.

**Not states:** "Open" (derived = Submitted or In review); "aging/overdue" (derived; no service time defined); "needs correction" (derived on the business); "duplicate request" (a warning). Considered, not proposed: "Awaiting requester information".

**Events:** submit, start review, release, reviewer deactivated, apply succeeded, apply blocked (duplicate incl. concurrent, invalid, conflict, failure), close no change, reject, withdraw, business unavailable (C-01).

### 8.1 Transition table

| Current state | Event | Actor | Guard / permission | Next state | Side effects | Audit event (proposed) | Failure behavior | Decision dependency |
|---|---|---|---|---|---|---|---|---|
| (start) | Submit | Call Center, Developer, Owner | Access check passes (full or context-limited); issue type + explanation present | Submitted | "Needs correction" (derived); notify reviewers | data_correction_request.submitted | Not created; form kept | Notification timing (no DEC ID) |
| Submitted | Start review | Data Entry or Owner | Reviewer passes Access check; not taken by another | In review | Assigned to reviewer | data_correction_request.review_started | Stays Submitted; "already in review" | DEC-002 row 6 |
| In review | Release | Assigned reviewer, or Owner | — | Submitted | Assignment cleared | data_correction_request.released | Stays In review | — |
| In review | Reviewer account deactivated | System | Reviewer deactivated (WF-EMP-001) | Submitted | Assignment cleared | data_correction_request.released | — | — |
| In review | Apply succeeded | Assigned reviewer | Part A: edit allowed (full, or row 6 Alt B context), valid, no duplicate (self-excluded, atomic re-check DR-8), version current; same save | Resolved | Business updated; edit history; flag recalculated; requester informed | data_correction_request.resolved + business.updated | Nothing saved; stays In review | DEC-013, DEC-002 row 6 |
| In review | Apply blocked (duplicate incl. concurrent, invalid, conflict, failure) | Assigned reviewer | — | In review | Reason shown; no merge | business.duplicate_blocked (if duplicate) | Stays In review | DEC-013, DEC-003 |
| In review | Close – no change needed | Assigned reviewer | Note recorded | Closed – no change needed | Flag recalculated; requester informed | data_correction_request.closed_no_change | Stays In review | — |
| In review | Reject | Assigned reviewer | Reason recorded | Rejected (request) | Flag recalculated; requester informed | data_correction_request.rejected | Stays In review | — |
| Submitted | Withdraw | Requester | Own request | Withdrawn | Flag recalculated | data_correction_request.withdrawn | Stays Submitted | — |
| In review | Withdraw | Requester | Own request; reviewer informed | Withdrawn | Flag recalculated | data_correction_request.withdrawn | Stays In review | — |
| Submitted or In review | Business unavailable | System or Owner | Only if C-01 adopts business archiving/deletion | Closed – no change needed | Reason "business unavailable" | data_correction_request.closed_no_change | — | C-01 |

Terminal states never reopen [Proposed]; submit a new request instead. Requester deactivation does not change the request [Proposed].

---

## 9. Acceptance scenarios (Given / When / Then)

**Intended behaviour, not tested.** There is no software.

**WF-BIZ-001 — creation**
1. Given an active Data Entry user and a new business whose normalized phone and name match nothing, when they save with one social account and a selectable category, then exactly one business exists with created by/at, an edit-history start, `business.created`, unassigned + Pending.
2. Given a stored business hidden from the Data Entry user that shares a normalized phone, when they save, then the save is blocked, "already exists" is shown, no override exists, nothing is saved, and nothing beyond "already exists" is shown while DEC-003 is unselected.
3. Given the Owner enters a business whose phone matches a stored one, then the Owner is also blocked, sees the full match (C1), and nothing is merged.
4. Given two Data Entry users save the same new business at the same moment, then exactly one record exists and the other user sees a duplicate block.
5. Given no social account, then the save is refused.
6. Given an unknown follower count marked Unknown, then it is stored and shown as Unknown, never 0 (DEC-014 mechanism pending).
7. Given "Has website" checked and no URL, then the save is refused (VR-11, Proposed).

**WF-BIZ-002 Part A — edit**
1. Given an edit that keeps a phone already on the same business, then no self-duplicate is reported.
2. Given two users edit the same business, when the second saves, then a save conflict is shown and nothing is overwritten.
3. Given a phone changed to one stored on another (possibly hidden) business, then the save is blocked without bypass.
4. Given two users at the same moment change phones on **two different businesses** to the same new number, then exactly one save succeeds and the other gets a duplicate block (DR-8).
5. Given a successful edit, then history shows editor, time, previous and new values per field, and the timer basis is unchanged.
6. Given a Call Center user opens a business detail, then no edit control appears and "Flag incorrect data" is offered.

**WF-BIZ-002 Part B / SM-DATAFIX-001 — corrections**
1. Given a Call Center agent with access to an assigned business, when they flag an incorrect phone with an explanation, then a Submitted request exists, the business shows "needs correction", and reviewers are notified (timing unresolved).
2. Given a request In review whose suggested phone belongs to another business, when applied, then the save is blocked, the request stays In review, and no merge happens.
3. Given a reviewer rejects a request, then a reason is mandatory, the state is Rejected (request), and the requester is informed.
4. Given two reviewers start review on the same request, then only one succeeds.
5. Given DEC-002 row 6 Alt A and a business hidden from Data Entry, then Data Entry cannot open the business data and the Owner can resolve the request.

**WF-BIZ-003 — categories**
1. Given "salon " exists (active or inactive), when the Owner creates "Salon", then it is blocked as a duplicate (reactivation offered if inactive).
2. Given Alt CR-1 (drafted) and a deactivated category used by 12 businesses, then they still show it (inactive) and it is not offered for new businesses.
3. Given Alt CA-A (drafted) and a Data Entry user, then category management is denied.
4. Given Alt CR-2 (drafted) and a category in use, then deletion is blocked.

**WF-ACCESS-001 / SM-VISIBILITY-001 — access**
1. Given a Call Center agent searches a phone belonging only to a business not assigned to them, then the result is empty with no hint.
2. Given an assigned business past the window with no exception, when its agent opens the direct URL, then "Record hidden by policy" is shown with no field values.
3. Given the Owner (2FA complete) opens any business of any age, then access is granted and audited per C1.
4. Given an Owner session with 2FA pending, then administrative access is denied; access to non-administrative business actions follows the R-11 reading the user selects (R11-a deny / R11-b undefined) — **not decided**.
5. Given a deactivated user's open session, when it requests any business, then it is denied (step 1).
6. Given a reminder due for a business now hidden from its agent, when sent, then it carries no business data (suppress vs redact per WF-NOTIFY-001; suppression visible to the Owner, D6).
7. Given a Developer not assigned to a closed deal that is hidden for them, when they open the closed-deal list, then the deal is omitted and not counted.
8. Given a Data Entry user editing when the window expires, when they save, then the save is denied and nothing changes.
9. Given DEC-001 Alt A, a business assigned on day 14 with no exception, when its agent tries to log a call on day 16, then the action is denied, the Owner sees "assigned but inaccessible", and the assignment is unchanged (B7).
10. Given DEC-001 Alt B, a business created day 0 with `call_attempt.logged` on day 12, when its assigned agent opens it on day 20, then access is full; a notes edit on day 13 would not have reset the window.
11. Given an Owner export of 100 businesses with filters, then every row passes the per-row check (all pass for the Owner, C1) and the export is audited.

---

## 10. Audit events and countable metrics (contract G2)

Names are **Proposed** until approved.

| Event (proposed name) | Entity | Actor | Counted in report? | Source workflow |
|---|---|---|---|---|
| business.created | Business | Data Entry, Owner | Yes — "businesses added in period" (ART-01 §15); Data Entry target candidate (DEC-020) | WF-BIZ-001 |
| business.duplicate_blocked | Business (attempted create or edit; no business saved; references the matched business) | Data Entry, Owner | Yes, as attempts only — never as businesses [Proposed] | WF-BIZ-001, WF-BIZ-002 |
| business.similar_name_confirmed | Business | Data Entry, Owner | No | WF-BIZ-001/002 (Alt NM-C/SN-1 only) |
| business.hidden_match_revealed | Business (matched) | System, to Data Entry (the Owner always sees full matches) | No | WF-BIZ-001 (only if DEC-003 reveals detail) |
| business.escalation_requested | Business (matched) | Data Entry | No | WF-BIZ-001 (only if DEC-003 adopts escalation) |
| business.updated | Business | Data Entry, Owner | Yes — "records updated" (DEC-020 candidate) | WF-BIZ-002 Part A |
| business.save_conflicted | Business | Data Entry, Owner | No (operational) | WF-BIZ-002 Part A |
| data_correction_request.submitted | Data-correction request | Call Center, Developer, Owner | Yes — requests; **"businesses needing corrections" = distinct businesses with ≥1 open request** | WF-BIZ-002 Part B |
| data_correction_request.review_started | Data-correction request | Data Entry, Owner | No | WF-BIZ-002 Part B |
| data_correction_request.released | Data-correction request | Reviewer, Owner, System | No | WF-BIZ-002 Part B |
| data_correction_request.resolved | Data-correction request | Data Entry, Owner | Yes (DEC-020 candidate) | WF-BIZ-002 Part B |
| data_correction_request.closed_no_change | Data-correction request | Data Entry, Owner, System | Yes — separate from rejected | WF-BIZ-002 Part B |
| data_correction_request.rejected | Data-correction request | Data Entry, Owner | Yes | WF-BIZ-002 Part B |
| data_correction_request.withdrawn | Data-correction request | Requester | No | WF-BIZ-002 Part B |
| category.created / category.renamed | Category | Owner (Data Entry per DEC-015) | No | WF-BIZ-003 |
| category.deactivated / category.reactivated | Category | Owner | No | WF-BIZ-003 (Alt CR-1) |
| category.deleted | Category | Owner | No | WF-BIZ-003 (Alt CR-2) |
| category.suggested / category.suggestion_declined | Category suggestion | Data Entry / Owner | No | WF-BIZ-003 (Alt CA-C) |
| business_access.denied | Business | Any non-owner | No | WF-ACCESS-001 (direct URL / hidden attempts; not list filtering) |
| business_access.owner_viewed_hidden | Business | Owner | No | WF-ACCESS-001 (only if OI-05 says Owner reads are audited) |

"Assigned but inaccessible" (B7) is a derived classification, not an event; Owner decisions on it are audited by WF-CALL-001 (Batch 3).

G1 checks: businesses created ≠ records updated ≠ blocked attempts; requests ≠ distinct businesses needing correction; Rejected (request) ≠ Closed – no change needed; Rejected (request) ≠ calling outcome Rejected.

---

## 11. Cross-batch contract dependencies (SB-2)

| Contract / ruling | How Batch 2 uses it |
|---|---|
| A1 | No Batch 2 action is gated on attendance; stated in every precondition |
| B1 | Rejected businesses stay readable (step 9) but excluded from calling; still do-not-call for the Owner (R-01) |
| B2 | Phone mandatory unresolved (VR-5); "not eligible for calling" derived; re-derived on edits |
| B4 | Archived/deleted ineligible: C-01 drives step 9 and DR-2 |
| B5 | Open correction request does not block assignment/contact; "needs correction" flag |
| **B7 (R-02)** | Every calling action runs the Access check, assignee included; failure → "assigned but inaccessible" (derived) for the Owner; no automatic reassignment (§6.4, VT-2, VT-7, scenario 9) |
| B8 (R-03) | New businesses hand off to WF-CALL-001; Owner reassignment after a B7 item goes through WF-CALL-001 |
| C1–C6 | SM-VISIBILITY-001 implements C1 (with R-01), C2, C3, C4 branches, C5 (single definition incl. Table RT and VT-3 actions); C6 send-time check |
| D6 (R-09) | Suppressed reminders visible to the Owner (Table RT notification row) |
| E2, E5 (R-05) | Deal record from Accepted; Developer assignment by Call Center/Owner (VT-3) |
| R-06 | Table RT lists all 11 resource types plus data-correction request and edit history entry |
| R-07 | Alt B reset events `call_attempt.logged`, `follow_up.scheduled` (VT-4) |
| R-08 | Correction-request notifications dispatched by WF-NOTIFY-001 without a state model |
| R-11 → USER | Owner 2FA-pending readings shown (VT-1 step 2b, WF-BIZ-001, scenario 4) |
| R-12 → USER | DEC-005 Alt 2 interaction with DEC-006 noted wherever Alt 2 appears |
| G1–G3 | §10 table; edit history and audit append-only |

---

## 12. Decision dependency matrix

| Decision | WF-BIZ-001 | WF-BIZ-002 A | WF-BIZ-002 B | WF-BIZ-003 | WF-ACCESS-001 | SM-VISIBILITY-001 | SM-DATAFIX-001 |
|---|---|---|---|---|---|---|---|
| DEC-001 timer basis | origin | not reset | — | — | ✓ | step 7, VT-4 | — |
| DEC-002 exceptions | — | row 6 apply | row 6 | — | Table RT | step 8, VT-5 | row 6 guard |
| DEC-003 hidden revelation | ✓ | ✓ | apply block | — | Part 3 | VT-6 existence-only | apply block |
| DEC-005 developer pre-closure (+ R-12) | — | — | — | — | Part 2, Table RT | VT-2, VT-3 | — |
| DEC-013 name matching | ✓ | ✓ | apply | — | — | — | apply guard |
| DEC-014 unknown metrics | ✓ | ✓ | — | — | — | — | — |
| DEC-015 category authority | missing category | — | wrong category | ✓ | — | VT-3 | — |
| DEC-016 reopen rejected | — | — | — | — | — | VT-3 | — |
| DEC-023 follower granularity | ✓ | ✓ | — | — | — | — | — |
| DEC-024 (possibly related, scope undefined) | VR-8 note | VR-8 note | — | — | — | — | — |
| C-01 business deletion vs archiving | DR-2 scope | — | no longer operating | may influence removal | deleted state | step 9, VT-3 | business unavailable |
| Category removal (no DEC ID) | — | inactive category | — | ✓ | — | — | — |
| B2 phone mandatory (no DEC ID) | ✓ | ✓ | — | — | — | — | — |
| Data Entry base scope (no DEC ID) | — | ✓ | ✓ | — | ✓ | VT-2 | — |
| R-11 Owner 2FA pending (→ USER) | ✓ | ✓ | — | ✓ | ✓ | step 2b | — |
| Notification timing (no DEC ID) | — | — | ✓ | Alt CA-C | B7 item, send-time | — | ✓ |

---

## 13. Diagram index

| Diagram | Name | Type | Nodes |
|---|---|---|---|
| WF-BIZ-001 Part 1 | Creation: authorization and field validation | flowchart LR | 19 |
| WF-BIZ-001 Part 2 | Creation: duplicate check, block display, save | flowchart LR | 24 |
| WF-BIZ-002 Part A | Edit, revalidation, concurrency, save conflict | flowchart LR | 20 |
| WF-BIZ-002 Part B | Data-correction request submit and review | flowchart LR | 22 |
| WF-BIZ-003 | Category management | flowchart LR | 23 |
| WF-ACCESS-001 Part 1 | Search, lists, detail, direct URL, edit history | flowchart LR | 21 |
| WF-ACCESS-001 Part 2 | Related records and Developer deal/project lists | flowchart LR | 12 |
| WF-ACCESS-001 Part 3 | Calling actions (B7), notifications, exports, duplicate previews | flowchart LR | 20 |
| SM-VISIBILITY-001 Part 1 | Evaluation steps 1–6 incl. R-11 readings | flowchart LR (decision flow) | 18 |
| SM-VISIBILITY-001 Part 2 | Evaluation steps 7–10 | flowchart LR (decision flow) | 21 |
| SM-DATAFIX-001 | Data-correction request lifecycle | stateDiagram-v2 | 6 states |

Tables to draw beside the diagrams in T2c: Table RT, VT-2, VT-3, VT-5, VT-7 and §8.1. Planned placement: WF-BIZ-* in section 04 (`30:1421`); WF-ACCESS-001 and the sub-area "Batch 2 state & decision models" in section 05 (`30:1424`).
