# Page 42 — Data Entry + shared business screens (Figma specs)

File `GNrhb3DWa6mIhEX6F4Nmvw`. Light values. Shared shell, Card/Section, Badge, Policy chip, Table, Chip/Filter, Input specs are defined once in [page-40.md](page-40.md) — not repeated here.

## Data Entry shell (differences from the Call Center shell)

| Part | Spec |
|---|---|
| Sidebar sections | MY WORK: My Day, My Attendance · BUSINESSES: Businesses (building icon), Add Business (plus), Correction Requests (edit), Categories (list; carries DEC-015) · bottom: My Profile |
| TopBar search placeholder | "Search businesses, phones, handles" (clickable → SCR-SHR-010) |
| User | "Karim Saleh" / "Data Entry", avatar "KS"; pill "Checked in · 08:51" |
| Content padding | **pt 24, px 24, pb 16**, gap 16 |

New component on this page:

| Component | Spec |
|---|---|
| Select (no label) | control h 40, radius 6, border 1 `border/input`, px 12, gap 8; value Body 14/20 primary, ellipsis; chevron-down 16 |
| Chip/Filter Disabled | bg `surface/disabled`, border `border/default`, label + chevron `text/disabled` |
| Badge/Flag Neutral | bg `status/neutral/bg`, radius 4, flag icon 14, 12/16 Medium `status/neutral/fg` |
| Table/Pagination | bg default, px 12, py 8, gap 12: range Body Small 13/18 secondary · spacer · Prev 32 IconButton (Secondary) · pages (gap 4) 32 × 32 radius 6: current bg `brand/primary` + 12/16 Medium `text/on-primary`; others 12/16 Medium primary, transparent; "…" gap · Next 32 · per-page 13/18 secondary |
| Button Primary M + icon | h 40, px 16, gap 8, plus icon 20 |

---

## SCR-DE-001 — Business directory

Frame: [D-L 165:81145](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=165-81145). State: default list, page 1.

| Area | Spec |
|---|---|
| Nav | Businesses active |
| Page header (gap 24) | Title "Businesses" H1; sub-line row (gap 8): "Businesses you can see. Lists and counts include only records you can open." Body Small secondary + chips DEC-001, DEC-002, C-01. Right: Primary M "Add business" with plus icon |
| Filters row (gap 12) | Input/Search M flex-1 "Search name, phone or social handle"; 4 Selects w 160: "Category: All", "Created by: Anyone", "Website: Any", "Followers: Any" |
| Quick filters (wrap gap 8) | Chip/Filter default: "Correction requested (2)", "No phone", "No website", "Followers unknown"; disabled: "Archived · C-01 pending" |
| Table columns | Business 260 (sort ↑ Ascending, arrow-up) · Phones 170 · Social 210 · Website 150 · Created by 150 · Flags 212. Whole row is a link (→ SCR-SHR-008) |
| Rows (text / meta) | Glow Beauty Salon / Downtown branch · Salon — +000 70 000 101 / +1 more — @glowbeauty.demo / Instagram · 12,350 followers — glow.example.com — Karim Saleh / 2 Oct 2026 — "—" · Peak Fitness Gym / Gym — +000 70 000 111 / +1 more — @peakfitness.demo / Instagram · 8,920 followers — peak.example.com — Karim Saleh / 6 Oct 2026 — Badge/Flag Warning "Correction requested" · Cedar Home Realty / Real estate — +000 70 000 121 / Primary — @cedarhome.demo / Facebook · followers unknown — "No website" — Rana Haddad / 8 Oct 2026 · Bloom Florist / Shop — 131 / +1 more — @bloomflorist.demo / Instagram + TikTok — bloom.example.com — 21 Oct · Urban Cuts Barbershop / Salon — 141 / Primary — @urbancuts.demo / TikTok · 3,410 followers — No website — 9 Oct · Olive & Thyme Café / Café — 151 — @oliveandthyme.demo / Instagram · followers unknown — olive.example.com — 12 Oct — Flag "Correction requested" · Nova Dental Clinic / Clinic — "No phone" / "Not callable" — @novadental.demo / Instagram · 1,980 followers — nova.example.com — Rana Haddad / 14 Oct — Flag Neutral "No phone (B2)" · Sunrise Bakery / Shop — 157 / Primary — @sunrisebakery.demo / Facebook · 640 followers — No website — 16 Oct |
| Pagination | "Showing 1–8 of 124" · pages 1 2 3 … 16 · "8 per page" (inside table container) |

