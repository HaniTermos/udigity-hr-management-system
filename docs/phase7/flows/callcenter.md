# Phase 7 — Call Center flow map (page 43 `96:5`)

Author: Call Center role agent · 2026-10-23 · version P7-CC-2 (CC-P7-1). No Figma calls. Scripts: `docs/phase7/scripts/callcenter/P43-01…P43-06` (helpers from `docs/phase7/wiring-helpers.js` inlined).

Sources: `phase7/brief.md`, `phase6/interaction-spec.md` (Call Center), `phase6/screens/callcenter-spec.md`, `phase6/screen-register.md` (SCR-CC rows), `phase6/previews/43/index.md` + PNGs, `phase6/coordination.md` [O-2].

## Conventions
- **Frames** follow the brief-6 pattern. Short names are used below, e.g. `CC-003 D-L` = `SCR-CC-003 — Active contact — log attempt & outcome — Desktop — Light`. Scripts must look targets up **by full frame name**; IDs are OP-14 fallbacks from `previews/43/index.md`.
- **Step format:** `frame | hotspot | action | target | transition`.
- **Actions:** `NAVIGATE` (same page), `OPEN_URL` (other page, `https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=<id with ->`). All triggers are ON_CLICK.
- **Transitions:** `instant` for state swaps on the same screen (outcome cards, segmented controls); `dissolve` (200 ms) between screens; `smart-animate` (250 ms) for drawer/dialog open and close over the same backdrop.
- **Policy:** `docs/policy-defaults.md` working defaults apply (D5). Drawn policy labels are not changed (brief rule 6); that is Phase 8.
- **User decision 2026-10-23:** Accepted keeps the reservation ("Save, keep reservation" stays on Accepted); only Rejected (do-not-call) releases it, with no keep option.
- **Dark:** only the mobile queue and contact flow (F2b) is wired on Dark frames.

## Decisions applied (CC-P7-1, orchestrator 2026-10-23 + [P7-1] D1–D6)
- **Pending:** no frame, so the step is skipped (F1a). Lumen Yoga / Urban Cuts rows stay unwired.
- **No desktop save-success frames (D2):** each save ends at the closest existing frame (CC-004, CC-001, CC-007, CC-008). Saves that would land on their own frame ("Save, keep reservation", mobile "Keep reserved", CC-005 "Retry", CC-007 toast X) get **no reaction**; self-navigation shows no change.
- **Timer states:** `wiring-helpers.js` supports ON_CLICK only (no AFTER_TIMEOUT), so Expired, Network loss and Stale client are **separate flows**. The banners are not wired as fake hotspots (replaces F3 steps 4 and 8).
- **SHR-009 / SHR-008 links:** current 310:* IDs from `phase6/previews/42/index.md` (310:13530, 310:14186, 310:13164). My Day: 303:10513 (desktop), 303:11195 (mobile Light), 303:11447 (mobile Dark).
- **D4 (policy-defaults):** Rejected → open follow-ups are cancelled by the system in the same save; Accepted → they stay open. The CC-003 Rejected radios get no reaction (D6).
- **D2 guard (CC-004 Cancel):** there is no separate policy-defaults row. The drawn option 1 "Set callback to be scheduled" (the D2 marker, B3-Q16) is the working default; the radios get no reaction (D6).
- **B3-Q05 (policy-defaults): Alt B.** The attempt row and notes are kept, the outcome is not applied, and the agent reopens the contact. So Stale client "Start contact again" → CC-003 D-L.
- **DEC-016 (policy-defaults):** Owner only, with a mandatory reason; the outcome returns to Pending. Agent view: Start Contact / Reopen… disabled, no reaction. Owner: "Reopen business" → Reopened.
- **Accepted keeps the reservation** (user decision).
- **D1 alternative flows:** they start at their branch frame, because a frame can hold only one flow starting point.
- **Hotspot lookup:** layer names from the Phase 6 builders (`Button · `, `Link · `, `Nav/Item · `, `Row · `, `Item · `, `Outcome · ` RadioCards ≥120 px, `Toast · `, scopes `Breadcrumb`, `TabBar`, `Header`, `Dialog`, `Drawer`, `View switch`), then visible text. Misses are reported, never worked around.
- **Toast close X:** there is no named layer, so the toast instance itself is the hotspot.

