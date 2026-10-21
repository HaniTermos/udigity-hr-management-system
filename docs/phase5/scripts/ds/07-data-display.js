// 07-data-display.js — Design-System Agent — Phase 5 (Udigity Management System)
// Data display — Table (header cell, cell, header row, row, pagination), Card/Surface, Card/Section, Card/Inset (content slots), Card/Metric, List/Item, List/KeyValue, Progress/Bar, Menu/Item, Menu — page 21 DS — Components (36:3)
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

// TITLE: Data display — Table (header cell, cell, header row, row, pagination), Card/Surface, Card/Section, Card/Inset (content slots), Card/Metric, List/Item, List/KeyValue, Progress/Bar, Menu/Item, Menu — page 21 DS — Components (36:3)
const CONT = await container('DS 07 — Data display', 'Tables, cards with content slots, metric cards, lists, key-value rows, progress bars and menus. Numbers right-aligned with tabular figures in code.');
// ---- Table
await doc(CONT, 'Table/HeaderCell', 'Column header (resize width per column). Sort state shown by arrow + aria-sort in code.', async () => {
  const set = await VSET('Table/HeaderCell', { Align: ['Left', 'Right'], Sort: ['None', 'Ascending', 'Descending'] }, async p => {
    const c = COMP('th', 'HORIZONTAL', { gap: 4, pad: [0, 12], align: 'CENTER', justify: p.Align === 'Right' ? 'MAX' : 'MIN', fill: 'surface/sunken' });
    c.resize(200, 40); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    c.appendChild(await T('Column', 'ds/Overline', 'text/muted', { name: 'Label' }));
    if (p.Sort !== 'None') { const i = ICON(p.Sort === 'Ascending' ? 'arrow-up' : 'arrow-down', 14, 'icon/default'); i.name = 'Sort'; c.appendChild(i); }
    return c;
  }, { colKey: 'Sort' });
  link(set, 'Label', 'TEXT', 'Column', 'Label', 'characters');
  return set;
});
const CELL_TYPES = ['Text', 'Text with meta', 'Number', 'Status', 'Link', 'Avatar', 'Checkbox', 'Actions'];
await doc(CONT, 'Table/Cell', 'Body cell types. Resize width per column; Number is right-aligned. Status uses Badge/Status (text label). Nested instances are exposed.', async () => {
  const set = await VSET('Table/Cell', { Type: CELL_TYPES }, async p => {
    const c = COMP('td', 'HORIZONTAL', { gap: 8, pad: [0, 12], align: 'CENTER', justify: p.Type === 'Number' ? 'MAX' : 'MIN' });
    c.resize(p.Type === 'Checkbox' ? 48 : p.Type === 'Actions' ? 56 : 200, 56); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    if (p.Type === 'Text') { const t = await T('Salon', 'ds/Body', 'text/primary', { name: 'Text', w: 120, truncate: 1 }); c.appendChild(t); grow(t); }
    if (p.Type === 'Text with meta') { const col = AL('Stack', 'VERTICAL', {}); const a = await T('Glow Beauty Salon', 'ds/Body Strong', 'text/primary', { name: 'Text', w: 176, truncate: 1 }); const b = await T('Downtown branch · Salon', 'ds/Caption', 'text/muted', { name: 'Meta', w: 176, truncate: 1 }); add(col, a, b); c.appendChild(col); grow(col); fillW(a); fillW(b); }
    if (p.Type === 'Number') c.appendChild(await T('1,248', 'ds/Number', 'text/primary', { name: 'Text' }));
    if (p.Type === 'Status') { const b = I('Badge/Status', { Tone: 'Success', Size: 'Small' }, { text: { Label: 'Active' } }); b.name = 'Status'; c.appendChild(b); expose(b); }
    if (p.Type === 'Link') { const l = I('Link', { Size: 'Medium', State: 'Default' }, { text: { Label: 'Open' } }); l.name = 'Link'; c.appendChild(l); expose(l); }
    if (p.Type === 'Avatar') { const a = I('Avatar', { Size: 'Small', Tone: 'Neutral' }, { text: { Initials: 'MK' } }); a.name = 'Avatar'; const t = await T('Maya Khoury', 'ds/Body', 'text/primary', { name: 'Text', w: 120, truncate: 1 }); add(c, a, t); grow(t); expose(a); }
    if (p.Type === 'Checkbox') { const b = I('Checkbox', { Checked: 'False', State: 'Default' }, { bool: { 'Show label': false } }); b.name = 'Checkbox'; c.appendChild(b); expose(b); }
    if (p.Type === 'Actions') { const b = I('IconButton', { Variant: 'Ghost', Size: 'Small', State: 'Default' }); b.name = 'Actions'; c.appendChild(b); expose(b); }
    return c;
  });
  link(set, 'Text', 'TEXT', 'Cell text', 'Text', 'characters');
  link(set, 'Meta', 'TEXT', 'Meta line', 'Meta', 'characters');
  return set;
});
const COLS = [['', 'Checkbox', 48], ['Business', 'Text with meta', 320], ['Phone', 'Text', 200], ['Status', 'Status', 140], ['Assigned to', 'Avatar', 248], ['Updated', 'Number', 140], ['', 'Actions', 56]];
await doc(CONT, 'Table/HeaderRow', 'Header row matching Table/Row columns (1152). Override labels/widths; hide columns you do not need.', async () => {
  const c = COMP('Table/HeaderRow', 'HORIZONTAL', { fill: 'surface/sunken' });
  stroke(c, 'border/default'); c.strokeTopWeight = 0; c.strokeBottomWeight = 1; c.strokeLeftWeight = 0; c.strokeRightWeight = 0;
  for (const [label, type, w] of COLS) { const h = I('Table/HeaderCell', { Align: type === 'Number' ? 'Right' : 'Left', Sort: label === 'Updated' ? 'Descending' : 'None' }, { text: { Label: label || ' ' } }); h.resize(w, 40); h.name = 'H · ' + (label || type); c.appendChild(h); expose(h); }
  return c;
});
await doc(CONT, 'Table/Row', 'Example business row (1152). States Default/Hover/Selected (selected also checks the checkbox). Phones are fictional (+000 70 000 1xx).', async () => {
  return VSET('Table/Row', { State: ['Default', 'Hover', 'Selected'] }, async p => {
    const c = COMP('tr', 'HORIZONTAL', { fill: p.State === 'Selected' ? 'surface/selected' : p.State === 'Hover' ? 'surface/hover' : 'surface/default' });
    stroke(c, 'border/subtle'); c.strokeTopWeight = 0; c.strokeBottomWeight = 1; c.strokeLeftWeight = 0; c.strokeRightWeight = 0;
    const VALS = { Business: ['Glow Beauty Salon', 'Downtown branch · Salon'], Phone: ['+000 70 000 101'], 'Assigned to': ['Maya Khoury'], Updated: ['14 Oct'] };
    for (const [label, type, w] of COLS) {
      const cell = I('Table/Cell', { Type: type }); cell.resize(w, 56); cell.name = 'C · ' + (label || type);
      if (VALS[label]) { setProp(cell, 'Text', VALS[label][0]); if (VALS[label][1]) setProp(cell, 'Meta', VALS[label][1]); }
      if (type === 'Checkbox' && p.State === 'Selected') { const cb = cell.findAllWithCriteria({ types: ['INSTANCE'] }).find(n => n.name === 'Checkbox'); if (cb) setProp(cb, 'Checked', 'True'); }
      c.appendChild(cell); expose(cell);
    }
    return c;
  });
});
await doc(CONT, 'Table/Pagination', 'Footer: range text, page controls, rows per page.', async () => {
  const c = COMP('Table/Pagination', 'HORIZONTAL', { gap: 12, pad: [8, 12], align: 'CENTER', fill: 'surface/default' });
  c.resize(1152, 52); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
  const sp = AL('Spacer', 'HORIZONTAL', {});
  const prev = I('IconButton', { Variant: 'Secondary', Size: 'Small', State: 'Default' }); setProp(prev, 'Icon', C('Icon/chevron-left').id); prev.name = 'Previous';
  const next = I('IconButton', { Variant: 'Secondary', Size: 'Small', State: 'Default' }); setProp(next, 'Icon', C('Icon/chevron-right').id); next.name = 'Next';
  const pages = AL('Pages', 'HORIZONTAL', { gap: 4, align: 'CENTER' });
  for (const [n, on] of [['1', 1], ['2', 0], ['3', 0], ['…', 0], ['25', 0]]) { const b = AL('Page ' + n, 'HORIZONTAL', { justify: 'CENTER', align: 'CENTER', radius: 'md', fill: on ? 'brand/primary' : null, w: 32, h: 32 }); b.appendChild(await T(n, 'ds/Label Small', on ? 'text/on-primary' : 'text/primary')); pages.appendChild(b); }
  add(c, await T('Showing 1–10 of 248', 'ds/Body Small', 'text/secondary', { name: 'Range' }), sp, prev, pages, next, await T('10 per page', 'ds/Body Small', 'text/secondary', { name: 'Per page' }));
  grow(sp);
  link(c, 'Range', 'TEXT', 'Showing 1–10 of 248', 'Range', 'characters');
  return c;
});
// ---- Cards with slots
async function cardBase(name, o) {
  const c = COMP(name, 'VERTICAL', Object.assign({ gap: 16, pad: 20, fill: 'surface/default', stroke: 'border/default', radius: 'xl' }, o || {}));
  c.resize(360, 160); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
  return c;
}
await doc(CONT, 'Card/Surface', 'Plain card (white, radius 12, 1px border/default, padding 20) with a "Content" slot. Resize width; height hugs. No shadow at rest.', async () => {
  const c = await cardBase('Card/Surface'); SLOT(c, 'Content', 'Card content');
  c.description = 'Container card with content slot.'; return c;
});
await doc(CONT, 'Card/Section', 'Card with header (title, subtitle, action) and a "Content" slot.', async () => {
  const c = await cardBase('Card/Section');
  const head = AL('Header', 'HORIZONTAL', { gap: 12, align: 'MIN' });
  const tx = AL('Titles', 'VERTICAL', { gap: 2 });
  add(tx, await T('Contact', 'ds/H3', 'text/primary', { name: 'Title' }), await T('Primary phone and social accounts', 'ds/Body Small', 'text/secondary', { name: 'Subtitle' }));
  const act = I('Link', { Size: 'Small', State: 'Default' }, { text: { Label: 'Edit' } }); act.name = 'Action';
  add(head, tx, act); grow(tx); expose(act);
  c.appendChild(head); fillW(head);
  SLOT(c, 'Content', 'Section content');
  link(c, 'Title', 'TEXT', 'Section title', 'Title', 'characters');
  link(c, 'Subtitle', 'TEXT', 'Subtitle', 'Subtitle', 'characters');
  link(c, 'Show subtitle', 'BOOLEAN', true, 'Subtitle', 'visible');
  link(c, 'Show action', 'BOOLEAN', true, 'Action', 'visible');
  return c;
});
await doc(CONT, 'Card/Inset', 'Nested card on surface/subtle (radius 8, padding 16) for grouped content inside a card.', async () => {
  const c = await cardBase('Card/Inset', { gap: 12, pad: 16, fill: 'surface/subtle', stroke: 'border/subtle', radius: 'lg' });
  c.resize(320, 120); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
  SLOT(c, 'Content', 'Inset content'); return c;
});
// ---- Metric card
await doc(CONT, 'Card/Metric', 'KPI card (270 = 3 grid columns). Trend Up/Down/Flat show icon + text (never colour only). Pending shows "—" and a policy chip (e.g. DEC-020 target metrics). Loading shows skeleton bars.', async () => {
  const TR = { Up: ['trend-up', 'status/success/fg', '+12% vs last week'], Down: ['trend-down', 'status/danger/fg', '−8% vs last week'], Flat: ['minus', 'status/neutral/fg', 'No change'], Pending: [null, null, ''], Loading: [null, null, ''] };
  const set = await VSET('Card/Metric', { Trend: Object.keys(TR) }, async p => {
    const c = COMP('m', 'VERTICAL', { gap: 8, pad: 20, fill: 'surface/default', stroke: 'border/default', radius: 'xl' });
    c.resize(270, 132); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    c.appendChild(await T('Calls completed today', 'ds/Body Small', 'text/secondary', { name: 'Label' }));
    if (p.Trend === 'Loading') { add(c, RECT('Skeleton value', 96, 28, 'surface/skeleton', { radius: 'sm' }), RECT('Skeleton delta', 140, 12, 'surface/skeleton', { radius: 'sm' })); return c; }
    c.appendChild(await T(p.Trend === 'Pending' ? '—' : '128', 'ds/Number Large', 'text/primary', { name: 'Value' }));
    if (p.Trend === 'Pending') { const n = I('Notice/Policy pending', { Size: 'Chip', Tone: 'Policy pending' }, { text: { DEC: 'DEC-020' } }); n.name = 'Policy'; c.appendChild(n); expose(n); }
    else { const [ic, col, tx] = TR[p.Trend]; const r = AL('Delta row', 'HORIZONTAL', { gap: 4, align: 'CENTER' }); add(r, ICON(ic, 16, col), await T(tx, 'ds/Label Small', col, { name: 'Delta' })); c.appendChild(r); }
    c.appendChild(await T('Target: 150 per day', 'ds/Caption', 'text/muted', { name: 'Caption' }));
    return c;
  });
  link(set, 'Label', 'TEXT', 'Metric label', 'Label', 'characters');
  link(set, 'Value', 'TEXT', '128', 'Value', 'characters');
  link(set, 'Delta', 'TEXT', '+12% vs last week', 'Delta', 'characters');
  link(set, 'Caption', 'TEXT', 'Caption', 'Caption', 'characters');
  link(set, 'Show caption', 'BOOLEAN', true, 'Caption', 'visible');
  return set;
});
// ---- Lists
await doc(CONT, 'List/Item', 'List row (mobile lists, notifications, work lists): leading icon, title, meta, trailing badge and chevron.', async () => {
  const set = await VSET('List/Item', { State: ['Default', 'Hover'] }, async p => {
    const c = COMP('li', 'HORIZONTAL', { gap: 12, pad: [12, 16], align: 'CENTER', fill: p.State === 'Hover' ? 'surface/hover' : 'surface/default' });
    c.resize(358, 64); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
    stroke(c, 'border/subtle'); c.strokeTopWeight = 0; c.strokeBottomWeight = 1; c.strokeLeftWeight = 0; c.strokeRightWeight = 0;
    const lead = AL('Leading', 'HORIZONTAL', { justify: 'CENTER', align: 'CENTER', radius: 'full', fill: 'brand/accent-subtle', w: 36, h: 36 });
    const ic = ICON('phone', 20, 'icon/accent'); ic.name = 'Icon'; lead.appendChild(ic);
    const tx = AL('Text', 'VERTICAL', { gap: 2 });
    const a = await T('Call back Olive & Thyme Café', 'ds/Body Strong', 'text/primary', { name: 'Title', w: 200, truncate: 1 });
    const b = await T('Today · 14:30 · Follow-up', 'ds/Caption', 'text/muted', { name: 'Meta', w: 200, truncate: 1 });
    add(tx, a, b);
    const badge = I('Badge/Status', { Tone: 'Warning', Size: 'Small' }, { text: { Label: 'Due' } }); badge.name = 'Badge';
    const ch = ICON('chevron-right', 16, 'icon/muted'); ch.name = 'Chevron';
    add(c, lead, tx, badge, ch); grow(tx); fillW(a); fillW(b); expose(badge);
    return c;
  });
  link(set, 'Title', 'TEXT', 'List item title', 'Title', 'characters');
  link(set, 'Meta', 'TEXT', 'Meta line', 'Meta', 'characters');
  link(set, 'Icon', 'INSTANCE_SWAP', C('Icon/phone').id, 'Icon', 'mainComponent');
  link(set, 'Show leading', 'BOOLEAN', true, 'Leading', 'visible');
  link(set, 'Show badge', 'BOOLEAN', true, 'Badge', 'visible');
  link(set, 'Show chevron', 'BOOLEAN', true, 'Chevron', 'visible');
  return set;
});
await doc(CONT, 'List/KeyValue', 'Description-list row (DescriptionList requests map here). Check = confirmed fact (icon + text); Not recorded = value missing (shown as text, never blank).', async () => {
  const set = await VSET('List/KeyValue', { Type: ['Default', 'Check', 'Not recorded'] }, async p => {
    const c = COMP('kv', 'HORIZONTAL', { gap: 12, pad: [6, 0], align: 'MIN' });
    c.resize(320, 32); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
    c.appendChild(await T('Category', 'ds/Body Small', 'text/secondary', { name: 'Key', w: 112 }));
    const val = AL('Value row', 'HORIZONTAL', { gap: 6, align: 'CENTER' });
    if (p.Type === 'Check') val.appendChild(ICON('check-circle', 16, 'status/success/fg'));
    const v = await T(p.Type === 'Not recorded' ? 'Not recorded' : 'Salon', 'ds/Body', p.Type === 'Not recorded' ? 'text/muted' : 'text/primary', { name: 'Value', w: 160 });
    val.appendChild(v); c.appendChild(val); grow(val); grow(v);
    return c;
  });
  link(set, 'Key', 'TEXT', 'Key', 'Key', 'characters');
  link(set, 'Value', 'TEXT', 'Value', 'Value', 'characters');
  return set;
});
await doc(CONT, 'Progress/Bar', 'Progress with label left and value right. To change the value, resize the nested "Fill" rectangle width (track = 100%). Tone Warning for at-risk; text states the value, so colour is not the only cue.', async () => {
  const set = await VSET('Progress/Bar', { Tone: ['Brand', 'Success', 'Warning', 'Danger'] }, async p => {
    const col = { Brand: 'brand/accent', Success: 'status/success/solid', Warning: 'status/warning/solid', Danger: 'status/danger/solid' }[p.Tone];
    const c = COMP('pb', 'VERTICAL', { gap: 6 });
    c.resize(320, 40); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    const top = AL('Labels', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
    const l = await T('Workday progress', 'ds/Body Small', 'text/secondary', { name: 'Label', w: 160 });
    add(top, l, await T('5h 34m of 9h', 'ds/Label Small', 'text/primary', { name: 'Value' })); grow(l);
    const track = FR('Track', 320, 8, { fill: 'surface/sunken', radius: 'full', clip: true });
    const f = RECT('Fill', 198, 8, col, { radius: 'full' }); track.appendChild(f); f.x = 0; f.y = 0; f.constraints = { horizontal: 'SCALE', vertical: 'STRETCH' };
    add(c, top, track); fillW(top); fillW(track);
    return c;
  });
  link(set, 'Label', 'TEXT', 'Label', 'Label', 'characters');
  link(set, 'Value', 'TEXT', 'Value', 'Value', 'characters');
  link(set, 'Show labels', 'BOOLEAN', true, 'Labels', 'visible');
  return set;
});
// ---- Menu
await doc(CONT, 'Menu/Item', 'Dropdown/menu row. Selected shows a check (not colour only). Destructive uses danger text and icon.', async () => {
  const set = await VSET('Menu/Item', { Type: ['Default', 'Icon', 'Avatar', 'Destructive'], State: ['Default', 'Hover', 'Selected', 'Disabled'] }, async p => {
    const dis = p.State === 'Disabled', des = p.Type === 'Destructive';
    const fg = dis ? 'text/disabled' : des ? 'status/danger/fg' : 'text/primary';
    const c = COMP('mi', 'HORIZONTAL', { gap: 10, pad: [0, 12], align: 'CENTER', radius: 'sm', fill: p.State === 'Hover' ? 'surface/hover' : p.State === 'Selected' ? 'surface/selected' : null });
    c.resize(232, 36); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    if (p.Type === 'Icon' || des) { const i = ICON(des ? 'ban' : 'edit', 16, dis ? 'icon/disabled' : des ? 'status/danger/fg' : 'icon/default'); i.name = 'Icon'; c.appendChild(i); }
    if (p.Type === 'Avatar') { const a = I('Avatar', { Size: 'Small', Tone: 'Neutral' }, { text: { Initials: 'LA' } }); a.name = 'Avatar'; c.appendChild(a); expose(a); }
    const t = await T(p.Type === 'Avatar' ? 'Lina Aoun' : des ? 'Mark do-not-call' : 'Menu item', 'ds/Body', fg, { name: 'Label', w: 120, truncate: 1 }); c.appendChild(t); grow(t);
    if (p.State === 'Selected') { const ch = ICON('check', 16, 'icon/accent'); ch.name = 'Check'; c.appendChild(ch); }
    return c;
  }, { colKey: 'State' });
  link(set, 'Label', 'TEXT', 'Menu item', 'Label', 'characters');
  link(set, 'Icon', 'INSTANCE_SWAP', C('Icon/edit').id, 'Icon', 'mainComponent');
  return set;
});
await doc(CONT, 'Menu', 'Dropdown menu (240, ds/Elevation/2). Override nested item labels; hide items as needed.', async () => {
  const c = COMP('Menu', 'VERTICAL', { gap: 0, pad: 4, fill: 'surface/raised', stroke: 'border/default', radius: 'lg' });
  c.resize(240, 100); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
  await c.setEffectStyleIdAsync(ES['ds/Elevation/2'].id);
  const items = [['Icon', 'Open business', 'building'], ['Icon', 'Request correction', 'flag'], ['Icon', 'Copy phone', 'copy'], ['sep'], ['Destructive', 'Mark do-not-call']];
  for (const [t, l, ic] of items) {
    if (t === 'sep') { const d = I('Divider', { Orientation: 'Horizontal' }); d.name = 'Separator'; c.appendChild(d); fillW(d); continue; }
    const mi = I('Menu/Item', { Type: t, State: 'Default' }, { text: { Label: l } }); if (ic) setProp(mi, 'Icon', C('Icon/' + ic).id); mi.name = 'Item · ' + l; c.appendChild(mi); fillW(mi); expose(mi);
  }
  return c;
});
await preview(CONT, 'Data display', [
  async () => I('Card/Metric', { Trend: 'Up' }, { text: { Label: 'Calls completed today', Value: '128' } }),
  async () => I('Card/Metric', { Trend: 'Pending' }, { text: { Label: 'Target attainment' } }),
  async () => I('Progress/Bar', { Tone: 'Brand' }, { text: { Label: 'Workday progress', Value: '5h 34m of 9h' } }),
  async () => I('List/Item', { State: 'Default' }),
  async () => I('Menu'),
]);
return finish();