### SCR-DE-001 — Mobile Light

Frame: [M-L 165:82764](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=165-82764).

| Area | Spec |
|---|---|
| Header | "Businesses" / "124 businesses" · Avatar KS |
| Tab bar (Data Entry) | My Day (clock) · **Businesses** (building, active) · Alerts (bell) · More (menu) |
| Content (p 16, gap 12) | Search wrapped in 44-min-h tap area: "Search name, phone or handle"; Quick filter chips each in a 44-min-h tap area (wrap, column gap 8): "Category: All", "Correction requested (2)", "No phone" |
| Business list | container bg default, border default, radius 12; rows min-h 64, px 16, py 12, border-b `border/subtle`; title 14/20 Medium; meta Caption muted "Downtown branch · Salon · +000 70 000 101" etc.; flagged rows add Badge/Flag Warning "Correction requested" under meta (gap 2). Rows: Glow Beauty Salon, Peak Fitness Gym (flag), Cedar Home Realty, Bloom Florist, Urban Cuts Barbershop, Olive & Thyme Café (flag). No chevrons |
| Footer | Caption muted "Showing 6 of 124 · scroll for more"; Primary L full-width "Add business" + plus icon |

---

## SCR-DE-002 — Create business

Frame: [D-L 170:9047](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=170-9047). State: filled form, not saved.

New components:

| Component | Spec |
|---|---|
| Breadcrumb | gap 6: link 13/18 `text/link` "Businesses" · chevron-right 14 · current 13/18 `text/secondary` |
| Required marker | "*" in `status/danger/fg`, inline after label (gap 4) |
| Input/URL | control: prefix "https://" `text/muted` + value `text/primary` (gap 8) |
| Checkbox | 16 box radius xs 2; unchecked border `border/input` bg default; checked bg `brand/primary` + check 14 white; label Body 14/20; gap 8 |
| Remove row action | IconButton Ghost 40 × 40 (trash 20), wrapper pt 26 to align with the input under its label |
| Field/Metric (with Unknown) | label + "*"; control row gap 12: number input flex-1 (value right-aligned) + Checkbox "Unknown". When Unknown checked: input disabled (`surface/disabled`, text "Unknown" `text/disabled`), Last-post label `text/disabled` |
| Card/Inset (repeating group) | bg `surface/subtle`, border `border/subtle`, radius 8, p 16, gap 12 |
| Sticky footer bar | Card: bg default, border default, radius 12, px 16, py 12, gap 12 |

