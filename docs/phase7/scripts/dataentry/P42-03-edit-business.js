// P42-03 — Data Entry wiring, page 42 (96:4). Phase 7, DE-P7-1, 2026-10-23.
// Flow 3 (Edit business with save conflict). Owns: SHR-008 Light 'Edit business' only; DE-004 Light, Save conflict, Success, Duplicate blocked. D4: DE-004 Save serves this flow; D2: Discard -> DE-004 Light.
// Idempotent: setReactionsAsync replaces each hotspot's reactions; flows replaced by start-node id; auto 'Flow N' entries on own frames removed.
// Frames by name, ID fallback. Returns {wired, missingTargets, missingHotspots, flows, ...}. No x/y/size changes, no detach, no deletes of nodes.

// ===== Page 42 (96:4) — set once =====
const PAGE = await figma.getNodeByIdAsync('96:4');
await figma.setCurrentPageAsync(PAGE);

// ===== Inlined: docs/phase7/wiring-helpers.js (OP-P7-1 pilot) =====
const FILE_KEY = 'GNrhb3DWa6mIhEX6F4Nmvw';
const DISSOLVE_200 = { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.2 };
const SMART_250 = { type: 'SMART_ANIMATE', easing: { type: 'EASE_OUT' }, duration: 0.25 };
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
  const page = figma.currentPage;
  const keep = page.flowStartingPoints.filter(f => f.nodeId !== frame.id && f.name !== name);
  page.flowStartingPoints = [...keep, { nodeId: frame.id, name }];
  return { nodeId: frame.id, name };
}

// ===== Data Entry extensions (P42 scripts) =====
// Frame table: key -> [full frame name, fallback id] (phase6/previews/42/index.md).
const D = ' — Desktop — Light';
const T = {
  de001: ['SCR-DE-001 — Business directory' + D, '165:81145'],
  de001own: ['SCR-DE-001 — Business directory' + D + ' — Owner view', '165:81643'],
  de002: ['SCR-DE-002 — Create business' + D, '170:9047'],
  de002val: ['SCR-DE-002 — Create business' + D + ' — Validation errors', '170:9600'],
  de002ok: ['SCR-DE-002 — Create business' + D + ' — Success', '170:10095'],
  de004: ['SCR-DE-004 — Edit business' + D, '172:9047'],
  de004dup: ['SCR-DE-004 — Edit business' + D + ' — Duplicate blocked', '172:9614'],
  de004conf: ['SCR-DE-004 — Edit business' + D + ' — Save conflict', '172:10101'],
  de004ok: ['SCR-DE-004 — Edit business' + D + ' — Success', '172:10944'],
  de005: ['SCR-DE-005 — Resolve correction (drawer)' + D + ' — In review', '308:11804'],
  de005done: ['SCR-DE-005 — Resolve correction (drawer)' + D + ' — Already resolved', '308:12398'],
  de005dup: ['SCR-DE-005 — Resolve correction (drawer)' + D + ' — Duplicate blocked on apply', '308:12845'],
  de005ok: ['SCR-DE-005 — Resolve correction (drawer)' + D + ' — Success', '308:13309'],
  de006: ['SCR-DE-006 — Correction-request queue' + D, '308:13955'],
  de006res: ['SCR-DE-006 — Correction-request queue' + D + ' — Resolved', '308:14538'],
  de006cls: ['SCR-DE-006 — Correction-request queue' + D + ' — Closed and rejected', '308:14791'],
  de007: ['SCR-DE-007 — Categories' + D, '178:11715'],
  de007name: ['SCR-DE-007 — Categories' + D + ' — Name exists', '178:12245'],
  de007use: ['SCR-DE-007 — Categories' + D + ' — In use (cannot remove)', '178:12646'],
  de007pd: ['SCR-DE-007 — Categories' + D + ' — Permission denied (Data Entry)', '178:13085'],
  shr008: ['SCR-SHR-008 — Business detail' + D, '310:11808'],
  shr008hist: ['SCR-SHR-008 — Business detail' + D + ' — Edit history', '310:12151'],
  shr008cc: ['SCR-SHR-008 — Business detail' + D + ' — Call Center read-only', '310:12415'],
  shr009: ['SCR-SHR-009 — Submit data correction (drawer)' + D + ' — Open request warning', '310:13530'],
  shr009val: ['SCR-SHR-009 — Submit data correction (drawer)' + D + ' — Validation error', '310:13731'],
  shr009ok: ['SCR-SHR-009 — Submit data correction (drawer)' + D + ' — Submitted', '310:13874'],
  shr010: ['SCR-SHR-010 — Search results' + D, '179:11715'],
  shr010own: ['SCR-SHR-010 — Search results' + D + ' — Owner view', '179:11997'],
};
// Cross-page OPEN_URL targets (brief rule 1).
const X = {
  myDay: '303:10513',      // SCR-SHR-001 — My Day — Desktop — Light (page 40)
  myAtt: '188:10468',      // SCR-SHR-004 — My Attendance — Desktop — Light (page 40)
  myProfile: '189:10468',  // SCR-SHR-006 — My Profile — Desktop — Light (page 40)
  cc001: '311:13767',      // SCR-CC-001 — Calling queue — Desktop — Light (page 43)
  conflictRef: '270:2918', // SCR-SHR-014 — Save conflict — Desktop — Light (page 45)
  dupVisible: '101:5214',  // page-30 sample F2 (SCR-DE-003 blocked; brief rule 8)
  dupHidden: '101:6168',   // page-30 sample N1 (DEC-003 (i) existence only)
};

