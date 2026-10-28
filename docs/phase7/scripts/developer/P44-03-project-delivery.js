// docs/phase7/scripts/developer/P44-03-project-delivery.js — Phase 7 wiring, page 44 (96:6). Developer role agent, 2026-10-23.
// Flow map: docs/phase7/flows/developer.md (Flow 3 + P7 matrix). Decisions: coordination [P7-1] D1–D6. Needs P44-00 (connector) first.
// Run via use_figma (async body). Idempotent; touches only its own hotspots. Returns {wired, missingTargets, missingHotspots, flows, errors}.
// ---- P44 common block: docs/phase7/wiring-helpers.js (OP-P7-1) inlined + Developer scoping helpers ----
await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('96:6')); // page 44 — HiFi Developer (set once)
const page = figma.currentPage;
const FILE_KEY = 'GNrhb3DWa6mIhEX6F4Nmvw';
const DISSOLVE_200 = { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.2 };
const DISSOLVE_150 = { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.15 };
const R = { wired: [], missingTargets: [], missingHotspots: [], flows: [], errors: [] };
let _frames = null;
function frameByName(nameOrRe) {
  if (!_frames) _frames = page.findAllWithCriteria({ types: ['FRAME'] })
    .filter(f => f.parent && (f.parent.type === 'PAGE' || f.parent.type === 'SECTION'));
  const test = nameOrRe instanceof RegExp ? (n) => nameOrRe.test(n) : (n) => n === nameOrRe;
  return _frames.find(f => test(f.name)) || null;
}
function findHotspot(frame, textOrName) {
  if (!frame) return null;
  const re = textOrName instanceof RegExp ? textOrName : null;
  const eq = (s) => re ? re.test(s) : s === textOrName;
  const has = (s) => re ? re.test(s) : s.toLowerCase().includes(String(textOrName).toLowerCase());
  let hit = frame.findOne(n => n.type !== 'TEXT' && eq(n.name)) || frame.findOne(n => n.type !== 'TEXT' && has(n.name));
  if (hit) return hit;
  const t = frame.findOne(n => n.type === 'TEXT' && has(n.characters));
  if (!t) return null;
  let p = t.parent;
  while (p && p !== frame && p.type !== 'INSTANCE' && p.type !== 'FRAME') p = p.parent;
  return p && p !== frame ? p : t;
}
const nav = (destId, transition = DISSOLVE_200) => ({ type: 'NODE', destinationId: destId, navigation: 'NAVIGATE', transition, resetScrollPosition: true });
const url = (nodeIdOrUrl) => ({ type: 'URL', openInNewTab: false,
  url: /^https?:/.test(nodeIdOrUrl) ? nodeIdOrUrl : `https://www.figma.com/design/${FILE_KEY}?node-id=${String(nodeIdOrUrl).replace(':', '-')}` });
