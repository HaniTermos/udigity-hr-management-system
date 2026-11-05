<!--
  ART-15: Owner-approved policy baseline. Saved verbatim from the Owner's message of 2026-10-29.
  Do not edit the text below; record later changes as new decisions in decisions.md.
-->

# Udigity Management System — Approved Policy Baseline

Approval date: 29 October 2026
Status: Approved policy baseline, subject to the explicitly pending
company inputs below.

## Authority and scope

This document records the Owner’s selected v1 policies and supersedes
the earlier unapproved D1–D20 proposals where they conflict.

Approval covers the current Figma design work and the policies stated
here. It does not authorize production deployment, external purchases,
real email sending, destructive database operations, or unreviewed
changes to infrastructure.

DEC-001 … DEC-026 remain the canonical decision identifiers.
D1–D20 are section labels only.

Where this document changes an earlier confirmed requirement, record
the supersession explicitly in the decision register.

## D1. Company schedule and attendance calendar

- Required working duration: 9 hours per scheduled working day.
- Proposed launch schedule: Monday–Friday, starting at 09:00.
- Proposed company timezone: Asia/Beirut.
- Late grace period: 10 minutes.
- Late status starts strictly after shift start plus the grace period.
- Grace affects lateness classification; it does not reduce the required
  working duration.
- Shift end for notifications is scheduled start plus 9 hours.
- All “today,” daily targets, attendance dates, and report boundaries use
  the company timezone.
- The Owner maintains company holidays and approved employee days off.
- Holidays and approved days off suppress missing-check-in alerts and
  attendance obligations for the affected employee/date.
- Per-employee recurring shift schedules remain out of scope for v1.
- Historical attendance reports retain the applicable schedule context.

Pending confirmation:
Working days, start time, timezone, and initial holiday calendar.
Do not activate enforcement using assumed values.

## D2. Office verification

- Office attendance uses a configured public IP/CIDR allowlist.
- Trust client-IP forwarding headers only from explicitly trusted proxies.
- Login and ordinary application access do not require office verification.
- Office verification is a network-location check, not proof of physical
  presence.
- Geolocation fallback is disabled and is not a launch requirement.
- If the office lacks a stable public IP, obtain an explicit alternative
  decision; do not silently enable geofencing or permit all addresses.

Pending input:
Whether a static public IP is available and the approved IP/CIDR values.

## D3. Remote attendance

- Employees may sign in from anywhere.
- Attendance actions require office verification unless the Owner grants
  a remote exception for a specific employee and date/date range.
- Remote exceptions require a reason and are audited.
- Attendance under an exception is clearly labelled remote.
- Employees cannot grant their own exceptions.

## D4. Attendance corrections

- Employees may request corrections with proposed times and a reason.
- The Owner approves or rejects requests.
- The Owner may also make a direct adjustment with a mandatory reason.
- Preserve original attendance events.
- Store corrections separately and show effective values with an
  “adjusted” marker.
- Prevent overlapping or otherwise invalid effective sessions.
- Audit requests, approvals, rejections, and direct adjustments.

## D5. Failed and missing checkout

- An authenticated checkout that fails office verification may close
  provisionally at the server-received attempt time.
- Mark it pending review with the verification failure reason.
- This exception does not bypass authentication, CSRF protection, input
  validation, or other security requirements.
- If the server never receives a request, do not invent a checkout event.
- The Owner confirms or corrects provisional checkout records.
- Sessions still open at scheduled shift end plus 6 hours are flagged
  “missing checkout”; never auto-close them with a guessed time.
- Prevent a new check-in while a previous session remains unresolved.
- Show the correction-request action directly on the check-in screen.
- Alerts and review workflows must avoid trapping employees without
  a resolution path.

## D6. Checkout work summary

- Require “Work completed,” at least 10 non-whitespace characters.
- Outstanding tasks, blockers, and notes are optional.
- Target progress is calculated automatically.
- The Owner may complete a correction when an employee cannot supply
  the summary; the reason must be recorded.

## D7. Targets and counting

- Attribute work to the employee who actually performed the action.
- Use company-timezone dates.
- Data Entry primary metric:
  Valid businesses created, counted once per record.
- Call Center primary metric:
  Distinct businesses with at least one logged contact attempt that day.
- Developer primary metric:
  Tasks completed per week.
- Show secondary metrics without automatically making them targets.
- Edits do not count as newly created businesses.
- Repeatedly reopening and completing the same task must not inflate
  target totals.
- Daily targets apply to scheduled working days.
- Weekly targets use Monday–Sunday in the company timezone.
- The Owner sets numeric targets and reviews them weekly.
- Do not invent numeric performance quotas or apply retroactive changes.

## D8. Allocation and contact reservations

Allocation:
- Manual assignment plus an Owner-triggered “Auto-fill queues” action.
- Select eligible, unassigned, non-rejected businesses, oldest first.
- Distribute round-robin across active Call Center agents.
- Default queue cap: 40 current eligible assigned businesses per agent.
- This is a queue cap, not a performance quota.
- Never move businesses with an open follow-up, active reservation,
  accepted opportunity, or active deal.
