# Phase 3 ↔ Phase 4 Reconciliation Review (RX)

| Field | Value |
|---|---|
| Reviewer | Reconciliation Reviewer. I authored none of the reviewed material. |
| Date | 2026-10-20 |
| Passes | One |
| Inputs | `brief.md` (P34-1 + §8 rulings AR-01..AR-10), `architecture-a.md` (rev A-2), `architecture-b.md` (P34-2 alignment), `screen-inventory.md` (P4-INV-1), `sitemap.md` (P4-NAV-1), `wireframes-w1/-w2/-w3.md`, `reviews/phase3-review.md`, `reviews/phase4-review.md`, `docs/phase2/shared-baseline.md` (SB-3). Spot checks in `phase2/batch3/batch3-spec.md` (SM-REMINDER-001, WF-NOTIFY-001) and `phase2/batch4/batch4-spec.md` (WF-REPORT-001 G1 table, B-1). |
| Not available | `wireframe-fixes.md` does not exist yet. The fixes for RW-01..RW-07 are therefore treated as **not applied**. |
| Status | Findings only. **This review approves nothing.** Phases 3 and 4 stay Proposed and go to the user. |

## 0. Evidence basis and limits

- **Documents only.** No Figma tool was called (a single Figma operator holds all Figma access). Frame content is known only where a W doc or the Phase 4 review (RW Tier A / A′) describes it. Everything else is judged from the inventory's purpose, actions and states, and the W docs' state lists. Each finding says which.
- The board and wireframe file may differ from the documents. On the architecture side, A-2 and the P34-2 alignment of B are newer than the board (A §14, B §14).
- Module names follow A's canonical catalogue (AR-01): MOD-identity, -employees, -access, -admin, -attendance, -work, -business, -duplicates, -corrections, -assignment, -reservation, -calls, -deals, -meetings, -projects, -notifications, -reports, -platform.

## 1. Verdict

**Not yet reconciled. There are 3 blocking mismatches, all on the wireframe side and all on access and visibility.** Each is already tracked in the Phase 4 review (RW-01, RW-05, RW-06), but no fix is recorded. There are also **19 non-blocking mismatches** (§3). Most of them are small architecture gaps where a screen action has no named module operation, or wireframe labels that do not match the architecture's Proposed decisions.

Overall the architecture and the wireframes are compatible:
- Every one of the 54 screens maps to at least one owning module, and nearly every displayed field maps to an entity in B's ERD (§4).
- Reservation conflicts, duplicate blocking, save conflicts, the DEC-026 / DEC-011 / R-11 alternatives, F3 and D5/D6 failure visibility all line up with B's sequences and A's job design.
- No architecture-side contradiction blocks the A + B merge.

## 2. Blocking mismatches

A mismatch is blocking when a screen shows data or a count that the access model (MOD-access `check` / `scopeFilter`, WF-ACCESS-001 Table RT, B §7) denies, or presents a pending access policy as decided. The user must not review these frames as they stand.

