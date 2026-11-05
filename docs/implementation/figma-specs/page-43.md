# Page 43 — Call Center (Figma specs)

File `GNrhb3DWa6mIhEX6F4Nmvw`. Light values. Shell (Call Center sidebar: MY WORK My Day / My Attendance · CALLING Calling Queue (7) / Follow-ups & Calendar / Opportunities & Handoffs / Do-not-call List · My Profile; user Maya Khoury / Call Center; search "Search assigned businesses") and shared components are in [page-40.md](page-40.md).

Page-43 components:

| Component | Spec |
|---|---|
| Badge/Outcome | radius full, px 8, py 2, gap 4, border 1; icon 14; 12/16 Medium. "Pending" = neutral tone; "Needs another call" = info tone; "On hold" = warning tone (icon pause/clock) |
| Badge/Count | min-w 20, px 6, py 2, radius full, bg `status/neutral/bg`, 12/16 Medium `status/neutral/fg` |
| Queue/BucketHeader | bg `surface/sunken`, px 12, py 8, gap 8; icon 16; label 14/20 SemiBold primary (flex-1, ellipsis); Badge/Count |
| Queue/Row | flex-col gap 4, py 10 (px 16), border-b `border/subtle`, bg default; top row (gap 8): name 14/20 Medium + Badge/Outcome right; meta Caption 12/16 muted; optional flag below. **Selected**: bg `surface/selected` + left bar 3 px `brand/accent` |
| Segmented tabs | container bg `surface/sunken`, p 4, gap 4, radius 8; item h 32, px 12, radius 6, 14/20; active bg `surface/default` + `text/primary`; inactive `text/secondary` |
| Flag "Reserved" | Chip/Derived Amber (dashed `status/warning/fg`) |
| Flag "Overdue" | Badge/Flag Danger: bg `status/danger/bg`, radius 4, icon 14, 12/16 Medium `status/danger/fg` |

---

## SCR-CC-001 — Calling queue

Frame: [D-L 311:13767](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=311-13767). State: 7 assigned, Olive & Thyme selected.

| Area | Spec |
|---|---|
| Nav | Calling Queue active |
| Content | **pt 20, px 24, pb 16, gap 12** |
| Page header (gap 12) | Title "Calling queue" **H2 20/28** (not H1); subtitle 13/18 secondary "Tue 20 Oct 2026 · 7 businesses assigned to you · open a business to see its history and start a contact". Right: Secondary M "Follow-ups & Calendar" (calendar icon 20) · Ghost M "Do-not-call list (1)" (ban icon 20) |
| Toolbar (gap 12) | Search w 240 "Filter by name or phone" · Segmented: "All buckets" (active) · "Due today (2)" · "Overdue (1)" · spacer · Chip/Derived "Buckets are derived · a business can be in 2" · chip "No DEC ID Overdue threshold" (policy chip with custom second label) |
| Bucket board | 3 equal columns, gap 16; each column card bg default, border default, radius 12, flex-col; column label pt 12, pb 8, px 16, Overline muted |
| Column "DUE NOW" | Bucket "Callbacks due today" (2): Olive & Thyme Café — Needs another call — "Café · Due 10:30 · last attempt 13 Oct 15:10" (selected); Nova Dental Clinic — Needs another call — "Clinic · Due 14:00 · held by Omar Nassar since 10:24" + flag "Reserved". Bucket "Overdue follow-ups" (1): Sunrise Bakery — On hold — "Shop · Was due 19 Oct 16:00 · last attempt 15 Oct" + Danger flag "Overdue" |
| Column "TO START OR SCHEDULE" | Bucket "New assignments" (2): Lumen Yoga Studio — Pending — "Gym · Assigned 19 Oct by Rana Haddad · no attempts yet"; Urban Cuts Barbershop — Pending — "Salon · Assigned 19 Oct by Rana Haddad · no attempts yet". Bucket "Callback to be scheduled" (1): Cedar Home Realty — Needs another call — "Real estate · Time not set yet · last attempt 16 Oct" |
| Column "NEEDS ATTENTION" | Bucket "Requires contact" (1): Bloom Florist — On hold — "Shop · Last attempt 14 Oct 12:30 · no open follow-up". Bucket "Data correction requested" (1): Bloom Florist — On hold — "Shop · Last attempt 14 Oct 12:30" + Badge/Flag warning "Correction submitted · 14 Oct" |
| Do-not-call strip | bg `surface/subtle`, border `border/subtle`, radius 8, px 16, py 10, gap 12: Link S "Rejected: do not call (1) · view only" + chevron-right 16 · 12/16 secondary "Rejected businesses are excluded from every calling bucket; Start Contact is disabled for them." · chip "DEC-016 Reopen rule pending" · 12/16 muted "No check-in needed to call" |

