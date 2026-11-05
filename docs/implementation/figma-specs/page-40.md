# Page 40 — Auth + Shared employee screens (Figma specs)

File `GNrhb3DWa6mIhEX6F4Nmvw`. Link pattern: `https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=<id with - >`. Values are Light mode; tokens are the Figma semantic names (CSS `--<name>` in `globals.css`, Tailwind keys per `design-system-code.md`). Dark = NAVY in code by directive (not compared).

## Shared desktop shell (applies to every Desktop frame on pages 40–45)

Extracted from SCR-SHR-001 D-L `303:10513` (Shell instance `303:10514`).

| Part | Spec |
|---|---|
| Frame | 1440 × 900, bg `surface/page` |
| Sidebar (Nav/Sidebar) | 240 w, full height, bg `surface/brand` #0B1A35, flex-col |
| Sidebar header | px 20, py 16; Brand/Logo On-brand, 132 × 32 (reversed lockup, object-contain) |
| Nav list | px 12, py 4, gap 2, flex-1 |
| Nav/SectionLabel | 216 w, pt 12, pb 4, px 12; Overline 11/16 SemiBold, tracking 0.66px (6 %), UPPERCASE, `text/on-brand-muted` |
| Nav/Item | 216 w, min-h 36, px 12, py 8, gap 10, radius md 6; icon 20 (`icon/on-brand`); label Label 14/20 Medium `text/on-brand-muted`, ellipsis |
| Nav/Item active | bg `surface/brand-active` #17305A; label `text/on-brand` white; icon `icon/on-brand-active`; Indicator: absolute left 0, top/bottom 6, w 3, radius full, `brand/accent` |
| Nav count badge | bg `surface/brand-active`, min-w 20, px 6, py 2, radius full; 12/16 Medium white |
| Sidebar bottom | border-t 1 `border/brand`, pt 12, pb 16, px 12; holds "My Profile" item |
| TopBar (Nav/TopBar) | left 240, w 1200, h 64, bg `surface/default`, border-b 1 `border/default`, px 24, gap 16, items-center |
| TopBar search (Input/Search M) | 360 × 40, radius md 6, border 1 `border/input`, px 12, gap 8; icon 16 `icon/muted`; placeholder Body 14/20 `text/placeholder` (role copy, e.g. "Search assigned businesses") |
| Attendance pill (checked in) | bg `status/success/bg`, border `status/success/border`, radius full, px 10, py 4, gap 6; dot 8 `status/success/solid`; 14/20 Medium `status/success/fg` "Checked in · 08:58" (links to attendance) |
| Notifications | IconButton 40 × 40, bell 20 + unread dot `status/danger/solid` |
| Divider | 1 × 24 `border/default` |
| User | gap 10: Avatar 32 round `status/brand/bg` + initials 12/16 Medium `status/brand/fg`; name Label 14/20 `text/primary`; role Caption 12/16 `text/muted`; chevron-down 16 |
| Content area | left 240, top 64, 1200 × 836, p 24, flex-col gap 16 |
| Page header | Title H1 24/32 SemiBold tracking -0.12px `text/primary`; subtitle Body 14/20 `text/secondary`; gap 4 |

Common component specs seen on page 40 (reuse everywhere):

| Component | Spec |
|---|---|
| Card/Section | bg `surface/default`, border 1 `border/default`, radius xl 12, p 20, gap 16; header title H3 16/24 SemiBold, subtitle Body Small 13/18 `text/secondary`, gap 2; action = Link 12/16 Medium `text/link` (mobile: "Action touch" 44 h) |
| Badge/Status (Small) | radius full, px 8, py 2, gap 6, border 1; label 12/16 Medium; optional dot 6. Tones: success/warning/info/neutral/danger/brand use `status/<tone>/bg|border|fg` |
| Policy chip (Notice/Policy pending, Chip) | bg `status/policy/bg`, border `status/policy/border`, radius full, px 8, py 2, gap 4; hourglass icon 14; "DEC-xxx" 12/16 Medium + "Policy pending" 12/16 Regular, `status/policy/fg` |
| Policy notice (Inline) | same colours, radius sm 4, px 10, py 6, gap 6; lead = icon 16 + DEC 12/16 Medium; body Body Small 13/18 |
| Chip/Derived | transparent, border 1 **dashed** `status/neutral/fg`, radius full, px 8, py 2; "Derived" 12/16 Medium |
| Progress/Bar | flex-col gap 6; labels row: label 13/18 `text/secondary` (flex-1, ellipsis) + value 12/16 Medium `text/primary`; track h 8 radius full `surface/sunken`; fill `brand/accent` |
| List/Item (nav row) | bg `surface/default`, border-b 1 `border/subtle`, px 16, py 12, gap 12; leading 36 round `brand/accent-subtle` with icon 20 `icon/accent`; title 14/20 Medium; meta Caption 12/16 `text/muted`; trailing Badge + chevron-right 16 |
| Button Secondary L | h 48 (min 44), px 20, radius md 6, bg `surface/default`, border 1 `border/strong`; Label 14/20 Medium `text/primary` |

