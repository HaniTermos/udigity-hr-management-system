# Phase 2 Batch 2 — Diagram source (DRAFT, repair attempt 1)

**Baseline: SB-2.** Mermaid source for every diagram in [batch2-spec.md](batch2-spec.md). **Not yet sent to `generate_diagram`; Board 02 not written.** Status: DRAFT, not re-reviewed, not approved. Nothing tested.

Layout rules (SB-2 §7): `flowchart LR`; phase subgraphs, not role lanes; actor named inside each step; ≤ ~25 nodes per diagram; every decision edge labelled; colours via `classDef` in flowcharts only; `stateDiagram-v2` without notes, `classDef` or `style`; `[[...]]` = hand-off; dotted = retry or side effect. Every alternative not taken from Board 01 carries "(drafted)" in its diagram label. No node ID equals a classDef name.

Shared colour classes (SB-2 notation), repeated in every flowchart:

```text
classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E      %% yellow: unresolved/proposed dependency
classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E      %% orange: unselected alternative
classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E     %% red: failure / denial / rejection
classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E       %% green: success end
classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E  %% blue: derived classification
```

Planned header meta line per diagram (T2c): Status DRAFT · UC · REQ range · Actors · Policy-dependent items · "Drafted alternatives: not Board 01" where applicable.

| Diagram | Nodes | Header meta (planned) |
|---|---|---|
| WF-BIZ-001 Part 1 | 19 | UC-BIZ-001 · REQ-BIZ-001..009 · Data Entry, Owner, System · DEC-014, 015, 023; B2 (no DEC ID; drafted Alt PH-1/PH-2); R-11 → USER |
| WF-BIZ-001 Part 2 | 24 | UC-BIZ-001/002/003 · REQ-BIZ-001..009, REQ-SEC-DUP-001..007, REQ-SEC-VIS-001..006 · Data Entry, Owner, System · DEC-001, 003, 013 (drafted Alt NM-A/B/C, SN-1/SN-2: not Board 01; SN-1 = ART-11 D11, Tier 4) |
| WF-BIZ-002 Part A | 20 | UC-BIZ-004 · REQ-BIZ-001..009, REQ-SEC-DUP-001..007 · Data Entry, Owner, System · DEC-001 (R-07), 002 row 6, 003, 013; B2 |
| WF-BIZ-002 Part B | 22 | UC-BIZ-005/006 · REQ-BIZ-001..009 · Call Center, Developer, Owner, Data Entry, System · DEC-002 row 6; C-01; notification timing (no DEC ID) |
| WF-BIZ-003 | 23 | UC-BIZ-007 · REQ-BIZ-001..009 · Owner, Data Entry, System · DEC-015 (drafted Alt CA-A/B/C); category removal (no DEC ID; drafted Alt CR-1/CR-2) |
| WF-ACCESS-001 Part 1 | 21 | UC-BIZ-008 · REQ-SEC-VIS-001..006, REQ-BIZ-001..009 · All roles, System · DEC-001, 002; C-01 |
| WF-ACCESS-001 Part 2 | 12 | UC-PROJ-001 (visibility) · REQ-SEC-VIS-001..006, REQ-PROJ-001..008 · All roles, System · DEC-001, 002 rows 1–6, 005; R-12 → USER |
| WF-ACCESS-001 Part 3 | 20 | UC-BIZ-003 · REQ-SEC-VIS-001..006, REQ-CALL-001..011, REQ-REPORT-001..006 · All roles, System · B7 (R-02), C6, D6, DEC-003 |
| SM-VISIBILITY-001 Part 1 | 18 | UC-BIZ-008, UC-PROJ-001 · REQ-SEC-VIS-001..006, REQ-AUTH-001..009 · System · R-01, R-11 → USER, DEC-005, R-12; Data Entry scope (no DEC ID; drafted Alt DE-1/DE-2) |
| SM-VISIBILITY-001 Part 2 | 21 | as Part 1 · System · DEC-001 (R-07), DEC-002 rows 1–6; C-01 |
| SM-DATAFIX-001 | 6 states | UC-BIZ-005/006 · REQ-BIZ-001..009 · Requester, Reviewer, System · all states Proposed; DEC-002 row 6; C-01 |

---

## WF-BIZ-001 Part 1 — Creation: authorization and field validation (19 nodes)

