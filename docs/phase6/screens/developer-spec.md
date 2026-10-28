# Phase 6 — Developer screens (page 44 `96:6`): build notes

Developer Screen Agent, 2026-10-21. Covers SCR-DEV-001..008. Interactions are in `docs/phase6/interaction-spec.md`, in the Developer section, which includes P7.

## Scripts

Scripts live in `docs/phase6/scripts/developer/`. Run them in this order:

| # | Script | Chars | Section created | Depends on |
|---|---|---|---|---|
| 1 | `C01-dev001-deals.js` | 36,076 | SCR-DEV-001 — Deals | — |
| 2 | `C02-dev002-deal-detail.js` | 36,691 | SCR-DEV-002 — Deal record detail | — |
| 3 | `C02b-dev002-deal-actions.js` | 26,429 | (adds 3 dialog frames to SCR-DEV-002) | C02 (clones the Accepted frame) |
| 4 | `C03-dev003-meetings.js` | 34,841 | SCR-DEV-003 — Meetings & calendar | — |
| 5 | `C04-dev004-meeting-drawer.js` | 31,668 | SCR-DEV-004 — Meeting schedule / record (drawer) | C03 (clones the week frame and the mobile agenda) |
| 6 | `C05-dev005-projects.js` | 29,183 | SCR-DEV-005 — Projects | — |
| 7 | `C06-dev006-project-board.js` | 42,870 | SCR-DEV-006 — Project board | — |
| 8 | `C06b-dev006-board-dialogs.js` | 28,633 | (adds 3 dialog frames to SCR-DEV-006) | C06 (clones the Light board) |
| 9 | `C07-dev007-task-drawer.js` | 29,476 | SCR-DEV-007 — Task detail (drawer) | C06 (clones the Light board) |
| 10 | `C08-dev008-closure-dialog.js` | 27,620 | SCR-DEV-008 — Finalize closure & provision project (dialog) | C02 (clones the detail frames) |

All ten scripts pass `node --check` (wrapped in an async function) and an `AsyncFunction` parse, and each is under 45k characters.

**b-scripts.** C02b and C06b do not create a section. They find the existing section by name, remove only their own frames and their `Annotations · C0nb` row, and append their frames to the right of the last frame (y = 200). Re-running C02 or C06 deletes the b-frames, so always re-run the b-script after its parent script.

**Placement.** Run the scripts in order so the sections stack in inventory order. A section is placed only when it is first created:
- x = 0.
- y = the bottom of the lowest existing section + 400 (or 0 on an empty page).

**Re-runs.** On a re-run the script finds the section by name, keeps its ID and position, and rebuilds its children. It never moves the section. `endSection` warns if the section has grown into the 400 px gap above the next section; the orchestrator re-flows.

**Edited in place.** Each script is the shared helper block plus its screen code. Since the D13c pass the files in `scripts/developer/` are the source of truth; the old scratchpad sources are stale and must not be rebuilt over them.

## Phase 6 lessons applied (brief §2)

- **No instance-child transforms.** The scripts change only properties, text, visibility and slots. For example:
  - The kanban column "Spacer" is hidden, not resized.
  - Calendar/Week events get new Kind, Time and Title values, and the unused one is hidden.
  - Only top-level instances placed in the script's own frames are resized.
- **Tables** are composed from `Table/HeaderCell` + `Table/Cell` instances in local auto-layout rows. `Table/Row` has fixed business columns, so it is not used. No detaching.
- **Text.** Every visible text is set explicitly: properties plus named layers (State, Notice/Access, Card/Metric Delta).
- **Slots.** Cards, the Drawer (Content and Footer) and the Dialog (Content) are filled only through their native slots.
- **Fields** (`Field · …` instances: Input, Select, Input/Date, Search, Textarea) are set to FILL. Every frame then runs `relayout()`, which toggles FIXED→FILL to avoid stale layout inside slots.
- **Fit checks.** `OUT.fit[frame]` returns, for each frame:
  - frame size;
  - content used / height / free, or `belowFold` for mobile scroll frames;
  - overflow list: children wider than their auto-layout parent, or taller than a fixed, clipped parent;
  - drawer and dialog size, and the drawer body's free height;
  - rail activity items shown, and the kanban column heights / hidden cards;
  - on mobile, tap targets under 44 px, plus the header Back size.

  Every overflow also goes to `OUT.warnings`.
- **Mobile actions** are Large (48 px) buttons, List/Item rows or task cards. A Back button under 44 px is reported as a Component request against `Shell/Mobile/Header`. Field controls are 40 px inside fields of about 64 px or more; this is reported, not changed.
- **Themes.** Dark frames are clones of the Light primary with Semantic mode Dark (`40:2`). Every other frame is explicitly Light (`40:1`).

## Frames per screen

### SCR-DEV-001 Deals — desktop only (7 frames)

Signed-in user: Lina Aoun.

