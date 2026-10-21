# Phase 6 Brief — Full High-Fidelity UI (AUTHORITATIVE — orchestrator-owned)

Version P6-1, 2026-10-21. **Only the orchestrator edits this file.**

## 1. Status and scope
- **Approved by the user:**
  - Phase 2: workflows and state models.
  - Phase 3: architecture.
  - Phase 4: low-fidelity UX.
  - Phase 5: design system on pages 20 and 21, visual sample on page 30, visual direction, and the light/dark and desktop/mobile treatment.
- **Not approved:** business-policy alternatives. Keep them visibly pending, and never select one to simplify a screen.
- **Phase 6 builds:** the full high-fidelity UI for the 54-screen canonical inventory (`docs/phase3-4/screen-inventory.md`) and the states each screen requires, with desktop and mobile coverage as that inventory specifies, in light and dark themes.
- **Not authorized:**
  - Production code.
  - Phase 7 prototype wiring. Annotating intended interactions is fine.
  - A new design file.
  - A competing design system.
  - Restarting visual exploration.
  - Reopening approved phases.
  - Redesigning workflows.
- **Do not omit screens to hit a count.** If the inventory has duplicates or grouped states, reconcile the count openly in the screen register.

## 2. Execution model (same as Phase 5)
**Agents never call Figma tools.** They write ready-to-run Plugin API scripts. **One Figma operator runs them.** Script rules are in `docs/phase5/brief.md` §2:
- numbered files under 45k characters;
- idempotent;
- the page set once per script;
- every font loaded before text is set;
- every ID returned.

**Mandatory lessons from Phase 5:**
1. **Never set x, y or size on children of an instance.** Figma throws "cannot be overridden in an instance: relative-transform". You may change text, fills, visibility, component properties and slot contents.
2. **Set every visible text explicitly.** Component text-property defaults are generic.
3. **Do not move your section on re-run.** Set its position only when you first create it. The orchestrator owns page layout.
4. Fill cards through their **native slots**; drawers and dialogs have Content/Footer slots.
5. **Fields are width-agnostic** since script 12e (minimum width 120). Set Input, Select, Input/Date, Input/Search and Textarea instances to FILL inside an auto-layout parent. **After any design-system change the operator re-lays-out affected instances** (toggle FIXED→FILL), because instances nested inside a slot can render with stale layout.
6. **Keep the fit checks:** return measured heights and widths, and warn on overflow.
7. **No detaching.** No disconnected copies used to work around a component limit. If a component can't do what you need, file a **Component request** to the design-system maintainer through the orchestrator.
8. **Mobile tap targets must be at least 44 px.**

## 3. Ownership: one writer per page

| Page | ID | Script author | Screens (from the inventory) |
|---|---|---|---|
| 20/21 DS Foundations & Components | `36:2` / `36:3` | **Design-System Maintainer**, the only agent who changes main components | — |
| 30 Visual Sample | `36:4` | Phase 5 owners, for the listed small fixes only | S1–S6 (preserved, approved) |
| 40 HiFi — Auth, Shared & Employees | `96:2` | Shared Agent | SCR-AUTH-001..004, SCR-SHR-001..006 |
| 41 HiFi — Owner/Admin | `96:3` | Owner Agent | SCR-OWN-001..012 |
| 42 HiFi — Data Entry | `96:4` | Data Entry Agent | SCR-DE-001..007 and SCR-SHR-008..010 |
| 43 HiFi — Call Center | `96:5` | Call Center Agent | SCR-CC-001..008 |
| 44 HiFi — Developer | `96:6` | Developer Agent | SCR-DEV-001..008 |
| 45 HiFi — Cross-cutting States | `96:7` | Shared Agent | SCR-SHR-007, SCR-SHR-011..015 |

**Layout within each page:**
- One Figma **section per screen**, named `SCR-XX-nnn — <name>`.
- Frames named `SCR-XX-nnn — <name> — Desktop|Mobile — Light|Dark[ — <state>]`.
- Sections go in a vertical stack, 400 px apart, starting at (0,0), in the order the screens appear in the inventory. Each script places its own sections at creation only.

