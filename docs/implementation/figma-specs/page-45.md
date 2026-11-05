# Page 45 — Shared: notifications, profile & account (Figma specs)

File `GNrhb3DWa6mIhEX6F4Nmvw`. Light values. Shared shell/components: [page-40.md](page-40.md); Developer shell: [page-44.md](page-44.md); Owner shell: [page-41.md](page-41.md). Frames on this page are drawn in whichever role shell the example user has; the screen content is role-agnostic.

---

## SCR-SHR-007 — Notifications

Frame: [D-L 165:2880](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=165-2880). State: Developer shell (Lina Aoun, "Checked in · 08:58", search "Search deals and projects"); 5 items, 2 unread.

| Area | Spec |
|---|---|
| Content | p 24, gap 16 |
| Header (gap 16) | H1 "Notifications" (24/32 SemiBold) / Body secondary "Updates about your deals, meetings and tasks" · Link (text/link, trailing icon 16 check) "Mark all as read" |
| Filters (gap 8) | Chip/Filter active "All" (with remove ×) · Chip/Filter "Unread · 2" (with chevron) |
| Policy row (gap 16, each flex-1) | Notice/Policy pending inline: "AR-14" "Proposed: read/unread flag; access is re-checked when the list is shown — items you can no longer open are hidden and not counted." · "No DEC ID" "In-app presentation, timing and recipients are undecided; whether email-only events also appear here is open." |
| Notification list (Card/Surface p 20, radius 12, full width) | List items (px 16 py 12, gap 12, border-b `border/subtle`; Leading 36 circle `brand/accent-subtle` + icon 20; title Label 14/20 Medium ellipsis + meta Caption muted; optional Badge brand "Unread" (bg `status/brand/bg`, border `status/brand/border`); chevron 16). Whole row is a link to the source record |
| Items | calendar "Meeting booked: Peak Fitness Gym — Member app" / "Maya Khoury · today 10:24 · Meetings & Calendar" + **Unread** · clock "Task due tomorrow: Booking flow" / "Glow Beauty Salon — Booking website · today 09:02" + **Unread** · alert-triangle "Client dependency on Content upload" / "Glow Beauty Salon — Booking website · Mon 19 Oct 16:40" (no link target) · briefcase "Deal closed: Glow Beauty Salon — Booking website" / "Rana Haddad · Fri 16 Oct 11:05" · check-circle "Wireframes approved by the client" / "Booking website · Wed 14 Oct 15:30" |

**Mobile** [M-L 165:3285](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=165-3285) — Developer mobile shell: header "Notifications" / "2 unread" + Avatar 32 LA; tab bar My Day · Tasks · Meetings · **More** (active). Content p 16, gap 12, scroll-y.

| Area | Spec |
|---|---|
| Filters (wrap, gap 8) | Chip/Filter active "All" · "Unread · 2" |
| Policy chips (wrap, gap 8) | Notice/Policy pending size Chip: "AR-14 Policy pending" · "No DEC ID Policy pending" (bodies dropped on mobile) |
| Notification list | same Card/Surface + items as desktop, **no chevrons**; Unread badges on first two |
| Not on mobile | "Mark all as read" link, page H1 (title moves to header) |

---

## SCR-SHR-011 — Permission denied

Frame: [D-L 165:3781](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=165-3781). State: role denied (Developer opening Reports & Exports). Shell unchanged (no nav item active).

| Area | Spec |
|---|---|
| Content | p 24, flex-col gap 16, **centered both axes** |
| Access · Permission denied (empty-state block) | w **480**, p 32, gap 12, center-aligned. Icon circle 48 (bg `status/neutral/bg`, radius full) + Icon/lock 24 · Text (gap 4, text-center): H3 "You don’t have access to this page" · Body Small 13/18 secondary "Your role (Developer) can’t open Reports & Exports. If you need it, ask the Owner/Admin." · Secondary M (link role) "Go to My Day" |
| Below block | Ghost M with leading chevron-left 20 "Back" |
| Copy rule | role name and page name are interpolated: "Your role ({role}) can’t open {page}." |

**Mobile** [M-L 165:3970](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=165-3970) — header "No access" + Avatar LA; Developer tab bar (More active). Content p 16, gap 12, vertically centered.

