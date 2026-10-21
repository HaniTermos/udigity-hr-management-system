# Phase 2 Batch 4 — Draft Mermaid source (NOT DRAWN)

Author: Agent 4. Baseline SB-2. Status: **DRAFT, repaired after review (RV4-01..06, see `repair-log.md`). Drawn on Board 02 sections 01, 08, 09 and 10 (see `verification.md`).** Specifications: `batch4-spec.md`.

Layout rules applied (SB-1 §7): `flowchart LR`; phase subgraphs (no role lanes); the actor is named inside each step; every decision edge is labelled; ≤ ~25 nodes per diagram (split into parts); dotted = retry or side effect; `[[...]]` = hand-off. State diagrams use `stateDiagram-v2` with no `note`, `classDef` or `style`.

As in Batch 1, colour lines are omitted from the source. Each diagram lists its **colour map** (node ids) per the SB-1 notation: Yellow = Unresolved/Proposed dependency; Orange = unselected alternatives; Red = failure; Green = success end; Blue = derived.

**Board send record (T4d).** Each flowchart was sent with `classDef`/`class`/`style` lines that follow its colour map (phase subgraphs tinted grey `#F5F5F5`, or light yellow/orange where the whole phase is policy-dependent). State diagrams were sent without styling. Small label changes made at send time:
- #1: `createRec` says "(E5)"; `alt2` adds "(R-12 → USER)".
- #2: `happened` reads "Developer, Owner or attending Call Center agent records outcome".
- #3: `denied` uses "x" instead of "×".
- #4: "§12" was sent as "s12" to keep the characters safe; `pending` adds "(F3)".
- #5: added the edge `openProj -->|"Owner updates"| action`; `action`, `sched` and `status` name "Developer or Owner" / "Actor".
- #17, #19, #21: simplified as shown below. Self-transitions and correction edges moved into the transition tables on the board.

| # | Diagram | Nodes | Status |
|---|---|---|---|
| 1 | WF-DEAL-001 Part 1 — Handoff and developer assignment | 22 | Draft |
| 2 | WF-DEAL-001 Part 2 — Meetings and discovery | 22 | Draft |
| 3 | WF-DEAL-002 Part 1 — Signature and payment | 20 | Draft |
| 4 | WF-DEAL-002 Part 2 — Closure and provisioning | 21 | Draft |
| 5 | WF-PROJ-001 Part 1 — Delivery list, assignment, schedule, status | 23 | Draft |
| 6 | WF-PROJ-001 Part 2 — Tasks and milestones | 18 | Draft |
| 7 | WF-AUTH-001 Part 1 — Login and Owner 2FA | 19 | Draft |
| 8 | WF-AUTH-001 Part 2 — Logout, expiry, revocation | 15 | Draft |
| 9 | WF-AUTH-002 Part 1 — Password reset | 22 | Draft |
| 10 | WF-AUTH-002 Part 2 — Owner 2FA enrollment and recovery | 16 | Draft |
| 11 | WF-EMP-001 Part 1 — Create, edit, role change | 22 | Draft |
| 12 | WF-EMP-001 Part 2 — Deactivation | 20 | Draft |
| 13 | WF-EMP-001 Part 3 — Self-profile update | 12 | Draft |
| 14 | WF-REPORT-001 Part 1 — Dashboard, filters, comparison | 20 | Draft |
| 15 | WF-REPORT-001 Part 2 — Export | 15 | Draft |
| 16 | WF-REPORT-002 — Audit log explorer | 15 | Draft |
| 17–22 | SM-COMMERCIAL-001, SM-MEETING-001, SM-PROJECT-001, SM-TASK-001, SM-ACCOUNT-001, SM-SESSION-001 | — | Draft |

---

## 1. WF-DEAL-001 Part 1 — Handoff and developer assignment
Colour map: Yellow `openDeal`, `multi`, `createRec`, `deferred`(also Blue), `notify`; Orange `access`, `alt1`, `alt2`, `existing`; Red `saveErr`; Blue `deferred`.
```mermaid
flowchart LR
    start(["Call Center agent finalizes Accepted in WF-CALL-003"])
    reopen(["Call Center agent or Owner opens deal record at any non-terminal stage to assign or reassign"])
    subgraph create ["Create accepted opportunity"]
        openDeal{"Business already has an open deal record? (DEC-017)"}
        multi{"Multiple concurrent deals allowed? (DEC-017, unresolved)"}
        existing(["Single only: existing deal record shown; no new record"])
        createRec["System creates deal record at Accepted opportunity in the same save as the outcome (proposed)"]
        saved{"Save result"}
        saveErr["Save failed: outcome and deal record unchanged"]
    end
    subgraph handoff ["Handoff context"]
        capture[/"Call Center agent captures client needs and service interest; call notes linked"/]
        contact["System shows business contact info subject to Access check (WF-ACCESS-001)"]
    end
    subgraph assign ["Developer assignment"]
        assignNow{"Call Center agent or Owner assigns a Developer now?"}
        deferred["Developer not yet assigned (derived), visible to Owner (E3, proposed)"]
        pickDev[/"Call Center agent or Owner selects Developer"/]
        devValid{"Active Developer?"}
        fixDev["Actor chooses another Developer"]
        saveAssign["System saves assignment with history; audit"]
        notify["System emits developer handoff event (timing unresolved)"]
        access{"Developer pre-closure access (DEC-005, unselected)"}
        alt1["Alt 1: assigned Developer gets scoping access"]
        alt2["Alt 2: Developer sees the deal only after closure"]
    end
    meet[["Meetings and discovery: WF-DEAL-001 Part 2"]]
    notifyWF[["Dispatch via WF-NOTIFY-001"]]
    start --> openDeal
    openDeal -->|"No"| createRec
    openDeal -->|"Yes"| multi
    multi -->|"Multiple allowed"| createRec
    multi -->|"Single only"| existing
    createRec --> saved
    saved -->|"Save failed"| saveErr
    saveErr -.->|"Retry"| createRec
    saved -->|"Save succeeded"| capture
    capture --> contact
    contact --> assignNow
    assignNow -->|"Deferred"| deferred
    assignNow -->|"Assign now"| pickDev
    reopen --> pickDev
    deferred -.->|"Assign later"| reopen
    deferred --> meet
    pickDev --> devValid
    devValid -->|"Invalid"| fixDev
    fixDev --> pickDev
    devValid -->|"Valid"| saveAssign
    saveAssign --> notify
    notify -.-> notifyWF
    saveAssign --> access
    access -->|"Alt 1"| alt1
    access -->|"Alt 2"| alt2
    alt1 --> meet
    alt2 --> meet
```

