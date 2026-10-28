# Figma diff: page 42 (Data Entry and shared business screens)

Date 2026-10-28. This was a read-only pass: no source code was changed. I compared the app against the exported previews in `docs/phase6/previews/42/` and the specs in `docs/implementation/figma-specs/page-42.md`. I made no Figma MCP calls because the previews were enough.

**Environment.** I used the production build on :3100 with the `udigity_test_figma_qa` DB, Playwright with the stored sessions, a 1440×900 / 390×844 viewport at DPR 1, and the theme set through `localStorage['udigity-theme']`. App screenshots are in `shots/42/`.

**Data caveat.** The e2e seed has 7 businesses, 1 category ("Other", built-in), no social accounts and no correction requests. Figma uses richer demo data. I did not report differences that come only from data (names, counts, number of rows).

**How I reached the states.** Some states need data the seed does not have. I created them by intercepting responses with Playwright (`page.route`), so nothing was written to the DB:
- correction rows and the correction detail
- a social account added to the GET business response
- 409 `VERSION_CONFLICT` and `DUPLICATE_BLOCKED` on PATCH
- an empty list and a 500 error

Every PATCH was intercepted. Afterwards I checked that the Olive & Thyme Cafe record is still at version 1.

**Dark mode.** The app's dark mode is navy and Figma's is charcoal. This is intended (user directive), so I did not report it.

## Summary

| Screen | Variants checked | Verdict |
|---|---|---|
| Shell (shared by every screen below) | D-L, D-D, M-L | **Major** (nav model, mobile header and tab bar) |
| SCR-DE-001 Business directory | D-L, D-D, M-L, Owner view, Empty, Error, Loading | **Major** (mobile) / Minor (desktop) |
| SCR-DE-002 Create business | D-L, D-D, M-L, Validation errors | **Major** (mobile) / Minor (desktop) |
| SCR-DE-003 Duplicate blocked (dialog) | — | **Not reachable.** There is no page-42 frame (register: BLOCKED). The inline duplicate banner was checked under DE-004. |
| SCR-DE-004 Edit business | D-L, Duplicate blocked, Save conflict (D-D captured, not reviewed) | **Major** (save-conflict pattern) / Minor |
| SCR-DE-005 Resolve correction (drawer) | D-L In review, D-D In review | Minor. Already resolved, Duplicate on apply and Success were not checked. |
| SCR-DE-006 Correction-request queue | D-L (mocked rows), Empty (D-D captured, not reviewed) | Minor. The Resolved and Closed/rejected tabs were not checked. |
| SCR-DE-007 Categories | D-L Owner, Data Entry "denied" (D-D captured, not reviewed) | **Major** (Data Entry state) / Minor. Name exists and In use were not reachable. |
| SCR-SHR-008 Business detail | D-L, M-L, Call Center, Developer, Hidden, Permission denied, Edit history (D-D captured, not reviewed) | **Major** (hidden/denied states, dev deal context) / Minor |
| SCR-SHR-009 Submit correction (drawer) | D-L Open-request warning, D-L Validation, M-L Sheet (D-D captured, not reviewed) | Minor. Submitted was not checked. |
| SCR-SHR-010 Search results | D-L, Call Center empty (D-D and Owner captured, not reviewed) | Minor |

**Counts for page 42:** Major 9 · Minor 32 · Cosmetic 7. The shell rows X-1…X-7 are counted here and not again in page 45.

---

