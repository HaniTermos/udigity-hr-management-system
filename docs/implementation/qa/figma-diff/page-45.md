# Figma diff: page 45 (cross-cutting states)

Date 2026-10-28. This was a read-only pass: no source code was changed. I compared the app against `docs/phase6/previews/45/` and `docs/implementation/figma-specs/page-45.md`, and made no Figma MCP calls. The environment and method are the same as in [page-42.md](page-42.md). App screenshots are in `shots/45/`.

**Shell findings** (nav model, mobile header and tab bar, sidebar and top-bar sizes, policy-chip copy) are listed once in page-42.md as X-1…X-7 and are not repeated or counted here.

**How I reached the states.** Some states could not be produced with the seed data. I reached them by intercepting responses with `page.route`, so nothing was written to the DB:
- notification list: mocked
- `403 HIDDEN_BY_POLICY` / `OWNER_2FA_REQUIRED`: mocked
- `409 VERSION_CONFLICT`: mocked
- offline: `context.setOffline(true)`

## Summary

| Screen | Variants checked | Verdict |
|---|---|---|
| SCR-SHR-007 Notifications | D-L (mocked items), M-L, Empty (D-D captured, not reviewed) | **Major**. Target no longer accessible: not reachable. |
| SCR-SHR-011 Permission denied | D-L Role denied (/reports), Data Entry on /employees, M-L, Owner without 2FA (component through a mocked 403) (D-D captured, not reviewed) | **Major** |
| SCR-SHR-012 Record hidden by policy | D-L (component through a mocked 403), real hidden business on /queue, M-L (D-D captured, not reviewed) | Minor (plus the business-detail Major in page-42 SHR-008 #1). Stale-link variant: not reachable. |
| SCR-SHR-013 Session ended | D-L Expired, Revoked, Deactivated, D-D Expired, M-L Expired; In-app dialog | Minor. In-app dialog: **Major** (not wired). |
| SCR-SHR-014 Save conflict | D-L, M-L (D-D captured, not reviewed) | Minor |
| SCR-SHR-015 System state patterns | Offline in context D-L and M-L; reference-sheet patterns spot-checked through other screens | **Major** (offline). Reference sheet D-L/D-D/M-L: not reachable (there is no route). |

**Counts for page 45:** Major 5 · Minor 15 · Cosmetic 2.

---

## SCR-SHR-007 — Notifications

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | **Major** | Standard page: H1 "Notifications" + "Updates about your deals, meetings and tasks", "Mark all as read ✓" link on the right. Filter chips "All ×", "Unread · 2 ⌄". Two policy notices (AR-14, No DEC ID). A single list card with rows: icon, a **specific title** ("Meeting booked: Peak Fitness Gym — Member app"), meta "Maya Khoury · today 10:24 · Meetings & Calendar", an "Unread" badge and a chevron that opens the target. | This page looks like it predates the Figma design. It is centred `max-w-4xl` with an icon tile in the header and a "2 unread" pill, plus segmented tabs "All notifications 5 / Unread only 2". Each item is a separate card whose title comes from the template key ("Deal Assigned" / "Notification regarding deal assigned."). Each card also shows "Channel: In-App" and per-item "Mark as read". There is no target link or chevron, no policy notices, and dates are US format "Oct 28, 03:04 PM" (`SHR-007-D-L.png`). | `frontend/src/app/notifications/page.tsx`; API `lib/api/notifications.ts` (the item has only `template`/`family`/`createdAt`); backend `modules/notifications` | Rebuild the page to the frame. Extend the API item with a title, context line, target href and source area, and format dates in company time ("today 10:24"). |
| 2 | Minor | Empty: "You're all caught up / New notifications about your work will appear here." under the chips and notices, with no card. | "No notifications yet / Activity, task assignments…" inside a bordered card, plus the tabs with zero counts (`SHR-007-D-L-empty.png`). | same | Part of #1. |
| 3 | Minor | Mobile: header "Notifications / 2 unread"; chips + 2 policy chips; compact one-line rows with ellipsis. | Large H1 block repeated under the header; tall cards with three lines each (`SHR-007-M-L.png`). | same | Part of #1. |
| 4 | Minor | Header bell shows a red dot for unread. | Red count badge "2" on the bell (`SHR-007-D-L.png` header). | `components/layout/Header.tsx` | Use the 8 px dot (keep the count for the aria-label only). |
| — | Not reachable | "Target no longer accessible" state. | The items have no target, so there is no click-through that can fail. | — | Comes with #1. |

## SCR-SHR-011 — Permission denied

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | **Major** | Full content area: lock, "You don't have access to this page", body naming the role and area, "Go to My Day", "‹ Back". No page chrome from the denied page. | On /reports as Developer the denied state appears **under** the Reports header and its Format/From/To controls, plus the OQ-18 footnote (`SHR-011-D-L-role.png`, `SHR-011-M-L-role.png`). The shared component's copy matches. | `frontend/src/app/reports/page.tsx` | When denied, return `<PermissionDenied/>` alone (no header, no controls). |
| 2 | **Major** | Same full-page denied. | On /employees as Data Entry the page header, the **"Add employee" button** and the filters stay visible, and a custom red-icon "Owners only / Your role cannot view the employee directory." is shown instead of the shared component. The footnote also stays (`SHR-011-D-L-employees-DE.png`). | `frontend/src/app/employees/page.tsx` (`denied` branch) | Render the shared `PermissionDenied` and hide the actions. |
| 3 | Minor | Owner without completed 2FA: split auth layout (brand panel on the left, card on the right). | `PermissionDenied variant="owner-2fa"` matches the card's content, but when an API returns `OWNER_2FA_REQUIRED` it is drawn **inside the app shell** under the page header (`SHR-011-D-L-owner2fa-component.png`). /employees shows the generic "Something went wrong" for that code (`SHR-011-D-L-owner2fa.png`). I did not test a real Owner session with 2FA pending, because it would need a fresh sign-in. | `components/states/ApiErrorView.tsx`, `app/employees/page.tsx`, `components/layout/AppShell.tsx` | Route `OWNER_2FA_REQUIRED` to a shell-less auth page, and add the code to the /employees denied check. |
| 4 | Minor | Mobile: header title "No access"; full-width "Go to My Day". | Header "Reports & Exports"; button is not full width (`SHR-011-M-L-role.png`). | `components/states/PermissionDenied.tsx` + X-2 | Use full-width buttons below `md` and set the page title. |

## SCR-SHR-012 — Record hidden by policy

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | Minor | Breadcrumb "Calling Queue › Record unavailable"; icon, title, body, "Back to Calling Queue"; the 3 DEC chips and the "Request access" notice. | The `HiddenByPolicy` component matches in title, body and button. The page keeps its "Contact workspace" header, its "Follow-ups & Calendar" / "Do-not-call list" actions and a "Calling Queue > …" crumb. The DEC chips and the notice are not shown (`showPolicyChips` defaults to false) (`SHR-012-D-L-hidden-component.png`). | `app/queue/[businessId]/page.tsx`, `components/states/HiddenByPolicy.tsx` | When hidden, replace the page header with the "Record unavailable" crumb and pass `showPolicyChips`. |
| 2 | Minor | A business hidden from the role → SCR-SHR-012. | For a real hidden business (Harbor Auto Care) as Call Center, the server returns permission-denied, so the role-denied copy is shown: "You don't have access to this page / Your role (Call Center) can't open this business" (`SHR-012-D-L-queue-hidden.png`). | backend `modules/calls` (workspace access) / `lib/errorRouting.ts` | Return `HIDDEN_BY_POLICY` for policy-hidden records. |
| 3 | Minor | Mobile: header "Record unavailable", full-width back button, chips stacked. | Header "Calling Queue", page title and actions repeated, button not full width (`SHR-012-M-L-hidden-component.png`). | as above + X-2 | — |
| 4 | Cosmetic | The breadcrumb separator is a chevron icon. | The literal text "Calling Queue > …". | `components/calling/CallingPageHeader.tsx` | Use the shared Breadcrumb. |
| — | (see page-42 SHR-008 #1) | — | The business detail page uses a different, older hidden component. | `components/businesses/AsyncState.tsx` | — |
| — | Not reachable | Stale link from a notification or calendar. | Notifications have no links (SHR-007 #1). | — | — |

## SCR-SHR-013 — Session ended

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | **Major** | In-app dialog over the page: "Your session has expired / Sign in again to continue." + "Your unsaved note was not saved" warning + Impl. decision + "Sign in again". | `SessionEndedDialog` is exported but **never used**. Every 401 calls `router.replace('/session-ended')` (`lib/hooks/useErrorRouter.ts:19-21`), so the user leaves the page with no in-place notice. I tried to trigger it on /businesses/new, but client validation stopped the request first (`SHR-013-D-L-inapp-401.png`). | `lib/hooks/useErrorRouter.ts`, `components/layout/GlobalErrorRouting.tsx`, `components/states/SessionEnded.tsx` | When a 401 arrives while a form is dirty, show `SessionEndedDialog` instead of redirecting. |
| 2 | Minor | Brand panel title "Udigity Management System" ~32/40 Bold. | ~26 px SemiBold (`SHR-013-D-L-expired.png`). Shared with the page-40 auth screens. | `components/auth/AuthShell.tsx` | Use the H1 display size. |
| 3 | Minor | Impl. decision notice is compact and inline: label "Impl. decision" + text on one block. | Block notice with a heading row "Impl. decision  Implementation decision" (label repeated) and the body underneath. The same pattern appears on Expired, Revoked and Deactivated. | `components/ui/NoticePolicy.tsx` (implementation tone) | Use the inline size on this card. |
| 4 | Minor | Mobile: logo placeholder at the top; card content stacked and centred (lock icon above a centred title). | No logo; desktop inline icon row layout (`SHR-013-M-L-expired.png`). | `components/states/SessionEnded.tsx`, `AuthShell.tsx` | Add the mobile brand row and a stacked variant. |
| 5 | Cosmetic | "Unsaved changes" alert body in primary 14/20. | Warning-fg at 13 px. | `components/ui/Alert.tsx` | — |
| — | Match | Revoked, Deactivated and Dark copy and structure. | They match apart from #2 and #3. Dark is navy. | — | — |

## SCR-SHR-014 — Save conflict

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | Minor | Above the banner: breadcrumb "Businesses › Glow Beauty Salon › Edit", H1 "Edit business", subtitle "Glow Beauty Salon · Downtown branch · Salon". | The breadcrumb, title and subtitle are gone; the banner starts at the top (`SHR-014-D-L-conflict.png`). | `app/businesses/[id]/edit/page.tsx` (conflict branch) | Keep the page header when rendering `SaveConflict`. |
| 2 | Minor | The Result column badges are on one line ("Their change", "Your change", "Both changed"); column headers show times only ("(10:31)"). | The badges wrap to two lines inside a tall pill. Headers carry full date-times ("(28 OCT 2026, 13:14)"), which squeezes the columns. | `components/states/SaveConflict.tsx` | Add `whitespace-nowrap` to the badges and use time-only for today. |
| 3 | Minor | Mobile: compact header (record name), field cards, **sticky** bottom actions "Re-apply my edits" + "Reload latest"; no tab bar. | Generic header; the actions are inline after the content and the tab bar is visible (`SHR-014-M-L-conflict.png`). The field-card layout matches. | `SaveConflict.tsx` + X-2 | Sticky action footer below `md`, and hide the tab bar. |

## SCR-SHR-015 — System state patterns

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | **Major** | Offline in context: warning banner "You're offline / Saving is paused until your connection returns. Nothing has been sent." above the content; Save becomes disabled "Save (offline)". | `OfflineBanner` exists but is **never rendered**. On /businesses, going offline and typing a search keeps the stale rows and appends a generic "Something went wrong / We could not load this…" error **under** the rows (`SHR-015-D-L-offline.png`, `SHR-015-M-L-offline.png`). | `components/states/SystemStates.tsx` (`OfflineBanner`), `components/layout/AppShell.tsx`, `lib/errorRouting.ts` (`offline` kind) | Mount an app-wide offline banner (`navigator.onLine` plus network-error route), disable saves while offline, and do not show the load-error block under rows that are still on screen. |
| 2 | Minor | Load-error pattern: "Couldn't load this list / Your data is safe. Try again in a moment." + "Try again" link. | "Something went wrong / We could not load this. Your data is safe — try again." + small button. | `SystemStates.tsx` (`LoadErrorState`) | Align the default copy. |
| — | Match | Loading skeleton, Empty, No results, Validation summary + inline error, Restricted (both lines), Pending policy labels. | Seen on DE-001, DE-002, DE-006, SHR-012 and other screens; they follow the patterns (copy differences are noted per screen). | — | — |
| — | Not reachable | Reference sheet frames (D-L, D-D, M-L). | This is a design reference and has no app route. | — | — |
| — | Not checked | Save failed (retry in place), Success toast, Stored vs derived chips. | I did not trigger them in this pass. | — | — |

## What I could not check

- **Owner with 2FA pending:** a real session was not created.
- **SHR-007 "Target no longer accessible" and SHR-012 "Stale link":** they depend on notification links, which do not exist yet.
- **SHR-015 reference sheet:** there is no route. Save-failed and toast patterns were not triggered.
- **Dark mode:** D-D frames for SHR-007, SHR-011, SHR-012 and SHR-014 were captured but not reviewed in detail. SHR-013 dark was checked and is navy.