## Scripts and run order (operator)
| # | Script | Owns | Flow starting points |
|---|---|---|---|
| 1 | P43-01-shell-nav.js | Sidebar, breadcrumb "Calling Queue", header "Follow-ups & Calendar" / "(Open) calling queue", queue-footer "Rejected: do not call (1)" link, mobile TabBar (Queue / Follow-ups / My Day) | none |
| 2 | P43-02-queue-to-outcome.js | F1: CC-001 rows, CC-002 Start Contact + Nova row, CC-003 cards / Cancel contact / Save attempt / Try again | Queue to outcome; (On hold) (Rejected) (Accepted) (Save failed) (Save conflict) |
| 3 | P43-03-mobile-queue-contact.js | F2a/F2b mobile rows, back, Start/Cancel/Save, Success, CC-005 M Reserved | Queue and contact (mobile); (mobile Dark) |
| 4 | P43-04-reservation-recovery.js | F3 CC-005 desktop + CC-005 M Expired, Overridden breadcrumb | Reservation recovery; (Expired) (Network loss) (Stale client) (Reserved by another agent) (Owner override) (mobile Expired) |
| 5 | P43-05-followups-calendar.js | F4 + F1b b4–b10: CC-004, CC-006 | Follow-ups calendar; (Past time rejected) (Save conflict) (mobile) |
| 6 | P43-06-opps-dnc-correction.js | F5 CC-007, F6 CC-008, F7 every "Request correction" / "Details · Request correction" | Opportunities; Do-not-call list; (Owner reopen); Request correction |

All flow names are prefixed `P7 — Call Center — `. Each hotspot belongs to exactly one script, so the scripts run in any order (1→6 recommended). Each script also removes auto-created "Flow N" entries on CC frames.

## Frame key (fallback IDs)
| Short | Full frame name (after `SCR-CC-00n — `) | ID |
|---|---|---|
| CC-001 D-L | Calling queue — Desktop — Light | 311:13767 |
| CC-001 M-L / M-D | Calling queue — Mobile — Light / Dark | 311:15277 / 311:15490 |
| CC-002 D-L | Contact workspace — Desktop — Light | 312:13759 |
| CC-002 D-L Rejected | Contact workspace — Desktop — Light — Start Contact disabled (Rejected) | 312:14821 |
| CC-002 M-L / M-D | Contact workspace — Mobile — Light / Dark | 312:15793 / 312:15962 |
| CC-002 M Rejected | Contact workspace — Mobile — Light — Rejected | 312:16130 |
| CC-003 D-L | Active contact — log attempt & outcome — Desktop — Light (Needs another call selected) | 283:13815 |
| CC-003 On hold / Rejected / Accepted | … — Desktop — Light — On hold / Rejected / Accepted (developer deferred) | 313:13735 / 313:14327 / 313:14927 |
| CC-003 Save failed / Save conflict | … — Desktop — Light — Save failed / Save conflict | 313:15568 / 313:16173 |
| CC-003 M-L / M-D / M Success | … — Mobile — Light / Dark / Light — Success | 283:15034 / 283:15220 / 283:15404 |
| CC-004 D-L | Follow-ups & calendar — Desktop — Light | 285:13809 |
| CC-004 Week / Cancel | … — Desktop — Light — Week calendar / Cancel with reason (D2 guard) | 285:14637 / 285:15019 |
| CC-004 M-L / M-D | … — Mobile — Light / Dark | 285:15486 / 285:15628 |
| CC-005 Reserved | Contact reservation & concurrency block — Desktop — Light — Reserved by another agent | 314:13735 |
| CC-005 Override | … — Desktop — Light — Owner force override | 314:14787 |
| CC-005 Overridden | … — Desktop — Light — Overridden by Owner (notice to holder) | 314:15266 |
| CC-005 Expiring / Expired / Network loss / Stale client | … — Desktop — Light — Expiring / Reservation expired / Network loss / Stale client | 261:13797 / 261:14421 / 261:15023 / 261:15620 |
| CC-005 M Reserved / M Expired | … — Mobile — Light — Reserved by another agent / Reservation expired | 261:16192 / 261:16322 |
| CC-006 Create / Reschedule / Past time / Conflict / Success | Follow-up create / reschedule (drawer) — Desktop — Light — Create / Reschedule / Past time rejected / Save conflict / Success | 315:13720 / 315:14328 / 315:14610 / 315:14902 / 315:15170 |
| CC-006 M Create / M Past time | … — Mobile — Light — Create / Past time rejected | 315:15364 / 315:15441 |
| CC-007 D-L / Dev assigned | Opportunities & developer handoff — Desktop — Light / — Developer assigned | 316:13709 / 316:14338 |
| CC-008 D-L / Owner reopen / Reopened | Do-not-call list & reopening — Desktop — Light / — Owner reopen (reason) / — Reopened | 316:15211 / 316:15724 / 316:16113 |

