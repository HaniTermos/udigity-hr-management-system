// docs/phase7/scripts/shared/P45-01-notifications-states.js — Phase 7 prototype wiring (P45-01, page 96:7)
const SCRIPT_ID = 'P45-01', PAGE_ID = '96:7';
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

// ================= P45-01 — Notifications, permission denied, hidden record, session ended, save conflict, states reference =================
// All targets on page 40 and on role pages are OPEN_URL (rule 1). "P7 — States — reference" chains the untriggered
// cross-cutting states with whole-frame ON_CLICK (child hotspots keep their own reactions and win).
const S7 = 'SCR-SHR-007 — Notifications — ', S11 = 'SCR-SHR-011 — Permission denied — ', S12 = 'SCR-SHR-012 — Record hidden by policy — ', S13 = 'SCR-SHR-013 — Session ended — ', S14 = 'SCR-SHR-014 — Save conflict — ', S15 = 'SCR-SHR-015 — System state patterns — ';
await load([
  ['NOT_L', S7 + 'Desktop — Light', '165:2880'], ['NOT_ML', S7 + 'Mobile — Light', '165:3285'],
  ['NOT_EMPTY', S7 + 'Desktop — Light — Empty', '165:3438'], ['NOT_GONE', S7 + 'Desktop — Light — Target no longer accessible', '165:3550'],
  ['DENY_L', S11 + 'Desktop — Light — Role denied', '165:3781'], ['DENY_ML', S11 + 'Mobile — Light — Role denied', '165:3970'],
  ['DENY_2FA', S11 + 'Desktop — Light — Owner without completed 2FA', '165:4032'],
  ['HID_L', S12 + 'Desktop — Light — Direct URL', '269:2916'], ['HID_ML', S12 + 'Mobile — Light — Direct URL', '269:3190'],
  ['HID_STALE', S12 + 'Desktop — Light — Stale link from notification or calendar', '269:3262'],
  ['END_L', S13 + 'Desktop — Light — Expired', '269:3418'], ['END_ML', S13 + 'Mobile — Light — Expired', '269:3523'],
  ['END_REV', S13 + 'Desktop — Light — Revoked by Owner', '269:3564'], ['END_DEACT', S13 + 'Desktop — Light — Account deactivated', '269:3608'],
  ['END_DLG', S13 + 'Desktop — Light — In-app dialog (unsaved input not saved)', '269:3652'],
  ['CONF_L', S14 + 'Desktop — Light — Field-level diff', '270:2918'], ['CONF_ML', S14 + 'Mobile — Light — Field-level diff', '270:3415'],
  ['REF', S15 + 'Desktop — Light — Reference sheet', '270:3509'], ['OFFLINE', S15 + 'Desktop — Light — Offline in context', '270:4466'],
]);
const P40 = { DAY_L: '303:10513', DAY_ML: '303:11195', PRO_L: '189:10468', LOGIN_L: '169:10438', LOGIN_M: '169:10607', LOGIN_EXP: '169:10912', TFA_L: '169:11080' };
const ACCESS_ACT = [[/^Access · /, 'Action']];

// --- Flow 8: Notifications (Developer shell) ---
async function dshell(f) {
  if (!f) return;
  await W(f, [/^Nav\/Item · My Day/], U(P40.DAY_L), 'nav My Day → p40 (U-13 role mismatch accepted)');
  await W(f, [['TopBar', 'Avatar']], U(P40.PRO_L), 'avatar → My Profile (p40)');
}
for (const k of ['NOT_L', 'NOT_GONE']) {
  const f = T[k];
  await dshell(f);
  await W(f, [/^Item · Meeting booked/], U('304:13135'), 'Meeting booked → SCR-DEV-004');
  await W(f, [/^Item · Task due tomorrow/], U('267:13129'), 'Task due tomorrow → SCR-DEV-007');
  await W(f, [/^Item · Client dependency/], N(T.HID_STALE), 'Client dependency → Hidden (stale link) U-11');
  await W(f, [/^Item · Deal closed/], U('263:13122'), 'Deal closed → SCR-DEV-002');
  await W(f, [/^Item · Wireframes approved/], U('228:13090'), 'Wireframes approved → SCR-DEV-006');
  await C(f, [/^Link · Mark all as read/], 'Mark all as read: no result frame (U-12)');
  await C(f, [/^Filter · Unread/], 'Unread filter: no result frame (U-12)');
}
await dshell(T.NOT_EMPTY);
await W(T.HID_STALE, ACCESS_ACT, N(T.NOT_GONE), 'Back to notifications → Target no longer accessible');
await W(T.NOT_ML, [/^Item · Meeting booked/], U('304:14544'), 'Meeting booked → SCR-DEV-004 (mobile)');
await W(T.NOT_ML, [/^Item · Task due tomorrow/], U('267:15282'), 'Task due tomorrow → SCR-DEV-007 (mobile)');
await W(T.NOT_ML, [/^Item · Client dependency/], N(T.HID_ML), 'Client dependency → Hidden (mobile)');
await W(T.NOT_ML, [{ in: ['TabBar'], text: /^My Day$/ }, ['TabBar', 'Tab 1']], U(P40.DAY_ML), 'tab My Day → p40');
SCROLL(T.NOT_ML);

