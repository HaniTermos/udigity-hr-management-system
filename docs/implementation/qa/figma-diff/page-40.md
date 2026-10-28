# Figma visual QA — Page 40 (Auth & Shared)

Date: 2026-10-28 · Read-only pass, no source changed · Build: production frontend http://localhost:3100, backend :5100, DB `udigity_test_figma_qa`.
Design source: `docs/phase6/previews/40/*.png` (1440×900 desktop, 390×844 mobile) and `docs/implementation/figma-specs/page-40.md`. No Figma MCP calls were made.
App screenshots: `docs/implementation/qa/figma-diff/shots/40/` (1440×900 / 390×844, DPR 1, locale en-GB, TZ Asia/Beirut). Personas: Maya Khoury (Call Center) for shared screens, Rana Haddad (Owner) for 2FA.

**Data side effect, please note:** pressing "Check in" on My Day checks you in straight away, with no confirm step. That press checked **Maya Khoury in at 15:06 on 28 Oct** in the test DB. I left the session open and did not check out. Nothing else was submitted except one wrong 2FA code, one wrong password, and a password-reset request for a made-up address (`nobody.qa@udigity.example`).

**Intentional differences, not counted as defects:**
- The real logo replaces the Figma placeholder.
- Dark mode is **navy**, as the user directed. Figma's dark right pane and dark surfaces are grey/near-black.
- The "Demonstration alternative — not approved" label replaces Figma's "Policy pending" chip text. This comes from the policies-delegated-to-defaults decision (`DEMO_ALTERNATIVE_LABEL` in `frontend/src/components/ui/NoticePolicy.tsx`).
- The Break counter card, the theme toggle, the extra sidebar groups for Call Center (Businesses, Correction Requests, Categories, Delivery) and the "System" theme option are user-added features.
- Seed data differs from Figma's sample data (6 sessions, 5 work items, targets), so the empty targets/work list are data, not defects.

## Summary

| Screen | Variants checked | Verdict |
|---|---|---|
| SCR-AUTH-001 Login | D-L, D-D, M-L, Validation, Invalid credentials, Session expired | **Minor** (several copy drifts, missing 2FA note) |
| SCR-AUTH-001 Deactivated / Loading | — | Not reachable (backend deliberately returns a generic failure; loading is transient) |
| SCR-AUTH-002 Owner 2FA challenge | D-L, D-D, M-L, Wrong code, Success | **Minor** |
| SCR-AUTH-002 Verification failure, R11-a/b | — | Not checked (R11 frames are "not selected"; failure needs a backend error) |
| SCR-AUTH-003 2FA enrollment & recovery | Recover lost factor (D-L) | **Match** (Cosmetic only) |
| SCR-AUTH-003 Enrollment default / Save codes / Recovery used / failed / Success | — | **Not reachable**: the only Owner already has a factor; reaching these means changing data or spending a recovery code |
| SCR-AUTH-004 Forgot / reset password | D-L, D-D, M-L, Request sent, Link expired, Set new password | **Major** (request-sent and link-expired states have a different structure) |
| SCR-AUTH-004 Password rule error / Success | — | Not checked (needs a valid reset token) |
| SCR-SHR-001 My Day | D-L, D-D, M-L, M-D (not checked in + checked in), Loading | **Major** (column proportions, app shell sizes) |
| SCR-SHR-002 Check-in | D-L success dialog, `/my-day/check-in` page D-L/D-D/M-L | **Minor** |
| SCR-SHR-003 Checkout | D-L drawer, M-L drawer, `/my-day/check-out` page | **Minor** |
| SCR-SHR-004 My Attendance | D-L, D-D, M-L, Loading | **Major** (period filter and KPI set differ) |
| SCR-SHR-005 Correction request drawer | D-L, D-D | **Minor** (mobile drawer could not be opened by script: Not checked) |
| SCR-SHR-006 My Profile | D-L, D-D, M-L | **Major** (no Change photo, no phone country code, mobile layout) |

Counts: **Major 9 · Minor 21 · Cosmetic 6** (findings below).

---

