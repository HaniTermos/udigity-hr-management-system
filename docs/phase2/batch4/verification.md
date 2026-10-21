# Batch 4 — Board 02 drawing verification (T4d)

Agent 4, 2026-10-20. Board 02 fileKey `lwmKQNJI42na8B3SSNLQJP`. Baseline SB-2 §9a leases: 01 `65:3581`, 08 `65:3590`, 09 `65:3593`, 10 `65:3596`. Status: **DRAFT, not approved.** Nothing here has been tested; there is no software.

Link pattern: `https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=<id with - instead of :>`.

## 1. Procedure followed
- **Board lock (§9a).** Before every `generate_diagram`, the lock directory was created with `mkdir`. While the lock was held, a snapshot of top-level IDs was taken, the diagram was generated, and the new top-level nodes were diffed against the snapshot. Those nodes were wrapped in place in a new section, with absolute positions preserved (`child.x = oldX - section.x`) and no connector moved on its own. Each section got a header: a 40 px bold title and a 22 px meta line (Status, UC, REQ range, actors, policy-dependent items). The section was then moved into the leased parent and the lock released with `rmdir`. A guard refused to wrap any node whose name looked like another agent's section.
- **Lock waits.** Agent 3 held the lock several times; I waited 15–75 s each time and never broke it. Before the orchestrator released it, a stale lock had blocked the session.
- **Scope.** Only my own sections were edited. Parents were enlarged downward only. Nothing in sections 00, 02–07 or 11–12 was touched.
- **Tables.** The transition tables (FigJam tables) for the 6 state models and the G1 reporting-distinctions table were added with `use_figma`. No lock was needed for these.

## 2. Artifact index

| Section | Artifact | Node ID | Link |
|---|---|---|---|
| 01 | WF-AUTH-001 Part 1 — Login and Owner 2FA | `70:3683` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=70-3683) |
| 01 | WF-AUTH-001 Part 2 — Logout, expiry, revocation | `72:3769` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=72-3769) |
| 01 | WF-AUTH-002 Part 1 — Password reset | `74:3887` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=74-3887) |
| 01 | WF-AUTH-002 Part 2 — Owner 2FA enrollment / recovery | `76:3973` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=76-3973) |
| 01 | WF-EMP-001 Part 1 — Create, edit, role change | `78:4102` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=78-4102) |
| 01 | WF-EMP-001 Part 2 — Deactivation | `80:4213` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=80-4213) |
| 01 | WF-EMP-001 Part 3 — Self-profile update | `82:4276` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=82-4276) |
| 01 | SM-ACCOUNT-001 diagram + transition table (`93:4344`) | `93:4341` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=93-4341) |
| 01 | SM-SESSION-001 diagram + transition table (`93:4490`) | `86:4347` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=86-4347) |
| 08 | WF-DEAL-001 Part 1 — Handoff and developer assignment | `98:5188` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=98-5188) |
| 08 | WF-DEAL-001 Part 2 — Meetings and discovery | `102:5455` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=102-5455) |
| 08 | WF-DEAL-002 Part 1 — Signature and payment | `106:5714` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=106-5714) |
| 08 | WF-DEAL-002 Part 2 — Closure and provisioning | `110:5959` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=110-5959) |
| 08 | SM-COMMERCIAL-001 diagram + transition table (`115:6475`) | `115:6383` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=115-6383) |
| 08 | SM-MEETING-001 diagram + transition table (`115:6711`) | `115:6434` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=115-6434) |
| 09 | WF-PROJ-001 Part 1 — Delivery list, assignment, schedule, status | `119:7183` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=119-7183) |
| 09 | WF-PROJ-001 Part 2 — Tasks and milestones | `123:7279` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=123-7279) |
| 09 | SM-PROJECT-001 diagram + transition table (`127:7516`) | `127:7466` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=127-7466) |
| 09 | SM-TASK-001 diagram + transition table (`127:7734`) | `127:7513` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=127-7513) |
| 10 | WF-REPORT-001 — Reporting distinctions (G1) table (`93:4914`) | `93:4911` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=93-4911) |
| 10 | WF-REPORT-001 Part 1 — Dashboard, filters, comparison | `132:8099` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=132-8099) |
| 10 | WF-REPORT-001 Part 2 — Export | `135:8177` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=135-8177) |
| 10 | WF-REPORT-002 — Audit log explorer | `137:8255` | [open](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP?node-id=137-8255) |

