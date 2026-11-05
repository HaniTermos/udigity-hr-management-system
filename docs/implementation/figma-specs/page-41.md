# Page 41 — Owner/Admin (Figma specs)

File `GNrhb3DWa6mIhEX6F4Nmvw`. Light values. Shared shell/components: [page-40.md](page-40.md); tables/filters: [page-42.md](page-42.md); Card/Metric: [page-44.md](page-44.md) (DEV-005).

## Owner shell

| Part | Spec |
|---|---|
| Sidebar sections | OVERVIEW: Dashboard · PEOPLE: Attendance, Employees, Targets & Work Lists · BUSINESSES: Businesses, Correction Requests (count 4), Categories · CALLING: Calling Assignments, Follow-ups & Calendar · DELIVERY: Deals & Meetings, Projects · ADMIN: Reports & Exports, Audit Log, Delivery Monitor, Settings · bottom: My Day (check in), My Profile |
| TopBar | search "Search businesses and employees"; pill "Checked in · 08:52"; user "Rana Haddad" / "Owner/Admin", avatar "RH" |
| Content | p 24, gap 12 (dashboard) |

---

## SCR-OWN-001 — Owner dashboard

Frame: [D-L 200:22902](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=200-22902). State: 7-day period 14–20 Oct, compare on. (S2 reference frames on page 30: 199:4716 / 199:5563.)

| Area | Spec |
|---|---|
| R1 header (h 48, gap 12) | Title group: H1 "Dashboard" + Caption muted "Updated 11:20 · company time" · Filters (gap 8): Segmented "Today" / **"7 days" (active)** / "30 days" · Input/Date range w 164 (no visible label) "14–20 Oct 2026" · Checkbox "Compare 7–13 Oct" · Select w 120 "All roles" · Select w 144 "All employees" · Secondary M "Export" |
| R2 KPI strip (5 equal, gap **24**, h 158) | Card/Metric (p 20, gap 8; label 13/18 secondary; value Number Large 28/36; delta Caption; caption muted): "Call attempts" 184 · delta "+23 vs 161 (7–13 Oct)" · "Period · 14–20 Oct" — "Businesses contacted" 97 · "+7 vs 90 (7–13 Oct)" · "Distinct · ≠ attempts" — "Accepted opportunities" 3 · chip "No DEC ID Stage names" · "Snapshot · current stage (B-1)" — "Closed deals in period" 1 · delta "−1 vs 2 (7–13 Oct)" · "≠ accepted · 14–20 Oct" — "Development workload" "3 · 5 · 12" · chip "DEC-019 statuses" · "Lina 2·4·7 · Sami 1·1·5" |
| R3 (3 cards **368 w**, h 271, gap 24; card p **16**, gap 12, radius 12) | |
| · Attendance today | header H3 + Link "Open attendance". Stats row (justify-between): "4 of 6" Checked in now · "2" Not checked in yet · "1" Missing checkout (value H3/Number, label Caption muted). Avatars 24 neutral RH KS MK LA + Caption "In 08:52–09:14 · 0 checked out"; ON SF + "Omar Nassar, Sami Fares · ≠ absent". Divider. 12/16 muted "Absent on a scheduled day: policy pending" / "Late arrivals: policy pending"; chips DEC-007, DEC-008, DEC-022 |
| · Calling activity · 14–20 Oct | Link "Open report". Legend (gap 16): swatch 10 radius 2 `chart/series-1` "Call attempts"; `chart/series-2` "Businesses contacted (per day)". Plot 324 × 136: y-axis 0/15/30/45/60 (Caption muted, gridlines 1 px `chart/grid` from x 40, w 280); grouped bars per day 14 w, radius top 2, gap 3, scale 60 = 108 px; days 14–20 (18 empty); **20 Oct bars opacity 50 %** (partial day). Values s1/s2: 14: 31/19 · 15: 34/20 · 16: 29/16 · 17: 12/7 · 18: 0 · 19: 56/30 · 20: 22/13. Caption "Oct 14–20 · 20 = today to 11:20 (lighter). Daily distinct counts sum to 105; period distinct is 97." |
| · Exceptions · 4 | Link "Delivery monitor". Rows (gap 2; each gap 8): title 14/20 Medium + meta Caption muted + Secondary S action: "Missing checkout" / "Omar Nassar · Mon 19 Oct, in 09:04" / "Review" · "Reminder failed" / "Peak Fitness Gym · Lina Aoun" / "Send again" · "Reminder suppressed" / "Nova Dental Clinic · Sami Fares" / "Send again" · "Notification failed" / "Assignment changed · Omar Nassar" / "View". Chips "AR-13 Send again = new reminder", "DEC-026" |
| R4 (3 cards 368, h 271) | |
| · Businesses · now | Link "Open list"; 2-col grid of cells (label Caption muted / value H3, gap 2; rows gap 10): Total businesses 248 + chip C-01 · Added 14–20 Oct 37 + "+8 vs 29" · Unassigned 18 + "≠ Pending" · Pending 96 · On hold 14 · Callback requests 11 + chip B3-Q11 · Rejected 42 · Needing corrections 5 |
| · Pipeline events · October | subtitle "14–20 Oct: 2 accepted · 1 closed · 1 completed"; legend Accepted / Closed deal / Project completed (chart series 1–3); y 0/2/4/6; x 1 Oct, 5, 10, 15, 20 Oct; chips "DEC-019 statuses", "DEC-018 revenue not shown" |
| · Targets · today | chips "DEC-020 pending", "DEC-025 pending"; Progress bars (gap 10): "Karim Saleh — businesses added" "6 / 10" (60 %); "Maya Khoury — call attempts" "22 / 40" (55 %); "Omar Nassar — call attempts" "0 / 40 (not in yet)" (0 %); Caption "Counted by action timestamp (A2). What counts: DEC-020; daily cadence: DEC-025. No overall % shown." |