## Shared app shell (affects every SHR screen)

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| S-1 | Major | Sidebar 240 px wide. Groups "MY WORK" / "CALLING". Items 15/22 regular, Calling Queue count badge "7" | 224 px (`w-56`). Group "OVERVIEW". Items 14 px semibold. No count badge | `frontend/src/components/layout/Sidebar.tsx`, `AppShell.tsx` | Use `w-60`. Rename the first group to "My work". Match the item type ramp. Add the queue count badge. |
| S-2 | Major | TopBar 64 h. Search 360×40 with a 16 px search icon. User block shows name plus role subtitle "Call Center" | 56 h (`h-14`). Search ~384×32 with no icon. Name only, no role line | `frontend/src/components/layout/Header.tsx` | `h-16`. Make search `w-[360px] h-10` with a leading Search icon. Add the role caption under the name. |
| S-3 | Minor | TopBar attendance pill: success green with dot when checked in ("Checked in · 08:58"), neutral with dot when not | Always neutral, no dot (see `shr001-DL-checkedin.png`) | `Header.tsx` | Use the success tone with a dot when the session is open. |
| S-4 | Minor | Loading state keeps the real status | While My Day loads, the pill says "Not checked in" for a user who **is** checked in, and a DEC-007 "Company timezone is not configured" banner flashes (`shr001-DL-loading.png`) | `Header.tsx`, `frontend/src/app/my-day/page.tsx` | Show a skeleton or no pill until `today` loads. Render the timezone notice only after settings resolve. |
| S-5 | Minor | Mobile: top bar has the screen title plus a date/context subtitle. No repeated H1 | Top bar title **and** a second large H1 with the same text (My Day, My Attendance, My Profile) | `frontend/src/components/layout/MobileNav.tsx` + page headers | Hide the page H1 below `md` and move the subtitle into the mobile top bar. |
| S-6 | Minor | Mobile tab bar: active tab has a teal label and a 32×3 top indicator ("More" is active on Attendance/Profile) | No top indicator. "More" is not active on My Attendance / My Profile | `MobileNav.tsx` | Add the indicator and map secondary routes to "More". |
| S-7 | Cosmetic | Policy chips stay on one line | On mobile, chips wrap "DEC-\n009" / "OQ-\n13" inside a pill (`shr001-ML.png`, `shr006-ML.png`) | `frontend/src/components/ui/NoticePolicy.tsx` (`PolicyPendingChip`) | Add `whitespace-nowrap` on the DEC id and let the label wrap as a block. |

## SCR-AUTH-001 Login

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| A1-1 | Minor | Below the button: divider, shield icon, "Owner accounts confirm a second step (2FA) after signing in.", and an R-11 policy note | Missing (`auth001-DL.png`). The 2FA screen does show R-11, so this is inconsistent | `frontend/src/components/auth/SignInForm.tsx` | Add the divider, the shield note and the R-11 inline NoticePolicy. |
| A1-2 | Minor | Invalid credentials: title "Email or password is incorrect.", body "Check both and try again.". Password field cleared | Title "Sign-in failed", body "Email or password is incorrect.". Password is **kept** (`auth001-DL-invalid.png`) | `SignInForm.tsx`, `frontend/src/app/login/page.tsx` | Use the Figma copy and clear the password on failure. |
| A1-3 | Minor | Session expired: "Your session has ended." / "Sign in again to continue. Changes you had not saved could not be kept." | "You were signed out" / "Your session ended. Sign in again to continue. Unsaved input was not kept." | `SignInForm.tsx` | Use the Figma copy. |
| A1-4 | Minor | Email format error: "Enter a valid email address, e.g. name@udigity.example." Error border 1 px | "Enter a valid email address." Error border looks 2 px | `SignInForm.tsx`, `frontend/src/components/ui/Input.tsx` | Add the example to the message. Keep a 1 px danger border. |
| A1-5 | Minor | Alert body is 14/20 in `text/primary`, with only the title tinted | Alert body is 12–13 px and tinted blue/red (also on AUTH-003/004) | `frontend/src/components/ui/Alert.tsx` | Make the body `text-sm text-text-primary`. |
| A1-6 | Minor | Mobile: logo pinned 40 px from the top, card follows (top-aligned) | Card and logo are vertically centred, leaving a large blank top (`auth001-ML.png`) | `frontend/src/components/auth/AuthShell.tsx` (`justify-center`) | Top-align below `lg` (`justify-start pt-10`). |
| A1-7 | Cosmetic | ~38 px gap between the password field, "Forgot password?" and the button. Card padding gives a taller card | About 16–24 px. The hero H1 renders with tighter tracking than Figma | `SignInForm.tsx`, `AuthShell.tsx` | Match the spacing from figma-specs/page-40.md. Drop the extra negative tracking on the hero. |
| A1-8 | Note | Deactivated account: "This account can't sign in." | Not reachable. Backend returns a generic failure on purpose (`backend/src/tests/auth.api.test.ts`) | — | Decide whether to keep the generic response (safer) and mark the Figma state as not adopted. |

