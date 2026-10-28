// docs/phase7/scripts/developer/P44-04-sidebar-correction.js — Phase 7 wiring, page 44 (96:6). Developer role agent, 2026-10-23.
// Flow map: docs/phase7/flows/developer.md (Shared sidebar, Flow 4). Run LAST of P44-01..04 (it adds the sidebar to frames whose other hotspots 01–03 own).
// Run via use_figma (async body). Idempotent; touches only sidebar Nav items + Request correction hotspots. Returns {wired, missingTargets, missingHotspots, flows, errors}.
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

// ---- P44-04: shared sidebar (Deals / Meetings & Calendar / Projects) on overlay-free desktop Light frames + Flow 4 Request correction (OPEN_URL page 42) ----
const SHR009_DESK = '310:13530', SHR009_MOB = '310:14186'; // SCR-SHR-009 Open request warning (desktop) / Sheet (mobile), page 42
const dDeals = await F('SCR-DEV-001 — Deals — Desktop — Light', '171:11591');
const dMeet = await F('SCR-DEV-003 — Meetings & calendar — Desktop — Light', '233:13090');
const dProj = await F('SCR-DEV-005 — Projects — Desktop — Light', '235:13090');
const d2 = await F('SCR-DEV-002 — Deal record detail — Desktop — Light', '263:13122');
const d2r = await F('SCR-DEV-002 — Deal record detail — Desktop — Light — Verification rejected (DEC-006 Alt B, not selected)', '263:13954');
const b6 = await F('SCR-DEV-006 — Project board — Desktop — Light', '228:13090');
const res = await F('SCR-DEV-004 — Meeting schedule / record — Desktop — Light — Reschedule', '304:13135');
const b6m = await F('SCR-DEV-006 — Project board — Mobile — Light', '228:15207');
const mRes = await F('SCR-DEV-004 — Meeting schedule / record — Mobile — Light — Reschedule', '304:14544');
const SIDEBAR_FRAMES = [
  dDeals, await F('SCR-DEV-001 — Deals — Desktop — Light — Accepted opportunities (DEC-005 Alt 1, not selected)', '171:11998'),
  d2, d2r, dMeet, dProj, b6,
  await F('SCR-DEV-006 — Project board — Desktop — Light — Completed (read-only)', '228:13850'),
  await F('SCR-DEV-007 — Task detail — Desktop — Light — Success', '267:14861'),
  frameByName('SCR-DEV-006 — Project board — Desktop — Light — Delivered (P7 connector)') // optional (P44-00)
].filter(Boolean);
const NAV = [['Deals', dDeals], ['Meetings & Calendar', dMeet], ['Projects', dProj]];
for (const fr of SIDEBAR_FRAMES) for (const [lab, tgt] of NAV) if (tgt) await wire(fr, byName(fr, 'Nav/Item · ' + lab), nav(tgt.id), 'sidebar ' + lab, tgt.name);

// Flow 4 — Request correction → shared drawer SCR-SHR-009 on page 42 (cross-page OPEN_URL)
if (d2) await wire(d2, byName(d2, 'Link · Request correction'), url(SHR009_DESK), 'Request correction (Business context)');
if (d2r) await wire(d2r, byName(d2r, 'Link · Request correction'), url(SHR009_DESK), 'Request correction (Business context)');
if (b6) await wire(b6, byName(b6, 'Link · Request correction'), url(SHR009_DESK), 'rail Request correction');
if (res) await wire(res, inOv(res, 'Link · Request correction'), url(SHR009_DESK), 'Request correction (drawer link row)');
if (b6m) await wire(b6m, byName(b6m, 'Button · Request correction'), url(SHR009_MOB), 'Request correction (48 px)');
if (mRes) await wire(mRes, byName(mRes, 'Button · Request correction'), url(SHR009_MOB), 'Request correction (48 px Ghost)');
// SCR-DEV-008 F3/Success background "Request correction" stays unwired (behind the scrim); SCR-SHR-008 not used (U-10)

cleanAutoFlows();
flow(d2, 'P7 — Developer — Request correction');
flow(b6m, 'P7 — Developer — Request correction (mobile)');
return R;