---

## SCR-OWN-002 — Employees

Frame: [D-L 201:22895](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=201-22895). State: 6 active employees.

| Area | Spec |
|---|---|
| Nav | Employees active |
| Header (gap 12) | H1 "Employees" / "6 employees · 6 active · Owner only"; Primary M "Add employee" |
| Filters (gap 12) | Search w 360 "Search name or email" · Select w 180 "All roles" · Select w 180 "All statuses" · Caption muted "6 results" |
| Table | Employee 260 (Avatar 32 neutral + name 14/20 Medium + email Caption muted) · Role 150 · Account 140 (Badge success "Active", dot) · Sessions 190 (text-with-meta) · Open work 192 · Flags 164 · action 56 (kebab) |
| Rows | RH Rana Haddad / rana.haddad@udigity.example — Owner/Admin — Active — "1 active" / "2FA complete · since 08:52" — "—" / "Owner" — Badge neutral "2FA enrolled" · KS Karim Saleh — Data Entry — "1 active" / "Since 09:02" — "2 corrections" / "to resolve" · MK Maya Khoury — Call Center — "1 active" / "Since 08:58" — "42 assignments" / "4 follow-ups" · ON Omar Nassar — Call Center — "No active session" / "Signed out 19 Oct 18:12" — "37 assignments" / "2 follow-ups · 1 open session" — Badge/Flag warning "Missing checkout" · LA Lina Aoun — Developer — "1 active" / "Since 09:14" — "2 deals · 4 projects" / "7 open tasks" · SF Sami Fares — Developer — "No active session" / "Not signed in today" — "1 deal · 1 project" / "5 open tasks" |
| Notes (gap 12) | 13/18 secondary "Account state (Active / Deactivated) is separate from sign-in sessions. Deactivating revokes every session at once; open work stays attached and is flagged “assignee inactive” until you reassign it in its own screen." + Inline policy "No DEC ID" "Open work of a deactivated employee: you decide per item; no automatic reassignment." |

---