Cross-page OPEN_URL targets (current OP-14 IDs; the Phase 6 specs still cite the stale `175:10802` / `175:10448` / `175:9043`):
| Target | ID |
|---|---|
| SCR-SHR-008 — Business detail — Desktop — Light — Call Center read-only (p42) | 310:12415 |
| SCR-SHR-008 — Business detail — Mobile — Light (p42) | 310:13164 |
| SCR-SHR-009 — Submit data correction (drawer) — Desktop — Light — Open request warning (p42) | 310:13530 |
| SCR-SHR-009 — Submit data correction (drawer) — Mobile — Light — Sheet (p42) | 310:14186 |
| SCR-SHR-001 — My Day — Desktop — Light (p40) | 303:10513 |
| SCR-DEV-004 — Meeting schedule / record — Desktop — Light — Reschedule (p44) | 304:13135 |

## Shared chrome (every Call Center desktop Light frame; wire once via a helper)
| hotspot | action | target | transition |
|---|---|---|---|
| Sidebar "Calling Queue" | NAVIGATE | CC-001 D-L | dissolve |
| Sidebar "Follow-ups & Calendar" | NAVIGATE | CC-004 D-L | dissolve |
| Sidebar "Opportunities & Handoffs" | NAVIGATE | CC-007 D-L | dissolve |
| Sidebar "Do-not-call List" | NAVIGATE | CC-008 D-L | dissolve |
| Sidebar "My Day" | OPEN_URL | SHR-001 Desktop Light (303:10513) | — |
| Breadcrumb "Calling Queue" (CC-002/003/005) | NAVIGATE | CC-001 D-L | dissolve |
| Header button "Follow-ups & Calendar" | NAVIGATE | CC-004 D-L | dissolve |
| Header button "Do-not-call list (1)" | NAVIGATE | CC-008 D-L | dissolve |
| Header button "Calling queue" (CC-007, CC-008) | NAVIGATE | CC-001 D-L | dissolve |

Mobile bottom nav (same theme as the frame): "Queue" → CC-001 M-L (M-D on Dark) · "Follow-ups" → CC-004 M-L (M-D on Dark) · "My Day" → OPEN_URL SHR-001 Mobile Light (p40; ID from previews/40) · "More" → no target (U-12).

Owner-perspective frames (CC-001 Owner view, CC-005 Override, CC-007 Owner view, CC-008 Owner reopen) and Omar's CC-005 Overridden have different nav; they get only the steps listed below.

---

## F1 — P7 — Call Center — Queue to outcome (desktop)
Start frame: **CC-001 D-L**

