<!--
Provenance: pasted verbatim by the user into the Claude Code session on 2026-10-20.
Authority: explicit user requirements (highest source tier). The document itself marks
several items as unresolved; those are NOT approved policies.
Version: unversioned in source; recorded here as "PD-2026-10-20".
-->

# Udigity Management System
## Complete Product Description

The **Udigity Management System** is an internal company platform that brings employee attendance, daily work management, business data collection, call-center sales operations, and software-project delivery into one connected workspace.

The system is designed initially for approximately five to six employees. It gives each employee a role-specific workspace while allowing the Owner/Admin to oversee the entire company’s operational activity.

Its purpose is to connect the full working process:

```text
Employee logs in and checks in
                ↓
Employee views assigned targets and work
                ↓
Data Entry creates and maintains business records
                ↓
Businesses are assigned to Call Center agents
                ↓
Agents contact businesses and manage follow-ups
                ↓
Interested businesses move to developer consultation
                ↓
Accepted, signed, and paid engagements become closed deals
                ↓
Developers manage the service project and delivery
                ↓
Employees check out and the owner reviews results
```

This description consolidates the requirements established so far. Where a business rule has not been finalized, it is identified explicitly rather than presented as an approved policy.

## 1. Product Purpose and Scope

Udigity Management System combines four main operational areas:

1. Employee attendance and daily performance.
2. Business information collection and maintenance.
3. Calling, sales qualification, and follow-up management.
4. Software-service project management and delivery.

The platform should help the company answer questions such as:

- Who checked in today?
- Who forgot to check out?
- What is each employee working on?
- How much progress has each employee made toward their target?
- How many businesses have been entered into the database?
- Which businesses require updated information?
- Which businesses should be called today?
- Which businesses did not answer?
- Which businesses requested another call?
- Which businesses rejected the service?
- Which opportunities have been accepted?
- Which deals are signed and paid?
- What meetings, projects, and delivery deadlines are upcoming?

### Product boundaries

The first release is an internal company tool, not a multi-tenant SaaS platform or public customer portal.

It does not initially include:

- Payroll calculation.
- A complete accounting system.
- Built-in telephony.
- Call recording.
- Automatic call-duration measurement.
- Automatic social-media data collection.
- Duplicate-business merging.

All core operational modules—attendance, data entry, calling, developer tracking, and owner reporting—belong in the initial release.

## 2. Users and Access Roles

The system has four application roles:

| Role | Main responsibility |
|---|---|
| Owner/Admin | Manage employees, oversee operations, assign work, and access all company information |
| Data Entry | Create and maintain business information |
| Call Center | Contact assigned businesses, record outcomes, and manage follow-ups |
| Developer | Manage relevant deals, technical meetings, development schedules, and delivery projects |

Each employee has one role. The Owner/Admin has full operational access, subject to security controls and audit logging.

Access must consider more than the role alone. Depending on the resource, it must also consider assignment, record visibility, and the final fifteen-day policy.

### 2.1 Owner/Admin

The Owner/Admin can:

- Create, edit, and deactivate employee accounts.
- Assign employee roles.
- Manage employee profiles.
- View company-wide attendance.
- Review missing check-ins and checkouts.
- Assign targets and work lists.
- View all businesses, including historical and hidden records.
- Create and edit business information.
- Assign businesses to Call Center agents.
- Assign relevant deals or projects to Developers.
- View call history, follow-ups, notes, and schedules.
- Manage commercial and development information.
- View company-wide dashboards and reports.
- Export authorized information.
- Review audit history.
- Manage company and security settings.

The precise deletion-versus-archiving behavior should be finalized before implementation. Full access should not silently translate into permanent deletion of operational history.

### 2.2 Data Entry

Data Entry employees can:

- Create businesses.
- Edit permitted business master data.
- Add and maintain phone numbers.
- Add social-media accounts and manual metrics.
- Record website information and notes.
- View duplicate warnings.
- Handle business-data correction requests.
- View their targets, work list, and attendance.