### SCR-CC-001 — Mobile Light

Frame: [M-L 311:15277](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=311-15277). Tab bar: Queue active.

| Area | Spec |
|---|---|
| Header | "Calling queue" / "Tue 20 Oct · 7 businesses" · Avatar MK |
| Content (p 16, gap 12) | Search full width "Filter queue" · horizontally scrolling chip row (gap 8), each chip in a 44 h hit area: "All" (active), "Due today · 2", "Overdue · 1", "To schedule · 1", "New · 2", "Correction · 1" · Chip/Derived "Derived · a business can be in 2 buckets" |
| Queue list (single column) | BucketHeader "Callbacks due today" (2) → rows Olive & Thyme Café, Nova Dental Clinic (Reserved) · "Overdue follow-ups" (1) → Sunrise Bakery (On hold, Overdue) · "New assignments" **collapsed** (chevron-right icon, `expanded=false`) · "Callback to be scheduled" (1). Mobile row padding: pl 16, pr 12, py 10 |
| Scroll cue | bg `surface/subtle`, border `border/subtle`, radius 8, px 16, py 8; Caption secondary centred "↓ More below · Cedar Home Realty · Data correction requested +2" |
| Do-not-call footer (gap 8) | Link S "Rejected (1) — view only" + chevron (44 hit area) · chip "DEC-016 Reopen pending" |

---

## SCR-CC-002 — Contact workspace

Frame: [D-L 312:13759](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=312-13759). State: Olive & Thyme Café selected, read mode (not reserved).

New components:

| Component | Spec |
|---|---|
| Row/Phone | h 40, py 6, gap 8: phone icon 16 · number 14/20 primary · Tag neutral label ("Main", "Owner mobile") · spacer · Copy IconButton 32 |
| Row/Social | py 8, gap 10: platform icon 20 · stack (platform Caption muted / handle 14/20 primary) · metrics 13/18 secondary right ("2,140 followers" / "Not recorded") |
| Timeline/Item | gap 12: Marker col (gap 4) = Dot 28 round + connector 2 px `border/default`; content flex-col gap 4, pt 4, pb 16: head (gap 8) title 14/20 Medium + time Caption muted; body 13/18 secondary; optional Badge/Outcome. Dot past attempt: bg `status/neutral/bg` + icon 16. **Dot upcoming/due**: bg default, 1 px **dashed** `status/brand/solid` border |
| List/Item Note | bg `surface/subtle`, radius 6, py 10, flex-col gap 4, left bar 3 px `border/strong`; head (gap 8) author 12/16 Medium primary + time 12/16 muted; body 13/18 secondary |
| Link with trailing icon | Link S + chevron/arrow 16 |