---

## SCR-SHR-001 — My Day (role home) · Call Center variant

Frame: [D-L 303:10513](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=303-10513). Status shown: checked in, office check passed.

| Area | Spec |
|---|---|
| Sidebar items | MY WORK: My Day (active), My Attendance · CALLING: Calling Queue (count 7), Follow-ups & Calendar, Opportunities & Handoffs, Do-not-call List · bottom: My Profile |
| Header | "My Day" / "Tuesday 20 October 2026 · Call Center"; user "Maya Khoury" / "Call Center" |
| Layout | Columns row gap 24: Column A fixed 368 w (gap 16); Column B flex-1 (gap 16) |
| Attendance panel (A) | Card: bg default, border default, radius 12, **p 16**, gap 16. Header: "Attendance" H3 + Badge success with dot "Checked in". Timer block centered, gap 2: "Elapsed today" Caption muted; "05:34:14" Number XL 40/48 SemiBold tracking -0.4px, tabular; "Since 08:58 · today" Body Small secondary. Progress "Toward 9 h workday" / "5h 34m of 9h" (60 %). Verification row: bg `status/success/bg`, radius md 6, px 12, py 8, gap 10; check-circle 20 + "Office check passed" 14/20 Medium success-fg + "08:58 · at check-in" Caption secondary. Action: Secondary L full-width "Check out". Chip DEC-009 Policy pending |
| Day rules (A) | bg `surface/subtle`, border 1 `border/subtle`, radius lg 8, p 16, gap 8. Row: clock 16 + "Check-in 08:58 · On time" 14/20 Medium + Chip/Derived. Inline policy "DEC-007/008" — "Pending: schedule start & grace. The 9 h workday is confirmed; “On time” is derived and illustrative." Caption muted "At checkout you will add a work summary." Chips DEC-012, DEC-022 (wrap, gap 8) |
| Today's targets (B) | Card/Section "Today’s targets" / "Set by the Owner", no action. Chips DEC-020, DEC-025. Progress "Call attempts" "7 of 20" (35 %); "Follow-ups done" "2 of 5" (40 %) |
| My work list (B) | Card/Section "My work list" / "Showing 5 of 6 items · works without check-in", action link "Open queue" (→ Calling queue). 5 List/Items: Peak Fitness Gym — "Follow-up · today 15:00 · Gym" — calendar icon — Badge warning "Due"; Bloom Florist — "New · Shop · not called yet" — phone — neutral "To call"; Olive & Thyme Café — "Needs another call · last attempt 19 Oct" — phone — info "Retry"; Nova Dental Clinic — "Follow-up · Wed 21 Oct 10:30" — calendar — neutral "Next"; Sunrise Bakery — "New · Shop · not called yet" — phone — neutral "To call". Footer chip DEC-021 |
| Links | Rows → SCR-CC-002 Contact workspace; bell → SCR-SHR-007 |

### SCR-SHR-001 — Mobile Light

Frame: [M-L 303:11195](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=303-11195).

**Shared mobile shell** (applies to every Mobile frame):

