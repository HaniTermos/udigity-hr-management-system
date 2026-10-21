# Phase 5 Visual Sample — Independent Visual & Interaction Review

Reviewer: Independent Visual & Interaction Reviewer (did not author any frame). Date 2026-10-21.
Inputs: the 18 PNGs in `docs/phase5/previews/final/` (inspected at native size, with crops zoomed up to 3×), `brief.md` §4–§6, `design-system.md` (tokens), and the screen specs, which I used only to check intent. I made no Figma calls.

## Verdict

**Not ready for user approval: changes required.** The visual direction is right and the domain logic is mostly sound. Permissions behave correctly: Call Center gets "Request correction" and no edit; the hidden match shows existence only; the Developer sees only the closed deal assigned to them. Reporting distinctions are explicit: attempts vs distinct, ≠ accepted, Closed ≠ Completed. Every required pending-policy label appears except DEC-007/008 on My Day.

The remaining problems fall into three groups:
- Clipping and overlap on S2, S3 and S5 hides meaning or actions.
- One pending policy, DEC-026, is presented as decided by the disabled checkout button.
- One required label set is missing (DEC-007/008).

None of the fixes is large. I approve nothing.

## MUST-FIX

| ID | Frame file | What you see | Why it matters | Concrete fix |
|---|---|---|---|---|
| MF-01 | S2-dashboard-light.png, S2-dashboard-dark.png | The filter bar's last button reads "Expor". It is cut off by the right edge of the content. | The Owner's export action is clipped, and the filter row overflows 1440. | Let the filter row wrap, or shrink it: Export as an icon-plus-label button with a smaller gap, or move the date-range control left of the tabs. The row must end inside the 24 px right padding. |
| MF-02 | S2 light + dark | Exceptions card: both "Send again" buttons lose their right border at the card edge. Targets card: "6 / 10" shows as "6 / 1", "(not in yet)" is clipped, the progress tracks run past the padding, and the footnote "DEC-020;" touches the edge. | Clipped numbers misreport target progress. The buttons look broken. | Set the inner content width to the card width minus padding (FILL, not fixed). Right-align the values inside the padding. Re-check at the 1440 frame. |
| MF-03 | S2 light + dark | Pipeline chart: the x-axis label "20 Oct" is clipped at the plot's right edge. | The period end is unreadable, and the period is the key reading of that chart. | Inset the plot by about 16 px on the right, or end-align the last tick label. |
| MF-04 | S3-workspace-main.png | The "More below · Requires contact (1)" pill sits on top of the Bloom Florist row and its "On hold" badge. | It hides a queue row and its status. A scroll hint must never cover content. | Pin the pill to the bottom edge of the scroll viewport with a solid surface and a fade above it, or reserve a 32 px gutter for it. |
| MF-05 | S3-workspace-main.png | Call history: the "3 earlier attempts and business details below" pill overlaps the second timeline entry (its icon and "15:10"). | It hides the call history the agent needs before logging. | Same as MF-04, or replace it with an inline "Show 3 earlier attempts" row after the latest entry. |
| MF-06 | S3-workspace-main.png | The footer secondary button reads "Save and keep", and the caption "Reservation is released only after the save succeeds." is missing (spec §6). | "Keep" what? Next to "Save attempt", the label makes the agent guess whether the reservation or the contact stays open. That is a decision bottleneck at the most frequent action. | Change the label to "Save and keep reservation" (or "Save, try another number") and restore the caption under the footer. |
| MF-07 | S3-outcome-branches.png | Branch C has Developer = "Decide later" selected, yet the disabled Developer field shows an "LA" avatar next to "Not yet assigned". | It suggests Lina Aoun is already attached. It contradicts the state and could leak a planned assignment. | Remove the avatar in the empty or disabled state, or use a neutral empty-person icon. |
| MF-08 | S5-board-A.png | Project status row: the caption is cut off at "Non-linear · Completed only ". | It hides the rule about which transition is allowed. That rule is policy-relevant. | Wrap the caption to a second line under the buttons, or move it to a tooltip or info icon with the full text "Completed only from Delivered". |
| MF-09 | S5-board-A.png | Task cards: the sub-lines are truncated ("Logo, price list and 12 ph…", "Service → time slot → co…", "Payment fields, deposit…"). The "DEC-018 Policy pendi" chip is clipped by the card. The Payment page card is cut off by the frame bottom with no scroll cue. | Truncation hides the meaning. A pending-policy label must never be clipped. | Allow 2 lines for the sub-line. Let the chip hug its content (wrap it to its own row, or shorten it to "DEC-018 pending"). Give the column a visible scroll affordance, or reduce the column header's top padding (about 60 px of empty space now sits above "To do"). |
| MF-10 | S5-task-drawer-B.png | Drawer: the Due date field runs past the drawer content edge, so its right border is lost and the calendar icon sits on the edge. Status, Owner and Description are narrower than the date row. | It looks broken, and the field widths don't match. | Put the dates in a 2-column grid with FILL children inside the same content width as the other fields (all fields at the same width). |
| MF-11 | S5-board-A.png | "Record delivered" is a solid navy primary button. Spec §4 says Secondary teal outline, with an open-task warning. It sits next to the other primary, "+ Add task". | There are two primaries, and a project-status change looks like the default action. That invites accidental "delivered" records. | Use `Button/Secondary`. Keep "+ Add task" as the only primary. |
| MF-12 | S5-board-A.png (and the drawer) | The task card shows a chip that reads "Waiting for client". The dashed outline marks it as derived, but nothing on the board says that. | "Waiting for client" is a **project** status (it is also a "Move project to" option on the same screen). On a task card the same words read as a task status, which is the exact confusion the brief forbids. | Rename the task chip to "Client dependency" (tooltip: "Waiting for client content; not a status"). Keep "Waiting for client" only for the project status. |
| MF-13 | S6-myday-light.png, S6-myday-dark.png | There is no DEC-007/008 label. The "Toward 9 h workday" bar and the punctuality row are presented as fact, and the punctuality row from spec §3 is absent. | Brief §6 requires the DEC-007/008 label on My Day. A 9 h schedule is shown as decided. | Add `Notice/Policy pending` "DEC-007/008 pending — schedule and grace; 9 h shown as working assumption" under the progress bar. Restore the "Punctuality · derived" row. |
| MF-14 | S6-checkout-light.png, S6-checkout-dark.png | The primary "Check out" button is disabled after the office check fails. Nothing near it says why or that this is illustrative. | A disabled button **is** DEC-026 Alt A (Blocked). Alt A is labelled "not selected", so a pending policy is shown as decided. The caption "never … blocked silently" contradicts the dead button. | Add the spec's annotation beside the button: "Enabled behaviour depends on DEC-026", with the reason inline ("Office check failed — retry or see DEC-026"). Better still, show a neutral "Check out (pending DEC-026)" state rather than a bare disabled state. |
| MF-15 | S6-checkout-light.png, S6-checkout-dark.png | "Retry check" is about 32 px tall, and "Cancel" is a bare text link about 20 px tall. | Retry is the main recovery path on mobile, and these targets are below the 44 px minimum. | Make Retry check a full-width 44 px secondary button. Give Cancel a 44 px hit area (ghost button). |
| MF-16 | S1-login-desktop.png | The logo placeholder caption "placeholder — awaiting supplied file" overflows its dashed box on both sides. | It breaks the one element the brief singles out (the logo placeholder must be clearly labelled in a neutral box). | Let the box hug its text, or wrap the caption to 2 lines. |
| MF-17 | S1-login-desktop.png | The Password focus ring is thick (about 3 px) at the top and bottom but about 1 px at the sides. | The focus-state component is defective, and every screen will inherit it. | Fix the focus effect on `Input` (an even 2 px ring or spread shadow on all sides). Re-capture. |
| MF-18 | S1-state-invalid-credentials.png | The Password field has an error-red border with no message. The note says "never says which field is wrong". | A red border on one field signals that the password is the wrong field, which contradicts the security rule. If the field is red because it is empty, the required message is missing. | For bad credentials, leave both fields neutral. For an empty field, add the inline error "Enter your password". |

