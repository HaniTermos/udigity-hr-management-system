// docs/phase7/scripts/shared/P40-03-attendance-correction-profile.js — Phase 7 prototype wiring (P40-03, page 96:2)
const SCRIPT_ID = 'P40-03', PAGE_ID = '96:2';
// Shared role agent, 2026-10-23. Flow map: docs/phase7/flows/shared.md. Decisions: coordination [P7-1] D1–D6 + orchestrator answers to U-1…U-15.
// Run via use_figma: async body (top-level await/return). Idempotent: setReactionsAsync REPLACES each own hotspot's reactions;
// cleared hotspots get []; own flow starts are replaced by nodeId; auto "Flow N" entries created on own frames are removed.
// Never detaches, never moves/resizes instance children, deletes nothing. Only page-level change besides reactions:
// overflowDirection = VERTICAL on plain «Content» frames of mobile frames (scroll).
const page = await figma.getNodeByIdAsync(PAGE_ID);
await figma.setCurrentPageAsync(page);

// ---- helpers inlined from docs/phase7/wiring-helpers.js [OP-P7-1] ----
const FILE_KEY = 'GNrhb3DWa6mIhEX6F4Nmvw';
const DISSOLVE_200 = { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.2 };
let _frames = null;
function frameByName(nameOrRe) {
  if (!_frames) _frames = figma.currentPage.findAllWithCriteria({ types: ['FRAME'] })
    .filter(f => f.parent && (f.parent.type === 'PAGE' || f.parent.type === 'SECTION'));
  const test = nameOrRe instanceof RegExp ? (n) => nameOrRe.test(n) : (n) => n === nameOrRe;
  return _frames.find(f => test(f.name)) || null;
}
const nav = (destId, transition = DISSOLVE_200) =>
  ({ type: 'NODE', destinationId: destId, navigation: 'NAVIGATE', transition, resetScrollPosition: true });
const url = (nodeIdOrUrl) => ({
  type: 'URL', openInNewTab: false,
  url: /^https?:/.test(nodeIdOrUrl) ? nodeIdOrUrl
    : `https://www.figma.com/design/${FILE_KEY}?node-id=${String(nodeIdOrUrl).replace(':', '-')}`,
});
const back = () => ({ type: 'BACK' });
async function onClick(node, action, report) {
  if (!node) return false;
  try { await node.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [action] }]); return true; }
  catch (e) { if (report) report.push({ id: node.id, name: node.name, err: String(e) }); return false; }
}
function setFlow(frame, name) {
  const pg = figma.currentPage;
  const keep = pg.flowStartingPoints.filter(f => f.nodeId !== frame.id && f.name !== name);
  pg.flowStartingPoints = [...keep, { nodeId: frame.id, name }];
  return { nodeId: frame.id, name };
}