| ID | Screen / frame | Evidence | Architecture rule broken | Side that changes |
|---|---|---|---|---|
| RX-B1 | SCR-DEV-001 Deals, Desktop `17:1231` (RW Tier A) | RW-01: the Developer's "Closed deals — company-wide eligible" tab lists Signed / Paid / Signed-and-paid rows, an **unassigned** accepted opportunity, a Not-proceeding row with its reason, and another Developer's deal. | B §6 steps 5–8 and §7: `scopeFilter` is applied in SQL before count and paging, and pre-closure deal records are visible to a Developer only per DEC-005 (Alt 1: the assigned Developer only; Alt 2: none). E3 "developer not yet assigned" is Owner-visible. A §4.6 E-08 suppresses even the handoff notice when the Developer fails the deal check. No alternative lets a Developer list unassigned or other Developers' pre-closure deals. | **Wireframe** (RW-01 fix): the closed tab shows Closed deal rows only (DEC-002 closed-deal row). Add an "Accepted, assigned to me [DEC-005 Alt 1 — not selected]" tab that is absent under Alt 2. Move unassigned and "not yet assigned" rows to an Owner-view state. |
| RX-B2 | SCR-DE-006 Correction-request queue, Desktop `21:2140` (RW Tier A′) | RW-06: the redacted row for a hidden business shows the issue type ("No longer operating") and the requester. The "Open (7)" tab count may include the hidden row. | B §7: "Totals never include hidden rows"; related items the viewer does not own are "omitted and not counted"; redaction applies only to owned items. The access-facts view (AR-06) includes open correction requests only as a **DEC-002 row 6** exception slot, which has no value until the user decides. | **Wireframe** (RW-06 fix): show either a fully redacted row ("Business hidden by policy · Owner review only") labelled `[OI-08 / DEC-002 row 6 pending]`, or the row omitted and not counted, side by side. Tab counts must state that they exclude hidden rows. |
| RX-B3 | SCR-DE-003 Duplicate blocked, Hidden match `21:1854` (RW Tier A) | RW-05: the body copy "It is outside your access, so its details are not shown" confirms that the match is a hidden record. | B SEQ-08: the hidden-match payload is "existence-only (no id, no fields)". Anything beyond that is DEC-003 (pending). MOD-duplicates `preview` is shaped by MOD-access per DEC-003 (A §3.4). | **Wireframe** (RW-05 fix): neutral copy that reveals only what the Confirmed duplicate block already implies. Any "outside your access" wording becomes a labelled DEC-003 alternative. Also label the "Request escalation" action as existing only if DEC-003 adopts it. No escalation operation or entity exists in the architecture. |

None of these needs an architecture change. They clear once the Figma operator applies RW-01, RW-05 and RW-06 and the result is read back and screenshotted.

## 3. Non-blocking mismatches

**Side** = the document that should change. "Arch-A" / "Arch-B" = architecture docs; "INV" = screen inventory or sitemap (W0); "WF" = wireframe frames (Figma operator).

### 3.1 Data and operation backing (check 1)

