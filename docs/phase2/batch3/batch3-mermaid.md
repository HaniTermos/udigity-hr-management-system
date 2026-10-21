# Phase 2 Batch 3 — Mermaid source (DRAFT, repaired after review)

- **Status:** DRAFT by Agent 3. Repaired for RV3-01..11 (`repair-log.md`). Not approved. **Baseline: SB-2.**
- **Spec:** `batch3-spec.md` (same folder). Each diagram's header names its spec section.
- **Board:** this is the source sent to `generate_diagram` for Board 02 sections 06 (`65:3584`) and 07 (`65:3587`). Node IDs and inspection results are in `verification.md`. Any drawing-time change is listed there.
- **Layout rules applied (SB-2 §7):**
  - `flowchart LR` with phase subgraphs, not role swimlanes, and the actor named inside each step.
  - Every decision edge is labelled.
  - At most 25 nodes per diagram.
  - Colours come from `classDef` in flowcharts only, as in Batch 2.
  - State diagrams use `stateDiagram-v2` with no `note`, no `classDef` and no `style`.
  - No semicolons in labels or subgraph titles (the `generate_diagram` parser rejected them in Batch 2).
  - No node ID equals a classDef name.
- **Colour classes (SB-2 notation):**
  - `dec` yellow: Unresolved/Proposed dependency.
  - `alt` orange: unselected alternative.
  - `fail` red: failure or denial.
  - `ok` green: success end.
  - `derived` blue: derived classification.
  - Dotted edges mean retry or side effect. `[[...]]` means hand-off.
  - Drafted alternatives not on Board 01 are marked "no DEC ID".

---

## WF-CALL-001 Part 1 — Assignment and reassignment (spec §2.1)
Nodes: 25.
```mermaid
flowchart LR
    start(["Owner selects businesses and target agent"])
    wwStart[["WF-WORK-001 hand-off: new assignment or reassignment (B8)"]]
    b7Start(["Owner decides on assigned-but-inaccessible item (B7, from Part 2)"])
    autoStart(["System proposes allocation (DEC-021, proposed), Owner reviews"])
    authz{"Owner with completed 2FA and Access check passed (WF-ACCESS-001)?"}
    denied(["Permission denied"])
    subgraph elig ["Eligibility (contract B)"]
        bizOk{"Business eligible? Not Rejected, phone (proposed), not archived (C-01), open deal (DEC-017)"}
        excluded["System excludes item and shows reason"]
        agentOk{"Assignee is an active Call Center agent?"}
        fixAgent["Owner picks another agent"]
    end
    current{"Business currently assigned?"}
    subgraph reassign ["Reassignment impact (UC-CALL-008)"]
        impact["System shows open follow-ups and active reservation"]
        resv{"Active contact reservation?"}
        resvChoice{"Owner choice"}
        wait(["Not saved: Owner waits for release or expiry"])
        override[["Owner override via WF-CALL-002 (proposed)"]]
        fuExist{"Open follow-ups?"}
        fuApply["Owner chooses per follow-up: transfer, cancel (D2 marker if last), or keep (orphaned unless a guard exception is adopted) - policy-dependent, no DEC ID"]
        reason[/"Owner enters reassignment reason (proposed)"/]
    end
    subgraph savePhase ["Save (only WF-CALL-001 writes assignments, B8)"]
        save["System saves assignment row (source manual, work list or automatic), ends previous row, outcome unchanged"]
        saved{"Save result"}
        err["Save failed or conflict: nothing changed"]
        audit["System records calling_assignment event"]
        notify[["Notify assignee via WF-NOTIFY-001 (timing unresolved)"]]
    end
    done(["Business appears in agent queue (Part 2)"])
    start --> authz
    wwStart --> authz
    b7Start --> authz
    autoStart --> authz
    authz -->|"Denied"| denied
    authz -->|"Authorized"| bizOk
    bizOk -->|"Not eligible"| excluded
    excluded -->|"Owner adjusts selection"| start
    bizOk -->|"Eligible"| agentOk
    agentOk -->|"No"| fixAgent
    fixAgent --> agentOk
    agentOk -->|"Yes"| current
    current -->|"No: unassigned"| save
    current -->|"Yes: reassignment"| impact
    impact --> resv
    resv -->|"Yes"| resvChoice
    resvChoice -->|"Wait"| wait
    resvChoice -->|"Override"| override
    override --> fuExist
    resv -->|"No"| fuExist
    fuExist -->|"Yes"| fuApply
    fuExist -->|"No"| reason
    fuApply --> reason
    reason --> save
    save --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| save
    saved -->|"Save succeeded"| audit
    audit --> notify
    notify --> done
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class autoStart,bizOk,fuApply,reason,b7Start dec
    class denied,excluded,err,wait fail
    class done ok
```

