# Phase 7 — Shared flows (page 40 `96:2` Auth, Shared & Employees · page 45 `96:7` Cross-cutting States)

Shared role agent, 2026-10-23. **Updated after [OP-P7-1] and [P7-1]:** the open issues are resolved and the scripts are written. See **"Resolutions (P7-1) and scripts"** at the end; where it differs from the flow tables below, the resolutions section wins.

**Sources:**
- `docs/phase7/brief.md`
- `docs/phase6/interaction-spec.md` (Shared section)
- `docs/phase6/screens/shared-spec.md`
- the SCR-AUTH and SCR-SHR rows of `docs/phase6/screen-register.md`
- `docs/phase6/previews/40/index.md` and `previews/45/index.md`, plus their PNGs
- `docs/phase3-4/sitemap.md`
- the Phase 6 build scripts `docs/phase6/scripts/shared/A01–A08, D01–D03`, which are the source of the layer names below

**Policy defaults:** every step marked **default TBD** below is now resolved from `docs/policy-defaults.md` (DEC-010, DEC-011, DEC-012, DEC-026). See the resolutions section.

**Note on the brief:** the correction-request drawer is **SCR-SHR-005** (script A07). SCR-SHR-007 is Notifications.

## Conventions

- **Targets.** Targets are frame names (brief rule 2); the IDs in `[ ]` are fallbacks only. Cross-page targets use `URL(id)` = `https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=<id with ->`.
- **Hotspot naming.** Each hotspot is given as the visible label, followed by `«layer name»` from the Phase 6 scripts. Nested names are written as `Parent › Child`. Reactions go on instance children as overrides; nothing is detached, moved or resized.
- **Dialogs and drawers.** Check-in, checkout and the correction request are drawn as full frames with the scrim baked in, so they are wired as NAVIGATE, not overlays.
- **Transitions:**
  - page → page: `Dissolve 200 ms`
  - open a dialog or drawer: `Dissolve 150 ms`
  - state change in the same dialog or drawer: `Smart Animate 200 ms`
  - Close, Cancel and × use BACK, unless the history would be wrong (stated per step)
  - OPEN_URL: new tab off
- **Theme.** Light frames only, except **My Day and check-in/out on mobile, which also get Dark**. These are mobile-priority journeys, so rule 4 applies.
- **Representative user.** Page 40 is drawn as the Call Center agent (Maya Khoury). Page 45 uses the Developer shell (Lina Aoun), except SHR-012 and SHR-013 (Call Center) and SHR-014 desktop (Data Entry).

### Frame abbreviations (expand to the full name when scripting)