| Part | Spec |
|---|---|
| Frame | 390 × 844, bg `surface/page` |
| Shell/Mobile/Header | h 56, bg `surface/default`, border-b 1 `border/default`, px 16, gap 8. Title H3 16/24 SemiBold; subtitle Caption 12/16 `text/muted`; right: Avatar 32 (or 44 IconButton Touch for back/actions) |
| Content | top 56, h 724, p 16, flex-col **gap 12**, vertical scroll |
| Shell/Mobile/TabBar | top 780, h 64, bg `surface/default`, border-t 1 `border/default`, py 4; 4 equal tabs, each h 56, flex-col gap 2, centered; icon 24; label 12/16 Medium. Active: label `status/brand/fg` #0A6669 + top Indicator 32 × 3 radius full `brand/accent` centred at top 0. Inactive label `text/muted` |
| Tabs (Call Center) | My Day (clock) · Queue (phone) → CC-001 M · Follow-ups (calendar) → CC-004 M · More (menu) |

| Area | Spec |
|---|---|
| Header | "My Day" / "Tue 20 Oct 2026", avatar MK |
| Order | Attendance panel → Day rules → My work list → Today’s targets (targets moves to the end on mobile) |
| Attendance panel / Day rules | Identical to desktop (p 16, same copy), full width |
| My work list | Subtitle "Showing 4 of 6 items · works without check-in"; 4 rows (Peak Fitness Gym, Bloom Florist, Olive & Thyme Café, Nova Dental Clinic); **no chevron** on mobile rows; rows → CC-002 Mobile |
| Today’s targets | same as desktop |

---

## SCR-SHR-002 — Check-in flow

Frame: [D-L 186:10469](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=186-10469). State shown: check-in success dialog over My Day (other states — locating, office-check failure, offline — live in sibling frames on page 40, see the register).