| Area | Spec |
|---|---|
| Notice (px 8 py 24, gap 8, centered) | Icon/lock **32** (no circle) · H3 "You don’t have access to this page" · Body Small secondary "Your role can’t open this screen. If you need it, ask the Owner/Admin." (generic copy, no role/page names) |
| Actions (full width, h **48**, px 20, min-h 44) | Secondary "Go to My Day" · Ghost with chevron-left "Back" |

---

## SCR-SHR-012 — Record hidden by policy

Frame: [D-L 269:2916](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=269-2916). State: Call Center shell (Maya Khoury, Calling Queue active, count 7; search "Search assigned businesses"); opened via direct URL.

| Area | Spec |
|---|---|
| Content | p 24, gap 16 (top-aligned, not centered) |
| Breadcrumb | level 1 link "Calling Queue" › current "Record unavailable" (13/18; no level 2) |
| Centre (flex-col gap 16, py 48, items-center) | Access block w 480, p 32, gap 12: Icon circle 48 `status/neutral/bg` + Icon/eye-off 24 · H3 "This record isn’t available to you" · Body Small secondary "It is outside what your role can see, so no details are shown." · Secondary M (link) "Back to Calling Queue" |
| Policy chips (wrap, gap 8, centered) | Notice/Policy pending size Chip — renders "{DEC} Policy pending": DEC-001 · DEC-002 · DEC-003 (Figma bodies "Visibility scope" / "Visibility window" / "No leakage / reveal" are hidden by the Chip variant) |
| Inline notice (w 320) | "No DEC ID" "A “Request access” option appears only if one is adopted." |
| Rule | Never reveal record name, owner or existence detail; the back action targets the originating list |

**Mobile** [M-L 269:3190](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=269-3190) — header "Record unavailable" + Avatar MK; Call Center tab bar My Day · **Queue** (active) · Follow-ups · More. Content p 16, gap 12 (top-aligned).

| Area | Spec |
|---|---|
| Notice (px 8 py 24, gap 8, centered) | Icon/eye-off 32 · H3 "This record isn’t available to you" · Body Small secondary "It is outside what your role can see, so no details are shown." |
| Action | Secondary full-width h 48 "Back to Calling Queue" |
| Policy chips (wrap, gap 8, left) | DEC-001 · DEC-002 · DEC-003 "Policy pending" |
| Not on mobile | breadcrumb, "No DEC ID" request-access notice |

---

## SCR-SHR-013 — Session ended

Frame: [D-L 269:3418](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=269-3418). State: expired. Uses the **auth layout** (same as AUTH-001, see page-40), no app shell.

| Area | Spec |
|---|---|
| Brand panel | w 600, full height, bg `surface/brand`, p 64, justify-between: Brand/Logo on-brand Medium (231 × 46) · Display 32/40 Bold white "Udigity Management System" + Body on-brand-muted "Attendance, businesses, calls and projects in one place." (gap 16) · footer (gap 12): accent rule 48 × 3 `brand/accent` + Caption on-brand-muted "Internal system · authorised Udigity staff only" |
| Panel (flex-1, centered, gap 16) | Auth card (Card/Surface w **440**, p 20, radius 12; content gap 16) + Caption muted "© 2026 Udigity · Need access? Ask the Owner/Admin." |
| Auth card content | State block (bg `surface/subtle`, p 16, radius lg, gap 12): icon circle 36 `status/warning/bg` + Icon/lock 20 · Label "Your session has expired" / Body Small secondary "For your security you were signed out. Sign in again to continue." · Banner warning (px 12 py 10, radius md, gap 8; alert-triangle 20): title 14/20 Medium `status/warning/fg` "Unsaved changes were not kept" / 13/18 primary "Anything you hadn’t saved on the previous page could not be saved." · Primary **full-width h 48** (min-h 44, px 20) "Sign in again" · Implementation note (bg `status/decision/bg`, border `status/decision/border`, px 10 py 6, radius sm; hourglass 16) "Impl. decision" "Idle and absolute session lifetimes are implementation decisions (no DEC ID)." |

**Mobile** [M-L 269:3523](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=269-3523) — signed-out layout (no shell): pt 40, pb 24, px 16, gap 20.