const R = { wired: [], missingTargets: [], missingHotspots: [], flows: [], errors: [], notes: [] };
const FR = {};
const OWN = new Set();
function onPage(n) { let p = n; while (p && p.type !== 'PAGE') p = p.parent; return p && p.id === PAGE.id; }
async function frame(k) {
  if (k in FR) return FR[k];
  const [name, id] = T[k];
  let f = frameByName(name);
  if (!f && id) { const n = await figma.getNodeByIdAsync(id); if (n && n.type === 'FRAME' && onPage(n)) f = n; }
  FR[k] = f || null;
  return FR[k];
}
async function loadAll() { for (const k of Object.keys(T)) await frame(k); }
// Target action builders: return null (and log the missing target) when the destination frame is absent.
function to(k, tr) {
  const f = FR[k];
  if (!f) { const m = T[k][0] + ' [' + T[k][1] + ']'; if (!R.missingTargets.includes(m)) R.missingTargets.push(m); return null; }
  return nav(f.id, tr || DISSOLVE_200);
}
const toS = (k) => to(k, SMART_250);
const ext = (k) => url(X[k]);

// Locators (no x/y/size changes, no detach — rule 3).
function vis(n, root) { let p = n; while (p && p !== root) { if (p.visible === false) return false; p = p.parent; } return true; }
function up(n, root, test) { let p = n; while (p && p !== root) { if (test(p)) return p; p = p.parent; } return null; }
function notUnder(n, root, re) { return !up(n, root, p => re.test(p.name)); }
function texts(root, s, contains) {
  return root.findAll(n => n.type === 'TEXT' && vis(n, root) &&
    (contains ? n.characters.includes(s) : n.characters.trim() === s));
}
function L(root, l) {
  if (!root) return [];
  if (typeof l === 'string') return root.findAll(n => n.type !== 'TEXT' && n.name === l && vis(n, root));
  if (l instanceof RegExp) return root.findAll(n => n.type !== 'TEXT' && l.test(n.name) && vis(n, root));
  let out = [];
  if (l.in) { const sc = L(root, l.in)[0]; return sc ? L(sc, l.l) : []; }
  if (l.t) out = texts(root, l.t, l.contains).map(t => up(t.parent, root, n => n.type === 'INSTANCE') || up(t.parent, root, n => n.type === 'FRAME')).filter(Boolean);
  else if (l.nav) out = root.findAll(n => n.type === 'INSTANCE' && n.name.startsWith('Nav/Item · ' + l.nav) && vis(n, root));
  else if (l.search) { const tb = root.findOne(n => n.type === 'INSTANCE' && n.name === 'TopBar'); out = tb ? tb.findAll(n => n.type === 'INSTANCE' && n.name === 'Search') : []; }
  else if (l.bc) { const b = root.findAll(n => n.type === 'INSTANCE' && n.name === 'Breadcrumb' && vis(n, root))[0]; out = b ? b.findAll(n => n.type === 'TEXT' && n.name === 'Level ' + l.bc) : []; }
  else if (l.tab || l.tabN) {
    const tabs = root.findAll(n => n.type === 'INSTANCE' && n.name === 'Tabs' && vis(n, root))[0];
    const items = tabs ? tabs.findAll(n => n.type === 'INSTANCE' && /^Tab \d$/.test(n.name) && n.visible !== false) : [];
    out = l.tabN ? items.filter(n => n.name === 'Tab ' + l.tabN)
      : items.filter(n => n.findOne(t => t.type === 'TEXT' && t.characters.trim().startsWith(l.tab)));
  }
  else if (l.row) out = texts(root, l.row).map(t => up(t.parent, root, n => /^Row\b/.test(n.name))).filter(Boolean);
  if (l.not) out = out.filter(n => notUnder(n, root, l.not));
  return [...new Set(out)];
}
// Wire one hotspot (or all matches with {all:true}). locs = locator or array of fallbacks tried in order.
async function W(k, label, locs, act, o = {}) {
  const fr = FR[k];
  if (!fr) { const m = T[k][0] + ' [' + T[k][1] + '] (source frame)'; if (!R.missingTargets.includes(m)) R.missingTargets.push(m); return 0; }
  if (!act) { R.notes.push(fr.name + ' | ' + label + ': not wired, target missing'); return 0; }
  let nodes = [];
  for (const l of [].concat(locs)) { nodes = L(fr, l); if (nodes.length) break; }
  if (!nodes.length) { R.missingHotspots.push(fr.name + ' | ' + label); return 0; }
  let ok = 0;
  for (const n of nodes) {
    if (await onClick(n, act, R.errors)) {
      ok++; OWN.add(fr.id);
      R.wired.push(fr.name.replace(/ — Desktop — Light/, '') + ' | ' + label + (nodes.length > 1 && o.all ? ' #' + ok : '') + ' → ' + (act.destinationId || act.url || act.type));
      if (!o.all) break;
    }
  }
  if (!ok) R.missingHotspots.push(fr.name + ' | ' + label + ' (reaction refused; see errors)');
  return ok;
}
// Data Entry desktop shell (sidebar + top-bar search). DEC-015 CA-A: Categories → Permission denied.
async function shell(k) {
  await W(k, 'Sidebar · Businesses', { nav: 'Businesses' }, to('de001'));
  await W(k, 'Sidebar · Add Business', { nav: 'Add Business' }, to('de002'));
  await W(k, 'Sidebar · Correction Requests', { nav: 'Correction Requests' }, to('de006'));
  await W(k, 'Sidebar · Categories (DEC-015 CA-A)', { nav: 'Categories' }, to('de007pd'));
  await W(k, 'Sidebar · My Day', { nav: 'My Day' }, ext('myDay'));
  await W(k, 'Sidebar · My Attendance', { nav: 'My Attendance' }, ext('myAtt'));
  await W(k, 'Sidebar · My Profile', { nav: 'My Profile' }, ext('myProfile'));
  await W(k, 'Top-bar search', { search: 1 }, to('shr010'));
}
// Flows: drop auto-created "Flow N" entries on frames this script wired, then (re)set named flows.
function flows(list) {
  const pg = figma.currentPage;
  pg.flowStartingPoints = pg.flowStartingPoints.filter(f => !(OWN.has(f.nodeId) && /^Flow \d+$/.test(f.name)));
  for (const [k, name] of list) {
    const f = FR[k];
    if (!f) { R.notes.push('flow not set (start frame missing): ' + name); continue; }
    try { R.flows.push(setFlow(f, name)); } catch (e) { R.errors.push({ flow: name, err: String(e) }); }
  }
}
function done() {
  return { wired: R.wired.length, wiredList: R.wired, missingTargets: R.missingTargets, missingHotspots: R.missingHotspots, flows: R.flows, errors: R.errors, notes: R.notes };
}