```mermaid
flowchart LR
    start(["Data Entry or Owner selects New business"])
    subgraph authP ["Authorization"]
        authz{"System: role Data Entry or Owner, account active, authenticated?"}
    end
    denied(["Permission denied; nothing saved"])
    r11{"Owner with 2FA pending: R-11 reading (USER decision, unselected)"}
    r11b["Reading R11-b: only admin actions blocked; whether creation is administrative is part of the USER question"]
    subgraph entryP ["Entry"]
        enter[/"Data Entry or Owner enters name, category, phones, social accounts with metrics or Unknown, website flag and URL, notes"/]
    end
    subgraph validP ["Field validation: all errors reported together"]
        vName{"System: name present? (VR-1)"}
        vCat{"System: category from selectable list? (VR-2, DEC-015)"}
        vSocial{"System: at least one social account with valid platform and link? (VR-7, VR-8)"}
        vPhoneFmt{"System: each entered phone valid and normalizable? (VR-4)"}
        phonePolicy{"Phone mandatory at creation? (no DEC ID, B2; drafted alternatives)"}
        hasPhone{"System: at least one phone entered?"}
        noPhone["Not eligible for calling until a phone is added (derived, B2)"]
        vMetrics{"System: each follower count and last-post date valid or explicitly Unknown? (DEC-014, DEC-023)"}
        vWeb{"System: website checked means valid URL, unchecked means no URL? (VR-11)"}
        errors["System shows field errors; nothing saved"]
        fix["Data Entry or Owner corrects fields"]
    end
    catNone[["No fitting category: WF-BIZ-003 (DEC-015)"]]
    dupe[["Continue: WF-BIZ-001 Part 2, duplicate check"]]
    start --> authz
    authz -->|"Denied"| denied
    authz -->|"Owner with 2FA pending"| r11
    authz -->|"Authorized; Owner with 2FA complete"| enter
    r11 -->|"Reading R11-a: all access waits for 2FA"| denied
    r11 -->|"Reading R11-b"| r11b
    r11b -.->|"Only if creation is non-administrative"| enter
    enter --> vName
    vName -->|"Invalid"| errors
    vName -->|"Valid"| vCat
    vCat -->|"No fitting category or list empty"| catNone
    vCat -->|"Invalid"| errors
    vCat -->|"Valid"| vSocial
    vSocial -->|"Invalid"| errors
    vSocial -->|"Valid"| vPhoneFmt
    vPhoneFmt -->|"Invalid"| errors
    vPhoneFmt -->|"Valid"| phonePolicy
    phonePolicy -->|"Alt PH-1 (drafted): mandatory"| hasPhone
    phonePolicy -->|"Alt PH-2 (drafted): optional"| vMetrics
    phonePolicy -.->|"Alt PH-2 and no phone"| noPhone
    hasPhone -->|"No"| errors
    hasPhone -->|"Yes"| vMetrics
    vMetrics -->|"Invalid"| errors
    vMetrics -->|"Valid"| vWeb
    vWeb -->|"Invalid"| errors
    vWeb -->|"Valid"| dupe
    errors --> fix
    fix -->|"Re-validate"| vName
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class vCat,vMetrics,catNone,r11b dec
    class phonePolicy,r11 alt
    class denied,errors fail
    class noPhone derived
```

## WF-BIZ-001 Part 2 — Creation: duplicate check, block display, save (24 nodes)