Core path: queue → workspace → Start Contact (reservation) → active contact.
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | CC-001 D-L | Row "Olive & Thyme Café" (Callbacks due today) | NAVIGATE | CC-002 D-L | dissolve |
| 2 | CC-001 D-L | Row "Nova Dental Clinic" (Reserved flag) | NAVIGATE | CC-005 Reserved | dissolve |
| 3 | CC-001 D-L | Footer link "Rejected: do not call (1) — view only" | NAVIGATE | CC-008 D-L | dissolve |
| 4 | CC-002 D-L | "Start Contact" (reserves: "Reserved by you") | NAVIGATE | CC-003 D-L | dissolve |
| 5 | CC-002 D-L | Left queue row "Nova Dental Clinic" | NAVIGATE | CC-005 Reserved | dissolve |
| 6 | CC-002 D-L | "Request correction" | OPEN_URL | SHR-009 Desktop Light (310:13530) | — |
| 7 | CC-003 D-L | "Cancel contact" (release; no attempt logged) | NAVIGATE | CC-002 D-L | dissolve |

Outcome selection: the four RadioCards are cross-wired on CC-003 D-L, On hold, Rejected and Accepted (no default is implied; D-L just happens to be drawn with Needs another call).
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 8 | CC-003 (each outcome frame) | Card "On hold — no answer" | NAVIGATE | CC-003 On hold | instant |
| 9 | CC-003 (each) | Card "Needs another call — call later" | NAVIGATE | CC-003 D-L | instant |
| 10 | CC-003 (each) | Card "Rejected — do not call" | NAVIGATE | CC-003 Rejected | instant |
| 11 | CC-003 (each) | Card "Accepted — creates opportunity" | NAVIGATE | CC-003 Accepted | instant |

### F1a — Pending
"Pending" is a business **status** (New assignments: Lumen Yoga Studio, Urban Cuts Barbershop), not a selectable outcome; CC-003 draws only four cards. No workspace frame exists for a Pending business.
**Skipped (CC-P7-1):** there is no Pending frame, so this step has no wiring. Cancel contact is wired in F1 #7. See U-1.

### F1b — Needs another call → follow-up drawer
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| b1 | CC-003 D-L | Follow-up segmented "Set now" / "Set later" | — | none (in-panel toggle; no Set-later frame) | — |
| b2 | CC-003 D-L | "Save, keep reservation" (attempt logged; reservation stays) | NAVIGATE | CC-003 D-L (self) | instant — U-3 |
| b3 | CC-003 D-L | "Save attempt" (release after success) | NAVIGATE | CC-004 D-L | dissolve — no desktop success frame, U-2 |
| b4 | CC-004 D-L | Olive & Thyme Café row "Reschedule" | NAVIGATE | CC-006 Reschedule | smart-animate |
| b5 | CC-006 Reschedule | "Save new time" | NAVIGATE | CC-006 Success | smart-animate — U-4 |
| b6 | CC-006 Reschedule | "Cancel" / close X | NAVIGATE | CC-004 D-L | smart-animate |
| b7 | CC-004 D-L | "Schedule follow-up" | NAVIGATE | CC-006 Create | smart-animate |
| b8 | CC-006 Create | "Save follow-up" | NAVIGATE | CC-006 Success | smart-animate |
| b9 | CC-006 Create | "Cancel" / close X | NAVIGATE | CC-004 D-L | smart-animate |
| b10 | CC-006 Success | Toast close X | NAVIGATE | CC-004 D-L | dissolve |
CC-006 Past time rejected and Save conflict: no inbound hotspot (U-5).

### F1c — Accepted (keeps reservation)
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| c1 | CC-003 Accepted | Developer segmented "Assign now" / "Decide later" | — | none (drawn on Decide later; no Assign-now frame) | — |
| c2 | CC-003 Accepted | "Save, keep reservation" (kept per user decision) | NAVIGATE | CC-003 Accepted (self) | instant — U-3 |
| c3 | CC-003 Accepted | "Save attempt" | NAVIGATE | CC-007 D-L (Olive "Not yet assigned") | dissolve |
| c4 | CC-003 Accepted | "Cancel contact" | NAVIGATE | CC-002 D-L | dissolve |
Continues in F5.

