# Phase 2 Batch 1 — Diagram source

This is the Mermaid structure sent to `generate_diagram` for the **current** version of each diagram on Board 02 (`lwmKQNJI42na8B3SSNLQJP`). Nodes, edges and labels are exact. The colour lines (`classDef` / `class` / `style`) are omitted; they follow the legend in §8 of the Phase 2 doc. The board copies were then wrapped in sections and given header text with `use_figma`. Status: approved Phase 2 baseline (2026-10-20).

## WF-ATT-001 (v1) — node `11:721`
```mermaid
flowchart LR
    subgraph emp ["Employee (any role)"]
        start(["Select Check In"])
        denied(["Redirect to login or account inactive"])
        seeOpen["Notice: open session exists"]
        seeFail(["Check-in rejected: verification failed"])
        panel(["Active panel: timer, 9 h progress, work list"])
    end
    subgraph sys ["System"]
        authOk{"Authenticated and active?"}
        openExists{"Open session exists?"}
        verifyMode["Evaluate office check (mode per DEC-009, unselected)"]
        verifyOk{"Office check passed?"}
        remoteOk{"Remote exception applies? (DEC-010, unresolved)"}
        auditFail["Audit: failed check-in attempt (proposed)"]
        record["Record check-in time and open session"]
        schedOk{"Schedule configured? (DEC-007)"}
        workDay{"Scheduled working day? (DEC-022)"}
        classify{"After shift start plus grace? (DEC-008)"}
        late["Classify: Late (derived)"]
        onTime["Classify: On time (derived)"]
        nonWork["Classify: Non-working day (derived)"]
        unclassified["Classify: Unclassified (pending DEC-007)"]
        auditIn["Audit: check-in recorded"]
    end
    resolve[["Resolve via WF-ATT-003"]]
    start --> authOk
    authOk -->|"Denied"| denied
    authOk -->|"Authorized"| openExists
    openExists -->|"Yes"| seeOpen
    seeOpen --> resolve
    openExists -->|"No"| verifyMode
    verifyMode --> verifyOk
    verifyOk -->|"Passed"| record
    verifyOk -->|"Failed"| remoteOk
    remoteOk -->|"Yes: record as remote"| record
    remoteOk -->|"No or not adopted"| auditFail
    auditFail --> seeFail
    record --> schedOk
    schedOk -->|"No"| unclassified
    schedOk -->|"Yes"| workDay
    workDay -->|"No"| nonWork
    workDay -->|"Yes"| classify
    classify -->|"Late"| late
    classify -->|"On time"| onTime
    late --> auditIn
    onTime --> auditIn
    nonWork --> auditIn
    unclassified --> auditIn
    auditIn --> panel
```

## WF-ATT-002 (v3) — node `21:1151`
```mermaid
flowchart LR
    start(["Employee selects Check Out"])
    subgraph access ["Access checks"]
        authOk{"Authenticated and active?"}
        hasOpen{"Open session exists?"}
    end
    denied(["Redirect to login or account inactive"])
    noOpen(["Notice: no open session"])
    subgraph office ["Office verification"]
        verify{"Office check passed? (DEC-009)"}
        remoteOk{"Remote exception applies? (DEC-010)"}
        auditFail["Audit: failed checkout attempt"]
    end
    subgraph failAlt ["Failed checkout: DEC-026 alternatives, none selected"]
        failPolicy{"Which policy is adopted?"}
        blocked(["Alt A: checkout rejected, session stays open"])
        altB["Alt B: record provisional checkout"]
        altC["Alt C: hold session for Owner review"]
        provDone(["Closed provisionally"])
        pendDone(["Pending Owner review"])
    end
    ownerItem[["Owner review via WF-ATT-003"]]
    subgraph closeOut ["Work summary and close"]
        sumReq{"Summary rule (DEC-012, unselected)"}
        enterSum[/"Employee enters summary (mandatory alt)"/]
        enterOpt[/"Employee may add summary (optional alt)"/]
        sumValid{"Summary valid?"}
        fixSum["Employee corrects summary"]
        closeSess["Record checkout time, compute duration, close session"]
        saved{"Save result"}
        seeErr["Save failed: session stays open"]
        durClass["Classify duration vs 9 h (derived)"]
        auditOut["Audit: checkout recorded"]
    end
    daySum(["Completed-day summary shown"])
    start --> authOk
    authOk -->|"Denied"| denied
    authOk -->|"Authorized"| hasOpen
    hasOpen -->|"No"| noOpen
    hasOpen -->|"Yes"| verify
    verify -->|"Passed"| sumReq
    verify -->|"Failed"| remoteOk
    remoteOk -->|"Yes"| sumReq
    remoteOk -->|"No or not adopted"| auditFail
    auditFail --> failPolicy
    failPolicy -->|"Alt A"| blocked
    failPolicy -->|"Alt B"| altB
    failPolicy -->|"Alt C"| altC
    altB --> provDone
    altC --> pendDone
    provDone -.-> ownerItem
    pendDone -.-> ownerItem
    sumReq -->|"Mandatory"| enterSum
    sumReq -->|"Optional"| enterOpt
    enterSum --> sumValid
    sumValid -->|"Invalid"| fixSum
    fixSum --> sumValid
    sumValid -->|"Valid"| closeSess
    enterOpt --> closeSess
    closeSess --> saved
    saved -->|"Save failed"| seeErr
    seeErr -.->|"Retry"| closeSess
    saved -->|"Save succeeded"| durClass
    durClass --> auditOut
    auditOut --> daySum
```