```mermaid
flowchart LR
    inP(["From Part 1: all fields valid"])
    subgraph normP ["Normalize"]
        normPhone["System normalizes each phone (method: no DEC ID)"]
        normName["System normalizes name (rules per DEC-013)"]
    end
    subgraph checkP ["Duplicate check: entire database, including records hidden from this user"]
        phoneMatch{"System: normalized phone matches any stored business?"}
        nameRule{"Name match handling (DEC-013; drafted alternatives, not Board 01)"}
        altA["Alt NM-A (drafted): exact normalized name blocks"]
        altB["Alt NM-B (drafted): exact name blocks unless branch differs; needs a branch field not in ART-01"]
        altC["Alt NM-C (drafted): name-only match warns, does not block"]
        nameMatch{"System: name match under the selected alternative?"}
        similar{"System: similar names found? (Alt SN-1 drafted, as ART-11 D11; none under Alt SN-2 drafted)"}
        warn{"Data Entry or Owner reviews possible matches: a different business?"}
    end
    cancelled(["Creator cancels; nothing saved"])
    subgraph blockP ["Duplicate blocked: no bypass, no merge"]
        blocked["System blocks save and shows already exists; no override control"]
        canRead{"Access check (WF-ACCESS-001): creator can read the match?"}
        preview["System previews match within creator permissions, with link; Owner sees full record"]
        hiddenShow["Unreadable match: extra detail per DEC-003 (unselected); minimum is already exists"]
        escal["Request escalation: only if adopted under DEC-003 (UC-BIZ-003)"]
        blockEnd(["Creation blocked; nothing saved"])
    end
    subgraph saveP ["Save"]
        save["System saves with atomic duplicate re-check in the same save (DR-8); sets created by and at"]
        saveRes{"Save result"}
        saveFail["Save failed: nothing created; form kept"]
        audit["System audits business.created, starts edit history, timer basis origin (DEC-001)"]
    end
    done(["Business saved: unassigned, calling outcome Pending (C-02)"])
    assign[["Assignment via WF-CALL-001 (Batch 3, B8)"]]
    inP --> normPhone
    normPhone --> normName
    normName --> phoneMatch
    phoneMatch -->|"Match"| blocked
    phoneMatch -->|"No match"| nameRule
    nameRule -->|"Alt NM-A"| altA
    nameRule -->|"Alt NM-B"| altB
    nameRule -->|"Alt NM-C"| altC
    altA --> nameMatch
    altB --> nameMatch
    altC --> nameMatch
    nameMatch -->|"Match under Alt NM-A or NM-B"| blocked
    nameMatch -->|"Match under Alt NM-C"| warn
    nameMatch -->|"No match"| similar
    similar -->|"Yes"| warn
    similar -->|"No, or not checked"| save
    warn -->|"Different business: continue"| save
    warn -->|"Cancel"| cancelled
    blocked --> canRead
    canRead -->|"Readable, or Owner"| preview
    canRead -->|"Not readable: hidden or out of scope"| hiddenShow
    hiddenShow -.->|"Only if adopted"| escal
    preview --> blockEnd
    hiddenShow --> blockEnd
    save --> saveRes
    saveRes -->|"Concurrent duplicate found"| blocked
    saveRes -->|"Save failed"| saveFail
    saveFail -.->|"Retry: re-checks duplicates"| phoneMatch
    saveRes -->|"Save succeeded"| audit
    audit --> done
    done -.-> assign
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class normPhone,normName,nameRule,hiddenShow,escal,audit dec
    class altA,altB,altC,similar alt
    class blocked,blockEnd,saveFail fail
    class done ok
```

## WF-BIZ-002 Part A — Edit, revalidation, concurrency, save conflict (20 nodes)

```mermaid
flowchart LR
    start(["Data Entry or Owner selects Edit, or a reviewer applies a correction"])
    subgraph accessP ["Access"]
        access{"Access check (WF-ACCESS-001): read and edit allowed? Context-limited: only DEC-002 row 6 Alt B apply"}
    end
    denied(["Permission denied or Record hidden by policy; nothing saved"])
    corr[["Call Center or Developer: Flag incorrect data via WF-BIZ-002 Part B"]]
    subgraph editP ["Edit and validate"]
        load["System loads current values and version"]
        edit[/"Data Entry or Owner changes permitted master fields"/]
        valid{"System: rules VR-1 to VR-12 pass? Last social account cannot be removed; last phone per B2"}
        fix["Data Entry or Owner corrects fields"]
    end
    subgraph dupP ["Duplicate revalidation"]
        changed{"System: name or any phone changed?"}
        dup{"System: match in entire database, excluding this record? (DEC-013 name rules)"}
        blocked["Save blocked: already exists; preview per Access check and DEC-003"]
    end
    subgraph saveP ["Save"]
        save["System saves only if version unchanged, access still allowed, and atomic duplicate re-check passes (DR-8); writes edit history"]
        res{"Save result"}
        conflict["Save conflict: changed by someone else since loading; nothing overwritten"]
        reload["Data Entry or Owner reviews latest values and re-applies changes"]
        saveFail["Save failed: no change; edits kept"]
        audit["System audits business.updated; sets last updated by and at"]
        timer["Timer basis unchanged: edits never reset (DEC-001 Alt A and Alt B; R-07 reset events only)"]
        elig["Calling eligibility re-derived if phones changed (derived, B2)"]
    end
    done(["Changes saved; history shows previous and new values"])
    start --> access
    access -->|"Denied: Call Center or Developer role"| corr
    access -->|"Denied: scope, assignment, hidden or context"| denied
    access -->|"Allowed"| load
    load --> edit
    edit --> valid
    valid -->|"Invalid"| fix
    fix --> valid
    valid -->|"Valid"| changed
    changed -->|"No"| save
    changed -->|"Yes"| dup
    dup -->|"Duplicate"| blocked
    blocked -.->|"Change value or cancel"| edit
    dup -->|"No duplicate"| save
    save --> res
    res -->|"Access lost since loading"| denied
    res -->|"Concurrent duplicate found"| blocked
    res -->|"Version stale"| conflict
    conflict --> reload
    reload -->|"Re-validate"| valid
    res -->|"Save failed"| saveFail
    saveFail -.->|"Retry"| save
    res -->|"Save succeeded"| audit
    audit -.-> timer
    audit --> elig
    elig --> done
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class access,dup,timer dec
    class denied,blocked,conflict,saveFail fail
    class elig derived
    class done ok
```