## WF-CALL-001 Part 2 — Calling queue access and B7 Owner decision (spec §2.1)
Nodes: 21.
```mermaid
flowchart LR
    start(["Call Center agent opens calling queue (no check-in required, A1)"])
    ownerStart(["Owner opens queue overview for any agent (C1, R-01)"])
    authOk{"Authenticated and active?"}
    denied(["Redirect to login or account inactive"])
    subgraph load ["Load assigned businesses"]
        list["System lists businesses assigned to the agent"]
        access[["Access check per business (WF-ACCESS-001)"]]
        visible{"Access granted for the agent?"}
        omit["System omits business for the agent: record hidden by policy"]
    end
    empty(["Empty state: no assigned businesses"])
    subgraph b7 ["Assigned but inaccessible (B7, R-02)"]
        b7cls["Owner sees: assigned but inaccessible (derived)"]
        ownerDec{"Owner decision (no automatic reassignment)"}
        toPart1[["Reassign or unassign via WF-CALL-001 Part 1 (B8)"]]
        keep(["Assignment kept as is, decision audited"])
    end
    subgraph buckets ["Queue buckets (derived)"]
        classify["System derives buckets per business, one business may be in several"]
        bContact["New assignments, requires contact: Pending, On hold (derived)"]
        bFollow["Callback to be scheduled (not Rejected), due today, overdue (derived)"]
        bFlag["Data correction requested flag (derived, B5)"]
        bRej["Rejected: do not call, view only (derived)"]
    end
    pick["Agent opens business: details, history, outcome, notes, follow-ups"]
    dnc[["Do-not-call view (WF-REJECT-001)"]]
    contact[["Agent selects Start Contact (WF-CALL-002)"]]
    start --> authOk
    ownerStart --> authOk
    authOk -->|"Denied"| denied
    authOk -->|"Authorized"| list
    list -->|"None assigned"| empty
    list -->|"Businesses found"| access
    access --> visible
    visible -->|"Denied"| omit
    omit -.->|"Assignee denied"| b7cls
    b7cls --> ownerDec
    ownerDec -->|"Reassign or unassign"| toPart1
    ownerDec -->|"Keep as is"| keep
    visible -->|"Granted"| classify
    classify --> bContact
    classify --> bFollow
    classify --> bFlag
    classify --> bRej
    bContact --> pick
    bFollow --> pick
    bFlag --> pick
    bRej --> dnc
    pick --> contact
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class ownerDec dec
    class denied,omit fail
    class b7cls,classify,bContact,bFollow,bFlag,bRej derived
    class keep ok
```