## SCR-AUTH-002 Owner 2FA challenge

Close match on D-L, D-D and M-L (`auth002-*.png`).

| # | Sev | Figma | App | File | Fix |
|---|---|---|---|---|---|
| A2-1 | Minor | Wrong code: "This code is wrong or has expired. Enter the current code." with an Impl-decision note on the attempt threshold | "Code is incorrect or expired. Try again." The R-11 and 2FA-method notes stay instead | `frontend/src/app/login/page.tsx` (line ~101), `TwoFactorChallenge.tsx` | Use the Figma copy and the state-specific note. |
| A2-2 | Minor | Success: chip "Session active · 2FA complete", H "You're verified", "Opening the Owner dashboard…", success inset, loading primary button | Title "Verified" plus one success alert (`auth002-DL-success.png`) | `TwoFactorChallenge.tsx` / `login/page.tsx` | Build the Figma success composition. |
| A2-3 | Cosmetic | "Lost your second factor?" is a teal link. Sign-out icon is log-in-left style | Dark text. Arrow icon points the other way | `TwoFactorChallenge.tsx` | Use `text-text-link` and the matching icon. |
| A2-4 | Cosmetic | Impl-decision notice is inline: tag plus text | Block with a redundant "Implementation decision" heading next to the "Impl. decision" tag (also on AUTH-003 recover) | `NoticePolicy.tsx` (block, tone decision) | Use the inline size for decision notes, or drop the duplicate heading. |
| A2-5 | Cosmetic | Code value grouped "481 220" | Typed code shown ungrouped "000000" | `TwoFactorChallenge.tsx` | Format as `### ###`. |

## SCR-AUTH-003 2FA enrollment & recovery

- Recover lost factor (`auth003-DL-recover.png`) **matches**, apart from A1-5 (alert body style) and A2-4 (decision notice).
- Enrollment default, Save recovery codes, Verification failure, Recovery used, Recovery failed and Success were **not checked**. The only Owner already has a factor, and getting there would mean resetting the factor or spending a seeded recovery code.

## SCR-AUTH-004 Forgot / reset password

| # | Sev | Figma | App | File | Fix |
|---|---|---|---|---|---|
| A4-1 | Major | Request sent: the form is replaced by "Check your email", an info alert naming the address, "Didn't get it? Request another link", "Back to sign in" and an Impl-decision note | The form stays and a "Reset link queued" alert is added above it (`auth004-DL-sent.png`) | `frontend/src/app/reset-password/page.tsx` | Add a `sent` view matching the frame. |
| A4-2 | Major | Link expired: no page heading, neutral inset with a red icon circle ("This link has expired or was already used"), a **full-width primary** "Request a new link" and "Back to sign in" | Heading and intro kept. Red alert "This link no longer works". Small secondary "Request new link". No back link (`auth004-DL-expired.png`) | `reset-password/page.tsx` | Rebuild the state as in the frame. |
| A4-3 | Minor | Email input has a mail icon and placeholder `name@udigity.example`. Copy: "If an active account matches, we'll email you a reset link." No asterisk. Button 48 h | No icon. Placeholder `name@udigity.com`. Copy "…exists, we send a reset link." Required `*`. Button 40 h | `reset-password/page.tsx` | Reuse the SignInForm email field and the `size="lg"` button. Use the Figma copy. |
| A4-4 | Minor | "Back to sign in" followed by a chevron icon | "‹ Back to sign in" with a text glyph | `reset-password/page.tsx` | Use the chevron icon after the label. |
| A4-5 | Minor | Set new password: H "Set a new password", "For maya…@…", helpers "Must meet the password rules.", button "Save new password", footer "Saving signs you out on every other device." | H "Choose a new password". No email line. Helper "At least 12 characters". Button "Save password". No footer note (`auth004-DL-setnew.png`) | `reset-password/page.tsx` | Use the Figma copy and add the footer line. Show the email only if the backend can return it safely. |
| A4-6 | Cosmetic | Impl-decision note with body text | Chip reading "Impl. decision Implementation decision" with no body | `reset-password/page.tsx` | Pass the body text to NoticePolicy. |