| Area | Spec |
|---|---|
| Background | My Day shell (Call Center), Column A = Attendance panel only; Column B = My work list ("Showing 4 of 6 items · works without check-in", 4 rows) |
| Overlay/Scrim | full 1440 × 900, `overlay/scrim` rgba(7,18,38,.56) |
| Dialog (md 520) | left 460, top 221, w 520, bg `surface/raised`, border 1 `border/subtle`, radius 2xl 16, p 24, gap 16, shadow Elevation/3 (0 16 24 -4 #0B1A35 @14 %, 0 6 8 -4 @6 %) |
| Dialog header | gap 12; title "Check in" H2 20/28 SemiBold tracking -0.1px; subtitle "Tuesday 20 October 2026" Body 14/20 secondary; gap 4; Close = IconButton Ghost Touch 44 × 44 (x icon) |
| Content (gap 12) | 1) Verification row (success bg, radius 6, px 12, py 8): check-circle 20 + "Checked in at 08:58" 14/20 Medium success-fg + "Office check passed" Caption secondary. 2) Punctuality box (`surface/subtle`, border `border/subtle`, radius 8, p 16, inner gap 6): clock 16 + "Check-in 08:58" 14/20 Medium + Chip/Derived "On time"; Caption secondary "Derived from the schedule and grace period. Possible results: On time · Late · Unclassified (no schedule) · Non-working day." 3) Inline policy "DEC-007/008" — "Schedule start and grace are pending; the 9 h workday is confirmed." 4) Chips DEC-009, DEC-022, R-11 (wrap, gap 8) |
| Footer | justify-end, gap 8: Secondary M (h 40, px 16, radius 6, border `border/strong`) "Close"; Primary M (h 40, px 16, bg `brand/primary` #17305A, text `text/on-primary`) "Open my work list" |
| TopBar pill | "Checked in · 08:58" (success) |

### SCR-SHR-002 — Mobile Light

Frame: [M-L 186:11076](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=186-11076). Full-screen task page (no tab bar).

| Area | Spec |
|---|---|
| Header | h 56, px 16, gap 8: Back IconButton Touch 44 (chevron-left) · "Check in" H3 / "Tue 20 Oct 2026" Caption muted · Avatar 32 "MK" |
| Content | top 56, h 660, p 16, gap 12: Verification (same as desktop) → Punctuality box → Inline policy DEC-007/008 → chips DEC-009, DEC-022, R-11 |
| Sticky footer | top 716, h 128, bg `surface/default`, border-t `border/default`, px 16, py 12, gap 8: Primary L full-width (h 48, min 44, px 20, radius 6) "Open my work list"; Ghost L full-width h 48 "Back to My Day" (`text/primary`) |

---

## SCR-SHR-003 — Checkout + work summary

Frame: [D-L 187:10469](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=187-10469). State shown: checkout drawer open, summary textarea focused.

| Area | Spec |
|---|---|
| Background | Same as SHR-002 (My Day, Attendance panel + My work list 4 rows) under scrim |
| Drawer (480) | right-anchored: left 960, top 0, 480 × 900, bg `surface/raised`, shadow Elevation/3, no radius |
| Drawer header | border-b `border/default`, px 24, py 20, gap 12; "Check out" H2 20/28 SemiBold; subtitle Body Small 13/18 secondary "Tue 20 Oct 2026 · checked in 08:58"; Close IconButton Touch 44 |
| Drawer content | p 24, gap 12, flex-1 |
| Today summary | `surface/subtle` box, border `border/subtle`, radius 8, p 16, inner gap 8: "Checked in 08:58 · now 18:06" Body Small secondary; Progress "Toward 9 h workday" / "9h 08m of 9h" (100 %) |
| Work summary (Textarea) | label "Work summary" Label 14/20 Medium; control h 96, radius 6, px 12, py 10, bg default; **focus = 2 px `focus-ring` #0E9CA0 border (inside)**; value Body 14/20 primary "Called 18 businesses; booked 2 meetings for Lina Aoun (Peak Fitness Gym, Lumen Yoga Studio); 3 follow-ups rescheduled."; helper row muted: "Shown to the Owner in reports." 13/18 + counter "118 / 1000" 12/16; gap 6 |
| Chips/notes | DEC-012 chip; Caption muted "The office check runs when you press Check out."; chips DEC-009, DEC-026 |
| Drawer footer | border-t `border/default`, px 24, py 16, justify-between: Ghost M "Cancel" (left); Primary M "Check out" (right) |

### SCR-SHR-003 — Mobile Light

Frame: [M-L 187:11125](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=187-11125). Full-screen task page (drawer becomes a page).

| Area | Spec |
|---|---|
| Header | Back 44 · "Check out" / "Tue 20 Oct 2026" · Avatar MK |
| Content (p 16, gap 12, h 660) | Today summary box → Textarea "Work summary" (focus, same copy, "118 / 1000") → DEC-012 chip → Caption "The office check runs when you press Check out." → chips DEC-009, DEC-026 |
| Sticky footer (h 128, px 16, py 12, gap 8, border-t) | Primary L full-width "Check out"; Ghost L full-width "Cancel" |

---

## SCR-SHR-004 — My Attendance history

Frame: [D-L 188:10468](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=188-10468). State: October 2026 filter active, 6 sessions, today open.

Additional shared components defined here:

| Component | Spec |
|---|---|
| Chip/Filter | h 32, px 12, gap 6, radius full, border 1. Default: bg `surface/default`, border `border/default`, label 12/16 Medium `text/primary` + chevron-down 14. Active: bg `surface/selected` #E6F7F7, border `border/selected` #0B8084, label `status/brand/fg`, trailing "x" remove 14 |
| Chip/Derived Amber | dashed border `status/warning/fg`, label `status/warning/fg` |
| Table container | bg `surface/default`, border 1 `border/default`, radius 12, overflow clip |
| Table/HeaderCell | h 40, px 12, gap 4, bg `surface/sunken`; Overline 11/16 SemiBold UPPERCASE tracking 0.66px `text/muted`; sort icon arrow-down 14 (Descending); Right-aligned variant for numbers |
| Table/Row + Cell | row border-b 1 `border/subtle`, bg default; cell h 56, px 12, gap 8. Text: Body 14/20 primary, ellipsis. Text-with-meta: 14/20 Medium + Caption 12/16 muted. Number: 14/20 Medium right-aligned (tabular) |
| Link cell | Link M: 14/20 Medium `text/link`, px 2, radius xs |
| Stat tile (Card/Inset) | flex-1, bg `surface/subtle`, border `border/subtle`, radius 8, p 16; label Caption muted; value H3 16/24 SemiBold primary; gap 2 |

| Area | Spec |
|---|---|
| Nav | My Attendance active |
| Page header (gap 16) | "My Attendance" / "Your sessions, hours and punctuality"; right: filter chips (gap 8) "This week" (default), "October 2026" (active), "Custom range" (default) |
| Policy chips | DEC-011, DEC-026, DEC-007, DEC-022 |
| Stats row (gap 16, 4 equal) | Closed sessions "6" · Hours (closed) "54h 27m" · Average day "9h 04m · vs 9 h" · Open problems "0" |
| Sessions table | Column widths: Date 180 (sort ↓) · Check-in 110 · Check-out 180 · Duration 120 (right) · Punctuality 160 · Status 232 · (action) 170. Rows: Tue 20 Oct/Today · 08:58 · Not yet · 5h 34m · Derived "On time" · info "Open" · View; Mon 19 Oct/Call Center · 08:52 · 18:01 · 9h 09m · On time · neutral "Closed"; Fri 16 Oct · 09:14 · 18:20 · 9h 06m · **Amber Derived "Late"** · Closed; Thu 15 Oct · 08:55 · 17:40 · 8h 45m · On time · Closed; Wed 14 Oct · 08:50 · 18:00 · 9h 10m; Tue 13 Oct · 08:57 · 18:05 · 9h 08m. Status badges have no dot |

### SCR-SHR-004 — Mobile Light

Frame: [M-L 188:11151](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=188-11151). Tab bar: **More** active.

| Area | Spec |
|---|---|
| Header | "My Attendance" / "October 2026" · Avatar MK |
| Filters | Chip/Filter "This week" (default), "October 2026" (active); wrap gap 8 (no Custom range on mobile) |
| Stats (Card/Inset, subtle bg, p 16) | List/KeyValue rows (py 6, gap 12): key Body Small 13/18 secondary **w 112**; value Body 14/20 primary. "Hours (closed)" 54h 27m; "Average day" 9h 04m · vs 9 h (inner gap 4) |
| Chips | DEC-011, DEC-026 |
| Sessions (Card/Surface p 20) | List/Items with leading clock icon in 36 accent-subtle circle; title "Tue 20 Oct · On time", meta "08:58 – now · 5h 34m", badge info "Open"; Mon 19 Oct · On time — "08:52 – 18:01 · 9h 09m" — Closed; Fri 16 Oct · Late — "09:14 – 18:20 · 9h 06m"; Thu 15 Oct · On time — "08:55 – 17:40 · 8h 45m"; Wed 14 Oct · On time — "08:50 – 18:00 · 9h 10m". No chevrons |
| Footnote | Caption muted "On time / Late are derived from check-in; schedule start and grace are pending (DEC-007/008)." |

---

## SCR-SHR-005 — Attendance correction request (drawer)

Frame: [D-L 118:56264](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=118-56264). State: forgotten-checkout day; drawer open; proposed check-out focused. **Whole screen is DEC-011 Alt B only — build behind a flag, select none.**

New components here:

| Component | Spec |
|---|---|
| TopBar pill (not checked in) | neutral: bg `status/neutral/bg`, border `status/neutral/border`, dot `status/neutral/solid`, "Not checked in" 14/20 Medium `status/neutral/fg` |
| Banner (Warning) | bg `status/warning/bg`, border `status/warning/border`, radius 6, px 16, py 12, gap 12; alert-triangle 20; title 14/20 Medium `status/warning/fg`; body Body Small 13/18 `text/primary`; optional action link + close 32 |
| Badge/Flag (Warning) | bg `status/warning/bg`, **radius sm 4 (not pill)**, no border, px 8, py 2, gap 4; flag icon 14; 12/16 Medium `status/warning/fg` |
| Notice/Policy pending (Block) | radius md 6, px 16, py 12, flex-col gap 6; head: icon 16 + DEC 12/16 Medium + "Policy pending" 14/20 Medium; body 13/18; policy colours |
| List/KeyValue | row py 6, gap 12; key 13/18 `text/secondary` w 112; value 14/20 `text/primary` (muted for "Not recorded") |
| Input/Date (Time) | label row Label 14/20; control h 40, radius 6, border 1 `border/input`, px 12, gap 8, value 14/20 + trailing clock 16; Focus = 2 px `focus-ring` border |

| Area | Spec |
|---|---|
| Background page | My Attendance (as SHR-004) with: stat "Open problems" = 1; warning Banner "Mon 19 Oct has no checkout" / "The session is still open, so check-in is blocked today. It is never closed automatically." (no action/close); inline policy DEC-011 "“Request correction” exists only under Alt B (employee request). Under Alt A the Owner corrects it. Not selected."; table widths Date 180 · Check-in 110 · Check-out 140 · Duration 120 · Punctuality 180 · Status 232 · action 190. Row Tue 20 Oct: — · — · — · "Not checked in" · warning badge "Check-in blocked" · View. Row Mon 19 Oct: 08:47 · "Not recorded" · — · On time · Badge/Flag "Forgotten checkout" · link "Request correction". Others as SHR-004 |
| Drawer 480 | Header "Request attendance correction" / "Mon 19 Oct 2026 · session without checkout"; content p 24 gap 12 |
| Drawer content | 1) Policy Block DEC-011 "This screen exists only if DEC-011 Alt B (employee request) is selected. Not selected." 2) Original record (subtle box p 16, gap 2): Session "Mon 19 Oct 2026"; Recorded check-in "08:47"; Recorded check-out "Not recorded" (muted). 3) Time input "Proposed check-in" 08:47. 4) "Proposed check-out" 18:05 (focus). 5) Textarea "Reason" — "Forgot to check out; left the office at 18:05 after the team call." helper "The Owner sees this with your request." counter "66 / 500". 6) Caption muted "The original record is kept beside any correction." 7) Inline policy F-01 "Whether a pending request blocks your next check-in is open." |
| Footer | Ghost "Cancel" left; Primary "Submit request" right |

