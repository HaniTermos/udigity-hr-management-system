// docs/phase7/scripts/developer/P44-01-deals-closure.js — Phase 7 wiring, page 44 (96:6). Developer role agent, 2026-10-23.
// Flow map: docs/phase7/flows/developer.md (Flow 1, 1a, 1b, 1c). Decisions: coordination [P7-1] D1–D6; policy-defaults DEC-006 Alt B, F2 Auto, DEC-005 Alt 1.
// Run via use_figma (async body, top-level await/return). Idempotent: setReactionsAsync REPLACES each own hotspot; own flows replaced by nodeId.
// Touches only the hotspots below. Sidebar + Request correction are P44-04. Returns {wired, missingTargets, missingHotspots, flows, errors}.
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

// ---- P44-01: Flow 1 Deals and closure (DEC-006 working default = Alt B Owner verification; F2 = Automatic; F3 separate per D1) ----
const N1 = 'SCR-DEV-001 — Deals — Desktop — Light', N2 = 'SCR-DEV-002 — Deal record detail — Desktop — Light', N8 = 'SCR-DEV-008 — Finalize closure — Desktop — Light — ';
const d1 = await F(N1, '171:11591');
const d1a = await F(N1 + ' — Accepted opportunities (DEC-005 Alt 1, not selected)', '171:11998');
const d2 = await F(N2, '263:13122');
const d2a = await F(N2 + ' — Accepted opportunity (DEC-005 Alt 1, not selected)', '263:13597');
const d2r = await F(N2 + ' — Verification rejected (DEC-006 Alt B, not selected)', '263:13954');
const altB = await F(N8 + 'Request verification (DEC-006 Alt B, not selected)', '321:13603');
const succ = await F(N8 + 'Success (F2 Automatic vs Manual)', '321:14696');
const f3 = await F(N8 + 'Closed, provisioning failed (F3)', '321:14318');
const tabHit = (frame, re) => { if (!frame) return null; const t = frame.findOne(n => n.type === 'TEXT' && re.test(n.characters.trim())); if (!t) return null; let p = t.parent; while (p && p !== frame && p.type !== 'INSTANCE') p = p.parent; return p && p !== frame ? p : t; };

// DEV-001 Closed deals: every row → DEV-002 L (D3: rows show Nova/Glow/…; DEV-002 L shows Cedar — Phase 8 item)
if (d1) {
  const rows = d1.findAll(n => n.type === 'FRAME' && /^Row · /.test(n.name));
  if (!rows.length) R.missingHotspots.push('SCR-DEV-001 — Deals — Desktop — Light › Row · *');
  for (const r of rows) if (d2) await wire(d1, r, nav(d2.id), r.name, N2);
  if (d1a) await wire(d1, tabHit(d1, /^Accepted opportunities/), nav(d1a.id), 'tab Accepted opportunities (DEC-005 Alt 1 default)', d1a.name);
}
// DEV-001 Accepted opportunities (DEC-005 Alt 1 = working default): Cedar → DEV-002 L (data match), Peak → DEV-002 Accepted
if (d1a) {
  if (d1) await wire(d1a, tabHit(d1a, /^Closed deals/), nav(d1.id), 'tab Closed deals', N1);
  if (d2) await wire(d1a, byName(d1a, /^Row · Cedar Home Realty/), nav(d2.id), 'Row · Cedar Home Realty', N2);
  if (d2a) await wire(d1a, byName(d1a, /^Row · Peak Fitness Gym/), nav(d2a.id), 'Row · Peak Fitness Gym', d2a.name);
}
// DEV-002 L (Cedar, Signed and paid): Alt B path only; "Finalize closure…" (Alt A) intentionally unwired
if (d2) {
  if (d1) await wire(d2, crumb(d2, 'Deals'), nav(d1.id), 'breadcrumb Deals', N1);
  if (altB) await wire(d2, byName(d2, 'Button · Request closure verification'), nav(altB.id, DISSOLVE_150), 'Request closure verification', altB.name);
}
if (d2a && d1a) await wire(d2a, crumb(d2a, 'Deals'), nav(d1a.id), 'breadcrumb Deals', d1a.name);
// DEV-008 Request verification (Alt B dialog)
if (altB) {
  await wire(altB, inOv(altB, 'Secondary action'), back(), 'Cancel');
  await wire(altB, xClose(overlay(altB)), back(), 'dialog ×');
  if (d2) await wire(altB, inOv(altB, 'Primary action'), nav(d2.id), 'Send for verification (D2: ends on DEV-002 L, stage stays Signed and paid)', N2);
}
// Alt flow: verification rejected → request again
if (d2r) {
  if (d1) await wire(d2r, crumb(d2r, 'Deals'), nav(d1.id), 'breadcrumb Deals', N1);
  if (altB) await wire(d2r, byName(d2r, 'Button · Request closure verification'), nav(altB.id, DISSOLVE_150), 'Request closure verification', altB.name);
}
// Alt flow: Owner verified → closed, F2 Automatic (Manual card "Create project board" intentionally unwired)
if (succ && d1) {
  await wire(succ, inOv(succ, 'Secondary action'), nav(d1.id), 'Close (D2/U-3 → Deals)', N1);
  await wire(succ, xClose(overlay(succ)), nav(d1.id), 'dialog ×', N1);
}
// Alt flow: F3 provisioning failure
if (f3 && d1) {
  await wire(f3, inOv(f3, 'Primary action'), nav(d1.id), 'Back to deal (D2/U-3 → Deals)', N1);
  await wire(f3, xClose(overlay(f3)), nav(d1.id), 'dialog ×', N1);
}
cleanAutoFlows();
flow(d1, 'P7 — Developer — Deals and closure');
flow(d2r, 'P7 — Developer — Deals and closure (verification rejected)');
flow(succ, 'P7 — Developer — Deals and closure (closed, F2 automatic)');
flow(f3, 'P7 — Developer — Deals and closure (F3 failure)');
return R;