| Area | Spec |
|---|---|
| Content | pt 20, px 24, pb 16, gap 12 |
| Page header | Breadcrumb "Calling Queue › Olive & Thyme Café"; title "Contact workspace" H2; right: Secondary M "Follow-ups & Calendar", Ghost M "Do-not-call list (1)" |
| Workspace | row gap 16: Queue column **344** · Business detail column **400** · Contact panel **376** |
| Queue column (card radius 12) | Header p 16, gap 10: "My calling queue" H3 + Badge/Count "7" + "businesses" Caption muted; Search S (h 32) "Filter queue"; Segmented "All buckets" / "Due today (2)"; Chip/Derived "Derived · a business can be in 2 buckets". List = same rows as CC-001 (DUE NOW buckets, New assignments collapsed, Callback to be scheduled). Scroll cue (border-t, `surface/subtle`, px 16, py 8) "↓ More below · Cedar Home Realty · Data correction requested (1) +2". Footer (border-t, px 16, py 12, gap 8): Link "Rejected: do not call (1) — view only" + chip "DEC-016 Reopen rule pending" |
| Detail column (gap 8; scroll area gap 12) | **Business card** (p 20, gap 16): "Olive & Thyme Café" H3 / "Café · Assigned to you since 6 Oct"; action Link "Request correction" + icon; Row/Phone "+000 70 000 106" Main; "+000 70 000 116" Owner mobile; KV Website "oliveandthyme.example.com". **Call history** card: "Call history" / "3 attempts · newest first", action "Open full history"; timeline: "Follow-up due today · 10:30" / "Due now" — "Owner back from supplier visit — discuss menu website. Scheduled by Maya Khoury on 13 Oct." (dashed brand dot); "Call attempt · Maya Khoury" 13 Oct, 15:10 — "Spoke to manager. Owner decides; call back 20 Oct morning." — Needs another call; 9 Oct, 11:02 — "No answer on main line." — On hold; 7 Oct, 14:25 — "No answer; voicemail full." — On hold; Caption muted "Each attempt is its own record; a later outcome never changes past attempts." **Card/Section "Business details"** / "Read-only · use Request correction to fix data": KV Category Café; Row/Social Instagram @oliveandthyme.demo 2,140 followers; Row/Social Facebook @oliveandthyme.demo "Not recorded"; KV Extra notes "Family-run, two branches planned. Prefers calls after 10:00."; KV Created by "Karim Saleh · 2 Oct 2026 09:14". Scroll cue "↓ Scroll for 1 more history item and business details" |
| Contact panel (card) | Body pt 12, px 16, pb 8, gap 8: "Contact" H3 / "Read mode · not reserved" Caption muted · row "Current outcome" 14/20 secondary ↔ Badge/Outcome Needs another call · H4-ish "Next follow-up" 14/20 Medium · List/Item: calendar in accent circle, "Due today · 10:30" / "Discuss menu website", Badge warning "Due now" · "Latest note" · List/Item Note (Maya Khoury, 13 Oct, 15:10, "Owner decides; call back 20 Oct morning. Interested in an online menu and table booking.") · Caption muted "Calls are placed outside the app. Start Contact reserves this business so nobody else contacts it at the same time." · Inline policy DEC-004 "Reservation length, idle rule and Owner override are undecided." Footer (border-t, px 16, py 12, gap 8): Primary L full-width "Start Contact" (phone icon) + Caption muted "Opens the log-attempt panel. The reservation is released only after you save the attempt or cancel." |

### SCR-CC-002 — Mobile Light

Frame: [M-L 312:15793](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=312-15793). Tab bar Queue active; sticky Start Contact above tab bar.

| Area | Spec |
|---|---|
| Header | Back 44 · "Olive & Thyme Café" / "Café · Needs another call" · Avatar MK |
| Content | top 56, h 632, p 16, gap 12 |
| Card/Section "Contact details" / "Read-only" | Action touch (44 h) Link "Request correction" + icon (→ SHR-009 mobile sheet). Body gap 4: phone row (py 6, gap 8) "+000 70 000 106" 14/20 Medium · "Main" Caption muted (flex-1) · Ghost S "Copy" (h 32, px 12, copy icon 16) inside 44 hit area; Link S "+1 more number" + chevron-down 16 (44 h) |
| Next follow-up | List/Item: calendar accent circle, "Due today · 10:30" / "Discuss menu website", Badge warning "Due now" |
| History | 14/20 Medium "History & notes" · Timeline/Item (no connector) "Call attempt · Maya Khoury" 13 Oct, 15:10 "Spoke to manager. Owner decides; call back 20 Oct morning." + Needs another call · Link "Open full history & notes (3)" (44 h) · KV Website |
| Scroll cue | "↓ More below · Latest note · Policy labels +1" |
| Sticky footer | top 688, h 92, px 16, py 12, gap 6, border-t, bg default: Primary L full-width "Start Contact" (phone icon) + Caption muted centred "Reserves this business while you call." |

---

## SCR-CC-003 — Active contact — log attempt & outcome

Frame: [D-L 283:13815](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=283-13815). State: reserved by me, "Needs another call" chosen, follow-up set now. Same 3-column workspace as CC-002 (Queue 344 · Detail 400 · Panel 376).