## WF-BIZ-002 Part B — Data-correction request submit and review (22 nodes)

```mermaid
flowchart LR
    s1(["Call Center, Developer or Owner selects Flag incorrect data in an authorized workspace"])
    subgraph subP ["Submit"]
        sAcc{"Access check (WF-ACCESS-001): requester passes for this business?"}
        sEnter[/"Requester picks field or issue, explains, optionally suggests a value"/]
        sValid{"System: issue type and explanation present?"}
        sFix["Requester completes the request"]
        sSave["System saves request as Submitted; business shows needs correction (derived)"]
        sNotify["Notify reviewers: data-correction request (recipients and timing: no DEC ID)"]
    end
    sDen(["Permission denied or hidden; no request created"])
    wEnd(["Withdrawn by requester (proposed)"])
    subgraph revP ["Review: shared queue (proposed)"]
        rQueue["Data Entry or Owner opens the correction queue"]
        rAcc{"Access check: reviewer passes for the business? (DEC-002 row 6)"}
        rOwner["Row 6 Alt A, business hidden from Data Entry: only the Owner can review"]
        rClaim["Reviewer starts review: request In review"]
        rVerify["Reviewer verifies the information"]
        rDecide{"Reviewer decision"}
    end
    subgraph resP ["Resolution"]
        rApply[["Apply via WF-BIZ-002 Part A: validation, duplicate re-check, atomic re-check, version check"]]
        rRes{"Edit save result"}
        rStay["Request stays In review: duplicate, invalid, conflict or save failure"]
        rResolved(["Resolved: changes applied; requester informed"])
        rNoChange(["Closed, no change needed (proposed); requester informed"])
        rReject["Reviewer records the rejection reason"]
        rRejected(["Rejected (request); requester informed"])
    end
    s1 --> sAcc
    sAcc -->|"Denied"| sDen
    sAcc -->|"Allowed"| sEnter
    sEnter --> sValid
    sValid -->|"Incomplete"| sFix
    sFix --> sValid
    sValid -->|"Complete"| sSave
    sSave -.-> sNotify
    sSave -.->|"Requester withdraws before resolution"| wEnd
    sSave --> rQueue
    rQueue --> rAcc
    rAcc -->|"Allowed, incl. row 6 Alt B"| rClaim
    rAcc -->|"Hidden from Data Entry"| rOwner
    rOwner --> rClaim
    rClaim -.->|"Release (proposed)"| rQueue
    rClaim --> rVerify
    rVerify --> rDecide
    rDecide -->|"Apply changes"| rApply
    rDecide -->|"Already correct or fixed"| rNoChange
    rDecide -->|"Request incorrect"| rReject
    rReject --> rRejected
    rApply --> rRes
    rRes -->|"Save succeeded"| rResolved
    rRes -->|"Blocked or failed"| rStay
    rStay -.->|"Revise or decide again"| rDecide
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class sNotify,rAcc dec
    class rOwner alt
    class sDen,rStay,rRejected fail
    class rResolved,rNoChange ok
```

## WF-BIZ-003 — Category management (23 nodes)