## Shell (shared; it also affects the page-45 screens)

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| X-1 | **Major** | Each role has its own fixed menu. Data Entry gets MY WORK (My Day, My Attendance) and BUSINESSES. Call Center gets CALLING only, with a count "7" on Calling Queue. Developer gets DELIVERY only. Owner gets OVERVIEW / PEOPLE / BUSINESSES / CALLING / DELIVERY / ADMIN. | The menu is driven by capabilities. Sections are "OVERVIEW" and "PEOPLE & ADMIN", and every role gets an extra "Notifications" item. Call Center also gets BUSINESSES and DELIVERY. Developer gets BUSINESSES (Businesses, Correction Requests, Categories), and opening Businesses shows "You do not have access to this page". On Call Center business detail the active item is "Businesses", not "Calling Queue". The Owner menu overflows the 900 px height (`shots/42/DE-001-D-L-owner.png`, `SHR-008-D-L-callcenter.png`, `SHR-008-D-L-denied.png`). | `frontend/src/lib/nav.ts` | Restore the Figma section titles and the per-role item sets. Hide items whose landing page is denied. Check this against the intentional custom-roles feature first. |
| X-2 | **Major** | Mobile header shows the record or page title plus a subtitle and back chevron (for example "Peak Fitness Gym / Gym" or "Businesses / 124 businesses"). Tab bar: Data Entry has My Day · Businesses · **Alerts** · More; Developer has My Day · **Tasks** · **Meetings** · More. | The header shows the nav section name ("Businesses", "Add Business"), and the page H1 is repeated in the content. Data Entry tab 3 is "Correction Requests". Developer tabs are Businesses and Deals (`DE-001-M-L.png`, `SHR-008-M-L.png`, `DE-002-M-L.png`). | `frontend/src/components/layout/Header.tsx`, `MobileNav.tsx`, `lib/nav.ts` (`mobileTabs`, `titleForPath`) | Let pages pass a mobile title and subtitle. Drop the in-content H1 on mobile. Use the Figma tab sets, with Alerts going to /notifications. |
| X-3 | Minor | Sidebar 240 px; top bar 64 px; header search 360×40 with a search icon and a 1 px input border; user block shows name + role + chevron; separate "Checked in · 08:51" success pill. | Sidebar 224 px; top bar 56 px; search 384×32 with no icon and a lighter border; name only; extra theme toggle. | `components/layout/Sidebar.tsx`, `Header.tsx` | Set w-60 and h-16, use a 40 px search with an icon, add the role line. Keep the theme toggle (it is user-added). |
| X-4 | Minor | Policy chip reads "DEC-001 **Policy pending**" (short, one line). | Every chip reads "DEC-001 Demonstration alternative — not approved". Header chips wrap onto a second line. Inside the 270 px cards the chip text breaks badly ("DEC-" / "013" on two lines, `DE-002-D-L.png`). | `components/ui/NoticePolicy.tsx` / `PolicyTag.tsx` (`DEMO_ALTERNATIVE_LABEL`) | Use "Policy pending" in Chip size and keep the long label for Block notices. Add `whitespace-nowrap` to the DEC id. |
| X-5 | Minor | All table headers are uppercase overline ("BUSINESS ↑", "CATEGORY ↑"). | The sortable header is mixed case ("Business ↑", "Category ↑") while the other headers are uppercase. | `components/ui/Table.tsx` (sortable TH) | Apply the same overline class to sortable headers. |
| X-6 | Minor | Phones are grouped: "+000 70 000 101". | "+961 70100001" (not grouped) in the directory, detail, search and edit inputs. | `components/businesses/format.ts` | Group the local number 2-3-3. |
| X-7 | Minor | Date field shows "14 Oct 2026" with a calendar icon on the right. | Native `mm/dd/yyyy` with a calendar icon on the left plus the browser picker icon (two icons). A saved value shows as "10/14/2026" (`DE-004-D-L-duplicate.png`). | `components/businesses/BusinessFormCards.tsx`, `components/ui/Input.tsx` | Use a formatted date display (company locale) and keep a single icon. |

## SCR-DE-001 — Business directory

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | **Major** | Mobile has a card list (row = name + "meta · phone" + flag), compact chips (Category, Correction requested, No phone), "Showing 6 of 124 · scroll for more", and a full-width "Add business" at the bottom. | The desktop table is squeezed to 390 px: phone and social columns are cut off, all four selects are stacked full width, the 3 policy chips are stacked, and "Add business" sits at the top (`DE-001-M-L.png`). | `components/businesses/BusinessTable.tsx`, `app/businesses/page.tsx`, `BusinessFilters.tsx` | Add a `<md` list variant and a compact filter row, and move the CTA to the bottom. |
| 2 | Minor | Filter row: the search takes the remaining width (~464 px) and the 4 selects are fixed at 160 px. | The search is 224 px and the placeholder is cut off ("Search name, phone or s"); the selects are 224 px each. | `BusinessFilters.tsx` | Search `flex-1`, selects `w-40`. |
| 3 | Minor | Quick-filter chips have a chevron. There is a disabled chip "Archived · C-01 pending" (Owner and Data Entry). | No chevrons. Data Entry has no archived chip. Owner has an enabled "Archived" chip. | `BusinessFilters.tsx`, `FilterChip.tsx` | Add the chevron. Show the disabled C-01 chip until C-01 is decided, or record that it is intentionally enabled for the Owner. |
| 4 | Minor | Error: "Could not load businesses / Your search and filters are kept. Check your connection and try again." with a 40 px "Try again" button. | Generic "Something went wrong / We could not load this. Your data is safe — try again." with a 32 px small button (`DE-001-D-L-error.png`). | `components/businesses/AsyncState.tsx` / `components/states/SystemStates.tsx` | Pass the screen-specific title and body, and use size md. |
| 5 | Minor | Empty: Primary M "Add business"; no pagination row. | Small secondary "Add business"; the pagination row "Showing 0–0 of 0" is still shown (`DE-001-D-L-empty-nodata.png`). | `BusinessTable.tsx` | Use the primary md CTA and hide the pagination when the total is 0. |
| 6 | Cosmetic | Flag "Hidden from other roles" uses info blue. | Policy purple (`DE-001-D-L-owner.png`). | `components/businesses/FlagChips.tsx` | Use `status/info` tokens. |
| — | Match | Loading skeleton. | Same structure (6 rows vs 7; the pagination is visible). | — | — |