| Area | Spec |
|---|---|
| Detail column top (new) | **Banner Brand "Reserved by me"**: bg `status/brand/bg`, border `status/brand/border` #52C9CB, radius 6, px 16, py 12, gap 12; icon 20; title 14/20 Medium `status/brand/fg` "Reserved by you · since 10:31"; body 13/18 primary "Renews while this workspace is open; expires 10:41 if not renewed. Switching tabs does not release it." · Inline policy DEC-004 "Lease length, idle rule and Owner override are undecided; times shown are illustrative." · Business card subtitle "Café · Assigned to you" (rest as CC-002) |
| Panel header | "Log call attempt" H3 / "Attempt: 20 Oct 2026 · 10:32" Caption muted · Ghost S "Cancel contact" (h 32, px 12, 12/16 Medium) |
| Outcome label row | "Outcome *" 14/20 Medium + chips "D4 pending", "DEC-005 pending" |
| Outcome group (RadioCards, gap 6, compact: px 16, py 8, radius 8) | each title row: status dot 8 + label 14/20 Medium. "On hold — no answer" · **"Needs another call — call later" (selected: `surface/selected` + 2 px `border/selected`)** · "Rejected — do not call" · "Accepted — creates opportunity" |
| Follow-up box | bg `surface/subtle`, border `border/subtle`, radius 8, p 12, gap 8: title "Follow-up" 14/20 SemiBold ↔ Segmented "Set now" (active) / "Set later"; Input/Date (Date and time) "Date and time (company timezone) *" = "Thu 22 Oct 2026 · 11:00"; Input "Purpose" = "Owner back — present menu website options" |
| Note | Textarea (label "Notes" default) value "Owner not in yet; manager asked for Thursday 11:00. Interested in online menu and table booking." counter "104 / 2000", no helper |
| Panel footer | Secondary M "Save, keep reservation" · Primary M "Save attempt" (gap 8) + Caption muted "Reservation is released only after the save succeeds." |

### SCR-CC-003 — Mobile Light

Frame: [M-L 283:15034](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=283-15034). Tab bar Queue active.

| Area | Spec |
|---|---|
| Header | Back 44 · "Log call attempt" / "Olive & Thyme Café · 10:32" · Avatar MK |
| Content (h 600, p 16, gap 12) | Actions row (wrap, justify-between): Link S "Details · Request correction" + icon (44 h, → SHR-008 M) · Ghost L "Cancel contact" (h 48) |
| Form viewport (gap 10, scrolls) | Banner Brand "Reserved by you · since 10:31" / "Renews while this screen is open; expires 10:41 if not renewed." · chip "DEC-004 Reservation rules pending" · Outcome label + chips D4, DEC-005 · 4 outcome RadioCards (as desktop) · Follow-up box (Segmented Set now/Set later — **active segment has Elevation/1 shadow**; Date and time; Purpose) |
| Scroll cue | "↓ More below · Follow-up · Notes" |
| Sticky footer | top 656, h 124, px 16, py 12, gap 6: row gap 8: Ghost L "Keep reserved" + Primary L flex-1 "Save attempt"; Caption muted centred "Reservation is released only after the save succeeds." |

---

## SCR-CC-004 — Follow-ups & calendar

Frame: [D-L 285:13809](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=285-13809). State: List view, Open filter, reminder-failure banner.

New components:

| Component | Spec |
|---|---|
| Follow-up row | border-t `border/subtle`, py 10, gap 12, items-center: time 14/20 Medium primary **w 132** · text flex-1 (gap 2): business 14/20 Medium, purpose · agent Caption muted, chips row (gap 6) · Ghost S buttons (h 32, px 12, 12/16 Medium, icon 16): "Reschedule" (calendar), "Complete" (check), "Cancel" |
| Calendar/Day | card radius 12, gap 0; header px 16, py 12, gap 8: date 14/20 SemiBold + Badge brand "Today"; hour rows border-t `border/subtle`, px 16, py 8, gap 12: hour Caption muted w 40 + slot |
| Calendar/Event | bg `status/brand/bg`, radius 4, py 6 (pl ~10), flex-col gap 2, left accent 3 px `status/brand/solid`; time row (clock 12 + 12/16 Medium `status/brand/fg`); title 12/16 primary |

