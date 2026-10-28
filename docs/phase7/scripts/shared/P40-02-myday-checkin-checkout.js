// docs/phase7/scripts/shared/P40-02-myday-checkin-checkout.js — Phase 7 prototype wiring (P40-02, page 96:2)
const SCRIPT_ID = 'P40-02', PAGE_ID = '96:2';
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

// ================= P40-02 — My Day (desktop + mobile L/D), check-in, checkout =================
// Policy working defaults (docs/policy-defaults.md): DEC-010 no self-service remote-exception request (link unwired;
// "Remote exception recorded" = Owner-granted exception, own flow); DEC-012 summary mandatory (Summary-empty Check out unwired);
// DEC-026 Alt B provisional (failed-check Check out → Alt B frame). U-8: helper has ON_CLICK only → Verifying uses a whole-frame click.
const S1 = 'SCR-SHR-001 — My Day — ', S2 = 'SCR-SHR-002 — Check-in — ', S3 = 'SCR-SHR-003 — Checkout — ';
await load([
  ['DAY_L', S1 + 'Desktop — Light', '303:10513'], ['DAY_ML', S1 + 'Mobile — Light', '303:11195'], ['DAY_MD', S1 + 'Mobile — Dark', '303:11447'],
  ['DAY_NOTIN', S1 + 'Desktop — Light — Not checked in', '303:11699'], ['DAY_EMPTY', S1 + 'Desktop — Light — Empty work list', '303:12328'],
  ['DAY_INSUFF', S1 + 'Desktop — Light — Insufficient work', '303:12581'], ['DAY_LOAD', S1 + 'Desktop — Light — Loading', '303:12886'],
  ['CI_L', S2 + 'Desktop — Light', '186:10469'], ['CI_ML', S2 + 'Mobile — Light', '186:11076'], ['CI_MD', S2 + 'Mobile — Dark', '186:11147'],
  ['CI_VER', S2 + 'Desktop — Light — Verifying', '186:11216'], ['CI_FAIL', S2 + 'Desktop — Light — Verification failure', '186:11473'],
  ['CI_REMOTE', S2 + 'Desktop — Light — Remote exception recorded', '186:11990'],
  ['CO_L', S3 + 'Desktop — Light', '187:10469'], ['CO_ML', S3 + 'Mobile — Light', '187:11125'], ['CO_MD', S3 + 'Mobile — Dark', '187:11197'],
  ['CO_EMPTY', S3 + 'Desktop — Light — Summary empty', '187:11267'], ['CO_FAIL', S3 + 'Desktop — Light — Verification failure', '187:11591'],
  ['CO_ALTA', S3 + 'Desktop — Light — DEC-026 Alt A blocked (not selected)', '187:11929'],
  ['CO_ALTB', S3 + 'Desktop — Light — DEC-026 Alt B provisional (not selected)', '187:12212'],
  ['CO_ALTC', S3 + 'Desktop — Light — DEC-026 Alt C pending review (not selected)', '187:12496'],
  ['CO_CLOSED', S3 + 'Desktop — Light — Closed', '187:12780'],
  ['ATT_L', 'SCR-SHR-004 — My Attendance — Desktop — Light', '188:10468'],
  ['PRO_L', 'SCR-SHR-006 — My Profile — Desktop — Light', '189:10468'], ['PRO_ML', 'SCR-SHR-006 — My Profile — Mobile — Light', '189:11118'],
]);
const CC001 = { L: '311:13767', ML: '311:15277', MD: '311:15490' }, CC002 = { L: '312:13759', ML: '312:15793', MD: '312:15962' }, CC004 = { L: '285:13809', ML: '285:15486', MD: '285:15628' };
const NOTIF = '165:2880';
async function shell(f, chipAction) {
  if (!f) return;
  const go = (t) => (t && t !== f ? N(t) : null);
  if (go(T.DAY_L)) await W(f, [/^Nav\/Item · My Day/], go(T.DAY_L), 'nav My Day');
  if (go(T.ATT_L)) await W(f, [/^Nav\/Item · (My )?Attendance/], go(T.ATT_L), 'nav My Attendance');
  if (go(T.PRO_L)) await W(f, [/^Nav\/Item · (My )?Profile/], go(T.PRO_L), 'nav My Profile');
  await W(f, [/^Nav\/Item · Calling Queue/], U(CC001.L), 'nav Calling Queue');
  await W(f, [/^Nav\/Item · Follow-ups/], U(CC004.L), 'nav Follow-ups & Calendar');
  await W(f, [['TopBar', 'Notifications']], U(NOTIF), 'bell → Notifications');
  if (go(T.PRO_L)) await W(f, [['TopBar', 'Avatar']], go(T.PRO_L), 'avatar → My Profile');
  if (chipAction) await W(f, [['TopBar', 'Attendance']], chipAction, 'attendance chip');
}
const PANEL = [['Attendance panel', 'Action'], ['Content', 'Attendance panel', 'Action']];
const QUEUE = [['My work list', 'Action']];
async function work(f, v) {
  await W(f, QUEUE, U(CC001[v]), 'Open queue → SCR-CC-001');
  await WA(f, /^Item · /, U(CC002[v]), 'work items → SCR-CC-002 (U-4/D3)');
}

