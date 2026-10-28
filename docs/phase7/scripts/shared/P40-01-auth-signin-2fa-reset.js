// docs/phase7/scripts/shared/P40-01-auth-signin-2fa-reset.js — Phase 7 prototype wiring (P40-01, page 96:2)
const SCRIPT_ID = 'P40-01', PAGE_ID = '96:2';
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

// ================= P40-01 — Auth: sign in by role, Owner 2FA, enrollment & recovery, forgot/reset =================
const A1 = 'SCR-AUTH-001 — Login — ', A2 = 'SCR-AUTH-002 — Owner 2FA challenge — ', A3 = 'SCR-AUTH-003 — Owner 2FA enrollment & recovery — ', A4 = 'SCR-AUTH-004 — Forgot / reset password — ';
await load([
  ['LOGIN_L', A1 + 'Desktop — Light', '169:10438'], ['LOGIN_M', A1 + 'Mobile — Light', '169:10607'],
  ['LOGIN_VAL', A1 + 'Desktop — Light — Validation error', '169:10681'], ['LOGIN_INV', A1 + 'Desktop — Light — Invalid credentials', '169:10751'],
  ['LOGIN_DEA', A1 + 'Desktop — Light — Deactivated account', '169:10832'], ['LOGIN_EXP', A1 + 'Desktop — Light — Session expired', '169:10912'],
  ['LOGIN_LOAD', A1 + 'Desktop — Light — Loading', '169:10992'],
  ['TFA_L', A2 + 'Desktop — Light', '169:11080'], ['TFA_M', A2 + 'Mobile — Light', '169:11239'],
  ['TFA_WRONG', A2 + 'Desktop — Light — Wrong or expired code', '169:11310'], ['TFA_FAIL', A2 + 'Desktop — Light — Verification failure', '169:11383'],
  ['TFA_R11A', A2 + 'Desktop — Light — R11-a reading (not selected)', '169:11462'], ['TFA_R11B', A2 + 'Desktop — Light — R11-b reading (not selected)', '169:11556'],
  ['TFA_OK', A2 + 'Desktop — Light — Success', '169:11648'],
  ['EN_L', A3 + 'Desktop — Light', '170:81934'], ['EN_CODES', A3 + 'Desktop — Light — Save recovery codes', '170:82147'],
  ['EN_FAIL', A3 + 'Desktop — Light — Verification failure', '170:82265'], ['EN_REC', A3 + 'Desktop — Light — Recover lost factor', '170:82351'],
  ['EN_USED', A3 + 'Desktop — Light — Recovery used', '170:82422'], ['EN_RECFAIL', A3 + 'Desktop — Light — Recovery failed', '170:82467'],
  ['EN_OK', A3 + 'Desktop — Light — Success', '170:82510'],
  ['RS_L', A4 + 'Desktop — Light', '170:82569'], ['RS_M', A4 + 'Mobile — Light', '170:82675'],
  ['RS_SENT', A4 + 'Desktop — Light — Request sent', '170:82720'], ['RS_NEW', A4 + 'Desktop — Light — Set new password', '170:82773'],
  ['RS_EXP', A4 + 'Desktop — Light — Link expired or used', '170:82836'], ['RS_RULE', A4 + 'Desktop — Light — Password rule error', '170:82883'],
  ['RS_OK', A4 + 'Desktop — Light — Success', '170:82945'],
  ['DAY_L', 'SCR-SHR-001 — My Day — Desktop — Light', '303:10513'],
]);
const OWN_HOME = '200:22902', OWN_MOBILE_HOME = '287:23936', DE_HOME = '165:81145', DEV_HOME = '171:11591';
const SIGNIN = ['Primary action', { text: 'Sign in' }];
const FORGOT = [/^Hit · Forgot password/, /^Link · Forgot password/, { text: 'Forgot password?' }];
const PRIMARY = ['Primary action'];
const SIGNOUT = [['Secondary row', 'Sign out'], 'Sign out'];
const LOST = [/^Hit · Lost your second factor/, /^Link · Lost your second factor/, { text: /^Lost your second factor/ }];
const BACKSIGNIN = [/^Hit · Back to sign in/, /^Link · Back to sign in/, 'Back to sign in', { text: 'Back to sign in' }];

// --- Sign in by role (U-1 decision): one login frame per role flow; Owner is the main flow ---
const T_ = T;
await W(T_.LOGIN_L, SIGNIN, N(T_.TFA_L), 'Sign in → Owner 2FA');
await W(T_.LOGIN_EXP, SIGNIN, N(T_.DAY_L), 'Sign in → Call Center home (My Day)');
await W(T_.LOGIN_VAL, SIGNIN, U(DE_HOME), 'Sign in (corrected) → Data Entry home SCR-DE-001');
await W(T_.LOGIN_INV, SIGNIN, U(DEV_HOME), 'Sign in (retry) → Developer home SCR-DEV-001');
await C(T_.LOGIN_DEA, SIGNIN, 'Sign in (deactivated: no forward path)');
await C(T_.LOGIN_LOAD, SIGNIN, 'Signing in… (loading: no forward path)');
for (const k of ['LOGIN_L', 'LOGIN_EXP', 'LOGIN_VAL', 'LOGIN_INV', 'LOGIN_DEA', 'LOGIN_LOAD']) await W(T_[k], FORGOT, N(T_.RS_L), 'Forgot password? → Reset');
await W(T_.LOGIN_M, SIGNIN, N(T_.TFA_M), 'Sign in → Owner 2FA (mobile)');
await W(T_.LOGIN_M, FORGOT, N(T_.RS_M), 'Forgot password? → Reset (mobile)');