| short | full frame name | id |
|---|---|---|
| `LOGIN L` / `LOGIN M` | `SCR-AUTH-001 — Login — Desktop — Light` / `— Mobile — Light` | 169:10438 / 169:10607 |
| `LOGIN Expired` | `SCR-AUTH-001 — Login — Desktop — Light — Session expired` | 169:10912 |
| `LOGIN Invalid`, `LOGIN Validation`, `LOGIN Deactivated`, `LOGIN Loading` | `… — Desktop — Light — Invalid credentials` / `Validation error` / `Deactivated account` / `Loading` | 169:10751 / 169:10681 / 169:10832 / 169:10992 |
| `2FA L` / `2FA M` | `SCR-AUTH-002 — Owner 2FA challenge — Desktop — Light` / `— Mobile — Light` | 169:11080 / 169:11239 |
| `2FA Wrong`, `2FA Fail`, `2FA R11a`, `2FA R11b`, `2FA Success` | `… — Desktop — Light — Wrong or expired code` / `Verification failure` / `R11-a reading (not selected)` / `R11-b reading (not selected)` / `Success` | 169:11310 / 169:11383 / 169:11462 / 169:11556 / 169:11648 |
| `ENROL L` | `SCR-AUTH-003 — Owner 2FA enrollment & recovery — Desktop — Light` | 170:81934 |
| `ENROL Codes`, `ENROL Fail`, `ENROL Recover`, `ENROL Used`, `ENROL RecFail`, `ENROL Success` | `… — Light — Save recovery codes` / `Verification failure` / `Recover lost factor` / `Recovery used` / `Recovery failed` / `Success` | 170:82147 / 170:82265 / 170:82351 / 170:82422 / 170:82467 / 170:82510 |
| `RESET L` / `RESET M` | `SCR-AUTH-004 — Forgot / reset password — Desktop — Light` / `— Mobile — Light` | 170:82569 / 170:82675 |
| `RESET Sent`, `RESET New`, `RESET Expired`, `RESET Rule`, `RESET Success` | `… — Light — Request sent` / `Set new password` / `Link expired or used` / `Password rule error` / `Success` | 170:82720 / 170:82773 / 170:82836 / 170:82883 / 170:82945 |
| `DAY L` / `DAY D` | `SCR-SHR-001 — My Day — Desktop — Light` / `— Dark` (checked in) | 303:10513 / 303:10866 |
| `DAY ML` / `DAY MD` | `SCR-SHR-001 — My Day — Mobile — Light` / `— Mobile — Dark` (checked in) | 303:11195 / 303:11447 |
| `DAY NotIn`, `DAY OpenSess`, `DAY Empty`, `DAY Insuff`, `DAY Loading` | `… — Desktop — Light — Not checked in` / `Open session from earlier day` / `Empty work list` / `Insufficient work` / `Loading` | 303:11699 / 303:12029 / 303:12328 / 303:12581 / 303:12886 |
| `CI L` (Success) | `SCR-SHR-002 — Check-in — Desktop — Light` | 186:10469 |
| `CI ML` / `CI MD` | `SCR-SHR-002 — Check-in — Mobile — Light` / `— Mobile — Dark` | 186:11076 / 186:11147 |
| `CI Verifying`, `CI Fail`, `CI Block`, `CI Remote` | `… — Desktop — Light — Verifying` / `Verification failure` / `Open-session block` / `Remote exception recorded` | 186:11216 / 186:11473 / 186:11739 / 186:11990 |
| `CO L` | `SCR-SHR-003 — Checkout — Desktop — Light` | 187:10469 |
| `CO ML` / `CO MD` | `SCR-SHR-003 — Checkout — Mobile — Light` / `— Mobile — Dark` | 187:11125 / 187:11197 |
| `CO Empty`, `CO Fail`, `CO AltA`, `CO AltB`, `CO AltC`, `CO Closed` | `… — Desktop — Light — Summary empty` / `Verification failure` / `DEC-026 Alt A blocked (not selected)` / `DEC-026 Alt B provisional (not selected)` / `DEC-026 Alt C pending review (not selected)` / `Closed` | 187:11267 / 187:11591 / 187:11929 / 187:12212 / 187:12496 / 187:12780 |
| `ATT L` / `ATT ML` | `SCR-SHR-004 — My Attendance — Desktop — Light` / `— Mobile — Light` | 188:10468 / 188:11151 |
| `ATT Empty`, `ATT Forgot`, `ATT Prov`, `ATT Outcomes`, `ATT Loading` | `… — Desktop — Light — Empty` / `Forgotten checkout flagged` / `Provisional & pending review rows (if adopted)` / `Correction outcomes` / `Loading` | 188:11333 / 188:11472 / 188:11829 / 188:12170 / 188:12513 |
| `COR L` / `COR ML` | `SCR-SHR-005 — Correction request — Desktop — Light` / `— Mobile — Light` | 118:56264 / 118:57215 |
| `COR Error`, `COR Pending`, `COR Approved`, `COR Rejected` | `… — Desktop — Light — Validation error` / `Submitted (pending)` / `Approved` / `Rejected` | 118:57304 / 118:57781 / 118:58222 / 118:58633 |
| `PRO L` / `PRO D` / `PRO ML` | `SCR-SHR-006 — My Profile — Desktop — Light` / `— Dark` / `— Mobile — Light` | 189:10468 / 189:10802 / 189:11118 |
| `PRO Error`, `PRO Conflict`, `PRO Success` | `… — Desktop — Light — Validation error` / `Save conflict` / `Success` | 189:11264 / 189:11584 / 189:11868 |
| `NOT L` / `NOT ML` | `SCR-SHR-007 — Notifications — Desktop — Light` / `— Mobile — Light` (p45) | 165:2880 / 165:3285 |
| `NOT Empty`, `NOT Gone` | `… — Desktop — Light — Empty` / `Target no longer accessible` | 165:3438 / 165:3550 |
| `DENY L` / `DENY ML` / `DENY 2FA` | `SCR-SHR-011 — Permission denied — Desktop — Light — Role denied` / `— Mobile — Light — Role denied` / `— Desktop — Light — Owner without completed 2FA` | 165:3781 / 165:3970 / 165:4032 |
| `HID L` / `HID ML` / `HID Stale` | `SCR-SHR-012 — Record hidden by policy — Desktop — Light — Direct URL` / `— Mobile — Light — Direct URL` / `— Desktop — Light — Stale link from notification or calendar` | 269:2916 / 269:3190 / 269:3262 |
| `END L` / `END ML` / `END Revoked` / `END Deact` / `END Dialog` | `SCR-SHR-013 — Session ended — Desktop — Light — Expired` / `— Mobile — Light — Expired` / `— Desktop — Light — Revoked by Owner` / `Account deactivated` / `In-app dialog (unsaved input not saved)` | 269:3418 / 269:3523 / 269:3564 / 269:3608 / 269:3652 |
| `CONF L` / `CONF ML` | `SCR-SHR-014 — Save conflict — Desktop — Light — Field-level diff` / `— Mobile — Light — Field-level diff` | 270:2918 / 270:3415 |

### Cross-page targets used (OPEN_URL)

| target | id |
|---|---|
| SCR-OWN-001 Owner dashboard, Desktop Light (Owner desktop home) | 200:22902 |
| SCR-OWN-004 Attendance monitoring, Mobile Light (Owner mobile home "Today") | 287:23936 |
| SCR-CC-001 Calling queue, D-L / M-L / M-D | 311:13767 / 311:15277 / 311:15490 |
| SCR-CC-002 Contact workspace, D-L / M-L / M-D | 312:13759 / 312:15793 / 312:15962 |
| SCR-CC-004 Follow-ups & calendar, D-L / M-L / M-D | 285:13809 / 285:15486 / 285:15628 |
| SCR-DEV-002 Deal record detail D-L · SCR-DEV-004 Meeting drawer D-L / M-L · SCR-DEV-006 Project board D-L · SCR-DEV-007 Task drawer D-L / M-L | 263:13122 · 304:13135 / 304:14544 · 228:13090 · 267:13129 / 267:15282 |
| SCR-DE-004 Edit business D-L · SCR-SHR-008 Business detail D-L | 172:9047 · 310:11808 |

**For the other role agents:** the page-40 entry targets are `DAY L` 303:10513, `ATT L` 188:10468, `PRO L` 189:10468, `DAY ML` 303:11195, and `NOT L` 165:2880 (page 45).

### Common hotspots (wire on every desktop Light frame listed per flow that carries the shell)