// ---- shared-agent extensions ----
const D150 = { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.15 };
const SMART = { type: 'SMART_ANIMATE', easing: { type: 'EASE_OUT' }, duration: 0.2 };
const R = { script: SCRIPT_ID, page: PAGE_ID, wired: 0, cleared: 0, scroll: 0, missingTargets: [], missingHotspots: [], flows: [], errors: [] };
const touched = new Set();
const T = {};
// Load frames: [key, exact name, fallback id from docs/phase6/previews/<page>/index.md]
async function load(rows) {
  for (const [k, name, id] of rows) {
    let f = frameByName(name);
    if (!f && id) {
      const n = await figma.getNodeByIdAsync(id);
      let p = n && n.parent; while (p && p.type !== 'PAGE') p = p.parent;
      if (n && n.type === 'FRAME' && p && p.id === figma.currentPage.id) f = n;
    }
    if (!f) R.missingTargets.push(`${k}: ${name} [${id}]`);
    T[k] = f;
  }
}
const N = (f, tr = DISSOLVE_200) => (f ? nav(f.id, tr) : null);
const U = (id) => url(id);
const sm = (n, s) => n.type !== 'TEXT' && n.visible !== false && (s instanceof RegExp ? s.test(n.name) : n.name === s);
function walk(scope, segs) { for (const s of segs) { if (!scope) return null; scope = scope.findOne(n => sm(n, s)); } return scope; }
function textHit(scope, re) {
  const t = scope.findOne(n => n.type === 'TEXT' && n.visible !== false && (re instanceof RegExp ? re.test(n.characters) : n.characters === re));
  if (!t) return null;
  let p = t.parent; while (p && p !== scope && p.type !== 'INSTANCE' && p.type !== 'FRAME') p = p.parent;
  return p && p !== scope ? p : t;
}
// Spec forms: 'Exact name' | /name re/ | ['Parent', /Child/, …] path | {in:[path], text:'…'|/re/}
function H(frame, specs) {
  for (const sp of specs) {
    let hit = null;
    if (Array.isArray(sp)) hit = walk(frame, sp);
    else if (sp && typeof sp === 'object' && !(sp instanceof RegExp)) { const sc = sp.in ? walk(frame, sp.in) : frame; hit = sc ? textHit(sc, sp.text) : null; }
    else hit = frame.findOne(n => sm(n, sp));
    if (hit) return hit;
  }
  return null;
}
const short = (f) => f.name.replace(/^SCR-/, '').replace(/ — (Desktop|Mobile)/, ' $1');
// Wire one hotspot (first spec that resolves).
async function W(f, specs, action, label) {
  if (!f) return;
  if (!action) { R.missingTargets.push(`${short(f)} :: ${label} (target)`); return; }
  const node = H(f, specs);
  if (!node) { R.missingHotspots.push(`${short(f)} :: ${label}`); return; }
  touched.add(f.id);
  if (await onClick(node, action, R.errors)) R.wired++;
}
// Wire every match (e.g. all «Item · …» rows).
async function WA(f, re, action, label) {
  if (!f || !action) return;
  const ns = f.findAll(n => sm(n, re));
  if (!ns.length) { R.missingHotspots.push(`${short(f)} :: ${label} (0 matches)`); return; }
  touched.add(f.id);
  for (const n of ns) if (await onClick(n, action, R.errors)) R.wired++;
}
// Whole-frame ON_CLICK (child hotspots still win).
async function WF(f, action, label) {
  if (!f) return;
  if (!action) { R.missingTargets.push(`${short(f)} :: ${label} (target)`); return; }
  touched.add(f.id);
  if (await onClick(f, action, R.errors)) R.wired++;
}
// Clear reactions on a hotspot that must stay unwired (policy default / no target frame).
async function C(f, specs, label) {
  if (!f) return;
  const node = H(f, specs);
  if (!node) return;
  try { if ((node.reactions || []).length) { await node.setReactionsAsync([]); R.cleared++; } } catch (e) { R.errors.push({ id: node.id, name: node.name, err: String(e) }); }
}
// Table row by visible date text, then the link inside it.
function rowLink(f, dateRe, linkRe) {
  const rows = f.findAll(n => n.type !== 'TEXT' && /row/i.test(n.name) && n.findOne && n.findOne(t => t.type === 'TEXT' && dateRe.test(t.characters)));
  rows.sort((a, b) => (a.findAll ? a.findAll(() => true).length : 0) - (b.findAll ? b.findAll(() => true).length : 0));
  for (const r of rows) {
    const l = r.findOne(n => n.type === 'INSTANCE' && n.visible !== false && (linkRe.test(n.name) || !!n.findOne(t => t.type === 'TEXT' && linkRe.test(t.characters))) && /link/i.test(n.name));
    if (l) return l;
  }
  return null;
}
async function WR(f, dateRe, linkRe, action, label) {
  if (!f) return;
  if (!action) { R.missingTargets.push(`${short(f)} :: ${label} (target)`); return; }
  const node = rowLink(f, dateRe, linkRe);
  if (!node) { R.missingHotspots.push(`${short(f)} :: ${label}`); return; }
  touched.add(f.id);
  if (await onClick(node, action, R.errors)) R.wired++;
}
// Vertical scroll on the plain «Content» frame (skipped if it sits inside an instance).
function SCROLL(f) {
  if (!f) return;
  const c = f.findOne(n => n.type === 'FRAME' && n.name === 'Content');
  if (!c) return;
  let p = c.parent; while (p && p !== f) { if (p.type === 'INSTANCE') return; p = p.parent; }
  try { if (c.overflowDirection !== 'VERTICAL') c.overflowDirection = 'VERTICAL'; R.scroll++; } catch (e) { R.errors.push({ id: c.id, name: 'Content scroll', err: String(e) }); }
}
const FLOWS = [];
const FL = (key, name) => FLOWS.push([key, name]);
function finishFlows() {
  const pg = figma.currentPage;
  pg.flowStartingPoints = pg.flowStartingPoints.filter(fp => !(/^Flow \d+$/.test(fp.name) && touched.has(fp.nodeId)));
  for (const [k, name] of FLOWS) { const f = T[k]; if (!f) { R.missingTargets.push(`flow start ${k}: ${name}`); continue; } setFlow(f, name); R.flows.push(name); }
}
// Common hotspots on Dialog / Drawer overlays (scrim baked into the frame).
const DLG = /^Dialog · /, DRW = /^Drawer · /;
const XBTN = /^(Close|Close button|Dismiss|Icon ?[Bb]utton.*|Button · Close)$/;
const HDRBACK = [['Header', /^(Back|Back button|Leading|Icon ?[Bb]utton.*|Button · Back|Chevron.*)$/]];