| Area | Spec |
|---|---|
| Nav | Follow-ups & Calendar active |
| Page header (gap 12) | H2 "Follow-ups & Calendar" / "Tue 20 Oct 2026 · your callback commitments · company timezone"; Segmented "List" (active) / "Week"; Primary M "Schedule follow-up" (plus icon) |
| Toolbar (gap 8) | Chip/Filter "Open (3)" active · "Completed" · "Cancelled" · "All" · spacer · Chip/Derived "Due today and Overdue are derived" · chip "No DEC ID Reminder timing · overdue threshold" |
| Banner warning | title "A reminder could not be sent"; body "The 13:45 email reminder for Nova Dental Clinic failed and will be retried. The follow-up itself is unaffected." (no action) |
| Body | gap 16: List column flex-1 (gap 8; viewport gap 12) + Today agenda **358 w** (gap 12) |
| Group "Overdue · 1" (Card/Section) | subtitle "Scheduled and past due (derived) · threshold pending"; policy row (pt 4, pb 8) chip "DEC-002 Alt B pending · callback + 48 h visibility"; row "Mon 19 Oct · 16:00" — Sunrise Bakery — "Ask the owner about a seasonal menu page · Maya Khoury" — Badge info "Scheduled" + Derived Amber "Overdue · 1 day" |
| Group "Due today · 2" | subtitle "Scheduled for today (derived, company timezone)"; "Today · 10:30" Olive & Thyme Café — "Owner back from supplier visit — discuss menu website · Maya Khoury" — Scheduled + Derived "Due now"; "Today · 14:00" Nova Dental Clinic — "Confirm decision on the patient booking page · Maya Khoury" — Scheduled + Derived "Due today" |
| Scroll cue | "↓ More below · Recently closed (2)" |
| Agenda | Calendar/Day "Tuesday 20 October" + Today; hours 09:00 (empty), 10:00 event "10:30–11:00" "Call back Olive & Thyme Café", 11:00, 12:00, 14:00 event "14:00–14:30" "Nova Dental Clinic — follow-up", 15:00. Caption muted "Owner sees every agent’s follow-ups with an agent filter. Reminders never change a follow-up (D5)." |

### SCR-CC-004 — Mobile Light

Frame: [M-L 285:15486](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=285-15486). Tab bar Follow-ups active.

| Area | Spec |
|---|---|
| Header | "Follow-ups" / "Tue 20 Oct · 3 open" · Avatar MK |
| Content (p 16, gap 12) | Segmented List/Week in 44 hit area (active has Elevation/1) · chip row (44 hit areas): "Open · 3" active, "Completed", "Cancelled" |
| List viewport (gap 8) | Banner Warning compact "Reminder not sent" / "Nova Dental Clinic 13:45 reminder failed; it will retry. Follow-up unaffected." · chips (wrap gap 6) "No DEC ID Overdue threshold · reminder timing", "DEC-002 Alt B pending · callback + 48 h visibility" · Overline muted "OVERDUE (DERIVED)" · List/Item alert-circle icon Sunrise Bakery / "Was due Mon 19 Oct 16:00" / **Badge danger "Overdue"** / chevron · Overline "DUE TODAY (DERIVED)" · Olive & Thyme Café / "Today 10:30 · supplier visit follow-up" / Badge warning "Due now" · Nova Dental Clinic / "Today 14:00 · booking page decision" / Badge info "14:00" |

---

## SCR-CC-005 — Contact reservation & concurrency block (preserved ID)

Frame: [D-L 314:13735](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=314-13735). State: Nova Dental Clinic selected; reserved by another agent (Omar Nassar). Same 3-column workspace as CC-002; queue identical, Nova row selected.

| Area | Spec |
|---|---|
| Detail column top | **Banner/Reservation "Reserved by other"** (warning): bg `status/warning/bg`, border `status/warning/border`, radius 6, px 16, py 12, gap 12; icon 20; title 14/20 Medium `status/warning/fg` "Reserved by Omar Nassar · since 10:24"; body 13/18 primary "Omar was the previous assignee and still has this business open. You can read it, but you cannot start a contact until the reservation ends." |
| Business card | "Nova Dental Clinic" / "Clinic · Assigned to you"; Row/Phone "+000 70 000 107" tag "Reception"; KV Website "novadental.example.com" |
| Call history | "2 attempts · reassigned today": item with **info dot** (`status/info/bg`) "Reassigned to Maya Khoury · Rana Haddad" 20 Oct, 09:15 "Previous assignee: Omar Nassar. Open follow-up transferred."; "Call attempt · Omar Nassar" 16 Oct, 11:45 "Office manager interested in a booking page; call back 20 Oct 14:00." Needs another call; 12 Oct, 10:20 "Reception busy; asked to call later." On hold; footnote as CC-002 |
| Business details | KV Category Clinic; Instagram @novadental.demo 2,140 followers; Row/Social (2nd platform); Extra notes "Reception answers 09:00–13:00; ask for the office manager."; Created by "Karim Saleh · 2 Oct 2026 09:14". Scroll cue "↓ Scroll for business details" |
| Contact panel | header "Contact unavailable" / "Reserved by another agent"; BannerReservation **Chip** (warning pill, px 8 py 2, icon + "Reserved by other"); Reservation details (Card/Inset p 16, KV gap 4): Holder "Omar Nassar (Call Center)"; Since "Tue 20 Oct · 10:24"; Lease ends "10:34 if not renewed (illustrative)"; Your assignment "Yours since 09:15"; Caption muted "No reservation was created for you. Wait and retry, or go back to the queue. Only the Owner can override a reservation (proposed)."; Inline policy DEC-004 "Lease length, idle rule and Owner override are undecided; times are illustrative."; Inline policy DEC-004 "Owner override · DEC-004 (Proposed). Confirm + reason; who may override is pending." |
| Panel footer | **Disabled** button full-width "Start Contact" (bg `surface/disabled`, text `text/disabled`, h 40); row gap 8: Ghost M "Back to queue", Secondary M "Retry"; Caption muted "Start Contact stays disabled while another user holds the reservation." |