## SCR-DE-002 — Create business

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | **Major** | Mobile: compact header "New business / Duplicates are checked when you save" with back; no tab bar; footer has two equal buttons (Cancel and Save business) pinned to the bottom. | Header "Add Business"; breadcrumb, H1 and two wrapped chips repeated in the content; the footer card (long helper text + "Not saved yet" + buttons) floats over the form; the tab bar is still visible (`DE-002-M-L.png`). | `app/businesses/new/page.tsx`, `components/businesses/BusinessForm.tsx`, `MobileNav.tsx` | Hide the tab bar on form routes. Mobile footer = two `flex-1` buttons, with no helper text. |
| 2 | Minor | Business details card: Name → helper → DEC-013 → Category → "Suggest a new category" link → DEC-015 → Has website. | Adds a "Branch or location (optional)" field and helper. The link reads "View categories". | `components/businesses/BusinessFormCards.tsx` | Confirm whether Branch is intended (it is not in the frame). Use the "Suggest a new category" copy, or record why it differs. |
| 3 | Minor | Footer bar is pinned to the bottom of the viewport (y = 818). | With a short form the footer sits right after the cards (y ≈ 738). It is only sticky when the content overflows. | `BusinessForm.tsx` | Make the footer `sticky bottom-4` with `mt-auto` in a min-h-full column. |
| 4 | Minor | Validation: summary "3 fields need attention" in the header's right column; footer status in red "Not saved — 3 fields need attention". | Full-width summary "Fix 7 things before saving" above the cards; footer still says "Not saved yet" (`DE-002-D-L-validation.png`). | `BusinessForm.tsx`, `components/states/SystemStates.tsx` (`ValidationSummary`) | Show the error count in the footer status in danger colour, and use the Figma title copy. |
| 5 | Minor | Number field right-aligned; phone placeholder is the local number. | Followers input is right-aligned (ok). The phone has a placeholder "70 000 000" in a separate box: the country select and number are two boxes, not one combined control with a divider. | `BusinessFormCards.tsx` | Merge them into a single bordered Input/Phone control. |

## SCR-DE-003 — Duplicate blocked (dialog)

**Not reachable.** The screen has no page-42 frame (register: BLOCKED). The page-30 samples were not compared. The duplicate state appears inline in DE-004 (see below).

## SCR-DE-004 — Edit business

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | **Major** | Save conflict on this screen: the form stays visible. Warning banner "Rana Haddad saved changes … / Show what changed"; on each changed field a badge "Changed by Rana Haddad · 09:40" and a "Re-apply mine" link; footer "Not saved — review latest values" plus "Discard my changes". | The form is replaced by the SCR-SHR-014 diff table, and the breadcrumb and title disappear (`DE-004-D-L-conflict.png`). | `app/businesses/[id]/edit/page.tsx` | Decide which design applies; Figma draws both. If DE-004 wins, keep the form, add the per-field badges and offer the table behind "Show what changed". |
| 2 | Minor | When the form is dirty the footer says "Unsaved changes". | When the form is clean it says "Not saved yet" (the create-form copy); after typing it changes to "Unsaved changes". | `BusinessForm.tsx` | For edit, clean state = "No changes" (or empty). |
| 3 | Minor | "Last updated by Rana Haddad · 21 Oct". | "Last updated by — · 28 Oct 2026" when there is no editor (also on detail and in the Record card). | `BusinessForm.tsx`, `BusinessDetailView.tsx` | When `updatedBy` is null, show the creator, or hide the "by". |
| 4 | Minor | Client validation. | A seed record with no social account cannot be saved at all: "At least one social account is required" is shown as soon as you press save. Expected by the rule, but legacy records are blocked from any edit. | `businessFormModel.ts` | Product decision; noted only. |
| 5 | Cosmetic | Duplicate banner action "Open existing business" in teal link style. | Danger-red underlined link (`DE-004-D-L-duplicate.png`). The rest matches. | `components/businesses/DuplicateBlocked.tsx` | Use `text-link`. |