| Area | Spec |
|---|---|
| Nav | Add Business active |
| Page header | Breadcrumb "Businesses › New business"; H1 "New business"; note row (gap 8): "Duplicates are checked across all stored businesses when you save." (13/18 secondary, w 640) + chip DEC-003 |
| Body | 3 columns, gap 24: A 270 · B 270 · C 564 |
| A — Card/Section "Business details" (no subtitle/action) | Input "Business name *" = Bloom Florist, helper "Name and phones are used to find duplicates." · chip DEC-013 · Select "Category *" = Shop · Link S "Suggest a new category" · chip DEC-015 · Checkbox checked "Has website" · Input/URL "Website address *" https:// bloom.example.com |
| B — Card "Phone numbers" (action link "Add phone") | chip B2; content gap 12; rows (gap 8): Input/Phone "Phone 1" +000 / 70 000 131 + trash; "Phone 2" 70 000 132 + trash |
| B — Card/Section "Notes" | Textarea (no label) "Prefers calls after 11:00. Runs a second stall at the Saturday market." helper "Visible to your team." counter "70 / 2000" |
| C — Card "Social accounts" (action "Add account") | rule row: "At least one account is required." 13/18 + chip DEC-014/023. Account 1 (Card/Inset): Identity row gap 12: Select "Platform *" Instagram · Input "Handle or link *" @bloomflorist.demo · trash. Metrics row gap 12: Field/Metric "Followers *" 2,480 + Unknown unchecked · Input/Date "Last post *" 14 Oct 2026 (calendar icon) + Unknown unchecked (wrapper pt 36). Account 2: TikTok, @bloomflorist.demo; Followers disabled "Unknown" + Unknown checked; Last post disabled "Unknown" + checked |
| Footer bar | "Created by and last updated by are set by the system when you save." 13/18 secondary (flex-1) · "Not saved yet" 14/20 Medium secondary · Secondary M "Cancel" · Primary M "Save business" |

### SCR-DE-002 — Mobile Light

Frame: [M-L 170:10491](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=170-10491). Full-screen form (no tab bar).

| Area | Spec |
|---|---|
| Header | Back 44 · "New business" / "Duplicates are checked when you save" · Avatar KS |
| Content (p 16, gap 12, h 712) | Card/Section "Business details": Business name * (helper), chip DEC-013, Select Category * Shop, row (wrap, gap 4/8): Link "Suggest a new category" in 44 tap area + chip DEC-015, Checkbox "Has website" (unchecked) in 44 tap area. Card "Phone numbers" (Add phone): Phone 1 +000 70 000 131 + trash (44 tap area, wrapper pt 24, row gap 4); chip B2. Caption muted scroll cue "Social accounts, metrics and notes continue below." |
| Sticky footer | top 768, h 76, px 16, py 14, gap 12, border-t: Secondary L "Cancel" flex-1 + Primary L "Save business" flex-1 (side by side) |

---

## SCR-DE-003 — Duplicate blocked (dialog)

**Blocked — do not build from page 42.** Only page-30 samples exist: [Sample F2 101:5214](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=101-5214) · [Sample N1 101:6168](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=101-6168). Not extracted in FIG-1 (see register: SCR-DE-003 blocked). Use Dialog md 520 + Banner/danger patterns if a placeholder is needed.

---

## SCR-DE-004 — Edit business

Frame: [D-L 172:9047](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=172-9047). Layout and components identical to DE-002 (3 columns 270/270/564, same cards). Differences only:

| Area | Spec |
|---|---|
| Nav | **Businesses** active (not Add Business) |
| Breadcrumb | "Businesses › Peak Fitness Gym › Edit" (two links + current) |
| Title / note | H1 "Edit business"; "Name and phone changes are re-checked for duplicates (this record excluded)." + chips DEC-003, C-01 |
| Header right | Link M "View edit history" 14/20 Medium `text/link` |
| Values | Name "Peak Fitness Gym"; Category "Gym"; Has website ✓; https:// peak.example.com; Phones 70 000 111, 70 000 113; Notes "Closed on Mondays. Ask for the front desk manager." (50 / 2000); Instagram @peakfitness.demo 8,920 / 19 Oct 2026; TikTok @peakfitness.demo Unknown/Unknown (checked) |
| Footer bar | Attribution 2 lines Caption 12/16 secondary: "Created by Karim Saleh · 6 Oct 2026, 10:12" / "Last updated by Rana Haddad · 21 Oct 2026, 09:40" · "Unsaved changes" 14/20 Medium secondary · Secondary "Cancel" · Primary "Save changes" |

---

## SCR-DE-005 — Resolve correction (drawer)

Frame: [D-L 308:11804](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=308-11804). State: "In review", taken by me, "Apply changes" selected. Background = SCR-DE-006 queue (spec below), Peak Fitness row selected (`surface/selected`).