## Minor / optional polish

- The logo placeholder varies across frames. The login hero says "Udigity logo / placeholder — awaiting supplied file", while the sidebar, the 2FA card and the mobile frames say "Logo placeholder". Use the single `Brand/Logo (placeholder — awaiting supplied file)` text everywhere.
- S1: an orphan word ("in.") ends the 2FA hint line. The 2FA code placeholder "000 000" is right-aligned; centre it or left-align it. The R11-a and R11-b cards have unequal heights.
- S2: "Missing checkout" (attendance stat) touches the card edge. "1 missing checkout" next to "0 checked out" today is ambiguous; say "Missing checkout · yesterday". The y=0 label of the pipeline chart crowds the "1 Oct" label.
- S3: the Purpose input and the Branch B rejection reason truncate with "…". This is acceptable in inputs, but add a tooltip or allow 2 lines. "Cancel contact" reads as plain text; style it as a ghost button. The "Active" status badge in the panel header (spec) is missing. The centre column is cut off at the frame bottom with no card bottom edge.
- S3 Branch B: all three D4 radios are disabled. Annotate that the save is not blocked by them, or the panel reads as a dead end.
- S4-F1: the error summary sits top-right beside the title. Place it above the form columns, or at least before the first field in reading order (N4 says "summary at the top"). There is a large empty band above the footer.
- S4-F3: "Discard my changes" and "Cancel" sit side by side as two exits; merge them or explain the difference. The DEC-003 chip floats mid-row, far from the text it qualifies.
- S4-N1: the dialog has no border or shadow on the white annotation card. Shadow notches show at its bottom corners. The body copy contains the raw bracket text "[DEC-003 pending: what may be shown]"; use a notice instead.
- S5: the "Client dependency add…" activity title truncates. The "Today · 20 Oct" marker label crowds the milestone line.
- Cross-frame data: Maya's check-in time is 08:58 on S3 but 09:04 on S6. Align the times.
- S6 My Day: "6 items · no check-in needed" is unclear; say "You can view this before checking in". The last work-list row sits under the tab bar; add bottom padding equal to the tab-bar height.
- S6 dark: the error banner's red-on-maroon and the purple chips are readable but low-key. Report the computed contrast for `status/danger/fg` on `status/danger/bg` in Dark and for the policy-chip pairs.