They cannot:

- Delete business records.
- Bypass duplicate blocking.
- Change commercial status.
- Access records outside their approved visibility scope.

Whether Data Entry employees may directly create categories remains to be finalized.

### 2.3 Call Center

Call Center employees can:

- View specifically assigned businesses.
- Read business contact information and social profiles.
- Record call attempts and notes.
- Update permitted calling and sales information.
- Schedule and manage follow-ups.
- Mark businesses as accepted, rejected, on hold, or needing another call.
- Flag incorrect business information.
- Assign relevant opportunities or deals to Developers.
- View their targets, work queue, calendar, and attendance.

They cannot directly edit business master data.

### 2.4 Developer

Developers can:

- View company-wide eligible closed deals, not only personally assigned ones.
- View relevant business phone numbers and notes.
- View and update schedules.
- Update development status.
- Update commercial status within the finalized transition rules.
- Work with project and task boards.
- Flag business information that requires correction.
- View their work list, targets, and attendance.

Access to accepted opportunities before commercial closure remains a specific permission decision. This must support the intended developer-meeting process without silently granting unrestricted business-directory access.

Company-wide visibility does not automatically mean permanent visibility; the final fifteen-day policy must define how it applies.

## 3. Employee Accounts and Authentication

The system begins with an email-and-password login page.

After successful authentication, employees enter a workspace appropriate to their role.

### Account management

The Owner/Admin manages employee accounts and profile information, including:

- Full name.
- Email address.
- Profile photo.
- Phone number.
- Department.
- Job title.
- Assigned role.
- Active or deactivated status.

Employee records remain associated with historical attendance, business creation, call activity, and project updates.

### Security and recovery

The platform includes:

- Mandatory two-factor authentication for the Owner/Admin.
- Password recovery by email.
- Owner-triggered password-reset assistance.
- Access revocation when an employee is deactivated.
- Role-based authorization.
- Audit records for relevant security events.

An Owner/Admin session must not receive administrative access until required second-factor verification is complete.

The exact second-factor method, recovery process, session durations, and security thresholds remain implementation decisions.

## 4. Attendance Management

Attendance records when an employee begins and ends work.

The confirmed workday duration is nine hours. Break tracking is not required.

### 4.1 Check-in

The employee opens the attendance panel and selects “Check In.”

The system:

1. Confirms that the employee is authenticated and active.
2. Checks that no previous attendance session remains open.
3. Performs office verification using the approved IP/location policy.
4. Records the check-in date and time.
5. Evaluates whether the arrival is late against the configured schedule.
6. Starts the active attendance session.
7. Displays the employee’s work list and target progress.

The attendance interface should show:

- Current check-in status.
- Check-in timestamp.
- Elapsed work duration.
- Progress toward the nine-hour requirement.
- Checkout action.
- Any attendance exception requiring attention.

### 4.2 Office restriction

Check-in and checkout are restricted by office IP/location.

The precise verification mode remains unresolved:

- Office IP only.
- Physical location only.
- Either approved IP or approved location.
- Both approved IP and approved location.

Remote login and remote attendance exceptions must be defined separately. Being able to log in should not automatically imply permission to record office attendance remotely.

### 4.3 Late-arrival detection

The system identifies late check-ins.

To make this operational, the company must configure:

- Working days.
- Shift start time.
- Shift end time or required duration rules.
- Company timezone.
- Any late-arrival grace period.

Nine hours alone does not establish when an employee is late.

### 4.4 Check-out

When work ends, the employee selects “Check Out.”

The system:

1. Identifies the employee’s open attendance session.
2. Performs the required office verification.
3. Collects a work summary if required by the final policy.
4. Records the checkout date and time.
5. Calculates the elapsed working duration.
6. Closes the attendance session.
7. Shows the completed-day summary.