## SCR-OWN-003 — Employee create / edit (drawer)

Frame: [D-L 202:22895](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=202-22895). State: edit mode over OWN-002 (scrim).

| Area | Spec |
|---|---|
| Drawer 480 | header "Edit employee" / "Maya Khoury · Call Center" · Close 44 |
| Body | H4 "Profile details" · two-field row (gap 12): Input "Full name *" Maya Khoury / Input "Job title" Call Center agent · Input "Email *" maya.khoury@udigity.example · two-field row: Input/Phone "Phone" +000 70 000 121 / Select "Department" Calling · Divider · H4 "Role and status" + 13/18 secondary "Not edited in this form. Change role revokes sessions; Deactivate lists open work first." · KV Role "Call Center"; Account · sessions "Active · 1 session since 08:58" · Role actions (gap 8): Secondary M "Change role…" · **Destructive M "Deactivate…"** (bg `status/danger/solid`, text `text/on-danger`) · Caption muted "Send reset link (footer) queues an email; you never see the password. Delivery failures appear in Delivery monitor." |
| Footer (justify-between) | Ghost "Send reset link" (left) · Secondary "Cancel" · Primary "Save changes" |

---

## SCR-OWN-004 — Attendance monitoring & exception alerts (preserved ID)

Frame: [D-L 287:22811](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=287-22811). State: live today, 1 missing checkout.

| Area | Spec |
|---|---|
| Nav | Attendance active |
| Header (gap 12) | H1 "Attendance" / "Tue 20 Oct 2026 · 11:20 company time · live" · Input/Date (no label) w 180 "Tue 20 Oct 2026" · Select w 180 "All employees" · Secondary M "Corrections & review" |
| Summary tiles (5 equal, gap 16) | Card p 20, radius 12; content gap 2: value H2/Number, label 14/20 Medium, caption Caption muted. "4 of 6" Checked in now "In 08:52–09:14" · "0" Checked out "Sessions closed today" · "2" Not checked in yet "≠ absent (scheduled days: DEC-022)" · "1" Missing checkout "Omar Nassar · 19 Oct" (whole tile is a link) · "—" Late arrivals "Not configured · policy pending" + chip DEC-008 |
| Main (gap 24) | Today table **816 w** (gap 8) + Exceptions card (flex-1) |
| Today table | Employee 170 (Avatar 24 + name) · Status 160 · In 110 · Out 56 · Verification 170 · Punctuality 150. Rows: RH Rana Haddad — Badge success "Checked in" — 08:52 — — — "Recorded" / "Mode pending · DEC-009" — Derived "Unclassified" · KS Karim Saleh — 09:02 — same · MK Maya Khoury — 08:58 — same · LA Lina Aoun — 09:14 — "Remote · if adopted" + chip DEC-010 — Unclassified · ON Omar Nassar — Badge warning "Open since 19 Oct" — "09:04" / "Mon 19 Oct" — — — "Check-in blocked" / "until corrected" — Badge/Flag warning "Missing checkout" · SF Sami Fares — Badge neutral "Not checked in yet" — — — — — "≠ absent" |
| Under table | chips "DEC-007/008 schedule & grace pending → Unclassified", "DEC-009 office check mode" |
| Exceptions & alerts · 2 (Card/Section) | Link "Review all"; rows (gap 12): "Missing checkout" / "Omar Nassar · Mon 19 Oct, in 09:04 · session stays open" / Secondary S "Review"; "Alert not delivered" / "Missing-checkout alert to Rana Haddad · 19 Oct 18:30" / Secondary S "View"; "Missing check-in alerts off" / "Need working days, shift start and grace first" (no action); chips DEC-007, DEC-008, DEC-022; Inline policy "No DEC ID" "Alert recipients, timing and escalation are not decided." |

**Mobile** [M-L 287:23936](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=287-23936) — Shell/Mobile · Owner: header "Today" / "Tue 20 Oct · 11:20" + Avatar 32 RH; tab bar Owner: **Today** (active, icon home) · My Day (clock) · Alerts (bell) · More (menu).

