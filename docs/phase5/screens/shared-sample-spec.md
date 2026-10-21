# Phase 5 — Shared Sample Spec: S1 Login and S6 My Day Mobile

Owner: Shared / Authentication / Attendance Screen Agent. Version P5-SH-1, 2026-10-20. Status: **proposed visual sample, not approved.**
Target: file `GNrhb3DWa6mIhEX6F4Nmvw`, page `30 HiFi — Visual Sample` (`36:4`), sections `S1 Login` and `S6 My Day Mobile` (names exact).
Authority: `docs/phase5/brief.md`. The agent prepares scripts only; the orchestrator runs them (brief §2).

## 0. Sources and low-fi baseline

| Screen | Low-fi row | Desktop | Mobile | State frames used as reference |
|---|---|---|---|---|
| SCR-AUTH-001 Login | `14:2` | `14:5` | `14:34` | `14:63` Validation error · `14:75` Invalid credentials · `14:86` Deactivated · `14:97` Session expired · `14:108` Loading |
| SCR-AUTH-002 Owner 2FA challenge | `14:119` | `14:122` | `14:154` | `14:210` R11-a · `14:220` R11-b · `14:186` Wrong/expired code |
| SCR-SHR-001 My Day | `19:234` | `19:237` | `19:432` | `19:533` Checked in · `19:569` Empty work list · `19:579` Insufficient work |
| SCR-SHR-002 Check-in flow | `19:631` | — | `19:739` | `19:794` Verifying · `19:805` Success + punctuality · `19:820` Verification failure |
| SCR-SHR-003 Checkout + work summary | `20:3812` | — | `20:3919` | `20:3973` Summary empty · `20:3985` Verification failure · `20:4001` Alt A · `20:4016` Alt B · `20:4031` Alt C |

Phase 2: WF-ATT-001 (check-in: office check per DEC-009 → open session → derived punctuality → active panel with timer, 9 h progress and work list) and WF-ATT-002 (checkout: office check → summary rule DEC-012 → close → duration vs 9 h; failed office check → DEC-026 Alt A/B/C, none selected; "the session is never closed or blocked silently"). WF-AUTH-001 (sign-in; Owner admin access requires completed 2FA; R-11 open).

Fixed design decisions carried from low-fi (not reopened): no "Keep me signed in" checkbox (implies a session-lifetime decision); invalid-credentials message is generic; attendance does **not** gate the work list (A1); SHR screens use the Call Center role as the representative shell.

## 1. Component names used (provisional)

`docs/phase5/design-system.md` does not exist yet. The names below are my best guesses, aligned with the brief. **[P]** = provisional name, to be replaced with the DS Agent's exact name and node ID before scripts are written. Items marked **REQ** are component requests (see §5).

| Use | Component (provisional) | Variants / props expected |
|---|---|---|
| Logo | `Brand/Logo (placeholder — awaiting supplied file)` (name fixed by brief) | size: sm / md |
| Text field | `Input/Text` [P] | state: default / focus / error / disabled; props: label, value, helper/error text, leading icon, trailing action (show/hide) |
| Password field | `Input/Password` [P] (or `Input/Text` with trailing "Show" action) | as above |
| Buttons | `Button` [P] | variant: primary / secondary / ghost / danger; size: md / lg; state: default / hover / loading / disabled; full-width boolean |
| Text link | `Link` [P] | default / hover |
| Inline alert | `Alert/Inline` [P] | tone: info / success / warning / danger; props: title, body, optional action |
| Policy label | `Notice/Policy pending` (name fixed by brief) | props: DEC ID, short text; compact (chip) / block |
| Status chip | `Badge/Status` [P] | tone: neutral / info / success / warning / danger |
| Card | `Card` [P] | padding md/lg; optional header |
| Mobile header | `Shell/Mobile/Header` [P] | title, right action (avatar) |
| Mobile tab bar | `Shell/Mobile/TabBar` [P] — **REQ** if role tab sets are not variants | role: CallCenter (My Day · Queue · Follow-ups · More), active tab |
| Attendance timer | `Attendance/Timer` [P] — **REQ** | state: not checked in / checked in / closed; props: elapsed, since time |
| Progress bar | `Progress/Bar` [P] | value 0–100; tone: brand / warning; label + value text |
| Verification row | `Attendance/VerificationStatus` [P] — **REQ** (or compose from `Badge/Status` + text) | state: verifying / passed / failed / remote exception |
| List item | `List/Item` [P] | leading icon, title, meta, trailing chip/chevron |
| Target progress | `Progress/Target` [P] (or `Progress/Bar` with label) | value, target text |
| Segmented / alt cards | `Card` with header "Alt A — not selected" (no new component) | — |
| Text area | `Input/TextArea` [P] | default / error; label, helper, counter |
| Divider | `Divider` [P] | — |
| Icons | `Icon/*` [P]: mail, lock, eye, clock, map-pin/wifi (office), check-circle, alert-triangle, shield, list, phone | 16 / 20 / 24 |