A work summary may contain:

- Work completed.
- Target progress.
- Outstanding tasks.
- Blockers.
- Relevant end-of-day notes.

Whether the written summary is mandatory remains undecided.

### 4.5 Forgotten checkout and corrections

Employees cannot open a new attendance session while a previous one remains open.

The system therefore needs a controlled way to resolve forgotten checkouts or incorrect timestamps.

The correction process remains to be finalized:

- Owner-only manual adjustment, or
- Employee request followed by Owner review.

Original information and subsequent adjustments should remain distinguishable in the audit history.

Failed checkout verification also requires a selected policy: block the checkout, record it provisionally, or place it into a pending-review state.

## 5. Daily Targets and Work Lists

The Owner/Admin assigns employee targets.

Targets should reflect the employee’s actual role, for example:

| Role | Possible target measures, subject to approval |
|---|---|
| Data Entry | Businesses created or records updated |
| Call Center | Call attempts, distinct businesses contacted, or qualified opportunities |
| Developer | Completed tasks or delivery milestones |

The exact counting rules remain unresolved.

### Work-list management

The platform supports:

- Manual assignment.
- Automatic work-list generation.
- Employee-specific queues.
- Due dates and priorities where applicable.
- Progress tracking.
- Completion history.

The automatic allocation rules must be defined before implementation. Possible approaches include workload balancing, priority-based allocation, or round-robin assignment, but none is selected yet.

Employees should see:

- Assigned target.
- Completed work.
- Remaining work.
- Due or overdue items.
- Relevant business or project links.

## 6. Business Database

The business database is the shared operational foundation for data collection, calling, sales, and service delivery.

A business record represents a company being researched, contacted, or served.

### 6.1 Business information

Each record includes:

| Field | Description |
|---|---|
| Business name | Name of the company |
| Category | Dynamic business classification |
| Phone numbers | Multiple contact numbers |
| Social-media accounts | At least one account, with more added when available |
| Followers count | Manual metric for each social account |
| Last-post date | Manual date for each social account |
| Has website | Checkbox indicating website availability |
| Website URL | Link when a website exists |
| Extra notes | Additional business information |
| Created by | Employee who created the record |
| Created at | Creation date and time |
| Last updated by | Most recent editor |
| Last updated at | Most recent update date and time |
| Edit history | Record of relevant changes |

Categories can include salons, gyms, shops, real-estate businesses, and other industries.

Categories are dynamic rather than permanently hard-coded.

### 6.2 Social-media information

Supported accounts include:

- Instagram.
- TikTok.
- Facebook.
- Other configured platforms.

At least one social-media account is required when creating a business.

Follower counts and last-post dates are entered manually in the first release. Automatic collection is a future enhancement.

Unknown values need an explicit handling rule; they should not silently become fabricated numbers or dates.

### 6.3 Business editing

Data Entry and Owner/Admin can maintain business master data within their access scope.

Call Center and Developer users request corrections instead of directly changing master fields.

Relevant edits preserve:

- Who changed the information.
- When the change occurred.
- What changed.
- Previous and new values where appropriate.

## 7. Duplicate Detection

The system checks for duplicates using phone numbers and business names.

Duplicate checks cover the entire stored business database, including records hidden from the employee by the fifteen-day policy.

### Required behavior

When a duplicate is detected:

1. The system blocks duplicate creation.
2. It displays an “already exists” warning.
3. It identifies or previews the matching record according to approved permissions.
4. The employee cannot bypass the block.

Duplicate merging is outside the initial release.

### Editing and concurrent changes

Duplicate validation must also apply when relevant phone numbers or names are edited.

The business being edited must not match itself.

The precise rules still need to distinguish:

- Matching normalized phone numbers.
- Exact business-name matches.
- Similar business names.
- Different branches of the same company.

The exact information revealed for a hidden duplicate remains a visibility-policy decision.

## 8. Fifteen-Day Record Visibility