| Area | Spec |
|---|---|
| Logo | Brand/Logo Default (navy) Small 132 × 32, left |
| Auth card (full width, p 20, radius 12; content gap 16) | Notice (px 8 py 24, gap 8, centered): Icon/lock 32 · H3 "Your session has expired" · Body Small secondary "For your security you were signed out. Sign in again to continue." · same warning banner · Primary full-width h 48 "Sign in again" (→ AUTH-001) · same Impl. decision note |
| Footer | Caption muted centered "© 2026 Udigity · Need access? Ask the Owner/Admin." |

---

## SCR-SHR-014 — Save conflict (field-level diff)

Frame: [D-L 270:2918](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=270-2918). State: Data Entry shell (Karim Saleh, Businesses active, search "Search businesses"); edit of Glow Beauty Salon rejected by optimistic-concurrency check.

| Area | Spec |
|---|---|
| Content | p 24, gap 16 |
| Header | Breadcrumb "Businesses › Glow Beauty Salon › Edit" · H1 "Edit business" · Body secondary "Glow Beauty Salon · Downtown branch · Salon" (titles gap 4) |
| Banner warning (full width, px 16 py 12, gap 12; no action, no close) | title "Someone else changed this business while you were editing" / body "Rana Haddad saved changes at 10:42. Nothing was overwritten. Review the differences, then re-apply your edits or reload the latest version." |
| Card/Section (no action) "Changes since you opened this record" / "3 fields differ · your edits are kept on this page until you choose" | Diff table (border `border/subtle`, radius 8): Field 150 · "When you opened (10:31)" 210 · "Saved by Rana Haddad (10:42)" 294 · "Your edit (not saved)" 294 · Result 162; rows h 56 |
| Rows | Primary phone — +000 70 000 101 — +000 70 000 108 — "+000 70 000 101 (unchanged)" — Badge neutral **"Their change"** · Instagram handle — @glowbeauty.demo — "@glowbeauty.demo (unchanged)" — @glowbeautysalon.demo — Badge info **"Your change"** · Website — glowbeauty.example.com — downtown.glowbeauty.example.com — glowbeauty.example.com/downtown — Badge warning **"Both changed"** (Result badges have no dot) |
| Card footnote | Body Small secondary "Re-applying puts your edits on top of the latest saved version; you review them again before saving. “Both changed” fields show both values side by side." |
| Conflict actions (justify-end, gap 8) | Ghost "Cancel editing" · Secondary with Icon/refresh "Reload latest" · Primary "Re-apply my edits" |
| Column header labels | as in Figma (Overline style: 11/16 SemiBold uppercase muted) — interpolate names and times |

**Mobile** [M-L 270:3415](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=270-3415) — different example (Developer task edit). Detail header (no tab bar): Back IconButton 44 · "Edit task" / "Booking flow" · Avatar LA. Content p 16, gap 12, scroll-y, h 660; sticky footer.

| Area | Spec |
|---|---|
| Banner warning inline (full width) | "This task changed while you were editing" / "Sami Fares saved at 11:20. Nothing was overwritten." |
| Diff cards (one per field; bg `surface/subtle`, border `border/subtle`, p 16, radius lg) | field Label + 3 KV rows (label 13/18 secondary w **112**, value Body; py 6): "Due date": When opened "Fri 30 Oct" · Saved "Tue 3 Nov (Sami Fares, 11:20)" · Your edit "Mon 2 Nov" — "Description": "Booking flow for 3 services" · "Booking flow for 3 services + deposit note" · "Booking flow for 4 services" |
| Footer (top 716, h 128, border-t, px 16 py 12, gap 8) | Primary full-width h 48 "Re-apply my edits" · Secondary full-width h 48 + refresh icon "Reload latest" |
| Not on mobile | Result badges, explanatory footnote, "Cancel editing" (Back acts as cancel) |

---

## SCR-SHR-015 — System state patterns (reference sheet)

Frame: [D-L 270:3509](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=270-3509). Not a route — a component reference every screen must reuse. No shell; page bg, p 48, gap 24.