| hotspot | action | target | transition |
|---|---|---|---|
| sidebar `My Day` «Shell › Nav/Item · My Day» | NAVIGATE (p40) / OPEN_URL 303:10513 (p45) | DAY L | Dissolve 200 ms |
| sidebar `My Attendance` «Nav/Item · My Attendance» | NAVIGATE | ATT L | Dissolve 200 ms |
| sidebar `My Profile` «Nav/Item · My Profile» | NAVIGATE | PRO L | Dissolve 200 ms |
| sidebar `Calling Queue` «Nav/Item · Calling Queue» | OPEN_URL | 311:13767 | — |
| sidebar `Follow-ups & Calendar` «Nav/Item · Follow-ups & Calendar» | OPEN_URL | 285:13809 | — |
| top-bar bell «Shell › TopBar › Notifications» | OPEN_URL | NOT L 165:2880 | — |
| top-bar avatar/name «Shell › TopBar › Avatar» (see U-3) | NAVIGATE | PRO L | Dissolve 200 ms |
| top-bar attendance chip «Shell › TopBar › Attendance» | NAVIGATE | depends on the frame: CO L when "Checked in", CI Verifying when "Not checked in", CI Block on DAY OpenSess | Dissolve 150 ms |

"Opportunities & Handoffs" and "Do-not-call List" are left to the Call Center agent's map. Their IDs are not in my sources.

---

## Flow 1 — `P7 — Owner — Sign in with 2FA`

**Start frame:** LOGIN L [169:10438]. Navigation only: no credentials are typed or invented. The Sign in click stands for "valid credentials".

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | LOGIN L | `Sign in` «Primary action» | NAVIGATE | 2FA L | Dissolve 200 ms. The Owner branch; see U-1 |
| 2 | 2FA L | `Verify` «Primary action» | OPEN_URL | 200:22902 (SCR-OWN-001) | — |
| 3 | 2FA L | `Lost your second factor?` «Secondary row › Hit · Lost your second factor?» | NAVIGATE | ENROL Recover | Dissolve 200 ms |
| 4 | 2FA L | `Sign out` «Secondary row › Sign out» | NAVIGATE | LOGIN L | Dissolve 200 ms |

**Branches and state frames:**
- `2FA Wrong` and `2FA Fail`:
  - `Verify` / `Try again` «Primary action» → OPEN_URL 200:22902.
  - `Lost your second factor?` → ENROL Recover.
  - `Sign out` → LOGIN L.
- `2FA R11a` / `2FA R11b`: same three reactions. These are reference frames ("not selected").
- `2FA Success`: `Opening dashboard…` «Primary action» → OPEN_URL 200:22902.
- `LOGIN Invalid`, `LOGIN Validation`, `LOGIN Deactivated` and `LOGIN Loading` (state references):
  - `Forgot password?` «Forgot row › Hit · Forgot password?» → RESET L.
  - `Sign in` is not wired. These frames are what you see when sign-in fails or is in progress, so they have no forward path.

**Mobile variant (optional, same journey):**
- LOGIN M:
  - `Sign in` → 2FA M.
  - `Forgot password?` → RESET M.
- 2FA M:
  - `Verify` → OPEN_URL 287:23936 (Owner mobile home "Today").
  - `Sign out` → LOGIN M.
  - `Lost your second factor?` is **not wired**: SCR-AUTH-003 is desktop only (U-6).

### Flow 1b — `P7 — Owner — 2FA enrollment & recovery`

**Start frame:** ENROL L [170:81934]. This is the Owner's first sign-in with no factor enrolled; the Login screen cannot branch to it (U-1).

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | ENROL L | `Confirm code` «Primary action» | NAVIGATE | ENROL Codes | Smart Animate 200 ms |
| 2 | ENROL Codes | `Finish setup` «Primary action» | NAVIGATE | ENROL Success | Smart Animate 200 ms |
| 3 | ENROL Success | `Continue to dashboard` «Primary action» | OPEN_URL | 200:22902 | — |

**Other reactions:**
- ENROL L: `Sign out` «Secondary row › Sign out» → LOGIN L.
- ENROL L: `Need help?` «Link · Need help?» is not wired; there is no target (U-7).
- ENROL Codes: `Copy codes` and `Download codes` are not wired (system actions).
- ENROL Fail:
  - `Confirm code` → ENROL Codes.
  - `Start setup again` «Link · Start setup again» → ENROL L.
- **Recovery path** (entered from 2FA L, step 3):
  - ENROL Recover: `Use recovery code` «Primary action» → ENROL Used. The failure frame ENROL RecFail is a state reference only.
  - ENROL Recover: `Back to code entry` «Back» → 2FA L.
  - ENROL Used: `Set up 2FA again` «Primary action» → ENROL L.
  - ENROL RecFail: `Back to sign in` «Primary action» → LOGIN L.

---

## Flow 2 — `P7 — All roles — Forgot / reset password`

**Start frame:** LOGIN L. Step 1 is also wired on LOGIN M → RESET M.

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | LOGIN L | `Forgot password?` «Forgot row › Hit · Forgot password?» (row frame, min 44 px; preferred over the Link child) | NAVIGATE | RESET L | Dissolve 200 ms |
| 2 | RESET L | `Send reset link` «Primary action» | NAVIGATE | RESET Sent | Smart Animate 200 ms |
| 3 | RESET Sent | banner `Reset link queued` «Banner · Info» (stands in for "open the emailed link"; **U-2**) | NAVIGATE | RESET New | Dissolve 200 ms |
| 4 | RESET New | `Save new password` «Primary action» | NAVIGATE | RESET Success | Smart Animate 200 ms |
| 5 | RESET Success | `Go to sign in` «Primary action» | NAVIGATE | LOGIN L | Dissolve 200 ms |

**Other reactions:**
- `Back to sign in` «Back row › Hit · Back to sign in» → LOGIN L. Wired on RESET L, RESET Sent and RESET Expired; on RESET M it goes to LOGIN M.
- RESET Sent: `Didn't get it? Request another link` «Link · Didn't get it? Request another link» → RESET L.
- RESET Expired: `Request a new link` «Primary action» → RESET L. This frame is a state reference with no entry hotspot (U-2).
- RESET Rule: `Save new password` → RESET Success.
- RESET M: `Send reset link` is **not wired**. There is no mobile "Request sent" frame (U-6).

