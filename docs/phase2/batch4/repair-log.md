# Batch 4 repair log (after `reviews/batch4-review.md`)

Agent 4, 2026-10-20. Baseline SB-2. Only the six required fixes were made; optional minors were skipped except a few one-line label fixes noted below.

| ID | Fix | Files |
|---|---|---|
| RV4-01 | Pending-2FA scope is now **R-11 → USER** with both readings (R11-a: all access waits for 2FA / R11-b: only administrative actions wait), neither selected. "Confirmed" is kept only for "no administrative access before 2FA". Non-admin preconditions (WF-DEAL-001, WF-DEAL-002, WF-PROJ-001) read "Owner 2FA per R-11". BCR-03(a) became a pointer to R-11. | spec (WF-AUTH-001 step 4/L1, SM-SESSION-001, tag table), Mermaid #7 and #22, deps §2/§6 |
| RV4-02 | Batch 4 now **consumes** `accepted_opportunity.created` (Batch 3, E5/R-05). `opportunity.created` was removed. The G1 "Accepted" metric and the G2 row point to the Batch 3 event; it is counted once, in Batch 3's G2 table. | spec (WF-DEAL-001 audit, SM-COMMERCIAL-001 start row, G1 table, §5 G2) |
| RV4-03 | Added "R-12 → USER (DEC-005 Alt 2 × DEC-006)" to: WF-DEAL-002 errors and authorization; the SM-COMMERCIAL-001 signature, payment and finalize rows; Mermaid #3 `denied`; Mermaid #4 `altA`. T-1 now cites R-12. Outcome not settled. | spec, Mermaid, deps T-1 |
| RV4-04 | WF-EMP-001 M1 excludes **role and status**. Mermaid #11 now has separate entry nodes for create (includes role) and edit (role/status excluded; role only via Change role). | spec, Mermaid #11 |
| RV4-05 | Assign/reassign Developer is now a self-transition on **every non-terminal stage**: Accepted opportunity, Signed, Paid, Signed and paid. Updated in WF-DEAL-001 triggers/A2, the SM-COMMERCIAL-001 row, Mermaid #1 `reopen` and Mermaid #17. | spec, Mermaid |
| RV4-06 | Mermaid #3 `both` has a new exit, "None" → "Stage: Accepted opportunity (only fact removed)". It loops back to `which`. | Mermaid #3 |

One-line minors also applied:
- Baseline is cited as SB-2.
- BCR-01/04/05 citations now point to R-13/R-04/R-05.
- Mermaid #7 `ended` reads "attempt threshold reached".
- The Mermaid #4 Alt labels are marked "drafted from ART-01 §12".

Re-check: the script lint still finds no undefined or unused node IDs and no unlabelled decision exits. The largest flowchart has 23 nodes.