### F1d — On hold
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| d1 | CC-003 On hold | Checkbox "Add a follow-up (optional)" | — | none (no checked-state frame) | — |
| d2 | CC-003 On hold | "Save, keep reservation" | NAVIGATE | CC-003 On hold (self) | instant — U-3 |
| d3 | CC-003 On hold | "Save attempt" | NAVIGATE | CC-001 D-L | dissolve — U-2 |
| d4 | CC-003 On hold | "Cancel contact" | NAVIGATE | CC-002 D-L | dissolve |

### F1e — Rejected → do-not-call
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| e1 | CC-003 Rejected | D4 "Open follow-ups" radios (Cancel / Keep / Agent chooses; none preselected) | — | none (D6). Working default D4: the system cancels them | — |
| e2 | CC-003 Rejected | "Save attempt" (the only save; releases the reservation) | NAVIGATE | CC-008 D-L | dissolve — U-6 |
| e3 | CC-003 Rejected | "Cancel contact" | NAVIGATE | CC-002 D-L | dissolve |
| e4 | CC-008 D-L | "Open business" | NAVIGATE | CC-002 D-L Rejected (Start Contact disabled) | dissolve |

### F1f — Save errors (review branch)
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| f1 | CC-003 Save failed | "Try again" | NAVIGATE | CC-001 D-L | dissolve |
| f2 | CC-003 Save conflict | "Keep latest" / "Replace with draft" radios; "Save again" disabled | — | none (D6) | — |
No inbound hotspot reaches these from CC-003 D-L (U-7), so they are their own flows: (Save failed), (Save conflict).

---

## F2a — P7 — Call Center — Queue and contact (mobile Light)
Start frame: **CC-001 M-L**
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | CC-001 M-L | Row "Olive & Thyme Café" | NAVIGATE | CC-002 M-L | dissolve |
| 2 | CC-001 M-L | Row "Nova Dental Clinic" | NAVIGATE | CC-005 M Reserved | dissolve |
| 3 | CC-001 M-L | "Rejected (1) — view only" | NAVIGATE | CC-002 M Rejected | dissolve |
| 4 | CC-002 M-L | Back chevron | NAVIGATE | CC-001 M-L | dissolve |
| 5 | CC-002 M-L | "Start Contact" | NAVIGATE | CC-003 M-L | dissolve |
| 6 | CC-002 M-L | "Request correction" | OPEN_URL | SHR-009 Mobile Sheet (310:14186) | — |
| 7 | CC-002 M-L | "Open full history & notes (3)" | — | none (screen not drawn) | — |
| 8 | CC-003 M-L | Back chevron / "Cancel contact" | NAVIGATE | CC-002 M-L | dissolve |
| 9 | CC-003 M-L | "Details · Request correction" | OPEN_URL | SHR-008 Mobile Light (310:13164) | — |
| 10 | CC-003 M-L | "Save attempt" | NAVIGATE | CC-003 M Success | dissolve |
| 11 | CC-003 M-L | "Keep reserved" | NAVIGATE | CC-003 M-L (self) | instant — U-3 |
| 12 | CC-003 M Success | "Back to queue" / toast X | NAVIGATE | CC-001 M-L | dissolve |
| 13 | CC-003 M Success | "Next: Nova Dental Clinic" | NAVIGATE | CC-005 M Reserved | dissolve |
| 14 | CC-005 M Reserved | back action (label to verify) | NAVIGATE | CC-001 M-L | dissolve — U-8 |
| 15 | CC-002 M Rejected | Back chevron | NAVIGATE | CC-001 M-L | dissolve |
Mobile outcome cards: no per-outcome mobile frames; not wired.