## WF-ATT-003 Part 1 (v2) — node `25:1355`
```mermaid
flowchart LR
    tick(["Scheduled attendance check runs (timing unresolved)"])
    workDay{"Scheduled working day for employee? (DEC-022)"}
    skip(["No alert: not a scheduled day"])
    subgraph inCheck ["Missing check-in"]
        missIn{"No session past check-in threshold?"}
        okIn(["No exception"])
        flagIn["Flag missing check-in (derived)"]
        alertIn["Notify Owner: missing check-in"]
    end
    subgraph outCheck ["Missing checkout"]
        missOut{"Session open past checkout threshold?"}
        okOut(["No exception"])
        flagOut["Flag missing checkout (derived)"]
        stayOpen["Session stays open: no automatic close"]
        alertOut["Notify: missing checkout (recipients unresolved)"]
    end
    dash["Owner sees attendance exceptions on dashboard"]
    review[["Resolve via WF-ATT-003 Part 2"]]
    tick --> workDay
    workDay -->|"No"| skip
    workDay -->|"Yes"| missIn
    workDay -->|"Yes"| missOut
    missIn -->|"No"| okIn
    missIn -->|"Yes"| flagIn
    flagIn --> alertIn
    missOut -->|"No"| okOut
    missOut -->|"Yes"| flagOut
    flagOut --> stayOpen
    stayOpen --> alertOut
    alertIn --> dash
    alertOut --> dash
    dash --> review
```

## WF-ATT-003 Part 2 (v1) — node `11:724`
```mermaid
flowchart LR
    subgraph trig ["Triggers"]
        t1(["Check-in blocked by open session"])
        t2(["Missing-checkout flag"])
        t3(["Pending-review checkout (DEC-026 Alt C)"])
        t4(["Wrong time reported"])
    end
    authority{"Correction authority (DEC-011, unselected)"}
    subgraph altA ["Alt A: Owner-only adjustment"]
        aOpen["Owner opens session record"]
        aEnter[/"Owner enters corrected times and reason"/]
    end
    subgraph altB ["Alt B: Employee request, Owner review"]
        bEnter[/"Employee submits proposed times and reason"/]
        bValid{"Request complete?"}
        bFix["Employee completes request"]
        bPending["Request pending review"]
        bNotify["Notify Owner: correction awaiting review"]
        bDecide{"Owner decision"}
        bReject["Record rejection reason and audit"]
        rejDone(["Original stands; employee informed"])
    end
    subgraph apply ["System: apply correction"]
        validate{"Times valid? Order, no overlap, not future"}
        fixA["Owner corrects entry"]
        save["Save correction record; original kept"]
        saved{"Save result"}
        err["Show error; nothing changed"]
        audit["Audit: attendance corrected"]
        done(["Session closed or adjusted; check-in unblocked"])
    end
    t1 --> authority
    t2 --> authority
    t3 --> authority
    t4 --> authority
    authority -->|"Alt A"| aOpen
    aOpen --> aEnter
    aEnter --> validate
    authority -->|"Alt B"| bEnter
    bEnter --> bValid
    bValid -->|"Invalid"| bFix
    bFix --> bValid
    bValid -->|"Valid"| bPending
    bPending --> bNotify
    bNotify --> bDecide
    bDecide -->|"Rejected"| bReject
    bReject --> rejDone
    bDecide -->|"Approved"| validate
    validate -->|"Invalid"| fixA
    fixA --> validate
    validate -->|"Valid"| save
    save --> saved
    saved -->|"Save failed"| err
    err -.->|"Retry"| validate
    saved -->|"Save succeeded"| audit
    audit --> done
```

