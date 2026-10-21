// 09-domain-a.js — Design-System Agent — Phase 5 (Udigity Management System)
// Domain A — Calendar/Event, Calendar/Week, Calendar/Day, Card/Task, Kanban/Column (cards slot), Timeline/Item, Timeline/Milestone, Timeline/Horizontal, ListItem/Note — page 21 DS — Components (36:3)
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

// TITLE: Domain A — Calendar/Event, Calendar/Week, Calendar/Day, Card/Task, Kanban/Column (cards slot), Timeline/Item, Timeline/Milestone, Timeline/Horizontal, ListItem/Note — page 21 DS — Components (36:3)
const CONT = await container('DS 09 — Calendar, board and timelines', 'Calendar event items and week/day blocks, Kanban task cards and columns, activity and milestone timelines, notes. Event kinds differ by icon and label as well as colour.');
const EK = { 'Follow-up': ['brand', 'phone'], 'Meeting': ['info', 'users'], 'Task': ['neutral', 'check-circle'], 'Overdue': ['danger', 'alert-circle'], 'Done': ['neutral', 'check'] };
await doc(CONT, 'Calendar/Event', 'Event block for calendars (width = day column; resize height to duration, 60px per hour). Kind shown by icon + time line + colour. Overdue adds an alert icon; Done is muted with a check.', async () => {
  const set = await VSET('Calendar/Event', { Kind: Object.keys(EK) }, async p => {
    const [t, ic] = EK[p.Kind], done = p.Kind === 'Done';
    const c = COMP('ev', 'VERTICAL', { gap: 2, pad: [6, 8, 6, 10], fill: `status/${t}/bg`, radius: 'sm', clip: true });
    c.resize(152, 48); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    const bar = RECT('Accent', 3, 48, `status/${t}/solid`); c.appendChild(bar); bar.layoutPositioning = 'ABSOLUTE'; bar.x = 0; bar.y = 0; bar.constraints = { horizontal: 'MIN', vertical: 'STRETCH' };
    const tr = AL('Time row', 'HORIZONTAL', { gap: 4, align: 'CENTER' });
    add(tr, ICON(ic, 12, `status/${t}/fg`), await T('14:30–15:00', 'ds/Caption', done ? 'text/muted' : `status/${t}/fg`, { name: 'Time' }));
    const ti = await T(p.Kind === 'Meeting' ? 'Peak Fitness Gym — kickoff' : 'Call back Olive & Thyme Café', 'ds/Label Small', done ? 'text/muted' : 'text/primary', { name: 'Title', w: 130, truncate: 2 });
    add(c, tr, ti); fillW(ti);
    return c;
  });
  link(set, 'Time', 'TEXT', '14:30–15:00', 'Time', 'characters');
  link(set, 'Title', 'TEXT', 'Event title', 'Title', 'characters');
  return set;
});
const DAYS = ['Mon 19', 'Tue 20', 'Wed 21', 'Thu 22', 'Fri 23', 'Sat 24', 'Sun 25'];
const EVENTS = [[0, 9.5, 0.5, 'Done', '09:30–10:00', 'Urban Cuts Barbershop — call'], [0, 11, 0.5, 'Overdue', '11:00–11:30', 'Sunrise Bakery — callback'], [1, 10, 0.5, 'Follow-up', '10:00–10:30', 'Call back Olive & Thyme Café'], [2, 14, 1, 'Meeting', '14:00–15:00', 'Peak Fitness Gym — kickoff (Lina Aoun)'], [3, 14.5, 0.5, 'Follow-up', '14:30–15:00', 'Nova Dental Clinic — follow-up'], [4, 11, 1, 'Task', '11:00–12:00', 'Lumen Yoga Studio — prepare notes']];
await doc(CONT, 'Calendar/Week', 'Week view block (1148 wide, 09:00–17:00, 60px per hour, Monday first). Today (Tue 20 Oct 2026) is marked by a filled date chip + "Today" label. Events are Calendar/Event instances; move/resize them on instances.', async () => {
  const GUT = 56, COL = 156, HR = 60, TOP = 48;
  const c = COMP('Calendar/Week', null, { fill: 'surface/default', stroke: 'border/default', radius: 'xl', clip: true });
  c.resize(GUT + COL * 7, TOP + HR * 8);
  for (let d = 0; d < 7; d++) {
    const h = AL('Day ' + DAYS[d], 'HORIZONTAL', { gap: 6, align: 'CENTER', justify: 'CENTER', w: COL, h: TOP }); c.appendChild(h); h.x = GUT + d * COL; h.y = 0;
    const today = d === 1;
    const chip = AL('Date', 'HORIZONTAL', { pad: [2, 8], radius: 'full', fill: today ? 'brand/primary' : null });
    chip.appendChild(await T(DAYS[d], 'ds/Label Small', today ? 'text/on-primary' : 'text/secondary'));
    h.appendChild(chip); if (today) h.appendChild(await T('Today', 'ds/Caption', 'status/brand/fg'));
    const vl = RECT('V line', 1, HR * 8 + TOP, 'border/subtle'); c.appendChild(vl); vl.x = GUT + d * COL; vl.y = 0;
  }
  for (let i = 0; i <= 8; i++) {
    const hl = RECT('H line', COL * 7, 1, 'border/subtle'); c.appendChild(hl); hl.x = GUT; hl.y = TOP + i * HR;
    if (i < 8) { const lb = await T(String(9 + i).padStart(2, '0') + ':00', 'ds/Caption', 'text/muted'); c.appendChild(lb); lb.x = 8; lb.y = TOP + i * HR - 2; }
  }
  for (const [d, start, dur, kind, time, title] of EVENTS) {
    const e = I('Calendar/Event', { Kind: kind }, { text: { Time: time, Title: title } }); c.appendChild(e);
    e.resize(COL - 8, Math.max(HR * dur - 4, 44)); e.x = GUT + d * COL + 4; e.y = TOP + (start - 9) * HR + 2;
  }
  c.description = 'Week calendar block, 1148x528.';
  return c;
});
await doc(CONT, 'Calendar/Day', 'Day agenda (mobile and narrow panels, 358 wide). Hour rows with events at full width.', async () => {
  const c = COMP('Calendar/Day', 'VERTICAL', { gap: 0, fill: 'surface/default', stroke: 'border/default', radius: 'xl', clip: true });
  c.resize(358, 400); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
  const hdr = AL('Header', 'HORIZONTAL', { pad: [12, 16], gap: 8, align: 'CENTER' });
  add(hdr, await T('Tuesday 20 October', 'ds/H4', 'text/primary', { name: 'Date' }), I('Badge/Status', { Tone: 'Brand', Size: 'Small' }, { text: { Label: 'Today' } }));
  c.appendChild(hdr); fillW(hdr);
  const rows = [['09:00', null], ['10:00', ['Follow-up', '10:00–10:30', 'Call back Olive & Thyme Café']], ['11:00', null], ['12:00', null], ['14:00', ['Meeting', '14:00–15:00', 'Peak Fitness Gym — kickoff']], ['15:00', null]];
  for (const [h, ev] of rows) {
    const r = AL('Hour ' + h, 'HORIZONTAL', { gap: 12, pad: [8, 16], align: 'MIN' });
    stroke(r, 'border/subtle'); r.strokeTopWeight = 1; r.strokeBottomWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0;
    r.appendChild(await T(h, 'ds/Caption', 'text/muted', { w: 40 }));
    if (ev) { const e = I('Calendar/Event', { Kind: ev[0] }, { text: { Time: ev[1], Title: ev[2] } }); r.appendChild(e); grow(e); }
    else { const sp = AL('Empty', 'HORIZONTAL', { h: 24 }); r.appendChild(sp); }
    c.appendChild(r); fillW(r);
  }
  link(c, 'Date', 'TEXT', 'Tuesday 20 October', 'Date', 'characters');
  return c;
});
await doc(CONT, 'Card/Task', 'Kanban task card (272). Default / Done (muted, check + "Done" label). Optional derived chip (e.g. "Waiting for client") and policy chip (e.g. DEC-018). Nested chip, notice and avatar are exposed.', async () => {
  const set = await VSET('Card/Task', { State: ['Default', 'Done'] }, async p => {
    const done = p.State === 'Done';
    const c = COMP('task', 'VERTICAL', { gap: 8, pad: 12, fill: 'surface/default', stroke: 'border/default', radius: 'lg' });
    c.resize(272, 120); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    const tr = AL('Title row', 'HORIZONTAL', { gap: 6, align: 'MIN' });
    if (done) tr.appendChild(ICON('check-circle', 16, 'status/success/fg'));
    const ti = await T(done ? 'Wireframes approved' : 'Booking flow', 'ds/Label', done ? 'text/muted' : 'text/primary', { name: 'Title', w: 220 });
    tr.appendChild(ti); grow(ti);
    const pj = await T('Glow Beauty Salon — Booking website', 'ds/Caption', 'text/muted', { name: 'Project', w: 248, truncate: 1 });
    const ex = AL('Extras', 'HORIZONTAL', { gap: 6, align: 'CENTER' }); ex.layoutWrap = 'WRAP'; ex.counterAxisSpacing = 6;
    const ch = I('Chip/Derived', { Tone: 'Amber' }, { text: { Label: 'Waiting for client' } }); ch.name = 'Derived chip';
    const nt = I('Notice/Policy pending', { Size: 'Chip', Tone: 'Policy pending' }, { text: { DEC: 'DEC-018' } }); nt.name = 'Policy';
    add(ex, ch, nt);
    const ft = AL('Footer', 'HORIZONTAL', { gap: 6, align: 'CENTER' });
    const av = I('Avatar', { Size: 'Small', Tone: 'Neutral' }, { text: { Initials: 'LA' } }); av.name = 'Avatar';
    const due = await T(done ? 'Done 12 Oct' : 'Due 28 Oct', 'ds/Caption', 'text/secondary', { name: 'Due' });
    add(ft, av, due);
    if (done) ft.appendChild(I('Badge/Status', { Tone: 'Success', Size: 'Small' }, { text: { Label: 'Done' } }));
    add(c, tr, pj, ex, ft); fillW(tr); fillW(pj); fillW(ex);
    for (const n of [ch, nt, av]) expose(n);
    return c;
  });
  link(set, 'Title', 'TEXT', 'Task title', 'Title', 'characters');
  link(set, 'Project', 'TEXT', 'Glow Beauty Salon — Booking website', 'Project', 'characters');
  link(set, 'Due', 'TEXT', 'Due 28 Oct', 'Due', 'characters');
  link(set, 'Show chip', 'BOOLEAN', false, 'Derived chip', 'visible');
  link(set, 'Show notice', 'BOOLEAN', false, 'Policy', 'visible');
  return set;
});
await doc(CONT, 'Kanban/Column', 'Board column (288): header with title + count + add, and a "Cards" slot that grows with content (not fixed to 3 cards). Column statuses are pending DEC-019 on the developer board — label them.', async () => {
  const c = COMP('Kanban/Column', 'VERTICAL', { gap: 8, pad: 8, fill: 'surface/sunken', radius: 'xl' });
  c.resize(288, 400); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
  const h = AL('Header', 'HORIZONTAL', { gap: 8, pad: [4, 4, 4, 8], align: 'CENTER' });
  const cnt = I('Badge/Count', { Tone: 'Neutral' }, { text: { Count: '2' } }); cnt.name = 'Count';
  const sp = AL('Spacer', 'HORIZONTAL', {});
  const plus = I('IconButton', { Variant: 'Ghost', Size: 'Small', State: 'Default' }); setProp(plus, 'Icon', C('Icon/plus').id); plus.name = 'Add';
  add(h, await T('In progress', 'ds/H4', 'text/primary', { name: 'Title' }), cnt, sp, plus); grow(sp); expose(cnt);
  c.appendChild(h); fillW(h);
  const s = SLOT(c, 'Cards', 'Task cards');
  if (s.mode === 'slot') { s.ph.remove(); s.slot.itemSpacing = 8; for (const [st, t] of [['Default', 'Booking flow'], ['Default', 'Content upload']]) { const k = I('Card/Task', { State: st }, { text: { Title: t } }); s.slot.appendChild(k); k.layoutSizingHorizontal = 'FILL'; } }
  link(c, 'Title', 'TEXT', 'Column', 'Title', 'characters');
  link(c, 'Show add', 'BOOLEAN', true, 'Add', 'visible');
  return c;
});
const TL = { 'Call attempt': ['phone', 'neutral'], 'Follow-up': ['calendar', 'brand'], 'Status change': ['refresh', 'info'], 'Note': ['note', 'neutral'], 'Upcoming': ['clock', 'brand'] };
await doc(CONT, 'Timeline/Item', 'Vertical activity item (Timeline/Vertical = stack these). Call attempt shows its outcome badge; Upcoming uses a dashed marker. Hide the connector on the last item.', async () => {
  const set = await VSET('Timeline/Item', { Type: Object.keys(TL) }, async p => {
    const [ic, t] = TL[p.Type], up = p.Type === 'Upcoming';
    const c = COMP('tl', 'HORIZONTAL', { gap: 12, align: 'MIN' });
    c.resize(420, 72); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
    const mk = AL('Marker', 'VERTICAL', { gap: 4, align: 'CENTER' });
    const circ = AL('Dot', 'HORIZONTAL', { justify: 'CENTER', align: 'CENTER', radius: 'full', fill: up ? 'surface/default' : `status/${t}/bg`, stroke: up ? `status/${t}/solid` : null, dash: up ? [3, 2] : null, w: 28, h: 28 });
    circ.appendChild(ICON(ic, 16, `status/${t}/fg`));
    const ln = RECT('Connector', 2, 24, 'border/default');
    add(mk, circ, ln); grow(ln);
    const body = AL('Content', 'VERTICAL', { gap: 4, pad: [4, 0, 16, 0] });
    const head = AL('Head', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
    const ti = await T(p.Type === 'Call attempt' ? 'Call attempt by Maya Khoury' : p.Type === 'Upcoming' ? 'Follow-up due' : p.Type, 'ds/Label', 'text/primary', { name: 'Title', w: 200, truncate: 1 });
    add(head, ti, await T('14 Oct, 12:30', 'ds/Caption', 'text/muted', { name: 'Time' })); grow(ti);
    const bd = await T('Owner busy; asked to call back after 17:00.', 'ds/Body Small', 'text/secondary', { name: 'Body', w: 300 });
    add(body, head, bd); fillW(head); fillW(bd);
    if (p.Type === 'Call attempt') { const o = I('Badge/Outcome', { Outcome: 'Needs another call' }); o.name = 'Outcome'; body.appendChild(o); expose(o); }
    add(c, mk, body); fillH(mk); grow(body);
    return c;
  });
  link(set, 'Title', 'TEXT', 'Activity title', 'Title', 'characters');
  link(set, 'Time', 'TEXT', '14 Oct, 12:30', 'Time', 'characters');
  link(set, 'Body', 'TEXT', 'Activity details.', 'Body', 'characters');
  link(set, 'Show connector', 'BOOLEAN', true, 'Connector', 'visible');
  return set;
});
await doc(CONT, 'Timeline/Milestone', 'Milestone marker for the horizontal project timeline. Achieved (filled + check), Current (ring), Upcoming (outline), Final (flag). Shape differs per state.', async () => {
  const set = await VSET('Timeline/Milestone', { State: ['Achieved', 'Current', 'Upcoming', 'Final'] }, async p => {
    const c = COMP('ms', 'VERTICAL', { gap: 6, align: 'CENTER' });
    c.resize(132, 64); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    const M = { Achieved: ['brand/accent', null, 'check', 'icon/on-primary'], Current: ['surface/default', 'brand/primary', null, null], Upcoming: ['surface/default', 'border/strong', null, null], Final: ['surface/default', 'brand/primary', 'flag', 'icon/strong'] }[p.State];
    const mk = AL('Marker', 'HORIZONTAL', { justify: 'CENTER', align: 'CENTER', radius: 'full', fill: M[0], stroke: M[1], sw: p.State === 'Current' ? 3 : 2, w: 20, h: 20 });
    if (M[2]) mk.appendChild(ICON(M[2], 12, M[3]));
    add(c, mk, await T('Wireframes approved', 'ds/Label Small', p.State === 'Upcoming' ? 'text/secondary' : 'text/primary', { name: 'Label', w: 132, align: 'CENTER' }), await T('12 Oct', 'ds/Caption', 'text/muted', { name: 'Date', w: 132, align: 'CENTER' }));
    return c;
  });
  link(set, 'Label', 'TEXT', 'Milestone', 'Label', 'characters');
  link(set, 'Date', 'TEXT', '12 Oct', 'Date', 'characters');
  return set;
});
await doc(CONT, 'Timeline/Horizontal', 'Project milestone track (1152) with progress fill and a Today marker (20 Oct 2026). Sample: Glow Beauty Salon — Booking website.', async () => {
  const W = 1152, c = COMP('Timeline/Horizontal', null, {}); c.resize(W, 104);
  const track = RECT('Track', W - 132, 4, 'surface/sunken', { radius: 'full' }); c.appendChild(track); track.x = 66; track.y = 8;
  const MS = [['Achieved', 'Kickoff', '5 Oct'], ['Achieved', 'Wireframes approved', '12 Oct'], ['Current', 'Booking flow', '26 Oct'], ['Upcoming', 'Payment page', '2 Nov'], ['Final', 'Launch', '16 Nov']];
  const step = (W - 132) / (MS.length - 1);
  const prog = RECT('Progress', step * 1.6, 4, 'brand/accent', { radius: 'full' }); c.appendChild(prog); prog.x = 66; prog.y = 8;
  MS.forEach(([st, l, d], i) => { const m = I('Timeline/Milestone', { State: st }, { text: { Label: l, Date: d } }); c.appendChild(m); m.x = i * step; m.y = 0; });
  const tx = 66 + step * 1.6;
  const tline = RECT('Today line', 2, 28, 'status/warning/solid'); c.appendChild(tline); tline.x = tx - 1; tline.y = 0;
  const tl = AL('Today', 'HORIZONTAL', { pad: [2, 6], radius: 'sm', fill: 'status/warning/bg' }); tl.appendChild(await T('Today · 20 Oct', 'ds/Caption', 'status/warning/fg')); c.appendChild(tl); tl.x = tx + 6; tl.y = 30;
  return c;
});
await doc(CONT, 'ListItem/Note', 'Note in a feed or card (Neutral; Amber for notes needing attention, e.g. "Waiting for client").', async () => {
  const set = await VSET('ListItem/Note', { Accent: ['Neutral', 'Amber'] }, async p => {
    const am = p.Accent === 'Amber';
    const c = COMP('note', 'VERTICAL', { gap: 4, pad: [10, 12, 10, 16], fill: am ? 'status/warning/bg' : 'surface/subtle', radius: 'md', clip: true });
    c.resize(360, 64); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    const bar = RECT('Accent', 3, 64, am ? 'status/warning/solid' : 'border/strong'); c.appendChild(bar); bar.layoutPositioning = 'ABSOLUTE'; bar.x = 0; bar.y = 0; bar.constraints = { horizontal: 'MIN', vertical: 'STRETCH' };
    const h = AL('Head', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
    add(h, await T('Sami Fares', 'ds/Label Small', 'text/primary', { name: 'Author' }), await T('15 Oct, 10:05', 'ds/Caption', 'text/muted', { name: 'Time' }));
    const b = await T(am ? 'Waiting for the client to send menu photos and opening hours.' : 'Shared the booking flow draft with Rana Haddad.', 'ds/Body Small', am ? 'status/warning/fg' : 'text/secondary', { name: 'Body', w: 328 });
    add(c, h, b); fillW(b);
    return c;
  });
  link(set, 'Author', 'TEXT', 'Author', 'Author', 'characters');
  link(set, 'Time', 'TEXT', '15 Oct, 10:05', 'Time', 'characters');
  link(set, 'Body', 'TEXT', 'Note text.', 'Body', 'characters');
  return set;
});
await preview(CONT, 'Calendar and board', [
  async () => add(AL('events', 'HORIZONTAL', { gap: 8 }), I('Calendar/Event', { Kind: 'Follow-up' }), I('Calendar/Event', { Kind: 'Meeting' }), I('Calendar/Event', { Kind: 'Overdue' })),
  async () => I('Card/Task', { State: 'Default' }, { bool: { 'Show chip': true, 'Show notice': true } }),
  async () => I('Timeline/Item', { Type: 'Call attempt' }),
]);
return finish();
