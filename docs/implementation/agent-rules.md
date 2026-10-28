# Rules for every build agent (orchestrator-owned)

1. **Plan.** `docs/implementation/plan.md` is authoritative. Edit **only** the files you own (§3). For anything else, post a REQUEST on `docs/implementation/coordination.md`, which is append-only.
2. **Never read, print or edit `.env` files.** You may edit `*.env.example` files only if you own them.
3. **Databases.**
   - Never touch the local PostgreSQL 17 Windows service.
   - Backend tests use **your own** database in the Docker test container: `TEST_DATABASE_URL=postgres://udigity_test:udigity_test_throwaway@127.0.0.1:55432/udigity_test_<you>`, where `<you>` is `be1`…`be5` or `tl`. The password is throwaway.
   - Set it only in the test command's environment.
4. **Parallel-safe checks.**
   - Backend agents run `npm run typecheck` and `npm test` (with your TEST_DATABASE_URL) in `backend/`. They do **not** run `npm run build`; the orchestrator runs builds.
   - Frontend agents run `npx tsc --noEmit` and `npm run lint` in `frontend/`. They do **not** run `next build`, because several agents share `.next`.
5. **Migrations.** Forward-only and non-destructive, numbered within your range (§3.1). Never edit an applied migration.
6. **Policies.**
   - Unresolved policies are flags from `backend/src/shared/flags.ts` (plan §6). Label them "Demonstration alternative — not approved".
   - The only user-approved rule is "Accepted keeps reservation".
   - Never write "approved" for anything else.
7. **Email.**
   - nodemailer uses SMTP from env.
   - When `SMTP_HOST` is empty, use the log/dev transport.
   - **Never send a real email.** Tests use a mail sink or JSON transport.
8. **UI.**
   - Match the approved Figma screens: see `docs/phase6/handoff-ready.md` (frame links) and the previews in `docs/phase6/previews/<page>/`. Look at the PNGs.
   - Use FE1's components and theme tokens only. Never hard-code colours.
   - Dark mode is **navy**.
   - Show pending policies with `<PolicyPendingChip … demo />`.
9. **Access.**
   - Every endpoint goes through the shared access engine (plan §4.9, §5) and the authz matrix (`docs/security/authz-matrix.md`).
   - Write a test for each role.
   - Audit events are written in the same transaction as the change.
10. **Scope.** No production deploys, no git commits or pushes, no new requirements, no redesign. Preserve existing working code.
11. **Reporting.**
    - When you finish, append `[<YOU>-INC<n>] DONE` to the board with: what works (tested), what is mocked, what is blocked, and the exact check results.
    - Keep your reply under 120 words.
