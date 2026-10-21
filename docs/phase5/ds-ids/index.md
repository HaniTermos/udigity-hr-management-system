# DS component ID index (Phase 5)

File `GNrhb3DWa6mIhEX6F4Nmvw`. Pages: 20 DS — Foundations `36:2` (board `41:26`), 21 DS — Components `36:3`.

## Variables

| Collection | ID | Modes |
|---|---|---|
| Semantic | `VariableCollectionId:40:3` | Light `40:1`, Dark `40:2` |
| Primitives | `VariableCollectionId:40:2` | Value `40:0` |

Dark frames: `frame.setExplicitVariableModeForCollection(semanticCollection, '40:2')`. Variables are looked up by name (e.g. `surface/default`, `text/primary`, `p/space/16` = Primitives `space/16`).

## Styles

Text styles `ds/Display, ds/H1–H4, ds/Body, ds/Body Strong, ds/Body Small, ds/Label, ds/Label Small, ds/Caption, ds/Overline, ds/Number, ds/Number Large, ds/Number XL`; effects `ds/Elevation/1–3, ds/Focus ring, ds/Focus ring/Danger`; grids `ds/Grid/Desktop content 12-col, ds/Grid/Mobile 4-col, ds/Grid/Baseline 8`. Style IDs: `02-styles.json`.

## Icons

`Icon/<name>` components (20x20, vector layer "Glyph"); IDs in `03-foundation-components.json` → `created.icons`. Swap via a component's INSTANCE_SWAP `Icon` property.

## Components

Property keys include a `#id` suffix; `setProperties` needs the full key (or match on the part before `#`). Variant axes listed as Axis=[values].

