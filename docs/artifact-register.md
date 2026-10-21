# Artifact Register — Udigity Management System

Last reconciled: 2026-10-20. Scope: internal HR/CRM system only.

**Source authority (highest first):**
1. Explicit user requirements and approved decisions
2. Approved requirements / use-case specifications
3. FigJam representations of those specifications
4. Unapproved AI proposals

**Locations checked:** `D:\udigity company\udigity hr system\` (all files); FigJam Board 01 (full read via Figma MCP `get_figjam`, node `0:1`); file names only under `D:\udigity company\` to locate candidates.
**Excluded:** `D:\udigity company\udigity platform\` (multi-tenant e-commerce product; different system; not read, not modified).

"Not found here" = absent from the locations above. It does **not** mean the artifact doesn't exist.

## A. Register

| ID | Artifact | Phase | Version | Location | Access | Draft / Approved | Current / Superseded | Approval evidence |
|---|---|---|---|---|---|---|---|---|
| ART-01 | Complete Product Description | Input (pre-Phase 0) | Unversioned; recorded as PD-2026-10-20 | Pasted by user in session; saved verbatim to [product-description.md](product-description.md) | Accessible | User-provided requirements (tier 1). Items the document itself marks unresolved are **not** approved | Current | Supplied directly by the user. No sign-off on its open items |
| ART-02 | Phase 0 requirements baseline (`REQ-AUTH-001..009`, `REQ-ATT-001..012`, `REQ-BIZ-001..009`, `REQ-SEC-DUP-001..007`, `REQ-SEC-VIS-001..006`, `REQ-CALL-001..011`, `REQ-PROJ-001..008`, `REQ-REPORT-001..006`, `REQ-SEC-TECH-001..006`) | 0 | Unknown | Referenced on Board 01, section `29:538` (nodes `29:508`–`29:532`) | **Not found here** | Unknown | Unknown | None available. Only ID ranges are visible, not the requirement text |
| ART-03 | "Phase 1 Product Map & Use Cases Specification (Revised Baseline v1.1.0)" | 1 | v1.1.0 (implies an earlier, superseded v1.0) | Referenced on Board 01, node `29:535` | **Not found here** | Unknown | v1.1.0 presumed current per its label | None available |
| ART-04 | FigJam Board 01 — "Product Map & Use Cases (Phase 1)" | 1 | Unversioned; cites spec v1.1.0 | [Board 01](https://www.figma.com/board/Ml01oLIuAs3MTzxQ7PW1L0), fileKey `Ml01oLIuAs3MTzxQ7PW1L0` | Accessible (editor access granted 2026-10-20) | **No approval marker found** on the board. Tier 3: it represents a spec, it is not the spec | Current, with internal duplicates (see notes) | None. Its `[Confirmed]` tags cite REQ IDs from ART-02, which can't be checked |
| ART-05 | Decision register DEC-001 … DEC-026 | 1 | Unknown | Index only: Board 01 section `28:534`. Full alternatives shown only for DEC-001 (`24:414`), DEC-002 (`25:430`), DEC-005 (`26:430`) | Partial: titles and status tags only, for 23 of 26 | Each entry tagged Unresolved / Proposed. None tagged approved | Current | Board tags only |
| ART-06 | Role / action permission matrix | 1 | Unknown | Summary only: Board 01 section `27:470` | Partial: summary only | Mixed `[Confirmed]` / `[Proposed]` / `[Unresolved]` tags | Current | Tags cite unavailable REQ IDs. Some `[Confirmed]` tags contradict ART-01 (see conflict C-01) |
| ART-07 | Screen inventory (`SCR-*` IDs, e.g. `SCR-OWN-004`, `SCR-CC-005`, `SCR-DE-006`) | 1 or 2 (unknown) | Unknown | Referenced on Board 01 nodes `30:531`, `30:561`, `31:736` | **Not found here** | Unknown | Unknown | None |
| ART-08 | Phase 2 workflows | 2 | Unknown | None referenced in any accessible artifact | **Not found here** | Unknown | Unknown | None |
| ART-09 | Phase 2 state machines | 2 | Unknown | DEC-019 "Service Delivery State Machine [Proposed]" hints at one | **Not found here** | Unknown | Unknown | None |
| ART-10 | "Design Brief" | Unknown | Unknown | Named in the Board 01 legend (`1:26`: "CONFIRMED: Specified in Design Brief or Confirmed by User") | Possibly = ART-01; **unconfirmed** | Unknown | Unknown | None |
| ART-11 | AI policy proposals D1–D20 | AI proposal | 2026-10-20 | [decisions.md](decisions.md) | Accessible | **Unapproved AI proposal** (tier 4) | Current draft | None. Mapped to DEC IDs in decisions.md §"Mapping to the DEC register" |
| ART-12 | This register | — | 2026-10-20 | `docs/artifact-register.md` | Accessible | Draft | Current | — |
| ART-13 | FigJam Board 02 — Workflows & State Machines | 2 | Batch 1 (2026-10-20) | [Board 02](https://www.figma.com/board/lwmKQNJI42na8B3SSNLQJP), fileKey `lwmKQNJI42na8B3SSNLQJP`, aap047's team (destination chosen by the user) | Accessible | **Approved** (Phase 2 baseline) | Current | User approval message 2026-10-20: "I approve Phase 2 as the workflow and state-model baseline"; policy alternatives remain pending |
| ART-14 | Phase 2 companion doc + Batch 1 Mermaid source | 2 | Batch 1 | [phase_2_workflows_and_state_machines.md](phase_2_workflows_and_state_machines.md), [phase_2_batch1_mermaid.md](phase_2_batch1_mermaid.md) | Accessible | Approved (Phase 2 baseline) | Current | As ART-13 |

### Board 01 internal notes (ART-04)
- **Two versions of the lifecycle flow.** Sections `10:331`–`10:375` (six simple stages) and `30:543`–`30:612` (detailed, with UC/DEC references). The second looks like a replacement, but neither is marked superseded.
- **Two role overviews.** Section `1:25` and `31:661`–`31:793`.
- **Leftover nodes:** "Test" (`23:406`), "Shared.UC" (`31:794`), "Owner.UC" (`31:797`).
- **Possibly a later addition:** section `20:412` "Phase 1 Corrective Coverage Additions" (UC-AUTH-008, UC-BIZ-008, UC-CALL-008/009/010, UC-DEAL-004).

## Terminology and policy conflicts (recorded, not resolved)

### C-01 Permanent deletion vs archiving
| Source | Statement |
|---|---|
| ART-01 §2.1 (tier 1) | "The precise deletion-versus-archiving behavior should be finalized before implementation. Full access should not silently translate into permanent deletion of operational history." |
| ART-01 §2.2 | Data Entry cannot delete business records (confirmed) |
| ART-04 `27:443` (tier 3) | "Business Deletion: Owner Only [Confirmed]" |
| ART-11 D20 (tier 4) | Archive-only; no hard deletes in the application |

**Status: unresolved.** The board's `[Confirmed]` tag is broader than the tier-1 source, which leaves the Owner's deletion behavior open. "Data Entry cannot delete" is confirmed. No DEC ID covers this question.

### C-02 `Pending` vs `NEW_LEAD`
| Source | Meaning |
|---|---|
| ART-01 §9.4 | **Pending** = a *calling outcome*: "has not yet reached a resolved contact or sales outcome." It sits alongside On hold, Needs another call, Rejected and Accepted |
| ART-01 §15 | "Pending businesses" is a dashboard metric |
| ART-04 `30:553` | **NEW_LEAD** = the status assigned when the record is committed at intake, before any queue assignment (`30:557` comes next) |

**Analysis:** these overlap but are **not the same concept**.
- `NEW_LEAD` marks the *intake/assignment* point (new, not yet in anyone's queue). It merges two things the product keeps apart: assignment state and calling outcome.
- `Pending` is a *calling outcome*. It also applies once a business is assigned, and possibly after a contact that produced no resolved outcome, depending on how "resolved" is read.
- A business can be assigned and still Pending, so the two can't share one state field without losing information.

**Proposed separation (not approved):**

| Dimension | UI label | Proposed internal identifier |
|---|---|---|
| Calling outcome | Pending | `pending` |
| Calling outcome | On hold | `on_hold` |
| Calling outcome | Needs another call | `needs_another_call` |
| Calling outcome | Rejected | `rejected` |
| Calling outcome | Accepted | `accepted` |
| Assignment state | Unassigned / Assigned | `unassigned` / `assigned` |

`NEW_LEAD` would then become a derived view ("unassigned and pending"), not a stored status. Open sub-question: does Pending still apply after a contact that produced no resolved outcome? ART-01 doesn't say.

### C-03 Office verification mode
| Source | Statement |
|---|---|
| ART-01 §4.2 | Four modes listed (IP only / location only / either / both); **unresolved** |
| ART-04 `5:120`, `31:674`, `31:677`, `9:309` | "Office IP/Location", "Office IP/GPS", "Configure Office IP & Geofence". Implies both are configurable; mode unspecified |
| ART-05 DEC-009 | Unresolved |
| ART-11 D2 | Proposes IP only |

**Status: unresolved (DEC-009).** Architecture should support both inputs. The mode stays pending.

### C-04 Fifteen-day timer and exceptions
| Source | Statement |
|---|---|
| ART-01 §8 | Timer origin, reset behavior and each exception are **unresolved**. Confirmed principles: records remain stored, duplicate detection still checks them, the Owner keeps access, and the rule applies beyond list screens |
| ART-05 DEC-001 (`24:414`) | Alt A: count from `created_at`, no reset. Alt B: inactivity-based, resets on call attempt or scheduled callback. Both "Unselected" |
| ART-05 DEC-002 (`25:430`) | Six-row table of exceptions with A/B alternatives; all "Unresolved". Includes the callback exception "until callback datetime + 48h grace" |
| ART-04 `30:596` | Closed deals "Visible Company-Wide subject to 15-day policy" |
| ART-11 D9 | Proposes a third option: count from creation (Data Entry) or assignment (Call Center), with no reset, plus active-work exceptions |

**Status: unresolved (DEC-001, DEC-002).** D9 is a new alternative, not a selection of A or B.

## C. Confirmed gaps vs inaccessible artifacts

### Confirmed gaps in accessible artifacts
1. **The DEC register has no entry for two items that ART-01 §20 lists as outstanding:**
   - Notifications (timing, recipients, escalation)
   - Recovery operations (backup retention, recovery objectives)
2. **No DEC entry for deletion vs archiving** (ART-01 §2.1), or for the Pending/NEW_LEAD terminology (C-02).
3. **No DEC entry for commercial-stage transition rules** (ART-01 §12: "exact transition and evidence rules must be finalized"). DEC-019 covers service delivery only.
4. **No notification use cases on Board 01**, although ART-01 §16 requires them.
5. **Board 01 has no workflow or state-machine content** beyond one end-to-end lifecycle flow (two versions of it).

### Inaccessible (may exist elsewhere)
ART-02, ART-03, ART-07, ART-08, ART-09, ART-10, the full DEC register text (ART-05) and the full permission matrix (ART-06).
Any "gap" above might be covered in ART-02 or ART-03; it is a gap only in what is accessible here.