---

## Flow 3 — `P7 — Call Center — My Day (desktop)`

**Start frame:** DAY L [303:10513] (checked in). The common shell hotspots apply.

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | DAY L | `Open queue` «My work list › Action» | OPEN_URL | 311:13767 (SCR-CC-001) | — |
| 2 | DAY L | work item `Peak Fitness Gym` «Item · Peak Fitness Gym» (also `Bloom Florist`, `Olive & Thyme Café`, `Nova Dental Clinic`, `Sunrise Bakery`, each «Item · <name>») | OPEN_URL | 312:13759 (SCR-CC-002) | — **U-4** |
| 3 | DAY L | `Check out` «Attendance panel › Action» | NAVIGATE | CO L | Dissolve 150 ms (continues in Flow 5) |
| 4 | DAY L | top-bar chip `Checked in · 08:58` | NAVIGATE | CO L | Dissolve 150 ms |

**State frames:**
- DAY NotIn, DAY Empty and DAY Insuff get the same shell, `Open queue` and work-item reactions.
- DAY NotIn: `Check in` «Attendance panel › Action» → CI Verifying (Flow 5).
- DAY OpenSess: `Check in` is disabled (no reaction). The chip `Not checked in` → CI Block (Flow 6).
- DAY Loading: shell only.

## Flow 3m — `P7 — Call Center — My Day (mobile, Light)` and `P7 — Call Center — My Day (mobile, Dark)`

These are two flows. **Start frames:** DAY ML [303:11195] and DAY MD [303:11447]. For Dark, use the M-D targets in the same positions.

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | DAY ML / MD | `Check out` «Content › Attendance panel › Action» | NAVIGATE | CO ML / CO MD | Dissolve 150 ms (Flow 5m) |
| 2 | DAY ML / MD | `Open queue` «My work list › Action» | OPEN_URL | 311:15277 / 311:15490 | — |
| 3 | DAY ML / MD | work items «Item · <name>» (4 rows) | OPEN_URL | 312:15793 / 312:15962 | — U-4 |
| 4 | DAY ML / MD | tab `Queue` «Shell › TabBar › Tab 2» | OPEN_URL | 311:15277 / 311:15490 | — |
| 5 | DAY ML / MD | tab `Follow-ups` «TabBar › Tab 3» | OPEN_URL | 285:15486 / 285:15628 | — |
| 6 | DAY ML | header avatar `MK` «Shell › Header › Avatar» | NAVIGATE | PRO ML | Dissolve 200 ms. Light only; there is no Dark profile frame (U-3) |
| 7 | DAY ML / MD | tab `More` «TabBar › Tab 4» | not wired: no More menu frame (U-5) | — | — |

**Scroll:** the `Content` frame (390×724, clip) holds content below the fold that is annotated as intended. Set `overflowDirection = VERTICAL` on «Content». It is a plain frame, not an instance child. Apply the same setting to `ATT ML`, `COR ML`, `NOT ML`, `PRO ML` and `CI/CO ML/MD` where content clips.

---

## Flow 5 — `P7 — Call Center — Check in → check out with work summary (desktop)`

**Start frame:** DAY NotIn [303:11699].

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | DAY NotIn | `Check in` «Attendance panel › Action» (or chip `Not checked in`) | NAVIGATE | CI Verifying | Dissolve 150 ms |
| 2 | CI Verifying | `Checking in…` «Dialog · Check in › Primary action» (Loading button; **U-8**) | NAVIGATE | CI L | Smart Animate 200 ms |
| 3 | CI L | `Close` «Dialog › Secondary action» | NAVIGATE | DAY L | Dissolve 200 ms. Not BACK, because the chip now reads "Checked in" |
| 4 | DAY L | `Check out` «Attendance panel › Action» | NAVIGATE | CO L | Dissolve 150 ms |
| 5 | CO L | `Check out` «Drawer · Check out › Footer actions › Primary action» | NAVIGATE | CO Closed | Smart Animate 200 ms |
| 6 | CO Closed | `Done` «Primary action» | NAVIGATE | DAY L | Dissolve 200 ms. **U-9** |

**Branches:**
- CI Verifying: `Cancel` «Secondary action» → BACK (DAY NotIn).
- CI Verifying: the status row «Verification» is not wired. CI Fail and CI Remote are state references unless the orchestrator approves a demo hotspot (U-8).
- CI L: `Open my work list` «Primary action» → DAY L.
- CI L: dialog `×` «Dialog › Close» → DAY L.
- CI Fail:
  - `Retry check` «Primary action» → CI L.
  - `Cancel` «Secondary action» and `×` → DAY NotIn.
  - `Request remote exception` «Remote row › Link · Request remote exception» → CI Remote. **default TBD (DEC-010)**: wire it only if the working default allows remote exceptions.
- CI Remote: `Close` / `Open my work list` → DAY L.
- CO L: `Cancel` «Footer actions › Cancel» → BACK.
- CO L: drawer `×` «Drawer › Close» → BACK.
- CO Empty:
  - `Check out · per DEC-012` «Primary action» → **default TBD (DEC-012)**. If summaries are optional → CO Closed. If they are mandatory → no reaction.
  - `Cancel` → DAY L.
- CO Fail:
  - `Retry check` «Retry check» (Secondary, in the body) → CO Closed.
  - `Check out · outcome per DEC-026` «Primary action» → **default TBD (DEC-026)**: Alt A → CO AltA, Alt B → CO AltB, Alt C → CO AltC.
  - `Cancel` → DAY L.
- CO AltA: `Retry check` «Primary action» → CO Closed. `Close` «Close» → DAY L.
- CO AltB / CO AltC: `Done` «Primary action» → DAY L.