## 2. WF-DEAL-001 Part 2 — Meetings and discovery
Colour map: Yellow `start` (DEC-005), `valid`, `missed`; Red `denied`, `err`; Green `later`, `cancelled`; Blue `noMeet`.
```mermaid
flowchart LR
    start(["Call Center agent, Owner or Developer (DEC-005 Alt 1) opens accepted opportunity"])
    authz{"Access check (WF-ACCESS-001)"}
    denied(["Permission denied or record hidden by policy"])
    subgraph sched ["Schedule or reschedule"]
        arranged{"Meeting already Scheduled?"}
        noMeet["Meeting not yet arranged (derived): acceptance valid without a time"]
        later(["Opportunity stays valid without a meeting"])
        enter[/"Actor enters date, time, attendees and notes"/]
        valid{"Time not past and at least one attendee? (proposed)"}
        fix["Actor corrects meeting details"]
        saveMeet["System saves meeting as Scheduled; previous values kept on reschedule"]
        saved{"Save result"}
        err["Save failed or conflict: meeting unchanged"]
        remind["System emits upcoming-meeting reminder event"]
    end
    subgraph change ["Change a Scheduled meeting"]
        action{"Actor chooses action"}
        cancel["Actor cancels with reason; pending reminders cancelled"]
        cancelled(["Meeting Cancelled; a new meeting may be scheduled"])
    end
    subgraph outcome ["After the meeting time"]
        happened{"Developer or Owner records outcome"}
        missed["Meeting Missed (proposed)"]
        held["Developer records Held with discovery notes"]
        more{"Further discovery needed?"}
    end
    notifyWF[["Dispatch via WF-NOTIFY-001; a reminder failure never changes the meeting"]]
    deal2[["Commercial progression: WF-DEAL-002"]]
    start --> authz
    authz -->|"Denied"| denied
    authz -->|"Authorized"| arranged
    arranged -->|"No"| noMeet
    noMeet -->|"Schedule now"| enter
    noMeet -->|"Not now"| later
    arranged -->|"Yes"| action
    action -->|"Reschedule"| enter
    action -->|"Cancel"| cancel
    cancel --> cancelled
    action -->|"Record outcome"| happened
    enter --> valid
    valid -->|"Invalid"| fix
    fix --> valid
    valid -->|"Valid"| saveMeet
    saveMeet --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| saveMeet
    saved -->|"Save succeeded"| remind
    remind -.-> notifyWF
    happened -->|"Not held"| missed
    missed -.->|"Reschedule"| enter
    happened -->|"Held"| held
    held --> more
    more -->|"Yes"| enter
    more -->|"No"| deal2
```

## 3. WF-DEAL-002 Part 1 — Signature and payment
Colour map: Yellow `facts` subgraph title (stage names proposed), `payDef`, `noAttach`, `lost`, `lostDone`, `remove`; Red `denied`, `err`.
```mermaid
flowchart LR
    start(["Developer or Owner opens deal record"])
    authz{"Access check (WF-ACCESS-001) and role permitted?"}
    denied(["Permission denied: Data Entry always; Call Center unresolved; Developer under DEC-005 Alt 2: R-12 → USER (DEC-005 Alt 2 × DEC-006)"])
    subgraph facts ["Record commercial facts (stage names proposed, no DEC ID)"]
        which{"Actor records which fact?"}
        sig[/"Developer records signature date and agreement reference"/]
        pay[/"Developer records payment date and reference"/]
        payDef{"Counts as payment? Deposit rule (DEC-018)"}
        noAttach["No attachment required (DEC-018 unresolved)"]
        remove[/"Owner removes a fact entered in error, with reason (proposed)"/]
        saveFact["System saves; previous stage kept in history; audit"]
        saved{"Save result"}
        err["Save failed or conflict: stage unchanged"]
        both{"Which facts are now recorded?"}
        sigOnly["Stage: Signed (payment outstanding)"]
        payOnly["Stage: Paid (signature outstanding)"]
        backAcc["Stage: Accepted opportunity (only fact removed)"]
    end
    subgraph stop ["Not proceeding (proposed)"]
        lost[/"Owner or Developer records not proceeding with reason"/]
        lostDone(["Stage: Not proceeding; calling-outcome effect unresolved"])
    end
    ready["Stage: Signed and paid (awaiting closure)"]
    part2[["Closure and provisioning: WF-DEAL-002 Part 2"]]
    start --> authz
    authz -->|"Denied"| denied
    authz -->|"Authorized"| which
    which -->|"Signature"| sig
    which -->|"Payment"| pay
    which -->|"Remove fact"| remove
    which -->|"Not proceeding"| lost
    lost --> lostDone
    sig --> noAttach
    pay --> payDef
    payDef -->|"Does not count"| which
    payDef -->|"Counts"| noAttach
    noAttach --> saveFact
    remove --> saveFact
    saveFact --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| saveFact
    saved -->|"Save succeeded"| both
    both -->|"Signature only"| sigOnly
    both -->|"Payment only"| payOnly
    both -->|"Both"| ready
    both -->|"None"| backAcc
    backAcc -.->|"Record facts later"| which
    sigOnly -.->|"Record payment later"| which
    payOnly -.->|"Record signature later"| which
    ready --> part2
```

