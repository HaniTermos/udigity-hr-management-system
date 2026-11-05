# Figma Light tokens vs code (FIG-1)

Date 2026-10-23. Source: `get_variable_defs` on two representative frames, SCR-SHR-001 My Day D-L `303:10513` and SCR-OWN-001 Owner dashboard D-L `200:22902`. Compared with `docs/implementation/design-system-code.md` §4 and `frontend/src/app/globals.css` (`:root`, `.ds-*`, radii, elevation). Dark is out of scope: code dark is NAVY by user directive.

## Result

**No colour token differs.** All 52 Light colour variables returned by Figma match the code hex values exactly.

| Group | Figma variables checked | Differences |
|---|---|---|
| Surface (page, default, subtle, sunken, brand, brand-active) | 6 | 0 |
| Border (default, subtle, strong, input, brand) | 5 | 0 |
| Text (primary, secondary, muted, placeholder, link, on-brand, on-brand-muted) | 7 | 0 |
| Icon (default, muted, accent, on-brand, on-brand-active, on-primary) | 6 | 0 |
| Brand (primary, accent, accent-subtle) | 3 | 0 |
| Status success / warning / danger / info / neutral / brand / policy | 21 | 0 (policy/border = #A994E3 in both; the earlier drift is fixed) |
| Chart (series-1..3, grid) | 4 | 0 |
| Radius xs/sm/md/lg/xl | 5 | 0 |
| Elevation/1 | 1 | 0 (#0B1A350F = 0.06, #0B1A3514 = 0.08) |
| Type styles (Overline, Label, Label Small, Body, Body Small, Body Strong, Caption, H1, H2, H3, Number Large, Number XL) | 12 | 0 (Figma letter-spacing is in %, so -0.5 = -0.005em, -1 = -0.01em, 6 = 0.06em) |

## Minor, non-visual notes

| Token | Figma | Code | Impact |
|---|---|---|---|
| `radius/full` | 999 | `--radius-full: 9999px` | None (both fully round). No change needed. |
| `space/*` (0, 2, 4, 6, 8, 10, 12, 16, 20, 24) | Figma variables | No `--space-*` vars; Tailwind 4 px scale (`0.5`=2, `1.5`=6, `2.5`=10, `3`=12, `4`=16, `5`=20, `6`=24) | None, values align. Use the Tailwind steps. |
| `ds/Overline` | 11/16 SemiBold, +6 % | `.ds-overline` 11/16 600, 0.06em, uppercase | Match. Figma text content is already uppercase. |

Tokens not surfaced on these two frames (surface/hover, pressed, selected, disabled, inverse, skeleton, border/selected, text/disabled, focus-ring, overlay, chart 4–6/axis/target, Elevation 2/3, Display, H4, Number) were not re-verified here; `design-system-code.md` states they come from the same approved Semantic collection.