| ID | Screen | Mismatch | Side |
|---|---|---|---|
| RX-01 | SCR-OWN-012 Delivery & exception monitor | **"Retry" and "Mark reviewed" have no backing.** <br>• SM-REMINDER-001 makes Failed and Suppressed **terminal** (Batch 3 line ~532), and A §4.2 defines only automatic retry. A manual retry of a failed reminder therefore cannot be a transition. It would have to create a new Reminder instance, which no operation defines. Only F3 provisioning has a defined manual Owner retry (A J-07). <br>• Neither Reminder nor NotificationDelivery has a "reviewed" field. <br>• A §4.3 also puts **dead BackgroundJobs** in this Owner list, but the inventory row lists only reminders, notifications and F3. <br>• No module operation is named for the list. It spans MOD-notifications, MOD-platform and MOD-projects. | Arch-A: name the list query (an API-edge composition, like `openItemsFor`). Either define "re-send = new Reminder instance (Proposed)" or state that reminders cannot be retried manually. Add an Owner-acknowledged flag to NotificationDelivery or drop "mark reviewed" (Arch-B adds the attribute if kept). INV: add "dead jobs" to OWN-012. WF: limit "Retry" to provisioning items until then. |
| RX-02 | SCR-SHR-007 Notifications (in-app list, mark read, unread count) | **The data and operations do not exist yet.** NotificationDelivery "could double as the in-app list if in-app presentation is adopted" (B ERD-5), but it has no read/unread attribute, and MOD-notifications exposes no list or mark-read operation. Reminders (email) are separate rows, and whether they appear in the list is undefined. In-app presentation is an open question (no DEC ID; WF-NOTIFY-001). | Arch-A/B: add a conditional "in-app inbox" (read flag, list and mark-read operations on MOD-notifications), tagged "only if in-app presentation is adopted". WF: the screen already carries the no-DEC-ID label; keep it on the badge count too. |
| RX-03 | SCR-SHR-001 My Day; SCR-CC-001 Calling queue | **Cross-module compositions are missing from A's adjacency table (§3.2.1).** <br>• My Day work items point to Task (MOD-projects) and meetings (MOD-meetings), but MOD-work depends only on MOD-assignment, MOD-employees and MOD-access. <br>• The CC-001 bucket "Data correction requested" needs MOD-corrections, which MOD-assignment does not depend on. | Arch-A: state that My Day and the calling queue are composed at the API edge from each owner's read operations (the same pattern as `openItemsFor`). Alternatively, add the edges; neither creates a cycle. |
| RX-04 | SCR-DE-001, SCR-SHR-010 (Owner "hidden for others" marker) | MOD-access offers `check(user, …)` and `scopeFilter(user, …)`. Neither answers "would this record be hidden for someone else", which is what the Owner marker shows. The meaning of the marker is undefined. Is it outside the 15-day window for every non-owner role, or for the assignee? | Arch-B: define a derived "visibility summary" on the access-facts view (for example "outside timer window, no active exception"), or INV/WF: redefine the marker in those terms. Also tag OI-05 (`business_access.owner_viewed_hidden` audit) on the Owner views. |
| RX-05 | SCR-OWN-011 Settings | <br>• **"Security settings" group:** no entity owns it. Owner 2FA is Confirmed and not a setting, and session lifetime, lockout and password policy are implementation decisions (A §2.3, checklist item 13). <br>• **"Test office check":** needs a read-only MOD-attendance operation (dry-run verification per ADR-016), which is not listed. <br>• **"Effective date of settings changes"** (W1 open question): A already proposes "apply to future sessions". | INV/WF: remove the security group or show only read-only facts. Cite A's Proposed effective-date rule instead of a new open question. Arch-A: list `attendance.testOfficeCheck` (read-only, audited per ADR-016). |
| RX-06 | SCR-CC-004 / SCR-DEV-003 "Reminder failed" shown to the follow-up or meeting owner | D6 requires visibility only to the Owner. Showing reminder state to the agent or Developer is allowed but needs a MOD-notifications read operation by source (`reminderStatusFor(sourceType, sourceId)`), which is not named. | Arch-A: name the operation, or WF: limit the banner to Owner views. Either is acceptable. |
| RX-07 | SCR-DEV-006 Assign developer (Owner); SCR-CC-005 "Overridden by Owner (notice to holder)" | <br>• `project.developer_assigned` has no outbox consumer in A §4.6.1. <br>• `contact_reservation.overridden` has no outbox event, so a "notice to holder" can only be the renew-failure message on the holder's next renew. It cannot be a notification. | WF/INV: describe the CC-005 notice as the renew-failure message. Arch-A: add E-18/E-19 only if the user wants those notifications (no DEC ID; recipients pending). |
| RX-08 | SCR-SHR-006 Change password | The self-service password change (UC-AUTH-007) has no named MOD-identity operation or sequence. Its session effect is unstated: Batch 4 L4 revokes on reset completion, but self-change is left open. W1 labels it an implementation decision, which is consistent. | Arch-A: list the operation and its audit event, and point to the implementation decision for revoking other sessions. |
| RX-09 | SCR-OWN-010 Audit log "export (audited)" | A §5 says audit export is **open (OQ-18)**. The inventory lists export as a key action without a tag. | INV/WF: tag `[OQ-18 pending: audit export]`. |

### 3.2 Authorization and visibility (check 2)