### SCR-SHR-005 — Mobile Light

Frame: [M-L 118:57215](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=118-57215). Full-screen task page.

| Area | Spec |
|---|---|
| Header | Back 44 · "Request correction" / "Mon 19 Oct 2026" · Avatar MK |
| Content (p 16, gap 12, scroll) | Same order and copy as the desktop drawer: Policy Block DEC-011 → Original record (KV key w 112) → Proposed check-in 08:47 → Proposed check-out 18:05 (focus) → Reason textarea (66 / 500) → caption → Inline policy F-01 |
| Sticky footer (h 128) | Primary L "Submit request"; Ghost L "Cancel" |

---

## SCR-SHR-006 — My Profile

Frame: [D-L 189:10468](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=189-10468). State: editing phone (focus), managed fields disabled.

New components here:

| Component | Spec |
|---|---|
| Input Disabled | label `text/disabled` #A1ACB9; control h 40 bg `surface/disabled` #EDF0F4, border 1 `border/default`, value `text/disabled`; helper 13/18 muted explains why |
| Input/Phone (Focus) | control h 40, 2 px `focus-ring`, px 12, gap 8: country "+000" 14/20 + chevron-down 16 · separator 1 × 20 `border/default` · number 14/20 |
| Input/Password | control h 40, border `border/input`: dots value + eye icon 16 + "Show" 12/16 Medium `text/link` |
| Radio | 16 circle, border 1 `border/input` (unselected) / filled teal dot (selected); label Body 14/20; gap 8 |
| Button Secondary S | h 32, px 12, gap 6, radius 6, border `border/strong`; icon 16; 12/16 Medium |
| Notice Implementation decision (Inline) | bg `status/decision/bg` #EEF2F8, border `status/decision/border` #8399BF, radius 4, px 10, py 6; lead hourglass 16 + "Impl. decision" 12/16 Medium; body 13/18; all `status/decision/fg` #1F3D6E |
| Avatar Large | 40 round, `status/brand/bg`, initials 14/20 Medium `status/brand/fg` |