Variables: bind fills, strokes and text colours to semantic variables only (expected names, provisional: `bg/canvas`, `bg/surface`, `bg/subtle`, `text/primary`, `text/secondary`, `text/inverse`, `border/default`, `brand/primary` (navy), `brand/accent` (teal), `status/success`, `status/warning`, `status/danger`, `status/info`, `focus/ring`). Spacing/radius via DS number variables if provided. Dark frames use `setExplicitVariableModeForCollection(<colour collection>, <Dark mode id>)` on the frame.

## 2. Section S1 Login (desktop, light)

### 2.1 Frames in the section

| Frame name (exact) | Size | Position in section |
|---|---|---|
| `SCR-AUTH-001 Login — Desktop — Light` | 1440×900 | x 0, y 0 |
| `SCR-AUTH-001 Login — State — Invalid credentials` | 480×auto | x 1520, y 0 |
| `SCR-AUTH-001 Login — State — Session expired` | 480×auto | x 1520, y 340 |
| `SCR-AUTH-002 Owner 2FA — State — Step and R-11 readings` | 480×auto | x 2080, y 0 |

State frames show only the card region (same convention as low-fi), captioned `STATE · …` in `text/secondary`, Semi Bold 12, uppercase.

### 2.2 Main frame layout (1440×900)

- **Background:** `bg/canvas`. Two-column split, no app shell (signed-out screen).
  - **Left brand panel** 600×900, fill `brand/primary` (deep navy). Auto layout vertical, padding 64, gap 24, space-between.
    - Top: `Brand/Logo (placeholder — awaiting supplied file)` instance, md, on a neutral box (the placeholder itself carries the label; do not restyle it into a logo).
    - Middle: Heading "Udigity Management System" (Inter Semi Bold 32/40, `text/inverse`); body "Attendance, businesses, calls and projects in one place." (Regular 16/24, `text/inverse` at secondary tone — use `text/inverseSecondary` if the DS provides it, else `text/inverse`).
    - Bottom: caption "Internal system · authorised Udigity staff only" (Regular 13, inverse secondary). Optional thin teal rule (`brand/accent`, 48×3) above the caption.
  - **Right panel** 840×900, `bg/canvas`, content centred.
    - **Login card** `Card`, width 440, padding 40, radius per DS, fill `bg/surface`, border `border/default`, subtle shadow per DS elevation token. Auto layout vertical, gap 20.

### 2.3 Card contents and exact copy (default state)

1. Title "Sign in" — Semi Bold 24/32, `text/primary`.
2. Subtitle "Use your Udigity work email and password." — Regular 14/20, `text/secondary`.
3. `Input/Text` — label "Email", placeholder "name@udigity.example", leading `Icon/mail`. State: default (empty, placeholder style).
   - Note: fictional domain; `example` suffix keeps it non-real.
4. `Input/Password` — label "Password", placeholder "Enter your password", leading `Icon/lock`, trailing action "Show" (toggle). State: focus (to demonstrate the focus ring `focus/ring`).
5. Row (space-between): left empty; right `Link` "Forgot password?" (→ SCR-AUTH-004).
6. `Button` primary, lg, full width: "Sign in".
7. `Divider`.
8. Owner 2FA note — small info row, `Icon/shield` + text (Regular 13/18, `text/secondary`): "Owner accounts confirm a second step (2FA) after signing in."
9. `Notice/Policy pending` compact: "R-11 pending — what an Owner may do before 2FA is complete".

Footer below card (outside, centred, 16 px gap): "© 2026 Udigity · Need access? Ask the Owner/Admin." Regular 12, `text/secondary`.

Intended interactions (annotation only, no prototype): Sign in → loading state on button ("Signing in…", disabled) → role home; Owner → SCR-AUTH-002. "Show" toggles masking. Enter submits.

### 2.4 State frame — Invalid credentials (and validation)