| ID | Screen | Mismatch | Side |
|---|---|---|---|
| RX-10 | SCR-SHR-007 Notifications | A §4.4 and B §7 re-check access **at send time** only (C6). An in-app list read days later could still render a stored business name after access expires. W3's "no longer accessible" entry shows no data, which is correct, but the architecture does not say how that is achieved. | Arch-B: if the in-app list is adopted, store ids only and render titles at read time through `check`. Alternatively, re-check every list item at read time and count only accessible items. WF: the badge count must not include hidden items (RW minor 4: badge "3" vs "Unread (2)"). |
| RX-11 | SCR-OWN-001 / SCR-DEV-005 Development workload | <br>• The workload tile misstates the SB-3 §11 definition, and does so differently on each screen (RW-03). <br>• DEV-005 is open to Developers, but neither document says whose workload a Developer may see (own only, or every Developer's). | WF: show three sub-counts with identical labels on both screens. Arch-B: add a VT row or a note on workload visibility for Developers (Proposed), or limit DEV-005 to "my workload". |
| RX-12 | SCR-SHR-008 (DEV context-limited), SCR-DEV-002 | B §6 step 10 returns "Context-limited", but neither document says which module shapes the field projection or where each context's field list is defined. The wireframes draw a specific field set. | Arch-B: state that the owning module projects fields based on the MOD-access outcome, with the field list per context Proposed (SB-3 §11 example). |
| RX-13 | SCR-DE-001 filters (correction status, social metrics); data-entry scope | <br>• Filtering the business list by correction status is a cross-module filter (MOD-corrections data in a MOD-business list) with no named mechanism. <br>• The **Data Entry base scope** (no DEC ID; B §11 item 15) drives the `scopeFilter` step 5 for this list, but DE-001 carries only DEC-001/002 labels. | Arch-A: name the read port or view used. WF: add a `[No DEC ID: Data Entry base scope]` tag to DE-001 and SHR-010. |

### 3.3 Concurrency and conflict (check 3)

| ID | Screen | Mismatch | Side |
|---|---|---|---|
| RX-14 | SCR-DE-003 as the home for edit-time and race-time duplicates | B SEQ-06/07 makes the unique index the atomic re-check: a concurrent create gets 409, as does an edit/edit or edit/create collision. Inventory DE-003 still lists only create. W2 ICR-2 (accepted by RW) is not applied. | INV: apply ICR-2, so that DE-003 covers DE-004, DE-005 apply and the DR-8 concurrent case. |
| RX-15 | Save-conflict coverage | ADR-018 puts a version on every mutable aggregate. Screens that edit versioned aggregates but list **no save-conflict state**: <br>• SCR-CC-007: assign developer (deal version) <br>• SCR-DEV-004: meeting reschedule <br>• SCR-OWN-006: targets <br>• SCR-DE-007: categories <br>Also, "access lost between load and save" (B SEQ-07, SEQ-10 renew) has no explicit state on edit screens. | INV: add a "save conflict → SHR-014" state, and map "access lost at save" to SHR-012 / SHR-011. |
| RX-16 | Idempotent retries (SCR-SHR-015 "save failed", SCR-CC-003 "save failed", SCR-SHR-002 check-in) | B §8 rule 5 and SEQ-04/11/13 promise that a retry with the same idempotency key returns the first result ("already checked in", one attempt row). No frame shows the "already saved" outcome of a retry, and SCR-OWN-008's override is not shown as its own command. AR-03 / A §3.2: the override is a separate command before the reassignment save, so a failed save leaves the reservation overridden. | WF (low fidelity, annotation only): add a note on SHR-015 "Retry reuses the same request key; a duplicate submit shows the saved result". On OWN-008, show override and confirm as two steps. Note on CC-005 that after a successful save whose release failed, others may still see "reserved" until the lease ends (AR-03). |

### 3.4 Background processing (check 4)

| ID | Screen | Mismatch | Side |
|---|---|---|---|
| RX-17 | SCR-OWN-009 Reports & exports, state "Generating (if async)" `25:13401`; inventory "sync vs async (Phase 3 ADR)", action "download" | ADR-010 (Proposed): exports are synchronous, streamed and never stored. There is no "ready later" list and no separate download step. "Generating" is acceptable only as an in-request progress state. | WF/INV: rename the state to "Preparing download (streamed, nothing stored; ADR-010 Proposed)". Merge "export" and "download" into one action. Replace the label "(Phase 3 ADR)" with "ADR-010 Proposed; revisit if the PDF cap is exceeded". |
| RX-18 | SCR-OWN-003 "Success (+ reset-email failure)" `24:877`; SCR-DEV-008 "Success (F2 Auto)" `25:12443` | Both side effects are **asynchronous** (outbox E-03; E-14 → MOD-projects). At save time the UI can know only "queued" or "provisioning pending", not the outcome. <br>• A failed reset email surfaces later (E-17 / OWN-012). <br>• Under F2 Auto, the closure success screen cannot show a created project synchronously. Content is known from the W doc state names only. | WF: OWN-003 shows "Reset link queued", and its failure appears in OWN-012. DEV-008 Auto shows "Closed · project provisioning pending (derived)" with a link that appears once provisioned (consistent with DEV-001's derived badge). |

Confirmed as matching: Owner visibility of reminder and notification failures (D6) appears in three places, all consistent with A §4.2 step 5 and E-17: OWN-012, OWN-004 "alert delivery failed", and the Owner's notifications list. J-04 "Not configured" matches OWN-004 / OWN-011 "schedule not configured". A's backup/drill alert "to operator and Owner" has no in-app channel, which is acceptable because the backup container is outside the app (Arch-A may state "email outside the app").

### 3.5 Reporting metrics (check 5)

| ID | Screen | Mismatch | Side |
|---|---|---|---|
| RX-19 | SCR-OWN-001 Dashboard, SCR-OWN-009 Reports | **No metric definitions in the architecture.** A says only "G1 distinctions in every widget and export" (MOD-reports). Neither document maps a dashboard tile to its definition and source. The missing definitions are: <br>• the **B-1 Accepted-opportunities snapshot**: deal records currently in stage Accepted opportunity, excluding Signed, Paid, Closed and Not proceeding (MOD-deals) <br>• the period metric `accepted_opportunity.created` vs `deal.closed` <br>• **Development workload** as three sub-counts: non-terminal deals with the assigned Developer (MOD-deals), active-status projects (MOD-projects), open tasks (MOD-projects) <br>• attempts vs distinct businesses <br>• not checked in vs absent (DEC-022) <br>• pending vs unassigned <br>• delivered vs completed. <br>"Compare periods" on OWN-001 needs J-08 snapshots for stock metrics (**OQ-17**, Proposed), which has no label. Whether OWN-001 shows the B-1 tile correctly could not be verified (Tier B). OWN-009 lacks DEC-007/008/022 tags (RW minor 3). | Arch-A: add a short MOD-reports metric catalogue, one row per tile with the definition, source module read operation and pending DEC, copying the WF-REPORT-001 G1 table and SB-3 §11. WF: tag "compare periods" `[OQ-17 pending]`. RW-03 covers the workload fix. Screenshot-check the B-1 tile in the RW-07 pass. |

### 3.6 Pending-policy labelling (check 6)

Where the two sides use different labels for the same pending item:

| Item | Architecture | Wireframes / inventory | Fix (side) |
|---|---|---|---|
| Retry policy | "No DEC ID" user decision (A §11; WF-NOTIFY-001) | "Retry policy (Phase 3)" on OWN-012 and W1 §4 | INV/WF: "(no DEC ID; user decision)" |
| Sync vs async export | ADR-010 Proposed | "Phase 3 ADR" / "if async" | INV/WF (RX-17) |
| DEC-004 | Pending (values undecided, B §11 item 5) | "DEC-004 (Proposed)" on OWN-008, CC-005 | INV: "DEC-004 pending (lease and idle values)". Owner override itself is Proposed. |
| Late-run reminder policy | B3-Q08 (no DEC ID) | "Reminder timing (no DEC ID)" | WF: add B3-Q08 on CC-004 and DEV-003 |
| Attendance alert thresholds and recipients | F-05 (no DEC ID); placeholder events E-12 | "Recipients and timing (no DEC ID)" on OWN-004 | INV/WF: cite F-05 |
| Audit export | OQ-18 | untagged | RX-09 |
| Period comparison | OQ-17 | untagged | RX-19 |
| Owner reads of hidden records audited | OI-05 | untagged on Owner hidden markers | RX-04 |
| Deactivated holder's reservation | B3-Q06 (expires at lease end) | untagged on OWN-003 deactivate impact | WF/INV: tag B3-Q06 |
| DEC-026 Alt C blocks next check-in? | Open (B §11 item 9) | F-01 tagged for corrections only | WF: tag on SHR-002 open-session block |
| Data Entry base scope | No DEC ID (B §11 item 15) | untagged | RX-13 |
| Settings effective date | A: "future sessions (Proposed)" | new open question (W1) | RX-05 |

Consistent on both sides (same IDs, both alternatives visible): DEC-001/002/003/005/006/007..012/013/014/016/017/018/019/020/021/022/023/026, C-01, F2, F3, R-10, R-11, R-12, R-13, D4, B2, B3-Q03, B3-Q05.

### 3.7 B §11 flags against A §4.6, and the settings-screen interpretation (check 7)

| B flag | Status in A §4.6 | Remaining action |
|---|---|---|
| (1) No consumer for `password_reset.requested` / credential-setup email | **Resolved:** E-01 and E-03 go to MOD-notifications as security-family NotificationDelivery (J-02), deduplicated by token or event id. | Arch-B: remove the flag from §11. |
| (2) Writer of `contact_reservation.expired` | **Resolved:** A §4.6.2 says it is written exactly once by whichever transaction flips Active → Expired (acquire or J-05). But **A §4.3's J-05 row still says "The sweep only records `contact_reservation.expired`"**, which contradicts §4.6.2. | Arch-A: reword the §4.3 J-05 row. Arch-B: remove the "Flag for A" in SEQ-10 and §11. |
| (3) `calling_assignment.*` as outbox events | **Resolved:** E-07 (`.assigned`, `.reassigned` → new-assignment notice). | None. `.unassigned` / `.retained` stay audit-only, which is fine. |
| Additional (found here) | B §11 and SEQ-13 list `accepted_opportunity.created` as an **outbox** event B relies on, but A §4.6.1 has no consumer for it (it is audit-only). B ERD-5 / S-7 say BackgroundJob.kind is "J-01 to J-11". A §4.6.2 says J-01/J-02 are not BackgroundJob kinds, J-10/J-11 are not app jobs, and J-12 exists. | Arch-B: drop `accepted_opportunity.created` from its outbox list, or A adds a consumer. Align the kind comment with A §4.6.2. |

**Agent A's settings interpretation** (A §3.2 "Admin vs attendance" and §12: the settings screen calls MOD-attendance's own API operation, with no MOD-admin → MOD-attendance code call):
- **Consistent** with ADR-002 (the screen is Next.js presentation, and Express endpoints belong to their owning module), with AR-02's ownership intent, and with the acyclic adjacency (MOD-attendance → MOD-admin for `audit.record`). A literal call would create a cycle unless audit moved to MOD-platform.
- **Recommended:** the orchestrator confirms it and rewords AR-02 to "MOD-admin hosts the settings navigation; the attendance group calls MOD-attendance".
- **Wireframe consequence:** OWN-011's groups should save separately. The attendance group is a new AttendanceSettingsVersion (MOD-attendance) and the company group belongs to MOD-admin. Each group gets its own version and its own save conflict. "Edit and save each settings group" already fits.
- The single placeholder audit name `settings.updated` is now emitted by two modules. That is acceptable, but G2 approval should note both producers.

## 4. Screen → module coverage (summary)

Every SCR maps to an owning module operation and entity, except where §3 says otherwise:

| Screens | Owning module(s) | Entities | Gaps |
|---|---|---|---|
| AUTH-001..004, SHR-013 | MOD-identity | Session, Credential, TwoFactorFactor, SecurityToken | — |
| SHR-006 | MOD-employees, MOD-identity | Employee (photo blob, A §2.1) | RX-08 |
| SHR-001 | MOD-work + API-edge composition | WorkItem, Target | RX-03 |
| SHR-002..005, OWN-004, OWN-005 | MOD-attendance (+ J-04, E-10..E-12) | AttendanceSession, AttendanceCorrection, AttendanceSettingsVersion | RX-18 n/a; DEC-026 tag |
| OWN-002, OWN-003 | MOD-employees (+ `openItemsFor`, E-02/E-03) | Employee | RX-18 |
| OWN-006 | MOD-work → MOD-assignment (B8) | Target, WorkItem | RX-15 |
| OWN-007, OWN-008, CC-001 | MOD-assignment (+ MOD-calls `transferFollowUps`, MOD-reservation read) | CallingAssignment | RX-03, RX-16 |
| OWN-001, OWN-009 | MOD-reports | ExportRecord; read operations | RX-17, RX-19 |
| OWN-010 | MOD-admin | AuditEvent | RX-09 |
| OWN-011 | MOD-attendance + MOD-admin | AttendanceSettingsVersion; company settings | RX-05 |
| OWN-012 | MOD-notifications, MOD-platform, MOD-projects | Reminder, NotificationDelivery, BackgroundJob | RX-01 |
| DE-001..004, DE-007, SHR-008, SHR-010 | MOD-business (+ MOD-duplicates, MOD-access) | Business, BusinessPhone, SocialAccount, Category, BusinessEditHistory | RX-B3, RX-04, RX-12, RX-13, RX-14 |
| DE-005, DE-006, SHR-009 | MOD-corrections (applies through MOD-business) | DataCorrectionRequest | RX-B2 |
| CC-002, CC-003, CC-005 | MOD-calls → MOD-reservation, MOD-deals (E5) | BusinessCallingState, CallAttempt, ContactReservation, Deal | RX-07, RX-16 |
| CC-004, CC-006 | MOD-calls (+ E-05 reminder planner) | FollowUp, FollowUpChange | RX-06 |
| CC-008 | MOD-calls | OutcomeReopening | — |
| CC-007, DEV-001, DEV-002, DEV-008 | MOD-deals (+ E-08, E-13, E-14) | Deal, DealDeveloperAssignment, ClosureReview | RX-B1, RX-18; RW-04 (no Owner frame for ClosureReview / E-13 or for removing a fact) |
| DEV-003, DEV-004 | MOD-meetings | Meeting, MeetingAttendee, MeetingChange | RX-06, RX-15 |
| DEV-005..007 | MOD-projects | Project, ProjectDeveloperAssignment, ProjectChange, Task | RX-07, RX-11 |
| SHR-007 | MOD-notifications | NotificationDelivery | RX-02, RX-10 |
| SHR-011, SHR-012, SHR-014, SHR-015 | MOD-access outcomes; ADR-018 | — | — |

## 5. Decisions that genuinely block further progress

Pending business policies (DEC-001..026, C-01, F2, R-10/11/12, D4, B3-Q05 and the rest) **do not** block Phase 3/4 progress. Both sides already carry them as labelled alternatives or configuration slots. They block only the build (A §10).

What genuinely blocks the next step (merging A + B, and handing Phase 4 to the user):

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| 1 | Apply **RW-01, RW-05, RW-06** in Figma and verify them (read-back + screenshot). This depends on the Figma quota / single operator. | Figma operator | Clearing RX-B1..B3; Phase 4 user review |
| 2 | **Confirm A's settings interpretation** and reword AR-02 (§3.7). | Orchestrator | Final A + B merge text for MOD-admin / MOD-attendance |
| 3 | **Accept or reject ICR-2** (DE-003 as the canonical home for edit-time and concurrent duplicates). | Orchestrator (W0 edits) | Inventory coverage of DR-8 conflict states (RX-14) |
| 4 | **OWN-012 manual retry semantics.** Either the retry creates a new reminder instance (Proposed architecture addition, no Phase 2 change) or there is no manual retry for reminders. Retrying a Failed instance would need a new SM-REMINDER-001 transition, which would reopen Phase 2 and is not allowed. | Orchestrator, then Arch-A | RX-01; the OWN-012 wireframe |
| 5 | Run the **RW-07 screenshot pass**, including OWN-001's B-1 tile, OWN-009's generating state, OWN-003's and DEV-008's success states, and CC-005. | Figma operator | Verifying RX-17..RX-19 and the access findings beyond Tier A |

These user decisions shape the design but can stay pending with labels: in-app notification presentation (RX-02, RX-10); notification retry, timing and recipients; Developer visibility of workload (RX-11); Data Entry base scope (RX-13); OQ-17; OQ-18.

## 6. Verification

- **Read:** every input listed in the header, in full. Phase 2 spot checks: SB-3 §10–§11 (R-08, R-09, Development workload), Batch 4 WF-REPORT-001 G1 table and B-1 row, Batch 3 SM-REMINDER-001 terminal states and WF-NOTIFY-001 in-app status.
- **Not read:** frame content beyond what the W docs and the Phase 4 review describe. No Figma call was made. `wireframe-fixes.md` does not exist.
- **Not verified:** whether any RW fix has landed; board content (T03, T07a/b, IC table, transaction matrix); every frame RW classed as Tier B.
- No software exists. Nothing was tested. This review approves nothing.