// --- Flow 3: My Day desktop (checked in) ---
await shell(T.DAY_L, N(T.CO_L, D150));
await work(T.DAY_L, 'L');
await W(T.DAY_L, PANEL, N(T.CO_L, D150), 'Check out → Checkout drawer');
// state frames
await shell(T.DAY_NOTIN, N(T.CI_VER, D150));
await work(T.DAY_NOTIN, 'L');
await W(T.DAY_NOTIN, PANEL, N(T.CI_VER, D150), 'Check in → Verifying');
for (const k of ['DAY_EMPTY', 'DAY_INSUFF']) { await shell(T[k]); await W(T[k], QUEUE, U(CC001.L), 'Open queue → SCR-CC-001'); }
await WA(T.DAY_INSUFF, /^Item · /, U(CC002.L), 'work items → SCR-CC-002');
await shell(T.DAY_LOAD);

// --- Flow 3m: My Day mobile Light / Dark ---
for (const v of ['ML', 'MD']) {
  const f = T['DAY_' + v];
  await W(f, PANEL, N(T['CO_' + v], D150), 'Check out → Checkout (mobile)');
  await work(f, v);
  await W(f, [{ in: ['TabBar'], text: /^Queue$/ }, ['TabBar', 'Tab 2']], U(CC001[v]), 'tab Queue');
  await W(f, [{ in: ['TabBar'], text: /^Follow-ups/ }, ['TabBar', 'Tab 3']], U(CC004[v]), 'tab Follow-ups');
  SCROLL(f);
}
await W(T.DAY_ML, [['Header', 'Avatar']], N(T.PRO_ML), 'header avatar → My Profile (mobile)');