## SCR-DE-005 — Resolve correction (drawer)

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | Minor | Detail block: "Phone 2 now: +000 70 000 112 / Suggested / Explanation". | "Field: Phone 1 / Suggested / Explanation". There is no current value because the API returns `currentValue: null` (a documented v1 gap) (`DE-005-D-L-inreview.png`). | `ResolveCorrectionDrawer.tsx`, backend `modules/corrections/service.ts` | Read the current value from the business and show "<Field> now". |
| 2 | Minor | "Open business detail" link right-aligned on the Outcome row; no extra notice in the body. | The link is on its own line under Outcome. An extra "No DEC ID … Demonstration alternative" block notice sits above the footer, so the body needs to scroll. | `ResolveCorrectionDrawer.tsx` | Put the link in the Outcome row and fold the policy into the Outcome chip. |
| 3 | Cosmetic | Dark: unselected radio is a ring on the navy surface. | The unselected radio fill looks brown/grey on navy (`DE-005-D-D-inreview.png`). Not checked against a Figma dark frame. | `components/businesses/RadioCard.tsx` | Use the `surface/default` token for the radio fill in dark. |
| — | Not checked | Already resolved, Duplicate blocked on apply, Success. | Not reached (they need real state transitions). | — | — |

## SCR-DE-006 — Correction-request queue

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | Minor | Requester meta "Call Center" / "Developer". | Raw role enum "call_center" / "developer" (`DE-006-D-L.png`). The backend sends `rq.role` unchanged. | `components/businesses/CorrectionsTable.tsx:127` | Map it through the role-label helper. |
| 2 | Minor | Redacted row: "Business hidden by policy / Details not shown". | The business cell is blank because the API sends `businessName: null` for redacted rows (`service.ts toRow`). | `CorrectionsTable.tsx:93` | When `redacted`, render the fixed copy. |
| 3 | Minor | Empty: "No open correction requests / When someone flags incorrect data, the request appears here for Data Entry or the Owner to review."; no footnote. | "No open requests / New requests from …". The DEC-002 redacted-row footnote ("not counted in Open (0)") is still shown (`DE-006-D-L-empty.png`). | `app/corrections/page.tsx:125` | Use the Figma copy and show the footnote only when a redacted row exists. |
| 4 | Cosmetic | Business meta "Downtown branch · Salon". | The backend joins category · branch (order reversed). | backend `corrections/service.ts` | Use the order branch · category. |

## SCR-DE-007 — Categories

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | **Major** | Data Entry: full-page "You cannot manage categories" (lock icon, "Back to businesses", DEC-015 chip). | Data Entry sees the read-only list plus a disabled "Add category" form and both policy notices (`DE-007-D-L-denied-DE.png`). | `app/categories/page.tsx`, `components/businesses/CategoryPanels.tsx` | Decide: either show the Figma denied state, or (if Data Entry must read the list) hide the disabled add form and record the deviation. |
| 2 | Minor | Footnote: chip and text on one row. | The chip and text are on two lines. | `app/categories/page.tsx` | Use a flex row. |
| — | Not reachable | Rename / Remove… actions, Name exists, In use. | The DB only has the built-in "Other" (shows "Built in"). | — | Reseed with categories to check. |

## SCR-SHR-008 — Business detail

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | **Major** | Hidden by policy: breadcrumb, "This record isn't available to you / It is outside what your role can see…", a "Back to Calling Queue" button, DEC chips, vertically centred. | The old `NoticeAccess` is used instead: "This record is not visible to you"; no button and no breadcrumb; placed at the top (`SHR-008-D-L-hidden.png`). The business module does not use the shared SCR-SHR-012 component. | `components/businesses/AsyncState.tsx` → `components/ui/NoticeAccess.tsx` | Route business errors through `components/states/ApiErrorView` (HiddenByPolicy / PermissionDenied). |
| 2 | **Major** | Permission denied variant (from the Figma state list): lock, title, action. | "You do not have access to this page / Your role cannot open this screen…" with no action, at the top (`SHR-008-D-L-denied.png`). Same cause as #1. | `AsyncState.tsx` | Same as #1. |
| 3 | **Major** | Developer context-limited: breadcrumb "Deals › Glow Beauty Salon — Booking website › Business"; subtitle "Salon · Downtown branch"; right column "Deal context" card (Deal / Stage / Project) above the DEC-005 notice. | Breadcrumb "Deals › Business"; no Deal context card; only the DEC-005 notice (`SHR-008-D-L-developer-glow.png`). The Glow deal is closed with a project, so the data exists. The API has a `dealContext` key; I did not check whether it was null here. | `components/businesses/BusinessDetailView.tsx` | Render `dealContext` (and the deal crumb) when present, and check that the backend fills it. |
| 4 | Minor | Record card has a third row "Calling: Assigned · read-only here" / "Assigned to you" (CC). | The Calling row is missing in every role view. | `BusinessDetailView.tsx` (`calling` field) | Render the `calling` summary. |
| 5 | Minor | Detail rows are 44 px apart. | 36 px apart (denser). | `BusinessDetailView.tsx` | Rows `py-3`. |
| 6 | Minor | Edit history tab keeps the Correction requests and Record cards on the right. | The Record card disappears on the history tab (`SHR-008-D-L-history.png`). | `BusinessDetailView.tsx` | Keep the right column the same on every tab. |
| 7 | Minor | Mobile: header = business name + category; flag; full-width "Edit business"; no tabs; "Notes, record and edit history continue below." | Generic header; breadcrumb, H1 and meta repeated; button is not full width; tabs shown (`SHR-008-M-L.png`). | `BusinessDetailView.tsx` + shell X-2 | Mobile variant per the frame. |
| 8 | Cosmetic | "Correction requested (1)" flag has no border. | It has a bordered pill (`SHR-008-D-L-filled.png`). | `FlagChips.tsx` | Remove the border. |