## SCR-SHR-001 My Day

| # | Sev | Figma | App | File | Fix |
|---|---|---|---|---|---|
| D1-1 | Major | Columns: A fixed 368 w, B flex, gap 24 | `grid-cols-[5fr_7fr]` gap 16, so A is ~472 and B ~662 (`shr001-DL.png`) | `frontend/src/app/my-day/page.tsx` line 61 | `lg:grid-cols-[368px_minmax(0,1fr)] gap-6`. |
| D1-2 | Minor | Not checked in: timer 44 px medium in **muted** grey. Checked in: 44 px semibold primary | Always ~52 px extra-bold black | `frontend/src/components/attendance/MyDayCards.tsx` | Match the Number token size and weight, and use muted when idle. |
| D1-3 | Minor | After check-in: success inset "Office check passed / 08:58 · at check-in" | Blue info inset "Recorded · mode office network" | `MyDayCards.tsx` (~line 80) | Use the success tone and "Office check passed" when verification passed. |
| D1-4 | Minor | A1 note is plain 12 px muted text under the left column | Full purple policy block with the demo label | `my-day/page.tsx` line 76 | Use the inline/caption NoticePolicy. |
| D1-5 | Minor | Loading: card skeletons with title, value and caption bars. Work-list rows are avatar circle plus two lines. Date stays visible | Big block skeletons. Date shows "— · Call Center" | `my-day/page.tsx`, `MyDayCards.tsx` | Match the skeleton shapes and compute the date on the client. |
| D1-6 | Minor | Mobile M-L/M-D: card padding 16. Timer 44 | Padding 20. Timer ~52 | `MyDayCards.tsx` | Use responsive padding and the Number token. |

## SCR-SHR-002 Check-in

- My Day "Check in" opens a dialog that matches the Figma result frame closely (`shr002-DL-dialog-success.png`). One Cosmetic difference: the app adds a header divider and a bordered success alert.
- Minor (C2-1): there is also a standalone route `/my-day/check-in` (`shr002-DL.png`). It is a full page with "Check in now", which Figma does not draw. File: `frontend/src/app/my-day/check-in/page.tsx`. Fix: redirect it to My Day with the dialog open, or keep it as an accessible fallback with the dialog's look.
- Not checked: Verifying, Verification failure, Open-session block and Remote exception. These need backend conditions I could not set up without changing data.

## SCR-SHR-003 Checkout

- The desktop drawer **matches** the Figma composition (`shr003-DL-dialog.png`).
- Minor (C3-1): the app adds a second DEC-012 block notice ("summary is required…") that Figma does not have. File: `frontend/src/components/attendance/CheckOutFlow.tsx`. Fix: keep only the chip, or confirm the extra note is wanted.
- Minor (C3-2): on mobile, Figma uses a full-screen page with a back chevron, a full-width primary "Check out" and "Cancel" stacked below. The app shows the desktop drawer with inline Cancel/Check out (`shr003-ML-dialog.png`). File: `CheckOutFlow.tsx`, `frontend/src/components/ui/Drawer.tsx`. Fix: below `md`, use a full-screen sheet with stacked footer actions.
- Not checked: Summary empty, Verification failure, Closed. Reaching them needs a submitted checkout.

## SCR-SHR-004 My Attendance

