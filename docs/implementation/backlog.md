# Integration backlog (orchestrator)

Items found during the build, waiting for their owner's next round.

| ID | Owner | Item | Source |
|---|---|---|---|
| BL-01 | BE3 | Add `reservedBy`/reservation status, phone, category, last attempt and search to the assignment list DTO (needed by Figma OWN-007) | FE2-INC4 |
| BL-02 | FE1 | Set nav `built:true` for Calling Assignments, and for each page as it ships | FE2-INC4 |
| BL-03 | BE3/TL | Add `contact_reservation.overridden` to the outbox events, so the holder is notified | BE3-R1 |
| BL-04 | BE2 | Call `initCallingState` in the business insert, and add a business-summary operation | BE3-R2 |
| BL-05 | BE1 | Batch employee-name operation; `PATCH /employees/me`, password change, revoke-all sessions | BE3-R3, FE1 |
| BL-06 | Security | Add the DNC/opportunities list actions to the authz matrix | BE3-R5 |
| BL-07 | BE5 | Fix 4 lint errors; add the E-01 credential-setup email consumer | TL-2, BE1-R2c |
| BL-08 | FE2/FE3/FE4 | Remove the Figma callouts and `alert()` calls, and label the raw inputs (reports, targets, EmployeeDrawer, dashboard, BusinessFormCards, LogAttemptPanel) | FE1-INC3, CR-1 |
| BL-09 | BE (all) | Include the conflicting record in 409 bodies, so the SHR-014 field diff can render | FE2-INC4 |
| BL-10 | FE3 | Re-align with the BE2-C2 contract when it is posted | FE3-INC3 |
| BL-11 | BE4/BE3 | Endpoint to assign a developer to an accepted opportunity, plus a developer list, for the CC-007 handoff ("Assign developer", "Schedule first meeting") | FE4-INC4 |
| BL-12 | FE4 | Owner agent filter on the queue and follow-ups | FE4-INC4 |
| BL-13 | FE4 | Pixel check against `figma-specs/page-43.md` once FIG-1 writes it | FE4-INC4 |
| BL-14 | BE3 | `calling.api.test.ts` "unassign … list shows Unassigned" depends on page 1 of a name-sorted list; make it independent of data order | BE2-INC3 |
| BL-15 | BE4/BE2 | Confirm the deal/project columns so BE2 can write view revision 903, replacing the placeholders | BE2-INC3 |
| BL-16 | DevOps/BE1 | Mark `POLICY_COMPANY_TIMEZONE` required in the env examples (it now fails closed) | BE2-INC3 |
| BL-17 | BE5/TL | Outbox event names for correction resolved/rejected/closed notices | BE2-INC3 |
| BL-18 | BE2 | Populate `currentValue` on correction requests | FE3-INC3b |
| BL-19 | BE3/BE4/BE2 | Fill `calling` and `dealContext` on the business detail (needs their read ops) | FE3-INC3b |
| BL-20 | BE1/FE3 | Expose whether the DEC-015 setting lets Data Entry add categories (via capabilities or settings), so the Add card follows the policy | FE3-INC3b |
| BL-21 | BE4/FE5 | Server-side search and project-status filter on the deals list (now client-side over 50 rows) | FE5-INC5 |
| BL-22 | BE4/FE5 | Meeting attendee selection, and category/phone on the deal's business card | FE5-INC5 |
