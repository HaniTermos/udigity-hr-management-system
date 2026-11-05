// P44-00 — Developer connector frame for the P7 "Record delivered" check (coordination [P7-1] D2 exception).
// Builds ONE frame: `SCR-DEV-006 — Project board — Desktop — Light — Delivered (P7 connector)`
// = clone of `SCR-DEV-006 — Project board — Desktop — Light` (228:13090) with only status + text changed:
//   project badge In progress → Delivered (Badge Tone Info, as SCR-DEV-005), since-caption, allowed next statuses
//   (Waiting/Blocked/Back to Scheduled hidden; "Record delivered" relabelled "Record completed"), rule caption,
//   plus the spec toast "Project delivered · 3 tasks still open" (DS Toast 53:2032, Success — existing component, no new component).
// Kanban columns and task cards are NOT touched (P7 check 4: every task keeps its column).
// Rules: never sets x/y/size on instance children; never detaches; never deletes; never moves the section.
// Idempotent: if the connector already exists it is reused and its text/status re-applied (nothing removed).
// Run BEFORE P44-03. Returns {wired, missingTargets, missingHotspots, flows, connector, warnings}.
await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('96:6'));
const page = figma.currentPage;
const OUT = { wired: [], missingTargets: [], missingHotspots: [], flows: [], connector: null, warnings: [] };
const warn = (m) => OUT.warnings.push(m);
const SRC_NAME = 'SCR-DEV-006 — Project board — Desktop — Light', SRC_ID = '228:13090';
const NAME = 'SCR-DEV-006 — Project board — Desktop — Light — Delivered (P7 connector)';
const SEC_NAME = 'SCR-DEV-006 — Project board', SEC_ID = '118:59065';

function setP(i, obj) {
  if (!i) { warn('setP on missing instance ' + JSON.stringify(obj)); return i; }
  const cp = i.componentProperties, upd = {};
  for (const [k, v] of Object.entries(obj)) { const key = Object.keys(cp).find(x => x === k || x.split('#')[0] === k); if (!key) { warn(`${i.name}: no property ${k}`); continue; } upd[key] = v; }
  try { if (Object.keys(upd).length) i.setProperties(upd); } catch (e) { warn(`${i.name}: setProperties failed ${e.message}`); }
  return i;
}
async function fontsOf(t) { const fs = t.getRangeAllFontNames(0, Math.max(1, t.characters.length)); for (const f of fs) await figma.loadFontAsync(f); }
async function setText(root, pred, txt, label) {
  const t = root.findOne(n => n.type === 'TEXT' && pred(n));
  if (!t) { warn('text not found: ' + label); return; }
  try { await fontsOf(t); t.characters = txt; } catch (e) { warn(`text ${label}: ${e.message}`); }
}

// 1 section + source
let sec = page.findOne(n => n.type === 'SECTION' && n.name === SEC_NAME);
if (!sec) { const n = await figma.getNodeByIdAsync(SEC_ID); if (n && n.type === 'SECTION') sec = n; }
if (!sec) throw new Error('SCR-DEV-006 section not found (' + SEC_ID + ')');
let src = sec.findOne(n => n.type === 'FRAME' && n.name === SRC_NAME);
if (!src) { const n = await figma.getNodeByIdAsync(SRC_ID); if (n && n.type === 'FRAME') src = n; }
if (!src) { OUT.missingTargets.push(SRC_NAME + ' (' + SRC_ID + ')'); return OUT; }