| # | Sev | Figma | App | File | Fix |
|---|---|---|---|---|---|
| D4-1 | Major | KPIs: Closed sessions · Hours (closed) · **Average day "9h 04m · vs 9 h"** · Open problems | Sessions · Hours recorded · Punctuality (derived) · Missing checkout (`shr004-DL.png`) | `frontend/src/app/my-attendance/page.tsx` | Use the Figma KPI set. Add Average day against the 9 h workday. |
| D4-2 | Major | Period filter: chip-dropdowns "This week ▾", active chip "October 2026 ×", "Custom range ▾", right-aligned beside the title | A single labelled native select "Period" | `my-attendance/page.tsx` | Build the chip filter group. |
| D4-3 | Minor | Row of DEC chips (011, 026, 007, 022) under the subtitle | Missing | `my-attendance/page.tsx` | Add the chips. |
| D4-4 | Minor | Rows have a secondary line (Today / role). Date column sorts ↓. Punctuality chip is a dashed "Derived" style with no minutes. Teal "View" link | No second line. No sort icon. "Late · 122 min". View link in dark text | `frontend/src/components/attendance/AttendanceTable.tsx` | Match the cell anatomy in figma-specs page-40 §SHR-004. |
| D4-5 | Minor | Mobile: one inset key-value card (Hours / Average day) and a list card. Footnote about derived punctuality | A 2×2 KPI card grid and a list (`shr004-ML.png`) | `my-attendance/page.tsx` | Use the mobile key-value inset layout. |

## SCR-SHR-005 Correction request (drawer)

- Minor (D5-1): Figma time fields are 24 h ("08:47") with one trailing clock icon. The app uses native `type=time`, which shows "11:02 AM" plus a leading **and** a trailing clock icon (`shr005-DL.png`). File: `frontend/src/components/attendance/CorrectionDrawer.tsx`. Fix: use a 24 h text/time input with only the trailing icon, or hide the native picker indicator.
- Minor (D5-2): Figma has an F-01 note ("Whether a pending request blocks your next check-in is open.") and footer actions pinned to the drawer bottom. The F-01 note is missing, and the footer sits under the content with blank space below. File: `CorrectionDrawer.tsx`, `Drawer.tsx`. Fix: add the note and pin the footer (`mt-auto`).
- Minor (D5-3): subtitle copy. Figma: "Mon 19 Oct 2026 · session without checkout". App: full date only. Same file. Fix: add the session context.
- Not checked: mobile drawer (the list row could not be opened by script) and the Submitted/Approved/Rejected/Validation states (they need a submitted request).

## SCR-SHR-006 My Profile

| # | Sev | Figma | App | File | Fix |
|---|---|---|---|---|---|
| D6-1 | Major | "Change photo" button in the identity row (OQ-13 proposes photo + phone as self-editable) | Missing (`shr006-DL.png`) | `frontend/src/app/profile/page.tsx` | Add the button, or mark it as not adopted. |
| D6-2 | Major | Phone field has a country-code select "+000 ▾" and the number | Single plain text input | `profile/page.tsx` | Split into a code select and a number input. |
| D6-3 | Major | Mobile: compact identity card (email, phone, Save), a list card with "Change password ›" and "Appearance ›" rows, and a full-width Sign out | The full desktop form stacked (`shr006-ML.png`) | `profile/page.tsx` | Use the mobile list layout with sub-views. |
| D6-4 | Minor | Impl-decision notes are inline (tag plus text) | Grey inset box with a chip on its own line | `profile/page.tsx` / `NoticePolicy.tsx` | Use the inline decision notice. |
| D6-5 | Cosmetic | Labels of disabled fields are muted grey | Labels stay full-contrast | `profile/page.tsx` | Mute the labels of managed fields. |

## Not checked / blockers

- AUTH-003 enrollment (6 frames): no Owner without a factor in the seed.
- AUTH-004 Password rule error and Success: need a real reset token.
- SHR-002, SHR-003 and SHR-005 server-driven states (verifying, failures, open-session block, remote, closed, submitted/approved/rejected): would need extra test data or backend conditions.
- Dark variants of SHR-003, SHR-004 and SHR-005 were captured (`shr003-DD`, `shr004-DD`, `shr005-DD`) but only spot-checked. Apart from the navy-by-directive change, no extra dark-only issues were seen.