## Flow 5m — `P7 — Call Center — Check in → check out (mobile, Light)` and `(mobile, Dark)`

These are two flows. **Start frames:** CI ML [186:11076] and CI MD [186:11147]. They start on the check-in result because no "not checked in" mobile My Day frame exists (U-5).

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | CI ML / MD | `Back to My Day` «Footer › Back to My Day» | NAVIGATE | DAY ML / DAY MD | Dissolve 200 ms |
| 2 | CI ML / MD | `Open my work list` «Footer › Primary action» | NAVIGATE | DAY ML / DAY MD | Dissolve 200 ms |
| 3 | CI ML / MD | header back chevron «Header › Back» (U-3) | NAVIGATE | DAY ML / DAY MD | Dissolve 200 ms |
| 4 | DAY ML / MD | `Check out` «Content › Attendance panel › Action» | NAVIGATE | CO ML / CO MD | Dissolve 150 ms |
| 5 | CO ML / MD | `Check out` «Footer › Check out» | NAVIGATE | DAY ML / DAY MD | Dissolve 200 ms. **U-9**: there is no mobile Closed frame |
| 6 | CO ML / MD | `Cancel` «Footer › Cancel» and header back «Header › Back» | BACK | — | — |

---

## Flow 6 — `P7 — Call Center — My Attendance → correction request (SCR-SHR-005)`

**Start frame:** DAY OpenSess [303:12029]. **The whole screen depends on DEC-011 Alt B**, so this flow is **default TBD (DEC-011)**. If the working default is Alt A, keep only steps 1–3 and leave `Request correction` unwired.

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | DAY OpenSess | chip `Not checked in` «TopBar › Attendance» | NAVIGATE | CI Block | Dissolve 150 ms |
| 2 | CI Block | `View my attendance` «Dialog › Primary action» | NAVIGATE | ATT Forgot | Dissolve 200 ms |
| 3 | ATT Forgot | row `Mon 19 Oct` → `Request correction` «Sessions table › Row (2nd data row) › Table/Cell › Link» | NAVIGATE | COR L | Dissolve 150 ms |
| 4 | COR L | `Submit request` «Drawer › Footer actions › Primary action» | NAVIGATE | COR Pending | Smart Animate 200 ms |
| 5 | COR Pending | `Close` «Primary action» | NAVIGATE | ATT Outcomes | Dissolve 200 ms |
| 6 | ATT Outcomes | row `Mon 19 Oct` (Correction pending) → `View` «Row (2nd) › Link» | NAVIGATE | COR Pending | Dissolve 150 ms |

**Other reactions:**
- CI Block: `Close` «Secondary action» / `×` → BACK.
- COR L: `Cancel` «Footer actions › Cancel» and drawer `×` → BACK.
- COR Error: `Submit request` → COR Pending. `Cancel` → ATT Forgot. Validation error is a state reference only.
- COR Pending: `Withdraw request` «Withdraw» → ATT Forgot. The Withdrawn state was not drawn (register gap).
- COR Approved / COR Rejected: `Close` «Primary action» → ATT Outcomes. Both are reached only as state references (U-10).
- ATT L:
  - `Custom range` «Period filters › Filter · Custom range» → ATT Empty.
  - `View` links «Row › Link» are not wired: there is no session-detail frame (U-7).
  - The shell hotspots apply.
- ATT Empty: `Show October 2026` «State · Empty › Action» → ATT L.
- ATT Forgot / ATT Prov / ATT Outcomes: `October 2026` «Filter · October 2026» → ATT L.
- **Mobile:** ATT ML has no forgotten-checkout row and no `Request correction`, and it is reached only via More. COR ML reactions:
  - `Cancel` «Footer › Cancel» and header back → BACK.
  - `Submit request` «Submit» is not wired: there is no mobile Submitted frame (U-6).
  - ATT ML tab `My Day` «TabBar › Tab 1» → DAY ML.

---

## Flow 7 — `P7 — Call Center — Profile and session`

**Start frame:** PRO L [189:10468]. The common shell hotspots apply.

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | PRO L | `Save changes` «Detail actions › Save changes» | NAVIGATE | PRO Success | Smart Animate 200 ms |
| 2 | PRO Success | sidebar `My Day` | NAVIGATE | DAY L | Dissolve 200 ms |
| 3 | PRO L | `Sign out` «Sign-out actions › Sign out» | NAVIGATE | LOGIN L | Dissolve 200 ms |
| 4 | PRO L | `Sign out of all sessions` «Sign out all» | NAVIGATE | LOGIN L | Dissolve 200 ms. Impl. decision |

**Other reactions:**
- PRO L: `Discard` «Discard» → no reaction (nothing to discard on a static frame).
- PRO L: `Change password` «Change password» and `Change photo` «Change photo» are not wired. No frame exists for either; change password is Proposed (U-7).
- PRO L: `Theme · Dark` «Theme options › Theme · Dark» → PRO D.
- PRO D: `Theme · Light` → PRO L.
- **The theme pair needs orchestrator OK** (rule 4 allows Dark reactions only on mobile-priority flows). If it is refused, leave both unwired.
- PRO Error: `Save changes` → PRO Success.
- **Mobile:**
  - PRO ML: `Sign out` «Sign out» → LOGIN M.
  - PRO ML: `Save changes` is not wired (no mobile Success frame).
  - PRO ML: tab `My Day` «TabBar › Tab 1» → DAY ML.

**Session ending** is covered by Flow 9c.

---

## Flow 8 — `P7 — Developer — Notifications` (page 45)