### SCR-CC-005 — Mobile Light (reserved by another agent)

Frame: [M-L 261:16192](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=261-16192). Expired-lease variant: [M-L 261:16322](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=261-16322) (not extracted).

| Area | Spec |
|---|---|
| Header | Back 44 · "Nova Dental Clinic" / "Clinic · Needs another call" · Avatar MK; tab bar Queue active |
| Viewport (p 16, gap 10, h 596) | Banner/Reservation warning "Reserved by Omar Nassar · since 10:24" / "You can read this business but cannot start a contact until the reservation ends." · Card/Inset KV: Holder "Omar Nassar"; Since "10:24"; Lease ends "10:34 if not renewed" · Timeline/Item (no connector) "Call attempt · Omar Nassar" 16 Oct, 11:45 "Office manager interested in a booking page; call back 20 Oct 14:00." Needs another call · chip "DEC-004 Times illustrative" |
| Sticky footer | top 652, h 128, px 16, py 12, gap 8: Disabled L full-width "Start Contact" (phone icon, `surface/disabled`, `text/disabled`); row gap 8: Ghost L "Back to queue" + Secondary L flex-1 "Retry" (refresh icon 20) |

---

## SCR-CC-006 — Follow-up create / reschedule (drawer)

Frame: [D-L 315:13720](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=315-13720). State: scheduling a "Callback to be scheduled" item (create mode).

| Area | Spec |
|---|---|
| Background | CC-004 header (H2 "Follow-ups & Calendar", List/Week, "Schedule follow-up") + Group "Due today · 2" ("Scheduled for today (derived)", rows Olive & Thyme / Nova without actions) + Group "Callback to be scheduled · 1" / "Needs another call without a time yet (D2 marker)": row "Time not set" — Cedar Home Realty — "Client asked for a callback on 16 Oct" — Derived Amber "To schedule" |
| Drawer 480 | header "Schedule follow-up" / "Cedar Home Realty · Callback to be scheduled"; body p 24, **gap 16** |
| Body | Banner **Info compact** (bg `status/info/bg`, border `status/info/border`, radius 6, px 12, py 10, gap 8; title 14/20 Medium `status/info/fg` "Clears “Callback to be scheduled”"; body 13/18 primary "Saving schedules the callback the client asked for on 16 Oct (Needs another call).") · Input/Date "Date and time (company timezone) *" = "Wed 21 Oct 2026 · 09:30", helper "Must be in the future." · **Select/Person** "Responsible *": control with Avatar 24 "MK" + "Maya Khoury" + chevron; helper "Default: the assignee. Active Call Center agent or the Owner." · Input "Purpose" = "Call back after the open house" · Textarea "Note" (h 96) = "Agent prefers mornings; ask about property listing pages." · Inline policy "No DEC ID" — "Reminder lead time and escalation are undecided. A reminder failure never changes the follow-up." · Caption muted "No contact reservation is needed to schedule outside a call." |
| Footer | right group gap 8: Secondary "Cancel" · Primary "Save follow-up" |

### SCR-CC-006 — Mobile Light (create)

Frame: [M-L 315:15364](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=315-15364). Past-time error variant: [M-L 315:15441](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=315-15441) (not extracted). Full-screen page, no tab bar.