// ================= P40-03 — My Attendance, correction request (SCR-SHR-005), My Profile, profile save conflict =================
// DEC-011 working default = Alt B (employee request → Owner decides): the whole correction flow is wired.
// Rule 4: no Dark reactions on the profile theme pair (not a mobile-priority flow) — cleared if present.
const S4 = 'SCR-SHR-004 — My Attendance — ', S5 = 'SCR-SHR-005 — Correction request — ', S6 = 'SCR-SHR-006 — My Profile — ';
await load([
  ['DAY_L', 'SCR-SHR-001 — My Day — Desktop — Light', '303:10513'], ['DAY_ML', 'SCR-SHR-001 — My Day — Mobile — Light', '303:11195'],
  ['DAY_OPEN', 'SCR-SHR-001 — My Day — Desktop — Light — Open session from earlier day', '303:12029'],
  ['CI_BLOCK', 'SCR-SHR-002 — Check-in — Desktop — Light — Open-session block', '186:11739'],
  ['ATT_L', S4 + 'Desktop — Light', '188:10468'], ['ATT_ML', S4 + 'Mobile — Light', '188:11151'],
  ['ATT_EMPTY', S4 + 'Desktop — Light — Empty', '188:11333'], ['ATT_FORGOT', S4 + 'Desktop — Light — Forgotten checkout flagged', '188:11472'],
  ['ATT_PROV', S4 + 'Desktop — Light — Provisional & pending review rows (if adopted)', '188:11829'],
  ['ATT_OUT', S4 + 'Desktop — Light — Correction outcomes', '188:12170'], ['ATT_LOAD', S4 + 'Desktop — Light — Loading', '188:12513'],
  ['COR_L', S5 + 'Desktop — Light', '118:56264'], ['COR_ML', S5 + 'Mobile — Light', '118:57215'],
  ['COR_ERR', S5 + 'Desktop — Light — Validation error', '118:57304'], ['COR_PEND', S5 + 'Desktop — Light — Submitted (pending)', '118:57781'],
  ['COR_APP', S5 + 'Desktop — Light — Approved', '118:58222'], ['COR_REJ', S5 + 'Desktop — Light — Rejected', '118:58633'],
  ['PRO_L', S6 + 'Desktop — Light', '189:10468'], ['PRO_D', S6 + 'Desktop — Dark', '189:10802'], ['PRO_ML', S6 + 'Mobile — Light', '189:11118'],
  ['PRO_ERR', S6 + 'Desktop — Light — Validation error', '189:11264'], ['PRO_CONF', S6 + 'Desktop — Light — Save conflict', '189:11584'],
  ['PRO_OK', S6 + 'Desktop — Light — Success', '189:11868'],
  ['LOGIN_L', 'SCR-AUTH-001 — Login — Desktop — Light', '169:10438'], ['LOGIN_M', 'SCR-AUTH-001 — Login — Mobile — Light', '169:10607'],
]);
const NOTIF = '165:2880', CONF_L = '270:2918';
async function shell(f, chipAction) {
  if (!f) return;
  const go = (t) => (t && t !== f ? N(t) : null);
  if (go(T.DAY_L)) await W(f, [/^Nav\/Item · My Day/], go(T.DAY_L), 'nav My Day');
  if (go(T.ATT_L)) await W(f, [/^Nav\/Item · (My )?Attendance/], go(T.ATT_L), 'nav My Attendance');
  if (go(T.PRO_L)) await W(f, [/^Nav\/Item · (My )?Profile/], go(T.PRO_L), 'nav My Profile');
  await W(f, [/^Nav\/Item · Calling Queue/], U('311:13767'), 'nav Calling Queue');
  await W(f, [/^Nav\/Item · Follow-ups/], U('285:13809'), 'nav Follow-ups & Calendar');
  await W(f, [['TopBar', 'Notifications']], U(NOTIF), 'bell → Notifications');
  if (go(T.PRO_L)) await W(f, [['TopBar', 'Avatar']], go(T.PRO_L), 'avatar → My Profile');
  if (chipAction) await W(f, [['TopBar', 'Attendance']], chipAction, 'attendance chip');
}
const OCT = [/^Filter · October 2026/, { in: ['Period filters'], text: /^October 2026/ }];
const DRW_PRI = [[DRW, 'Footer actions', 'Primary action'], [DRW, 'Primary action'], 'Primary action'];
const MON19 = /Mon(day)?,? 19 Oct/;