## WF-CALL-002 Part 1 — Start Contact: acquire, collision, renew (spec §2.2)
Nodes: 24.
```mermaid
flowchart LR
    start(["Agent or Owner selects Start Contact"])
    subgraph guards ["Guards"]
        access[["Access check (WF-ACCESS-001, B7)"]]
        accessOk{"Access granted?"}
        rejected{"Outcome Rejected?"}
        accChk{"Outcome Accepted? Contact after Accepted is policy-dependent (B3-Q12, DEC-017)"}
        assignee{"Actor is current assignee or Owner?"}
    end
    denied(["Permission denied or record hidden by policy"])
    b7flag["Assigned but inaccessible item for Owner (derived, B7)"]
    dnc(["Do not call: contact blocked (WF-REJECT-001)"])
    accBlock(["Contact not offered: deal handled in WF-DEAL-001"])
    subgraph acquire ["Acquire (DEC-004, proposed)"]
        check{"Active reservation on this business?"}
        holder{"Held by this user?"}
        create["System creates Active reservation, lease per DEC-004"]
        reuse["System returns existing reservation (same user, proposed)"]
        created{"Save result"}
        createErr["Acquire failed: no reservation"]
    end
    subgraph collide ["Collision"]
        busy["System shows: Contact reserved by another agent, with holder and since"]
        busyChoice{"Who is asking?"}
        back(["Agent returns to queue and retries later"])
        override[["Owner override (WF-CALL-002 Part 2, proposed)"]]
    end
    subgraph work ["Reserved workspace"]
        ws["Agent calls outside the app, workspace shows reserved by you"]
        renew["Client renews lease while workspace is open (self-transition), each renewal re-runs Access check"]
        tab["Agent switches tab or window: no release (idle rule DEC-004)"]
        log[["Agent logs attempt and outcome (WF-CALL-003)"]]
    end
    start --> access
    access --> accessOk
    accessOk -->|"Denied"| denied
    denied -.->|"If actor is the assignee"| b7flag
    accessOk -->|"Granted"| rejected
    rejected -->|"Rejected"| dnc
    rejected -->|"Not rejected"| accChk
    accChk -->|"Not Accepted, or Accepted and policy allows"| assignee
    accChk -->|"Accepted and policy forbids"| accBlock
    assignee -->|"No"| denied
    assignee -->|"Yes"| check
    check -->|"None"| create
    check -->|"Active"| holder
    holder -->|"Yes"| reuse
    holder -->|"No: another user"| busy
    create --> created
    created -->|"Save failed"| createErr
    createErr -.->|"Retry"| check
    created -->|"Save succeeded"| ws
    reuse --> ws
    busy --> busyChoice
    busyChoice -->|"Agent"| back
    busyChoice -->|"Owner chooses override"| override
    ws -.->|"Periodic renewal"| renew
    renew -.-> ws
    renew -.->|"Access denied on renewal: Expired at lease end"| b7flag
    ws -.->|"Tab switch"| tab
    tab -.-> ws
    ws --> log
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class accChk,create,reuse,tab,accBlock dec
    class denied,dnc,createErr,busy fail
    class b7flag derived
```

## WF-CALL-002 Part 2 — Release, expiry, network loss, stale client, override (spec §2.2)
Nodes: 24.
```mermaid
flowchart LR
    active(["Active reservation held by agent"])
    subgraph release ["Explicit release"]
        saveDone["WF-CALL-003 save succeeded"]
        cancel["Agent selects Cancel contact without saving"]
        unsaved{"Unsaved notes?"}
        keep{"Agent choice after warning"}
        draft["Client keeps notes as local draft (proposed)"]
        rel["System releases reservation"]
        relOk{"Release result"}
        relLapse["No response from server"]
        relEnd(["Expires at lease end, no further action (saved data unaffected)"])
        freed(["Released: business available"])
    end
    subgraph loss ["Network loss and expiry"]
        net["Renewals fail, client shows offline banner, notes stay in form"]
        reconnect{"Reconnected before lease end?"}
        renewOk["Renewal succeeds, reservation stays Active"]
        expired["System marks Expired when lease elapses (DEC-004)"]
        retake{"On reconnect: business free?"}
        reacq[["Agent re-acquires via Part 1 (new reservation)"]]
        conflict["Reserved by another agent: draft kept, save blocked"]
    end
    subgraph ovr ["Owner override (proposed, rules undecided)"]
        ovReason[/"Owner enters override reason (proposed)"/]
        ovDo["System ends reservation as Overridden, audits, informs holder"]
        ovNext[["Owner acquires or reassigns (WF-CALL-001)"]]
    end
    stale{"Late save from stale client (policy-dependent, no DEC ID)"}
    altA(["Alt A: reject save, keep draft until re-acquired"])
    altB(["Alt B: log attempt row only, outcome change needs re-acquire"])
    active -->|"Call saved"| saveDone
    active -->|"Agent cancels"| cancel
    active -->|"Network lost"| net
    active -->|"Idle, browser closed or session revoked (DEC-004)"| expired
    active -->|"Owner overrides"| ovReason
    saveDone --> rel
    cancel --> unsaved
    unsaved -->|"Yes"| keep
    unsaved -->|"No"| rel
    keep -->|"Keep draft"| draft
    keep -->|"Discard"| rel
    draft --> rel
    rel --> relOk
    relOk -->|"Released"| freed
    relOk -->|"No response"| relLapse
    relLapse --> relEnd
    net --> reconnect
    reconnect -->|"Yes"| renewOk
    renewOk -.-> active
    reconnect -->|"No"| expired
    expired -->|"Holder reconnects"| retake
    retake -->|"Free"| reacq
    retake -->|"Taken"| conflict
    ovReason --> ovDo
    ovDo --> ovNext
    ovDo -.->|"Holder saves later"| stale
    conflict -.->|"Holder saves"| stale
    stale -->|"Alt A"| altA
    stale -->|"Alt B"| altB
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class draft,expired,ovReason,ovDo,stale dec
    class altA,altB alt
    class net,conflict fail
    class freed,relEnd ok
```