## 4. WF-DEAL-002 Part 2 — Closure and provisioning
Colour map: Orange `auth`, `altA`, `altB`, `mode`, `autoP`, `manual`; Yellow `review`, `ownerDec`; Red `reject`, `missing`, `err`, `pending`(also Blue); Blue `manual` text "(derived)", `pending`.
```mermaid
flowchart LR
    start(["Deal record at Signed and paid (awaiting closure)"])
    subgraph closure ["Closure authority (DEC-006, unselected)"]
        auth{"Which closure policy is adopted?"}
        altA[/"Alt A (drafted from ART-01 §12): Developer or Owner selects Finalize closure; Developer part R-12 → USER"/]
        altB[/"Alt B (drafted from ART-01 §12): Developer requests Owner verification"/]
        review["System raises Owner review item"]
        ownerDec{"Owner decision"}
        reject["Owner rejects with reason; stage unchanged"]
        ownerFin["Owner finalizes closure"]
    end
    subgraph finalize ["Finalize"]
        guard{"Accepted, signed and paid all recorded?"}
        missing["Blocked: missing fact named"]
        saveClose["System saves Closed deal with closer and time"]
        saved{"Save result"}
        err["Save failed: stays Signed and paid"]
        audit["System audits deal closed"]
    end
    subgraph prov ["Project provisioning (contract F2, unresolved)"]
        mode{"Which provisioning trigger is adopted?"}
        autoP["Alt Auto: System creates project board"]
        provOk{"Provisioning result"}
        pending["Project provisioning pending (derived); closure kept; Owner retries"]
        manual["Alt Manual: closed deal without project (derived) until Owner or Developer creates board"]
    end
    fix[["Correct facts via WF-DEAL-002 Part 1"]]
    proj[["Delivery: WF-PROJ-001"]]
    start --> auth
    auth -->|"Alt A"| altA
    auth -->|"Alt B"| altB
    altB --> review
    review --> ownerDec
    ownerDec -->|"Rejected"| reject
    reject -.-> fix
    ownerDec -->|"Verified"| ownerFin
    altA --> guard
    ownerFin --> guard
    guard -->|"No"| missing
    missing -.-> fix
    guard -->|"Yes"| saveClose
    saveClose --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| saveClose
    saved -->|"Save succeeded"| audit
    audit --> mode
    mode -->|"Alt Auto"| autoP
    autoP --> provOk
    provOk -->|"Failed"| pending
    pending -.->|"Retry"| autoP
    provOk -->|"Succeeded"| proj
    mode -->|"Alt Manual"| manual
    manual -->|"Board created"| proj
```

## 5. WF-PROJ-001 Part 1 — Delivery list, assignment, schedule, status
Colour map: Yellow `updPolicy`, `upd` subgraph title (DEC-019), `warn`; Red `rejectT`, `err`; Green `done`, `none`(neutral end); Blue `mark`.
```mermaid
flowchart LR
    start(["Developer or Owner opens delivery list"])
    filter["System filters each closed deal or project through Access check (WF-ACCESS-001)"]
    anyRows{"Any eligible rows?"}
    none(["Empty state: no eligible projects"])
    mark["System marks Assigned to me (derived)"]
    openProj["Developer or Owner opens a project"]
    subgraph who ["Assignment"]
        assigned{"Developer assigned to this project?"}
        updPolicy{"May an unassigned Developer update? (unresolved, no DEC ID)"}
        viewOnly(["View only"])
        ownerAssign[/"Owner assigns or reassigns Developer; history kept"/]
    end
    subgraph upd ["Schedule and status (statuses proposed, DEC-019)"]
        action{"Developer chooses update"}
        sched[/"Developer edits start, target delivery and milestone dates (delivery not before start)"/]
        status[/"Developer selects new project status"/]
        allowed{"Transition allowed? Non-linear; Completed is terminal"}
        reason{"Waiting or Blocked: note or reason given?"}
        rejectT["Transition rejected; status unchanged"]
        openTasks{"Delivered or Completed with open tasks?"}
        warn["Warning shown; not blocked (proposed)"]
        saveP["System saves with history; audit"]
        saved{"Save result"}
        err["Save failed or conflict: nothing changes"]
    end
    done(["Project updated"])
    tasks[["Tasks and milestones: WF-PROJ-001 Part 2"]]
    start --> filter
    filter --> anyRows
    anyRows -->|"No"| none
    anyRows -->|"Yes"| mark
    mark --> openProj
    openProj -->|"Owner assigns"| ownerAssign
    openProj -->|"Developer updates"| assigned
    assigned -->|"Yes"| action
    assigned -->|"No"| updPolicy
    updPolicy -->|"Allowed"| action
    updPolicy -->|"Not allowed"| viewOnly
    ownerAssign --> saveP
    action -->|"Schedule"| sched
    action -->|"Status"| status
    action -->|"Tasks"| tasks
    sched --> saveP
    status --> allowed
    allowed -->|"Not allowed"| rejectT
    allowed -->|"Allowed"| reason
    reason -->|"Missing"| status
    reason -->|"Given or not needed"| openTasks
    openTasks -->|"Yes"| warn
    openTasks -->|"No"| saveP
    warn --> saveP
    saveP --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| saveP
    saved -->|"Save succeeded"| done
```