## Overall visual direction

The sample delivers the brief well:
- A deep-navy sidebar and primary buttons, teal for accents, focus, links and progress, and white or grey-50 surfaces.
- Restrained borders, almost no shadows, consistent 8–12 px radii, and a single Inter type scale.
- Dashboards are structured into equal cards, and forms are focused in three columns. The tone is calm and operational, with no banking or e-commerce styling.

The dark theme is a true remap rather than an inversion, and it stays legible. The pending-policy chips (violet with an hourglass) are distinctive without being loud, though their density on S2, S3 and S4 makes some cards busy; consider collapsing repeated chips into one per card. The weak spots are craft, not direction: fixed-width content that overflows its cards, and floating overlays that cover content.

## What I could not judge from a static image

- Keyboard order, focus movement (error-summary links to fields, dialog focus trap, drawer return focus) and screen-reader labels.
- Real scroll behaviour: sticky footers, whether the "More below" pills move or disappear, and the inner scroll of the kanban columns.
- Hover, pressed and loading states, live timers (elapsed time, reservation countdown and renewal) and toasts.
- Actual contrast ratios. I eyeballed them only; computed WCAG numbers are needed for the dark chips, the disabled text and the error banners.
- Responsive behaviour between breakpoints, and the desktop layout below 1440 (S2 already overflows at 1440).
- Whether the shown values are real component instances bound to tokens or detached overrides. That needs a layer inspection, which I was told not to do.
- Permissions beyond what is drawn: for example whether the Developer "Deals" nav lists only eligible deals, and what the "More" menus contain.

## Verification pass (post-fix)

Reviewer: Independent Visual & Interaction Reviewer. Date 2026-10-21. Inputs: the 18 PNGs in `docs/phase5/previews/final/` after the fixes (retaken per `index.md`), plus `brief.md` §4–§6. I made no Figma calls and approve nothing.