// --- Flow 6: open session → block → attendance → correction request → pending → outcomes ---
await shell(T.DAY_OPEN, N(T.CI_BLOCK, D150));
await W(T.DAY_OPEN, [['My work list', 'Action']], U('311:13767'), 'Open queue → SCR-CC-001');
await WA(T.DAY_OPEN, /^Item · /, U('312:13759'), 'work items → SCR-CC-002');
await W(T.CI_BLOCK, [[DLG, 'Primary action']], N(T.ATT_FORGOT), 'View my attendance → Forgotten checkout');
await W(T.CI_BLOCK, [[DLG, 'Secondary action']], back(), 'Close → Back');
await W(T.CI_BLOCK, [[DLG, XBTN]], back(), '× → Back');
await shell(T.ATT_FORGOT);
await WR(T.ATT_FORGOT, MON19, /Request correction/, N(T.COR_L, D150), 'Mon 19 Oct · Request correction → Correction request');
await W(T.COR_L, DRW_PRI, N(T.COR_PEND, SMART), 'Submit request → Submitted (pending)');
await W(T.COR_L, [[DRW, 'Footer actions', 'Cancel'], [DRW, 'Cancel']], back(), 'Cancel → Back');
await W(T.COR_L, [[DRW, XBTN]], back(), '× → Back');
await W(T.COR_PEND, DRW_PRI, N(T.ATT_OUT), 'Close → Correction outcomes');
await W(T.COR_PEND, [[DRW, 'Withdraw'], 'Withdraw'], N(T.ATT_FORGOT), 'Withdraw request → Forgotten checkout (Withdrawn not drawn)');
await W(T.COR_PEND, [[DRW, XBTN]], N(T.ATT_OUT), '× → Correction outcomes');
await shell(T.ATT_OUT);
await WR(T.ATT_OUT, MON19, /View|Pending|correction/i, N(T.COR_PEND, D150), 'Mon 19 Oct (pending) · View → Submitted (pending)');
// branches / references
await W(T.COR_ERR, DRW_PRI, N(T.COR_PEND, SMART), 'Submit request → Submitted (pending)');
await W(T.COR_ERR, [[DRW, 'Footer actions', 'Cancel'], [DRW, 'Cancel']], N(T.ATT_FORGOT), 'Cancel → Forgotten checkout');
for (const k of ['COR_APP', 'COR_REJ']) { await W(T[k], DRW_PRI, N(T.ATT_OUT), 'Close → Correction outcomes'); await W(T[k], [[DRW, XBTN]], N(T.ATT_OUT), '× → Correction outcomes'); }