## 6. WF-PROJ-001 Part 2 — Tasks and milestones
Colour map: Yellow `status` (task statuses proposed), `count` (DEC-020), `milestone`; Red `denied`, `rej`, `err`; Green `fin`.
```mermaid
flowchart LR
    start(["Developer or Owner opens project tasks"])
    authz{"Access check and project not Completed? (proposed)"}
    denied(["Permission denied, hidden, or read-only"])
    action{"Actor chooses task action"}
    subgraph edit ["Create and assign"]
        create[/"Developer creates task: title, owner, dates"/]
        valid{"Task valid?"}
        fix["Developer corrects task"]
        assignT[/"Developer or Owner sets task owner (active Developer)"/]
    end
    subgraph progress ["Status and milestones"]
        status[/"Task owner changes status: To do, In progress, Done, Cancelled (proposed)"/]
        allowedT{"Task transition allowed?"}
        rej["Rejected; task unchanged"]
        milestone[/"Developer marks milestone achieved (entity form open)"/]
    end
    subgraph savePh ["Save"]
        saveT["System saves with history; audit"]
        saved{"Save result"}
        err["Save failed: nothing changes"]
        isDone{"Task Done or milestone achieved?"}
        count["Counted for Developer target if adopted (DEC-020)"]
    end
    fin(["Task updated; project status unchanged"])
    start --> authz
    authz -->|"Denied"| denied
    authz -->|"Authorized"| action
    action -->|"Create"| create
    create --> valid
    valid -->|"Invalid"| fix
    fix --> valid
    valid -->|"Valid"| saveT
    action -->|"Assign owner"| assignT
    assignT --> saveT
    action -->|"Change status"| status
    status --> allowedT
    allowedT -->|"Not allowed"| rej
    allowedT -->|"Allowed"| saveT
    action -->|"Milestone"| milestone
    milestone --> saveT
    saveT --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| saveT
    saved -->|"Save succeeded"| isDone
    isDone -->|"Yes"| count
    isDone -->|"No"| fin
    count --> fin
```

## 7. WF-AUTH-001 Part 1 — Login and Owner 2FA
Colour map: Yellow `throttle`, `twofa` subgraph title (method = implementation decision), `pendEnroll`, `pendVerify` (scope: R-11 → USER, both readings shown); Red `generic`, `inactive`, `ended`; Green `ws`.
```mermaid
flowchart LR
    start(["Employee submits email and password"])
    subgraph cred ["Credential check"]
        credOk{"Credentials valid?"}
        throttle["System counts failed attempt (thresholds: implementation decision)"]
        generic(["Generic error: email or password incorrect; no session"])
        acctOk{"Account Active?"}
        inactive(["Generic denial; no session"])
    end
    role{"Role is Owner?"}
    subgraph twofa ["Owner second factor (method: implementation decision)"]
        enrolled{"Factor enrolled?"}
        pendEnroll["Session Pending 2FA enrollment: no admin access; other access R-11 → USER"]
        pendVerify["Session Pending 2FA verification: no admin access; other access R-11 → USER (R11-a none / R11-b allowed)"]
        lost{"Owner reports lost factor?"}
        submit[/"Owner submits second factor"/]
        factorOk{"Factor valid?"}
        limit{"Attempt threshold reached?"}
        ended(["Session Ended: attempt threshold reached"])
    end
    enroll[["Enroll via WF-AUTH-002 Part 2"]]
    recover[["Recover via WF-AUTH-002 Part 2"]]
    activeS["Session Active; System audits session created"]
    ws(["Role workspace shown"])
    start --> credOk
    credOk -->|"Invalid"| throttle
    throttle --> generic
    credOk -->|"Valid"| acctOk
    acctOk -->|"Deactivated"| inactive
    acctOk -->|"Active"| role
    role -->|"No"| activeS
    role -->|"Yes"| enrolled
    enrolled -->|"No"| pendEnroll
    pendEnroll --> enroll
    enrolled -->|"Yes"| pendVerify
    pendVerify --> lost
    lost -->|"Yes"| recover
    lost -->|"No"| submit
    submit --> factorOk
    factorOk -->|"Valid"| activeS
    factorOk -->|"Invalid"| limit
    limit -->|"No"| submit
    limit -->|"Yes"| ended
    activeS --> ws
```