| Area | Spec |
|---|---|
| Header | H1 "System state patterns" / "Reference for every screen: use these instead of inventing new state UI. Copy is illustrative; screens override it with their own wording." |
| Pattern grid | flex-wrap gap 24; Card/Section w **432** (two per row), p 20, no action |
| Loading — "Skeletons for lists and cards; no spinners for lists" | State type Loading (p 16, gap 10) "Loading businesses…" + Skeleton lines (gap 8): 2 × text line h 12 w 240 radius sm `surface/skeleton` + avatar skeleton 32 round |
| Empty — "Nothing to show yet; say what will appear" | State block (bg `surface/subtle`, p 16, radius lg, gap 12): icon circle 36 `status/neutral/bg` + title Label "No follow-ups today" / Body Small "Follow-ups you schedule appear here." (component default: "No businesses yet" / "Businesses you add or are assigned will appear here." + link "Add business") |
| No results — "Search or filters matched nothing" | same block: "No matches for “Cedar”" / "Try a different name, phone or handle, or clear filters." + Link "Clear filters" |
| Load error — "The list could not load; data is safe" | same block, icon circle `status/danger/bg`: "Couldn’t load this list" / "Your data is safe. Try again in a moment." + Link "Try again" |
| Validation error — "Summary on submit + inline field message" | Banner/Error summary (bg `status/danger/bg`, border `status/danger/border`, px 16 py 12, gap 8, radius md) title "Fix 2 problems before saving" + links "Phone — enter a number like +000 70 000 101", "Category — select a category" · field "Business name" with control border `status/danger/solid` + helper (error icon 16) "Enter the business name." |
| Save failed — "Nothing was lost; retry in place" | Banner error inline "Couldn’t save your changes" / "Nothing was lost — your edits are still on this page. Try again." + Secondary M "Try again" |
| Offline — "Saving pauses; nothing is sent" | Banner warning inline "You’re offline" / "Saving is paused until your connection returns." + disabled button (bg `surface/disabled`) "Save (offline)" |
| Success — "Toast; auto-dismisses (errors stay until closed)" | Toast success (bg `surface/raised`, border default, px 16 py 12, gap 12, radius lg, shadow Elevation/2: 0 2 4 −2 rgba(11,26,53,.06), 0 4 8 −2 rgba(11,26,53,.10)) "Business saved" / "Glow Beauty Salon was updated." |
| Session expired — "Inline notice before the SCR-SHR-013 page" | State block, icon circle `status/warning/bg`: "Session expired" / "Sign in again to continue." + Link "Sign in" |
| Restricted — "No data shown; never hints at hidden records" (card w **888**) | two compact notices (bg `status/neutral/bg`, border `status/neutral/border`, px 12 py 10, gap 12, radius md, icon 20): "This record isn’t available to you" / "It is outside what your role can see." · "Your role can’t do this" / "Ask the Owner/Admin if you need it." |
| Stored vs derived — "Solid badge = stored status; dashed chip = derived" | Badge neutral no dot "Closed" · Chip/Derived amber (border **dashed** `status/warning/fg`) "Overdue 2 days" · Chip/Derived neutral (dashed `status/neutral/fg`) "On time"; gap 12 |
| Pending policy labels — "Violet = pending policy; neutral = implementation decision" | Policy chip "DEC-020 Policy pending" · Decision chip (bg `status/decision/bg`, border `status/decision/border`) "Impl. decision" · inline Notice/Policy "DEC-012" "Whether a work summary is required is undecided." |

**Mobile** [M-L 270:4374](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=270-4374) — Developer mobile shell, header "Tasks" / "State patterns · mobile", tab bar **Tasks** active. Content p 16, gap 12 (states stacked full width).

| Area | Spec |
|---|---|
| Offline | Banner warning inline "You’re offline" / "Saving is paused until your connection returns." |
| Loading | p 16 gap 10: skeleton lines 296 × 12 and 240 × 12 (radius sm, `surface/skeleton`) + Caption muted "Loading tasks…" |
| Empty | State block: icon circle 36 neutral + "No tasks due today" / "Tasks assigned to you appear here." |
| Error | State block, danger icon circle (alert-circle): "Couldn’t load tasks" / "Your data is safe. Try again." + Link "Try again" |
| Save failed | Banner error inline (bg `status/danger/bg`, border `status/danger/border`, title `status/danger/fg`) "Couldn’t save" / "Nothing was lost. Try again." |
| Toast | w 360, left 15, top **698** (16 px above tab bar): check-circle 20 + "Task saved" / "Booking flow was updated." + Close 32; Elevation/2 |
