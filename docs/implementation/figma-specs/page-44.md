# Page 44 — Developer (Figma specs)

File `GNrhb3DWa6mIhEX6F4Nmvw`. Light values. Shared shell/components: [page-40.md](page-40.md); Tabs, RadioCard, Timeline, Calendar: [page-42.md](page-42.md) / [page-43.md](page-43.md).

## Developer shell

| Part | Spec |
|---|---|
| Sidebar | MY WORK: My Day, My Attendance · DELIVERY: Deals, Meetings & Calendar, Projects · bottom: My Profile |
| TopBar | search "Search deals, projects, tasks…"; pill "Checked in · 08:47"; user "Lina Aoun" / "Developer", avatar "LA" |
| Content | p 24, gap 16 (H1 titles on this page) |

---

## SCR-DEV-001 — Deals

Frame: [D-L 171:11591](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=171-11591). State: Closed deals tab, 5 rows.

| Area | Spec |
|---|---|
| Nav | Deals active |
| Header (flex-col gap 4) | H1 "Deals"; 13/18 secondary "Closed deals from the whole company that you are eligible to see. Closed deal ≠ completed project — delivery runs on the project board." |
| Tabs row (gap 12) | Underline tabs: "Closed deals" (active) + Badge/Count **brand** (`status/brand/bg`, `status/brand/fg`) "5" · "Accepted opportunities"; chip "DEC-005 tab only if Alt 1" (Accepted-opportunities tab exists only under Alt 1 — flag it) |
| Filter bar (gap 8) | Search w 300 "Search deals or businesses" · Chip/Filter "Assigned to me", "Developer: Any", "Closed: last 30 days", "Project status: Any" · Caption muted right "Sorted by stage date, newest first" |
| Table (radius **8**) | Deal 300 · Stage 132 · Developer 156 · Closed on 112 · Project status 240 · For you (flex) · action 72 (Link "Open"); status cells min-h 56, py 8, wrap gap 6 |
| Rows | Nova Dental Clinic — Patient booking portal / "DL-0035 · Clinic" — Badge info "Closed deal" — Avatar 24 neutral LA "Lina Aoun" — 16 Oct 2026 — Derived Amber "Project provisioning pending" + chip "F2 pending" — Derived "Assigned to me" · Glow Beauty Salon — Booking website / "DL-0031 · Salon · Downtown branch" — SF "Sami Fares" — 13 Oct 2026 — Badge brand "In progress" · Lumen Yoga Studio — Class schedule site / "DL-0034 · Gym" — LA — 9 Oct 2026 — Badge warning "Waiting for client" — Assigned to me · Harbor Auto Care — Service reminders / "DL-0027 · Services" — SF — 2 Oct 2026 — Badge danger "Blocked" + Derived Amber "Delivery overdue" · Urban Cuts Barbershop — Online booking / "DL-0024 · Salon" — LA — 28 Sep 2026 — Badge success "Completed" — Assigned to me |
| Caption | "Closed deals only · no pre-closure or unassigned rows · rows you cannot access are omitted and not counted (WF-ACCESS-001)." |
| Policy row | "DEC-002 15-day visibility pending" · "DEC-017 one or many deals per business" · "Proposed stage names, no DEC ID" |

---

## SCR-DEV-002 — Deal record detail

Frame: [D-L 263:13122](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=263-13122). State: signed + paid, awaiting closure. Dialog variants (not extracted): [Record signature 264:12308](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=264-12308) · [Record payment 264:12685](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=264-12685) · [Mark not proceeding 264:13055](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=264-13055).