Card copy as default, plus at top of card (above the Email field):
- `Alert/Inline` tone danger, title "Email or password is incorrect.", body "Check both and try again." (generic message; never says which field is wrong).
- Email field filled "maya.khoury@udigity.example" (neutral); Password field cleared, **default (neutral)** state. Neither field is shown in error state: a red border on one field would reveal which credential failed (Final pass MF-18).
- Caption: `STATE · Invalid credentials`.
- Annotation (Regular 12, `text/secondary`): "Lockout/throttle wording is an implementation decision (no DEC ID)." — render via `Notice/Policy pending` variant "implementation decision" if the DS provides one; otherwise plain note text.

### 2.5 State frame — Session expired

- `Alert/Inline` tone info (or warning), `Icon/clock`, title "Your session has ended.", body "Sign in again to continue. Unsaved changes on the previous page may not have been kept."
- Email prefilled "maya.khoury@udigity.example", Password empty default, primary button "Sign in".
- Caption: `STATE · Session expired (return notice from SCR-SHR-013)`.
- Optional second line of caption: "Session lifetime: implementation decision."
- Deactivated account cue (one line under the caption, not a separate frame): alert copy "This account is not active. Contact the Owner/Admin." tone danger — shown as a small `Alert/Inline` stacked below the session-expired card, labelled `STATE · Deactivated account`.

### 2.6 State frame — Owner 2FA step and R-11

Card (width 440):
- `Brand/Logo` placeholder sm at top.
- Title "Confirm it's you" (Semi Bold 22). Body "Enter the 6-digit code from your authenticator for rana.haddad@udigity.example." (Regular 14, secondary).
- `Input/Text` label "Verification code", placeholder "000 000", state default.
- `Button` primary full width "Verify"; `Link` "Use a recovery code"; `Button` ghost "Sign out".
- `Notice/Policy pending` block, title "R-11 pending — not selected", body two lines:
  - "R11-a: nothing is available until 2FA is complete."
  - "R11-b: only admin actions wait; Check in is allowed."
- Below the card, two compact side-by-side `Card`s (each 212 wide), header chips `Badge/Status` neutral "R11-a · not selected" / "R11-b · not selected":
  - R11-a body: "Pending-2FA session: all business screens locked."
  - R11-b body: "Pending-2FA session: My Day Check in available; Owner admin screens locked."
- Caption: `STATE · Owner 2FA step (SCR-AUTH-002) — both R-11 readings shown`.
- Note: 2FA method is an implementation decision; the code entry is illustrative.

## 3. Section S6 My Day Mobile (390×844, light and dark)

Representative user: **Maya Khoury, Call Center** (low-fi convention). Date: **Tuesday 20 October 2026**. Now 14:32. Checked in 08:58 (Final pass: aligned with the S3 top bar "Checked in · 08:58").

### 3.1 Frames in the section

| Frame name (exact) | Size | x | Mode |
|---|---|---|---|
| `SCR-SHR-001 My Day — Mobile — Light` | 390×844 | 0 | Light |
| `SCR-SHR-001 My Day — Mobile — Dark` | 390×844 | 470 | Dark (explicit mode on frame) |
| `SCR-SHR-003 Checkout — Mobile — Light — Verification failure` | 390×844 | 940 | Light |
| `SCR-SHR-003 Checkout — Mobile — Dark — Verification failure` | 390×844 | 1410 | Dark |

Light and dark frames are built from the same script function; the dark frame only differs by the explicit variable mode. All frames: `clipsContent = true`, fill `bg/canvas`.

### 3.2 My Day — layout regions (top to bottom)

| Region | y / height | Content |
|---|---|---|
| Status bar spacer | 0 / 44 | empty, `bg/surface` |
| Header | 44 / 56 | `Shell/Mobile/Header`: title "My Day", subtitle "Tue 20 Oct 2026"; right: avatar initials "MK" |
| Scroll content | 100 / 660 | auto layout vertical, padding 16, gap 12 (content may be clipped at the bottom; that is intended scroll) |
| Tab bar | 760 / 84 | `Shell/Mobile/TabBar` CallCenter, active "My Day"; tabs: My Day · Queue · Follow-ups · More |

### 3.3 Scroll content — cards and exact copy