| Area | Spec |
|---|---|
| Content | p 16, gap 8 |
| Tiles 1 / Tiles 2 (2 per row, gap 12) | Card p 20 radius 12; value H2 (20/28 SemiBold), label Label 14/20: "4 of 6" Checked in now · "0" Checked out / "2" Not checked in yet + Caption "≠ absent" · "1" (value in `status/warning/fg`) Missing checkout + "Omar Nassar · 19 Oct". Late-arrivals tile not on mobile |
| Card/Section "Exceptions · 2" | list items (px 16 py 12, gap 12, border-b `border/subtle`; Leading 36 circle `brand/accent-subtle` + icon 20; title Label + meta Caption; chevron 16): alert-triangle "Missing checkout" / "Omar Nassar · 19 Oct, in 09:04" · x-circle "Alert not delivered" / "Checkout alert · 19 Oct" |
| Card/Section "Not checked in yet · 2" | items (no chevron, icon user): "Omar Nassar" / "Open since 19 Oct · blocked" · "Sami Fares" / "No session today · ≠ absent" |
| Policy (wrap, gap 4) | chips DEC-007, DEC-008, DEC-022, DEC-010 |
| Not on mobile | Today table, date/employee filters, "Corrections & review" button |

---

## SCR-OWN-005 — Attendance corrections & review

Frame: [D-L 205:22895](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=205-22895). State: review queue, Omar Nassar missing checkout selected; DEC-011 pending (Alt A / Alt B drawn as sibling frames, not extracted).

| Area | Spec |
|---|---|
| Content | p 24, gap 16 |
| Header (gap 12) | H1 "Corrections & review" / "Attendance · originals are never overwritten · every change is audited" · Secondary M (h 40, `border/strong`) "Open attendance" |
| Tabs (gap 24, border-b) | tab h 40 px 4: **"Review queue · 1"** (active, 2 px `brand/accent` indicator) · "Corrected sessions" |
| Main (gap 24) | Queue card **400 w** + detail card (flex-1) |
| Card "Needs review · 1" | p 20 gap 16 radius 12. Queue item (selected: bg `surface/selected`, border default, radius 8, px 12 py 10, gap 4): "Missing checkout" / "Omar Nassar · Mon 19 Oct · in 09:04, no checkout" + Badge/Flag warning "Blocks next check-in" (radius sm). Divider. Preview box (border **dashed** default, radius 8, p 8, gap 6): caption "Preview · +2 if DEC-026 Alt B/C adopted (not counted)"; items (no bg): "Checkout pending review" / "Sami Fares · Fri 16 Oct · checkout attempt 18:02" + chip "DEC-026 · Alt C, if adopted"; "Provisional checkout" / "Lina Aoun · Thu 15 Oct · checkout 17:55" + chip "DEC-026 · Alt B, if adopted" |
| Card "Omar Nassar · Mon 19 Oct 2026" / "Call Center · missing checkout" | content gap 12: H4 "Original session (kept, never overwritten)"; KV rows (gap 12, py 6): Check-in "09:04 · recorded (mode: DEC-009 pending)" · Checkout "Not recorded" · Session state "Open · next check-in blocked"; Divider; Policy notice (px 16 py 12, radius md, gap 6) "DEC-011" "Correction authority — policy pending" / "Alt A: you enter corrected times and a reason. Alt B: the employee submits a request and you approve or reject it with a reason. Neither is selected; both readings are drawn as their own frames beside this one."; footnote "Whichever applies, the correction is saved beside the original, audited as attendance.corrected, and unblocks check-in." |

---

## SCR-OWN-006 — Targets & work lists

Frame: [D-L 206:22844](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=206-22844). State: today, Maya Khoury's work list open (automatic proposal).