const back = () => ({ type: 'BACK' });
async function onClick(node, action, report) {
  if (!node) return false;
  try { await node.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [action] }]); return true; }
  catch (e) { if (report) report.push({ id: node.id, name: node.name, err: String(e) }); return false; }
}
function setFlow(frame, name) {
  const keep = page.flowStartingPoints.filter(f => f.nodeId !== frame.id && f.name !== name);
  page.flowStartingPoints = [...keep, { nodeId: frame.id, name }];
  return { nodeId: frame.id, name };
}
// Frame by exact name, falling back to the Phase 6 ID (docs/phase6/previews/44/index.md).
async function F(name, id) {
  let f = frameByName(name);
  if (!f && id) { const n = await figma.getNodeByIdAsync(id); if (n && n.type === 'FRAME') f = n; }
  if (!f) R.missingTargets.push(name + (id ? ' (' + id + ')' : ''));
  return f;
}
const short = (s) => String(s).replace(/^SCR-(DEV|SHR)-(\d+) — [^—]+ — /, 'SCR-$1-$2 — ');
const touched = new Set();
// Wire one hotspot; records wired / missingHotspots. `label` = what the reviewer sees.
async function wire(frame, hs, action, label, toName) {
  if (!frame) return;
  if (!hs) { R.missingHotspots.push(short(frame.name) + ' › ' + label); return; }
  touched.add(frame.id);
  const ok = await onClick(hs, action, R.errors);
  if (ok) R.wired.push(short(frame.name) + ' › ' + label + ' → ' + (action.type === 'BACK' ? 'BACK' : action.type === 'URL' ? action.url.split('node-id=')[1] : short(toName || action.destinationId)));
}
// Scoped finders (avoid the cloned board behind a dialog/drawer).
const byName = (root, name) => root ? root.findOne(n => n.type !== 'TEXT' && (name instanceof RegExp ? name.test(n.name) : n.name === name)) : null;
const overlay = (frame) => frame ? frame.findOne(n => n.type === 'INSTANCE' && /^(Dialog|Drawer) · /.test(n.name)) : null;
const toastOf = (frame) => frame ? frame.findOne(n => n.type === 'INSTANCE' && /^Toast · /.test(n.name)) : null;
const xClose = (root) => root ? root.findOne(n => n.type === 'INSTANCE' && /close|dismiss|×/i.test(n.name) && !/^Button · /.test(n.name)) : null;
const inOv = (frame, name) => byName(overlay(frame), name);
function crumb(frame, label) {
  const bc = byName(frame, 'Breadcrumb'); if (!bc) return null;
  const t = bc.findOne(n => n.type === 'TEXT' && n.characters.trim() === label); if (!t) return null;
  let p = t.parent; while (p && p !== bc && p.type !== 'INSTANCE') p = p.parent;
  return p && p !== bc ? p : t;
}
// Remove the auto-created "Flow n" starts on frames this script touched (pilot gotcha); other flows untouched.
function cleanAutoFlows() { page.flowStartingPoints = page.flowStartingPoints.filter(f => !(touched.has(f.nodeId) && /^Flow \d+$/.test(f.name))); }
function flow(frame, name) { if (!frame) { R.missingTargets.push('flow start for ' + name); return; } R.flows.push(setFlow(frame, name)); }
// ---- end common block ----

// ---- P44-03: Flow 3 Project delivery + P7 "Record delivered" check (connector from P44-00 — run P44-00 first) ----
const B = 'SCR-DEV-006 — Project board — Desktop — Light', T7 = 'SCR-DEV-007 — Task detail — Desktop — Light';
const p5 = await F('SCR-DEV-005 — Projects — Desktop — Light', '235:13090');
const b6 = await F(B, '228:13090');
const done = await F(B + ' — Completed (read-only)', '228:13850');
const p7 = await F(B + ' — Record delivered: open-task warning', '266:13124');
const wait = await F(B + ' — Waiting for client (note required)', '266:13619');
const blk = await F(B + ' — Blocked (reason required)', '266:14075');
const conn = await F(B + ' — Delivered (P7 connector)', null); // built by P44-00 (D2 exception)
const t7 = await F(T7, '267:13129');
const t7e = await F(T7 + ' — Validation error', '267:13790');
const t7s = await F(T7 + ' — Success', '267:14861');
const d2 = await F('SCR-DEV-002 — Deal record detail — Desktop — Light', '263:13122');