```mermaid
flowchart LR
    start(["Owner or Data Entry opens category management"])
    subgraph authP ["Authority"]
        who{"System: who is acting?"}
        deAuth{"Data Entry authority (DEC-015; drafted alternatives, not Board 01)"}
        altB["Alt CA-B (drafted): Data Entry may create only"]
        altC["Alt CA-C (drafted): Data Entry submits a suggestion"]
        approve{"Owner reviews the suggestion"}
    end
    denied(["Permission denied (Alt CA-A drafted: Owner only)"])
    declined(["Suggestion declined; reason recorded"])
    op{"Owner selects operation"}
    subgraph nameP ["Create or rename"]
        enter[/"Owner or Data Entry enters category name"/]
        nameChk{"System: name present, and normalized name unique among all categories incl. inactive?"}
        nameMiss["Name required: System asks for a name"]
        dupCat["Duplicate name: System shows the existing one; offers reactivation if inactive"]
        save["System saves; audits the category event"]
        res{"Save result"}
        catSaveFail["Save failed: no change"]
    end
    done(["Category list updated; a rename shows on all businesses"])
    subgraph remP ["Category removal (no DEC ID, drafted alternatives, C-01 may influence)"]
        rem{"Removal behaviour (no DEC ID)"}
        deact["Alt CR-1 (drafted): deactivate; not offered for new or changed businesses"]
        effect["Existing businesses keep it, shown as inactive; no business history entry"]
        inUse{"Alt CR-2 (drafted): System checks: used by any business?"}
        blockDel(["Delete blocked: in use; reassign businesses or deactivate"])
        delDone(["Category deleted; audited"])
    end
    start --> who
    who -->|"Owner"| op
    who -->|"Data Entry"| deAuth
    deAuth -->|"Alt CA-A"| denied
    deAuth -->|"Alt CA-B"| altB
    deAuth -->|"Alt CA-C"| altC
    altB -->|"Create only"| enter
    altC --> approve
    approve -->|"Declined"| declined
    approve -->|"Approved"| enter
    op -->|"Create or rename"| enter
    op -->|"Reactivate, Alt CR-1 only"| save
    op -->|"Remove"| rem
    enter --> nameChk
    nameChk -->|"Missing"| nameMiss
    nameMiss --> enter
    nameChk -->|"Duplicate"| dupCat
    dupCat --> enter
    nameChk -->|"Valid and unique"| save
    save --> res
    res -->|"Save failed"| catSaveFail
    catSaveFail -.->|"Retry"| save
    res -->|"Save succeeded"| done
    rem -->|"Alt CR-1"| deact
    rem -->|"Alt CR-2"| inUse
    deact --> save
    deact -.-> effect
    inUse -->|"In use"| blockDel
    inUse -->|"Not used"| delDone
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class deAuth,rem dec
    class altB,altC,deact,inUse alt
    class denied,declined,nameMiss,dupCat,catSaveFail,blockDel fail
    class done,delDone ok
```

## WF-ACCESS-001 Part 1 — Search, lists, detail, direct URL, edit history (21 nodes)

```mermaid
flowchart LR
    start(["User opens a business list, runs a search, or opens a record or direct URL"])
    kind{"Request type"}
    subgraph listP ["Lists and search"]
        query["System runs the query with role-appropriate filters"]
        perRow["System runs Access check (SM-VISIBILITY-001) on every candidate before counting, sorting and paging"]
        anyRow{"Any full-access rows?"}
        results(["Results: full-access rows only; counts exclude the rest; context-limited items appear only in their context surfaces"])
        empty(["Empty state; inaccessible matches not hinted or counted"])
    end
    subgraph detailP ["Detail and direct URL"]
        exists{"System: record exists? (business deletion per C-01)"}
        notFound(["Not found"])
        evalD{"Access check (SM-VISIBILITY-001): read outcome"}
        deniedPerm(["Permission denied: role, scope or assignment; no data"])
        deniedHidden(["Record hidden by policy: window passed, no exception; no data"])
        logDeny["System logs business_access.denied (proposed)"]
        limitedV["Context-limited view: fields and actions per VT-5 row (derived)"]
        fullV["Full detail; each related item re-checked (Table RT, Part 2)"]
        nextAct{"User's next action"}
        editChk{"Edit allowed? Full: Data Entry or Owner. Context-limited: only row 6 Alt B apply"}
    end
    editYes[["Edit via WF-BIZ-002 Part A"]]
    editNo(["No edit control shown"])
    corrYes[["Flag incorrect data via WF-BIZ-002 Part B (Call Center, Developer, Owner)"]]
    hist["Edit history: who, when, previous and new values, only for fields the outcome allows. Audit trail is Owner-only (WF-REPORT-002)"]
    start --> kind
    kind -->|"List or search"| query
    kind -->|"Detail or direct URL"| exists
    query --> perRow
    perRow --> anyRow
    anyRow -->|"Yes"| results
    anyRow -->|"No"| empty
    exists -->|"No"| notFound
    exists -->|"Yes"| evalD
    evalD -->|"Denied: permission"| deniedPerm
    evalD -->|"Denied: hidden by policy"| deniedHidden
    evalD -->|"Context-limited"| limitedV
    evalD -->|"Full or Owner access"| fullV
    deniedPerm -.-> logDeny
    deniedHidden -.-> logDeny
    fullV --> nextAct
    limitedV --> nextAct
    nextAct -->|"View edit history"| hist
    nextAct -->|"Edit"| editChk
    nextAct -->|"Flag incorrect data"| corrYes
    editChk -->|"Allowed"| editYes
    editChk -->|"Not allowed"| editNo
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class exists,editChk,hist dec
    class notFound,deniedPerm,deniedHidden,editNo fail
    class limitedV derived
    class results ok
```