| Area | Spec |
|---|---|
| Header (gap 12) | H1 "Targets & work lists" / "Progress counts actions by their own timestamp in company time (A2) · check-in not required (A1)" · Input/Date w 180 (no label) "Tue 20 Oct 2026" · Primary M "Set target" |
| Policy row (gap 8) | Notice/Policy pending (px 10 py 6, radius sm) DEC-020 "What counts toward a target is not decided. Metric names are placeholders; no overall % is shown." · chips "DEC-025 daily cadence pending", "DEC-021 automatic allocation" |
| Main (gap 24) | Table **760 w** + work-list card (flex-1) |
| Table · Targets · today | Employee 190 (Avatar + name) · Metric 170 (text-with-meta) · Progress 230 (Progress: label "Today", value, bar %) · Work list 170. Rows: Karim Saleh — "Businesses added" / "DEC-020 placeholder" — 6 / 10 (60 %) — "Target only" / "No work list" · **Maya Khoury** (selected row) — "Call attempts" — 22 / 40 (55 %) — "Automatic proposal" / "40 items · DEC-021" · Omar Nassar — "Call attempts" — "0 / 40 · not in yet" (0 %) — "Manual" / "12 items" · Lina Aoun — "Tasks completed" — 1 / 3 (35 %) — "Target only" / "No work list" · Sami Fares — "No target set" / "for 20 Oct" — Link "Set target" — "—" |
| Card "Work list · Maya Khoury" / "Tue 20 Oct · target 40 call attempts" | content gap 12. Method radios (gap 16; circle 16, border `border/input`): Target only · Manual · **Automatic proposal** (selected) + chip "DEC-021 Proposed rule". Caption "Proposal · 40 eligible items". Items (list rows): "Olive & Thyme Café" / "Unassigned · Pending · Café" · "Sunrise Bakery" / "Unassigned · Pending · Shop" · "Lumen Yoga Studio" / "Maya Khoury · Needs another call". Link "+ 37 more · 4 excluded (reasons)". Banner info (px 12 py 10, radius md) "Rule B8" "Call Center items are assigned only by Calling assignments (WF-CALL-001), which runs the same eligibility checks." Actions (gap 8): Secondary M "Adjust" · Primary M "Hand off 40 to assignments" |

---

## SCR-OWN-007 — Calling assignments

Frame: [D-L 237:22788](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=237-22788). State: Assignments tab, 3 rows selected, bulk assign to Omar Nassar. (Conflict variant 267:15389-style frames not extracted.)

| Area | Spec |
|---|---|
| Header (gap 12) | H1 "Calling assignments" / "248 businesses · 18 unassigned · Maya Khoury 42 · Omar Nassar 37" · Secondary M "Open agent queue" |
| Tabs (gap 24) | **"Assignments"** (active) · "Opportunities & handoffs" · "Do-not-call list" |
| Filters (gap 8) | Input/Search w 300 "Search business, phone or handle" · Chip/Filter active "All" (bg `surface/selected`, border `border/selected`, h 32) · "Unassigned · 18" · "Needs decision · 3" · Select w 170 "All categories" · Select w 160 "All outcomes" |
| Bulk actions bar | bg `surface/sunken`, px 12 py 8, radius 8, gap 12: "3 selected" · Select w 200 with Avatar 24 "ON" + "Omar Nassar" · Primary S (h 32) "Assign" · Secondary S "Unassign" · chips "DEC-021 automatic allocation", "DEC-017 B6", "C-01 B4" |
| Table · Assignments | checkbox 48 · Business 280 (text-with-meta) · Phone 170 · Outcome 160 (Badge/Outcome) · Assigned to 180 · Last attempt 150 (time / agent) · Flags 108 · actions 56 |
| Rows | ☑ Olive & Thyme Café / Café — +000 70 000 106 — Pending — "Unassigned" — "—" / "Never called" — — · ☑ Lumen Yoga Studio / Gym — …110 — Needs another call — Maya Khoury — 19 Oct 16:40 — — · ☑ Sunrise Bakery / Shop — …108 — Pending — Unassigned — Never called · ☐ Peak Fitness Gym / "Gym · open deal" — …102 — Accepted — Maya Khoury — 20 Oct 11:02 — Badge/Flag "Reserved" · ☐ Nova Dental Clinic / Clinic — …107 — On hold — ON Omar Nassar — 18 Oct 12:15 · ☐ Cedar Home Realty / "Real estate" — …103 — Pending — Maya Khoury — 16 Oct 10:20 — Flag "B7" · ☐ Harbor Auto Care / "Services · do not call" — …109 — Rejected — Unassigned — 12 Oct 15:05 (Omar Nassar) — Flag neutral "DNC" |
| Footer | Caption "Showing 7 of 248 businesses · the list continues below (scroll)" |
| Badge/Outcome tones | Pending neutral · Needs another call info · Accepted success · On hold warning · Rejected danger |