New components:

| Component | Spec |
|---|---|
| Tabs (Underline) | row border-b 1 `border/default`, gap 24; tab h 40, px 4, gap 6; active label 14/20 **Medium** `text/primary` + bottom indicator 2 px `brand/accent` full width; inactive 14/20 Regular `text/secondary` |
| Badge Large (Warning) | px 10, py 4, radius full, 14/20 Medium `status/warning/fg` (no dot) |
| RadioCard | px 16, py 12, gap 12, radius 8; default bg `surface/default` border 1 `border/default`; **selected bg `surface/selected` + 2 px `border/selected`**; radio 16; title 14/20 Medium; desc 13/18 secondary |
| H4 section heading | 14/20 SemiBold `text/primary` |

| Area | Spec |
|---|---|
| Drawer header | "Correction request · Peak Fitness Gym" H2 · "Incorrect phone · Maya Khoury · 19 Oct, 14:20" 13/18 secondary · Close 44 |
| Body (p 24, gap 8) | Status row (gap 8): Badge L warning "In review" + "Taken by you · 21 Oct, 09:12" 13/18 secondary · Request box (Card/Inset): KV "Phone 2 now" +000 70 000 112; "Suggested" +000 70 000 113; "Explanation" "Shop sign shows a new number." (row gap 4) · Outcome heading row: H4 "Outcome" + chip "No DEC ID" + spacer + Link S "Open business detail" · RadioCards: **"Apply changes" / "Fix it in Edit business; resolves on save." (selected)**; "No change needed" / "Already correct. Note required."; "Reject request" / "Request is wrong. Reason required." · Textarea "Resolution note" placeholder "What did you verify?" helper "Shown to the requester." "0 / 500" |
| Footer | Ghost "Release request" (left) · spacer · Secondary "Close" · Primary "Edit business" |

---

## SCR-DE-006 — Correction-request queue (preserved ID)

Frame: [D-L 308:13955](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=308-13955). State: Open tab, 4 open + 1 redacted row, no selection.

| Area | Spec |
|---|---|
| Nav | Correction Requests active |
| Header | H1 "Correction requests"; sub-line "Requests from Call Center, Developers and the Owner to fix business master data. One shared queue." 13/18 secondary + chip DEC-002 |
| Tabs (Underline) | "Open (4)" active · "Resolved" · "Closed / rejected" · "Withdrawn" |
| Filters (gap 12) | Search flex-1 "Search business or requester" · Select w 240 "Status: Submitted + In review" · Select w 190 "Requested by: Anyone" · Select w 190 "Age: Any" |
| Table columns | Business 250 · Issue 250 · Requested by 170 · Age 100 (sort ↓) · Status 160 · Reviewer 150 · action 72 (Link "Open") |
| Rows | Peak Fitness Gym / Gym — "Incorrect phone" / "Suggested +000 70 000 113" — Maya Khoury / Call Center — "2 days" / "19 Oct, 14:20" — Badge warning (no dot) "In review" — Karim Saleh — Open · Olive & Thyme Café / Café — "Outdated social link" / "Instagram handle changed" — Omar Nassar / Call Center — "1 day" / "20 Oct, 11:05" — Badge info "Submitted" — "—" · Glow Beauty Salon / Downtown branch · Salon — "Missing website information" / "Booking page not listed" — Lina Aoun / Developer — "3 h" / "21 Oct, 08:10" — Submitted · Lumen Yoga Studio / Gym — "Wrong category" / "Suggested: Yoga studio (DEC-015)" — Sami Fares / Developer — "4 days" / "17 Oct, 16:45" — Submitted |
| Redacted row | **row bg `surface/subtle`**: "Business hidden by policy" / "Details not shown"; all other cells "—"; Badge neutral "Owner review only"; no action |
| Pagination | "Showing 1–4 of 4 open", page controls hidden |
| Redaction note (gap 8) | chip DEC-002 + Caption muted "The redacted row is not counted in Open (4). Omitting the row instead is the other alternative — neither is selected." |
| Selected row (in DE-005) | bg `surface/selected` |