**Theme coverage per screen:**
- The primary desktop frame in **Light**.
- A **Dark** frame of the primary state for every screen.
- A mobile frame in Light (plus Dark for My Day, check-in/out and the calling queue/contact) wherever the inventory marks mobile priority.
- State frames may be Light only, unless the state is visually theme-sensitive.

All of these use the shared Semantic variables: collection `VariableCollectionId:40:3`, modes Light `40:1` and Dark `40:2`, set with `setExplicitVariableModeForCollection`.

**Reuse:** start from your Phase 5 sample script helpers (`docs/phase5/scripts/<role>/`) and the component ID index `docs/phase5/ds-ids/index.md` plus the per-script JSON. The approved sample screens on page 30 are the visual reference for each role.

## 4. Batches (operator run order; agents may prepare ahead in parallel)

| Batch | Screens |
|---|---|
| **A** | Design-system maintenance + Auth and Shared (page 40) |
| **B** | Data Entry (42) + Call Center (43) |
| **C** | Developer (44) + Owner (41) |
| **D** | Cross-cutting states (45) + a mobile and theme coverage sweep across all pages |

After each batch, an independent reviewer checks **fresh previews**. Fix meaningful defects; no repeated cosmetic cycles. If the same issue survives two repair attempts, escalate it.

**Pause only for:**
- a genuine blocking business decision;
- a material departure from the approved visual direction;
- a required tool or action confirmation;
- a tool limitation (quota) that stops progress.

**Never retry a denied or blocked action through another agent or execution path.**

## 5. Preparation items (from the Phase 5 approval)

| # | Item | Owner |
|---|---|---|
| P1 | Remove "assumed" from the confirmed 9-hour workday wording (S6 sample and all new screens) | Shared Agent |
| P2 | Hidden-match dialog (S4-N1 and the shared duplicate patterns): replace raw bracket text with readable policy-pending copy, without selecting a policy | Data Entry Agent (sample) + DS Maintainer (if it's component copy) |
| P3 | Remove unintended corner/shadow artifacts on the hidden-match dialog | Data Entry Agent / DS Maintainer |
| P4 | Add padding to the Owner Exceptions card (DEC-026 chip touching the bottom) | Owner Agent |
| P5 | Make the shared Progress/Bar component resizable and value-driven (no instance-child resizing needed), then reuse it, including on the Owner dashboard instead of token-drawn bars | DS Maintainer, then Owner Agent |
| P6 | Verify the mobile Cancel hit area by component/frame inspection (at least 44 px) | Operator inspects; DS Maintainer fixes if needed |
| P7 | Carry the "Record delivered" open-task warning into the interaction spec for Phase 7 prototype verification | Developer Agent → `docs/phase6/interaction-spec.md` (that section) |
| P8 | Udigity logo: if the file appears at `assets/`, the DS Maintainer replaces the placeholder component's content. Otherwise keep the placeholder; the user has been asked | DS Maintainer |

## 6. Content and policy rules
- **Content:** the fictional content in `docs/phase5/brief.md` §5. **Policy labels:** §6 of that brief, extended to every screen that touches a pending DEC (see the inventory's policy column).
- **Keep exactly:** approved workflows, actions and access boundaries. In particular:
  - Call Center and Developer use "Request correction" and never edit master data.
  - Data Entry never changes commercial status.
  - Reports, exports and audit are Owner-only.
  - A hidden duplicate reveals existence only.
  - Developers see eligible closed deals only.
  - "Waiting for client" is a project status; task-level client waits are a "Client dependency" chip.
- **Do not add unsupported functionality.**

## 7. Documentation (supports the design; does not replace it)

| Path | Writer |
|---|---|
| `docs/phase6/brief.md`, `docs/phase6/screen-register.md`, `docs/phase6/run-log.md` | Orchestrator (the operator appends run rows) |
| `docs/phase6/screens/<role>-spec.md` | Each screen agent: short per-screen build notes |
| `docs/phase6/interaction-spec.md` | Each agent appends its own section (intended interactions for Phase 7) |
| `docs/phase6/reviews/` | Reviewers |
| `docs/phase6/previews/` | Operator (PNG previews per screen) |
