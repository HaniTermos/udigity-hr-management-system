# Phase 5 Brief — Design System and Visual Direction (AUTHORITATIVE — orchestrator-owned)

Version P5-1, 2026-10-20. **Only the orchestrator edits this file.**

## 1. Status
- **Approved baselines:** Phase 2 (workflows), Phase 3 (architecture) and Phase 4 (low-fidelity UX), all approved by the user on 2026-10-20.
- **Still pending:** unresolved business policies and the proposed ADRs. Keep pending policies visibly labelled wherever they affect a screen. Never select one to simplify a design.
- **Phase 5 is authorized:** design system plus a **visual approval sample of 6 screens**, then STOP for user approval.
- **Phase 6** (high-fidelity across all screens) starts only after the user approves the sample.
- **Not authorized:** production code, a new design file, the clickable-prototype phase (you may annotate intended interactions), or reopening completed phases.

## 2. Execution model — the orchestrator is the single Figma operator
- **Agents never call Figma tools.** Each agent prepares its work as **ready-to-run Figma Plugin API scripts** plus a short spec. The orchestrator runs the scripts with `use_figma`, takes checkpoint screenshots, and returns results and errors to the agent.
- **Script rules:**
  - Put scripts in `docs/phase5/scripts/<agent>/NN-<name>.js`, numbered in execution order, each under 45,000 characters.
  - Plain JavaScript with top-level `await` and `return`. No IIFE, no `figma.closePlugin()`, no `figma.notify()`.
  - Each script switches page **once**: `await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('<pageId>'))`.
  - **Load every font before setting text.** Use `Inter`, with style names exactly "Regular", "Medium", "Semi Bold", "Bold".
  - Colours in the 0–1 range. Fills and strokes are reassigned as new arrays.
  - **Idempotent:** look up existing nodes, variables or styles by name and update or skip them instead of duplicating, so a re-run after a partial failure is safe.
  - **Return** every created or changed node, variable and style ID, keyed by name, e.g. `return { created: {...}, updated: {...} }`. Downstream agents depend on these IDs.
  - Prefer Auto Layout (`figma.createAutoLayout`), components, variants (`figma.combineAsVariants`) and variable bindings (`setBoundVariable`, `setBoundVariableForPaint`, which returns a NEW paint).
  - Before writing, read the Plugin API guidance in the Figma skills. Load `figma:figma-use` (and its `references/gotchas.md`, `variable-patterns.md`, `component-patterns.md`, `text-style-patterns.md`) and `figma:figma-generate-library`. These are documentation; load them with the Skill tool and read the files. **Do NOT call any Figma MCP tool.**
- **Feedback loop:** after each run, the orchestrator records results in `docs/phase5/run-log.md` (script → status → returned IDs → error text) and messages the agent. Script errors are fixed by the owning agent.

## 3. Design file and page ownership
File `GNrhb3DWa6mIhEX6F4Nmvw`, "Udigity Management System — Low-Fidelity Wireframes" (reused). Pages 00–15 are the **approved low-fi reference: do not modify.**

| Page | ID | Writer (script author) |
|---|---|---|
| 20 DS — Foundations | `36:2` | Design-System Agent |
| 21 DS — Components | `36:3` | Design-System Agent (the ONLY design system; nobody else creates components) |
| 30 HiFi — Visual Sample | `36:4` | Screen agents, each in its own **section**, named exactly as below |

**Sample sections on page 30:**

| Section | Content | Writer |
|---|---|---|
| `S1 Login` | Login, desktop, light | Shared Agent |
| `S2 Owner Dashboard` | Owner dashboard, desktop, light and dark | Owner Agent |
| `S3 Call Center Workspace` | Contact workspace, desktop | Call Center Agent |
| `S4 Business Form` | Create/Edit business form, desktop | Data Entry Agent |
| `S5 Developer Board` | Project/task board, desktop | Developer Agent |
| `S6 My Day Mobile` | My Day / attendance, mobile, light and dark | Shared Agent |

Screen agents only create **instances** of the Design-System components and bind to its variables. If they need a component that doesn't exist, they file a "Component request" to the Design-System Agent through the orchestrator. They never create a competing component.