## WF-CALL-003 Part 1 — Attempt entry and outcome-specific fields (spec §2.3)
Nodes: 19.
```mermaid
flowchart LR
    start(["Agent holding the reservation selects Log attempt"])
    enter[/"Agent enters attempt time (default now) and notes"/]
    fromAcc{"Current outcome Accepted? Changing it is policy-dependent (B3-Q12)"}
    outcome{"Agent selects outcome"}
    subgraph hold ["On hold (no answer)"]
        hFu{"Agent adds optional follow-up? (D3)"}
        hFuIn[/"Agent enters follow-up time and purpose"/]
    end
    subgraph nac ["Needs another call (client asked for later)"]
        nWhen{"Agent schedules now? (D2)"}
        nFuIn[/"Agent enters follow-up time and purpose"/]
        nMarker["System sets pending marker: callback to be scheduled"]
    end
    subgraph rej ["Rejected (do not call)"]
        rIn[/"Agent enters rejection reason (proposed field)"/]
        rMarker["System clears any callback-to-be-scheduled marker (B1)"]
        rFu{"Open follow-ups exist?"}
    end
    subgraph acc ["Accepted (interested), meeting time optional"]
        aIn[/"Agent enters client needs and service interest (proposed fields)"/]
        aDev{"Agent assigns developer now? (E2, E3)"}
        aDevIn[/"Agent or Owner selects an active Developer"/]
        aDefer["System marks developer not yet assigned (visible to Owner)"]
        aFu{"Open follow-ups or marker exist?"}
    end
    noChange["Attempt only, no outcome change (policy-dependent, C-02)"]
    next[["Validate and save (WF-CALL-003 Part 2)"]]
    start --> enter
    enter --> fromAcc
    fromAcc -->|"No, or Yes and policy allows"| outcome
    fromAcc -->|"Yes and policy forbids"| noChange
    outcome -->|"On hold"| hFu
    outcome -->|"Needs another call"| nWhen
    outcome -->|"Rejected"| rIn
    outcome -->|"Accepted"| aIn
    outcome -->|"Unchanged"| noChange
    hFu -->|"Yes"| hFuIn
    hFu -->|"No"| next
    hFuIn --> next
    nWhen -->|"Yes"| nFuIn
    nWhen -->|"No: defer"| nMarker
    nFuIn --> next
    nMarker --> next
    rIn --> rMarker
    rMarker --> rFu
    rFu -->|"Yes: handle per D4 (policy-dependent)"| next
    rFu -->|"No"| next
    aIn --> aDev
    aDev -->|"Assign now"| aDevIn
    aDev -->|"Defer"| aDefer
    aDevIn --> aFu
    aDefer --> aFu
    aFu -->|"Yes: handle per D4 (policy-dependent)"| next
    aFu -->|"No"| next
    noChange --> next
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class fromAcc,nMarker,rIn,aIn,aDefer,rFu,aFu,noChange dec
```