| Area | Spec |
|---|---|
| Nav | My Profile (sidebar bottom) active |
| Header | "My Profile" / "Your account, password and preferences" |
| Layout | Columns gap 24: Column A **564 w**; Column B flex-1, gap 16 |
| Personal details (A) | Card/Section "Personal details" / "Some fields are managed by the Owner/Admin"; content gap **14**. Identity row (gap 12): Avatar L "MK" · "Maya Khoury" H3 + "maya.khoury@udigity.example · Call Center" Body Small secondary · Secondary S "Change photo" (user icon). Row gap 16: disabled "Full name" = Maya Khoury, disabled "Role" = Call Center (both helper "Managed by the Owner/Admin"). Disabled "Work email". Phone "Mobile phone" (+000 / 70 000 105, focus) helper "Used by your team to reach you." Inline policy OQ-13 "Which fields you can edit yourself is not decided (proposed: photo and phone). No DEC ID." Actions right-aligned gap 8: Ghost "Discard", Primary "Save changes" |
| Password (B) | Card/Section "Password" (no subtitle): 3 password inputs "Current password", "New password", "Confirm new password"; Secondary M full-width "Change password" with lock icon 20; Impl. decision "Proposed: a password change signs out your other sessions; password rules are an implementation decision." |
| Appearance & sessions (B) | Card/Section "Appearance & sessions" / "Theme is a personal preference"; Radios (gap 24) "Light" (selected), "Dark" — **code adds "System" via `ThemeSwitcher` (Light/Dark/System)**; Secondary M "Sign out" (log-out icon) + Ghost "Sign out of all sessions" (gap 8); Impl. decision "Offering “Sign out of all sessions” to employees is an implementation decision." |