Business/customer information becomes hidden from non-owner roles after fifteen days.

The Owner/Admin retains access.

This rule changes access; it does not necessarily delete or archive the record.

### Confirmed principles

- Hidden records remain stored.
- Duplicate detection still checks them.
- Owner/Admin can access them.
- Duplicate warnings can reveal matching information within the approved exception.
- Access restrictions apply beyond the visible list interface.

### Decisions still required

The company must decide:

- Whether the timer starts at creation, assignment, or another event.
- Whether authorized customer interactions reset the timer.
- Whether accepted opportunities remain accessible.
- Whether closed deals remain accessible.
- Whether active projects remain accessible.
- Whether scheduled follow-ups remain accessible.
- Whether open correction requests remain accessible.
- How much hidden-record information a duplicate warning reveals.
- Whether temporary access can be requested.

These decisions must apply consistently to lists, search, record details, calendars, projects, notifications, and exports.

## 9. Call-Center Operations

Each Call Center agent receives specifically assigned businesses.

The calling workspace combines business details, contact history, current status, notes, and upcoming follow-ups.

### 9.1 Calling queue

The agent should be able to identify:

- New assignments.
- Businesses requiring contact.
- Callbacks due today.
- Overdue follow-ups.
- Previous outcomes.
- Businesses requiring data correction.
- Rejected records that must not be called.

Assignments and reassignments must preserve history and account for existing follow-ups and active contact activity.

### 9.2 Contact reservation

The system must prevent conflicting simultaneous contact through its workflow.

A proposed “Start Contact” action reserves the business while an agent handles the interaction.

The reservation design should account for:

- Acquisition conflicts.
- Explicit release.
- Renewal.
- Expiration.
- Network interruption.
- Reassignment.
- Authorized override.
- Unsaved notes.

The duration and override rules remain undecided.

Because the first release has no telephony integration, this control coordinates work inside the application; it does not physically control calls placed outside it.

### 9.3 Call history

Each contact attempt is recorded separately with information such as:

- Business.
- Agent.
- Attempt timestamp.
- Outcome.
- Notes.
- Related follow-up.

Additional mandatory fields should be approved before being enforced.

Past call attempts should remain distinguishable from the business’s current status.

### 9.4 Calling outcomes

| Outcome | Meaning |
|---|---|
| Pending | Business has not yet reached a resolved contact or sales outcome |
| On hold | Business did not answer |
| Needs another call | Client asked to be contacted later |
| Rejected | Do not call again |
| Accepted | Business agrees to proceed toward the next sales/technical stage |

These meanings must remain distinct.

A business does not need to pass through every outcome in sequence. It may accept or reject on the first conversation.

### 9.5 Rejected businesses

Rejected businesses show a clear do-not-call state and are excluded from normal calling activity.

Reopening authority remains unresolved. Any permitted reopening should record the reason and responsible user.

## 10. Follow-Ups and Calendar

Call Center agents can schedule future contact.

A follow-up includes:

- Related business.
- Responsible agent.
- Scheduled date and time.
- Notes or purpose.
- Completion or cancellation information.
- Rescheduling history where applicable.

Follow-ups appear in:

- The agent’s dashboard.
- Their calling queue.
- A calendar view.
- Relevant owner overviews.

Email reminders are required.

Reminder timing and escalation rules remain to be selected.

The follow-up and the reminder are separate: an email-delivery failure must not erase the saved callback commitment.

## 11. Accepted Opportunities and Developer Meetings

An accepted opportunity is an interested business proceeding toward a developer consultation and service discussion.

It is not automatically a closed deal.

The handoff should capture relevant context such as:

- Business contact information.
- Client needs.
- Service interest.
- Previous call notes.
- Assigned developer.
- Meeting arrangements when available.

Call Center or Owner/Admin can assign the Developer.

Meeting scheduling and rescheduling should preserve the relevant date, time, attendees, and notes.