Frames:
- Light (primary)
- Dark
- Accepted opportunities (DEC-005 Alt 1, not selected)
- Owner view: needs attention
- Empty
- Loading
- Load error

Content and rules:
- **RW-01:** the "Closed deals" tab lists only closed deals (5 rows). There are no pre-closure or unassigned rows. Rows the user cannot access are omitted and not counted.
- **"Accepted opportunities" tab:** lists only rows assigned to the user. It is labelled DEC-005 "tab only if Alt 1".
- **Owner view:**
  - "Developer not yet assigned" (Olive & Thyme Café) is shown as a derived chip.
  - "Closure verification requested" carries a DEC-006 Alt B chip.
  - A note says where the Owner finds review items (Proposed, RW-04).
- **Derived chips:** Assigned to me; Project provisioning pending (+F2); Delivery overdue.
- **Policy chips:** DEC-002, DEC-017, DEC-005, R-12 and DEC-006.

### SCR-DEV-002 Deal record detail — desktop only (8 frames)

Frames:
- Light (Cedar Home Realty, Signed and paid · awaiting closure)
- Dark
- Accepted opportunity (Peak Fitness Gym, DEC-005 Alt 1)
- Verification rejected (Alt B)
- Owner view: closure verification review (RW-04)
- Owner view: remove recorded fact (RW-04; destructive dialog, reason required)
- Hidden by policy
- Save conflict (reloaded record: payment removed → stage Signed, closure actions disabled, "Record payment…" offered; M-2)
- C02b: Record signature (date + agreement reference), Record payment (date + payment reference), Mark not proceeding (reason; destructive) — all on the Accepted (Peak) background, DEC-005 Alt 1 labelled (M-9)

Content:
- **Request correction (M-1):** link in the Business context head (not on Owner view). It targets the shared data-correction drawer SCR-SHR-009 (page 42, not built yet — DE-2). SCR-SHR-005/A07 on page 40 is the attendance-correction drawer, so it is a layout reference only, not the target. No edit controls.
- **Rail meetings (M-5):** local rows (title wraps, date/time on its own full-width line, status badge below).
- **Four separate fact cards:** Accepted / Signature / Payment / Closure, under the caption "accepted ≠ signed ≠ paid ≠ closed".
- **Closure card:** shows both DEC-006 options, labelled "only one will exist", plus R-12.
- **DEC-018 chip:** "no attachment or amount required".
- **Rail:**
  - Context-limited business info (Notice/Access, DEC-005).
  - Meetings.
  - Handoff context: in the left column on the primary frame, and in the rail on the Accepted frame.

### SCR-DEV-003 Meetings & calendar — desktop P1, mobile P2 (5 frames)

Frames:
- Week Light (primary)
- Week Dark
- List with states
- Empty
- Mobile Light

Content:
- **Week:** the Calendar/Week events are relabelled as meetings:
  - Held (Done kind)
  - Awaiting outcome (Overdue kind)
  - Scheduled (Meeting kind)
  - The Task event is hidden.
- **List shows:**
  - Scheduled with the derived chips Upcoming / Awaiting outcome.
  - Held.
  - Missed (Proposed, R-13) with "Needs rearranging".
  - Cancelled with its reason.
  - "Rescheduled 1×" as an event with history.
  - The reminder-failed banner and flag.
- **Mobile (M-4):** an agenda grouped by need and by day, using local 56 px+ rows: title wraps, time on its own line, status badge plus derived chip (Awaiting outcome / Upcoming / Needs rearranging).
- **List** rows are in date order; the week legend shows "Outcome due" in the same red as the event.

### SCR-DEV-004 Meeting drawer — desktop P1, mobile P2 (7 frames)

Frames:
- Reschedule Light (primary; previous values kept)
- Reschedule Dark
- Validation error (past date/time, no attendee; error summary + field errors)
- Record outcome (Held + discovery notes, or Missed — Proposed)
- Cancel meeting (reason; destructive)
- Mobile Reschedule (adds "Request correction" 48 px Ghost button and "Cancel meeting…")
- Mobile Record outcome (sheet only)
- Mobile Outcome saved (clone of the DEV-003 mobile agenda + toast; the sheet has closed)

Desktop reschedule drawers carry a "Request correction" link row (M-1). Badges and policy chips placed directly in drawer/dialog bodies now HUG (`hugK()`, M-6).

The desktop backgrounds are clones of the DEV-003 week frame.

### SCR-DEV-005 Projects — desktop only (4 frames)

Frames:
- Light (primary)
- Dark
- Empty
- Loading

Content:
- **Metrics:**
  - Development workload — Proposed "2 · 2 · 6" (Deals · Projects · Tasks, SB-3 §11, RW-03).
  - Active projects.
  - Delivery overdue (derived).
  - Completed this month.
- **Table:** project status badges (Blocked, In progress, Waiting for client, Completed) are kept separate from task progress ("3 of 6 done").
- **Banner:** "closed deal without a project" (Nova Dental Clinic, provisioning pending, F2).