// DEV-005 Projects
if (p5) {
  if (b6) await wire(p5, byName(p5, /^Row · Glow Beauty Salon/), nav(b6.id), 'Row · Glow Beauty Salon', B);
  if (done) await wire(p5, byName(p5, /^Row · Urban Cuts Barbershop/), nav(done.id), 'Row · Urban Cuts Barbershop', done.name);
  if (d2) await wire(p5, findHotspot(p5, /1 closed deal has no project/), nav(d2.id), 'info banner Nova Dental (D3: DEV-002 shows Cedar)', d2.name);
  // Harbor / Lumen: no desktop board drawn (U-6) → unwired
}
// DEV-006 board (In progress)
if (b6) {
  if (p5) await wire(b6, crumb(b6, 'Projects'), nav(p5.id), 'breadcrumb Projects', p5.name);
  if (t7) await wire(b6, byName(b6, 'Card/Task · Content upload'), nav(t7.id, DISSOLVE_150), 'card Content upload', T7);
  if (wait) await wire(b6, byName(b6, 'Button · Waiting for client…'), nav(wait.id, DISSOLVE_150), 'Waiting for client…', wait.name);
  if (blk) await wire(b6, byName(b6, 'Button · Blocked…'), nav(blk.id, DISSOLVE_150), 'Blocked…', blk.name);
  if (p7) await wire(b6, byName(b6, 'Button · Record delivered'), nav(p7.id, DISSOLVE_150), 'Record delivered (P7 check 1: 3 open tasks → dialog)', p7.name);
  if (d2) await wire(b6, byName(b6, 'Link · Open deal DL-0031'), nav(d2.id), 'rail Open deal DL-0031 (D3)', d2.name);
}
// P7 dialog (scoped to the dialog; the cloned board behind is not wired)
if (p7) {
  await wire(p7, inOv(p7, 'Secondary action'), back(), 'Cancel (P7 check 3: stays In progress)');
  await wire(p7, xClose(overlay(p7)), back(), 'dialog × (P7 check 3)');
  if (b6) await wire(p7, inOv(p7, 'Link · Review open tasks'), nav(b6.id, DISSOLVE_150), 'Review open tasks (D2: no filtered board)', B);
  if (conn) await wire(p7, inOv(p7, 'Primary action'), nav(conn.id, DISSOLVE_150), 'Record delivered (P7 check 4: Delivered, tasks keep columns)', conn.name);
}
if (conn && p5) await wire(conn, crumb(conn, 'Projects'), nav(p5.id), 'breadcrumb Projects', p5.name);
// Waiting / Blocked dialogs (D2/U-8: confirm returns to the In progress board)
for (const [fr, lab] of [[wait, 'Set Waiting for client'], [blk, 'Set Blocked']]) {
  if (!fr) continue;
  await wire(fr, inOv(fr, 'Secondary action'), back(), 'Cancel');
  await wire(fr, xClose(overlay(fr)), back(), 'dialog ×');
  if (b6) await wire(fr, inOv(fr, 'Primary action'), nav(b6.id, DISSOLVE_150), lab + ' (D2/U-8)', B);
}
if (done && p5) await wire(done, crumb(done, 'Projects'), nav(p5.id), 'breadcrumb Projects', p5.name);
// DEV-007 task drawer
if (t7) {
  await wire(t7, inOv(t7, 'Button · Close'), back(), 'Close');
  await wire(t7, xClose(overlay(t7)), back(), 'drawer ×');
  if (t7s) await wire(t7, inOv(t7, 'Button · Save changes'), nav(t7s.id, DISSOLVE_150), 'Save changes', t7s.name);
  if (t7e) await wire(t7, inOv(t7, 'Button · Cancel task…'), nav(t7e.id, DISSOLVE_150), 'Cancel task… (U-7: reason-required error)', t7e.name);
}
if (t7e) {
  await wire(t7e, inOv(t7e, 'Button · Close'), back(), 'Close');
  await wire(t7e, xClose(overlay(t7e)), back(), 'drawer ×');
}
if (t7s) {
  if (b6) await wire(t7s, byName(toastOf(t7s), 'Close'), nav(b6.id, DISSOLVE_150), 'toast ×', B);
  if (t7) await wire(t7s, byName(t7s, 'Card/Task · Content upload'), nav(t7.id, DISSOLVE_150), 'card Content upload', T7);
  if (p5) await wire(t7s, crumb(t7s, 'Projects'), nav(p5.id), 'breadcrumb Projects', p5.name);
}
cleanAutoFlows();
flow(p5, 'P7 — Developer — Project delivery');
flow(b6, 'P7 — Developer — Project delivery (P7 Record delivered check)');
return R;
