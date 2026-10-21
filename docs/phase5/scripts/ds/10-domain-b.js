// 10-domain-b.js — Design-System Agent — Phase 5 (Udigity Management System)
// Domain B — Attendance/Timer, Attendance/VerificationStatus, Attendance/Panel, Notice/Duplicate (visible / hidden match), Banner/Reservation (contact reservation states), Queue/BucketHeader, Queue/Row, Row/Phone, Row/Social — page 21 DS — Components (36:3)
// Run with use_figma. Idempotent: existing components with the same name are skipped (set REBUILD = true to rebuild).
const PAGE_ID = '36:3';
const REBUILD = false;
// ---------- DS helper library (inlined in every DS component script) ----------
// REBUILD=false: existing components with the same name are kept (IDs stable) and skipped.
// REBUILD=true : this script's components are deleted and rebuilt (IDs change — tell downstream agents).
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const _cols = await figma.variables.getLocalVariableCollectionsAsync();
const semCol = _cols.find(c => c.name === 'Semantic'), primCol = _cols.find(c => c.name === 'Primitives');
if (!semCol || !primCol) throw new Error('Run 01-variables.js first (collections Primitives/Semantic missing)');
const DARK = (semCol.modes.find(m => m.name === 'Dark') || {}).modeId;
const LIGHT = (semCol.modes.find(m => m.name === 'Light') || {}).modeId;
const V = {};
for (const v of await figma.variables.getLocalVariablesAsync()) {
  if (v.variableCollectionId === semCol.id) V[v.name] = v;
  else if (v.variableCollectionId === primCol.id) V['p/' + v.name] = v;
}
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const ES = {}; for (const s of await figma.getLocalEffectStylesAsync()) ES[s.name] = s;
const OUT = { created: {}, existing: {}, rebuilt: [], warnings: [] };
const REG = {};
// index existing components / sets on this page by exact name
for (const n of page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })) {
  if (n.type === 'COMPONENT' && n.parent && n.parent.type === 'COMPONENT_SET') continue;
  if (!REG[n.name]) REG[n.name] = n;
}
// temp build frame (removed at the end; leftover from a failed run is removed here)
for (const n of page.children.filter(c => c.name === '__ds_tmp')) n.remove();
const TMP = figma.createFrame(); TMP.name = '__ds_tmp'; TMP.fills = []; TMP.x = -20000; TMP.y = -20000;