| Area | Spec |
|---|---|
| Header (gap 6) | Breadcrumb "Deals › Cedar Home Realty › Listings website"; title row (gap 12): H1 "Cedar Home Realty — Listings website" · Ghost M "Mark not proceeding…" · IconButton 40 "More actions"; meta row (gap 8): Badge **Large** warning "Signed and paid · awaiting closure" · Derived "Assigned to me" · Avatar 24 LA + "Lina Aoun · assigned developer" 13/18 secondary · "DL-0033 · Real estate" muted |
| Main split | gap 16: Left column flex-1 (gap 16) + Right rail **336** |
| Commercial facts (Card/Section) | "Commercial facts" / "Accepted ≠ signed ≠ paid ≠ closed — four separate recorded facts"; 4 equal Card/Inset (gap 12, inner gap 6): Overline label · Badge · date 14/20 Medium · source Caption muted. ACCEPTED Recorded 14 Sep 2026 "Omar Nassar · from call" · SIGNATURE Recorded 7 Oct 2026 "Agreement AGR-0133" · PAYMENT Recorded 15 Oct 2026 "Confirmation PAY-0151" · CLOSURE Badge neutral "Not recorded" / "Not closed yet" / "Needs all three facts". Row: chip "DEC-018 evidence · deposit · amounts" + Caption "No attachment or amount is required." |
| Closure (Card/Section) | "Closure" / "All three facts are recorded"; options gap 8: Primary M "Finalize closure…" · "or" muted · Secondary M "Request closure verification"; Inline policy "DEC-006 / R-12" — "Not decided: Finalize = Alt A (Developer closes, SCR-DEV-008) · Request verification = Alt B (Owner verifies). Only one will exist. R-12 → user decision." (**build behind flag; show neither as decided**) |
| Handoff (Card/Surface) | H4 "Handoff context"; 14/20 Medium "Website with property listings"; 13/18 secondary "Listings with search by area and price; an enquiry form on each listing."; Link "Previous call notes (2) · from Call Center" |
| Right rail (Card) | head "Business context" + Link "Request correction"; **Notice/Access Context-limited**: bg `status/neutral/bg`, border `status/neutral/border`, radius 6, px 12, py 10, gap 12; icon circle 20; title 14/20 Medium "Limited business context"; body 13/18 "Only what this deal needs."; chip DEC-005. KV Business "Cedar Home Realty"; Category "Real estate"; Phone "+000 70 000 103"; Website "cedar.example.com"; Divider; Meetings head + Link "Schedule"; items "Discovery call" / "22 Sep · 2 attendees" Badge success "Held"; "Scope review" / "1 Oct · 1 attendee" Held |

---

## SCR-DEV-003 — Meetings & calendar

Frame: [D-L 233:13090](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=233-13090). State: Week view 19–25 Oct 2026, today Tue 20.

| Area | Spec |
|---|---|
| Nav | Meetings & Calendar active |
| Header | title row (gap 12): H1 "Meetings & calendar" · chip "DEC-005 who may schedule" · Secondary M "Schedule meeting"; 13/18 secondary "Meetings on deals you can access. Rescheduling keeps the previous time in the meeting history." |
| Toolbar (gap 8) | Segmented "Week" (active)/"List" · IconButton 40 prev / next (chevrons) · Ghost M "Today" · range "19 – 25 Oct 2026" 14/20 Medium · Chip/Filter "My meetings" active · "Status: Any" |
| Calendar/Week | 1148 × 528, card radius 12; time gutter 55 (hour labels Caption muted 09:00–16:00); 7 day columns **156 w**; day header h 48: date pill px 8 py 2 radius full 12/16 Medium ("Tue 20" = **bg `brand/primary` text on-primary** + Caption "Today"); grid lines 1 px `border/subtle`; **60 px per hour** (09:00 at y 47) |
| Events (w 148, radius 4, py 6, flex-col gap 2, 3 px left accent; time row 12/16 Medium; title 12/16 primary) | Mon 09:30 "09:30 · Held" Lumen Yoga — **neutral** (bg `status/neutral/bg`, accent `status/neutral/solid`), h 44 · Mon 11:00 "11:00 Outcome due" Sunrise Bakery — **danger** bg/accent, h 44 · Tue 10:00–10:30 Bloom Florist — **info** (scheduled), h 44 · Wed 14:00–15:00 Peak Fitness — info, h 56 · Thu 14:30–15:00 Nova Dental — info, h 44 |
| Legend (gap 12) | Badge info "Scheduled" · success "Held" · danger "Outcome due = awaiting outcome (derived)" · Derived "Upcoming (derived)" · Caption muted "Cancelled and Missed meetings are listed in List view. Event kind is shown by icon and label, not colour only." |
| Policy row | "R-13 Missed is a proposed state" · "No DEC ID reminder timing" · "DEC-005 Alt 2: closed-deal meetings only" |