## WF-CALL-003 Part 2 — Validate, save, release, hand-offs (spec §2.3)
Nodes: 20.
```mermaid
flowchart LR
    start(["Agent submits attempt (from Part 1)"])
    subgraph validate ["Validate"]
        valid{"Contract items (D2) and approved mandatory fields valid?"}
        fix["Agent corrects entries, reservation kept"]
        resv{"Reservation still held by this agent?"}
        stale[["Stale client path (WF-CALL-002 Part 2)"]]
        version{"Business changed since workspace loaded?"}
        conflict["System shows save conflict, nothing overwritten"]
        openDeal{"Accepted and business already has an open deal record?"}
        dealPol{"Open-deal rule (DEC-017, unselected, WF-DEAL-001 A9)"}
        dealBlock(["Save blocked or linked to existing deal record (DEC-017)"])
    end
    subgraph savePhase ["Single save (all or nothing)"]
        save["System saves attempt row, current outcome, follow-up or marker, deal record in stage Accepted opportunity (E5)"]
        saved{"Save result"}
        err["Save failed: nothing saved, form kept, reservation stays Active"]
        audit["System records call_attempt.logged, call_outcome.changed, accepted_opportunity.created, follow-up and marker events"]
    end
    release["System releases reservation (only after save)"]
    subgraph handoff ["Hand-offs"]
        hDeal[["Deal record in Accepted opportunity to WF-DEAL-001 (not a closed deal)"]]
        hFollow[["Follow-up and reminders: WF-FOLLOW-001, WF-NOTIFY-001"]]
        hReject[["Do-not-call enforcement: WF-REJECT-001"]]
        hDev[["Developer handoff notification: WF-NOTIFY-001"]]
    end
    queue(["Business returns to queue buckets per new outcome (derived)"])
    start --> valid
    valid -->|"Invalid"| fix
    fix --> valid
    valid -->|"Valid"| resv
    resv -->|"Lost"| stale
    resv -->|"Held"| version
    version -->|"Changed"| conflict
    conflict -->|"Agent reviews and resubmits"| valid
    version -->|"Unchanged"| openDeal
    openDeal -->|"No"| save
    openDeal -->|"Yes"| dealPol
    dealPol -->|"Multiple allowed: new deal record"| save
    dealPol -->|"Single deal only"| dealBlock
    save --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| save
    saved -->|"Save succeeded"| audit
    audit --> release
    release -->|"Accepted"| hDeal
    release -->|"Follow-up or marker saved"| hFollow
    release -->|"Rejected"| hReject
    hDeal -.->|"Developer assigned now"| hDev
    release --> queue
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class dealPol,dealBlock dec
    class fix,conflict,err fail
    class queue ok
```

## WF-FOLLOW-001 — Follow-up schedule, reschedule, complete, cancel (spec §2.4)
Nodes: 22.
```mermaid
flowchart LR
    subgraph entry ["Entry points"]
        e1(["Follow-up created inside WF-CALL-003 save"])
        e2(["Agent schedules from queue: callback to be scheduled"])
        e3(["Agent or Owner opens an existing follow-up"])
    end
    authz{"Access check (WF-ACCESS-001, B7) passed and actor is responsible agent, assignee or Owner?"}
    denied(["Permission denied (B7 item for Owner if assignee)"])
    action{"Action chosen"}
    rejected{"Business outcome Rejected?"}
    dnc(["Blocked: do not call (WF-REJECT-001)"])
    subgraph sched ["Schedule or reschedule"]
        enter[/"Agent enters date, time (company timezone), purpose, and a reason if rescheduling"/]
        tValid{"Time valid? (future, proposed)"}
        fix["Agent corrects time"]
    end
    subgraph close ["Complete or cancel"]
        compl[/"Agent links call attempt or adds completion note"/]
        canc[/"Agent enters cancellation reason"/]
        lastFu{"Needs another call and last open follow-up closed without a linked call?"}
        repl["Agent adds replacement follow-up, or System sets callback-to-be-scheduled marker (D2), same save"]
    end
    save["System saves follow-up (history kept, marker cleared only when scheduling)"]
    saved{"Save result"}
    err["Save failed: no change"]
    audit["System records follow-up audit event"]
    remind[["Schedule, cancel or replace reminders via WF-NOTIFY-001 (failure never blocks follow-up, D5, D6)"]]
    show["Shown in dashboard, queue, calendar, Owner overview, due and overdue (derived)"]
    back(["Business returns to queue per current outcome"])
    e1 -->|"Already saved"| remind
    e2 --> authz
    e3 --> authz
    authz -->|"Denied"| denied
    authz -->|"Authorized"| action
    action -->|"Schedule or reschedule"| rejected
    action -->|"Complete"| compl
    action -->|"Cancel"| canc
    rejected -->|"Rejected"| dnc
    rejected -->|"Not rejected"| enter
    enter --> tValid
    tValid -->|"Invalid"| fix
    fix --> enter
    tValid -->|"Valid"| save
    compl --> lastFu
    canc --> lastFu
    lastFu -->|"Yes"| repl
    lastFu -->|"No"| save
    repl --> save
    save --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| save
    saved -->|"Save succeeded"| audit
    audit --> remind
    remind --> show
    show -->|"Completed or cancelled"| back
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class tValid,repl dec
    class denied,dnc,err fail
    class show derived
    class back ok
```