## SCR-SHR-009 — Submit data correction (drawer)

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | Minor | Mobile: bottom sheet (rounded top, page and scrim visible behind), two equal buttons. | Full-screen right drawer with a visible left border; buttons right-aligned, not equal (`SHR-009-M-L-sheet.png`). | `components/ui/Drawer.tsx` | Use the sheet variant below `md`. |
| 2 | Minor | Field placeholder "Choose a field (optional)"; suggested value placeholder "e.g. the correct handle"; counter 0 / 500; error "Choose an issue type." | "Not a specific field" preselected; no placeholder; 0 / 1000; "Choose the issue type." (`SHR-009-D-L-validation.png`). | `components/businesses/SubmitCorrectionDrawer.tsx` | Align the copy and limit (the limit may be a backend rule; check). |
| 3 | Minor | The "No DEC ID" notice is an inline one-line chip notice. | Block notice with an extra "Demonstration alternative — not approved" line. | `SubmitCorrectionDrawer.tsx` / X-4 | Use the inline size. |
| 4 | Cosmetic | Warning body text in primary colour. | Warning body in warning-fg (`SHR-009-D-L-open-warning.png`). The open-request warning itself matches. | `components/ui/Alert.tsx` | Body `text-primary`. |
| — | Not checked | Submitted state. | Not reached; it would need a real submit. | — | — |

## SCR-SHR-010 — Search results

| # | Sev | Figma | App | Likely file | Proposed fix |
|---|---|---|---|---|---|
| 1 | Minor | Header search shows the current query ("70 000 15") with a clear ×. | The header search is empty on /search (`SHR-010-D-L.png`). | `components/layout/Header.tsx` | Initialise from `?q=` and add a clear button. |
| 2 | Minor | Scope chips: "All (3) ×", "Name ⌄", "Phone ⌄", "Social handle ⌄". | "All (1) ×", "Name (1)", "Phone (0)", "Social handle (0)" with no chevrons. | `components/businesses/SearchResults.tsx` | Follow the frame, or keep the counts as an accepted improvement. |
| 3 | Minor | Call Center scope subtitle "Searching businesses assigned to you." + DEC-003 only. Empty: "No businesses found" with no table and no pagination. | Generic subtitle with DEC-001/002 and DEC-003. Empty state inside the table: "No matches" with pagination "Showing 0 of 0" (`SHR-010-D-L-cc-empty.png`). | `SearchResults.tsx`, `app/search/page.tsx` | Add a role-scoped subtitle and a stand-alone empty state. |
| 4 | Cosmetic | "Matched on" badge is a bordered pill. | Square neutral badge. | `SearchResults.tsx` | Use the outlined pill badge. |

## What I could not check

- **SCR-DE-003:** there is no page-42 frame.
- **Not reached (they need real state changes):** DE-005 Already resolved / Duplicate on apply / Success; DE-006 Resolved and Closed tabs; DE-007 Name exists / In use / row actions; SHR-009 Submitted; DE-002 Success; DE-004 Success / Validation (the seed record is blocked by the social-account rule).
- **Dark mode:** D-D frames were captured for DE-002, DE-004, DE-006, DE-007, SHR-008, SHR-009 and SHR-010, but I only spot-checked DE-001, DE-002 and DE-005. Navy is applied everywhere I looked.