- No scheduled automatic reassignment in v1.
- Explicit reassignment is audited.

Reservation decision for DEC-004:
- Preserve the lease duration and idle rule already explicitly approved
  in the canonical register, if one exists.
- If DEC-004 remains only proposed, present its exact existing proposal
  for one final Owner selection. Do not invent or silently approve a
  duration that is absent from this document.
- Reservation ownership and expiry are enforced server-side.

## D9. Fifteen-day visibility

Basic window:
- Data Entry: 15 elapsed days from creation.
- Editing does not restart the window.
- Call Center: 15 elapsed days from assignment.
- Reassignment ends the previous agent’s assignment-based access and
  starts the new agent’s window.
- Calls, notes, edits, and other interactions do not reset the window.
- The Owner is not subject to this restriction.

Active-work exceptions:
- Assigned Call Center agent:
  Callback access continues through callback time plus 48 hours.
- Assigned Developer:
  Access to an accepted opportunity continues while assigned and active.
- Correction requester:
  Access continues while their correction request is open.
- Closed deal with an active project:
  Visible to Developers while the project remains active, and for
  15 elapsed days after completion.
- All exceptions remain subject to the user’s role permissions.
- Archiving, rejection, reassignment, and exception resolution must
  recompute effective access consistently.
- Do not grant former assignees continuing access merely because they
  previously interacted with the record.

Enforcement:
- Apply one server-side policy across lists, search, detail pages,
  calendar, notifications, reports, exports, and API responses.
- Expired access must not leak through counts, previews, or cached results.

## D10. Hidden-record duplicate warnings and escalation

For a duplicate the employee cannot otherwise access, reveal only:
- “This business already exists.”
- Matched field type: phone or name.
- Business name and category.
- Creation date.

Do not reveal phone numbers, social links, notes, or assignee.

- Warning disclosure does not grant record access.
- Provide “Request Owner review” with an optional explanation.
- Requests are audited and do not automatically grant access.
- The Owner may resolve the duplicate, correct the data, or reassign
  through the existing audited workflow.
- General temporary-access grants are out of scope for v1.

## D11. Duplicate matching and branches

Phone:
- Normalize valid numbers to E.164.
- Exact matches against any business phone block creation.
- Company default country code requires confirmation.
- Do not normalize real data using an assumed country code.

Name:
- Normalize case, surrounding/repeated whitespace, and punctuation.
- Exact normalized name plus normalized branch blocks creation.
- Similar names use the proposed pg_trgm threshold of 0.6 as a warning,
  not a blocking rule.
- Similar-name suggestions must respect visibility restrictions.

Branches:
- Optional branch/location field.
- Same name with different branches is allowed.
- Same name with both branches absent is a duplicate.
- Shared phone numbers block across branches under this v1 policy.
- An Owner resolves legitimate shared-number cases; no silent bypass.

Integrity:
- Exclude the edited record from its own checks.
- Enforce exact uniqueness safely under concurrent requests.
- Detect existing collisions before applying constraints.
- Do not automatically merge or delete existing records.

## D12. Categories

- Owner creates, renames, and deactivates categories.
- Data Entry selects existing categories.
- Include an “Other” option and allow suggestions in notes.
- Categories are deactivated rather than deleted.
- Existing businesses retain their historical category association.
- Owner-only category management is the selected v1 policy.
- Any future delegation requires an explicit policy change, not merely
  a hidden configuration toggle.

## D13. Social metrics and ingestion

- Followers and last-post dates may be unknown.
- Unknown is distinct from zero and is displayed explicitly.
- Store when each metric was observed.
- Unknown values form a separate report/filter bucket and are excluded
  from averages.
- v1 stores the latest metric values and observation timestamps.
- Full metric history and trend charts are deferred.
- v1 supports manual entry and links for the currently supported social
  platforms.
- Automated social-platform ingestion is deferred; no scraping or
  third-party ingestion purchase is authorized.

## D14. Reopening rejected businesses

- Owner only.
- Mandatory reason.
- Restore the outcome to pending.
- Preserve call history and audit the change.
- Reopening alone does not silently assign the record.

## D15. Developer access

- Accepted opportunities:
  Assigned Developer and Owner only.
- Include contact details, relevant call notes, and client requirements
  needed for consultation.
- Verified closed deals with active projects:
  Visible to Developers under D9.
- Project visibility does not grant permission to alter financial
  verification or another employee’s attendance.
- Developers do not receive general business-directory browsing.

## D16. Commercial progression and financial governance

Stages:
accepted → meeting scheduled → proposal sent → signed →
payment pending verification → verified closed.

- Forward stages may be skipped.
- A non-closed opportunity may be marked lost with a reason.
- Developer may submit “payment received” for Owner verification.
- Only Owner verification makes the deal commercially closed.
- The Owner may record and verify closure directly.
- First payment received, including a deposit, satisfies this closure
  definition. It does not mean the full contract balance is settled.