## WF-NOTIFY-001 Part 1 — Event intake: reminders and notifications (spec §2.5)
Nodes: 21.
```mermaid
flowchart LR
    subgraph sources ["Committed source events"]
        s1(["Follow-up scheduled, rescheduled, reassigned, completed, cancelled (WF-FOLLOW-001)"])
        s2(["Meeting scheduled, rescheduled, cancelled (WF-DEAL-001)"])
        s3(["Missing check-in or checkout flag (WF-ATT-003)"])
        s4(["New assignment, developer handoff, B7 item (WF-CALL-001, WF-CALL-003)"])
        s5(["Data or attendance correction submitted (WF-BIZ-002, WF-ATT-003)"])
    end
    committed{"Source save committed?"}
    none(["Nothing sent for unsaved changes"])
    family{"Delivery family (R-08)"}
    subgraph remPlan ["Reminder planning (SM-REMINDER-001), timing unresolved, no DEC ID"]
        kind{"Reminder change type"}
        cancelOld["System cancels pending reminders for this source"]
        cancelEnd(["Pending reminders Cancelled"])
        recip["System determines recipient (responsible user or attendees, proposed) and email channel"]
        timing["System computes trigger time from business event time (job time is not event time)"]
        past{"Trigger time already past?"}
        pastPol{"Short-notice rule (policy-dependent, no DEC ID)"}
        sched["System creates reminder instance: Scheduled"]
        schedOk{"Scheduling result"}
        schedErr["Scheduling failed: source unaffected, flagged and retried (proposed)"]
    end
    subgraph notPlan ["Notification (no state model, R-08)"]
        nRecip["System determines alert recipients and channel (unresolved, no DEC ID)"]
        nSend[["Send with Part 2 re-check and failure rules (C6, D6), events notification.sent, failed, suppressed"]]
    end
    dispatch[["Dispatch at trigger time (WF-NOTIFY-001 Part 2)"]]
    s1 --> committed
    s2 --> committed
    s3 --> committed
    s4 --> committed
    s5 --> committed
    committed -->|"No"| none
    committed -->|"Yes"| family
    family -->|"Follow-up or meeting: reminder"| kind
    family -->|"Other alert: notification"| nRecip
    nRecip --> nSend
    kind -->|"New"| recip
    kind -->|"Rescheduled or responsible user changed"| cancelOld
    kind -->|"Completed or cancelled"| cancelOld
    cancelOld -->|"Completed or cancelled"| cancelEnd
    cancelOld -->|"Rescheduled or recipient changed: plan new"| recip
    recip --> timing
    timing --> past
    past -->|"No"| sched
    past -->|"Yes"| pastPol
    pastPol -->|"Send now"| sched
    pastPol -->|"Skip"| cancelEnd
    sched --> schedOk
    schedOk -->|"Failed"| schedErr
    schedErr -.->|"Retry"| sched
    schedOk -->|"Scheduled"| dispatch
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class recip,timing,pastPol,nRecip dec
    class schedErr fail
```