## WF-ACCESS-001 Part 2 — Related records and Developer deal/project lists (12 nodes)

```mermaid
flowchart LR
    start(["A surface needs a related item: call attempt, follow-up, reservation, meeting, task, correction request, or a Developer deal or project list row"])
    surface{"Resource type (Table RT)"}
    subgraph relP ["Related record: rule defined in Table RT, Batches 3 and 4 supply relation facts"]
        linkBiz["System resolves the linked business, through the deal record or project where applicable"]
        bizChk{"Access check on linked business, incl. the DEC-002 row named in Table RT"}
        showAll(["Item shown with the fields and actions the outcome allows"])
        own{"Item owned by U? Own follow-up, attempt, meeting, task or request; list rows never"}
        redact(["Owned item shown with business identity redacted (proposed, no DEC ID)"])
        omit(["Item omitted and not counted"])
    end
    subgraph devP ["Developer deal record and project lists (UC-PROJ-001)"]
        devPre{"Deal record closed?"}
        dec005{"Developer pre-closure access (DEC-005, unselected)"}
        rows["Closed: company-wide for Developers; after window, DEC-002 rows 2 to 4; context-limited"]
    end
    deny005(["Denied: permission; row omitted and not counted (R-12, USER)"])
    start --> surface
    surface -->|"Related record"| linkBiz
    surface -->|"Developer list row"| devPre
    linkBiz --> bizChk
    bizChk -->|"Allowed or context-limited"| showAll
    bizChk -->|"Denied"| own
    own -->|"Yes"| redact
    own -->|"No"| omit
    devPre -->|"Not closed: accepted opportunity"| dec005
    devPre -->|"Closed"| rows
    dec005 -->|"Alt 1 and assigned to U: read-only"| bizChk
    dec005 -->|"Alt 1 not assigned, or Alt 2"| deny005
    rows --> bizChk
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class redact,rows dec
    class dec005 alt
    class deny005,omit fail
    class showAll ok
```

## WF-ACCESS-001 Part 3 — Calling actions (B7), notifications, exports, duplicate previews (20 nodes)

```mermaid
flowchart LR
    start3(["A calling action, notification, export or duplicate warning involves a business"])
    kind3{"Output or action type"}
    subgraph callP ["Calling actions (contract B7, R-02)"]
        b7{"Access check passes for the acting user, assignee included?"}
        proceed[["Calling action continues in WF-CALL-002, WF-CALL-003 or WF-FOLLOW-001"]]
        agentDen(["Agent: action denied, Record hidden by policy, no business data"])
        b7cls["Assigned but inaccessible (derived): shown to Owner for a decision; no automatic reassignment"]
        ownerDec[["Owner decides; any reassignment via WF-CALL-001 (B8)"]]
    end
    subgraph notifP ["Notifications and reminders (C6)"]
        notif["System re-checks recipient account and access at send time"]
        notifRes{"Send-time result"}
        notifOk(["Message includes only allowed business details"])
        notifNo[["Denied: no business data; suppress or redact in WF-NOTIFY-001; suppression visible to Owner (D6)"]]
    end
    subgraph expP ["Exports"]
        export{"Requester is the Owner?"}
        expDeny(["Export denied"])
        expRow{"Per-row Access check as the row's resource type (Owner: full scope, C1)"}
        expIn(["Row included; export audited (WF-REPORT-001)"])
        expOut(["Row excluded and not counted"])
    end
    subgraph dupP ["Duplicate warning"]
        dupRead{"Can U read the matched business? (matching itself ignores visibility, C3)"}
        dupFull(["Preview within permissions; Owner sees full record"])
        dupMin(["Existence only: already exists; extra detail per DEC-003"])
        escal["Request escalation: only if adopted under DEC-003"]
    end
    start3 --> kind3
    kind3 -->|"Calling action"| b7
    kind3 -->|"Notification or reminder"| notif
    kind3 -->|"Export"| export
    kind3 -->|"Duplicate warning"| dupRead
    b7 -->|"Passes"| proceed
    b7 -->|"Fails for the assignee"| agentDen
    agentDen -.-> b7cls
    b7cls -.-> ownerDec
    notif --> notifRes
    notifRes -->|"Allowed"| notifOk
    notifRes -->|"Denied"| notifNo
    export -->|"No"| expDeny
    export -->|"Yes"| expRow
    expRow -->|"Allowed"| expIn
    expRow -->|"Denied"| expOut
    dupRead -->|"Readable, or Owner"| dupFull
    dupRead -->|"Not readable"| dupMin
    dupMin -.->|"Only if adopted"| escal
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class b7,notif,dupMin,escal,expRow dec
    class b7cls derived
    class expDeny,expOut,agentDen fail
    class notifOk,expIn,dupFull ok
```