### SCR-DEV-003 — Mobile Light (agenda)

Frame: [M-L 233:13882](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=233-13882).

| Area | Spec |
|---|---|
| Developer mobile tab bar | My Day (clock) · Projects (board) · **Meetings** (calendar, active) · More (menu) |
| Header | "Meetings" / "Week 19–25 Oct" · Avatar LA |
| Content (p 16, gap 12) | Banner warning compact **no title**: "Reminder for Peak Fitness Gym kickoff was not sent. The meeting is still scheduled." |
| Agenda row | card bg default, border default, radius 8, min-h 56, px 12, py 10, gap 4: title 14/20 Medium; time 13/18 secondary; badges wrap gap 6 |
| Sections (Overline muted) | "NEEDS AN OUTCOME": "Sunrise Bakery — scope call" / "Mon 19 Oct, 11:00–11:30" / Badge info dot "Scheduled" + Derived Amber "Awaiting outcome" · "TODAY · TUE 20 OCT": "Bloom Florist — requirements" / "10:00–10:30" / Scheduled + Derived "Upcoming" · "TOMORROW · WED 21 OCT": "Peak Fitness Gym — Member app kickoff" / "14:00–15:00 · rescheduled 1×" / Scheduled + Upcoming · "EARLIER": "Lumen Yoga Studio — handover" / "Mon 19 Oct, 09:30 · notes added" / Badge success "Held"; "Cedar Home Realty — walkthrough" / "Thu 15 Oct, 12:00" / Badge warning "Missed" + Derived Amber "Needs rearranging" |
| Footer chip | "DEC-005 pre-closure meetings" |

---

## SCR-DEV-004 — Meeting schedule / record (drawer)

Frame: [D-L 304:13135](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=304-13135). State: reschedule mode over DEV-003 week view (scrim).

| Area | Spec |
|---|---|
| Drawer 480 header | "Reschedule meeting" / "Peak Fitness Gym — Member app · DL-0040" · Close 44 |
| Body (p 24, gap 16) | Banner Info compact (no title): "Previous time: Tue 20 Oct, 15:00–16:00 · Lina Aoun, Maya Khoury. It stays in the meeting history." · Input/Date "Date *" 21 Oct 2026 · Field pair (gap 16, 2 equal): Time "Start *" 14:00 / Time "End" 15:00 · Select (multi-person) "Attendees *" "Lina Aoun, Maya Khoury", helper "At least one attendee (Proposed)." · Textarea "Notes" "Kickoff: confirm member app scope, membership tiers and launch date." · Inline policy DEC-005 "Who may schedule: Call Center and Owner; you only if DEC-005 Alt 1 is adopted." · Correction entry (gap 8): 13/18 secondary "Business name, phone or address wrong? You cannot edit business details here." + Link S "Request correction" · Caption muted "Reminder timing has no DEC ID yet. A failed reminder never changes the meeting." |
| Footer (justify-between) | Ghost M "Cancel meeting…" (left) · right: Secondary "Close", Primary "Save new time" |

### SCR-DEV-004 — Mobile Light (reschedule)

Frame: [M-L 304:14544](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=304-14544). Record-outcome variant: [M-L 304:14663](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=304-14663) (not extracted). Full-screen page.

| Area | Spec |
|---|---|
| Header | Back 44 · "Reschedule meeting" / "Peak Fitness Gym · DL-0040" · Avatar LA |
| Content (p 16, gap 12, h 708) | Same fields as desktop; **Attendees = Select/Combobox** (leading search icon 16 + value + chevron); Notes textarea counter "68 / 500"; Correction entry (flex-col gap 4): Caption muted copy + Ghost L "Request correction" (flag icon 20, → SHR-009 M); Ghost L full-width "Cancel meeting…" |
| Sticky footer | top 764, h 80, px 16, py 12: Primary L full-width "Save new time" |

---

## SCR-DEV-005 — Projects

Frame: [D-L 235:13090](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=235-13090). State: 4 projects, 1 overdue, provisioning notice.

