// docs/phase7/scripts/developer/P44-02-meetings.js — Phase 7 wiring, page 44 (96:6). Developer role agent, 2026-10-23.
// Flow map: docs/phase7/flows/developer.md (Flow 2, 2m). Decisions: coordination [P7-1] D1–D6; DEC-005 Alt 1.
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

// ---- P44-02: Flow 2 Record meeting outcome (desktop) + Flow 2m (mobile). DEC-005 Alt 1 default: "Schedule meeting" shown but no schedule-new frame → unwired (D2/D6 note). ----
const M3 = 'SCR-DEV-003 — Meetings & calendar — ', M4 = 'SCR-DEV-004 — Meeting schedule / record — ';
const c3 = await F(M3 + 'Desktop — Light', '233:13090');
const c3m = await F(M3 + 'Mobile — Light', '233:13882');
const out = await F(M4 + 'Desktop — Light — Record outcome', '304:13932');
const res = await F(M4 + 'Desktop — Light — Reschedule', '304:13135');
const err = await F(M4 + 'Desktop — Light — Validation error', '304:13553');
const mOut = await F(M4 + 'Mobile — Light — Record outcome', '304:14663');
const mRes = await F(M4 + 'Mobile — Light — Reschedule', '304:14544');
const mSaved = await F(M4 + 'Mobile — Light — Outcome saved (agenda + toast)', '304:14736');

// Desktop week view
if (c3) {
  if (out) await wire(c3, byName(c3, /^Event · Sunrise Bakery/), nav(out.id, DISSOLVE_150), 'event 11:00 Outcome due · Sunrise Bakery', out.name);
  if (res) await wire(c3, byName(c3, /^Event · Peak Fitness/), nav(res.id, DISSOLVE_150), 'event Peak Fitness (Scheduled)', res.name);
}
// Record outcome drawer (Held pre-selected; RadioCards no reaction — D6)
if (out) {
  await wire(out, inOv(out, 'Button · Close'), back(), 'Close');
  await wire(out, xClose(overlay(out)), back(), 'drawer ×');
  if (c3) await wire(out, inOv(out, 'Button · Save outcome'), nav(c3.id), 'Save outcome (D2/U-4: no desktop saved frame)', c3.name);
}
// Reschedule drawer (optional branch → validation error state)
if (res) {
  await wire(res, inOv(res, 'Button · Close'), back(), 'Close');
  await wire(res, xClose(overlay(res)), back(), 'drawer ×');
  if (err) await wire(res, inOv(res, 'Button · Save new time'), nav(err.id, DISSOLVE_150), 'Save new time', err.name);
}
if (err) {
  await wire(err, inOv(err, 'Button · Close'), back(), 'Close');
  await wire(err, xClose(overlay(err)), back(), 'drawer ×');
}
// Mobile agenda
if (c3m) {
  if (mOut) await wire(c3m, byName(c3m, /^Agenda row · Sunrise Bakery/), nav(mOut.id), 'Agenda row · Sunrise Bakery — scope call', mOut.name);
  if (mRes) await wire(c3m, byName(c3m, /^Agenda row · Peak Fitness Gym/), nav(mRes.id), 'Agenda row · Peak Fitness Gym — kickoff', mRes.name);
}
if (mOut) {
  await wire(mOut, byName(mOut, 'Back'), back(), 'header Back');
  if (mSaved) await wire(mOut, byName(mOut, 'Button · Save outcome'), nav(mSaved.id), 'Save outcome (sticky)', mSaved.name);
}
if (mRes) await wire(mRes, byName(mRes, 'Back'), back(), 'header Back');
if (mSaved && c3m) await wire(mSaved, byName(toastOf(mSaved), 'Close'), nav(c3m.id), 'toast × (U-5: agenda still lists Sunrise)', c3m.name);

cleanAutoFlows();
flow(c3, 'P7 — Developer — Record meeting outcome');
flow(c3m, 'P7 — Developer — Record meeting outcome (mobile)');
return R;