// 2 reuse or clone (no deletion on re-run)
let f = sec.children.find(n => n.type === 'FRAME' && n.name === NAME);
const created = !f;
if (!f) {
  const frames = sec.children.filter(n => n.type === 'FRAME' && n !== src);
  const X = Math.max(src.x + src.width, ...frames.map(n => n.x + n.width)) + 120;
  f = src.clone(); f.name = NAME; sec.appendChild(f); f.x = X; f.y = src.y; // top-level frame in the section, not an instance child
  // grow the section to the right only if needed (x/y unchanged → section not moved)
  if (f.x + f.width + 80 > sec.width) {
    const newW = f.x + f.width + 80;
    for (const o of page.children) if (o !== sec && o.type === 'SECTION' && o.x >= sec.x + sec.width && o.x < sec.x + newW + 400 && o.y < sec.y + sec.height && o.y + o.height > sec.y)
      warn(`section grows to ${Math.round(newW)} wide and may overlap ${o.name} — orchestrator to re-flow`);
    sec.resizeWithoutConstraints(newW, sec.height);
  }
  // the clone must not inherit the source's prototype reactions (P44-03 wires the connector itself)
  try { await f.setReactionsAsync([]); for (const n of f.findAll(n => 'reactions' in n && n.reactions && n.reactions.length)) await n.setReactionsAsync([]); } catch (e) { warn('clear cloned reactions: ' + e.message); }
}

// 3 status (instances in the frame's own layout — properties only, no geometry)
const metaBadge = f.findOne(n => n.type === 'INSTANCE' && /^Badge · Project · /.test(n.name));
setP(metaBadge, { Label: 'Project · Delivered' }); setP(metaBadge, { Tone: 'Info' }); if (metaBadge) metaBadge.name = 'Badge · Project · Delivered';
const cur = f.findOne(n => n.name === 'Current status');
const stBadge = cur ? cur.findOne(n => n.type === 'INSTANCE' && /^Badge · /.test(n.name)) : null;
if (!stBadge) warn('status badge not found in Current status');
setP(stBadge, { Tone: 'Info' }); setP(stBadge, { Label: 'Delivered' }); if (stBadge) stBadge.name = 'Badge · Delivered';
if (cur) await setText(cur, n => /^since /.test(n.characters), 'since 23 Oct 2026 · by Sami Fares', 'since caption');

// 4 allowed next statuses from Delivered
const moves = f.findOne(n => n.name === 'Allowed next statuses');
if (!moves) warn('Allowed next statuses row not found');
else {
  for (const n of moves.children) if (n.type === 'INSTANCE' && /^Button · (Waiting for client…|Blocked…|Back to Scheduled)$/.test(n.name)) n.visible = false;
  const rd = moves.children.find(n => n.type === 'INSTANCE' && /^Button · Record (delivered|completed)$/.test(n.name));
  if (rd) { setP(rd, { Label: 'Record completed' }); rd.name = 'Button · Record completed'; } else warn('Record delivered button not found');
  await setText(moves, n => n.name === 'Rule caption', 'Delivered · Completed is recorded from here', 'rule caption');
}

// 5 activity rail: left as cloned (status + text scope; the toast carries the change)

// 6 toast (direct child of the frame, like SCR-DEV-007 Success)
let toast = f.children.find(n => n.type === 'INSTANCE' && /^Toast · Project delivered/.test(n.name));
if (!toast) {
  const set = await figma.getNodeByIdAsync('53:2032');
  if (!set) warn('DS Toast 53:2032 not found');
  else {
    const comp = set.type === 'COMPONENT_SET' ? (set.children.find(c => c.variantProperties && c.variantProperties.Tone === 'Success') || set.defaultVariant) : set;
    toast = comp.createInstance(); toast.name = 'Toast · Project delivered'; f.appendChild(toast);
  }
}
if (toast) {
  setP(toast, { Title: 'Project delivered · 3 tasks still open', Body: 'Only the project status changed. Every task keeps its column.', 'Show body': true });
  if (Math.round(toast.width) !== 400) toast.resize(400, toast.height);
  toast.x = 1440 - 400 - 24; toast.y = 900 - toast.height - 24;
}

OUT.connector = { id: f.id, name: f.name, created, section: [sec.x, sec.y, Math.round(sec.width), Math.round(sec.height)],
  link: `https://www.figma.com/design/GNrhb3DWa6mIhEX6F4Nmvw?node-id=${f.id.replace(':', '-')}` };
return OUT;