### SCR-SHR-006 — Mobile Light

Frame: [M-L 189:11118](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=189-11118). Tab bar: More active.

| Area | Spec |
|---|---|
| Header | "My Profile" (no subtitle) · Avatar MK |
| Card 1 (Card/Surface p 20, gap 16) | Identity row (Avatar L + name H3 + email/role 13/18) — no Change photo button; disabled "Work email" + helper; Phone input (default state, +000 / 70 000 105) + helper; Inline policy OQ-13 "Which fields you can edit is not decided (proposed: photo and phone)."; Primary L full-width "Save changes" |
| Card 2 "Account" (Card/Surface) | List/Items with chevron: lock icon "Change password" / "Proposed · ends other sessions"; settings icon "Appearance" / "Light" |
| Bottom | Secondary L full-width "Sign out" (log-out icon 20) |

---

## SCR-AUTH-001 — Login

Frame: [D-L 169:10438](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=169-10438). State: password focused. No app shell.

| Area | Spec |
|---|---|
| Layout | 1440 × 900 flex row: Brand panel 600 w + Panel flex-1 (bg `surface/page`) |
| Brand panel | bg `surface/brand` #0B1A35, p 64, flex-col justify-between. Top: Brand/Logo On-brand Medium 231 × 46. Middle (gap 16): "Udigity Management System" **Display 32/40 Bold tracking -0.32px** `text/on-brand`; "Attendance, businesses, calls and projects in one place." Body `text/on-brand-muted`. Bottom (gap 12): accent rule 48 × 3 `brand/accent`; Caption on-brand-muted "Internal system · authorised Udigity staff only" |
| Panel | centred column, gap 16 |
| Auth card | Card/Surface **440 w**, p 20, radius 12, border default; content gap 16 |
| Card content | "Sign in" H2 20/28 SemiBold tracking -0.1px · "Use your Udigity work email and password." Body secondary · Input "Email" with mail icon 16, placeholder "name@udigity.example" · Input/Password "Password" (focus 2 px teal, eye + "Show") · Forgot row right-aligned: Link S "Forgot password?" 12/16 Medium `text/link`, hit area min-h 44 · Primary L full-width (h 48) "Sign in" · Divider 1 px `border/default` · note row (gap 8): shield 20 + "Owner accounts confirm a second step (2FA) after signing in." Body Small secondary · Inline policy R-11 "What an Owner may do before 2FA is complete is undecided." |
| Footer text | Caption muted "© 2026 Udigity · Need access? Ask the Owner/Admin." |

### SCR-AUTH-001 — Mobile Light

Frame: [M-L 169:10607](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=169-10607). **Signed-out mobile layout** (reused by AUTH-002/004 mobile).