---

## SCR-OWN-008 — Reassign dialog (reservation + follow-ups)

Frame: [D-L 302:22859](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=302-22859). State: OWN-007 underneath (identical) + scrim; nothing chosen yet → primary disabled.

| Area | Spec |
|---|---|
| Dialog | **w 720**, left 360 top 127, p 24, gap 16, radius 2xl (16), bg `surface/raised`, border `border/subtle`, shadow Elevation/3 (0 6 8 −4 rgba(11,26,53,.06), 0 16 24 −4 rgba(11,26,53,.14)) |
| Header | Titles (gap 4): "Reassign Peak Fitness Gym" / "From Maya Khoury to Omar Nassar. Choose what happens to each item before saving." · Close 44 |
| Body (gap 12) | Group label "Active reservation" + chip "DEC-004 override rules (Proposed)" · row (gap 8): Icon/lock 16 + "Reserved by Maya Khoury since 11:02 — a call is in progress." · radios (gap 24, none selected): "Wait — save nothing now" · "Override the reservation (reason next)" · Divider · "Open follow-ups · 2" + chip "B3-Q03 no default" · follow-up rows (gap 12, justify-between): "Callback · Wed 21 Oct 10:00" / "Owner: Maya Khoury · “Ask for the manager”" + Select w 240 "Choose…"; "Callback · Fri 23 Oct 15:30" / "Owner: Maya Khoury · “Send price list first”" + Select "Choose…"; Caption "Per follow-up: Transfer to Omar · Cancel (reason required) · Keep with Maya (warning)." · Divider · KV "“Callback to be scheduled” marker" → "Present · shows in Omar’s queue" · KV "Deal record" → "Accepted opportunity · Developer Lina Aoun · unchanged" · Notice/Policy "No DEC ID" "Is Maya told about the reassignment? Not decided." · Caption "Reassign stays disabled until the reservation and each follow-up have a choice." |
| Footer (justify-end, gap 8) | Secondary "Cancel" · Primary **disabled** "Reassign" (bg `surface/disabled`) |

---

## SCR-OWN-009 — Reports & exports

Frame: [D-L 289:22805](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=289-22805). State: Calling activity report, 14–20 Oct, Call Center.