| Area | Spec |
|---|---|
| Header | Back 44 · "Schedule follow-up" / "Cedar Home Realty" · Avatar MK |
| Content (p 16, gap 12, h 696) | Same fields/copy as the desktop drawer, in order; Note textarea shows counter "56 / 1000" (no helper) |
| Sticky footer | top 752, h 92, px 16, py 12, gap 8: Ghost L "Cancel" + Primary L flex-1 "Save follow-up" |

---

## SCR-CC-007 — Opportunities & developer handoff

Frame: [D-L 316:13709](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=316-13709). State: 3 opportunities, Olive & Thyme selected with handoff panel open below.

| Area | Spec |
|---|---|
| Nav | Opportunities & Handoffs active |
| Header | H2 "Opportunities & Handoffs" / "Thu 22 Oct 2026 · accepted opportunities you created · not closed deals"; right Secondary M "Calling queue" |
| Filters (gap 8) | Chip/Filter "All (3)" active · "Developer not yet assigned (1)" · "Meeting not yet arranged (1)" · Chip/Derived "Both conditions are derived" |
| Policy chips | "DEC-005 Developer access before closure" · "DEC-017 Several deals per business" |
| Table | Opportunity 320 · Stage 200 · Handoff 140 · Developer 248 · First meeting 140 (right, sort) · actions 56 (kebab IconButton) |
| Rows | **Olive & Thyme Café (selected `surface/selected`)** / "Menu website · accepted 22 Oct 11:04" — "Accepted opportunity" — Badge warning "Not yet assigned" — "Not yet assigned" — "Not arranged" · Lumen Yoga Studio / "Class booking site · accepted 20 Oct" — Badge success "Developer assigned" — Avatar 24 neutral "LA" + "Lina Aoun" — "Fri 23 Oct 10:00" · Peak Fitness Gym / "Member app · accepted 19 Oct" — Developer assigned — Lina Aoun — "Mon 26 Oct 14:00" |
| Handoff panel (Card/Section) | "Handoff · Olive & Thyme Café" / "Developer not yet assigned (E3) · meeting not yet arranged (derived)"; action Link "Edit handoff context". Columns gap 24: Context (KV gap 4): Client needs "Menu website with table booking"; Service interest "Website + booking"; Call notes "Owner wants an online menu and table booking before the second branch opens."; Created by "Maya Khoury · 22 Oct 11:04 (call save)"; Commercial stage "Accepted opportunity — not a closed deal". Developer column **400 w**, gap 12: Select/Person "Developer" placeholder "Choose a developer", helper "Active developers only. The developer gets a handoff notification."; actions gap 8: Primary M "Assign developer", Secondary M "Schedule first meeting"; Inline policy DEC-005 "Whether the developer can open this opportunity before closure is undecided." |

---

## SCR-CC-008 — Do-not-call list & reopening

Frame: [D-L 316:15211](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=316-15211). State: Call Center view-only, one Rejected business selected.

| Area | Spec |
|---|---|
| Nav | Do-not-call List active |
| Header | H2 "Do-not-call list" / "Rejected businesses · excluded from calling, assignment and new follow-ups · view only"; Secondary M "Calling queue" |
| Banner Info (full) | title "Reopening is controlled"; body "You can view this list but cannot reopen a business. Who may reopen, and to which outcome, is undecided (DEC-016)." |
| Filters (gap 8) | "Rejected (1)" active · "Reopened" · chips "DEC-016 Reopening authority", "D4 Open follow-ups on Rejected" |
| Table | Business 320 · Phone 200 · Status 140 · Assigned to 248 (Avatar cell) · Rejected 140 (right, sort) · actions 56. Row (selected): Harbor Auto Care / "Services · rejected by Maya Khoury" — "+000 70 000 109" — **Badge danger "Do not call"** — Maya Khoury — "15 Oct 16:22" |
| Detail card | "Harbor Auto Care" / "Do not call · Start Contact disabled"; action Link "Request correction". Columns gap 24: KV Rejected by "Maya Khoury · 15 Oct 2026 16:22"; Reason "Not interested — asked not to be called again"; Open follow-ups "None"; Call history "2 attempts · kept". Actions **480 w**, gap 10: buttons gap 8: Secondary "Open business", Disabled "Start Contact", Disabled-secondary "Reopen…" (bg `surface/disabled`, border `border/default`); Caption muted "Reopen not permitted for your role. If DEC-016 adopts request-and-approve, a request flow is needed (B3-Q09)."; Inline policy DEC-016 "Who may reopen a Rejected business, and to which outcome, is undecided." |