| Component | ID | Type | Variant axes | Other properties | Source |
|---|---|---|---|---|---|
| Brand/Logo (placeholder — awaiting supplied file) | `44:342` | set (6) | Size=[Small, Medium, Large]; Surface=[Default, On brand] | — | 03-foundation-components |
| Avatar | `44:358` | set (6) | Size=[Small, Medium, Large]; Tone=[Brand, Neutral] | Initials#44:0 (TEXT) | 03-foundation-components |
| Divider | `44:364` | set (2) | Orientation=[Horizontal, Vertical] | — | 03-foundation-components |
| Placeholder/Box | `44:368` | component | — | Label#44:7 (TEXT), Hint#44:8 (TEXT) | 03-foundation-components |
| Annotation | `44:395` | set (3) | Type=[Note, Interaction, Implementation] | Title#44:9 (TEXT), Body#44:13 (TEXT) | 03-foundation-components |
| Badge/Status | `44:435` | set (12) | Tone=[Neutral, Info, Success, Warning, Danger, Brand]; Size=[Small, Large] | Label#44:17 (TEXT), Show dot#44:30 (BOOLEAN) | 03-foundation-components |
| Badge/Outcome | `44:459` | set (5) | Outcome=[Pending, On hold, Needs another call, Rejected, Accepted] | — | 03-foundation-components |
| Badge/Count | `44:471` | set (4) | Tone=[Neutral, Brand, Danger, On brand] | Count#44:43 (TEXT) | 03-foundation-components |
| Badge/Flag | `44:491` | set (4) | Tone=[Warning, Danger, Info, Neutral] | Label#44:48 (TEXT) | 03-foundation-components |
| Tag | `44:501` | set (3) | Tone=[Neutral, Brand, Outline] | Label#44:53 (TEXT) | 03-foundation-components |
| Chip/Derived | `44:509` | set (2) | Tone=[Neutral, Amber] | Label#44:57 (TEXT) | 03-foundation-components |
| Notice/Policy pending | `44:549` | set (6) | Size=[Block, Inline, Chip]; Tone=[Policy pending, Implementation decision] | DEC#44:60 (TEXT), Body#44:67 (TEXT) | 03-foundation-components |
| Button | `45:305` | set (60) | Variant=[Primary, Secondary, Ghost, Destructive]; Size=[Small, Medium, Large]; State=[Default, Hover, Focus, Disabled, Loading] | Label#45:0 (TEXT), Show icon#45:61 (BOOLEAN), Icon#45:122 (INSTANCE_SWAP) | 04-controls-a |
| IconButton | `45:405` | set (24) | Variant=[Ghost, Secondary, Primary]; Size=[Small, Medium]; State=[Default, Hover, Focus, Disabled] | Icon#45:183 (INSTANCE_SWAP), Show dot#45:208 (BOOLEAN) | 04-controls-a |
| Link | `45:441` | set (8) | Size=[Medium, Small]; State=[Default, Hover, Focus, Disabled] | Label#45:233 (TEXT), Show icon#45:242 (BOOLEAN), Icon#45:251 (INSTANCE_SWAP) | 04-controls-a |
| Checkbox | `45:497` | set (12) | Checked=[False, True, Indeterminate]; State=[Default, Hover, Focus, Disabled] | Label#45:260 (TEXT), Show label#45:273 (BOOLEAN) | 04-controls-a |
| Radio | `45:522` | set (6) | Selected=[False, True]; State=[Default, Focus, Disabled] | Label#45:286 (TEXT) | 04-controls-a |
| Input | `45:796` | set (25) | Type=[Text, Phone, URL, Number, Password]; State=[Default, Filled, Focus, Error, Disabled] | Label#45:293 (TEXT), Show label#45:319 (BOOLEAN), Required#45:345 (BOOLEAN), Value#45:371 (TEXT), Placeholder#45:397 (TEXT), Helper#45:423 (TEXT), Error message#45:449 (TEXT), Show helper#45:475 (BOOLEAN), Show icon#45:501 (BOOLEAN), Icon#45:527 (INSTANCE_SWAP), Country code#45:553 (TEXT), Suffix#45:579 (TEXT) | 04-controls-a |
| Textarea | `45:847` | set (5) | State=[Default, Filled, Focus, Error, Disabled] | Label#45:605 (TEXT), Show label#45:611 (BOOLEAN), Required#45:617 (BOOLEAN), Value#45:623 (TEXT), Placeholder#45:629 (TEXT), Helper#45:635 (TEXT), Error message#45:641 (TEXT), Show helper#45:647 (BOOLEAN), Counter#45:653 (TEXT) | 04-controls-a |
| Field/Metric | `45:891` | set (3) | State=[Value, Empty error, Unknown] | Label#45:659 (TEXT), Show label#45:663 (BOOLEAN), Required#45:667 (BOOLEAN), Value#45:671 (TEXT), Placeholder#45:675 (TEXT), Helper#45:679 (TEXT), Error message#45:683 (TEXT), Show helper#45:687 (BOOLEAN) | 04-controls-a |
| Select | `46:434` | set (18) | Type=[Select, Combobox, Person]; State=[Default, Filled, Focus, Open, Error, Disabled] | Label#46:0 (TEXT), Show label#46:19 (BOOLEAN), Required#46:38 (BOOLEAN), Value#46:57 (TEXT), Placeholder#46:76 (TEXT), Helper#46:95 (TEXT), Error message#46:114 (TEXT), Show helper#46:133 (BOOLEAN) | 05-controls-b |
| Input/Date | `46:594` | set (15) | Type=[Date, Time, Date and time]; State=[Default, Filled, Focus, Error, Disabled] | Label#46:152 (TEXT), Show label#46:168 (BOOLEAN), Required#46:184 (BOOLEAN), Value#46:200 (TEXT), Placeholder#46:216 (TEXT), Helper#46:232 (TEXT), Error message#46:248 (TEXT), Show helper#46:264 (BOOLEAN) | 05-controls-b |
| DatePicker/Day | `46:610` | set (6) | State=[Default, Hover, Today, Selected, Outside, Disabled] | Day#46:280 (TEXT) | 05-controls-b |
| DatePicker | `46:614` | component | — | — | 05-controls-b |
| Input/Search | `46:748` | set (6) | Size=[Small, Medium]; State=[Default, Filled, Focus] | Placeholder#46:287 (TEXT), Value#46:294 (TEXT) | 05-controls-b |
| Chip/Filter | `46:768` | set (4) | State=[Default, Hover, Active, Disabled] | Label#46:301 (TEXT) | 05-controls-b |
| FilterBar | `46:772` | component | — | — | 05-controls-b |
| RadioCard | `46:831` | set (4) | State=[Default, Hover, Selected, Disabled] | Title#46:306 (TEXT), Description#46:311 (TEXT), Show status dot#46:316 (BOOLEAN) | 05-controls-b |
| Nav/Item | `49:652` | set (8) | Density=[Default, Compact]; State=[Default, Hover, Active, Disabled] | Label#49:0 (TEXT), Icon#49:9 (INSTANCE_SWAP), Show badge#49:18 (BOOLEAN) | 06-navigation |
| Nav/SectionLabel | `49:656` | component | — | Label#49:27 (TEXT) | 06-navigation |
| Nav/Sidebar | `49:976` | set (4) | Role=[Owner, Data Entry, Call Center, Developer] | — | 06-navigation |
| Nav/TopBar | `49:980` | component | — | Name#49:28 (TEXT), Role#49:29 (TEXT), Show attendance#49:30 (BOOLEAN), Show search#49:31 (BOOLEAN) | 06-navigation |
| Breadcrumb | `49:1006` | component | — | Level 1#49:32 (TEXT), Level 2#49:33 (TEXT), Current#49:34 (TEXT), Show level 2#49:35 (BOOLEAN) | 06-navigation |
| Tabs/Item | `49:1050` | set (8) | Style=[Underline, Segmented]; State=[Default, Hover, Active, Disabled] | Label#49:36 (TEXT), Show count#49:45 (BOOLEAN) | 06-navigation |
| Tabs | `49:1198` | set (8) | Style=[Underline, Segmented]; Active=[1, 2, 3, 4] | — | 06-navigation |
| Shell/Mobile/Header | `49:1219` | set (2) | Back=[False, True] | Title#49:54 (TEXT), Subtitle#49:57 (TEXT), Show subtitle#49:60 (BOOLEAN) | 06-navigation |
| Shell/Mobile/Tab | `49:1232` | set (2) | State=[Default, Active] | Label#49:63 (TEXT), Icon#49:66 (INSTANCE_SWAP) | 06-navigation |
| Shell/Mobile/TabBar | `49:1588` | set (16) | Role=[Owner, Data Entry, Call Center, Developer]; Active=[1, 2, 3, 4] | — | 06-navigation |
| Shell/Desktop | `49:1926` | set (4) | Role=[Owner, Data Entry, Call Center, Developer] | — | 06-navigation |
| Shell/Mobile | `49:2034` | set (4) | Role=[Owner, Data Entry, Call Center, Developer] | — | 06-navigation |
| Table/HeaderCell | `51:1599` | set (6) | Align=[Left, Right]; Sort=[None, Ascending, Descending] | Label#51:0 (TEXT) | 07-data-display |
| Table/Cell | `51:1634` | set (8) | Type=[Text, Text with meta, Number, Status, Link, Avatar, Checkbox, Actions] | Text#51:7 (TEXT), Meta#51:16 (TEXT) | 07-data-display |
| Table/HeaderRow | `51:1638` | component | — | — | 07-data-display |
| Table/Row | `51:1740` | set (3) | State=[Default, Hover, Selected] | — | 07-data-display |
| Table/Pagination | `51:1744` | component | — | Range#51:25 (TEXT) | 07-data-display |
| Card/Surface | `51:1772` | component | — | Content#51:26 (SLOT) | 07-data-display |
| Card/Section | `51:1780` | component | — | Content#51:27 (SLOT), Title#51:28 (TEXT), Subtitle#51:29 (TEXT), Show subtitle#51:30 (BOOLEAN), Show action#51:31 (BOOLEAN) | 07-data-display |
| Card/Inset | `51:1797` | component | — | Content#51:32 (SLOT) | 07-data-display |
| Card/Metric | `51:1842` | set (5) | Trend=[Up, Down, Flat, Pending, Loading] | Label#51:33 (TEXT), Value#51:39 (TEXT), Delta#51:45 (TEXT), Caption#51:51 (TEXT), Show caption#51:57 (BOOLEAN) | 07-data-display |
| List/Item | `51:1870` | set (2) | State=[Default, Hover] | Title#51:63 (TEXT), Meta#51:66 (TEXT), Icon#51:69 (INSTANCE_SWAP), Show leading#51:72 (BOOLEAN), Show badge#51:75 (BOOLEAN), Show chevron#51:78 (BOOLEAN) | 07-data-display |
| List/KeyValue | `51:1888` | set (3) | Type=[Default, Check, Not recorded] | Key#51:81 (TEXT), Value#51:85 (TEXT) | 07-data-display |
| Progress/Bar | `51:1916` | set (4) | Tone=[Brand, Success, Warning, Danger] | Label#51:89 (TEXT), Value#51:94 (TEXT), Show labels#51:99 (BOOLEAN) | 07-data-display |
| Menu/Item | `51:1984` | set (16) | Type=[Default, Icon, Avatar, Destructive]; State=[Default, Hover, Selected, Disabled] | Label#51:104 (TEXT), Icon#51:121 (INSTANCE_SWAP) | 07-data-display |
| Menu | `51:1988` | component | — | — | 07-data-display |
| Overlay/Scrim | `53:1814` | set (2) | Size=[Desktop, Mobile] | — | 08-overlays-feedback |
| Dialog | `53:1818` | component | — | Content#53:0 (SLOT), Title#53:1 (TEXT), Description#53:2 (TEXT), Show description#53:3 (BOOLEAN), Show footer#53:4 (BOOLEAN), Show close#53:5 (BOOLEAN) | 08-overlays-feedback |
| Drawer | `53:1846` | component | — | Content#53:6 (SLOT), Footer#53:7 (SLOT), Title#53:8 (TEXT), Subtitle#53:9 (TEXT), Show subtitle#53:10 (BOOLEAN) | 08-overlays-feedback |
| Banner | `53:1960` | set (8) | Tone=[Info, Success, Warning, Error]; Size=[Default, Inline] | Title#53:11 (TEXT), Body#53:20 (TEXT), Show title#53:29 (BOOLEAN), Show action#53:38 (BOOLEAN), Show close#53:47 (BOOLEAN) | 08-overlays-feedback |
| Banner/ErrorSummary | `53:1964` | component | — | Errors#53:56 (SLOT), Title#53:57 (TEXT) | 08-overlays-feedback |
| Toast | `53:2032` | set (4) | Tone=[Info, Success, Warning, Error] | Title#53:58 (TEXT), Body#53:63 (TEXT), Show body#53:68 (BOOLEAN) | 08-overlays-feedback |
| State | `53:2155` | set (12) | Type=[Empty, No results, Loading, Error, Session expired, Save conflict]; Size=[Page, Inline] | Show action#53:73 (BOOLEAN) | 08-overlays-feedback |
| Skeleton | `53:2172` | set (4) | Type=[Text line, Avatar, Table row, Card] | — | 08-overlays-feedback |
| Notice/Access | `53:2240` | set (6) | Type=[Permission denied, Hidden by policy, Context-limited]; Size=[Page, Inline] | — | 08-overlays-feedback |
| Calendar/Event | `54:2024` | set (5) | Kind=[Follow-up, Meeting, Task, Overdue, Done] | Time#54:0 (TEXT), Title#54:6 (TEXT) | 09-domain-a |
| Calendar/Week | `54:2028` | component | — | — | 09-domain-a |
| Calendar/Day | `54:2120` | component | — | Date#54:12 (TEXT) | 09-domain-a |
| Card/Task | `54:2196` | set (2) | State=[Default, Done] | Title#54:13 (TEXT), Project#54:16 (TEXT), Due#54:19 (TEXT), Show chip#54:22 (BOOLEAN), Show notice#54:25 (BOOLEAN) | 09-domain-a |
| Kanban/Column | `54:2200` | component | — | Cards#54:28 (SLOT), Title#54:29 (TEXT), Show add#54:30 (BOOLEAN) | 09-domain-a |
| Timeline/Item | `54:2309` | set (5) | Type=[Call attempt, Follow-up, Status change, Note, Upcoming] | Title#54:31 (TEXT), Time#54:37 (TEXT), Body#54:43 (TEXT), Show connector#54:49 (BOOLEAN) | 09-domain-a |
| Timeline/Milestone | `54:2333` | set (4) | State=[Achieved, Current, Upcoming, Final] | Label#54:55 (TEXT), Date#54:60 (TEXT) | 09-domain-a |
| Timeline/Horizontal | `54:2337` | component | — | — | 09-domain-a |
| ListItem/Note | `54:2384` | set (2) | Accent=[Neutral, Amber] | Author#54:65 (TEXT), Time#54:68 (TEXT), Body#54:71 (TEXT) | 09-domain-a |
| Attendance/Timer | `55:2215` | set (3) | State=[Not checked in, Checked in, Closed] | — | 10-domain-b |
| Attendance/VerificationStatus | `55:2243` | set (4) | State=[Verifying, Passed, Failed, Remote exception] | — | 10-domain-b |
| Attendance/Panel | `55:2399` | set (5) | State=[Not checked in, Verifying, Checked in, Verification failed, Checked out] | — | 10-domain-b |
| Notice/Duplicate | `55:2439` | set (2) | Match=[Visible match, Hidden match] | — | 10-domain-b |
| Banner/Reservation | `55:2533` | set (12) | State=[Reserved by me, Reserved by other, Expiring, Expired, Override, Offline]; Size=[Banner, Chip] | Show policy#55:0 (BOOLEAN) | 10-domain-b |
| Queue/BucketHeader | `55:2549` | set (2) | Expanded=[True, False] | Label#55:13 (TEXT) | 10-domain-b |
| Queue/Row | `55:2596` | set (3) | State=[Default, Hover, Selected] | Name#55:16 (TEXT), Meta#55:20 (TEXT), Show flag#55:24 (BOOLEAN) | 10-domain-b |
| Row/Phone | `55:2600` | component | — | Number#55:28 (TEXT), Show copy#55:29 (BOOLEAN) | 10-domain-b |
| Row/Social | `55:2629` | set (2) | Metrics=[Recorded, Not recorded] | Platform#55:30 (TEXT), Handle#55:33 (TEXT) | 10-domain-b |
| Chart/Legend | `56:2484` | set (6) | Series=[1, 2, 3, 4, 5, 6] | Label#56:0 (TEXT) | 11-charts |
| Chart/Bar | `56:2566` | set (2) | Type=[Single, Grouped] | — | 11-charts |
| Chart/Line | `56:2570` | component | — | — | 11-charts |

Slots (native): Card/Surface, Card/Section, Card/Inset › Content; Dialog › Content; Drawer › Content, Footer; Banner/ErrorSummary › Errors; Kanban/Column › Cards. Slot property names kept their defaults where rename failed (key shown above as `Content#…` etc.).