| Area | Spec |
|---|---|
| Header (gap 12) | H1 "Reports & exports" / "Owner only · an export uses exactly the filters on screen and is recorded in the audit log" · Select w 160 (no label) "Excel (.xlsx)" · Primary M "Export" |
| Main (gap 24) | Reports card **300 w** + report column (flex-col gap 16) |
| Card "Reports" | list items (title Label + meta Caption; first = selected): Calling activity / "Attempts and outcomes" · Businesses / "Totals, categories, corrections" · Attendance / "Sessions, hours, exceptions" · Targets / "Target vs counted actions" · Deals & pipeline / "Accepted, closed, stages" · Projects & workload / "Statuses, workload counts" · Delivery failures / "Reminders, notifications" |
| Filters card | p 20; row gap 12 of labelled fields w **196**: Date range "14–20 Oct 2026" · Role "Call Center" · Employee "All agents" · Category "All categories" · Calling outcome "All outcomes" · Checkbox (box 16, radius xs) "Compare previous period" (unchecked) |
| Totals (3 equal, gap 16) | Card p 20 (value H2/Number, label, caption muted): 184 "Call attempts" "Attempt rows in period" · 97 "Businesses contacted" "Distinct businesses · ≠ attempts" · 2 "Accepted in period" "accepted_opportunity.created · ≠ closed" |
| Table · Preview | Agent 228 · numeric cols right-aligned: Call attempts 150 · Businesses contacted 160 · Accepted (period) 140 · Follow-ups set 150. Rows: Maya Khoury 112 · 58 · 2 · 9 / ON Omar Nassar 72 · 42 · 0 · 6 / total row "All agents" (meta "Distinct · 3 called by both") 184 · 97 · 2 · 15 |
| Notes (gap 8) | chips "DEC-018 revenue not shown", "DEC-002 export scope if ever extended", "ADR-010 synchronous, streamed, never stored" |

---

## SCR-OWN-010 — Audit log

Frame: [D-L 210:22783](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=210-22783). State: 14–20 Oct, all filters, newest first.

| Area | Spec |
|---|---|
| Header (gap 12) | H1 "Audit log" / "Read-only · append-only · company time · 246 events 14–20 Oct" · Export group (flex-col gap 4): row (gap 6) chip "OQ-18 audit export open" + **disabled** Secondary M "Export" (bg `surface/disabled`, border default) + Caption "Only if OQ-18 is adopted" |
| Filters (gap 12, labelled) | Input/Date w 200 "Date range" "14–20 Oct 2026" · Select w 180 "Actor" "All actors" · Select w 180 "Entity type" "All entities" · Select w 200 "Event" "All events" · Input (flex-1) "Entity reference" placeholder "Business, employee or record" |
| Rules (gap 8) | Banner info (px 16 py 12, gap 12, no action) title "Read-only, append-only (G3)" body "Entries cannot be edited, deleted or hidden. Passwords, reset tokens and 2FA secrets are never recorded." · chip "OQ-19 retention open" |
| Table · Audit events | Time 140 (sort Descending; text-with-meta, meta "2026") · Actor 180 (name / role) · Event 300 (mono-style event key; meta "Placeholder name (§5)" where applicable) · Entity 230 · Summary 246 · action 56 |
| Rows | 20 Oct 11:16 — Rana Haddad / Owner/Admin — settings.updated (placeholder) — "Settings · Office verification" — "Office IP list: 1 address added" · 11:05 — Rana Haddad — calling_assignment.reassigned — "Business · Lumen Yoga Studio" — "Maya Khoury → Omar Nassar" · 10:48 — Maya Khoury / Call Center — call_attempt.logged — "Business · Peak Fitness Gym" — "Outcome: Needs another call" · 10:12 — Karim Saleh / Data Entry — business.created — "Business · Sunrise Bakery" — "Category Shop · 1 phone" · 09:30 — Rana Haddad — report.exported — "Report · Calling activity" — "Excel · 3 rows · 14–20 Oct" · 09:14 — Lina Aoun / Developer — attendance.checked_in — "Attendance · Lina Aoun" — "Check-in recorded" · 19 Oct 18:30 — System / "Scheduled check" — attendance.missing_checkout_detected (placeholder) — "Attendance · Omar Nassar" — "Session open since 09:04" |
| Footer | Caption "Showing 7 of 246 events · newest first · the list continues below (scroll)" |

---

## SCR-OWN-011 — Settings (Attendance & office check)

Frame: [D-L 275:22810](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=275-22810). State: Attendance tab; schedule & mode policies pending, nothing selected.