Totals: 16 workflow diagrams, 6 state diagrams, 7 tables. The Mermaid source is in `batch4-mermaid.md`, including its "Board send record" of label changes made at send time.

## 3. Read-back (`get_figjam`, saved outputs grepped)

| Section | Direct diagram sections | Shapes | Connectors | Connectors missing an endpoint | Tables |
|---|---|---|---|---|---|
| 01 `65:3581` | 9 (IDs as above) | 136 | 156 | 0 | 2 |
| 08 `65:3590` | 6 | 101 | 126 | 0 | 2 |
| 09 `65:3593` | 4 | 57 | 77 | 0 | 2 |
| 10 `65:3596` | 4 (read in full) | — | — | 0 | 1 |

A board-level check with `use_figma` (read-only) found:
- The top level still holds only the 13 orchestrator sections, with no loose nodes.
- No top-level sections overlap.
- No two diagram sections overlap inside sections 01, 08, 09 or 10.
- No child extends outside its parent.

The R-11 / R-12 "→ USER" labels appear in the read-back text: 10 occurrences in section 01 and 13 in section 08.

## 4. Visual inspection (`get_screenshot`, base64)
I took one screenshot per diagram section, and a second one after every fix. What I saw:
- **Connectors and labels.** All 22 diagrams render with intact connectors and labelled decision exits.
- **Colours.** Red failure nodes, green success ends, yellow policy-dependent nodes, orange unselected alternatives (DEC-005, DEC-006, F2) and blue derived nodes all match the legend.
- **Tables.** All tables are legible, with dark headers.

**Fixes made (only for problems that could mislead):**
1. **SM-ACCOUNT-001.** In the first render, the deactivate and reactivate edges and the two self-loops overlapped, so the direction of deactivation was ambiguous. Two connector re-routes made it worse. I deleted my own section and regenerated it as `TB`, with the self-events moved into the state labels and the table. The new render (`93:4341`) shows each direction clearly.
2. **SM-COMMERCIAL-001.** The first render had 21 edges and overlapping labels, with "finalize closure" over "verification requested". I deleted my own section and regenerated it with core transitions only. The self-transitions (including developer reassignment on every non-terminal stage, RV4-05) and the error corrections are in the transition table and noted in the header. The new render (`115:6383`) is readable.
3. **Clipped text.** The DEC-006 Alt A/B parallelograms in WF-DEAL-002 Part 2 hid "R-12 → USER". A heuristic scan then found 20 more long-text diamonds and parallelograms, including the RV4-04 "Edit … role and status excluded" node. All 21 shapes were enlarged in place, keeping their centres. Re-screenshots of WF-DEAL-002 Part 1/2 and WF-EMP-001 Part 1 show the full text.

## 5. Residual issues (cosmetic; not misleading, so left as they are)
- **Long edge runs.** ELK routing leaves long loops or back-edges in:
  - WF-AUTH-002 Part 1 (the delivery-result node sits left of the email step);
  - WF-DEAL-001 Part 2 (the "Record outcome" and "Reschedule" loops run across the top);
  - WF-DEAL-002 Part 1 (the facts loop reads right to left);
  - WF-PROJ-001 Part 1 (dense status cluster).
  
  All of them can be traced correctly.
- **Stacked labels.** In SM-ACCOUNT-001 the two labels between Active and Deactivated sit next to each other; the arrowheads make the direction clear. In SM-SESSION-001 the "valid credentials, Owner with factor" label touches the Pending 2FA verification box.
- **Blue fill on a step.** WF-REPORT-001 Part 1 uses a blue fill for the "computes each metric separately" step, but the step is not labelled "(derived)". It is an emphasis colour, not a derived classification.
- **Simplified state diagrams.** SM-COMMERCIAL-001 and SM-PROJECT-001 omit some edges; the tables carry them (stated in each header).
- **Section 01 height.** Section 01 grew to 11 211 px because each wide diagram takes its own row.
- **Lease notes.** The lease-note texts ("DRAFT, in progress") were left for the orchestrator, as instructed.

## 6. Not done
- No software behaviour was tested.
- The optional review minors from `reviews/batch4-review.md` were not applied, except the label fixes listed in `repair-log.md`.
- R-11 and R-12 remain → USER; both readings are shown and neither is selected.