## 4. Visual direction
- **Brand colours:** deep navy, turquoise/teal, white.
- **Character:** professional, clean, calm, operational. Structured dashboards, clear tables, focused forms. Restrained borders, shadows and decoration.
- **Logo:** the Udigity logo file has **not been supplied yet**. Use a clearly labelled placeholder component `Brand/Logo (placeholder — awaiting supplied file)` in a neutral box. **Never draw or invent the logo.**
- **Reference images:** not supplied yet. Do not copy banking or e-commerce content from any reference dashboard.
- **Themes and sizes:** light and dark themes via variable modes; desktop 1440×900 and mobile 390×844.
- **Accessibility:** contrast is checked on **actual foreground/background pairs** by computing ratios (WCAG formula) from the hex values. Report the computed numbers; never claim compliance from colour names.

## 5. Shared fictional content (use exactly; no real people or companies)
**Company and employees**

| Item | Value |
|---|---|
| Company | Udigity |
| Owner/Admin | Rana Haddad |
| Data Entry | Karim Saleh |
| Call Center | Maya Khoury, Omar Nassar |
| Developers | Lina Aoun, Sami Fares |

**Businesses**

| Business | Category | Notes |
|---|---|---|
| Glow Beauty Salon (Downtown branch) | Salon | |
| Peak Fitness Gym | Gym | |
| Cedar Home Realty | Real estate | |
| Bloom Florist | Shop | |
| Urban Cuts Barbershop | Salon | |
| Olive & Thyme Café | Café | |
| Nova Dental Clinic | Clinic | |
| Sunrise Bakery | Shop | |
| Harbor Auto Care | Services | |
| Lumen Yoga Studio | Gym | |

**Phones:** clearly fictional, in the format `+000 70 000 1xx`. **Social handles:** `@glowbeauty.demo`, etc. (always the `.demo` suffix). **Websites:** `example.com` subdomains only.

**Deals and projects**

| Item | Value |
|---|---|
| Deals | "Glow Beauty Salon — Booking website" (Closed deal; project In progress); "Peak Fitness Gym — Member app" (Accepted opportunity, Developer Lina Aoun, meeting scheduled) |
| Project tasks | Wireframes approved, Booking flow, Payment page [DEC-018 pending], Content upload (Waiting for client) |

**Dates:** October–November 2026.

## 6. Pending policies to label wherever they appear in the sample

| Screen | Labels |
|---|---|
| Login | R-11 (Owner pending-2FA reading) |
| Owner dashboard | DEC-020 (target metrics); B-1 Accepted-opportunities snapshot definition; Development workload = three sub-counts (SB-3) |
| Call Center workspace | DEC-004 (reservation duration/override), DEC-016 (reopen), D4 (open follow-ups on Rejected/Accepted), DEC-005 (developer pre-closure access) |
| Business form | DEC-013 (name/branch matching), DEC-014/023 (unknown metrics), B2 (phone mandatory?), DEC-015 (categories), DEC-003 (hidden-duplicate reveal) |
| Developer board | DEC-019 (proposed statuses), F2 (provisioning), DEC-006/R-12 (closure authority) |
| My Day | DEC-009 (office verification mode), DEC-012 (summary mandatory?), DEC-026 (failed checkout), DEC-007/008 (schedule, grace) |

Use the DS component `Notice/Policy pending`, which is built by the Design-System Agent.

## 7. Sources
- **Product requirements:** `docs/product-description.md`
- **Screen inventory and sitemap:** `docs/phase3-4/screen-inventory.md`, `docs/phase3-4/sitemap.md`
- **Approved low-fi frames:** node IDs are in `docs/phase3-4/wireframes-w1.md`, `-w2.md`, `-w3.md` and `wireframe-fixes.md`
- **Low-fi kit:** inventory §10, page 03
- **Phase 2 baseline:** `docs/phase2/shared-baseline.md`
- **Architecture** (ADR-010: synchronous exports; async states AR-15): `docs/phase_3_system_architecture_and_data_design.md` and `docs/phase3-4/architecture-a.md` §4.7 and §5A metric catalogue

Never touch the separate `udigity platform` project.