await loadAll();
// ===== end helpers =====

// --- SCR-SHR-008 Light (single hotspot owned here) ---
await W('shr008', 'Header · Edit business', ['Edit business', { t: 'Edit business' }], to('de004'));

// --- SCR-DE-004 Light ---
await shell('de004');
await W('de004', 'Footer · Save changes (→ conflict)', ['Save changes', { t: 'Save changes' }], to('de004conf'));
await W('de004', 'Footer · Cancel', ['Cancel', { t: 'Cancel' }], to('shr008'));
await W('de004', 'Link · View edit history', ['View edit history', { t: 'View edit history' }], to('shr008hist'));
await W('de004', 'Breadcrumb · Businesses', [{ bc: 1 }], to('de001'));
await W('de004', 'Breadcrumb · Peak Fitness Gym', [{ bc: 2 }], to('shr008'));

// --- SCR-DE-004 Save conflict ---
await shell('de004conf');
await W('de004conf', 'Footer · Save changes (→ success)', ['Save changes', { t: 'Save changes' }], to('de004ok'));
await W('de004conf', 'Banner · Show what changed (page-45 ref)', ['Show what changed', { t: 'Show what changed' }], ext('conflictRef'));
await W('de004conf', 'Notes · Re-apply mine', ['Re-apply mine', { t: 'Re-apply mine' }], to('de004'));
await W('de004conf', 'Footer · Discard my changes (D2 → DE-004)', ['Discard my changes', { t: 'Discard my changes' }], to('de004'));
await W('de004conf', 'Footer · Cancel', ['Cancel', { t: 'Cancel' }], to('shr008'));
await W('de004conf', 'Breadcrumb · Businesses', [{ bc: 1 }], to('de001'));
await W('de004conf', 'Breadcrumb · Peak Fitness Gym', [{ bc: 2 }], to('shr008'));

// --- SCR-DE-004 Success ---
await shell('de004ok');
await W('de004ok', 'Link · View edit history', ['View edit history', { t: 'View edit history' }], to('shr008hist'));
await W('de004ok', 'Breadcrumb · Businesses', [{ bc: 1 }], to('de001'));
await W('de004ok', 'Breadcrumb · Peak Fitness Gym', [{ bc: 2 }], to('shr008'));

// --- SCR-DE-004 Duplicate blocked (state reference) ---
await W('de004dup', 'Banner · Open existing business', ['Open existing business', { t: 'Open existing business' }], to('shr008'));
// SCR-DE-004 Validation error: state reference, no wiring.

flows([['shr008', 'P7 — Data Entry — Edit business with save conflict']]);
return done();