**A. Attendance card** (`Card`, full width 358, padding 16, gap 12)
1. Row: title "Attendance" (Semi Bold 16) — right `Badge/Status` success "Checked in".
2. `Attendance/Timer` state checked in: large value "5:28:14" (Semi Bold 36/44, tabular figures, `text/primary`), caption "Since 09:04 · today".
3. `Progress/Bar` brand (teal fill `brand/accent` on `bg/subtle` track), value 61: label left "Toward 9 h workday", label right "5 h 28 m of 9 h".
   - `Notice/Policy pending` compact under it: "DEC-007/008 pending — schedule and grace; 9 h shown as working assumption".
4. Punctuality row: `Icon/clock` + "Punctuality" + `Badge/Status` neutral "On time · derived". (Derived value, illustrative; depends on DEC-007/008.)
5. Verification row: `Attendance/VerificationStatus` passed — `Icon/check-circle` (success) + "Office check passed at check-in" + meta "09:04".
   - `Notice/Policy pending` compact: "DEC-009 pending — office check mode (IP / location / either / both)".
6. `Button` secondary, lg, full width: "Check out" (→ SHR-003).

**B. Today's targets card** (`Card`, gap 10)
- Title "Today's targets" + `Notice/Policy pending` compact "DEC-020 pending — target metrics".
- `Progress/Target` "Calls completed" — "7 of 20" (value 35).
- `Progress/Target` "Follow-ups done" — "2 of 5" (value 40).

**C. My work list card** (`Card`, gap 0, header + list)
- Header row: "My work list" (Semi Bold 16) + meta "6 items" + `Link` "See all".
- `List/Item` ×4 (leading `Icon/phone` or `Icon/list`, title, meta, trailing chip):
  1. "Peak Fitness Gym" — "Follow-up due 15:00 · +000 70 000 102" — chip warning "Due today".
  2. "Bloom Florist" — "New call · Shop" — chip neutral "To call".
  3. "Olive & Thyme Café" — "New call · Café" — chip neutral "To call".
  4. "Nova Dental Clinic" — "Follow-up due Wed 21 Oct · +000 70 000 107" — chip info "Upcoming".
- Footer caption (Regular 12, secondary): "Work list is available without checking in."

**D. Checkout reminder note** (plain row below cards, Regular 12, secondary): "At checkout you will add a work summary." + `Notice/Policy pending` compact "DEC-012 pending — summary mandatory or optional".

### 3.4 Checkout — verification failure variant (SHR-003)

Header: `Shell/Mobile/Header` title "Check out", left back chevron. Tab bar hidden (focused flow). Content padding 16, gap 12; sticky footer 96 high.

1. Summary card (`Card`):
   - "Today" — "Checked in 09:04 · now 18:06 · 9 h 02 m" ; `Progress/Bar` value 100, label "9 h 02 m of 9 h".
2. Work summary: `Input/TextArea` label "Work summary", value "Called 18 businesses; booked 2 meetings for Lina Aoun (Peak Fitness Gym, Lumen Yoga Studio); 3 follow-ups rescheduled.", helper "Shown to the Owner in reports.", counter "142 / 1000".
   - Label badge right of field label: `Notice/Policy pending` compact "DEC-012 pending — required or optional".
3. Verification result: `Alert/Inline` danger, `Icon/alert-triangle`, title "Office check failed", body "We could not confirm you are at the office. Connect to the office network or allow location, then try again." Action `Button` secondary sm "Retry check".
   - `Notice/Policy pending` compact: "DEC-009 pending — which check applies".
4. Outcome block: heading "What happens next — DEC-026 pending (none selected)" (Semi Bold 14). Three stacked compact `Card`s, each with `Badge/Status` neutral "not selected":
   - "Alt A · Blocked" — "Checkout is not recorded. Your session stays open until a check passes."
   - "Alt B · Closed provisionally" — "Checkout is recorded as provisional and sent to the Owner for review."
   - "Alt C · Pending review" — "Session is held for Owner review. Whether this blocks your next check-in is open."
5. Sticky footer: `Button` primary lg full width "Check out · outcome per DEC-026" — state **default** (not disabled; a disabled button would present Alt A as decided), plus `Button` ghost lg full width "Cancel" (≥ 44 px). See Final pass.
   - Line: "Your session is never closed or blocked silently." (Regular 12, secondary) — from WF-ATT-002 postcondition.

Content may exceed 678 px visible height; the frame clips (scroll intended). If it overflows badly, the Alt cards drop to 2-line bodies.

### 3.5 Dark variants