## WF-ADMIN-001 (v2) — node `27:1421`
```mermaid
flowchart LR
    start(["Owner opens attendance settings"])
    authz{"Owner with completed 2FA?"}
    denied(["Permission denied"])
    subgraph editPhase ["Edit and validate"]
        edit[/"Owner edits working days, shift start, timezone, grace, office verifiers, mode"/]
        valid{"Values valid?"}
        modeCheck{"Verifier exists for chosen mode? (DEC-009)"}
        fix["Owner corrects values"]
    end
    subgraph savePhase ["Save"]
        save["Save settings; apply to future sessions (proposed)"]
        saved{"Save result"}
        errSeen["Save failed; previous settings kept"]
        audit["Audit: security setting changed"]
    end
    seen(["Settings saved"])
    start --> authz
    authz -->|"Denied"| denied
    authz -->|"Authorized"| edit
    edit --> valid
    valid -->|"Invalid"| fix
    valid -->|"Valid"| modeCheck
    modeCheck -->|"No"| fix
    fix --> edit
    modeCheck -->|"Yes"| save
    save --> saved
    saved -->|"Save failed"| errSeen
    errSeen -.->|"Retry"| save
    saved -->|"Save succeeded"| audit
    audit --> seen
```

## WF-WORK-001 (v3) — node `23:1283`
```mermaid
flowchart LR
    start(["Owner opens targets and work lists"])
    authz{"Owner authorized?"}
    denied(["Permission denied"])
    subgraph target ["Target setting"]
        pickEmp["Owner selects active employee and period"]
        setTarget[/"Owner sets metric and value (DEC-020, DEC-025)"/]
        tValid{"Target valid for role?"}
        fixT["Owner corrects target"]
        saveT["Save target; audit"]
    end
    method{"Work-list method"}
    subgraph manual ["Manual generation"]
        manualPick["Owner selects work items"]
        eligible{"Item eligible? Role, not rejected, in scope"}
        assignedElse{"Assigned to someone else?"}
    end
    reassign[["Reassign via WF-CALL-001"]]
    subgraph auto ["Automatic generation (DEC-021, unselected)"]
        autoRun["Owner runs automatic generation"]
        rule["System applies allocation rule"]
        enough{"Enough eligible items?"}
        shortfall["Shortfall shown to Owner"]
        preview["Owner reviews proposed allocation"]
        accept{"Accept allocation?"}
    end
    subgraph publish ["Save and publish"]
        saveW["Assign via WF-CALL-001 (contract B8); audit"]
        notify["Assignment notices sent by WF-CALL-001 (timing unresolved)"]
        progress["Count progress per DEC-020 (derived)"]
    end
    view(["Employee views target, completed, remaining, overdue"])
    start --> authz
    authz -->|"Denied"| denied
    authz -->|"Authorized"| pickEmp
    pickEmp --> setTarget
    setTarget --> tValid
    tValid -->|"Invalid"| fixT
    fixT --> tValid
    tValid -->|"Valid"| saveT
    saveT --> method
    method -->|"Target only"| progress
    method -->|"Manual"| manualPick
    method -->|"Automatic"| autoRun
    manualPick --> eligible
    eligible -->|"Not eligible"| manualPick
    eligible -->|"Eligible"| assignedElse
    assignedElse -->|"Yes"| reassign
    assignedElse -->|"No"| saveW
    autoRun --> rule
    rule --> enough
    enough -->|"No"| shortfall
    shortfall --> preview
    enough -->|"Yes"| preview
    preview --> accept
    accept -->|"No: adjust"| method
    accept -->|"Yes"| saveW
    saveW --> notify
    notify --> progress
    progress --> view
```

## SM-ATTENDANCE-001 — node `11:727`
```mermaid
stateDiagram-v2
    direction LR
    state "Open" as Open
    state "Closed" as Closed
    state "Closed provisionally (DEC-026 Alt B)" as Provisional
    state "Pending review (DEC-026 Alt C)" as PendingReview
    [*] --> Open: check in
    Open --> Closed: check out
    Open --> Open: checkout rejected (Alt A)
    Open --> Provisional: checkout failed (Alt B)
    Open --> PendingReview: checkout failed (Alt C)
    Open --> Closed: correction sets checkout
    Provisional --> Closed: Owner confirms or corrects
    PendingReview --> Closed: Owner resolves
    Closed --> Closed: correction applied
```

## SM-CORRECTION-001 — node `11:728`
```mermaid
stateDiagram-v2
    direction LR
    state "Submitted (pending review)" as Submitted
    state "Approved (correction applied)" as Approved
    state "Rejected" as Rejected
    state "Withdrawn (proposed)" as Withdrawn
    [*] --> Submitted: employee submits
    Submitted --> Approved: Owner approves
    Submitted --> Rejected: Owner rejects
    Submitted --> Withdrawn: employee withdraws
    Approved --> [*]
    Rejected --> [*]
    Withdrawn --> [*]
```