**Start frame:** NOT L [165:2880]. It is also reached from every page-40 bell via OPEN_URL.

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | NOT L | `Meeting booked: Peak Fitness Gym — Member app` «Item · Meeting booked: Peak Fitness G» | OPEN_URL | 304:13135 (SCR-DEV-004) | — |
| 2 | NOT L | `Task due tomorrow: Booking flow` «Item · Task due tomorrow: Booking flo» | OPEN_URL | 267:13129 (SCR-DEV-007) | — |
| 3 | NOT L | `Client dependency on Content upload` «Item · Client dependency on Content u» | NAVIGATE | HID Stale | Dissolve 200 ms. The stale-link demo, per the spec (U-11) |
| 4 | HID Stale | `Back to notifications` «Access · Hidden by policy › Action» | NAVIGATE | NOT Gone | Dissolve 200 ms |
| 5 | NOT L | `Deal closed: Glow Beauty Salon — Booking website` «Item · Deal closed: Glow Beauty Salon» | OPEN_URL | 263:13122 (SCR-DEV-002) | — |
| 6 | NOT L | `Wireframes approved by the client` «Item · Wireframes approved by the cli» | OPEN_URL | 228:13090 (SCR-DEV-006) | — |

**Other reactions:**
- NOT Gone: the same items 1, 2, 5 and 6. Item 3 → HID Stale.
- NOT L / NOT Gone: `Mark all as read` «Link · Mark all as read» and `Unread · 2` «Filter · Unread» are not wired. No "all read" or unread-filter frame exists; NOT Empty is "all caught up", not "all read" (U-12).
- NOT L / NOT Gone / NOT Empty: sidebar `My Day` «Nav/Item · My Day» → OPEN_URL 303:10513. This is the Developer shell to a Call Center My Day; the role mismatch is accepted (U-13).
- **Mobile, NOT ML:**
  - items 1 and 2 → OPEN_URL 304:14544 and 267:15282.
  - item 3 → HID ML.
  - items 4 and 5 are not wired; there are no mobile frames for them.
  - tab `My Day` «TabBar › Tab 1» → OPEN_URL 303:11195.

---

## Flow 9 — Cross-cutting states (page 45)

These states are interrupts, so most of them have no clickable trigger inside the prototype. Each flow starts on the state frame. The triggers I could link are listed under each flow.

### 9a — `P7 — All roles — Permission denied`
**Start frame:** DENY L [165:3781].

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | DENY L | `Go to My Day` «Access · Permission denied › Action» | OPEN_URL | 303:10513 | — |
| 2 | DENY L | `Back` «Back» | BACK | — | — |
| 3 | DENY ML | `Go to My Day` «Go to My Day» | OPEN_URL | 303:11195 | — |
| 4 | DENY ML | `Back` «Back» | BACK | — | — |
| 5 | DENY 2FA | `Continue to 2FA` «Primary action» | OPEN_URL | 169:11080 (2FA L) | — |
| 6 | DENY 2FA | `Sign out` «Sign out» | OPEN_URL | 169:10438 (LOGIN L) | — |

**Trigger:** a direct URL only. No hotspot in any Shared frame opens these screens (U-14).

### 9b — `P7 — Call Center — Hidden record`
**Start frame:** HID L [269:2916].
- HID L: `Back to Calling Queue` «Access · Hidden by policy › Action» → OPEN_URL 311:13767.
- HID ML: `Back to Calling Queue` «Back» → OPEN_URL 311:15277.
- HID Stale: see Flow 8 step 4.

**Trigger:** NOT L item 3 → HID Stale (Flow 8). The direct-URL variant has no in-prototype trigger. Optionally, the Call Center agent may link a queue row to it.

### 9c — `P7 — Call Center — Session ended`
**Start frame:** END Dialog [269:3652]. This is the in-app dialog that appears mid-edit on the Calling Queue.

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | END Dialog | `Sign in again` «Dialog · Your session has expired › Primary action» | OPEN_URL | 169:10912 (LOGIN Expired) | — |
| 2 | LOGIN Expired (p40) | `Sign in` «Primary action» | NAVIGATE | DAY L | Dissolve 200 ms. Returns to the role home (Maya, Call Center) |

**Other reactions:**
- END Dialog: `×` «Dialog › Close» → END L (the session is gone, so the dialog cannot simply dismiss).
- END L / END Revoked: `Sign in again` «Sign in again» → OPEN_URL 169:10912.
- END ML: `Sign in again` → OPEN_URL 169:10607 (LOGIN M). There is no mobile session-expired Login frame.
- END Deact: `Back to sign in` «Back to sign in» → OPEN_URL 169:10438.
- LOGIN Expired: `Forgot password?` → RESET L.

**Trigger:** none inside the prototype (U-14).

### 9d — `P7 — Call Center — Save conflict (profile)`
**Start frame:** PRO Conflict [189:11584].

| # | frame | hotspot | action | target | transition |
|---|---|---|---|---|---|
| 1 | PRO Conflict | `Review changes` «Conflict actions › Review changes» | OPEN_URL | 270:2918 (CONF L) | — **U-15** |
| 2 | PRO Conflict | `Reload latest` «Conflict actions › Reload latest» | NAVIGATE | PRO L | Dissolve 200 ms |
| 3 | CONF L | `Re-apply my edits` «Conflict actions › Re-apply my edits» | OPEN_URL | 172:9047 (SCR-DE-004) | — |
| 4 | CONF L | `Reload latest` «Reload latest» | OPEN_URL | 172:9047 | — (the confirm step is not drawn) |
| 5 | CONF L | `Cancel editing` «Cancel editing» | OPEN_URL | 310:11808 (SCR-SHR-008) | — |

**Other reactions:**
- CONF ML (Developer task):
  - `Re-apply my edits` «Re-apply» and `Reload latest` «Reload» → OPEN_URL 267:15282 (SCR-DEV-007 M-L).
  - header back «Header › Back» → BACK.
- CONF L is also the target of the Data Entry map, from SCR-DE-004 "Show what changed".