## WF-NOTIFY-001 Part 2 — Dispatch, re-check, failure, retry (spec §2.5)
Nodes: 19.
```mermaid
flowchart LR
    tick(["Worker picks up Scheduled reminder at trigger time (notifications reuse re-check and failure steps)"])
    subgraph recheck ["Re-check at send time (contract C6)"]
        srcOk{"Source unchanged and still open?"}
        stale["System cancels stale reminder"]
        late{"Running after business event time?"}
        latePol{"Late-run rule (policy-dependent, no DEC ID)"}
        acct{"Recipient account active? (SM-ACCOUNT-001)"}
        access[["Access check for recipient (WF-ACCESS-001)"]]
        accessOk{"Access granted?"}
        suppress["System marks Suppressed, visible to Owner (D6)"]
    end
    subgraph send ["Send email"]
        sendIt["System sends email with content limited to recipient access"]
        result{"Provider result"}
        sent(["Sent"])
        transient{"Retries left? (proposed)"}
        retry["System sets Retry pending with backoff (proposed)"]
        failed["System marks Failed"]
    end
    loop{"Failed item is itself a delivery-failure notification?"}
    alert["System raises delivery-failure notification to Owner (D6)"]
    noLoop(["No further notification (loop guard, proposed)"])
    keep(["Follow-up or meeting unchanged (D5)"])
    tick --> srcOk
    srcOk -->|"Changed or closed"| stale
    srcOk -->|"Unchanged"| late
    late -->|"No"| acct
    late -->|"Yes"| latePol
    latePol -->|"Send labelled late"| acct
    latePol -->|"Skip"| stale
    acct -->|"Inactive"| suppress
    acct -->|"Active"| access
    access --> accessOk
    accessOk -->|"Denied"| suppress
    accessOk -->|"Granted"| sendIt
    sendIt --> result
    result -->|"Accepted"| sent
    result -->|"Transient failure"| transient
    result -->|"Permanent failure"| failed
    transient -->|"Yes"| retry
    transient -->|"No"| failed
    retry -.->|"Retry: re-check again"| srcOk
    failed --> loop
    loop -->|"No"| alert
    loop -->|"Yes"| noLoop
    failed -.-> keep
    suppress -.-> keep
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class latePol,suppress,transient,retry,alert,noLoop dec
    class failed fail
    class sent,keep ok
```

## WF-REJECT-001 — Do-not-call enforcement and controlled reopening (spec §2.6)
Nodes: 21.
```mermaid
flowchart LR
    marked(["Agent saves Rejected via WF-CALL-003 (marker cleared)"])
    subgraph enforce ["Do-not-call enforcement"]
        show["System shows do-not-call state in queue, detail and search"]
        guards["System blocks Start Contact, new follow-ups, assignment and automatic allocation (B1, also for Owner, R-01)"]
        fuPol["System handles open follow-ups per D4 (policy-dependent)"]
        fix[["User can still request data correction (WF-BIZ-002)"]]
    end
    attempt(["Any user tries to contact, schedule or assign"])
    blocked(["Blocked: do not call"])
    subgraph reopen ["Controlled reopening (UC-CALL-006)"]
        req(["User selects Reopen"])
        access[["Access check (WF-ACCESS-001)"]]
        accessOk{"Access granted?"}
        auth{"Reopening authority (DEC-016, unselected)"}
        denied(["Permission denied"])
        reason[/"User enters reopening reason (required)"/]
        rValid{"Reason entered?"}
        fixR["User adds reason"]
        target["System sets post-reopening outcome per DEC-016 (unselected)"]
        save["System saves reopening: reason, user, time, previous outcome, history kept, assignment unchanged (proposed)"]
        saved{"Save result"}
        err["Save failed or conflict: stays Rejected"]
        audit["System records call_outcome.reopened"]
    end
    requeue[["Back to calling via WF-CALL-001 queue or assignment"]]
    marked --> show
    show --> guards
    guards --> fuPol
    show -.-> fix
    attempt --> blocked
    guards -.->|"Enforced"| blocked
    req --> access
    access --> accessOk
    accessOk -->|"Denied"| denied
    accessOk -->|"Granted"| auth
    auth -->|"Not authorized"| denied
    auth -->|"Authorized"| reason
    reason --> rValid
    rValid -->|"Missing"| fixR
    fixR --> rValid
    rValid -->|"Entered"| target
    target --> save
    save --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| save
    saved -->|"Save succeeded"| audit
    audit --> requeue
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class fuPol,auth,target,save dec
    class blocked,denied,err fail
```

---