### SCR-DEV-006 Project board — desktop P1, mobile P1 (7 frames)

Frames:
- Light (the approved S5 board)
- Dark
- Completed (read-only, Urban Cuts: start 28 Sep, 4 tasks = 3 Done + 1 Cancelled; M-8)
- Save conflict (stale view: "Out of date · reload" chip, status moves disabled; M-2)
- Hidden by policy
- Mobile Light (tab "Projects", "Open deal DL-0031" and "Request correction" 48 px buttons)
- C06b: Record delivered: open-task warning (P7, moved from C06), Waiting for client (note required), Blocked (reason required) (M-9)

The Deal context rail has a "Business details wrong? Request correction" row (M-1).

Content:
- **Project status bar:** shows the allowed next statuses (non-linear) and DEC-019. The kanban columns are task statuses.
- **Content upload task:** carries "Client dependency" (never "Waiting for client").
- **Kanban:** overflowing cards collapse into "+n more".
- **Rail:** activity items are dropped rather than cut.

### SCR-DEV-007 Task detail drawer — desktop P1, mobile P1 (7 frames)

Frames:
- Light (the approved S5-B content)
- Dark
- Validation error (Cancelled without a reason; due before start)
- Save conflict
- Success (board + toast "Project status unchanged"; card due date updated)
- Mobile Light (Harbor Auto Care "SMS template setup", derived "Overdue 6 days", project Blocked)
- Mobile Save conflict ("Review changes" is a 48 px button, M-7; owner and due show Lina's latest values)

The desktop backgrounds are clones of the DEV-006 Light board.

### SCR-DEV-008 Finalize closure dialog — desktop only (6 frames)

Frames:
- Confirm (DEC-006 Alt A, not selected) Light
- Confirm Dark
- Request verification (Alt B)
- Not allowed (missing signature and payment; R-12 role reading)
- Closed, provisioning failed (F3; closure kept; Owner retries on SCR-OWN-012)
- Success (F2 Automatic "pending (queued)" next to Manual "Create project board"; primary "Open project board (pending)" disabled)

**Total: 57 frames:**
- 49 desktop, including 8 Dark primaries;
- 8 mobile, all Light, matching the inventory's Mob column.

DEV-005 table: Urban Cuts reads "3 of 3 done" + "1 cancelled" (matches the board); rows are sorted by target date; the Active projects caption is "Company-wide eligible" on every frame. DEV-001 Empty shows "Closed deals 0"; Loading and Load error hide the count (M-3).

## Fictional data

**People**
- Lina Aoun: DEV-001..004 and DEV-008.
- Sami Fares: DEV-005..007.
- Rana Haddad: the Owner views.
- Maya Khoury and Omar Nassar: the Call Center handoff.

**Deals**
- DL-0024 Urban Cuts
- DL-0027 Harbor
- DL-0031 Glow
- DL-0033 Cedar
- DL-0034 Lumen
- DL-0035 Nova
- DL-0037 Sunrise
- DL-0039 Bloom
- DL-0040 Peak
- DL-0041 Olive & Thyme

**Other values**
- Phones use `+000 70 000 1xx`; websites use `example.com` subdomains.
- Today is Tue 20 Oct 2026.

## Open items / for the operator

- **Return values:** created IDs, fit results and warnings are returned at run time in `created`, `fit` and `warnings`. No IDs exist until the operator runs the scripts.
- **Expected warnings:** possibly a tab count badge layer not found; the header Back button under 44 px is reported as a Component request.
- **Calendar/Week Kind swap:** if swapping the Kind of a nested event changes its size, the fit check reports it.
- **Deferred (annotation only — orchestrator to record in `screen-register.md`):**
  - SCR-DEV-006 "Edit schedule" drawer (Phase 7 reuses the SCR-DEV-007 drawer pattern).
  - SCR-DEV-006 Owner "Assign developer" (assignment flow is SCR-CC-007).
  - SCR-DEV-004 "Schedule new" mode (DEC-005 Alt 1 only) and a desktop success frame (the mobile Outcome saved frame shows the pattern).
  - SCR-DEV-005 Scheduled / Delivered rows (shown via the DEC-019 chip and the board status bar; no extra fictional deals added).
- **Not fixable on page 44:** DEV-004 RadioCard description wraps at a fixed width inside the component (DS); DEV-006 Dark column fill (DS token); minor items 1, 12, 16 not attempted.
- **Review-44 fixes (scripted, not run — Figma quota):** M-1…M-9 and minors 2, 3, 5, 6, 7, 8, 11, 13, 14, 15, 17, 18 (Load error has no filter bar). Notice/Access: rail instances FILL; the Hidden-by-policy Page notices are FILL inside a 480 px wrapper (DS-13d).
- **Shared scratchpad:** another agent's `src/C02.js` collided with this agent's `src/c02.js` on the case-insensitive disk. This agent moved its sources to `scratchpad/devagent/`. The other agent's file was left untouched.
