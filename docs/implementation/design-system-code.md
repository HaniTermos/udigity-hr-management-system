# Design system — code implementation (frontend)

Owner: Design-System Lead (DS-1). Updated 2026-10-23.
Sources of truth: `docs/phase5/design-system.md` (§2 tokens, §6 components), `docs/phase5/ds-ids/index.md`, Phase 5/6 previews.
Figma file `GNrhb3DWa6mIhEX6F4Nmvw`, Semantic collection (Light `40:1`, Dark `40:2`).

**User directive (2026-10-23): dark mode is NAVY, not black.** The light theme is the approved Figma Light mode, unchanged. The dark theme keeps the approved Dark *rules* (teal primary on dark, white text on the navy sidebar, status hues) but every grey surface is replaced by a navy step derived from the logo navy `#122953`. The logo orange `#FD6F03` is kept as a brand reference variable (`--logo-orange`) only. It is not a UI token, because the approved design uses teal as its accent.

## 1. Files

| File | Purpose |
|---|---|
| `frontend/src/app/globals.css` | Primitives, semantic tokens (`:root` = Light, `.dark` = Navy dark), the Tailwind `@theme inline` mapping, `ds-*` type classes, focus helpers |
| `frontend/src/lib/theme.tsx` | `ThemeProvider`, `useTheme()`, `ThemeScript` (no-flash), preference `light` / `dark` / `system` |
| `frontend/src/components/ui/ThemeToggle.tsx` | `ThemeToggle` (icon button, 44 px) and `ThemeSwitcher` (Light / Dark / System segmented) |
| `frontend/src/components/ui/*` | DS components (map in §5) |

## 2. How to use tokens (contract for FE1–FE5)

- Use the **Tailwind semantic utilities**. Every token is a colour key:
  - `bg-surface-default`, `bg-surface-page`, `bg-surface-hover`
  - `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-link`
  - `border-border-default`, `border-border-input`
  - `bg-brand-primary text-text-on-primary`
  - `bg-status-warning-bg text-status-warning-fg border-status-warning-border`
  - `ring-focus-ring`, `bg-overlay-scrim`, `fill-chart-1` … `fill-chart-6`, `stroke-chart-grid`
  - shadows: `shadow-elevation-1|2|3`
- `var(--token)` still works (for example `bg-[var(--surface-default)]`), so existing code keeps working.
- **Do not use raw palette classes** such as `bg-white`, `text-neutral-900`, `bg-black`, `border-neutral-200`, `amber-*` or `red-*`. They do not switch theme and they break navy dark. Every new or changed line must use the semantic utilities.
- `dark:` variants follow the `.dark` class (`@custom-variant dark`). You should rarely need them, because the tokens already switch.
- Type: use the `ds-display`, `ds-h1`…`ds-h4`, `ds-body`, `ds-body-strong`, `ds-body-small`, `ds-label`, `ds-label-small`, `ds-caption`, `ds-overline`, `ds-number`, `ds-number-lg` and `ds-number-xl` classes (DS §3), or the matching Tailwind sizes. Numbers, timers and tables use `tabular-nums`.
- Radius follows the Tailwind defaults, which equal the DS radii: `rounded-xs` 2, `rounded-sm` 4, `rounded-md` 6 (buttons, fields), `rounded-lg` 8, `rounded-xl` 12 (cards), `rounded-2xl` 16.
- Focus:
  - Fields: `focus-ring-inside` (2 px inset).
  - Buttons and links: `focus-visible:ring-2 ring-focus-ring ring-offset-2 ring-offset-surface-default`, or the `.focus-ring-outer` class.
- `status/warning/solid` is for non-text marks only.
- Unresolved policies must use the **policy-pending chip** (§5). Never resolve a policy visually.

## 3. Theme switching

- `ThemeProvider` (already in `app/layout.tsx`) renders `ThemeScript` as the first child of `<body>`. The script runs during HTML parsing, before paint, so there is no light-to-navy flash. This is the pattern from `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`. The script sets `.dark` on `<html>` when the stored preference is `dark`, or when the preference is `system`/unset and the OS prefers dark. It also sets `color-scheme`.
- The preference is stored in `localStorage['udigity-theme']` as `light`, `dark` or `system`. The default is `system`. While on `system`, the theme follows live OS changes.
- API: `const { theme, preference, setTheme, toggleTheme } = useTheme()`.
  - `theme` is the resolved value, `light` or `dark`.
  - `setTheme('light' | 'dark' | 'system')` applies the theme and persists it.
- UI:
  - `ThemeToggle` is placed in the desktop `Header` and the `MobileHeader`.
  - `ThemeSwitcher` is the Light / Dark / System control for Profile → Appearance. See the REQUEST on the coordination board.

## 4. Token map (Figma Semantic → CSS variable → Tailwind key)

The Light values are the approved Figma Light mode. They are unchanged, except for two fixes:
- `status/policy/border` was corrected to the approved `violet/300 #A994E3`. The code had drifted to `#DED5F5`.
- Tokens missing from the code were added: `status/brand/*` (previously undefined, so the brand badge rendered transparent), `icon/on-primary`, `chart/series-4..6`, `chart/axis`, `chart/target` and elevation.

Navy dark values are new, per the directive.

Navy surface ladder:

| Step | Value |
|---|---|
| sidebar (`surface/brand`) | #071226 |
| page | #0B1A36 |
| default (cards) | #122953 (logo navy) |
| raised / subtle | #1A3566 |
| hover | #223F73 |
| pressed / border | #2A4778 |