Identical structure; explicit Dark mode on the frame. Check (to report after build): `text/primary` on `bg/surface`, `text/secondary` on `bg/surface`, teal progress fill vs track (non-text 3:1), badge text vs badge fill, danger alert text vs alert fill. Contrast numbers come from the DS Agent's computed pairs; I will flag any pair used here that the DS has not computed.

## 4. Policy labels shown (brief §6 check)

| Label | Where |
|---|---|
| R-11 (Owner pending-2FA) | Login card note; 2FA state frame (both readings, not selected) |
| DEC-009 (office verification mode) | My Day verification row; Checkout failure alert |
| DEC-012 (summary mandatory?) | My Day checkout note; Checkout work summary field |
| DEC-026 (failed checkout) | Checkout Alt A/B/C cards, footer button annotation |
| DEC-007/008 (schedule, grace) | My Day 9 h progress; punctuality "derived" |
| DEC-020 (target metrics) | My Day targets card (extra; affects this screen) |
| Impl. decisions (no DEC ID) | Lockout wording, session lifetime, 2FA method — plain notes |

No pending policy is resolved in the visuals; all alternatives are labelled "not selected".

## 5. Component requests (to DS Agent via orchestrator)

1. `Attendance/Timer` — states not checked in / checked in / closed; large tabular figure + caption.
2. `Attendance/VerificationStatus` — verifying / passed / failed / remote exception (icon + text + time). Can be dropped if `Badge/Status` + `Icon` + text is the DS answer.
3. `Shell/Mobile/TabBar` with a Call Center tab set (My Day · Queue · Follow-ups · More) and an active-tab property; `Shell/Mobile/Header` with title, subtitle, avatar and optional back chevron.
4. `Notice/Policy pending` needs a **compact chip** form (single line, fits under a field label at 358 px width) and a **block** form (title + 2 body lines). An "Implementation decision" tone/variant would be useful.
5. `Input/Password` (or `Input/Text` trailing-action prop "Show") and `Input/TextArea` with counter.
6. `Progress/Bar` with label-left / value-right text props and brand/warning tones.
7. Inter tabular figures for the timer (font feature, or a numeric text style).

## 6. Script plan (STEP 2, after DS IDs arrive)

- `docs/phase5/scripts/shared/01-s1-login.js` — page `36:4`; find-or-create section `S1 Login`; find-or-replace the four frames by name; instances only; returns frame and instance IDs.
- `docs/phase5/scripts/shared/02-s6-myday.js` — page `36:4`; find-or-create section `S6 My Day Mobile`; one builder per screen called with mode Light/Dark; dark via `setExplicitVariableModeForCollection` on the frame; returns IDs.
- Both idempotent (remove and rebuild named frames inside the section), fonts loaded first, under 45,000 chars.

- **Repair round 2 (2026-10-21):** Checkout summary uses the Progress/Bar with labels hidden plus a local row above it (label fills and wraps, value "9h 02m of 9h" hugs), so the value is never clipped; the complete bar paints its Track with the Fill paint. Light and dark unchanged.
- **Final pass (2026-10-21, consolidated review MF-13/14/15/18):**
  - MF-18 (S1 invalid credentials): both fields neutral (email filled, password cleared to placeholder); only the generic banner "Email or password is incorrect." signals the error. Caption now `STATE · Invalid credentials`; the implementation note says both fields stay neutral.
  - MF-13 (S6 My Day): the Day rules inset now sits directly under the attendance panel (above the fold) with the punctuality row "Check-in 08:58 · On time" + `Chip/Derived` "Derived" and `Notice/Policy pending` Inline "DEC-007/008 — Pending: schedule & grace. 9 h workday and "On time" are working assumptions."; the progress label reads "Toward 9 h workday (assumed)". Maya's check-in is 08:58 everywhere (timer 05:34:14, 5h 34m of 9h; checkout 9h 08m).
  - MF-14 (S6 Checkout failure): the footer primary is no longer disabled (that presented DEC-026 Alt A as decided). It is a default Primary "Check out · outcome per DEC-026" with the note "Result depends on DEC-026 (none selected). Your session is never closed or blocked silently." Each Alt card states its own outcome ("If chosen, Check out: …") and stays "not selected".
  - MF-15 (S6 Checkout): "Retry check" is a full-width Secondary Large button (DEC-009 chip on its own row) and "Cancel" is a full-width Ghost Large button, both ≥ 44 px. Footer 164 px high (y 680), content area 624 px.
  - Unchanged: light/dark built by the same function (dark = explicit mode), idempotent rebuild of named frames, no x/y/size set on instance children.