// --- My Attendance ---
await shell(T.ATT_L);
await W(T.ATT_L, [/^Filter · Custom range/, { in: ['Period filters'], text: /^Custom range/ }], N(T.ATT_EMPTY), 'Custom range → Empty');
await shell(T.ATT_EMPTY);
await W(T.ATT_EMPTY, [[/^State · Empty/, 'Action'], { text: /^Show October 2026/ }], N(T.ATT_L), 'Show October 2026 → My Attendance');
for (const k of ['ATT_FORGOT', 'ATT_PROV', 'ATT_OUT']) await W(T[k], OCT, N(T.ATT_L), 'October 2026 filter → My Attendance');
await shell(T.ATT_PROV); await shell(T.ATT_LOAD);
// mobile
await W(T.ATT_ML, [{ in: ['TabBar'], text: /^My Day$/ }, ['TabBar', 'Tab 1']], N(T.DAY_ML), 'tab My Day');
await W(T.COR_ML, [['Footer', 'Cancel'], 'Cancel'], back(), 'Cancel → Back');
await W(T.COR_ML, HDRBACK, back(), 'header back → Back');
await W(T.COR_ML, [['Footer', 'Submit'], 'Submit'], N(T.ATT_ML), 'Submit → My Attendance (closest existing mobile frame; no mobile Submitted)');
SCROLL(T.ATT_ML); SCROLL(T.COR_ML);

// --- Flow 7: Profile and session ---
const SAVE = [['Detail actions', 'Save changes'], 'Save changes'];
const SIGNOUT = [['Sign-out actions', 'Sign out'], 'Sign out'];
for (const k of ['PRO_L', 'PRO_ERR', 'PRO_OK', 'PRO_CONF']) await shell(T[k]);
await W(T.PRO_L, SAVE, N(T.PRO_OK, SMART), 'Save changes → Success');
await W(T.PRO_ERR, SAVE, N(T.PRO_OK, SMART), 'Save changes → Success');
for (const k of ['PRO_L', 'PRO_OK']) {
  await W(T[k], SIGNOUT, N(T.LOGIN_L), 'Sign out → Login');
  await W(T[k], ['Sign out all', { text: 'Sign out of all sessions' }], N(T.LOGIN_L), 'Sign out of all sessions → Login');
}
for (const k of ['PRO_L', 'PRO_D']) for (const th of ['Theme · Dark', 'Theme · Light']) await C(T[k], [th], th + ' (rule 4: no Dark reactions off mobile-priority flows)');
await W(T.PRO_ML, [['Sign-out actions', 'Sign out'], 'Sign out'], N(T.LOGIN_M), 'Sign out → Login (mobile)');
await W(T.PRO_ML, [{ in: ['TabBar'], text: /^My Day$/ }, ['TabBar', 'Tab 1']], N(T.DAY_ML), 'tab My Day');
SCROLL(T.PRO_ML);
// --- Flow 9d: profile save conflict (D1 alternative of Save changes) ---
await W(T.PRO_CONF, [['Conflict actions', 'Review changes'], 'Review changes'], U(CONF_L), 'Review changes → SCR-SHR-014 (p45)');
await W(T.PRO_CONF, [['Conflict actions', 'Reload latest'], 'Reload latest'], N(T.PRO_L), 'Reload latest → My Profile');

FL('DAY_OPEN', 'P7 — Call Center — My Attendance → correction request');
FL('ATT_L', 'P7 — Call Center — My Attendance');
FL('COR_APP', 'P7 — Call Center — My Attendance → correction request (approved)');
FL('COR_REJ', 'P7 — Call Center — My Attendance → correction request (rejected)');
FL('PRO_L', 'P7 — Call Center — Profile and session');
FL('PRO_CONF', 'P7 — Call Center — Profile and session (save conflict)');

finishFlows();
return R;