Developer access before closure remains a permission decision. Acceptance should not automatically require a finalized meeting time unless the company approves that rule.

## 12. Commercial Deals

A closed deal means the business has:

1. Accepted the service.
2. Signed the agreement.
3. Paid.

The system must distinguish commercial closure from project completion.

### Commercial information

Depending on the final scope, a deal may include:

- Service description.
- Client requirements.
- Current stage.
- Responsible employees.
- Meeting history.
- Agreement reference.
- Payment confirmation.
- Notes.
- Related project.

The following remain undecided:

- Whether deposits count as payment for closure.
- Whether monetary values and currencies are stored.
- Whether agreement/payment attachments are required.
- Whether Developers can finalize closure directly or require Owner verification.
- Whether one business can have multiple concurrent deals.

Developers can update commercial status, but exact transition and evidence rules must be finalized.

## 13. Developer Projects and Service Delivery

Relevant deals have project/task boards for software-service delivery.

Services can include:

- Websites.
- Applications.
- Other software-engineering services.

### Project workspace

The workspace should bring together:

- Business and deal context.
- Assigned Developer.
- Service scope.
- Schedule.
- Development status.
- Tasks and milestones.
- Notes.
- Client dependencies.
- Activity history.

Developers can view all eligible company-wide closed deals while distinguishing their assigned work.

### Proposed development statuses

The proposed statuses are:

- Scheduled.
- In progress.
- Waiting for client.
- Blocked.
- Delivered.
- Completed.

These remain subject to approval and should not form a compulsory linear sequence.

### Tasks

Project tasks support the agreed delivery workflow, including ownership, status, dates, and completion tracking.

Task status and project status should remain distinct.

Creating a project board automatically at closure is a design proposal; the exact provisioning behavior should be confirmed.

## 14. Business-Data Correction Requests

Call Center, Developer, and Owner/Admin can flag business information requiring updates.

Examples:

- Incorrect phone number.
- Outdated social link.
- Wrong category.
- Missing website information.
- Business no longer operating.
- Other inaccurate data.

A correction request should identify:

- Business.
- Requesting user.
- Incorrect field or issue.
- Explanation.
- Suggested replacement information, when known.
- Request status.
- Resolution details.

Data Entry or Owner/Admin processes the request, verifies information, applies permitted changes, and records the result.

The detailed request states and assignment rules remain proposed.

Correction actions should be available from normal authorized business workspaces, not only rejected-business screens.

## 15. Owner Dashboard and Reporting

The owner dashboard provides a company-wide operational overview.

### Business and sales metrics

- Total businesses.
- Businesses added during a period.
- Pending businesses.
- On-hold businesses.
- Callback requests.
- Accepted opportunities.
- Rejected businesses.
- Closed deals.
- Businesses needing corrections.

### Employee and activity metrics

- Employees checked in.
- Employees checked out.
- Missing check-ins.
- Missing checkouts.
- Late arrivals.
- Recorded working hours.
- Assigned targets.
- Target completion.
- Call attempts.
- Businesses contacted.
- Development workload.

### Reporting rules

The dashboard must not confuse:

- Call attempts with distinct businesses contacted.
- Accepted opportunities with closed deals.
- Closed deals with completed projects.
- Not currently checked in with absence on a scheduled working day.

Revenue reporting is not a confirmed requirement until financial data fields are approved.

### Filters

Relevant views should support filters such as:

- Date range.
- Employee.
- Role.
- Category.
- Business name.
- Phone number.
- Assigned agent.
- Creator.
- Calling outcome.
- Commercial stage.
- Follow-up date.
- Project status.
- Website availability.
- Social metrics.
- Correction status.

Final filter availability depends on the screen and role.

### Exports

Owner reporting includes:

- Excel.
- CSV.
- PDF.

Exports should reflect selected filters and authorized scope.

## 16. Notifications and Alerts