## 8. WF-AUTH-001 Part 2 — Logout, expiry, revocation
Colour map: Yellow `t2` (durations = implementation decision), `t3` (role change Proposed); Red `retry`; Green `loginPage`, `expiredMsg` (neutral ends).
```mermaid
flowchart LR
    subgraph triggers ["Session end triggers"]
        t1(["Employee selects Logout"])
        t2(["System detects idle or absolute limit (durations: implementation decision)"])
        t3(["System or Owner revokes: deactivation, password reset, 2FA recovery, role change (proposed)"])
    end
    subgraph endPhase ["End session"]
        reasonD{"End reason"}
        logout["System invalidates this session server-side"]
        expire["System marks session expired"]
        revoke["System invalidates all sessions of the employee"]
        revOk{"Revocation completed?"}
        retry["System retries; every request re-checks account status"]
        acct["Account state unchanged by revocation"]
        record["Session Ended with end reason; audit"]
    end
    subgraph after ["Next request"]
        how{"How did the session end?"}
        expiredMsg(["Session expired notice; login page"])
        loginPage(["Login page"])
    end
    login[["Log in again via WF-AUTH-001 Part 1"]]
    t1 --> reasonD
    t2 --> reasonD
    t3 --> reasonD
    reasonD -->|"Logged out"| logout
    reasonD -->|"Expired"| expire
    reasonD -->|"Revoked"| revoke
    revoke --> revOk
    revOk -->|"Failed"| retry
    retry -.->|"Retry"| revoke
    revOk -->|"Completed"| acct
    acct --> record
    logout --> record
    expire --> record
    record --> how
    how -->|"Logged out"| loginPage
    how -->|"Expired or revoked"| expiredMsg
    loginPage --> login
    expiredMsg --> login
```

## 9. WF-AUTH-002 Part 1 — Password reset (self-service and Owner-triggered)
Colour map: Yellow `same`, `ownerDeact`, `token` (Proposed / implementation decision); Red `deniedO`, `failSeen`, `expired`, `err`; Green `login` hand-off.
```mermaid
flowchart LR
    subgraph entry ["Entry"]
        selfReq(["Employee selects Forgot password and enters email"])
        ownerReq(["Owner selects Send password reset on employee record"])
    end
    ownerAuth{"Owner with completed 2FA?"}
    deniedO(["Permission denied"])
    subgraph issue ["Issue reset link"]
        same["System shows the same confirmation whether or not the account exists (proposed)"]
        match{"Active account matches?"}
        noSend(["No email sent; nothing revealed"])
        acctActive{"Employee account Active?"}
        ownerDeact(["Owner told the account is deactivated; reset refused (proposed)"])
        token["System issues single-use, time-limited link (duration: implementation decision)"]
        email["System emails the link to the registered address"]
        delivery{"Delivery result"}
        failSeen["Delivery failed: retry; Owner sees failure for assisted resets"]
    end
    subgraph complete ["Complete reset"]
        openLink[/"Employee opens link"/]
        linkOk{"Link unused and unexpired?"}
        expired(["Link expired: request a new one"])
        newPw[/"Employee sets new password"/]
        policy{"Meets password policy?"}
        savePw["System saves password, invalidates link, revokes all sessions; audit"]
        saved{"Save result"}
        err["Save failed: password unchanged"]
    end
    login[["Log in via WF-AUTH-001; Owner still needs 2FA"]]
    selfReq --> same
    same --> match
    match -->|"No"| noSend
    match -->|"Yes"| token
    ownerReq --> ownerAuth
    ownerAuth -->|"Denied"| deniedO
    ownerAuth -->|"Authorized"| acctActive
    acctActive -->|"Deactivated"| ownerDeact
    acctActive -->|"Active"| token
    token --> email
    email --> delivery
    delivery -->|"Failed"| failSeen
    failSeen -.->|"Retry"| token
    delivery -->|"Sent"| openLink
    openLink --> linkOk
    linkOk -->|"Invalid"| expired
    linkOk -->|"Valid"| newPw
    newPw --> policy
    policy -->|"Invalid"| newPw
    policy -->|"Valid"| savePw
    savePw --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| savePw
    saved -->|"Save succeeded"| login
```

## 10. WF-AUTH-002 Part 2 — Owner 2FA enrollment (003A) and recovery (003B)
Colour map: Yellow `enrollPh` and `recoverPh` subgraph titles (method = implementation decision), `ops` (no DEC ID); Red `errE`, `recFail`, `endS`; Green `activeEnd`.
```mermaid
flowchart LR
    subgraph entry ["Entry"]
        e1(["Owner session Pending 2FA enrollment: first login or role changed to Owner"])
        r1(["Owner in Pending 2FA verification selects Lost second factor"])
    end
    subgraph enrollPh ["Enrollment 003A (method: implementation decision)"]
        present["System presents enrollment step"]
        confirmCode[/"Owner confirms with a code from the new factor"/]
        codeOk{"Code valid?"}
        limitE{"Attempt threshold reached?"}
        store["System stores factor and issues recovery material if the method has one; audit"]
        saved{"Save result"}
        errE["Save failed: no factor stored"]
    end
    subgraph recoverPh ["Recovery 003B (method: implementation decision)"]
        method[/"Owner completes the approved recovery method"/]
        recOk{"Recovery succeeded?"}
        resetF["System invalidates old factor and revokes other sessions; audit"]
        recFail["System audits failed recovery"]
    end
    activeEnd(["Session Active with admin access"])
    endS(["Session Ended"])
    ops["Documented operational recovery procedure (unresolved, no DEC ID)"]
    e1 --> present
    present --> confirmCode
    confirmCode --> codeOk
    codeOk -->|"Invalid"| limitE
    limitE -->|"No"| confirmCode
    limitE -->|"Yes"| endS
    codeOk -->|"Valid"| store
    store --> saved
    saved -->|"Save failed"| errE
    errE -.->|"Retry"| store
    saved -->|"Save succeeded"| activeEnd
    r1 --> method
    method --> recOk
    recOk -->|"Succeeded"| resetF
    resetF -->|"Re-enroll"| present
    recOk -->|"Failed"| recFail
    recFail --> endS
    recFail -.->|"Escalate"| ops
```