**Trigger:** PRO Conflict is a state reference; there is no path from PRO L `Save changes` to it, because that button goes to Success (U-1 pattern: one hotspot cannot branch).

SCR-SHR-015 (System state patterns) is a reference sheet and is not wired.

---

## Unclear or missing hotspots

- **U-1. One button, two outcomes.**
  - Login `Sign in` cannot branch by role, and Profile `Save changes` cannot branch between success and conflict.
  - The Owner branch (→ 2FA) is wired. The non-Owner sign-in is shown through LOGIN Expired → My Day (Flow 9c).
  - Enrollment (Flow 1b) and the profile conflict (Flow 9d) are separate starting points.
- **U-2. The reset email link is not on any frame.**
  - The proposal is to use the `Reset link queued` banner on RESET Sent as a stand-in hotspot. This needs orchestrator OK.
  - RESET Expired has no entry hotspot.
- **U-3. Layer names inside shell instances were not confirmed.**
  - The top-bar avatar/user block, the mobile header avatar and the mobile header back chevron are not created by name in the scripts. The guesses are «TopBar › Avatar», «Header › Avatar» and «Header › Back».
  - The `Notifications`, `Attendance` and `Avatar` names are the nested names the scripts set props on. The operator should check them on the first run.
  - No user-menu dropdown frame exists, so the avatar goes straight to My Profile.
- **U-4. Work items have no per-business frames.** All rows go to the single CC-002 frame, whose business may not match. Follow-up rows could go to CC-004 instead; the Call Center agent decides.
- **U-5. Missing mobile frames.**
  - There is no "Not checked in" mobile My Day frame, so mobile check-in starts on the check-in result.
  - There is no "More" menu frame, so mobile Attendance, Profile and Notifications are reachable only via the header avatar (Profile) or as flow starts.
- **U-6. Mobile frames with no next state:**
  - AUTH-002 M → AUTH-003, which is desktop only
  - RESET M → Request sent
  - COR ML → Submitted
  - PRO ML → Success
- **U-7. Controls with no target frame:**
  - `Need help?` (AUTH-003)
  - `Change password` and `Change photo` (SHR-006)
  - `View` session detail (SHR-004)
  - `Copy codes` and `Download codes`
- **U-8. The Verifying → result step relies on clicking a Loading button.** An AFTER_TIMEOUT (about 1.5 s) to CI L would be truer, but the brief lists ON_CLICK only, so the orchestrator should decide. CI Fail has no trigger unless a demo hotspot is approved.
- **U-9. There is no "checked out" My Day frame.** After Closed, and after mobile Check out, the flow returns to My Day, which still shows "Checked in".
- **U-10. COR Approved and COR Rejected (Mon 19 Oct) have no trigger.** The outcome rows on ATT Outcomes are for other dates.
- **U-11. The stale-link demo is assigned to one notification ("Client dependency…").** This is my choice: no frame marks which item lost access.
- **U-12. `Mark all as read` and the `Unread` filter have no result frames.**
- **U-13. The page-45 shells are Developer and the My Day target is Call Center.**
- **U-14. Permission denied, direct-URL hidden record and session ended have no in-prototype trigger.** They are flow starts only. Other role agents may link role-forbidden actions to `DENY L`, URL(165:3781).
- **U-15. The profile conflict opens a diff of a business record.** SHR-014 desktop is drawn as a Data Entry business, so it is used as the pattern reference. The SHR-014 desktop exits go to DE-004 and SHR-008, to stay consistent with the Data Entry map.
- **Policy-dependent steps (default TBD):**
  - DEC-010: Request remote exception
  - DEC-012: Summary empty → Check out
  - DEC-026: failed-check Check out
  - DEC-011: the whole of Flow 6
  - Theme Dark reactions on PRO D need OK under rule 4.

---

## Resolutions (P7-1) and scripts

Written 2026-10-23 after [OP-P7-1] (validated helpers) and [P7-1] (D1–D6), plus the orchestrator's answers to my open issues. This section wins where it differs from the tables above.

### Answers applied

| issue | resolution in the scripts |
|---|---|
| **U-1 Sign in by role** | Figma allows **one flow start per frame** and **one ON_CLICK per hotspot**, so the per-role flows cannot all start on LOGIN L. Each role gets its own Login frame:<br>- `P7 — Owner — Sign in with 2FA` @ LOGIN L: Sign in → 2FA L → Verify → OPEN_URL 200:22902. This is the main flow.<br>- `P7 — Call Center — Sign in` @ LOGIN Expired: Sign in → NAVIGATE DAY L. The home, My Day, is on the same page, so NAVIGATE is used (rule 1).<br>- `P7 — Data Entry — Sign in` @ LOGIN Validation: Sign in (corrected entry) → OPEN_URL 165:81145 (SCR-DE-001).<br>- `P7 — Developer — Sign in` @ LOGIN Invalid: Sign in (retry) → OPEN_URL 171:11591 (SCR-DEV-001).<br>- `P7 — Owner — Sign in with 2FA (mobile)` @ LOGIN M.<br>**Note:** the sitemap gives My Day as the home for DE and DEV, but My Day is drawn only for Call Center, so DE and DEV land on their primary work screen (D3, Phase 8 item). LOGIN Deactivated and LOGIN Loading keep Sign in unwired (cleared). |
| **U-2 Emailed reset link** | RESET Sent has a text hotspot: the `Reset link queued` banner «Banner · Info». It does NAVIGATE → RESET New. Because LOGIN L holds the Owner flow, the reset flow starts at **RESET L**. Its entry point is still `Forgot password?` on every desktop Login frame. |
| **U-5 / U-6 Missing mobile frames** | End at the closest existing frame:<br>- COR ML `Submit` → ATT ML.<br>- CO ML/MD `Check out` → DAY ML/MD.<br>- RESET M `Send reset link`, 2FA M `Lost your second factor?` and PRO ML `Save changes`: no reaction. The flow ends on that frame, and the reaction is cleared if one is present. |
| **U-8 Verifying → result** | The helper has ON_CLICK only (no AFTER_TIMEOUT), so CI Verifying gets a **whole-frame ON_CLICK** → CI L (Smart Animate 200 ms). Its Cancel and × still go BACK. CI Fail gets its own flow start (D1). |
| **U-14 Untriggered cross-cutting states** | New flow `P7 — States — reference` on page 45, starting at SCR-SHR-015 Reference sheet (270:3509). A whole-frame click advances through: REF → DENY L → DENY 2FA → HID L → END L → END Revoked → END Deact → END Dialog → CONF L → NOT Empty → SHR-015 Offline in context → REF. The real buttons on those frames keep their own reactions and take precedence over the frame click. Mobile state frames (DENY ML, HID ML, END ML, CONF ML) are wired but not in the chain. |
| **Correction drawer** | Confirmed as SCR-SHR-005 (118:56264 …). |
| **Theme pair PRO L ↔ PRO D** | Not wired (rule 4); any existing reaction is cleared. |