---

## SCR-DE-007 — Categories

Frame: [D-L 178:11715](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=178-11715). State: list of 7 active categories + add form filled.

| Area | Spec |
|---|---|
| Nav | Categories active |
| Header | H1 "Categories"; sub-line "Businesses pick one category from this list. Names are unique, including inactive ones." + chip DEC-015 |
| Body | row gap 24: Category list **760 w** (flex-col gap 12) + Side (flex-1, flex-col gap 16) |
| Table columns | Category 200 (sort ↑) · Businesses 120 (right) · Status 120 · Last changed 170 · Actions 150 |
| Rows | Salon 14 · Gym 9 · Real estate 6 · Shop 18 · Café 11 · Clinic 5 · Services 7. Status: Badge success no dot "Active". Last changed: "Rana Haddad" / date (1 Oct 2026 ×3, 3 Oct ×2, 7 Oct, 12 Oct). Actions (gap 6): Link S "Rename" · Link S "Remove…" |
| Removal note | chip "No DEC ID" + Caption muted "Remove… opens the removal rule check; the rule itself is not decided." |
| Side · Card/Section "Add category" | subtitle "Owner only unless DEC-015 decides otherwise."; Input "Category name *" = "Pet grooming", helper "Checked against all categories, including inactive ones."; actions right-aligned gap 8: Secondary "Clear", Primary "Add category" |
| Side · Policy Block DEC-015 | "Who may add, rename or suggest categories: Owner only (Alt CA-A), Data Entry may also add (Alt CA-B), or Data Entry suggests and the Owner approves (Alt CA-C). None is selected." |
| Side · Policy Block No DEC ID | "Removing a category: deactivate and keep it on existing businesses (Alt CR-1) or delete only if unused (Alt CR-2). Neither is selected; C-01 may influence it." |

---

## SCR-SHR-008 — Business detail

Frame: [D-L 310:11808](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=310-11808). State: Data Entry viewer, Overview tab, one open correction.

New component: **Tag Neutral** — bg `surface/sunken`, radius 4, px 6, py 2, 12/16 Medium `text/secondary` (no border).

| Area | Spec |
|---|---|
| Nav | Businesses active |
| Header | Breadcrumb "Businesses › Peak Fitness Gym"; H1 "Peak Fitness Gym"; sub-line (gap 8): Tag "Gym" · "Created by Karim Saleh, 6 Oct 2026 · Last updated by Rana Haddad, 21 Oct 2026, 09:40" 13/18 secondary · Badge/Flag warning "Correction requested (1)". Right: Primary M "Edit business" with edit icon 20 |
| Tabs | "Overview" (active) · "Edit history" · "Related" |
| Body | gap 24: Main **752 w** (gap 16) + Side flex-1 (gap 16) |
| Main · Card/Section "Contact" | KV rows: Phone 1 "+000 70 000 111"; Phone 2 "+000 70 000 112"; Website "peak.example.com" |
| Main · "Social accounts" | KV: Instagram "@peakfitness.demo · 8,920 followers · last post 19 Oct 2026"; TikTok "@peakfitness.demo · followers Unknown · last post Unknown"; chip DEC-014/023 |
| Main · "Notes" | Body 14/20 "Closed on Mondays. Ask for the front desk manager." |
| Side · "Correction requests" (action "Open queue") | KV "Incorrect phone" → "In review · Karim Saleh" |
| Side · "Record" | KV Created "Karim Saleh · 6 Oct"; Last updated "Rana Haddad · 21 Oct"; Calling "Assigned · read-only here" |
| Side · Policy Block DEC-001/002 | "When other roles stop seeing this business (15-day rule) and which active work keeps it visible are not decided." |

### SCR-SHR-008 — Mobile Light

Frame: [M-L 310:13164](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=310-13164). Tab bar visible (Businesses active).