Note (WF-ACCESS-001 Part 2, as drawn): `deny005` sits outside the `devP` subgraph so its edge label does not overlap the node (board repair, layout only).

Note: the B7 path carries no "fails for a non-assignee" branch on purpose: a non-assignee is denied earlier by SM-VISIBILITY-001 step 6 and never reaches the B7 classification.

## SM-VISIBILITY-001 Part 1 — Evaluation steps 1 to 6, incl. R-11 readings (18 nodes)

Decision flow, not a state machine (no stored states), hence `flowchart LR`.

```mermaid
flowchart LR
    req(["Request: user U, action X, resource R, time now"])
    subgraph sessP ["Steps 1 to 2b: account and session"]
        active{"Step 1: U's account active?"}
        authn{"Step 2: session authenticated?"}
        pend{"Step 2b: U is Owner with 2FA still pending?"}
        r11{"R-11 reading (USER decision, unselected)"}
    end
    denySess(["Deny: revoked, re-authenticate, or complete 2FA"])
    r11b(["Reading R11-b: only admin actions blocked; scope without the Owner bypass undefined, pending USER decision"])
    subgraph roleP ["Steps 3 to 4: role and action"]
        role["Step 3: System identifies U's role"]
        action{"Step 4: action X permitted for this role on R's type? (table VT-3)"}
    end
    denyAct(["Deny: Permission denied; Call Center or Developer edit offers a correction request"])
    subgraph scopeP ["Steps 5 to 6: base scope and relation (table VT-2)"]
        scDE["Data Entry scope (no DEC ID): Alt DE-1 (drafted) whole directory / Alt DE-2 (drafted) own-created plus correction queue"]
        scCC["Call Center scope: businesses currently assigned to U"]
        scDev["Developer scope: closed-deal and project context; accepted opportunity per DEC-005 (R-12, USER)"]
        inScope{"Step 5: R inside the base scope?"}
        relation{"Step 6: required relation holds? (assignment, creator, assigned developer)"}
    end
    denyScope(["Deny: Permission denied; no data, not counted"])
    toTimer[["Continue: Part 2, step 7 (timer)"]]
    ownerJump[["Owner: steps 5 to 8 skipped (C1, R-01); continue at Part 2, step 9"]]
    req --> active
    active -->|"No"| denySess
    active -->|"Yes"| authn
    authn -->|"No"| denySess
    authn -->|"Yes"| pend
    pend -->|"No"| role
    pend -->|"Yes"| r11
    r11 -->|"Reading R11-a: all access waits for 2FA"| denySess
    r11 -->|"Reading R11-b"| r11b
    role --> action
    action -->|"Not permitted"| denyAct
    action -->|"Permitted: Owner"| ownerJump
    action -->|"Permitted: Data Entry"| scDE
    action -->|"Permitted: Call Center"| scCC
    action -->|"Permitted: Developer"| scDev
    scDE --> inScope
    scCC --> inScope
    scDev --> inScope
    inScope -->|"Outside"| denyScope
    inScope -->|"Inside"| relation
    relation -->|"Missing"| denyScope
    relation -->|"Holds"| toTimer
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class scDev,r11b dec
    class scDE,r11 alt
    class denySess,denyAct,denyScope fail
```

Note: step 3 only identifies the role; role routing is drawn on the step 4 edges so the Owner still passes step 4 (business deletion stays under C-01) before skipping steps 5–8 (R-01). Administrative access before 2FA is denied under both readings [Confirmed]; R-11 concerns everything else.

## SM-VISIBILITY-001 Part 2 — Evaluation steps 7 to 10 (21 nodes)