## F2b — P7 — Call Center — Queue and contact (mobile Dark)
Start frame: **CC-001 M-D**
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | CC-001 M-D | Row "Olive & Thyme Café" | NAVIGATE | CC-002 M-D | dissolve |
| 2 | CC-002 M-D | Back chevron | NAVIGATE | CC-001 M-D | dissolve |
| 3 | CC-002 M-D | "Start Contact" | NAVIGATE | CC-003 M-D | dissolve |
| 4 | CC-002 M-D | "Request correction" | OPEN_URL | SHR-009 Mobile Sheet (310:14186; no Dark sheet) | — |
| 5 | CC-003 M-D | Back chevron / "Cancel contact" | NAVIGATE | CC-002 M-D | dissolve |
| 6 | CC-003 M-D | "Details · Request correction" | OPEN_URL | SHR-008 Mobile Light (310:13164) | — |
| 7 | CC-003 M-D | "Save attempt" | NAVIGATE | CC-001 M-D | dissolve — no Dark Success frame, U-9 |
| 8 | CC-001/002/003 M-D | Bottom nav "Follow-ups" | NAVIGATE | CC-004 M-D | dissolve |

---

## F3 — P7 — Call Center — Reservation conflicts and recovery (desktop)
Start frame: **CC-005 Expiring**. Timer events cannot be clicked and only ON_CLICK is in scope, so the banner is used as a demo hotspot where a state must advance (U-10).
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | CC-005 Expiring | Header link "Keep reservation" | NAVIGATE | CC-003 D-L | dissolve |
| 2 | CC-005 Expiring | "Save, keep reservation" | NAVIGATE | CC-003 D-L | dissolve |
| 3 | CC-005 Expiring | "Save attempt" | NAVIGATE | CC-004 D-L | dissolve |
| 5 | CC-005 Expired | "Start contact again" (new reservation) | NAVIGATE | CC-003 D-L | dissolve |
| 6 | CC-005 Expired | "Discard draft" | NAVIGATE | CC-002 D-L | dissolve |
| 7 | CC-005 Network loss | "Retry now" (reconnected) | NAVIGATE | CC-003 D-L | dissolve |
| 9 | CC-005 Stale client | "Start contact again" (B3-Q05 Alt B) | NAVIGATE | CC-003 D-L | dissolve |
| 10 | CC-005 Reserved | "Back to queue" | NAVIGATE | CC-001 D-L | dissolve |
| 11 | CC-005 Reserved | "Retry" (still held) | NAVIGATE | CC-005 Reserved (self) | instant |
| 12 | CC-005 Reserved | Left queue row "Olive & Thyme Café" | NAVIGATE | CC-002 D-L | dissolve |

Overridden by Owner (Owner's view, then the holder Omar's view):
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 13 | CC-005 Override | "Override reservation" (destructive; reason filled) | NAVIGATE | CC-005 Overridden | dissolve |
| 14 | CC-005 Override | "Wait instead" / close X | — | none (no Owner non-dialog frame on p43) | — — U-11 |
| 15 | CC-005 Overridden | "Copy notes" | — | none (no feedback frame) | — |
| 16 | CC-005 Overridden | Breadcrumb "Calling Queue" | NAVIGATE | CC-001 D-L | dissolve — U-11 |
B3-Q05 late save: working default **Alt B** (policy-defaults); the drawn label is unchanged. Save is disabled on Overridden, so it has no hotspot.

Mobile recovery (Light):
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 17 | CC-005 M Expired | "Start contact again" | NAVIGATE | CC-003 M-L | dissolve |
| 18 | CC-005 M Expired | "Discard draft" / back chevron | NAVIGATE | CC-002 M-L | dissolve |

---