| Area | Spec |
|---|---|
| Header (gap 12) | H1 "Settings" / "Changes apply to future sessions (Proposed) and are audited as a security setting change" · Secondary M "Discard" · Primary M "Save attendance settings" |
| Tabs (gap 24) | **"Attendance & office check"** (active) · "Company" · "Security" |
| Main (gap 24) | two Card/Section, **flex-1 each** (p 20, gap 16, radius 12) |
| Card "Work schedule" / "Used for punctuality, absence and missing check-in" | content gap 12: KV "Workday length" → "9 hours · Confirmed" · Select "Company timezone" "UTC+03:00 · company time" + helper "All reports and punctuality use company time." · row (gap 12, fields flex-1 min-w 120): Input/Time "Shift start" placeholder "HH:MM" helper "DEC-007 pending" · Input "Grace period" placeholder "Not set" + suffix "min" helper "DEC-008 pending" · head (gap 8) label "Working days" + chip "DEC-022 rest days pending" · checkboxes (gap 12, box 16 radius xs, **all unchecked**) Mon Tue Wed Thu Fri Sat Sun · Notice/Policy (inline, px 10 py 6, radius sm) "DEC-010" "Remote check-in exceptions exist only if adopted; no control is shown until then." · Policy notice block (px 16 py 12, radius md) "DEC-007 · DEC-008 · DEC-022" "Schedule rules — policy pending" / "Until these are set, punctuality shows “Unclassified” and missing check-ins are not detected. Nothing is assumed." |
| Card "Office verification" / "Used at check-in and checkout" | head (gap 8) "Verification mode" + chip "DEC-009 none selected" · Modes (flex-wrap, gap 12): RadioCard w **244**, px 16 py 12, radius lg, gap 12, radio 16 unselected; title Label + caption: "Office network (IP)" "On an office IP." · "Location (geofence)" "Inside the office area." · "IP or location" "Either check passes." · "IP and location" "Both checks must pass." (2 × 2) · IP row (gap 8, items-end): Input "Office IP addresses" "203.0.113.24" + Secondary M "Add IP" · Input "Office geofence" placeholder "Pick the office location and radius" helper "Used only by location modes." · Test row (gap 12): Secondary M "Test office check" + Caption "Runs the check from this device now. Nothing is saved." |

---

## SCR-OWN-012 — Delivery monitor

Frame: [D-L 212:22791](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=212-22791). State: 4 open items (all).

| Area | Spec |
|---|---|
| Header (gap 12) | H1 "Delivery monitor" / "4 items · failed or suppressed reminders and notifications, failed project provisioning" · Secondary M "Open audit log" |
| Filters (gap 8) | Chip/Filter active "All · 4" · "Reminders · 2" · "Notifications · 2" · "Project provisioning · 0" · Select w 170 "All statuses" |
| Table · Delivery items | Type 140 (Badge neutral) · Item 330 (text-with-meta) · Recipient 180 (Avatar 24 + name) · Status 160 (Badge) · Reason 210 (text-with-meta) · Action 132 (Secondary S) |
| Rows | Reminder — "Meeting reminder · Peak Fitness Gym" / "Meeting Thu 22 Oct 14:00" — LA Lina Aoun — danger "Failed" — "Email rejected" / "20 Oct 09:00 · 3 attempts" — "Send again" · Reminder — "Meeting reminder · Nova Dental Clinic" / "Meeting Fri 23 Oct 10:30" — SF Sami Fares — warning "Suppressed" — "No access at send time" / "C6 · 20 Oct 08:30" — "Send again" · Notification — "Assignment changed · Lumen Yoga Studio" / "In-app + email" — ON Omar Nassar — danger "Failed" — "Email bounced" / "20 Oct 11:06" — "View" · Notification — "Missing-checkout alert · Omar Nassar" / "Session Mon 19 Oct" — RH Rana Haddad — danger "Failed" — "Email bounced" / "19 Oct 18:30" — "View" |
| Policy (gap 8) | chips "AR-13 Send again = new reminder · failed stays failed", "F2 provisioning trigger pending", "No DEC ID timing, recipients, escalation" · 13/18 secondary "A failed or suppressed reminder never changes its follow-up or meeting (D5). Suppressed = recipient inactive or without access at send time (C6)." |