- Required evidence: agreement reference and payment date.
- File attachments are optional in v1.
- Amount and currency are optional; require currency when an amount exists.
- Do not interpret missing financial values as zero.
- Owner controls verified financial changes.
- Preserve prior values and audit financial changes.
- Revenue reporting must distinguish contract amount, payments received,
  and missing values; do not treat them as interchangeable.

## D17. Deals and delivery projects

- Multiple deals over time are allowed per business.
- At most one active opportunity/deal at a time.
- Each verified closed deal has at most one delivery project.
- Create the project only after verified closure.
- Project creation must be idempotent.
- Project states:
  Not started → In progress → Completed.
- On hold is available from an active state.
- Cancellation requires an Owner reason and preserves history.
- Owner may reopen a completed project with a reason.
- Project completion does not imply full financial settlement.

## D18. Notifications

- All listed events appear in-app.
- Email is a secondary delivery channel.
- Follow-up digest: assigned agent, at scheduled shift start.
- Follow-up due: assigned agent, 15 minutes before.
- Follow-up overdue: assigned agent after 1 hour; Owner daily digest.
- Meeting reminders: assigned Developer and Call Center agent,
  24 hours and 1 hour before.
- Missing check-in: Owner at shift start + grace + 30 minutes,
  scheduled working days only.
- Missing checkout: employee at shift end + 1 hour;
  Owner in the next scheduled morning digest.
- Assignment/developer handoff: assignee immediately.
- Data correction request: responsible Data Entry employee and Owner.
- Attendance correction request: Owner.
- Delivery failure: Owner in-app; deduplicate repeated alerts.

Delivery:
- Background processing with bounded retries.
- Failed delivery never rolls back the saved business action.
- Respect current access when generating notification content.
- Distinguish queued, provider-accepted, delivered where confirmed,
  failed, and test-captured.
- Never log usable password/invitation tokens.
- Real email tests require separately approved recipients.

## D19. Backup and recovery objectives

Approved operational objectives:
- Nightly database backup plus continuous WAL archiving.
- Encrypted storage outside the application server.
- Retention: 14 daily, 8 weekly, 6 monthly recovery copies.
- Target RPO: no more than 15 minutes.
- Target RTO: no more than 4 hours.
- Restore drill before launch and at least quarterly thereafter.
- Monitor backup and WAL failures.
- Protect backup credentials separately from normal application access.
- Retain the base backups and WAL needed for advertised recovery points.

These are objectives until demonstrated by the deployed system.
If only nightly backups are implemented, report the weaker recovery
capability and obtain an explicit exception before launch.

Provider selection, spending, and infrastructure changes require separate
approval.

## D20. Archiving, deletion, and restoration

- No hard-delete actions through the normal application.
- Archive/deactivate businesses, employees, deals, and categories.
- This explicitly supersedes the earlier “Owner-only business deletion”
  requirement for ordinary application use.
- Preserve relationships and history.
- Deactivating an employee revokes active access and prevents new login.
- Call attempts, attendance events, and audit entries preserve originals;
  corrections are additive records.
- Owner may restore archived entities, subject to validation and duplicate
  checks.
- Do not restore old sessions, credentials, or MFA secrets automatically.
- Archived phones/names continue to participate in duplicate detection;
  the Owner can restore the original business instead.
- Privacy/legal erasure requests require a separate controlled procedure.
- This policy does not authorize indefinite retention of every data type.

## Fixed v1 scope

- Four roles: Owner, Data Entry, Call Center, Developer.
- No custom-role management.
- No break tracking.
- Synchronous streaming exports with bounded resource protection.
- Mandatory MFA baseline remains unchanged.
- Existing approved visual designs remain approved.

## Company inputs still required

Ask for these together, once:

1. Confirm or replace:
   Monday–Friday, 09:00, Asia/Beirut.
2. Initial holiday calendar, or confirmation that the Owner will enter it
   before attendance enforcement begins.
3. Office static-IP availability and approved public IP/CIDR values.
4. Default phone country code.
5. Initial numeric targets per role, or confirmation that targets remain
   unset until configured by the Owner.
6. DEC-004’s existing reservation proposal, only if it is still unapproved.

Infrastructure inputs, collected separately:
- Staging host and HTTPS domain.
- Email provider and sender identity.
- Approved real-email test recipient.
- Backup storage/provider.
- Secure provisioning of secrets; never paste secret values into chat.

## Completion criteria

Policy implementation is complete when:
- Canonical decisions and supersessions are recorded accurately.
- Implementation matches these choices.
- Relevant authorization and policy regression tests pass.
- Full end-to-end tests run against the final revision.
- Outstanding company inputs are clearly identified.

Production release additionally requires:
- Passing CI on the release revision.
- Staging verification.
- Successful real invitation/password setup/MFA/sign-in flow.
- Confirmed attendance configuration.
- Demonstrated backup restoration.
- Owner acceptance and separate deployment approval.