| Area | Spec |
|---|---|
| Nav | Projects active |
| Header | H1 "Projects" + chip "DEC-019 project statuses proposed"; 13/18 secondary "Delivery of closed deals. Project status is separate from task status; a closed deal is not a completed project." |
| Metrics (4 equal, gap 16) | **Card/Metric**: bg default, border default, radius 12, p 20, flex-col gap 8; label 13/18 secondary; value **Number Large 28/36 SemiBold**; delta row (gap 4) Caption; footnote Caption muted. 1) "Development workload — Proposed" "2 · 2 · 6", delta "SB-3 §11 definition", note "Deals · Projects · Tasks (yours)"; 2) "Active projects" 3; 3) "Delivery overdue (derived)" 1, delta "1 more than last week", note "Target date passed, not delivered"; 4) "Completed this month" 1 |
| Banner Info compact (no title) | "1 closed deal has no project yet: Nova Dental Clinic — Patient booking portal. Project provisioning pending (derived) · F2 pending: automatic at closure or manual." |
| Filter bar | Chip/Filter "Status: Any", "Developer: Any", "Assigned to me", "Delivery overdue" · Caption muted "Sorted by target delivery date" |
| Table (radius 8) | Project 296 · Project status 168 · Developer 148 · Target date 124 · Tasks 104 (right) · Conditions (flex) · action 108 (Link "Open board") |
| Rows | Urban Cuts Barbershop — Online booking / "PRJ-0012 · DL-0024" — success "Completed" — LA — 10 Oct 2026 — "3 of 3 done" — Caption "1 cancelled · read-only since 14 Oct" · Harbor Auto Care — Service reminders / "PRJ-0011 · DL-0027" — danger "Blocked" — SF — 16 Oct 2026 — "3 of 6 done" — Derived "Assigned to me" + Amber "Delivery overdue" + Caption "Blocker: SMS account" · Glow Beauty Salon — Booking website / "PRJ-0014 · DL-0031" — brand "In progress" — SF — 20 Nov 2026 — "1 of 4 done" — Assigned to me · Lumen Yoga Studio — Class schedule site / "PRJ-0016 · DL-0034" — warning "Waiting for client" — LA — 4 Dec 2026 — "0 of 3 done" — "Waiting for class timetable" |
| Policy row | "DEC-019 Scheduled · In progress · Waiting for client · Blocked · Delivered · Completed" · "SB-3 §11 workload definition" · "DEC-002 completed-project visibility" · Caption "Completed ≠ closed deal (G1). Cancelled projects are not modelled (OQ-11). Rows you cannot access are omitted and not counted." |

---

## SCR-DEV-006 — Project board

Frame: [D-L 228:13090](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=228-13090). State: Glow Beauty Salon project In progress, kanban.

New components:

| Component | Spec |
|---|---|
| Timeline/Milestone | flex-col gap 6, w 132, centred; marker 20 round: **Achieved** bg `brand/accent` + check 12 white; **Current** bg default + 3 px `brand/primary` border; **Upcoming** bg default + 2 px `border/strong`; **Final** bg default + 2 px `brand/primary` + flag 12; label 12/16 Medium primary (Upcoming = secondary); date Caption muted |
| Milestone track | h 92, w 756: track 4 px `surface/sunken` radius full (x 66→690, y 34); progress 4 px `brand/accent`; milestones at x 0/208/416/624 (top 26); **Today line** 2 × 42 `status/warning/solid` + tag (bg `status/warning/bg`, radius 4, px 6, py 2, 12/16 `status/warning/fg`) "Today · 20 Oct" |
| Kanban/Column | bg `surface/sunken`, radius 12, p 8, gap 8; header py 4 gap 8: name 14/20 SemiBold + Badge/Count |
| Card/Task | bg default, border default, radius 8, p 12, gap 8: title 14/20 Medium; desc Caption muted; extras row (gap 6, min h 22) chips; footer (gap 6): Avatar 24 + due Caption muted (+ optional Badge) |
| Status bar | card radius 8, px 16, py 12, gap 10 |
| Note (warning) | bg `status/warning/bg`, radius 6, py 10, left accent 3 px `status/warning/solid`, head 12/16 (author Medium + time muted), body 13/18 |

