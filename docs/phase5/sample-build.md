# Phase 5 visual sample: build status (final pass)

File `GNrhb3DWa6mIhEX6F4Nmvw`, page **30 HiFi — Visual Sample** (`36:4`). Run history with verbatim warnings: `run-log.md` (final pass rows 30–36). Final previews and index: `previews/final/index.md`. Returned IDs: `screen-ids/`, `ds-ids/12d-logo-focus.json`.

| Section | Section ID · position | Last run | Warnings (verbatim) |
|---|---|---|---|
| S1 Login | `66:3359` · 0,0 · 2720×1278 | row 31 | `[]` |
| S2 Owner Dashboard | `67:3543` · 3120,0 · 3120×1300 | row 34 | `["Card Calling: body overflows by 9px","Card Exceptions: body overflows by 14px","Card Pipeline: body overflows by 1px", ×2 (L+D)]` |
| S3 Call Center Workspace | `64:2641` · 0,1700 · 2770×2476 | row 37 | `[]` |
| S4 Business Form | `63:1444` · 3170,1700 · 4720×2224 | row 26 (not re-run) | `[]` |
| S5 Developer Board | `61:538` · 0,4576 · 3160×1500 | row 39 (after DS 12e, row 38) | `["rail: first activity item still past the rail bottom"]` |
| S6 My Day Mobile | `60:2` · 3560,4576 · 1960×1252 | row 32 | `[]` |

**Canvas:** the orchestrator re-flowed the sections and none overlap now. The S5 script still hard-sets 0,4800, so re-running it would move S5 again.

## Frames
- **S1:** Login [81:4767](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=81-4767) · Invalid credentials [81:4848](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=81-4848) · Session expired [81:4902](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=81-4902) · Owner 2FA [81:4962](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=81-4962) · Annotations [81:5052](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=81-5052)
- **S2:** Light [84:4769](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=84-4769) · Dark [84:5624](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=84-5624) · Annotations [84:6433](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=84-6433)
- **S3:** Main [86:4724](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=86-4724) · Outcome branches [86:5339](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=86-5339) · Annotations [86:5495](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=86-5495)
- **S4:** F1 [73:4759](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=73-4759) · F2 [73:5274](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=73-5274) (dialog [73:5736](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=73-5736)) · F3 [73:5812](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=73-5812) · N1 [73:6228](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=73-6228)
- **S5:** Board A [88:4701](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=88-4701) · Task drawer B [88:5361](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=88-5361) (drawer [88:5464](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=88-5464)) · Annotations [88:5596](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=88-5596)
- **S6:** My Day Light [82:4766](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=82-4766) · My Day Dark [82:4985](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=82-4985) · Checkout Light [82:5196](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=82-5196) · Checkout Dark [82:5315](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=82-5315) · Annotations [82:5432](https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=82-5432)

## Remaining defects seen in final previews
- **S5 drawer B:** fixed after the field relayout. Fields fill the drawer, chevrons and icons sit inside their boxes, helper and description text wrap, and the footer shows all three actions.
- **S5 board A:** the second Activity item was dropped, which matches the rail warning.
- **S2:** the DEC-026 chip wraps onto its own row and touches the bottom of the Exceptions card (the 14 px overflow).
- **S6 checkout:** Alt B and Alt C sit under the sticky footer. This is the fold and is annotated.