## 11. WF-EMP-001 Part 1 — Create, edit, role change
Colour map: Yellow `valid`, `guard`, `revoke`, `cred` (Proposed / implementation decision); Red `denied`, `blocked`, `err`; Green `doneAcct`; Blue `cred` text "(derived)".
```mermaid
flowchart LR
    start(["Owner opens employee directory"])
    authz{"Owner with completed 2FA?"}
    denied(["Permission denied"])
    action{"Owner chooses action"}
    subgraph createPh ["Create or edit"]
        enterC[/"Create: Owner enters name, email, photo, phone, department, job title, role"/]
        enterE[/"Edit: Owner edits profile fields; role and status excluded (role only via Change role)"/]
        valid{"Required fields, unique email, one role? (proposed)"}
        fix["Owner corrects fields"]
    end
    subgraph rolePh ["Role change"]
        newRole[/"Owner selects new role"/]
        guard{"Last active Owner or self-demotion? (proposed guard)"}
        blocked(["Blocked: role unchanged"])
        impact["System shows open items tied to old role; nothing reassigned automatically"]
    end
    subgraph savePh ["Save"]
        saveAcct["System saves account with change history; audit"]
        saved{"Save result"}
        err["Save failed or conflict: nothing changes"]
        postSave{"What was saved?"}
        cred["System starts credential setup; credentials not yet set (derived); Owner never sees password"]
        revoke["System revokes employee sessions (proposed; required for a change to Owner)"]
    end
    ownerRole{"Role is Owner?"}
    enroll[["Owner 2FA enrollment at next login: WF-AUTH-002 Part 2"]]
    doneAcct(["Account saved"])
    deact[["Deactivation: WF-EMP-001 Part 2"]]
    start --> authz
    authz -->|"Denied"| denied
    authz -->|"Authorized"| action
    action -->|"Create"| enterC
    action -->|"Edit profile"| enterE
    action -->|"Change role"| newRole
    action -->|"Deactivate"| deact
    enterC --> valid
    enterE --> valid
    valid -->|"Invalid"| fix
    fix --> valid
    valid -->|"Valid"| saveAcct
    newRole --> guard
    guard -->|"Yes"| blocked
    guard -->|"No"| impact
    impact --> saveAcct
    saveAcct --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| saveAcct
    saved -->|"Save succeeded"| postSave
    postSave -->|"New employee"| cred
    postSave -->|"Role changed"| revoke
    postSave -->|"Profile edit"| doneAcct
    cred --> ownerRole
    revoke --> ownerRole
    ownerRole -->|"Yes"| enroll
    ownerRole -->|"No"| doneAcct
```

## 12. WF-EMP-001 Part 2 — Deactivation
Colour map: Yellow `guard`, `suppress` (Proposed); Red `denied`, `blocked`, `err`, `retry`; Green `cancelled`(neutral); Blue `flag`.
```mermaid
flowchart LR
    start(["Owner selects Deactivate on employee record"])
    authz{"Owner with completed 2FA?"}
    denied(["Permission denied"])
    guard{"Self or last active Owner? (proposed guard)"}
    blocked(["Blocked: account stays Active"])
    subgraph review ["Open-items review"]
        list["System lists open items: calling assignments, follow-ups, reservation, deals and meetings, projects and tasks, open attendance session, correction requests"]
        confirmD{"Owner confirms deactivation?"}
        cancelled(["Cancelled: nothing changes"])
    end
    subgraph apply ["Apply"]
        saveD["System sets account Deactivated; history kept; audit"]
        saved{"Save result"}
        err["Save failed: account stays Active"]
        revoke["System revokes all sessions"]
        revOk{"Revocation completed?"}
        retry["System retries; every request re-checks account status"]
        flag["Open items stay attached, flagged assignee inactive (derived)"]
        suppress["Reminders to this user suppressed at send time (C6, proposed)"]
    end
    subgraph handle ["Owner handles items manually (no automatic reassignment)"]
        h1[["Calling items: WF-CALL-001, WF-FOLLOW-001, WF-CALL-002"]]
        h2[["Deals and meetings: WF-DEAL-001"]]
        h3[["Projects and tasks: WF-PROJ-001"]]
        h4[["Open attendance session: WF-ATT-003"]]
    end
    start --> authz
    authz -->|"Denied"| denied
    authz -->|"Authorized"| guard
    guard -->|"Yes"| blocked
    guard -->|"No"| list
    list --> confirmD
    confirmD -->|"No"| cancelled
    confirmD -->|"Yes"| saveD
    saveD --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| saveD
    saved -->|"Save succeeded"| revoke
    revoke --> revOk
    revOk -->|"Failed"| retry
    retry -.->|"Retry"| revoke
    revOk -->|"Completed"| flag
    flag --> suppress
    suppress --> h1
    suppress --> h2
    suppress --> h3
    suppress --> h4
```