| Area | Spec |
|---|---|
| Header (gap 6) | Breadcrumb "Projects › Glow Beauty Salon (Downtown branch) › Booking website"; title row: H1 "Glow Beauty Salon — Booking website" · Secondary M "Edit schedule" · Primary M "Add task" · IconButton 40 more; meta (gap 8): Badge brand "Project · In progress" · Badge info "Deal · Closed deal" · Derived "Assigned to me" · Avatar SF "Sami Fares · assigned developer" · muted "PRJ-0014 · Salon · glowbeauty.example.com" |
| Split | Left column flex-1 (gap 8) + right rail **336** |
| Status bar | Row 1 (gap 12): Overline "PROJECT STATUS" · Badge Large brand "In progress" · 13/18 "since 15 Oct 2026 · by Sami Fares" · chip "DEC-019 Policy pending · statuses proposed". Row 2 (gap 8): 13/18 "Move project to:" · Secondary S "Waiting for client…" · Secondary S "Blocked…" · Ghost S "Back to Scheduled" · Secondary S "Record delivered" · Caption muted "Non-linear · Completed only from Delivered" |
| Schedule card | "Schedule & milestones" H3 / "Start 14 Oct 2026 → Target delivery 20 Nov 2026" + Derived "31 days to target"; milestone track: "Wireframes approved" / "17 Oct · achieved" (Achieved), "Content received" / "28 Oct · client" (Current), "Booking flow ready" / "3 Nov" (Upcoming), "Delivery (target)" / "20 Nov" (Final) |
| Tasks header | H3 "Tasks" + Badge/Count "4" + Caption "Columns are task statuses (proposed, no DEC ID). Moving a task never changes the project status." |
| Kanban (4 cols, gap 8) | **To do** (2): "Content upload" / "Logo, price list and 12 photos from the client" / Derived Amber "Client dependency" / SF "Due 28 Oct"; "Payment page" / "Scope held until the payment policy is decided" / chip "DEC-018 pending" / SF "Due 7 Nov" · **In progress** (1): "Booking flow" / "Service → time slot → confirmation" / SF "Due 3 Nov" · **Done** (1): "Wireframes approved" / "Milestone achieved" / SF "17 Oct" + Badge success "Done" · **Cancelled** (0): empty "No tasks" / "Cancelling needs a reason (Proposed)." (12/16) |
| Right rail | "Deal context" H4 + Link "Open deal DL-0031"; Caption "Closed ≠ Completed: delivery continues here."; KV Accepted "2 Oct · Maya Khoury"; Signed "9 Oct · AGR-0109"; Paid "12 Oct · PAY-0112"; Closed "13 Oct · Sami Fares"; Inline policy "DEC-006 / R-12" "Closure authority pending: Developer vs Owner verification not decided."; KV Project "Provisioned 13 Oct (Scheduled)"; "Business details wrong?" + Link "Request correction" · Divider · "Client dependencies & notes" + Link "Add note"; warning Note "Sami Fares · open" 20 Oct, 10:12 "Client content needed (logo, price list, 12 photos) for Content upload. Project stays In progress." · Divider · "Activity" + Link "View all"; Timeline "Dependency added" 20 Oct, 10:12 "Sami Fares · task Content upload" |

### SCR-DEV-006 — Mobile Light

Frame: [M-L 228:15207](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=228-15207). Tab bar Projects active.