## SM-ASSIGNMENT-001 (spec §3.1)
```mermaid
stateDiagram-v2
    direction LR
    state "Unassigned" as Unassigned
    state "Assigned (one Call Center agent)" as Assigned
    [*] --> Unassigned: business created
    Unassigned --> Assigned: Owner assigns (manual or WF-WORK-001 hand-off, B8)
    Unassigned --> Assigned: automatic allocation accepted (DEC-021)
    Assigned --> Assigned: Owner reassigns (history row kept)
    Assigned --> Unassigned: Owner unassigns (proposed)
```

## SM-RESERVATION-001 (spec §3.2)
```mermaid
stateDiagram-v2
    direction LR
    state "Active (held by one user)" as Active
    state "Released" as Released
    state "Expired (DEC-004)" as Expired
    state "Overridden (proposed)" as Overridden
    [*] --> Active: acquire (Access check, no other active reservation)
    Active --> Active: renew with Access check, or same-user re-entry
    Active --> Released: holder releases or call saved
    Active --> Expired: lease elapsed without renewal, or renewal denied (B7)
    Active --> Overridden: Owner override
    Released --> [*]
    Expired --> [*]
    Overridden --> [*]
```

## SM-FOLLOWUP-001 (spec §3.3)
```mermaid
stateDiagram-v2
    direction LR
    state "Scheduled" as Scheduled
    state "Completed" as Completed
    state "Cancelled" as Cancelled
    [*] --> Scheduled: schedule
    Scheduled --> Scheduled: reschedule or change responsible user (reminders replaced)
    Scheduled --> Completed: complete (D2 marker if last, no linked call)
    Scheduled --> Cancelled: cancel (D2 marker if last)
    Scheduled --> Cancelled: outcome Rejected or Accepted (D4, policy-dependent)
    Completed --> [*]
    Cancelled --> [*]
```

## SM-REMINDER-001 (spec §3.4) — follow-up and meeting reminders only (R-08)
```mermaid
stateDiagram-v2
    direction LR
    state "Scheduled" as Scheduled
    state "Retry pending (proposed)" as RetryPending
    state "Sent" as Sent
    state "Failed (visible to Owner, D6)" as Failed
    state "Suppressed (C6, visible to Owner, D6)" as Suppressed
    state "Cancelled" as Cancelled
    [*] --> Scheduled: follow-up or meeting event committed
    Scheduled --> Sent: re-check passed and provider accepted
    Scheduled --> RetryPending: transient failure
    Scheduled --> Failed: permanent failure
    Scheduled --> Suppressed: recipient inactive or no access
    Scheduled --> Cancelled: source changed, closed or recipient changed, or late-run skip
    RetryPending --> RetryPending: transient failure with retries left
    RetryPending --> Sent: retry accepted
    RetryPending --> Failed: retries exhausted
    RetryPending --> Suppressed: re-check failed
    RetryPending --> Cancelled: source changed or closed
    Sent --> Failed: bounce reported (if supported)
    Sent --> [*]
    Failed --> [*]
    Suppressed --> [*]
    Cancelled --> [*]
```

---

## Drawing-time source changes (T3d step 2; see `verification.md`)

- **SM-RESERVATION-001** was drawn as v3 with the flowchart source below instead of `stateDiagram-v2`. The `stateDiagram-v2` render hid the Active self-transition and put labels over the state names. Transitions and labels are unchanged except one, shortened from "lease elapsed without renewal, or renewal denied (B7)" to "lease elapsed, or renewal denied (B7)".
- **The flowchart re-render did not fix the problem either:** the self-loop is still not drawn. After two repair attempts the issue is recorded as residual.
- **SM-ASSIGNMENT-001, SM-FOLLOWUP-001 and SM-REMINDER-001** stay as drawn from the `stateDiagram-v2` source above. Each carries a "Reading note (render limitation)" text on the board that lists the undrawn self-transitions. The transition tables are authoritative.

```mermaid
flowchart LR
    st(("Start"))
    active("Active (held by one user)")
    released("Released")
    expired("Expired (DEC-004)")
    overridden("Overridden (proposed)")
    fin(("End"))
    st -->|"acquire (Access check, no other active reservation)"| active
    active -->|"renew with Access check, or same-user re-entry"| active
    active -->|"holder releases or call saved"| released
    active -->|"lease elapsed, or renewal denied (B7)"| expired
    active -->|"Owner override"| overridden
    released --> fin
    expired --> fin
    overridden --> fin
```