## 13. WF-EMP-001 Part 3 — Self-profile update (UC-AUTH-007)
Colour map: Yellow `editP`, `locked` (field set Proposed, OQ-13); Red `denied`, `err`; Green `doneP`.
```mermaid
flowchart LR
    start(["Employee opens own profile"])
    authn{"Authenticated and Active?"}
    denied(["Redirect to login"])
    viewP["Employee views own profile"]
    locked["Name, email, department, job title, role and status are read-only (proposed)"]
    editP[/"Employee edits permitted fields: photo, phone (proposed)"/]
    valid{"Values valid?"}
    fix["Employee corrects values"]
    saveP["System saves with change history; audit"]
    saved{"Save result"}
    err["Save failed: profile unchanged"]
    doneP(["Profile updated"])
    start --> authn
    authn -->|"Denied"| denied
    authn -->|"Authorized"| viewP
    viewP -.-> locked
    viewP --> editP
    editP --> valid
    valid -->|"Invalid"| fix
    fix --> valid
    valid -->|"Valid"| saveP
    saveP --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| saveP
    saved -->|"Save succeeded"| doneP
```

## 14. WF-REPORT-001 Part 1 — Dashboard, filters, period comparison
Colour map: Yellow `defined`, `pendingP` (DEC-007/008/020/022), `stock`, `na`; Red `denied`, `wErr`; Blue `query` note (G1 separate metrics).
```mermaid
flowchart LR
    start(["Owner opens dashboard"])
    authz{"Owner with completed 2FA?"}
    denied(["Permission denied"])
    subgraph compute ["Compute metrics in company time"]
        period["System applies default period"]
        filt[/"Owner applies filters (availability per view)"/]
        fValid{"Filters valid?"}
        fFix["Owner corrects filters"]
        query["System computes each metric separately (G1: attempts vs businesses, accepted vs closed, closed vs completed, not checked in vs absent)"]
        qOk{"Metric query result"}
        wErr["Widget error with retry; other widgets render"]
        defined{"Metric definition approved? (DEC-007, DEC-008, DEC-020, DEC-022)"}
        pendingP["Shown as policy pending, not zero"]
        data{"Any data?"}
        empty["Empty state: no data for this period"]
        show["Metric shown"]
    end
    subgraph compare ["Period comparison"]
        cmp[/"Owner selects comparison period"/]
        stock{"Stock metric with no history for the past period?"}
        na["Comparison not available (proposed)"]
        diff["System shows both values and the difference"]
    end
    export[["Export: WF-REPORT-001 Part 2"]]
    start --> authz
    authz -->|"Denied"| denied
    authz -->|"Authorized"| period
    period --> query
    filt --> fValid
    fValid -->|"Invalid"| fFix
    fFix --> filt
    fValid -->|"Valid"| query
    query --> qOk
    qOk -->|"Failed"| wErr
    wErr -.->|"Retry"| query
    qOk -->|"Succeeded"| defined
    defined -->|"No"| pendingP
    defined -->|"Yes"| data
    data -->|"No data"| empty
    data -->|"Has data"| show
    show -->|"Refine"| filt
    show -->|"Compare"| cmp
    cmp --> stock
    stock -->|"Yes"| na
    stock -->|"No"| diff
    show -->|"Export"| export
```

## 15. WF-REPORT-001 Part 2 — Export (XLS / CSV / PDF)
Colour map: Yellow `emptyFile`, `gen` (delivery mode = Phase 3 choice); Red `denied`, `auditDenied`, `fail`, `auditFail`; Green `file`.
```mermaid
flowchart LR
    start(["Owner selects Export"])
    authz{"Owner with completed 2FA?"}
    denied["Permission denied"]
    auditDenied(["System audits export denied"])
    fmt[/"Owner selects Excel, CSV or PDF"/]
    subgraph build ["Build export"]
        sameF["System uses the same filters as the screen"]
        access["Rows pass Access check (WF-ACCESS-001); Owner gets full scope (C1)"]
        rows{"Any rows?"}
        emptyFile["File with filter summary and zero rows (proposed)"]
        gen["System generates file (immediate or background: Phase 3 choice)"]
        genOk{"Generation result"}
        fail["Error shown; no partial file delivered"]
        auditFail["System audits export failed"]
    end
    subgraph deliver ["Deliver"]
        auditOk["System audits report exported: format, filters, row count"]
        file(["Owner receives file"])
    end
    start --> authz
    authz -->|"Denied"| denied
    denied --> auditDenied
    authz -->|"Authorized"| fmt
    fmt --> sameF
    sameF --> access
    access --> rows
    rows -->|"No"| emptyFile
    rows -->|"Yes"| gen
    emptyFile --> gen
    gen --> genOk
    genOk -->|"Failed"| fail
    fail --> auditFail
    auditFail -.->|"Owner retries"| gen
    genOk -->|"Succeeded"| auditOk
    auditOk --> file
```

## 16. WF-REPORT-002 — Audit log explorer
Colour map: Yellow `auditD`, `modify` audit part (Proposed); Red `denied`, `err`, `modify`; Green `detail`.
```mermaid
flowchart LR
    start(["Owner opens audit log"])
    authz{"Owner with completed 2FA?"}
    denied["Permission denied"]
    auditD(["System audits audit-log access denied (proposed)"])
    subgraph search ["Search"]
        filt[/"Owner filters by date, actor, entity and event name"/]
        valid{"Filters valid?"}
        fix["Owner corrects filters"]
        query["System queries the append-only audit store; paged, time-ordered"]
        qOk{"Query result"}
        err["Error shown; retry"]
    end
    subgraph read ["Read"]
        anyE{"Any entries?"}
        empty(["Empty state: no matching entries"])
        listE["Owner sees entry list"]
        detail(["Owner views entry: actor, time, event, entity, previous and new values"])
        modify(["Any edit or delete attempt refused (G3); attempt audited (proposed)"])
    end
    start --> authz
    authz -->|"Denied"| denied
    denied --> auditD
    authz -->|"Authorized"| filt
    filt --> valid
    valid -->|"Invalid"| fix
    fix --> filt
    valid -->|"Valid"| query
    query --> qOk
    qOk -->|"Failed"| err
    err -.->|"Retry"| query
    qOk -->|"Succeeded"| anyE
    anyE -->|"None"| empty
    anyE -->|"Found"| listE
    listE --> detail
    listE -.->|"Modification attempt"| modify
```