| Area | Spec |
|---|---|
| Layout | 390 × 844, bg `surface/page`, flex-col gap 20, pt 40, pb 24, px 16; no brand panel, no header/tab bar |
| Logo | Brand/Logo **Default (navy) Small** 132 × 32, left-aligned |
| Auth card | full width, same content/copy as desktop |
| Footer | Caption muted, **centred**: "© 2026 Udigity · Need access? Ask the Owner/Admin." |

---

## SCR-AUTH-002 — Owner 2FA challenge

Frame: [D-L 169:11080](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=169-11080). State: code field focused. Same split layout as AUTH-001 (brand panel 600 + card 440).

| Area | Spec |
|---|---|
| Session row | Badge warning Small with dot: "Pending 2FA · admin locked" |
| Title / body | "Confirm it’s you" H2; "Enter the code from your second factor for rana.haddad@udigity.example." Body secondary |
| Verification code (Input/Number) | label "Verification code"; control h 40 focus 2 px teal, value "000 000" **right-aligned** 14/20; helper "Enter the current code. It changes regularly." |
| Primary | L full-width "Verify" (→ Owner dashboard) |
| Secondary row | justify-between: Link S "Lost your second factor?" (hit min-h 44) · Ghost M "Sign out" with log-out icon 20 |
| Policy Block R-11 | "Not selected. R11-a: nothing is available until 2FA is complete. R11-b: only admin actions wait; My Day check-in is allowed." |
| Impl. decision inline | "2FA method is an implementation decision; the code entry is illustrative." |
| Footer | "© 2026 Udigity · Need access? Ask the Owner/Admin." |

### SCR-AUTH-002 — Mobile Light

Frame: [M-L 169:11239](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=169-11239). Signed-out mobile layout (see AUTH-001 M); card content identical to desktop. "Verify" links to SCR-OWN-004 Mobile (Owner mobile home = attendance monitor).

---

## SCR-AUTH-003 — Owner 2FA enrollment & recovery

Frame: [D-L 170:81934](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=170-81934). State: step 2 of 3. Split layout as AUTH-001. Desktop only (no mobile frame).

| Area | Spec |
|---|---|
| Session row | Badge warning w/ dot "Pending 2FA enrollment · admin locked" |
| Title / body | "Set up your second step" H2; "Owner accounts must use 2FA before any admin access. This step is required." |
| Steps (flex-col gap 6; row gap 8) | Step 1: Badge success "Done" + "Connect your second factor" 13/18 secondary · Step 2 (current): Badge **brand** (`status/brand/bg`, border `status/brand/border` #52C9CB, fg `status/brand/fg`) "Step 2" + "Confirm a code" **14/20 Medium primary** · Step 3: Badge neutral "Step 3" + "Save recovery codes" 13/18 secondary |
| Factor setup | Placeholder/Box full width h 120: dashed `border/strong`, bg `surface/subtle`, radius 6; "Factor setup area" 14/20 Medium secondary + "Depends on the 2FA method (implementation decision)" Caption muted |
| Verification code | as AUTH-002, helper "Enter the current code from your new factor." |
| Primary | L full-width "Confirm code" |
| Secondary row | Link S "Need help?" · Ghost "Sign out" (log-out) |
| Notices | Impl. decision "2FA method and recovery channel are implementation decisions; the layout is method-neutral." · Policy inline R-11 "What a pending-2FA Owner may do meanwhile is undecided." |

---

## SCR-AUTH-004 — Forgot / reset password

Frame: [D-L 170:82569](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=170-82569). State: request link, email focused. Split layout as AUTH-001.

| Area | Spec |
|---|---|
| Title / body | "Reset your password" H2; "Enter your work email. If an active account matches, we’ll email you a reset link." (non-enumerating copy — keep) |
| Email | Input with mail icon, focus 2 px teal, value "maya.khoury@udigity.example" |
| Primary | L full-width "Send reset link" |
| Back row | Link S "Back to sign in" + chevron-left 16 (as trailing icon in Figma), hit min-h 44, left-aligned |
| Footer | "© 2026 Udigity · Need access? Ask the Owner/Admin." |

### SCR-AUTH-004 — Mobile Light

Frame: [M-L 170:82675](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=170-82675). Signed-out mobile layout (AUTH-001 M); card content identical to desktop.
