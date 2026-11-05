# Phase 6 — Shared screens build notes (Shared Agent)

Scripts: `docs/phase6/scripts/shared/`. Run order: A01 → A08 (page 40 `96:2`), D01 → D03 (page 45 `96:7`). Each script is under 45,000 characters and idempotent. It creates its section once, at x 0, 400 px below the lowest existing section, and never moves it. It rebuilds only the frames whose names start with its own SCR ID. It returns `created / updated / removed / warnings / fit / overflow / sections`.

All scripts passed a syntax check and a dry run against a permissive Plugin API mock (no JS errors; all Semantic variable and text-style names resolve). They have not been run in Figma yet.

Representative roles: Call Center (Maya Khoury) for SHR-001..006, 012 and 013, and Developer (Lina Aoun) for the page-45 neutral reference, as on page 15. SHR-014 desktop uses Data Entry (Karim Saleh). Dates are Tue 20 Oct 2026.

**P1:** the 9 h workday is Confirmed and is never labelled "assumed". This is fixed in `docs/phase5/scripts/shared/02-s6-myday.js` and in all new screens. DEC-007/008 remain pending for schedule start and grace.

## Page 40

| Screen | Primary frames | State frames (Desktop Light) | Policy labels |
|---|---|---|---|
| SCR-AUTH-001 Login (A01) | Desktop L, D; Mobile L | Validation error, Invalid credentials, Deactivated account, Session expired, Loading | R-11; Impl.: lockout/throttle, session lifetime; Proposed: deactivated wording |
| SCR-AUTH-002 Owner 2FA challenge (A01) | Desktop L, D; Mobile L (pending-2FA restricted session) | Wrong or expired code, Verification failure, R11-a reading (not selected), R11-b reading (not selected), Success | R-11 (both readings); Impl.: 2FA method, attempt threshold |
| SCR-AUTH-003 2FA enrollment & recovery (A02) | Desktop L, D (Mob —), forced enrollment | Save recovery codes, Verification failure, Recover lost factor, Recovery used, Recovery failed, Success | R-11, OQ-12; Impl.: method, recovery channel |
| SCR-AUTH-004 Forgot / reset password (A02) | Desktop L, D; Mobile L (request link) | Request sent ("Reset link queued", never "sent"), Set new password, Link expired or used, Password rule error, Success | Impl.: password rules, link lifetime |
| SCR-SHR-001 My Day (A03) | Desktop L, D; Mobile L, D (checked in) | Not checked in, Open session from earlier day, Empty work list, Insufficient work, Loading | DEC-009, DEC-007/008, DEC-012, DEC-022, DEC-020, DEC-025, DEC-021, DEC-011; A1 (no gating) |
| SCR-SHR-002 Check-in (A04) | Desktop L, D (dialog over My Day); Mobile L, D (focused flow), Success + punctuality | Verifying, Verification failure, Open-session block, Remote exception recorded | DEC-009, DEC-010, DEC-007/008, DEC-022, DEC-011, R-11 |
| SCR-SHR-003 Checkout (A05) | Desktop L, D (drawer); Mobile L, D (summary entry) | Summary empty (DEC-012 both readings), Verification failure, DEC-026 Alt A / B / C (each "not selected"), Closed | DEC-012, DEC-026, F-02, DEC-009, DEC-010 |
| SCR-SHR-004 My Attendance (A06) | Desktop L, D; Mobile L | Empty, Forgotten checkout flagged, Provisional & pending review rows (if adopted), Correction outcomes, Loading | DEC-011, DEC-026, DEC-007, DEC-022 |
| SCR-SHR-005 Correction request (A07) | Desktop L, D (drawer over SHR-004); Mobile L | Validation error, Submitted (pending), Approved, Rejected | DEC-011 Alt B only (Block notice on the screen), F-01 |
| SCR-SHR-006 My Profile (A08) | Desktop L, D; Mobile L | Validation error, Save conflict, Success | OQ-13 (self-editable fields); Impl.: password revocation, "sign out of all sessions" |

## Page 45

| Screen | Primary frames | States | Policy labels |
|---|---|---|---|
| SCR-SHR-007 Notifications (D01) | Desktop L, D; Mobile L (via More) | Empty, Target no longer accessible | AR-14 (Proposed); presentation, timing and recipients (No DEC ID) |
| SCR-SHR-011 Permission denied (D01) | Desktop L, D; Mobile L — Role denied | Owner without completed 2FA (→ AUTH-002) | R-11 |
| SCR-SHR-012 Record hidden by policy (D02) | Desktop L, D; Mobile L — Direct URL | Stale link from notification or calendar | DEC-001, DEC-002, DEC-003; request access only if adopted (No DEC ID) |
| SCR-SHR-013 Session ended (D02) | Desktop L, D; Mobile L — Expired | Revoked by Owner, Account deactivated, In-app dialog (unsaved input not saved) | Impl.: session lifetime, unsaved-input handling |
| SCR-SHR-014 Save conflict (D03) | Desktop L, D (DE business, field diff); Mobile L (DEV task) | — | — |
| SCR-SHR-015 System state patterns (D03) | Desktop L, D reference sheet (hug height, may exceed 900); Mobile L | Offline in context | DEC-020, DEC-012, DEC-019 (examples) |

## Known dependencies and limits

- **Progress/Bar (P5).** `setProgress` never resizes the instance's Fill child (lesson 1). It uses a value property when the DS Maintainer adds one. Until then it warns `no value property yet (P5)` and the bars show the component's default fill. Attendance/Panel fills are baked per state.
- **Notice/Access Page/Inline.** These have fixed inner text widths (416/420), so phones use a local icon + text layout (`mobNotice`) instead. Possible Component request: make the Notice/Access and State text FILL.
- **Fields.** All fields are set to FILL (lesson 5). After any DS change, the operator should re-lay-out instances nested in slots.
- **Fit.** `OUT.fit[frame]` gives the size, content used/available and any text past the right edge. `OUT.overflow` lists overflows; mobile scroll frames are tagged "scroll intended, annotated". Likely tight spots to check on the first run: the SHR-003 Verification failure drawer, the SHR-005 mobile frame (scroll), and the SHR-006 desktop right column.