---

## 17. SM-COMMERCIAL-001 (all states and transitions Proposed; no DEC ID)
```mermaid
stateDiagram-v2
    direction LR
    state "Accepted opportunity" as Accepted
    state "Signed (payment outstanding)" as Signed
    state "Paid (signature outstanding)" as Paid
    state "Signed and paid (awaiting closure)" as Ready
    state "Closed deal" as Closed
    state "Not proceeding (proposed)" as Lost
    [*] --> Accepted: Accepted outcome finalized (E5)
    Accepted --> Signed: signature recorded
    Accepted --> Paid: payment recorded (DEC-018)
    Signed --> Ready: payment recorded (DEC-018)
    Paid --> Ready: signature recorded
    Ready --> Closed: finalize closure (DEC-006, R-12 to USER)
    Accepted --> Lost: not proceeding
    Signed --> Lost: not proceeding
    Paid --> Lost: not proceeding
    Ready --> Lost: not proceeding
    Closed --> [*]
    Lost --> [*]
```

## 18. SM-MEETING-001 (states Proposed; "rescheduled" is an event)
```mermaid
stateDiagram-v2
    direction LR
    state "Scheduled" as Scheduled
    state "Held" as Held
    state "Cancelled" as Cancelled
    state "Missed (proposed)" as Missed
    [*] --> Scheduled: schedule meeting
    Scheduled --> Scheduled: reschedule (event, history kept)
    Scheduled --> Cancelled: cancel with reason
    Scheduled --> Held: record held
    Scheduled --> Missed: record missed
    Missed --> Scheduled: reschedule
    Held --> Held: discovery notes amended
    Held --> [*]
    Cancelled --> [*]
    Missed --> [*]
```

## 19. SM-PROJECT-001 (statuses Proposed, DEC-019; non-linear)
```mermaid
stateDiagram-v2
    direction LR
    state "Scheduled" as Scheduled
    state "In progress" as InProgress
    state "Waiting for client" as Waiting
    state "Blocked" as Blocked
    state "Delivered" as Delivered
    state "Completed" as Completed
    [*] --> Scheduled: project provisioned (F2)
    Scheduled --> InProgress: start work
    InProgress --> Scheduled: return to planning
    Scheduled --> Waiting: client dependency raised
    InProgress --> Waiting: client dependency raised
    Scheduled --> Blocked: blocker recorded
    InProgress --> Blocked: blocker recorded
    Waiting --> Blocked: blocker recorded
    Blocked --> Waiting: client dependency raised
    Waiting --> InProgress: resume
    Blocked --> InProgress: resume
    InProgress --> Delivered: record delivered
    Delivered --> InProgress: rework needed
    Delivered --> Completed: record completed
    Completed --> [*]
```

## 20. SM-TASK-001 (states Proposed; no DEC ID)
```mermaid
stateDiagram-v2
    direction LR
    state "To do" as ToDo
    state "In progress" as InProgress
    state "Done" as Done
    state "Cancelled" as Cancelled
    [*] --> ToDo: create task
    ToDo --> InProgress: start
    InProgress --> ToDo: pause
    ToDo --> Done: complete
    InProgress --> Done: complete
    Done --> InProgress: reopen (proposed)
    ToDo --> Cancelled: cancel
    InProgress --> Cancelled: cancel
    Done --> [*]
    Cancelled --> [*]
```

## 21. SM-ACCOUNT-001
```mermaid
stateDiagram-v2
    direction TB
    state "Active (self-events - profile edited, role changed)" as Active
    state "Deactivated (self-event - login attempt denied)" as Deactivated
    [*] --> Active: Owner creates employee
    Active --> Deactivated: Owner deactivates, sessions revoked
    Deactivated --> Active: Owner reactivates (proposed)
```

## 22. SM-SESSION-001
```mermaid
stateDiagram-v2
    direction LR
    state "Pending 2FA enrollment (restricted, scope R-11 → USER)" as PendEnroll
    state "Pending 2FA verification (restricted, scope R-11 → USER)" as PendVerify
    state "Active" as Active
    state "Ended" as Ended
    [*] --> Active: valid credentials, non-Owner
    [*] --> PendVerify: valid credentials, Owner with factor
    [*] --> PendEnroll: valid credentials, Owner without factor
    PendVerify --> PendVerify: invalid factor below threshold
    PendVerify --> Active: valid second factor
    PendVerify --> PendEnroll: recovery succeeded
    PendVerify --> Ended: threshold, timeout, logout or revocation
    PendEnroll --> Active: enrollment confirmed
    PendEnroll --> Ended: timeout, logout or revocation
    Active --> Active: activity renews idle timer
    Active --> Ended: logout, expiry or revocation
    Ended --> [*]
```