## F4 — P7 — Call Center — Follow-ups calendar
Start frame: **CC-004 D-L**
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | CC-004 D-L | Segmented "Week" | NAVIGATE | CC-004 Week | instant |
| 2 | CC-004 Week | Segmented "List" | NAVIGATE | CC-004 D-L | instant |
| 3 | CC-004 D-L | Row "Reschedule" (Olive & Thyme Café) | NAVIGATE | CC-006 Reschedule | smart-animate |
| 4 | CC-006 Reschedule | "Save new time" (reason required) | NAVIGATE | CC-006 Success | smart-animate — U-4 |
| 5 | CC-006 Reschedule | "Cancel" / close X | NAVIGATE | CC-004 D-L | smart-animate |
| 6 | CC-004 D-L | Row "Cancel" (Olive & Thyme Café) | NAVIGATE | CC-004 Cancel | smart-animate |
| 7 | CC-004 Cancel | D2 radios "Set callback to be scheduled" / "Schedule a replacement follow-up now" | — | none (D6) — drawn option 1 = working default (D2 marker) | — |
| 8 | CC-004 Cancel | "Cancel follow-up" (reason entered) | NAVIGATE | CC-004 D-L | smart-animate — U-2 |
| 9 | CC-004 Cancel | "Keep follow-up" / close X | NAVIGATE | CC-004 D-L | smart-animate |
| 10 | CC-004 D-L | "Schedule follow-up" | NAVIGATE | CC-006 Create | smart-animate |
| 11 | CC-006 Create | "Save follow-up" | NAVIGATE | CC-006 Success | smart-animate |
| 12 | CC-006 Success | Toast close X | NAVIGATE | CC-004 D-L | dissolve |
| 13 | CC-004 D-L | Row "Complete" | — | none (no Completed frame) | — |
| 14 | CC-004 D-L | Today agenda event "Call back Olive & Thyme Café" | NAVIGATE | CC-002 D-L | dissolve |
Mobile (Light):
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 15 | CC-004 M-L | Row Reschedule / Schedule action (labels to verify) | NAVIGATE | CC-006 M Create | smart-animate — U-8 |
| 16 | CC-006 M Create | Save | NAVIGATE | CC-004 M-L | smart-animate |
| 17 | CC-006 M Create / M Past time | Cancel / close | NAVIGATE | CC-004 M-L | smart-animate |

## F5 — P7 — Call Center — Opportunities (CC-007)
Start frame: **CC-007 D-L**
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | CC-007 D-L | Select "Choose a developer" | — | none (dropdown not drawn open) | — |
| 2 | CC-007 D-L | "Assign developer" | NAVIGATE | CC-007 Dev assigned | dissolve |
| 3 | CC-007 D-L | "Schedule first meeting" (enabled with no developer; review-43 minor) | — | none — U-13 | — |
| 4 | CC-007 Dev assigned | "Schedule first meeting" | OPEN_URL | SCR-DEV-004 Desktop Light — Reschedule (304:13135) | — — U-13 |
| 5 | CC-007 Dev assigned | Toast close X | NAVIGATE | CC-007 Dev assigned (self) | instant |
| 6 | CC-007 D-L / Dev assigned | Header "Calling queue" | NAVIGATE | CC-001 D-L | dissolve |
Filter chips, "Edit handoff context", row "…" menus and "Reassign developer": unwired (no target frames).

## F6 — P7 — Call Center — Do-not-call list (CC-008)
Start frame: **CC-008 D-L**
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | CC-008 D-L | "Open business" | NAVIGATE | CC-002 D-L Rejected | dissolve |
| 2 | CC-008 D-L | "Start Contact" / "Reopen…" (both disabled; DEC-016) | — | none | — |
| 3 | CC-008 D-L | "Request correction" | OPEN_URL | SHR-009 Desktop Light (310:13530) | — |
| 4 | CC-008 D-L | Header "Calling queue" | NAVIGATE | CC-001 D-L | dissolve |
| 5 | CC-002 D-L Rejected | Breadcrumb "Calling Queue" | NAVIGATE | CC-001 D-L | dissolve |
Owner sub-path (its own flow, "(Owner reopen)"): CC-008 Owner reopen, dialog "Reopen business" → CC-008 Reopened (dissolve); its "Cancel" → none. DEC-016 default: Owner only, reason required, outcome back to Pending.