### Must-fix status

| ID | Status | What I see now |
|---|---|---|
| MF-01 | Fixed | S2 light and dark: "Export" is complete and ends inside the right padding. The filter row fits in 1440. |
| MF-02 | Fixed | Both "Send again" buttons have full borders. Targets show "6 / 10", "22 / 40" and "0 / 40 (not in yet)" inside the padding. The tracks fit and the footnote wraps cleanly. |
| MF-03 | Fixed | The pipeline x-axis ends with a readable "20 Oct". |
| MF-04 | Fixed | The queue scroll hint is pinned as a solid footer strip ("More below · Data correction requested (1) · Bloom Florist +1"). It no longer covers a row. |
| MF-05 | Fixed | Call history ends with a pinned strip, "Scroll for 2 earlier attempts and business details". It is consistent with "3 attempts" and one attempt shown. No entry is covered. |
| MF-06 | Fixed | The label now reads "Save, keep reservation". The caption "Reservation is released only after the save succeeds." is restored. |
| MF-07 | Fixed | Branch C: the disabled Developer field shows "Not yet assigned" with no avatar. |
| MF-08 | Fixed | The caption wraps to two lines: "Non-linear · Completed only from Delivered". |
| MF-09 | Fixed | Task sub-lines get 2 lines. The "DEC-018 pending" chip is whole. The Payment page card is fully inside the frame. |
| MF-10 | Fixed | The drawer's Start and Due dates sit in a 2-column grid at the same width as Status, Owner and Description. Borders and icons are intact. |
| MF-11 | Fixed | "Record delivered" is an outline secondary. "Add task" is the only primary. The open-task warning only shows on click, so I cannot verify it from a static frame. |
| MF-12 | Fixed | The task chip reads "Client dependency" on both the card and the drawer. The drawer explains it: "not a task status". "Waiting for client…" appears only as a project move. |
| MF-13 | Fixed | My Day light and dark: "Toward 9 h workday (assumed)", a "Check-in 08:58 · On time · Derived" row, and a DEC-007/008 notice that calls the 9 h workday and "On time" working assumptions. |
| MF-14 | Fixed | The primary reads "Check out · outcome per DEC-026". The caption says "depends on DEC-026 (none selected)". It no longer looks like a disabled Alt A. |
| MF-15 | Fixed (hit area unverifiable) | "Retry check" is a full-width, roughly 44 px secondary button. "Cancel" is a centred ghost button. I cannot measure its 44 px hit area from the image. |
| MF-16 | Fixed | The logo placeholder box contains its two-line caption. |
| MF-17 | Fixed | The Password focus ring is an even 2 px on all sides. |
| MF-18 | Fixed | Invalid credentials: both fields are neutral, the password is cleared, and the banner names neither field. |

### Known small items (judged)

- **S5 rail shows one Activity item.** Acceptable. "View all" is present and the item is complete apart from a title truncation (polish).
- **S2 DEC-026 chip touches the Exceptions card bottom.** Acceptable. The chip is not clipped and stays readable. Polish: add about 8 px of bottom padding.
- **S6 checkout: Alt B/C sit below the sticky footer.** Acceptable. This is a scroll state: the alternatives are annotated and reachable, and the footer button and caption state the pending outcome. Polish: add a fade above the footer.

### New issues

| ID | File | What you see | Fix |
|---|---|---|---|
| NV-01 (minor, non-blocking) | S6-checkout-light.png, S6-checkout-dark.png | The progress label reads "Toward 9 h workday", without the "(assumed)" that My Day now carries. The DEC-007/008 notice is not repeated here. | Add "(assumed)" to match My Day. |
| NV-02 (minor, carried over) | S4-N1-hidden-match.png | The dialog still has raw bracket text, "[DEC-003 pending: what may be shown]", and shadow notches at its bottom corners. The DEC-003 notice below already covers the meaning. | Remove the bracket text and fix the card shadow. |

I found no new missing action, permission or data exposure, broken layout, or light/dark readability failure.

**Overall verdict: Ready for user visual approval.** All 18 must-fix items are resolved. The remaining items are minor polish.