| Area | Spec |
|---|---|
| Header | Back 44 · "Peak Fitness Gym" / "Gym" · Avatar KS |
| Content (p 16, gap 12) | Flags row: Badge/Flag "Correction requested (1)" · Primary L full-width "Edit business" (edit icon) · Card/Section "Contact" (KV Phone 1, Phone 2, Website as desktop) · Card/Section "Social accounts": KV Instagram "@peakfitness.demo"; Followers "8,920 · 19 Oct"; TikTok "Followers Unknown" · Caption muted "Notes, record and edit history continue below." |

---

## SCR-SHR-009 — Submit data correction (drawer)

Frame: [D-L 310:13530](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=310-13530). State: Call Center user (Maya Khoury) on Business detail; drawer open with a duplicate-open-request warning.

| Area | Spec |
|---|---|
| Background | SHR-008 Business detail in the **Call Center shell**; header right action is **Secondary/Primary "Flag incorrect data"** instead of "Edit business" (no edit rights) |
| Drawer 480 header | "Flag incorrect data" H2 · "Peak Fitness Gym · reviewed by Data Entry" 13/18 secondary · Close 44 |
| Body (p 24, gap 12) | **Banner Warning compact** (radius 6, px 12, py 10, gap 8; icon 20; title 14/20 Medium `status/warning/fg` "1 open request already exists"; body 13/18 primary "Incorrect phone · In review since 19 Oct. You can still report a different issue.") · Select "Issue type *" = "Outdated social link" · Select "Field" = "Social account · Instagram" · Textarea "What is wrong? *" = "The gym moved to a new Instagram handle last week." · Input "Suggested value (optional)" = "@peakfitnessgym.demo", helper "Checked only when Data Entry applies it." · Inline policy "No DEC ID" — "Who receives the request and how they are notified are not decided." |
| Footer | right-aligned gap 8: Secondary "Cancel" · Primary "Submit request" |

### SCR-SHR-009 — Mobile Light (bottom sheet)

Frame: [M-L 310:14186](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=310-14186).

| Area | Spec |
|---|---|
| Background | Call Center mobile shell (tab Queue active), header Back · "Peak Fitness Gym" / "Gym · assigned to you" · MK; Contact card |
| Scrim | mobile 390 × 844 `overlay/scrim` |
| Bottom sheet | top 124, h 720, w 390, bg `surface/raised`, **radius top-left/right 16**, shadow Elevation/3. Header/body identical to desktop drawer (px 24 py 20 header; body p 24 gap 12). Banner body uses an em dash: "Incorrect phone — In review since 19 Oct. You can still report a different issue." The "No DEC ID" notice is not shown on mobile |
| Sheet footer | px 24, py 16, border-t: Secondary L "Cancel" flex-1 + Primary L "Submit request" flex-1 (h 48), gap 8 |

---

## SCR-SHR-010 — Search results

Frame: [D-L 179:11715](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=179-11715). State: query "70 000 15", 3 phone matches.

| Area | Spec |
|---|---|
| TopBar search (Filled) | value "70 000 15" 14/20 `text/primary` + trailing Clear (x) 16 |
| Header | H1 "Search results for “70 000 15”"; sub-line "3 businesses match the phone digits. Results show only businesses you can open." + chips DEC-001/002, DEC-003 |
| Match type chips | "All (3)" active · "Name" · "Phone" · "Social handle" |
| Table columns | Business 300 · Matched on 200 · Phones 220 · Social 180 · Flags 180 · action 72 (Link "Open") |
| Rows | Olive & Thyme Café / Café — Badge neutral (no dot) "Phone" — +000 70 000 151 — @oliveandthyme.demo — "—" · Sunrise Bakery / Shop — Phone — +000 70 000 157 — @sunrisebakery.demo · Lumen Yoga Studio / Gym — Phone — +000 70 000 159 — @lumenyoga.demo |
| Pagination | "Showing 3 of 3", no page controls |