## F7 — P7 — Call Center — Request correction
Start frame: **CC-002 D-L**. Cross-page only; SHR-008/009 live on page 42.
| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | CC-002 D-L | "Request correction" | OPEN_URL | SHR-009 Desktop Light — Open request warning (310:13530) | — |
| 2 | CC-003 D-L / On hold / Rejected / Accepted | "Request correction" | OPEN_URL | SHR-009 Desktop Light (310:13530) | — |
| 3 | CC-005 Reserved / Expiring / Expired / Network loss / Overridden | "Request correction" | OPEN_URL | SHR-009 Desktop Light (310:13530) | — |
| 4 | CC-008 D-L | "Request correction" | OPEN_URL | SHR-009 Desktop Light (310:13530) | — |
| 5 | CC-002 M-L / M-D | "Request correction" | OPEN_URL | SHR-009 Mobile Sheet (310:14186) | — |
| 6 | CC-003 M-L / M-D | "Details · Request correction" | OPEN_URL | SHR-008 Mobile Light (310:13164); SHR-008 → SHR-009 is wired by Data Entry on p42 | — |
Return from page 42 is the reviewer's browser back (U-14).

---

## Unclear hotspots / open items
**CC-P7-1 status:** U-1 skipped (no frame). U-2 ends at the closest frame. U-3 gets no reaction. U-4/U-6 are D3 mismatches → Phase 8. U-5/U-7 are separate flows. U-8 is found by text, and misses are reported. U-9 Dark ends at CC-001 M-D. U-10 is separate flows (no AFTER_TIMEOUT). U-11 "Wait instead" is unwired. U-12 is unwired. U-13 is wired from Developer assigned only. U-14 uses 310:*. U-15 is resolved by policy-defaults (see Decisions). U-16 is reported by the scripts.

- **U-1 Pending:** not a selectable outcome; no Pending-business workspace frame. Pending rows stay unwired unless the orchestrator approves routing them to CC-002 D-L (Olive) as a stand-in.
- **U-2 No desktop success frames:** CC-003 "Save attempt" (Needs another call, On hold) and CC-004 "Cancel follow-up" have no post-save frame; routed to CC-004 D-L / CC-001 D-L, which show pre-save data. Alternative: a tiny connector frame (needs orchestrator approval).
- **U-3 "Save, keep reservation" / mobile "Keep reserved":** no feedback frame; wired as self-navigation (no visible change). Confirm, or leave unwired.
- **U-4 CC-006 Success** names Cedar Home Realty (Create scenario); reaching it after rescheduling Olive is a data mismatch.
- **U-5 CC-006 Past time rejected / Save conflict** (desktop and mobile): no clickable inbound hotspot (the date field is not a button).
- **U-6 Rejected → CC-008** lists Harbor Auto Care, not Olive; no "Olive rejected" frame.
- **U-7 CC-003 Save failed / Save conflict:** no inbound hotspot; their button labels must be checked by name in the script.
- **U-8 Labels not verified from PNG:** CC-005 Stale client primary button, CC-005 M Reserved back action, CC-004 Mobile row actions, CC-008 Owner reopen buttons. Scripts should find them by text and report misses.
- **U-9 Mobile Dark:** no CC-003 Mobile Dark Success, no Dark mobile CC-005/006 frames, no Dark SHR-008/009 mobile targets.
- **U-10 Timer states:** Expiring → Expired and Network loss → Expired use the banner as a demo hotspot. Alternative: AFTER_TIMEOUT (outside the brief unless approved).
- **U-11 Owner override:** "Wait instead" has no Owner non-dialog frame on p43 (could OPEN_URL SCR-OWN-007 237:22788 on p41). Overridden is Omar's view; its "Calling Queue" lands on Maya's queue.
- **U-12 Mobile "More" tab:** no target.
- **U-13 CC-007 "Schedule first meeting":** SCR-DEV-004 has no Create/Schedule state, only "Reschedule" (304:13135). On CC-007 D-L the button is enabled without a developer; left unwired.
- **U-14 Request correction:** spec IDs `175:10802`, `175:10448`, `175:9043` are stale; use 310:* by frame name. OPEN_URL has no return path.
- **U-15 Policy defaults:** `docs/policy-defaults.md` is missing, so D4 (Rejected open follow-ups), D2 (cancel the last follow-up), B3-Q05 (late save) and DEC-016 (reopen outcome) are **default TBD**. The drawn D2 dialog already shows option 1 selected.
- **U-16 Instance hotspots:** outcome RadioCards, segmented controls, nav items and table rows are DS instance children; any that refuse a reaction are reported, with no workaround.