// --- 9a Permission denied ---
await W(T.DENY_L, [...ACCESS_ACT, 'Go to My Day'], U(P40.DAY_L), 'Go to My Day → p40');
await W(T.DENY_L, ['Back'], back(), 'Back');
await W(T.DENY_ML, ['Go to My Day', ...ACCESS_ACT], U(P40.DAY_ML), 'Go to My Day → p40 (mobile)');
await W(T.DENY_ML, ['Back'], back(), 'Back');
await W(T.DENY_2FA, ['Primary action'], U(P40.TFA_L), 'Continue to 2FA → p40');
await W(T.DENY_2FA, ['Sign out'], U(P40.LOGIN_L), 'Sign out → Login p40');
// --- 9b Hidden record ---
await W(T.HID_L, [...ACCESS_ACT, 'Back'], U('311:13767'), 'Back to Calling Queue → SCR-CC-001');
await W(T.HID_ML, ['Back', ...ACCESS_ACT], U('311:15277'), 'Back to Calling Queue → SCR-CC-001 (mobile)');
// --- 9c Session ended ---
await W(T.END_DLG, [[DLG, 'Primary action'], 'Primary action'], U(P40.LOGIN_EXP), 'Sign in again → Login (session expired) p40');
await W(T.END_DLG, [[DLG, XBTN]], N(T.END_L), '× → Session ended page');
for (const k of ['END_L', 'END_REV']) await W(T[k], ['Sign in again'], U(P40.LOGIN_EXP), 'Sign in again → Login (session expired) p40');
await W(T.END_ML, ['Sign in again'], U(P40.LOGIN_M), 'Sign in again → Login (mobile) p40');
await W(T.END_DEACT, ['Back to sign in'], U(P40.LOGIN_L), 'Back to sign in → Login p40');
// --- 9d Save conflict (business-record diff; pattern reference, U-15) ---
await W(T.CONF_L, [['Conflict actions', 'Re-apply my edits'], 'Re-apply my edits'], U('172:9047'), 'Re-apply my edits → SCR-DE-004');
await W(T.CONF_L, [['Conflict actions', 'Reload latest'], 'Reload latest'], U('172:9047'), 'Reload latest → SCR-DE-004');
await W(T.CONF_L, [['Conflict actions', 'Cancel editing'], 'Cancel editing'], U('310:11808'), 'Cancel editing → SCR-SHR-008');
await W(T.CONF_ML, ['Re-apply', 'Re-apply my edits'], U('267:15282'), 'Re-apply → SCR-DEV-007 (mobile)');
await W(T.CONF_ML, ['Reload', 'Reload latest'], U('267:15282'), 'Reload → SCR-DEV-007 (mobile)');
await W(T.CONF_ML, HDRBACK, back(), 'header back → Back');
SCROLL(T.CONF_ML);

// --- P7 — States — reference: untriggered cross-cutting states in sequence (whole-frame click → next) ---
const SEQ = ['REF', 'DENY_L', 'DENY_2FA', 'HID_L', 'END_L', 'END_REV', 'END_DEACT', 'END_DLG', 'CONF_L', 'NOT_EMPTY', 'OFFLINE'];
for (let i = 0; i < SEQ.length; i++) await WF(T[SEQ[i]], N(T[SEQ[(i + 1) % SEQ.length]]), `states reference ${i + 1}/${SEQ.length} → next`);

FL('NOT_L', 'P7 — Developer — Notifications');
FL('NOT_ML', 'P7 — Developer — Notifications (mobile)');
FL('DENY_L', 'P7 — All roles — Permission denied');
FL('DENY_2FA', 'P7 — Owner — Permission denied (2FA not completed)');
FL('HID_L', 'P7 — Call Center — Hidden record');
FL('END_DLG', 'P7 — Call Center — Session ended');
FL('CONF_L', 'P7 — All roles — Save conflict (field-level diff)');
FL('REF', 'P7 — States — reference');

finishFlows();
return R;