Primary and accent stay teal in dark, which is the approved Dark rule (navy on navy would fail contrast).

| Figma token | CSS variable | Tailwind key | Light | Navy dark |
|---|---|---|---|---|
| `surface/page` | `--surface-page` | `surface-page` | #F5F7FA | #0B1A36 |
| `surface/default` | `--surface-default` | `surface-default` | #FFFFFF | #122953 |
| `surface/raised` | `--surface-raised` | `surface-raised` | #FFFFFF | #1A3566 |
| `surface/subtle` | `--surface-subtle` | `surface-subtle` | #F5F7FA | #1A3566 |
| `surface/sunken` | `--surface-sunken` | `surface-sunken` | #EDF0F4 | #0B1A36 |
| `surface/hover` | `--surface-hover` | `surface-hover` | #EDF0F4 | #223F73 |
| `surface/pressed` | `--surface-pressed` | `surface-pressed` | #DFE4EA | #2A4778 |
| `surface/selected` | `--surface-selected` | `surface-selected` | #E6F7F7 | #0D3446 |
| `surface/disabled` | `--surface-disabled` | `surface-disabled` | #EDF0F4 | #1A3566 |
| `surface/inverse` | `--surface-inverse` | `surface-inverse` | #0B1A35 | #EDF0F4 |
| `surface/brand` | `--surface-brand` | `surface-brand` | #0B1A35 | #071226 |
| `surface/brand-hover` | `--surface-brand-hover` | `surface-brand-hover` | #112447 | #0F2142 |
| `surface/brand-active` | `--surface-brand-active` | `surface-brand-active` | #17305A | #1A3566 |
| `surface/skeleton` | `--surface-skeleton` | `surface-skeleton` | #DFE4EA | #223F73 |
| `border/default` | `--border-default` | `border-default` | #DFE4EA | #2A4778 |
| `border/subtle` | `--border-subtle` | `border-subtle` | #EDF0F4 | #1F3A69 |
| `border/strong` | `--border-strong` | `border-strong` | #C9D1DA | #3A5A8F |
| `border/input` | `--border-input` | `border-input` | #778395 | #7A90B8 |
| `border/brand` | `--border-brand` | `border-brand` | #17305A | #1A3566 |
| `border/selected` | `--border-selected` | `border-selected` | #0B8084 | #22B3B6 |
| `(code only)` | `--border-on-brand` | `border-on-brand` | rgba(255, 255, 255, 0.10) | rgba(179, 194, 219, 0.14) |
| `text/primary` | `--text-primary` | `text-primary` | #1A2029 | #F5F7FA |
| `text/secondary` | `--text-secondary` | `text-secondary` | #414B5A | #C9D3E3 |
| `text/muted` | `--text-muted` | `text-muted` | #586476 | #9FB0CC |
| `text/placeholder` | `--text-placeholder` | `text-placeholder` | #586476 | #9FB0CC |
| `text/disabled` | `--text-disabled` | `text-disabled` | #A1ACB9 | #5F7397 |
| `text/inverse` | `--text-inverse` | `text-inverse` | #FFFFFF | #0B1A36 |
| `text/on-brand` | `--text-on-brand` | `text-on-brand` | #FFFFFF | #FFFFFF |
| `text/on-brand-muted` | `--text-on-brand-muted` | `text-on-brand-muted` | #B3C2DB | #B3C2DB |
| `text/on-primary` | `--text-on-primary` | `text-on-primary` | #FFFFFF | #0B1A36 |
| `text/on-danger` | `--text-on-danger` | `text-on-danger` | #FFFFFF | #0B1A36 |
| `text/link` | `--text-link` | `text-link` | #0A6669 | #52C9CB |
| `icon/default` | `--icon-default` | `icon-default` | #414B5A | #C9D3E3 |
| `icon/muted` | `--icon-muted` | `icon-muted` | #778395 | #8A9CBC |
| `icon/on-brand` | `--icon-on-brand` | `icon-on-brand` | #B3C2DB | #B3C2DB |
| `icon/on-brand-active` | `--icon-on-brand-active` | `icon-on-brand-active` | #FFFFFF | #FFFFFF |
| `icon/accent` | `--icon-accent` | `icon-accent` | #0B8084 | #22B3B6 |
| `icon/strong` | `--icon-strong` | `icon-strong` | #1A2029 | #F5F7FA |
| `icon/on-primary` | `--icon-on-primary` | `icon-on-primary` | #FFFFFF | #0B1A36 |
| `icon/disabled` | `--icon-disabled` | `icon-disabled` | #A1ACB9 | #5F7397 |
| `brand/primary` | `--brand-primary` | `brand-primary` | #17305A | #22B3B6 |
| `brand/primary-hover` | `--brand-primary-hover` | `brand-primary-hover` | #112447 | #52C9CB |
| `brand/primary-pressed` | `--brand-primary-pressed` | `brand-primary-pressed` | #0B1A35 | #8EDDDE |
| `brand/accent` | `--brand-accent` | `brand-accent` | #0B8084 | #22B3B6 |
| `brand/accent-strong` | `--brand-accent-strong` | `brand-accent-strong` | #0A6669 | #52C9CB |
| `brand/accent-subtle` | `--brand-accent-subtle` | `brand-accent-subtle` | #E6F7F7 | #0D3446 |
| `focus-ring` | `--focus-ring` | `focus-ring` | #0E9CA0 | #52C9CB |
| `overlay/scrim` | `--overlay-scrim` | `overlay-scrim` | rgba(7, 18, 38, 0.56) | rgba(4, 10, 24, 0.72) |
| `status/success/fg` | `--status-success-fg` | `status-success-fg` | #116338 | #69C493 |
| `status/success/bg` | `--status-success-bg` | `status-success-bg` | #E7F6ED | #0A3A21 |
| `status/success/border` | `--status-success-border` | `status-success-border` | #69C493 | #116338 |
| `status/success/solid` | `--status-success-solid` | `status-success-solid` | #167E47 | #3DAF73 |
| `status/warning/fg` | `--status-warning-fg` | `status-warning-fg` | #855500 | #F5BF55 |
| `status/warning/bg` | `--status-warning-bg` | `status-warning-bg` | #FFF5E1 | #4A2F00 |
| `status/warning/border` | `--status-warning-border` | `status-warning-border` | #F5BF55 | #855500 |
| `status/warning/solid` | `--status-warning-solid` | `status-warning-solid` | #AD6F00 | #EBA82B |
| `status/danger/fg` | `--status-danger-fg` | `status-danger-fg` | #8F2020 | #EC8888 |
| `status/danger/bg` | `--status-danger-bg` | `status-danger-bg` | #FDECEC | #4F1212 |
| `status/danger/border` | `--status-danger-border` | `status-danger-border` | #EC8888 | #8F2020 |
| `status/danger/solid` | `--status-danger-solid` | `status-danger-solid` | #B52A2A | #E36060 |
| `status/info/fg` | `--status-info-fg` | `status-info-fg` | #1C4A8B | #8DB8F0 |
| `status/info/bg` | `--status-info-bg` | `status-info-bg` | #E8F1FC | #173C70 |
| `status/info/border` | `--status-info-border` | `status-info-border` | #79A9EC | #2F5FA0 |
| `status/info/solid` | `--status-info-solid` | `status-info-solid` | #245EAF | #5390E0 |
| `status/neutral/fg` | `--status-neutral-fg` | `status-neutral-fg` | #414B5A | #C9D3E3 |
| `status/neutral/bg` | `--status-neutral-bg` | `status-neutral-bg` | #EDF0F4 | #223F73 |
| `status/neutral/border` | `--status-neutral-border` | `status-neutral-border` | #C9D1DA | #3A5A8F |
| `status/neutral/solid` | `--status-neutral-solid` | `status-neutral-solid` | #586476 | #9FB0CC |
| `status/brand/fg` | `--status-brand-fg` | `status-brand-fg` | #0A6669 | #52C9CB |
| `status/brand/bg` | `--status-brand-bg` | `status-brand-bg` | #E6F7F7 | #0D3446 |
| `status/brand/border` | `--status-brand-border` | `status-brand-border` | #52C9CB | #0A6669 |
| `status/brand/solid` | `--status-brand-solid` | `status-brand-solid` | #0B8084 | #22B3B6 |
| `status/policy/fg` | `--status-policy-fg` | `status-policy-fg` | #523C93 | #A994E3 |
| `status/policy/bg` | `--status-policy-bg` | `status-policy-bg` | #F1EDFB | #2C2052 |
| `status/policy/border` | `--status-policy-border` | `status-policy-border` | #A994E3 | #523C93 |
| `status/policy/solid` | `--status-policy-solid` | `status-policy-solid` | #7357C2 | #A994E3 |
| `status/decision/fg` | `--status-decision-fg` | `status-decision-fg` | #1F3D6E | #B3C2DB |
| `status/decision/bg` | `--status-decision-bg` | `status-decision-bg` | #EEF2F8 | #0B1A36 |
| `status/decision/border` | `--status-decision-border` | `status-decision-border` | #8399BF | #2F4F82 |
| `status/decision/solid` | `--status-decision-solid` | `status-decision-solid` | #2F4F82 | #9FB4DA |
| `chart/series-1` | `--chart-series-1` | `chart-1` | #0E9CA0 | #52C9CB |
| `chart/series-2` | `--chart-series-2` | `chart-2` | #2F4F82 | #9FB4DA |
| `chart/series-3` | `--chart-series-3` | `chart-3` | #7357C2 | #A994E3 |
| `chart/series-4` | `--chart-series-4` | `chart-4` | #DB6E2C | #F2AE7E |
| `chart/series-5` | `--chart-series-5` | `chart-5` | #C23F7E | #E58DB8 |
| `chart/series-6` | `--chart-series-6` | `chart-6` | #778395 | #A1ACB9 |
| `chart/grid` | `--chart-grid` | `chart-grid` | #DFE4EA | #2A4778 |
| `chart/axis` | `--chart-axis` | `chart-axis` | #586476 | #9FB0CC |
| `chart/target` | `--chart-target` | `chart-target` | #AD6F00 | #F5BF55 |