function vv(n) { const v = V[n]; if (!v) throw new Error('Missing variable ' + n); return v; }
function P(n, opacity) { const p = figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', vv(n)); return opacity == null ? p : Object.assign({}, p, { opacity }); }
function fill(n, name, op) { n.fills = name ? [P(name, op)] : []; return n; }
function stroke(n, name, w, align, dash) { n.strokes = [P(name)]; n.strokeWeight = w || 1; n.strokeAlign = align || 'INSIDE'; if (dash) n.dashPattern = dash; return n; }
function bnum(n, field, vname, raw) { const v = V[vname]; if (v) n.setBoundVariable(field, v); else n[field] = raw; }
function pad(n, t, r, b, l) { if (r == null) r = t; if (b == null) b = t; if (l == null) l = r; [['paddingTop', t], ['paddingRight', r], ['paddingBottom', b], ['paddingLeft', l]].forEach(([f, x]) => bnum(n, f, 'p/space/' + x, x)); return n; }
function gap(n, g) { bnum(n, 'itemSpacing', 'p/space/' + g, g); return n; }
function rad(n, key) { const v = V['p/radius/' + key]; for (const c of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) { if (v) n.setBoundVariable(c, v); else n[c] = 0; } return n; }
function opts(f, o) {
  if (!o) return f;
  if (o.gap != null) gap(f, o.gap);
  if (o.pad != null) pad(f, ...[].concat(o.pad));
  if (o.fill) fill(f, o.fill, o.fillOp);
  if (o.stroke) stroke(f, o.stroke, o.sw, o.salign, o.dash);
  if (o.radius) rad(f, o.radius);
  if (o.align) f.counterAxisAlignItems = o.align;
  if (o.justify) f.primaryAxisAlignItems = o.justify;
  if (o.w != null || o.h != null) size(f, o.w, o.h);
  if (o.clip != null) f.clipsContent = o.clip;
  return f;
}
// w/h: number = fixed, undefined/'hug' = hug
function size(f, w, h) {
  f.resize(typeof w === 'number' ? w : Math.max(f.width, 1), typeof h === 'number' ? h : Math.max(f.height, 1));
  if (f.layoutMode && f.layoutMode !== 'NONE') { f.layoutSizingHorizontal = typeof w === 'number' ? 'FIXED' : 'HUG'; f.layoutSizingVertical = typeof h === 'number' ? 'FIXED' : 'HUG'; }
  return f;
}
function AL(name, dir, o) { const f = figma.createAutoLayout(dir || 'HORIZONTAL'); f.name = name; f.fills = []; TMP.appendChild(f); return opts(f, o); }
function FR(name, w, h, o) { const f = figma.createFrame(); f.name = name; f.fills = []; TMP.appendChild(f); f.resize(w, h); return opts(f, o); }
function COMP(name, dir, o) {
  const c = figma.createComponent(); c.name = name; TMP.appendChild(c); c.fills = [];
  if (dir) { c.layoutMode = dir; c.primaryAxisSizingMode = 'AUTO'; c.counterAxisSizingMode = 'AUTO'; }
  return opts(c, o);
}
function RECT(name, w, h, color, o) { const r = figma.createRectangle(); r.name = name; TMP.appendChild(r); r.resize(w, h); fill(r, color); if (o && o.radius) rad(r, o.radius); if (o && o.stroke) stroke(r, o.stroke, o.sw, 'INSIDE', o.dash); return r; }
function DOT(name, d, color) { const e = figma.createEllipse(); e.name = name; TMP.appendChild(e); e.resize(d, d); fill(e, color); return e; }
async function T(chars, style, color, o) {
  o = o || {};
  const t = figma.createText(); TMP.appendChild(t);
  t.fontName = { family: 'Inter', style: 'Regular' };
  t.characters = String(chars);
  const st = TS[style]; if (!st) throw new Error('Missing text style ' + style);
  await t.setTextStyleIdAsync(st.id);
  fill(t, color || 'text/primary');
  t.name = o.name || String(chars).slice(0, 40);
  if (o.w) { t.textAutoResize = 'HEIGHT'; t.resize(o.w, Math.max(t.height, 1)); }
  if (o.align) t.textAlignHorizontal = o.align;
  if (o.truncate) { t.textTruncation = 'ENDING'; t.maxLines = o.truncate; }
  return t;
}
function add(p, ...kids) { for (const k of kids.flat()) if (k) p.appendChild(k); return p; }
function fillW(n) { n.layoutSizingHorizontal = 'FILL'; return n; }
function fillH(n) { n.layoutSizingVertical = 'FILL'; return n; }
function grow(n) { n.layoutGrow = 1; return n; }
// walk without descending into instances (instance node itself included)
function walk(n, fn) { if (!('children' in n)) return; for (const c of n.children) { fn(c); if (c.type !== 'INSTANCE') walk(c, fn); } }
function link(owner, propName, type, def, layerName, field) {
  const key = owner.addComponentProperty(propName, type, def);
  const targets = owner.type === 'COMPONENT_SET' ? owner.children : [owner];
  let hits = 0; const names = [].concat(layerName);
  for (const c of targets) walk(c, n => { if (names.includes(n.name)) { n.componentPropertyReferences = Object.assign({}, n.componentPropertyReferences || {}, { [field]: key }); hits++; } });
  if (!hits) OUT.warnings.push(`${owner.name}: property ${propName} linked to no layer "${layerName}"`);
  return key;
}
const pv = name => Object.fromEntries(name.split(', ').map(s => s.split('=').map(x => x.trim())));
function cartesian(axes) { let res = [{}]; for (const [k, vals] of Object.entries(axes)) { const nx = []; for (const r of res) for (const v of vals) nx.push(Object.assign({}, r, { [k]: v })); res = nx; } return res; }
// build a variant set: make(props) returns a COMPONENT (any name; renamed here)
async function VSET(name, axes, make, o) {
  o = o || {};
  const combos = cartesian(axes);
  const comps = [];
  for (const props of combos) { const c = await make(props); c.name = Object.entries(props).map(([k, v]) => `${k}=${v}`).join(', '); comps.push(c); }
  const set = figma.combineAsVariants(comps, TMP);
  set.name = name;
  const keys = Object.keys(axes);
  const colKey = o.colKey || keys[keys.length - 1];
  const rowKeys = keys.filter(k => k !== colKey);
  const rowIds = [...new Set(combos.map(p => rowKeys.map(k => p[k]).join('|')))];
  const colW = Math.max(...comps.map(c => c.width)) + (o.gx || 24), cols = axes[colKey];
  const rowH = {}; for (const c of comps) { const p = pv(c.name), r = rowKeys.map(k => p[k]).join('|'); rowH[r] = Math.max(rowH[r] || 0, c.height); }
  let y = 24; const rowY = {}; for (const r of rowIds) { rowY[r] = y; y += rowH[r] + (o.gy || 24); }
  for (const c of comps) { const p = pv(c.name); c.x = 24 + cols.indexOf(p[colKey]) * colW; c.y = rowY[rowKeys.map(k => p[k]).join('|')]; }
  let mx = 0, my = 0; for (const c of set.children) { mx = Math.max(mx, c.x + c.width); my = Math.max(my, c.y + c.height); }
  set.resizeWithoutConstraints(mx + 24, my + 24);
  fill(set, 'surface/default'); stroke(set, 'border/default', 1, 'INSIDE', [6, 4]); rad(set, 'lg');
  if (o.description) set.description = o.description;
  return set;
}
// ---- lookups
function C(name) { const n = REG[name]; if (!n || n.removed) throw new Error('Component not found: ' + name + ' (run earlier DS scripts first)'); return n; }
function has(name) { return !!(REG[name] && !REG[name].removed); }
function variantOf(name, props) {
  const n = C(name);
  if (n.type === 'COMPONENT') return n;
  const want = props || {};
  const hit = n.children.find(ch => { const p = pv(ch.name); return Object.entries(want).every(([k, v]) => p[k] === v); });
  if (!hit) throw new Error(`No variant ${JSON.stringify(want)} in ${name}`);
  return hit;
}
function I(name, props, o) {
  const inst = variantOf(name, props).createInstance();
  TMP.appendChild(inst);
  o = o || {};
  if (o.text) for (const [k, v] of Object.entries(o.text)) setProp(inst, k, v);
  if (o.bool) for (const [k, v] of Object.entries(o.bool)) setProp(inst, k, v);
  if (o.name) inst.name = o.name;
  return inst;
}
function setProp(inst, propName, value) {
  const cp = inst.componentProperties;
  const key = Object.keys(cp).find(k => k === propName || k.split('#')[0] === propName);
  if (!key) { OUT.warnings.push(`setProp: ${propName} not on ${inst.name}`); return inst; }
  inst.setProperties({ [key]: value });
  return inst;
}
// content slot: native slot (createSlot) with Placeholder/Box default content; falls back to an INSTANCE_SWAP placeholder
function SLOT(comp, name, label) {
  let s = null, mode = 'slot';
  try { s = comp.createSlot(); } catch (e) { s = null; }
  const ph = I('Placeholder/Box', null, { text: { Label: label || name } }); ph.name = name + ' placeholder';
  if (s) { s.name = name; s.layoutMode = 'VERTICAL'; s.fills = []; s.itemSpacing = 12; s.appendChild(ph); try { const k = s.componentPropertyReferences && s.componentPropertyReferences.slotContentId; if (k) comp.editComponentProperty(k, { name }); } catch (e) { OUT.warnings.push('slot rename failed: ' + name); } }
  else { mode = 'instance-swap'; s = figma.createAutoLayout('VERTICAL'); s.name = name; s.fills = []; comp.appendChild(s); s.appendChild(ph); OUT.warnings.push(comp.name + ': createSlot unavailable, used INSTANCE_SWAP placeholder'); }
  s.layoutSizingHorizontal = 'FILL'; ph.layoutSizingHorizontal = 'FILL';
  if (mode !== 'slot') slotSwap(comp, name);
  OUT.slots = OUT.slots || {}; OUT.slots[comp.name + ' › ' + name] = mode;
  return { slot: s, ph, mode };
}
function slotSwap(owner, name) { // call after properties can be added (non-variant component or set)
  const key = owner.addComponentProperty(name, 'INSTANCE_SWAP', C('Placeholder/Box').id);
  const targets = owner.type === 'COMPONENT_SET' ? owner.children : [owner];
  for (const c of targets) walk(c, n => { if (n.type === 'INSTANCE' && n.name === name + ' placeholder' && !(n.parent && n.parent.type === 'SLOT')) n.componentPropertyReferences = { mainComponent: key }; });
  return key;
}
function expose(inst) { try { inst.isExposedInstance = true; } catch (e) { OUT.warnings.push('expose failed: ' + inst.name); } return inst; }
function tint(node, color) { const kids = node.type === 'VECTOR' ? [node] : node.findAllWithCriteria({ types: ['VECTOR'] }); for (const v of kids) { v.strokes = [P(color)]; } return node; }
function ICON(name, sz, color) {
  const n = 'Icon/' + name;
  const inst = C(n).createInstance(); TMP.appendChild(inst);
  inst.name = 'Icon';
  if (sz && sz !== 20) inst.resize(sz, sz);
  if (color) tint(inst, color);
  return inst;
}
// ---- documentation layout on this page
async function container(title, subtitle) {
  let f = page.children.find(c => c.name === title && c.type === 'FRAME');
  if (!f) {
    f = figma.createAutoLayout('VERTICAL'); f.name = title; page.appendChild(f);
    let maxY = 0; for (const c of page.children) if (c !== f && c !== TMP) maxY = Math.max(maxY, c.y + c.height);
    f.x = 0; f.y = maxY ? maxY + 200 : 0;
    fill(f, 'surface/page'); pad(f, 64); gap(f, 56); rad(f, 'xl');
    const h = add(AL('Header', 'VERTICAL', { gap: 8 }), await T(title, 'ds/Display', 'text/primary'), await T(subtitle, 'ds/Body', 'text/secondary', { w: 960 }));
    f.appendChild(h);
  }
  return f;
}
async function doc(CONT, name, note, fn) {
  let ex = REG[name];
  if (ex && !ex.removed && REBUILD) { ex.remove(); OUT.rebuilt.push(name); ex = null; }
  const gname = 'doc · ' + name;
  let g = CONT.children.find(c => c.name === gname);
  if (ex && !ex.removed) { OUT.existing[name] = ex.id; return ex; }
  if (g) g.remove();
  const node = await fn();
  g = AL(gname, 'VERTICAL', { gap: 12 });
  add(g, await T(name, 'ds/H2', 'text/primary'), note ? await T(note, 'ds/Body Small', 'text/secondary', { w: 960 }) : null, node);
  CONT.appendChild(g);
  REG[name] = node;
  const rec = { id: node.id, type: node.type };
  const owner = node.type === 'COMPONENT_SET' || (node.type === 'COMPONENT' && !(node.parent && node.parent.type === 'COMPONENT_SET')) ? node : null;
  if (owner) {
    const defs = owner.componentPropertyDefinitions; rec.props = {};
    for (const [k, d] of Object.entries(defs)) rec.props[k] = d.type === 'VARIANT' ? d.variantOptions : d.type;
    if (node.type === 'COMPONENT_SET') rec.variants = node.children.length;
  }
  OUT.created[name] = rec;
  return node;
}
// light/dark preview strip with instances (dark uses explicit Semantic mode)
async function preview(CONT, title, makers) {
  const gname = 'preview · ' + title;
  for (const old of CONT.children.filter(c => c.name === gname)) old.remove();
  const row = AL(gname, 'HORIZONTAL', { gap: 24 });
  for (const [label, mode] of [['Light', LIGHT], ['Dark', DARK]]) {
    const fr = AL(title + ' — ' + label, 'VERTICAL', { gap: 16, pad: 24, fill: 'surface/page', stroke: 'border/default', radius: 'xl' });
    fr.setExplicitVariableModeForCollection(semCol, mode);
    fr.appendChild(await T(label + ' mode', 'ds/Overline', 'text/muted'));
    for (const mk of makers) { const n = await mk(); if (n) fr.appendChild(n); }
    row.appendChild(fr);
  }
  CONT.appendChild(row);
  return row;
}
function finish(extra) { TMP.remove(); return Object.assign(OUT, extra || {}); }
// ---------- end of helper library ----------

// TITLE: Domain B — Attendance/Timer, Attendance/VerificationStatus, Attendance/Panel, Notice/Duplicate (visible / hidden match), Banner/Reservation (contact reservation states), Queue/BucketHeader, Queue/Row, Row/Phone, Row/Social — page 21 DS — Components (36:3)
const CONT = await container('DS 10 — Attendance, duplicates, reservations, queue', 'Domain components for My Day attendance, duplicate detection, contact reservation and the calling queue. Pending policies are labelled with Notice/Policy pending (DEC-003, DEC-004, DEC-009, DEC-026).');
function chip(dec) { const n = I('Notice/Policy pending', { Size: 'Chip', Tone: 'Policy pending' }, { text: { DEC: dec } }); n.name = 'Policy'; return n; }
// ---- Attendance
const TM = { 'Not checked in': ['00:00:00', 'Not checked in yet today', 'text/muted'], 'Checked in': ['05:34:12', 'Since 08:42 · 9h workday', 'text/primary'], 'Closed': ['09:09:40', 'Checked out 17:51 · workday closed', 'text/secondary'] };
await doc(CONT, 'Attendance/Timer', 'Elapsed-time display (ds/Number XL; tabular figures in code). Override the "Elapsed" and "Caption" text layers on instances.', async () => {
  return VSET('Attendance/Timer', { State: Object.keys(TM) }, async p => {
    const [v, cap, col] = TM[p.State];
    const c = COMP('tm', 'VERTICAL', { gap: 2, align: 'CENTER' });
    c.resize(326, 80); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    add(c, await T('Elapsed today', 'ds/Caption', 'text/muted', { name: 'Label' }), await T(v, 'ds/Number XL', col, { name: 'Elapsed' }), await T(cap, 'ds/Body Small', 'text/secondary', { name: 'Caption' }));
    return c;
  });
});
const VS = { 'Verifying': ['spinner', 'info', 'Verifying office network…', 'Started 08:42'], 'Passed': ['check-circle', 'success', 'Office verified', '08:42 · Office network'], 'Failed': ['x-circle', 'danger', 'Verification failed', 'Not on the office network or location'], 'Remote exception': ['shield', 'warning', 'Remote exception', 'Approved by Rana Haddad for 21 Oct'] };
await doc(CONT, 'Attendance/VerificationStatus', 'Office verification result: icon + title + detail. The verification mode itself (IP / location / both) is pending DEC-009.', async () => {
  return VSET('Attendance/VerificationStatus', { State: Object.keys(VS) }, async p => {
    const [ic, t, title, meta] = VS[p.State];
    const c = COMP('vs', 'HORIZONTAL', { gap: 10, pad: [8, 12], align: 'CENTER', fill: `status/${t}/bg`, radius: 'md' });
    c.resize(326, 52); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
    const tx = AL('Text', 'VERTICAL', {});
    add(tx, await T(title, 'ds/Label', `status/${t}/fg`, { name: 'Title' }), await T(meta, 'ds/Caption', 'text/secondary', { name: 'Meta' }));
    add(c, ICON(ic, 20, `status/${t}/fg`), tx); grow(tx);
    return c;
  });
});
const AP = { 'Not checked in': ['Neutral', 'Not checked in', 'Not checked in', null, ['Primary', 'Default', 'Check in']], 'Verifying': ['Info', 'Checking in', 'Not checked in', 'Verifying', ['Primary', 'Loading', 'Checking in…']], 'Checked in': ['Success', 'Checked in', 'Checked in', 'Passed', ['Secondary', 'Default', 'Check out']], 'Verification failed': ['Danger', 'Not checked in', 'Not checked in', 'Failed', ['Primary', 'Default', 'Try again']], 'Checked out': ['Neutral', 'Checked out', 'Closed', 'Passed', null] };
await doc(CONT, 'Attendance/Panel', 'My Day attendance panel (358 mobile; resize for desktop): status, timer, 9-hour progress, verification state and the primary action. DEC-009 (verification mode) label is always shown; failed checkout handling is pending DEC-026 and the summary requirement DEC-012 — add those labels on the screens that show them.', async () => {
  return VSET('Attendance/Panel', { State: Object.keys(AP) }, async p => {
    const [tone, label, timer, ver, act] = AP[p.State];
    const c = COMP('ap', 'VERTICAL', { gap: 16, pad: 16, fill: 'surface/default', stroke: 'border/default', radius: 'xl' });
    c.resize(358, 300); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    const h = AL('Header', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
    const ti = await T('Attendance', 'ds/H3', 'text/primary', { name: 'Title' });
    const st = I('Badge/Status', { Tone: tone, Size: 'Small' }, { text: { Label: label } }); st.name = 'Status';
    add(h, ti, st); grow(ti);
    const tm = I('Attendance/Timer', { State: timer }); tm.name = 'Timer';
    const pb = I('Progress/Bar', { Tone: 'Brand' }, { text: { Label: 'Progress to 9h', Value: p.State === 'Checked in' ? '5h 34m of 9h' : p.State === 'Checked out' ? '9h 09m of 9h' : '0h of 9h' } }); pb.name = 'Progress';
    const fillR = pb.findAllWithCriteria({ types: ['RECTANGLE'] }).find(n => n.name === 'Fill');
    if (fillR) { const f = p.State === 'Checked in' ? 0.62 : p.State === 'Checked out' ? 1 : 0.01; fillR.resize(Math.max(1, 326 * f), 8); }
    add(c, h, tm, pb); fillW(h); fillW(tm); fillW(pb);
    if (ver) { const v = I('Attendance/VerificationStatus', { State: ver }); v.name = 'Verification'; c.appendChild(v); fillW(v); expose(v); }
    if (act) { const b = I('Button', { Variant: act[0], Size: 'Large', State: act[1] }, { text: { Label: act[2] } }); b.name = 'Action'; c.appendChild(b); fillW(b); expose(b); }
    if (p.State === 'Verification failed') { const l = I('Link', { Size: 'Small', State: 'Default' }, { text: { Label: 'Request remote exception' } }); l.name = 'Secondary action'; c.appendChild(l); }
    const pol = chip('DEC-009'); c.appendChild(pol);
    for (const n of [st, tm, pb, pol]) expose(n);
    return c;
  });
});
// ---- Duplicate warning
await doc(CONT, 'Notice/Duplicate', 'Duplicate check result on the business form. Visible match: shows the matching record and matched fields. Hidden match: existence only — the duplicate check covers records hidden from the user, but nothing about them is revealed; reveal/escalation is pending DEC-003.', async () => {
  return VSET('Notice/Duplicate', { Match: ['Visible match', 'Hidden match'] }, async p => {
    const vis = p.Match === 'Visible match';
    const c = COMP('dup', 'VERTICAL', { gap: 12, pad: 16, fill: 'status/warning/bg', stroke: 'status/warning/border', radius: 'md' });
    c.resize(520, 160); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    const h = AL('Head', 'HORIZONTAL', { gap: 8, align: 'MIN' });
    const ht = await T(vis ? 'Possible duplicate — this business may already exist' : 'A matching business already exists', 'ds/Label', 'status/warning/fg', { name: 'Title', w: 440 });
    add(h, ICON('alert-triangle', 20, 'status/warning/fg'), ht); grow(ht);
    c.appendChild(h); fillW(h);
    if (vis) {
      c.appendChild(await T('Matched on: phone +000 70 000 101 and business name.', 'ds/Body Small', 'text/primary', { name: 'Body', w: 488 }));
      const rec = AL('Existing record', 'HORIZONTAL', { gap: 12, pad: 12, align: 'CENTER', fill: 'surface/default', stroke: 'border/default', radius: 'md' });
      const col = AL('Record', 'VERTICAL', { gap: 2 });
      add(col, await T('Glow Beauty Salon', 'ds/Body Strong', 'text/primary'), await T('Downtown branch · Salon · Assigned to Maya Khoury', 'ds/Caption', 'text/muted'));
      const l = I('Link', { Size: 'Small', State: 'Default' }, { text: { Label: 'Open existing business' } }); l.name = 'Open existing';
      add(rec, col, l); grow(col); c.appendChild(rec); fillW(rec);
      const btns = AL('Actions', 'HORIZONTAL', { gap: 8 });
      add(btns, I('Button', { Variant: 'Secondary', Size: 'Medium', State: 'Default' }, { text: { Label: 'Back to form' } }));
      c.appendChild(btns);
    } else {
      c.appendChild(await T('It is not visible to you, so no details can be shown. You cannot save a duplicate of it.', 'ds/Body Small', 'text/primary', { name: 'Body', w: 488 }));
      const n = I('Notice/Policy pending', { Size: 'Inline', Tone: 'Policy pending' }, { text: { DEC: 'DEC-003', Body: 'Whether a hidden match can be revealed or escalated is undecided.' } }); n.name = 'Policy'; c.appendChild(n); fillW(n); expose(n);
      c.appendChild(I('Button', { Variant: 'Secondary', Size: 'Medium', State: 'Default' }, { text: { Label: 'Back to form' } }));
    }
    return c;
  });
});
// ---- Contact reservation
const RS = { 'Reserved by me': ['brand', 'lock', 'Reserved by you · 12:40 left', 'Other agents cannot contact this business until you finish or release it.', 'Reserved by you · 12:40'], 'Reserved by other': ['warning', 'lock', 'Reserved by Omar Nassar', 'Read-only until 14:52. You can view the business but not start a contact.', 'Reserved · Omar Nassar'], 'Expiring': ['warning', 'clock', 'Reservation ends in 2 min', 'Save the attempt now or your notes may be lost when it is released.', 'Ends in 2 min'], 'Expired': ['danger', 'x-circle', 'Reservation expired', 'Start the contact again to continue. Unsaved notes are kept on this device.', 'Expired'], 'Override': ['info', 'shield', 'Reservation released by Rana Haddad', 'Owner override. This contact was reassigned.', 'Overridden'], 'Offline': ['neutral', 'wifi', 'You are offline', 'Changes will not save until the connection is back.', 'Offline'] };
await doc(CONT, 'Banner/Reservation', 'Contact reservation indicator (Banner for the contact workspace; Chip for rows and headers). Reservation duration and override rules are pending DEC-004 — the banner carries the policy chip.', async () => {
  const set = await VSET('Banner/Reservation', { State: Object.keys(RS), Size: ['Banner', 'Chip'] }, async p => {
    const [t, ic, title, body, short] = RS[p.State];
    if (p.Size === 'Chip') {
      const c = COMP('rc', 'HORIZONTAL', { gap: 4, pad: [2, 8], align: 'CENTER', fill: `status/${t}/bg`, stroke: `status/${t}/border`, radius: 'full' });
      add(c, ICON(ic, 14, `status/${t}/fg`), await T(short, 'ds/Label Small', `status/${t}/fg`, { name: 'Label' }));
      return c;
    }
    const c = COMP('rb', 'HORIZONTAL', { gap: 12, pad: [12, 16], align: 'MIN', fill: `status/${t}/bg`, stroke: `status/${t}/border`, radius: 'md' });
    c.resize(720, 56); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
    const tx = AL('Text', 'VERTICAL', { gap: 2 });
    const a = await T(title, 'ds/Label', `status/${t}/fg`, { name: 'Title', w: 400 }), b = await T(body, 'ds/Body Small', 'text/primary', { name: 'Body', w: 400 });
    add(tx, a, b); fillW(a); fillW(b);
    const pol = chip('DEC-004');
    add(c, ICON(ic, 20, `status/${t}/fg`), tx, pol); grow(tx); expose(pol);
    return c;
  }, { colKey: 'Size' });
  link(set, 'Show policy', 'BOOLEAN', true, 'Policy', 'visible');
  return set;
});
// ---- Queue
await doc(CONT, 'Queue/BucketHeader', 'Calling-queue bucket header (buckets are derived, so a business can appear in two buckets).', async () => {
  const set = await VSET('Queue/BucketHeader', { Expanded: ['True', 'False'] }, async p => {
    const c = COMP('bh', 'HORIZONTAL', { gap: 8, pad: [8, 12], align: 'CENTER', fill: 'surface/sunken' });
    c.resize(360, 40); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
    const l = await T('Callbacks due today', 'ds/H4', 'text/primary', { name: 'Label', w: 200, truncate: 1 });
    const n = I('Badge/Count', { Tone: 'Neutral' }, { text: { Count: '2' } }); n.name = 'Count';
    add(c, ICON(p.Expanded === 'True' ? 'chevron-down' : 'chevron-right', 16, 'icon/default'), l, n); grow(l); expose(n);
    return c;
  });
  link(set, 'Label', 'TEXT', 'Bucket', 'Label', 'characters');
  return set;
});
await doc(CONT, 'Queue/Row', 'Calling-queue row (360): business name, category tag, outcome badge, meta line, optional flag badge. Selected = teal bar + surface/selected.', async () => {
  const set = await VSET('Queue/Row', { State: ['Default', 'Hover', 'Selected'] }, async p => {
    const sel = p.State === 'Selected';
    const c = COMP('qr', 'VERTICAL', { gap: 4, pad: [10, 12, 10, 16], fill: sel ? 'surface/selected' : p.State === 'Hover' ? 'surface/hover' : 'surface/default' });
    c.resize(360, 64); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    stroke(c, 'border/subtle'); c.strokeTopWeight = 0; c.strokeBottomWeight = 1; c.strokeLeftWeight = 0; c.strokeRightWeight = 0;
    if (sel) { const bar = RECT('Selected bar', 3, 64, 'brand/accent'); c.appendChild(bar); bar.layoutPositioning = 'ABSOLUTE'; bar.x = 0; bar.y = 0; bar.constraints = { horizontal: 'MIN', vertical: 'STRETCH' }; }
    const top = AL('Top', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
    const nm = await T('Olive & Thyme Café', 'ds/Body Strong', 'text/primary', { name: 'Name', w: 140, truncate: 1 });
    const tag = I('Tag', { Tone: 'Neutral' }, { text: { Label: 'Café' } }); tag.name = 'Category';
    const oc = I('Badge/Outcome', { Outcome: 'Needs another call' }); oc.name = 'Outcome';
    add(top, nm, tag, oc); grow(nm);
    const meta = await T('Callback 14:30 · Last attempt 14 Oct 12:30', 'ds/Caption', 'text/muted', { name: 'Meta', w: 320, truncate: 1 });
    const fl = I('Badge/Flag', { Tone: 'Warning' }, { text: { Label: 'Correction requested' } }); fl.name = 'Flag';
    add(c, top, meta, fl); fillW(top); fillW(meta);
    for (const n of [tag, oc, fl]) expose(n);
    return c;
  });
  link(set, 'Name', 'TEXT', 'Business name', 'Name', 'characters');
  link(set, 'Meta', 'TEXT', 'Meta line', 'Meta', 'characters');
  link(set, 'Show flag', 'BOOLEAN', false, 'Flag', 'visible');
  return set;
});
await doc(CONT, 'Row/Phone', 'Phone row: fictional number (+000 70 000 1xx), label tag, copy action. Master data is read-only for Call Center.', async () => {
  const c = COMP('Row/Phone', 'HORIZONTAL', { gap: 8, pad: [6, 0], align: 'CENTER' });
  c.resize(320, 40); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
  const n = await T('+000 70 000 101', 'ds/Number', 'text/primary', { name: 'Number' });
  const tag = I('Tag', { Tone: 'Neutral' }, { text: { Label: 'Primary' } }); tag.name = 'Label tag';
  const sp = AL('Spacer', 'HORIZONTAL', {});
  const cp = I('IconButton', { Variant: 'Ghost', Size: 'Small', State: 'Default' }); setProp(cp, 'Icon', C('Icon/copy').id); cp.name = 'Copy';
  add(c, ICON('phone', 16, 'icon/muted'), n, tag, sp, cp); grow(sp); expose(tag);
  link(c, 'Number', 'TEXT', '+000 70 000 101', 'Number', 'characters');
  link(c, 'Show copy', 'BOOLEAN', true, 'Copy', 'visible');
  return c;
});
await doc(CONT, 'Row/Social', 'Social account row: platform name (generic icon — no third-party logos), handle (always .demo), metrics or "Not recorded".', async () => {
  const set = await VSET('Row/Social', { Metrics: ['Recorded', 'Not recorded'] }, async p => {
    const c = COMP('soc', 'HORIZONTAL', { gap: 10, pad: [8, 0], align: 'CENTER' });
    c.resize(340, 48); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
    const col = AL('Account', 'VERTICAL', {});
    add(col, await T('Instagram', 'ds/Caption', 'text/muted', { name: 'Platform' }), await T('@glowbeauty.demo', 'ds/Body Strong', 'text/primary', { name: 'Handle' }));
    const m = await T(p.Metrics === 'Recorded' ? '12,400 followers' : 'Not recorded', 'ds/Body Small', p.Metrics === 'Recorded' ? 'text/secondary' : 'text/muted', { name: 'Metrics' });
    add(c, ICON('at-sign', 20, 'icon/default'), col, m); grow(col);
    return c;
  });
  link(set, 'Platform', 'TEXT', 'Instagram', 'Platform', 'characters');
  link(set, 'Handle', 'TEXT', '@glowbeauty.demo', 'Handle', 'characters');
  return set;
});
await preview(CONT, 'Domain', [
  async () => I('Attendance/Panel', { State: 'Checked in' }),
  async () => I('Banner/Reservation', { State: 'Reserved by other', Size: 'Chip' }),
  async () => I('Queue/Row', { State: 'Selected' }),
]);
return finish();