The system supports email reminders and owner operational alerts.

Relevant events include:

- Follow-up due or overdue.
- Upcoming meeting.
- Missing check-in.
- Missing checkout.
- New assignment.
- Developer handoff.
- Data-correction request.
- Attendance correction awaiting review.
- Notification-delivery failure.

Exact timing, recipients, in-app presentation, and escalation rules remain to be finalized.

## 17. Audit History and Security

The system records important changes and security events.

Audit coverage includes relevant actions such as:

- Account and role changes.
- Employee deactivation.
- Attendance corrections.
- Business edits.
- Assignment changes.
- Calling outcomes.
- Commercial-status changes.
- Development schedule changes.
- Reservation overrides.
- Report exports.

Audit history should preserve attribution without allowing normal users to rewrite operational history.

Owner full access does not imply access to employees’ existing passwords.

The system also requires backups and a documented recovery approach. Backup retention, storage destination, and recovery targets remain operational decisions.

## 18. User Experience and Brand Direction

The interface is English, responsive, and available in both light and dark themes.

The intended visual direction combines:

- Udigity’s navy, turquoise, and white identity.
- Clear left-side navigation on desktop.
- Structured cards and tables.
- Charts supporting operational decisions.
- Readable status labels.
- Focused mobile workflows.
- Consistent forms, calendars, drawers, and dialogs.

Each role should see the actions most relevant to its work rather than the same overloaded dashboard.

Important states include:

- Loading.
- Empty.
- Validation error.
- Permission denied.
- Duplicate blocked.
- Record hidden by policy.
- Contact reserved by another agent.
- Verification failure.
- Session expired.
- Save conflict.
- Successful completion.

## 19. Technical Direction

The agreed technology direction is:

| Layer | Direction |
|---|---|
| Frontend | React/Next.js |
| Backend | Node.js and Express |
| Database | PostgreSQL |
| Backend architecture | Monolith, organized into domain modules |
| Deployment | Docker on a VPS |
| Authentication | Email/password with Owner 2FA |
| Messaging | Email integration for resets and reminders |
| Operations | Audit logging, backups, and recovery procedures |

Suggested internal modules are:

- Identity and access.
- Employee management.
- Attendance.
- Targets and work allocation.
- Business records.
- Duplicate detection.
- Data corrections.
- Calling assignments.
- Contact reservations.
- Calls and follow-ups.
- Commercial deals.
- Projects and tasks.
- Notifications.
- Reports and exports.
- Audit and administration.

Specific session storage, background-worker deployment, attachment storage, and infrastructure components remain architecture choices rather than finalized business requirements.

## 20. Outstanding Decisions Before Implementation

The overall product is defined, but the following policies still need final answers:

| Area | Decision required |
|---|---|
| Attendance schedule | Working days, start time, timezone, grace period |
| Office verification | IP-only, location-only, OR, or AND |
| Remote access | Login/work permission versus attendance exceptions |
| Attendance corrections | Owner-only edits or employee-request workflow |
| Failed checkout | Block, provisional record, or pending approval |
| Work summaries | Mandatory or optional |
| Targets | Metrics and counting rules for each role |
| Automatic allocation | Distribution and priority rules |
| Fifteen-day access | Timer origin, resets, and active-work exceptions |
| Hidden duplicates | Information revealed and duration of access |
| Duplicate matching | Exact names, similar names, and business branches |
| Categories | Which roles may create or manage them |
| Social metrics | Handling unknown values |
| Rejected records | Reopening authority |
| Developer scoping | Access before commercial closure |
| Deal closure | Authority, payment definition, and evidence |
| Business relationships | Single or multiple deals/projects per business |
| Notifications | Timing, recipients, and escalation |
| Recovery operations | Backup retention and recovery objectives |

These decisions refine the system’s rules; they do not change its central purpose: one internal platform connecting employees, business information, outreach, sales, and software-service delivery.