Elevation tokens:
- `--elevation-1..3` (Tailwind `shadow-elevation-1..3`) are navy-tinted `#0B1A35` in Light, following `ds/Elevation/1–3`.
- In navy dark they are deep-navy shadows. In dark mode, elevation comes mainly from the lighter surface step.

## 5. Component map (Figma → code)

All components live in `frontend/src/components/ui/`. Status key:
- ✅ = matches the DS.
- ➕ = added in this pass.
- 🔧 = fixed in this pass.

| Figma component (ID) | Code | Status / notes |
|---|---|---|
| Button `45:305` (Primary, Secondary, Ghost, Destructive × S32/M40/L48 × states) | `Button` (`variant`, `size` `sm`/`md`/`lg`/`touch`, `isLoading`, `leadingIcon`, `trailingIcon`, `fullWidth`) | 🔧 Changes: radius md (6); hover uses `brand/primary-hover` and `danger/fg` instead of opacity; Secondary border `border/strong`; Disabled = `surface/disabled` + `text/disabled` (was 50 % opacity); Focus ring = 2 px gap + 2 px teal; `aria-busy` while loading. `touch` is 44 px (CR-DE-1); use Large or `touch` for mobile full-width actions |
| Link `45:441` | `Button variant="link"` | ✅ |
| IconButton `45:405` (Ghost, Secondary, Primary × Small, Medium, **Touch 44**) | `IconButton` (`size` `sm`/`md`/`touch`, `showDot`, required `label`) | 🔧 Changes: radius md; tokenised hover and disabled; the unread dot is `status/danger/solid` with a `surface/default` ring, as in Figma |
| Input `45:796` (Text, Phone, URL, Number, Password × Default, Filled, Focus, Error, Disabled) | `Input` (`label`, `required`, `helperText`, `error`, `leadingIcon`, `trailingElement`, `labelAside`) | 🔧 The error row is always shown in Error state (danger border + alert icon + message, `aria-invalid`, `aria-describedby`, `aria-required`). Focus = 2 px inset ring. Helper/error text is 13/18 |
| Textarea `45:847` | `Textarea` (`counter`) | ➕ 96 px min height, error row, counter |
| Select `46:434` | `Select` (native, `options` or children, `placeholder`) | ➕ Gap: Type=Person (avatar option) and Combobox are not built; use `Select` plus `Avatar` in a custom menu if a screen needs them |
| Input/Date `46:594` (Date, Time, Date and time) | `DateInput kind="date" \| "time" \| "datetime"` | ➕ Native pickers, 24 h. Gap: the `DatePicker` popover is not built (the native picker is used) |
| Input/Search `46:748` (Small 32, Medium 40) | `SearchInput size="sm" \| "md"` (required `label`) | ➕ |
| Checkbox `45:497` | `Checkbox` | ➕ Native, with the accent colour. Gap: no Indeterminate visual. Radio and RadioCard are not built |
| Field shell (label row, helper/error row) | `FieldShell` | ➕ Wrap custom controls with it so they match the DS |
| Field/Metric `45:891` (with Unknown) | — | Gap: compose `Input` + `Checkbox` ("Unknown"). Whether Unknown is allowed is pending DEC-014/023 |
| Table/HeaderCell, Cell, HeaderRow, Row | `TableContainer`, `Table`, `THead`, `TBody`, `TH` (`align`, `sort`, `onSort`), `TR` (`selected`), `TD` (`numeric`, `meta`) | ➕ Header: `surface/sunken`, Overline. Rows are 56 px with a hover/selected state. `aria-sort` is set |
| Table/Pagination | `Pagination` (`page`, `pageCount`, `onPageChange`, `rangeLabel`, `perPage`) | ➕ |
| Drawer `53:1846` (480, content + footer slots) | `Drawer` (`title`, `subtitle`, `footer`, `width`) | 🔧 Changes: Elevation/3; H2 20/28 semibold; unique ids via `useId`; `aria-describedby`; Close uses IconButton Touch 44. Gap: no focus trap or return-focus yet |
| Dialog `53:1818` (400/520/720) | `Dialog` (`maxWidth` `sm` 400 / `md` 520 / `lg` 720) | 🔧 Same changes as Drawer. Same focus-trap gap |
| Overlay/Scrim | `bg-overlay-scrim` (inside Dialog and Drawer) | ✅ Navy dark scrim is `rgba(4,10,24,.72)` |
| Toast `53:2032` (Info, Success, Warning, Error) | `Toast`, `ToastProvider`, `useToast().show({tone,title,body})` | ➕ Position: bottom-right on desktop, above the tab bar on mobile. Auto-dismiss after 5 s, except Error. Up to 3 stacked. **The Tech Lead must mount `ToastProvider`** (see the REQUEST) |
| Banner / Alert-Inline (Info, Success, Warning, Error) | `Alert` (`tone`, `title`, `body`); legacy `FigmaBanner` | 🔧 `FigmaBanner` now uses DS tones. It was hard-coded black and white, which broke dark mode. Gap: `Banner/ErrorSummary`. Compose it from `Alert tone="danger"` plus a list of links |
| Notice/Policy pending `44:549` (Block, Inline, Chip × Policy pending, Implementation decision) | `NoticePolicy` (`size`, `tone`, `dec`, `body`, **`demo`**); **`PolicyPendingChip`** (`dec`, `label`, **`demo`**, `tone`) | 🔧➕ The chip defaults to "`DEC-xxx` Policy pending". `demo` shows **"Demonstration alternative — not approved"** (constant `DEMO_ALTERNATIVE_LABEL`). The legacy `FigmaPolicyBadge` and `PolicyTag` now use the violet policy tone |
| Notice/Access (Permission denied, Hidden by policy, Context-limited × Page, Inline) | `NoticeAccess type=… size=…` | ➕ Uses the standard Figma copy. Context-limited carries the DEC-005 chip. It never reveals hidden data |
| Badge/Status `44:435` (6 tones × Small, Large) | `Badge` (`tone` incl. `brand`, `policy`, `decision`; `hasDot`; `icon`; `size` `sm`/`md`; `derived`) | 🔧 Brand tone fixed (the tokens were missing). Label is Small 12/16. The dot uses the `solid` token |
| Badge/Outcome `44:459` | `OutcomeBadge` | ✅ Icon + label |
| Badge/Count `44:471` | `CountBadge` (`neutral`, `brand`, `danger`, `on-brand`) | ➕ |
| Tag `44:501` | `Tag` (`neutral`, `brand`, `outline`) | ➕ |
| Chip/Derived `44:509` | `DerivedChip` (`neutral`, `amber`), or `Badge derived` | ➕ Dashed border |
| Badge/Flag `44:491` | `Badge tone="warning" icon="flag"` (or danger, info, neutral) | ✅ Composed |
| Progress/Bar `51:1916` (Brand, Success, Warning, Danger × Percent) | `ProgressBar` (`percent`, `tone`, `label`, `value`) | ➕ 8 px track on `surface/sunken`. `role=progressbar`. Width-agnostic |
| Tabs/Item and Tabs (Underline, Segmented) | `Tabs` (`style`, `items[{id,label,count,disabled}]`) | 🔧 Changes: 40 px underline tabs and 32 px segmented tabs; the count uses Badge/Count (Brand when active); `role=tablist` / `tab` and `aria-selected`; Disabled uses `text/disabled` instead of opacity |
| Card/Surface | `Card` | 🔧 Uses the 1 px border with no shadow at rest (DS §4 prefers the border) |
| Card/Section | `CardSection` (`title`, `subtitle`, `action`) | ➕ Padding 20 |
| Card/Inset | `CardInset` | ➕ |
| Card/Metric (Up, Down, Flat, Pending, Loading) | `CardMetric` | 🔧 Value uses `ds-number-lg`. Added a Loading skeleton. Pending shows "—" plus the DEC-020 chip |
| State (Empty, No results, Loading, Error, Session expired, Save conflict × Page, Inline) | `StateView type=… size=…` | ➕ Loading uses skeleton bars |
| Skeleton (Text line, Avatar, Table row, Card) | `Skeleton`, `SkeletonTableRow`, `SkeletonCard` | ➕ |
| Avatar `44:358` (Brand, Neutral) | `Avatar` | 🔧 Brand is now `status/brand/bg` + `fg`, as in Figma. It was white on `brand/primary`, which fails in dark (white on teal is 2.6:1) |
| Brand/Logo `44:342` | `BrandLogo` (`surface` `default`/`on-brand`) | ✅ Uses the real lockup. The sidebar always uses the reversed lockup (the sidebar is navy in both modes) |
| Icon/* (63) | `Icon name=…` | ✅ |
| Nav/Sidebar, Nav/Item, Nav/SectionLabel | `layout/Sidebar` | 🔧 The divider uses the `border-on-brand` token. Gap (Tech Lead): nav items use square placeholders instead of `Icon`, and the Owner/Data Entry/Developer item sets are incomplete |
| Nav/TopBar | `layout/Header` | 🔧 Hard-coded white/neutral/black colours replaced with tokens; menu shadow is Elevation/2; `ThemeToggle` added. Gap: the search is a raw input (use `SearchInput`); the notifications control should be an `IconButton icon="bell" showDot` |
| Shell/Mobile/Header (Back, Title, Subtitle) | `layout/MobileNav` → `MobileHeader` | 🔧 Back is now a 44 px `chevron-left` touch target (it was a "‹" glyph); title is H3; tokenised; `ThemeToggle` added. Gap: no subtitle |
| Shell/Mobile/TabBar, Shell/Mobile/Tab | `layout/MobileNav` → `MobileTabBar` | 🔧 Active tab is teal (`brand/accent-strong`), as in Figma. Gap: square placeholders instead of icons; no top indicator |
| Shell/Desktop / AppShell | `layout/AppShell` | 🔧 Page background is `surface/page` (it was `#fafafa`). The R-11 banner uses warning tokens |
| Menu, Menu/Item | — | Gap: use Radix `@radix-ui/react-dropdown-menu` with `bg-surface-raised border-border-default shadow-elevation-2` |
| DatePicker, Chip/Filter, FilterBar, RadioCard, Radio, Breadcrumb, Divider, List/Item, List/KeyValue, Timeline/*, Calendar/*, Kanban/Column, Card/Task, Attendance/*, Banner/Reservation, Queue/*, Row/Phone, Row/Social, Chart/* | — | Gaps: domain components that screen agents compose from the primitives above and the tokens. Charts use `fill-chart-1..6`, `stroke-chart-grid` and `text-chart-axis`; the target line uses `stroke-chart-target` (dashed) |

**Legacy pages.** Many page-level classes in `src/app/**` still hard-code `neutral-*`, `white` and `black`. Examples: `text-neutral-900` ×91, `border-neutral-200` ×55, `bg-white` ×43. These do not switch to navy dark. The page owners must migrate them to semantic utilities; see the REQUEST on the coordination board. Quick mapping:

| Raw class | Semantic class |
|---|---|
| `bg-white` | `bg-surface-default` |
| `bg-neutral-50` / `bg-[#fafafa]` | `bg-surface-subtle` / `bg-surface-page` |
| `text-neutral-900` / `800` | `text-text-primary` |
| `text-neutral-700` / `600` | `text-text-secondary` |
| `text-neutral-500` / `400` | `text-text-muted` |
| `border-neutral-200` | `border-border-default` |
| `border-neutral-100` | `border-border-subtle` |
| `border-neutral-300` / `400` | `border-border-strong`; `border-border-input` for fields |
| `bg-neutral-900 text-white` (primary) | `<Button>` or `bg-brand-primary text-text-on-primary` |
| `hover:bg-neutral-100` | `hover:bg-surface-hover` |

## 6. Contrast — navy dark palette (WCAG 2.x)

Each ratio uses the WCAG relative-luminance formula on the hex value of each foreground/background pair in `.dark`. The table was generated from `globals.css`.

Thresholds:
- Text: 4.5:1.
- UI and graphics (input borders, focus ring, icons, solid marks, chart marks): 3:1.
- Disabled text, and the border and surface steps: exempt or decorative. A field is never bounded by `border/default` alone; fields use `border/input`.

**Result: 104 of 104 threshold pairs PASS, 0 FAIL (4 more decorative/exempt pairs listed for reference).** The tightest pairs:

| Pair | Threshold | Ratio |
|---|---|---|
| `border/input` on `surface/hover` | UI 3:1 | 3.21 |
| `status/danger/solid` on `surface/raised` | UI 3:1 | 3.50 |
| `icon/muted` on `surface/hover` | UI 3:1 | 3.73 |

The Light mode ratios are unchanged from `design-system.md` §10, which has no failures.

| Foreground | Background | Use | Need | Dark hex (fg / bg) | Ratio | Result |
|---|---|---|---|---|---|---|
| `text-primary` | `surface-page` | text | 4.5:1 | #F5F7FA / #0B1A36 | 16.10 | PASS |
| `text-primary` | `surface-default` | text | 4.5:1 | #F5F7FA / #122953 | 13.33 | PASS |
| `text-primary` | `surface-raised` | text | 4.5:1 | #F5F7FA / #1A3566 | 11.21 | PASS |
| `text-primary` | `surface-hover` | text | 4.5:1 | #F5F7FA / #223F73 | 9.66 | PASS |
| `text-primary` | `surface-selected` | text | 4.5:1 | #F5F7FA / #0D3446 | 12.25 | PASS |
| `text-secondary` | `surface-page` | text | 4.5:1 | #C9D3E3 / #0B1A36 | 11.45 | PASS |
| `text-secondary` | `surface-default` | text | 4.5:1 | #C9D3E3 / #122953 | 9.48 | PASS |
| `text-secondary` | `surface-raised` | text | 4.5:1 | #C9D3E3 / #1A3566 | 7.97 | PASS |
| `text-secondary` | `surface-hover` | text | 4.5:1 | #C9D3E3 / #223F73 | 6.86 | PASS |
| `text-muted` | `surface-page` | text | 4.5:1 | #9FB0CC / #0B1A36 | 7.86 | PASS |
| `text-muted` | `surface-default` | text | 4.5:1 | #9FB0CC / #122953 | 6.51 | PASS |
| `text-muted` | `surface-raised` | text | 4.5:1 | #9FB0CC / #1A3566 | 5.48 | PASS |
| `text-muted` | `surface-hover` | text | 4.5:1 | #9FB0CC / #223F73 | 4.72 | PASS |
| `text-muted` | `surface-selected` | text | 4.5:1 | #9FB0CC / #0D3446 | 5.98 | PASS |
| `text-placeholder` | `surface-default` | text | 4.5:1 | #9FB0CC / #122953 | 6.51 | PASS |
| `text-link` | `surface-page` | text | 4.5:1 | #52C9CB / #0B1A36 | 8.70 | PASS |
| `text-link` | `surface-default` | text | 4.5:1 | #52C9CB / #122953 | 7.21 | PASS |
| `text-link` | `surface-raised` | text | 4.5:1 | #52C9CB / #1A3566 | 6.06 | PASS |
| `text-on-brand` | `surface-brand` | text | 4.5:1 | #FFFFFF / #071226 | 18.69 | PASS |
| `text-on-brand` | `surface-brand-active` | text | 4.5:1 | #FFFFFF / #1A3566 | 12.03 | PASS |
| `text-on-brand-muted` | `surface-brand` | text | 4.5:1 | #B3C2DB / #071226 | 10.37 | PASS |
| `text-on-brand-muted` | `surface-brand-hover` | text | 4.5:1 | #B3C2DB / #0F2142 | 8.85 | PASS |
| `text-on-primary` | `brand-primary` | text | 4.5:1 | #0B1A36 / #22B3B6 | 6.74 | PASS |
| `text-on-primary` | `brand-primary-hover` | text | 4.5:1 | #0B1A36 / #52C9CB | 8.70 | PASS |
| `text-on-primary` | `status-brand-solid` | text | 4.5:1 | #0B1A36 / #22B3B6 | 6.74 | PASS |
| `text-on-danger` | `status-danger-solid` | text | 4.5:1 | #0B1A36 / #E36060 | 5.03 | PASS |
| `text-inverse` | `surface-inverse` | text | 4.5:1 | #0B1A36 / #EDF0F4 | 15.12 | PASS |
| `status-success-fg` | `status-success-bg` | text | 4.5:1 | #69C493 / #0A3A21 | 6.05 | PASS |
| `status-success-fg` | `surface-default` | text | 4.5:1 | #69C493 / #122953 | 6.76 | PASS |
| `status-success-fg` | `surface-raised` | text | 4.5:1 | #69C493 / #1A3566 | 5.68 | PASS |
| `text-primary` | `status-success-bg` | text | 4.5:1 | #F5F7FA / #0A3A21 | 11.93 | PASS |
| `status-warning-fg` | `status-warning-bg` | text | 4.5:1 | #F5BF55 / #4A2F00 | 7.34 | PASS |
| `status-warning-fg` | `surface-default` | text | 4.5:1 | #F5BF55 / #122953 | 8.49 | PASS |
| `status-warning-fg` | `surface-raised` | text | 4.5:1 | #F5BF55 / #1A3566 | 7.14 | PASS |
| `text-primary` | `status-warning-bg` | text | 4.5:1 | #F5F7FA / #4A2F00 | 11.53 | PASS |
| `status-danger-fg` | `status-danger-bg` | text | 4.5:1 | #EC8888 / #4F1212 | 5.91 | PASS |
| `status-danger-fg` | `surface-default` | text | 4.5:1 | #EC8888 / #122953 | 5.75 | PASS |
| `status-danger-fg` | `surface-raised` | text | 4.5:1 | #EC8888 / #1A3566 | 4.84 | PASS |
| `text-primary` | `status-danger-bg` | text | 4.5:1 | #F5F7FA / #4F1212 | 13.71 | PASS |
| `status-info-fg` | `status-info-bg` | text | 4.5:1 | #8DB8F0 / #173C70 | 5.35 | PASS |
| `status-info-fg` | `surface-default` | text | 4.5:1 | #8DB8F0 / #122953 | 6.98 | PASS |
| `status-info-fg` | `surface-raised` | text | 4.5:1 | #8DB8F0 / #1A3566 | 5.87 | PASS |
| `text-primary` | `status-info-bg` | text | 4.5:1 | #F5F7FA / #173C70 | 10.21 | PASS |
| `status-neutral-fg` | `status-neutral-bg` | text | 4.5:1 | #C9D3E3 / #223F73 | 6.86 | PASS |
| `status-neutral-fg` | `surface-default` | text | 4.5:1 | #C9D3E3 / #122953 | 9.48 | PASS |
| `status-neutral-fg` | `surface-raised` | text | 4.5:1 | #C9D3E3 / #1A3566 | 7.97 | PASS |
| `text-primary` | `status-neutral-bg` | text | 4.5:1 | #F5F7FA / #223F73 | 9.66 | PASS |
| `status-brand-fg` | `status-brand-bg` | text | 4.5:1 | #52C9CB / #0D3446 | 6.62 | PASS |
| `status-brand-fg` | `surface-default` | text | 4.5:1 | #52C9CB / #122953 | 7.21 | PASS |
| `status-brand-fg` | `surface-raised` | text | 4.5:1 | #52C9CB / #1A3566 | 6.06 | PASS |
| `text-primary` | `status-brand-bg` | text | 4.5:1 | #F5F7FA / #0D3446 | 12.25 | PASS |
| `status-policy-fg` | `status-policy-bg` | text | 4.5:1 | #A994E3 / #2C2052 | 5.60 | PASS |
| `status-policy-fg` | `surface-default` | text | 4.5:1 | #A994E3 / #122953 | 5.47 | PASS |
| `status-policy-fg` | `surface-raised` | text | 4.5:1 | #A994E3 / #1A3566 | 4.60 | PASS |
| `text-primary` | `status-policy-bg` | text | 4.5:1 | #F5F7FA / #2C2052 | 13.63 | PASS |
| `status-decision-fg` | `status-decision-bg` | text | 4.5:1 | #B3C2DB / #0B1A36 | 9.59 | PASS |
| `status-decision-fg` | `surface-default` | text | 4.5:1 | #B3C2DB / #122953 | 7.94 | PASS |
| `status-decision-fg` | `surface-raised` | text | 4.5:1 | #B3C2DB / #1A3566 | 6.68 | PASS |
| `text-primary` | `status-decision-bg` | text | 4.5:1 | #F5F7FA / #0B1A36 | 16.10 | PASS |
| `border-input` | `surface-default` | ui | 3:1 | #7A90B8 / #122953 | 4.43 | PASS |
| `border-input` | `surface-raised` | ui | 3:1 | #7A90B8 / #1A3566 | 3.73 | PASS |
| `border-input` | `surface-hover` | ui | 3:1 | #7A90B8 / #223F73 | 3.21 | PASS |
| `focus-ring` | `surface-page` | ui | 3:1 | #52C9CB / #0B1A36 | 8.70 | PASS |
| `focus-ring` | `surface-default` | ui | 3:1 | #52C9CB / #122953 | 7.21 | PASS |
| `focus-ring` | `surface-raised` | ui | 3:1 | #52C9CB / #1A3566 | 6.06 | PASS |
| `focus-ring` | `surface-brand` | ui | 3:1 | #52C9CB / #071226 | 9.41 | PASS |
| `brand-accent` | `surface-default` | ui | 3:1 | #22B3B6 / #122953 | 5.58 | PASS |
| `brand-accent` | `surface-raised` | ui | 3:1 | #22B3B6 / #1A3566 | 4.69 | PASS |
| `brand-accent` | `surface-brand` | ui | 3:1 | #22B3B6 / #071226 | 7.29 | PASS |
| `border-selected` | `surface-default` | ui | 3:1 | #22B3B6 / #122953 | 5.58 | PASS |
| `icon-default` | `surface-default` | ui | 3:1 | #C9D3E3 / #122953 | 9.48 | PASS |
| `icon-default` | `surface-raised` | ui | 3:1 | #C9D3E3 / #1A3566 | 7.97 | PASS |
| `icon-muted` | `surface-default` | ui | 3:1 | #8A9CBC / #122953 | 5.15 | PASS |
| `icon-muted` | `surface-raised` | ui | 3:1 | #8A9CBC / #1A3566 | 4.33 | PASS |
| `icon-muted` | `surface-hover` | ui | 3:1 | #8A9CBC / #223F73 | 3.73 | PASS |
| `icon-on-brand` | `surface-brand` | ui | 3:1 | #B3C2DB / #071226 | 10.37 | PASS |
| `icon-accent` | `surface-default` | ui | 3:1 | #22B3B6 / #122953 | 5.58 | PASS |
| `icon-on-primary` | `brand-primary` | ui | 3:1 | #0B1A36 / #22B3B6 | 6.74 | PASS |
| `brand-primary` | `surface-default` | ui | 3:1 | #22B3B6 / #122953 | 5.58 | PASS |
| `brand-primary` | `surface-raised` | ui | 3:1 | #22B3B6 / #1A3566 | 4.69 | PASS |
| `status-success-solid` | `surface-default` | ui | 3:1 | #3DAF73 / #122953 | 5.16 | PASS |
| `status-success-solid` | `surface-raised` | ui | 3:1 | #3DAF73 / #1A3566 | 4.34 | PASS |
| `status-warning-solid` | `surface-default` | ui | 3:1 | #EBA82B / #122953 | 6.93 | PASS |
| `status-warning-solid` | `surface-raised` | ui | 3:1 | #EBA82B / #1A3566 | 5.83 | PASS |
| `status-danger-solid` | `surface-default` | ui | 3:1 | #E36060 / #122953 | 4.16 | PASS |
| `status-danger-solid` | `surface-raised` | ui | 3:1 | #E36060 / #1A3566 | 3.50 | PASS |
| `status-info-solid` | `surface-default` | ui | 3:1 | #5390E0 / #122953 | 4.38 | PASS |
| `status-info-solid` | `surface-raised` | ui | 3:1 | #5390E0 / #1A3566 | 3.69 | PASS |
| `status-neutral-solid` | `surface-default` | ui | 3:1 | #9FB0CC / #122953 | 6.51 | PASS |
| `status-neutral-solid` | `surface-raised` | ui | 3:1 | #9FB0CC / #1A3566 | 5.48 | PASS |
| `status-brand-solid` | `surface-default` | ui | 3:1 | #22B3B6 / #122953 | 5.58 | PASS |
| `status-brand-solid` | `surface-raised` | ui | 3:1 | #22B3B6 / #1A3566 | 4.69 | PASS |
| `status-policy-solid` | `surface-default` | ui | 3:1 | #A994E3 / #122953 | 5.47 | PASS |
| `status-policy-solid` | `surface-raised` | ui | 3:1 | #A994E3 / #1A3566 | 4.60 | PASS |
| `status-decision-solid` | `surface-default` | ui | 3:1 | #9FB4DA / #122953 | 6.82 | PASS |
| `status-decision-solid` | `surface-raised` | ui | 3:1 | #9FB4DA / #1A3566 | 5.74 | PASS |
| `chart-series-1` | `surface-default` | ui | 3:1 | #52C9CB / #122953 | 7.21 | PASS |
| `chart-series-2` | `surface-default` | ui | 3:1 | #9FB4DA / #122953 | 6.82 | PASS |
| `chart-series-3` | `surface-default` | ui | 3:1 | #A994E3 / #122953 | 5.47 | PASS |
| `chart-series-4` | `surface-default` | ui | 3:1 | #F2AE7E / #122953 | 7.58 | PASS |
| `chart-series-5` | `surface-default` | ui | 3:1 | #E58DB8 / #122953 | 6.02 | PASS |
| `chart-series-6` | `surface-default` | ui | 3:1 | #A1ACB9 / #122953 | 6.21 | PASS |
| `chart-axis` | `surface-default` | text | 4.5:1 | #9FB0CC / #122953 | 6.51 | PASS |
| `chart-target` | `surface-default` | ui | 3:1 | #F5BF55 / #122953 | 8.49 | PASS |
| `surface-default` | `surface-page` | step | — | #122953 / #0B1A36 | 1.21 | decorative/exempt |
| `surface-raised` | `surface-default` | step | — | #1A3566 / #122953 | 1.19 | decorative/exempt |
| `border-default` | `surface-default` | decor | — | #2A4778 / #122953 | 1.55 | decorative/exempt |
| `text-disabled` | `surface-disabled` | exempt | — | #5F7397 / #1A3566 | 2.51 | decorative/exempt |

## 7. Verification (2026-10-23, in `frontend/`)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no output |
| `npm run lint` | exit 0: **0 errors, 12 warnings**. All warnings are in page files owned by the Tech Lead (unused imports/vars, `no-page-custom-font` in `layout.tsx`). None are in `components/ui`, `components/layout`, `lib/theme.tsx` or `globals.css` |
| `npm run build` | exit 0. "Compiled successfully in 2.3min", TypeScript finished in 45s, and 25/25 routes generated |

**CSP note (for SEC-4).** `ThemeScript` is an inline script. When a CSP is added, give it a nonce (or a hash), or the no-flash theme init is blocked. If it is blocked, the theme still applies after hydration, with a flash.