```mermaid
flowchart LR
    inN(["From Part 1: steps 1 to 6 passed (non-owner)"])
    inO(["From Part 1: Owner, steps 5 to 8 skipped (R-01)"])
    subgraph timerP ["Step 7: 15-day window (DEC-001, unselected)"]
        basis{"Timer basis (DEC-001)"}
        altA["Alt A: 15 days from business creation; no reset"]
        altB["Alt B: 15 days from creation, then from latest call_attempt.logged or follow_up.scheduled (R-07); edits, notes, status tweaks never reset"]
        within{"Now within 15 days of the selected basis?"}
    end
    subgraph excP ["Step 8: active-work exceptions for U (DEC-002, every row unselected)"]
        e1["Row 1 accepted opportunity: Alt A hidden unless extended / Alt B assigned Developer and Call Center"]
        e2["Row 2 closed deal: Alt A hidden unless extended / Alt B Developers company-wide, closed list only"]
        e3["Row 3 active project: Alt A hidden unless extended / Alt B project board until completion"]
        e4["Row 4 completed project: Alt A hidden / Alt B hidden 15 days after delivery"]
        e5["Row 5 scheduled callback: Alt A hidden / Alt B until callback plus 48 h"]
        e6["Row 6 open correction request: Alt A hidden / Alt B Data Entry, in queue, until resolved"]
        excRes{"Does any row, under its selected alternative, grant U access now?"}
    end
    hiddenCls["Hidden for U (derived); record still stored and duplicate-checked"]
    denyHidden(["Deny: Record hidden by policy; omitted and not counted in lists"])
    subgraph stateP ["Steps 9 to 10: resource state and outcome"]
        stChk{"Step 9: current resource state allows X? (C-01 archived or deleted, terminal request, Rejected is do-not-call)"}
        via{"Access granted through"}
    end
    denyState(["Deny, or read-only in this state"])
    full(["Full access for X"])
    limited(["Context-limited access: fields and actions per VT-5 row"])
    owner(["Owner access; audited (C1)"])
    inN --> basis
    basis -->|"Alt A"| altA
    basis -->|"Alt B"| altB
    altA --> within
    altB --> within
    within -->|"Yes"| stChk
    within -->|"No"| e1
    e1 --> e2
    e2 --> e3
    e3 --> e4
    e4 --> e5
    e5 --> e6
    e6 --> excRes
    excRes -->|"No"| hiddenCls
    hiddenCls --> denyHidden
    excRes -->|"Yes"| stChk
    inO --> stChk
    stChk -->|"Not allowed"| denyState
    stChk -->|"Allowed"| via
    via -->|"Window, step 7"| full
    via -->|"Exception, step 8"| limited
    via -->|"Owner"| owner
    classDef dec fill:#FFECBD,stroke:#FFC943,color:#1E1E1E
    classDef alt fill:#FFE0C2,stroke:#FF9E42,color:#1E1E1E
    classDef fail fill:#FFCDC2,stroke:#FF7556,color:#1E1E1E
    classDef ok fill:#CDF4D3,stroke:#66D575,color:#1E1E1E
    classDef derived fill:#C2E5FF,stroke:#3DADFF,color:#1E1E1E
    class basis,excRes,stChk dec
    class altA,altB,e1,e2,e3,e4,e5,e6 alt
    class hiddenCls derived
    class denyHidden,denyState fail
    class full,limited,owner ok
```

## SM-DATAFIX-001 — Data-correction request lifecycle (6 states, all Proposed)

```mermaid
stateDiagram-v2
    direction LR
    state "Submitted" as Submitted
    state "In review" as InReview
    state "Resolved (changes applied)" as Resolved
    state "Closed, no change needed" as NoChange
    state "Rejected (request)" as RejectedReq
    state "Withdrawn" as Withdrawn
    [*] --> Submitted: requester submits
    Submitted --> InReview: reviewer starts review
    InReview --> Submitted: released or reviewer deactivated
    InReview --> InReview: apply blocked
    InReview --> Resolved: changes applied via edit path
    InReview --> NoChange: already correct or fixed
    InReview --> RejectedReq: rejected with reason
    Submitted --> Withdrawn: requester withdraws
    InReview --> Withdrawn: requester withdraws
    Submitted --> NoChange: business unavailable (C-01)
    InReview --> NoChange: business unavailable (C-01)
    Resolved --> [*]
    NoChange --> [*]
    RejectedReq --> [*]
    Withdrawn --> [*]
```

Header meta (T2c): "All states Proposed (ART-01 §14); C-01 transitions policy-dependent; 'Rejected (request)' is not the calling outcome Rejected". No notes or styling inside the state diagram (SB-2 §7).