// --- Owner 2FA challenge ---
for (const k of ['TFA_L', 'TFA_WRONG', 'TFA_FAIL', 'TFA_R11A', 'TFA_R11B']) {
  await W(T_[k], PRIMARY, U(OWN_HOME), 'Verify / Try again → Owner dashboard');
  await W(T_[k], LOST, N(T_.EN_REC), 'Lost your second factor? → Recover');
  await W(T_[k], SIGNOUT, N(T_.LOGIN_L), 'Sign out → Login');
}
await W(T_.TFA_OK, PRIMARY, U(OWN_HOME), 'Opening dashboard… → Owner dashboard');
await W(T_.TFA_M, PRIMARY, U(OWN_MOBILE_HOME), 'Verify → Owner mobile Today');
await W(T_.TFA_M, SIGNOUT, N(T_.LOGIN_M), 'Sign out → Login (mobile)');
await C(T_.TFA_M, LOST, 'Lost factor (mobile): AUTH-003 is desktop only — flow ends');

// --- Enrollment & recovery ---
await W(T_.EN_L, PRIMARY, N(T_.EN_CODES, SMART), 'Confirm code → Save recovery codes');
await W(T_.EN_L, SIGNOUT, N(T_.LOGIN_L), 'Sign out → Login');
await W(T_.EN_CODES, PRIMARY, N(T_.EN_OK, SMART), 'Finish setup → Success');
await W(T_.EN_OK, PRIMARY, U(OWN_HOME), 'Continue to dashboard → Owner dashboard');
await W(T_.EN_FAIL, PRIMARY, N(T_.EN_CODES, SMART), 'Confirm code → Save recovery codes');
await W(T_.EN_FAIL, [/^Link · Start setup again/, /^Hit · Start setup again/, { text: 'Start setup again' }], N(T_.EN_L), 'Start setup again → Enrollment');
await W(T_.EN_REC, PRIMARY, N(T_.EN_USED, SMART), 'Use recovery code → Recovery used');
await W(T_.EN_REC, [/^Hit · Back to code entry/, /^Link · Back to code entry/, 'Back', { text: /^Back to code entry/ }], N(T_.TFA_L), 'Back to code entry → 2FA');
await W(T_.EN_USED, PRIMARY, N(T_.EN_L), 'Set up 2FA again → Enrollment');
await W(T_.EN_RECFAIL, PRIMARY, N(T_.LOGIN_L), 'Back to sign in → Login');

// --- Forgot / reset password ---
await W(T_.RS_L, PRIMARY, N(T_.RS_SENT, SMART), 'Send reset link → Request sent');
// Emailed link (U-2 decision): the "Reset link queued" banner on the confirmation frame stands in for opening the email link.
await W(T_.RS_SENT, ['Banner · Info', { text: 'Reset link queued' }], N(T_.RS_NEW), 'Reset link queued (emailed link) → Set new password');
await W(T_.RS_SENT, [/^Link · Didn.t get it/, { text: /^Didn.t get it/ }], N(T_.RS_L), 'Request another link → Reset');
await W(T_.RS_NEW, PRIMARY, N(T_.RS_OK, SMART), 'Save new password → Success');
await W(T_.RS_RULE, PRIMARY, N(T_.RS_OK, SMART), 'Save new password → Success');
await W(T_.RS_EXP, PRIMARY, N(T_.RS_L), 'Request a new link → Reset');
await W(T_.RS_OK, PRIMARY, N(T_.LOGIN_L), 'Go to sign in → Login');
for (const k of ['RS_L', 'RS_SENT', 'RS_EXP']) await W(T_[k], BACKSIGNIN, N(T_.LOGIN_L), 'Back to sign in → Login');
await W(T_.RS_M, BACKSIGNIN, N(T_.LOGIN_M), 'Back to sign in → Login (mobile)');
await C(T_.RS_M, PRIMARY, 'Send reset link (mobile): no mobile Request-sent frame — flow ends');

// --- Flow starting points ---
FL('LOGIN_L', 'P7 — Owner — Sign in with 2FA');
FL('LOGIN_EXP', 'P7 — Call Center — Sign in');
FL('LOGIN_VAL', 'P7 — Data Entry — Sign in');
FL('LOGIN_INV', 'P7 — Developer — Sign in');
FL('LOGIN_M', 'P7 — Owner — Sign in with 2FA (mobile)');
FL('TFA_WRONG', 'P7 — Owner — Sign in with 2FA (wrong code)');
FL('EN_L', 'P7 — Owner — 2FA enrollment & recovery');
FL('EN_RECFAIL', 'P7 — Owner — 2FA enrollment & recovery (recovery failed)');
FL('RS_L', 'P7 — All roles — Forgot / reset password');
FL('RS_EXP', 'P7 — All roles — Forgot / reset password (link expired)');

finishFlows();
return R;