### Policy defaults applied (D5)

- **DEC-010:** there is no self-service "request remote exception" in v1. CI Fail `Request remote exception` is **not wired** (cleared). CI Remote is treated as an Owner-granted exception and gets its own flow start, `(Owner-granted remote exception)`; its Close, Open my work list and × go to DAY L.
- **DEC-011 Alt B:** Flow 6 is wired in full, steps 1–6.
- **DEC-012 (summary mandatory):** CO Empty `Check out` is **not wired**; `Cancel` → DAY L. CO Empty gets its own flow start, `(summary empty)`.
- **DEC-026 Alt B (provisional):** CO Fail `Check out` → **CO AltB**, Smart Animate. `Retry check` → CO Closed. CO AltA and CO AltC are references only; they keep their exits but have no entry.

### Flow starting points (34: 26 on page 40, 8 on page 45)

**Page 40 (96:2):**

| script | flows |
|---|---|
| P40-01 | Owner — Sign in with 2FA · Call Center — Sign in · Data Entry — Sign in · Developer — Sign in · Owner — Sign in with 2FA (mobile) · Owner — Sign in with 2FA (wrong code) · Owner — 2FA enrollment & recovery · Owner — 2FA enrollment & recovery (recovery failed) · All roles — Forgot / reset password · All roles — Forgot / reset password (link expired) |
| P40-02 | Call Center — My Day (desktop) · My Day (mobile, Light) · My Day (mobile, Dark) · Check in → check out (desktop) · (check-in verification failure) · (Owner-granted remote exception) · (checkout verification failure) · (summary empty) · Check in → check out (mobile, Light) · Check in → check out (mobile, Dark) |
| P40-03 | Call Center — My Attendance → correction request · My Attendance · correction request (approved) · correction request (rejected) · Profile and session · Profile and session (save conflict) |

**Page 45 (96:7):**

| script | flows |
|---|---|
| P45-01 | Developer — Notifications · Developer — Notifications (mobile) · All roles — Permission denied · Owner — Permission denied (2FA not completed) · Call Center — Hidden record · Call Center — Session ended · All roles — Save conflict (field-level diff) · States — reference |

All flow names have the prefix `P7 — `.

### Scripts — `docs/phase7/scripts/shared/`

| run | file | page | covers |
|---|---|---|---|
| 1 | `P40-01-auth-signin-2fa-reset.js` | 40 | Flows 1, 1b, 2, sign-in by role |
| 2 | `P40-02-myday-checkin-checkout.js` | 40 | Flows 3, 3m, 5, 5m; scroll on mobile «Content» |
| 3 | `P40-03-attendance-correction-profile.js` | 40 | Flows 6, 7, 9d start; ATT and COR mobile |
| 4 | `P45-01-notifications-states.js` | 45 | Flows 8, 9a–9d (p45 part), States — reference |

**How the scripts work:**
- **Run model.** Each script is a `use_figma` async body (top-level `await` and `return`). Each is under 17k characters. The helpers from `wiring-helpers.js` are inlined, plus small extensions:
  - `load` looks up a frame by exact name, with an ID fallback that checks the frame is on the current page.
  - `H` resolves a hotspot by path, regex, or scoped text.
  - `WA` wires every match.
  - `WF` wires a whole frame.
  - `WR` wires a table-row link by its date.
  - `C` clears reactions.
  - `SCROLL` sets vertical scroll.
- **Idempotent.** Re-running a script is safe:
  - Reactions on each script's own hotspots are replaced.
  - The script's own flows are replaced by nodeId.
  - Auto-created `Flow N` entries are removed only on frames the script touched.
  - The scripts have no hotspots in common, so the run order does not matter for correctness.
- **Result.** Each script returns `{script, page, wired, cleared, scroll, missingTargets, missingHotspots, flows, errors}`.
  - `missingHotspots` lists layer-name guesses that did not resolve, mainly U-3: «TopBar › Avatar», mobile «Header › back», TabBar tab names, and the dialog/drawer × name. These should be read back to me, not worked around.
- **Checks.** Every script passed `node --check` (async-wrapped). Every script also ran without errors against a stub `figma`.

### Phase 8 items (D3)

- The DE and DEV sign-in flows land on SCR-DE-001 and SCR-DEV-001, not on My Day, because My Day is drawn only for Call Center.
- The non-Owner sign-in flows start on the Validation error, Invalid credentials and Session expired Login frames (single-frame flow-start limit).
- All work items go to the single SCR-CC-002 frame (U-4).
- After checkout, My Day still reads "Checked in" (U-9).
- The page-45 Developer shell links to the Call Center My Day (U-13).
- The SHR-014 desktop diff is a business record (U-15).
- No Withdrawn correction state is drawn.