// --- Flow 5: check in → check out (desktop) ---
await WF(T.CI_VER, N(T.CI_L, SMART), 'Verifying: click anywhere → Checked in (U-8 stand-in for AFTER_TIMEOUT)');
await W(T.CI_VER, [[DLG, 'Secondary action']], back(), 'Cancel → Back');
await W(T.CI_VER, [[DLG, XBTN]], back(), '× → Back');
await W(T.CI_L, [[DLG, 'Secondary action']], N(T.DAY_L), 'Close → My Day (checked in)');
await W(T.CI_L, [[DLG, 'Primary action']], N(T.DAY_L), 'Open my work list → My Day');
await W(T.CI_L, [[DLG, XBTN]], N(T.DAY_L), '× → My Day');
await W(T.CO_L, [[DRW, 'Footer actions', 'Primary action'], [DRW, 'Primary action'], [DRW, 'Check out']], N(T.CO_CLOSED, SMART), 'Check out → Closed');
await W(T.CO_L, [[DRW, 'Cancel']], back(), 'Cancel → Back');
await W(T.CO_L, [[DRW, XBTN]], back(), '× → Back');
const CLOSE_PRI = [[DLG, 'Primary action'], [DRW, 'Primary action'], 'Primary action'];
await W(T.CO_CLOSED, CLOSE_PRI, N(T.DAY_L), 'Done → My Day (U-9: no checked-out My Day frame)');
// branches
await W(T.CI_FAIL, [[DLG, 'Primary action']], N(T.CI_L, SMART), 'Retry check → Checked in');
await W(T.CI_FAIL, [[DLG, 'Secondary action']], N(T.DAY_NOTIN), 'Cancel → My Day (not checked in)');
await W(T.CI_FAIL, [[DLG, XBTN]], N(T.DAY_NOTIN), '× → My Day (not checked in)');
await C(T.CI_FAIL, [/^Link · Request remote exception/, ['Remote row', /^Link/]], 'Request remote exception: DEC-010 default = no self-service request');
for (const s of ['Secondary action', 'Primary action', XBTN]) await W(T.CI_REMOTE, [[DLG, s]], N(T.DAY_L), 'Remote exception recorded → My Day');
await C(T.CO_EMPTY, [[DRW, 'Footer actions', 'Primary action'], [DRW, 'Primary action'], [DRW, 'Check out']], 'Check out: DEC-012 default = summary mandatory');
await W(T.CO_EMPTY, [[DRW, 'Cancel'], [DLG, 'Secondary action']], N(T.DAY_L), 'Cancel → My Day');
await W(T.CO_FAIL, ['Retry check'], N(T.CO_CLOSED, SMART), 'Retry check → Closed');
await W(T.CO_FAIL, [[DRW, 'Footer actions', 'Primary action'], [DRW, 'Primary action'], [DLG, 'Primary action']], N(T.CO_ALTB, SMART), 'Check out → DEC-026 Alt B provisional (working default)');
await W(T.CO_FAIL, [[DRW, 'Cancel'], [DLG, 'Secondary action']], N(T.DAY_L), 'Cancel → My Day');
await W(T.CO_ALTA, CLOSE_PRI, N(T.CO_CLOSED, SMART), 'Alt A Retry check → Closed (reference)');
await W(T.CO_ALTA, [[DLG, 'Close'], [DRW, 'Close'], [DLG, 'Secondary action'], 'Close'], N(T.DAY_L), 'Alt A Close → My Day');
for (const k of ['CO_ALTB', 'CO_ALTC']) await W(T[k], CLOSE_PRI, N(T.DAY_L), 'Done → My Day');

// --- Flow 5m: mobile check in → check out (Light / Dark) ---
for (const v of ['ML', 'MD']) {
  const ci = T['CI_' + v], co = T['CO_' + v], day = T['DAY_' + v];
  await W(ci, [['Footer', 'Back to My Day'], 'Back to My Day'], N(day), 'Back to My Day');
  await W(ci, [['Footer', 'Primary action'], 'Primary action'], N(day), 'Open my work list → My Day');
  await W(ci, HDRBACK, N(day), 'header back → My Day');
  await W(co, [['Footer', 'Check out'], 'Check out'], N(day), 'Check out → My Day (U-9: no mobile Closed frame)');
  await W(co, [['Footer', 'Cancel'], 'Cancel'], back(), 'Cancel → Back');
  await W(co, HDRBACK, back(), 'header back → Back');
  SCROLL(ci); SCROLL(co);
}

FL('DAY_L', 'P7 — Call Center — My Day (desktop)');
FL('DAY_ML', 'P7 — Call Center — My Day (mobile, Light)');
FL('DAY_MD', 'P7 — Call Center — My Day (mobile, Dark)');
FL('DAY_NOTIN', 'P7 — Call Center — Check in → check out (desktop)');
FL('CI_FAIL', 'P7 — Call Center — Check in → check out (check-in verification failure)');
FL('CI_REMOTE', 'P7 — Call Center — Check in → check out (Owner-granted remote exception)');
FL('CO_FAIL', 'P7 — Call Center — Check in → check out (checkout verification failure)');
FL('CO_EMPTY', 'P7 — Call Center — Check in → check out (summary empty)');
FL('CI_ML', 'P7 — Call Center — Check in → check out (mobile, Light)');
FL('CI_MD', 'P7 — Call Center — Check in → check out (mobile, Dark)');

finishFlows();
return R;