| Area | Spec |
|---|---|
| Header | Back 44 · "Booking website" / "Glow Beauty Salon · PRJ-0014" · Avatar SF |
| Status card (Card/Surface, gap 10) | Overline "PROJECT STATUS" + Badge Large brand with dot 8 "In progress"; Caption muted "since 15 Oct · Sami Fares · target 20 Nov"; actions (gap 8): Secondary L flex-1 "Change status" + Primary L flex-1 "Add task" (plus); chip "DEC-019 statuses proposed"; Ghost L full-width "Open deal DL-0031"; Ghost L full-width "Request correction" (flag icon, → SHR-009 M) |
| Kanban as stacked list | Overline headers "TO DO · 2", "IN PROGRESS · 1", "DONE · 1", "CANCELLED · 0"; Card/Task full width: "Content upload" / "Logo, prices, 12 photos" / Derived Amber "Client dependency" / SF "Due 28 Oct" (due 12/16 **secondary**); "Payment page" / "Scope held for DEC-018" / chip DEC-018 pending / "Due 7 Nov"; "Booking flow" / "Service → slot → confirm" / "Due 3 Nov"; Done card: check-circle 16 + title **`text/muted`** "Wireframes approved" / "Milestone achieved" / "17 Oct" + Badge success dot "Done" |

---

## SCR-DEV-007 — Task detail (drawer)

Frame: [D-L 267:13129](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=267-13129). State: editing task "Content upload" over DEV-006 board (scrim).

| Area | Spec |
|---|---|
| Drawer 480 header | "Content upload" / "Task · PRJ-0014 · Glow Beauty Salon — Booking website" · Close 44 |
| Body (p 24, gap 16) | Select "Task status" = "To do", helper "Task status only (proposed, no DEC ID). Project status stays In progress." · Conditions row (gap 8): Derived Amber "Client dependency" + 13/18 secondary "Client content pending — not a task status." · Select/Person "Owner" (Avatar 24 brand "SF" + "Sami Fares") · Field pair (gap 16): Date "Start date" 21 Oct 2026 / Date "Due date" 28 Oct 2026 · Textarea "Description" "Upload logo, price list and 12 salon photos once received from the client. Optimise images for web." · Warning Note "Sami Fares" 20 Oct, 10:12 "Client dependency: waiting for logo (SVG), price list and 12 photos." · Link S "Mark dependency resolved" |
| Footer (justify-between) | Ghost "Cancel task…" (left) · Secondary "Close" · Primary "Save changes" |

### SCR-DEV-007 — Mobile Light

Frame: [M-L 267:15282](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=267-15282). Conflict variant: [M-L 267:15389](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=267-15389) (not extracted). Full-screen page (different sample task).

| Area | Spec |
|---|---|
| Header | Back 44 · "SMS template setup" / "Harbor Auto Care · PRJ-0011" · Avatar SF |
| Content (p 16, gap 12, h 708) | Select "Task status" = "In progress", helper "Task status only (proposed, no DEC ID). Project status stays Blocked." · Conditions: Derived Amber "Overdue 6 days" + Caption muted "Derived: due date passed, not Done." · Owner (SF Sami Fares) · Date "Start date" 7 Oct 2026 · Date "Due date" 14 Oct 2026 (stacked, not paired) · Textarea "Description" "Write the reminder SMS templates (booking, 24 h before, follow-up) and test them." counter "101 / 500" · Ghost L full-width "Cancel task…" |
| Sticky footer | top 764, h 80: Primary L full-width "Save changes" |

---

## SCR-DEV-008 — Finalize closure & provision project (dialog)

Frame: [D-L 321:13122](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=321-13122). **Exists only under DEC-006 Alt A — build behind a flag, select none.** Dialog over DEV-002 (scrim).

| Area | Spec |
|---|---|
| Dialog (md 520, radius 16, p 24, gap 16, Elevation/3 — as SHR-002 dialog) | header "Finalize closure" H2 / "Cedar Home Realty — Listings website · DL-0033" · Close 44 |
| Body (gap 12) | KV Accepted "14 Sep 2026 · Omar Nassar"; Signed "7 Oct 2026 · AGR-0133"; Paid "15 Oct 2026 · PAY-0151" · 13/18 secondary "Closing records you (Lina Aoun) and the time. Closed deal ≠ completed project — delivery continues on the project board." · Inline policy "DEC-006 / R-12" "This dialog exists only if DEC-006 Alt A (Developer finalizes) is adopted. Not selected." · Inline policy "F2" "After closure the project is created automatically or by hand — not decided." · chips "DEC-017 one project per deal?", "DEC-018 no evidence required yet" |
| Footer (justify-end, gap 8) | Secondary M "Cancel" · Primary M "Finalize closure" |
