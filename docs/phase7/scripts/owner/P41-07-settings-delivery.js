// P41-07 — Flow 8: P7 — Owner — Settings (current SCR-OWN-011 frames as they are; + Not configured alt)
//          Flow 9: P7 — Owner — Delivery monitor → send again
// Page 41 (96:3). Idempotent: setReactionsAsync replaces each hotspot's reactions; setFlow replaces by node/name. Run order: docs/phase7/flows/owner.md.
// ---- Phase 7 wiring helpers (inlined from docs/phase7/wiring-helpers.js, OP-P7-1) ----
const FILE_KEY = 'GNrhb3DWa6mIhEX6F4Nmvw';
const DISSOLVE_200 = { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.2 };
let _frames = null;
function frameByName(nameOrRe) {
  if (!_frames) _frames = figma.currentPage.findAllWithCriteria({ types: ['FRAME'] })
    .filter(f => f.parent && (f.parent.type === 'PAGE' || f.parent.type === 'SECTION'));
  const test = nameOrRe instanceof RegExp ? (n) => nameOrRe.test(n) : (n) => n === nameOrRe;
  return _frames.find(f => test(f.name)) || null;
}
function findHotspot(frame, textOrName) {
  if (!frame) return null;
  const re = textOrName instanceof RegExp ? textOrName : null;
  const eq = (s) => re ? re.test(s) : s === textOrName;
  const has = (s) => re ? re.test(s) : s.toLowerCase().includes(String(textOrName).toLowerCase());
  let hit = frame.findOne(n => n.type !== 'TEXT' && eq(n.name))
         || frame.findOne(n => n.type !== 'TEXT' && has(n.name));
  if (hit) return hit;
  const t = frame.findOne(n => n.type === 'TEXT' && has(n.characters));
  if (!t) return null;
  let p = t.parent;
  while (p && p !== frame && p.type !== 'INSTANCE' && p.type !== 'FRAME') p = p.parent;
  return p && p !== frame ? p : t;
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
// ---- Owner extensions (page 41) ----
const OWNER_PAGE_ID = '96:3';
const INSTANT = null;
const SMART_250 = { type: 'SMART_ANIMATE', easing: { type: 'EASE_OUT' }, duration: 0.25 };
const OUT = { wired: [], missingTargets: [], missingHotspots: [], flows: [], errors: [] };
const TOUCHED = new Set();
const L = ' — Desktop — Light';
// Frame index: short key -> [full name, fallback id]
const FR = {
  'OWN-001': ['SCR-OWN-001 — Owner dashboard' + L, '200:22902'],
  'OWN-001 · Partial data': ['SCR-OWN-001 — Owner dashboard' + L + ' — Partial data', '200:24943'],
  'OWN-002': ['SCR-OWN-002 — Employees' + L, '201:22895'],
  'OWN-002 · Deactivated': ['SCR-OWN-002 — Employees' + L + ' — Deactivated, assignee inactive', '201:23714'],
  'OWN-003 · Edit': ['SCR-OWN-003 — Employee create / edit' + L + ' — Edit', '202:22895'],
  'OWN-003 · Create new': ['SCR-OWN-003 — Employee create / edit' + L + ' — Create new', '202:23396'],
  'OWN-003 · Duplicate email': ['SCR-OWN-003 — Employee create / edit' + L + ' — Validation error, duplicate email', '202:23622'],
  'OWN-003 · Save conflict': ['SCR-OWN-003 — Employee create / edit' + L + ' — Save conflict', '202:23857'],
  'OWN-003 · Deactivate impact': ['SCR-OWN-003 — Employee create / edit' + L + ' — Deactivate impact', '202:24085'],
  'OWN-003 · Change role': ['SCR-OWN-003 — Employee create / edit' + L + ' — Change role', '202:24260'],
  'OWN-003 · Success': ['SCR-OWN-003 — Employee create / edit' + L + ' — Success', '202:24415'],
  'OWN-004': ['SCR-OWN-004 — Attendance monitoring & exception alerts' + L, '287:22811'],
  'OWN-004 · Schedule not configured': ['SCR-OWN-004 — Attendance monitoring & exception alerts' + L + ' — Schedule not configured', '287:24817'],
  'OWN-004 · Alert delivery failed': ['SCR-OWN-004 — Attendance monitoring & exception alerts' + L + ' — Alert delivery failed', '287:25375'],
  'OWN-004 · Exception detail': ['SCR-OWN-004 — Attendance monitoring & exception alerts' + L + ' — Exception detail', '287:25933'],
  'OWN-005': ['SCR-OWN-005 — Attendance corrections & review queue' + L, '205:22895'],
  'OWN-005 · Alt A': ['SCR-OWN-005 — Attendance corrections & review queue' + L + ' — DEC-011 Alt A reading', '205:23504'],
  'OWN-005 · Alt B': ['SCR-OWN-005 — Attendance corrections & review queue' + L + ' — DEC-011 Alt B reading', '205:23837'],
  'OWN-005 · Validation error': ['SCR-OWN-005 — Attendance corrections & review queue' + L + ' — Validation error', '205:24133'],
  'OWN-005 · Save conflict': ['SCR-OWN-005 — Attendance corrections & review queue' + L + ' — Save conflict', '205:24467'],
  'OWN-005 · Success': ['SCR-OWN-005 — Attendance corrections & review queue' + L + ' — Success', '205:24768'],
  'OWN-006': ['SCR-OWN-006 — Targets & work lists' + L, '206:22844'],
  'OWN-006 · Insufficient work': ['SCR-OWN-006 — Targets & work lists' + L + ' — Insufficient work', '206:23695'],
  'OWN-006 · Ineligible items': ['SCR-OWN-006 — Targets & work lists' + L + ' — Ineligible items', '206:24095'],
  'OWN-007': ['SCR-OWN-007 — Calling assignments' + L, '237:22788'],
  'OWN-007 · Ineligible excluded': ['SCR-OWN-007 — Calling assignments' + L + ' — Ineligible excluded', '237:23854'],
  'OWN-007 · Needs decision': ['SCR-OWN-007 — Calling assignments' + L + ' — Needs decision, B7 and inactive agent', '237:24357'],
  'OWN-007 · Reserved': ['SCR-OWN-007 — Calling assignments' + L + ' — Reserved by another agent', '237:24685'],
  'OWN-007 · Save conflict': ['SCR-OWN-007 — Calling assignments' + L + ' — Save conflict', '237:25183'],
  'OWN-008': ['SCR-OWN-008 — Reassignment impact' + L, '302:22859'],
  'OWN-008 · All choices made': ['SCR-OWN-008 — Reassignment impact' + L + ' — All choices made', '302:23346'],
  'OWN-008 · Override confirm': ['SCR-OWN-008 — Reassignment impact' + L + ' — Override confirm', '302:23584'],
  'OWN-008 · Save conflict': ['SCR-OWN-008 — Reassignment impact' + L + ' — Save conflict', '302:23742'],
  'OWN-008 · Success': ['SCR-OWN-008 — Reassignment impact' + L + ' — Success', '302:23900'],
  'OWN-009': ['SCR-OWN-009 — Reports & exports' + L, '289:22805'],
  'OWN-009 · Unauthorized': ['SCR-OWN-009 — Reports & exports' + L + ' — Unauthorized, non-Owner', '289:23899'],
  'OWN-009 · Preparing': ['SCR-OWN-009 — Reports & exports' + L + ' — Preparing download', '289:24492'],
  'OWN-009 · Export failure': ['SCR-OWN-009 — Reports & exports' + L + ' — Export failure', '289:25034'],
  'OWN-009 · Success': ['SCR-OWN-009 — Reports & exports' + L + ' — Success', '289:25577'],
  'OWN-010': ['SCR-OWN-010 — Audit log explorer' + L, '210:22783'],
  'OWN-010 · Event detail': ['SCR-OWN-010 — Audit log explorer' + L + ' — Event detail', '210:23641'],
  'OWN-011': ['SCR-OWN-011 — Settings' + L, '275:22810'],
  'OWN-011 · Not configured': ['SCR-OWN-011 — Settings' + L + ' — Not configured', '275:23706'],
  'OWN-011 · Validation error': ['SCR-OWN-011 — Settings' + L + ' — Validation error', '275:24147'],
  'OWN-011 · Test office check': ['SCR-OWN-011 — Settings' + L + ' — Test office check', '275:24593'],
  'OWN-011 · Save conflict': ['SCR-OWN-011 — Settings' + L + ' — Save conflict', '275:25028'],
  'OWN-011 · Success': ['SCR-OWN-011 — Settings' + L + ' — Success', '275:25468'],
  'OWN-011 · Security tab': ['SCR-OWN-011 — Settings' + L + ' — Security tab', '275:25905'],
  'OWN-012': ['SCR-OWN-012 — Delivery & exception monitor' + L, '212:22791'],
  'OWN-012 · Failed item detail': ['SCR-OWN-012 — Delivery & exception monitor' + L + ' — Failed item detail', '212:23487'],
  'OWN-012 · Retrying': ['SCR-OWN-012 — Delivery & exception monitor' + L + ' — Retrying', '212:23907'],
  'OWN-012 · Empty': ['SCR-OWN-012 — Delivery & exception monitor' + L + ' — Empty', '212:24236'],
};
// Cross-page OPEN_URL targets (IDs from docs/phase6/previews/<page>/index.md, 2026-10-23)
const XP = {
  'DE-001': '165:81145', 'DE-006': '308:13955', 'DE-007': '178:11715',
  'CC-001': '311:13767', 'CC-004': '285:13809', 'CC-007': '316:13709', 'CC-008': '316:15211',
  'DEV-001': '171:11591', 'DEV-005': '235:13090',
  'SHR-001': '303:10513', 'SHR-006': '189:10468', 'SHR-007': '165:2880',
};
const _fc = {};
async function F(key) {
  if (key in _fc) return _fc[key];
  const e = FR[key]; let f = null;
  if (e) {
    f = frameByName(e[0]);
    if (!f) { try { const n = await figma.getNodeByIdAsync(e[1]); if (n && n.type === 'FRAME' && !n.removed) { let p = n.parent; while (p && p.type !== 'PAGE') p = p.parent; if (p && p.id === figma.currentPage.id) f = n; } } catch (err) { } }
  }
  _fc[key] = f; return f;
}
function inShell(n, root) { let p = n.parent; while (p && p !== root) { if (/^Shell\//.test(p.name)) return true; p = p.parent; } return /^Shell\//.test(n.name); }
function vis(n) { let p = n; while (p && p.type !== 'PAGE') { if (p.visible === false) return false; p = p.parent; } return true; }
function ctrlOf(t, root) {
  let p = t.parent, firstFrame = null;
  while (p && p !== root) { if (p.type === 'INSTANCE') return p; if (!firstFrame && p.type === 'FRAME') firstFrame = p; p = p.parent; }
  return firstFrame || t;
}
// Find a hotspot inside root (shell excluded). cands: string | RegExp, tried in order.
// string: layer 'Button · X' / 'Item · X' / 'Filter · X' / exact name, then TEXT === X (trimmed). RegExp: layer name, then TEXT.
function hot(root, cands) {
  if (!root) return null;
  const ok = (n) => !inShell(n, root) && vis(n);
  for (const c of [].concat(cands)) {
    let hit = null;
    if (c instanceof RegExp) {
      hit = root.findOne(n => n.type !== 'TEXT' && c.test(n.name) && ok(n));
      if (!hit) { const t = root.findOne(n => n.type === 'TEXT' && c.test(n.characters.trim()) && ok(n)); if (t) hit = ctrlOf(t, root); }
    } else {
      const names = ['Button · ' + c, 'Item · ' + c, 'Filter · ' + c, 'Radio · ' + c, 'RadioCard · ' + c, 'Tab · ' + c, c];
      for (const nm of names) { hit = root.findOne(n => n.type !== 'TEXT' && n.name === nm && ok(n)); if (hit) break; }
      if (!hit) { const t = root.findOne(n => n.type === 'TEXT' && n.characters.trim() === c && ok(n)); if (t) hit = ctrlOf(t, root); }
    }
    if (hit) return hit;
  }
  return null;
}
// Find a hotspot near an anchor (row/card text): walk up from the anchor until an ancestor contains the hotspot.
function near(root, anchor, cands) {
  if (!root) return null;
  const m = (s) => anchor instanceof RegExp ? anchor.test(s) : s.trim() === anchor || s.includes(anchor);
  const anchors = root.findAll(n => !inShell(n, root) && vis(n) && (n.type === 'TEXT' ? m(n.characters) : m(n.name)));
  for (const a of anchors) {
    let p = a.type === 'TEXT' ? a.parent : a;
    while (p && p !== root) { const h = ('findOne' in p) ? hot(p, cands) : null; if (h) return h; p = p.parent; }
  }
  return null;
}
// Row (the anchor's nearest list-item/row container) as hotspot
function rowOf(root, anchor) {
  if (!root) return null;
  const m = (s) => anchor instanceof RegExp ? anchor.test(s) : s.trim() === anchor || s.includes(anchor);
  const named = root.findOne(n => n.type !== 'TEXT' && /^(Item|Row|Table row|TR) · /.test(n.name) && m(n.name) && !inShell(n, root) && vis(n));
  if (named) return named;
  const t = root.findOne(n => n.type === 'TEXT' && m(n.characters) && !inShell(n, root) && vis(n));
  if (!t) return null;
  let p = t.parent;
  while (p && p !== root) { if (/^(Item|Row|Table row|TR|Cell row)/.test(p.name) || (p.type === 'INSTANCE' && /Item|Row|List/i.test(p.name))) return p; p = p.parent; }
  return ctrlOf(t, root);
}
// Topmost overlay layer of a frame: a Dialog if drawn, else a Drawer, else the frame (drawers/dialogs are full-frame clones).
function ov(f) { if (!f) return null; return f.findOne(n => /^Dialog · /.test(n.name) && vis(n)) || f.findOne(n => /^Drawer · /.test(n.name) && vis(n)) || f; }
// Toast close: the close control inside the Toast instance, else the toast itself.
function toastX(f) { const t = f && f.findOne(n => /^Toast · /.test(n.name) && vis(n)); if (!t) return null; return t.findOne(n => n.type === 'INSTANCE' && /(^|[/ ·])(close|dismiss|x|✕)$/i.test(n.name)) || t; }
// Wire one step. from: frame key; finder: fn(frame) -> node; act: {to, tr} | {url} | {back:true}
async function W(step, fromKey, label, finder, act) {
  const fr = await F(fromKey);
  if (!fr) { OUT.missingTargets.push(step + ' source frame ' + fromKey); return; }
  let action;
  if (act.back) action = back();
  else if (act.url) action = url(act.url);
  else {
    const to = await F(act.to);
    if (!to) { OUT.missingTargets.push(step + ' ' + fromKey + ' › ' + label + ' → ' + act.to); return; }
    action = nav(to.id, act.tr === undefined ? DISSOLVE_200 : act.tr);
  }
  let node = null; try { node = finder(fr); } catch (e) { OUT.errors.push(step + ' find: ' + String(e)); }
  if (!node) { OUT.missingHotspots.push(step + ' ' + fromKey + ' › ' + label); return; }
  if (node === fr) { OUT.missingHotspots.push(step + ' ' + fromKey + ' › ' + label + ' (resolved to frame itself; skipped)'); return; }
  const rep = [];
  if (await onClick(node, action, rep)) { TOUCHED.add(fr.id); OUT.wired.push(step + ' ' + fromKey + ' › ' + label + ' [' + node.id + '] → ' + (act.back ? 'BACK' : act.url ? 'URL ' + act.url : act.to)); }
  else OUT.missingHotspots.push(step + ' ' + fromKey + ' › ' + label + ' (reaction refused: ' + (rep[0] ? rep[0].err : '?') + ')');
}
// Same step applied to several source frames
async function WM(step, fromKeys, label, finder, act) { for (const k of fromKeys) await W(step, k, label, finder, act); }
async function FLOW(key, name) {
  const fr = await F(key);
  if (!fr) { OUT.missingTargets.push('flow start ' + key + ' (' + name + ')'); return; }
  try { OUT.flows.push(setFlow(fr, name)); } catch (e) { OUT.errors.push('flow ' + name + ': ' + String(e)); }
}
// Remove Figma's auto-created "Flow N" entries, only on frames this script touched (and not named starts).
function cleanAutoFlows() {
  const page = figma.currentPage;
  const before = page.flowStartingPoints.length;
  page.flowStartingPoints = page.flowStartingPoints.filter(f => !(TOUCHED.has(f.nodeId) && /^Flow \d+$/.test(f.name)));
  return before - page.flowStartingPoints.length;
}
async function setPage() {
  const p = await figma.getNodeByIdAsync(OWNER_PAGE_ID);
  if (!p || p.type !== 'PAGE') throw new Error('Page 41 (' + OWNER_PAGE_ID + ') not found');
  await figma.setCurrentPageAsync(p);
}
function done(script) {
  const removed = cleanAutoFlows();
  return { script, page: OWNER_PAGE_ID, wired: OUT.wired.length, wiredSteps: OUT.wired, missingTargets: OUT.missingTargets, missingHotspots: OUT.missingHotspots, flows: OUT.flows, autoFlowsRemoved: removed, errors: OUT.errors };
}
// ---- end helpers ----
await setPage();
const S = 'OWN-011', M = 'OWN-012', FD = 'OWN-012 · Failed item detail';
const SATT = [S, 'OWN-011 · Not configured', 'OWN-011 · Validation error', 'OWN-011 · Test office check', 'OWN-011 · Save conflict', 'OWN-011 · Success'];
// ---- Flow 8 (DEC-009 RadioCards: no selected-state frame, not wired)
await W('8.1', S, 'Test office check', f => hot(f, ['Test office check']), { to: 'OWN-011 · Test office check', tr: SMART_250 });
await WM('8.2', [S, 'OWN-011 · Test office check'], 'Save attendance settings', f => hot(f, ['Save attendance settings']), { to: 'OWN-011 · Success' });
await W('8.3', 'OWN-011 · Not configured', 'Save attendance settings', f => hot(f, ['Save attendance settings']), { to: 'OWN-011 · Validation error' });
await W('8.4', 'OWN-011 · Validation error', 'Discard', f => hot(f, ['Discard']), { to: S });
await WM('8.5', SATT, 'Security tab', f => hot(f, ['Security']), { to: 'OWN-011 · Security tab', tr: INSTANT });
await W('8.6', 'OWN-011 · Security tab', 'Attendance & office check tab', f => hot(f, ['Attendance & office check']), { to: S, tr: INSTANT });
await W('8.7', 'OWN-011 · Save conflict', 'Review latest (banner)', f => hot(f, ['Review latest']), { to: S });
await W('8.8', 'OWN-011 · Success', 'Toast close', f => toastX(f), { to: S });
await W('8.9', S, 'Discard (no-op)', f => hot(f, ['Discard']), { to: S, tr: INSTANT });
await FLOW(S, 'P7 — Owner — Settings');
await FLOW('OWN-011 · Not configured', 'P7 — Owner — Settings (Not configured)');
// ---- Flow 9 (F3 retry row is not drawn: the provisioning chip ends on Empty — closest existing frame)
await W('9.1', M, 'Row Meeting reminder · Peak Fitness Gym', f => rowOf(f, 'Peak Fitness Gym'), { to: FD });
await W('9.2', M, 'Row 1 Send again', f => near(f, 'Peak Fitness Gym', ['Send again']) || hot(f, ['Send again']), { to: FD });
await W('9.3', FD, 'Close', f => hot(ov(f), ['Close']), { back: true });
await W('9.4', FD, 'Send again (new reminder)', f => hot(ov(f), ['Send again (new reminder)']), { to: 'OWN-012 · Retrying' });
await W('9.5', M, 'Row 3 View (Lumen Yoga)', f => near(f, 'Lumen Yoga', ['View']), { to: 'OWN-012 · Retrying' });
await W('9.6', M, 'Project provisioning · 0 chip', f => hot(f, [/^Filter · Project provisioning/, /^Project provisioning/]), { to: 'OWN-012 · Empty', tr: INSTANT });
await W('9.7', 'OWN-012 · Empty', 'All chip', f => hot(f, [/^Filter · All/, /^All( · \d+)?$/]), { to: M, tr: INSTANT });
await FLOW(M, 'P7 — Owner — Delivery monitor → send again');
return done('P41-07-settings-delivery');
