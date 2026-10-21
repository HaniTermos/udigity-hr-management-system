// 05-controls-b.js — Design-System Agent — Phase 5 (Udigity Management System)
// Controls B — Select/Combobox/Person select, Input/Date (date, time, date-time), DatePicker, Input/Search, Chip/Filter, FilterBar, RadioCard — page 21 DS — Components (36:3)
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

// TITLE: Controls B — Select/Combobox/Person select, Input/Date (date, time, date-time), DatePicker, Input/Search, Chip/Filter, FilterBar, RadioCard — page 21 DS — Components (36:3)
const CONT = await container('DS 05 — Controls B', 'Selection, date and time, search and filtering controls. Same field anatomy as Input (label, control, helper/error).');
const FOCUS = ES['ds/Focus ring'];
const FW = 320;
async function fieldShell(state, label) {
  const dis = state === 'Disabled';
  const c = COMP('field', 'VERTICAL', { gap: 6 });
  c.resize(FW, 70); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
  const lr = AL('Label row', 'HORIZONTAL', { gap: 4, align: 'CENTER' });
  add(lr, await T(label, 'ds/Label', dis ? 'text/disabled' : 'text/primary', { name: 'Label' }), await T('*', 'ds/Label', 'status/danger/fg', { name: 'Required' }));
  c.appendChild(lr);
  return c;
}
function controlBox(state, h, w) {
  const dis = state === 'Disabled', err = state === 'Error';
  const ctl = AL('Control', 'HORIZONTAL', { gap: 8, pad: [0, 12], align: 'CENTER', radius: 'md', fill: dis ? 'surface/disabled' : 'surface/default', stroke: dis ? 'border/default' : err ? 'status/danger/solid' : (state === 'Focus' || state === 'Open') ? 'focus-ring' : 'border/input' });
  size(ctl, w || FW, h || 40);
  return ctl;
}
async function valueText(ctl, state, value, placeholder) {
  const dis = state === 'Disabled';
  const t = state === 'Default' ? await T(placeholder, 'ds/Body', 'text/placeholder', { name: 'Placeholder', w: 120, truncate: 1 }) : await T(value, 'ds/Body', dis ? 'text/disabled' : 'text/primary', { name: 'Value', w: 120, truncate: 1 });
  ctl.appendChild(t); grow(t); return t;
}
async function helperRow(c, state, helper, error) {
  const err = state === 'Error';
  const hr = AL('Helper row', 'HORIZONTAL', { gap: 4, align: 'MIN' });
  if (err) { const i = ICON('alert-circle', 16, 'status/danger/fg'); i.name = 'Error icon'; hr.appendChild(i); }
  const t = err ? await T(error, 'ds/Body Small', 'status/danger/fg', { name: 'Error', w: 200 }) : await T(helper, 'ds/Body Small', 'text/muted', { name: 'Helper', w: 200 });
  hr.appendChild(t); grow(t); c.appendChild(hr); fillW(hr);
}
async function place(c, ctl, state) { c.insertChild(1, ctl); fillW(ctl); if (state === 'Focus' || state === 'Open') await ctl.setEffectStyleIdAsync(FOCUS.id); }
function linkField(set, helperDefault) {
  link(set, 'Label', 'TEXT', 'Label', 'Label', 'characters');
  link(set, 'Show label', 'BOOLEAN', true, 'Label row', 'visible');
  link(set, 'Required', 'BOOLEAN', false, 'Required', 'visible');
  link(set, 'Value', 'TEXT', 'Value', 'Value', 'characters');
  link(set, 'Placeholder', 'TEXT', 'Placeholder', 'Placeholder', 'characters');
  link(set, 'Helper', 'TEXT', helperDefault || 'Helper text', 'Helper', 'characters');
  link(set, 'Error message', 'TEXT', 'Explain what is wrong and how to fix it.', 'Error', 'characters');
  link(set, 'Show helper', 'BOOLEAN', false, 'Helper row', 'visible');
}
// ---- Select
const SEL = { Select: ['Category', 'Salon', 'Select category'], Combobox: ['Business', 'Peak Fitness Gym', 'Search businesses…'], Person: ['Developer', 'Lina Aoun', 'Select developer'] };
await doc(CONT, 'Select', 'Type Select (fixed list), Combobox (type to filter; leading search icon) and Person (avatar option). State Open shows the focused control with chevron up — pair with a Menu instance below it. Categories list is pending DEC-015 where shown.', async () => {
  const set = await VSET('Select', { Type: Object.keys(SEL), State: ['Default', 'Filled', 'Focus', 'Open', 'Error', 'Disabled'] }, async p => {
    const [label, value, ph] = SEL[p.Type];
    const c = await fieldShell(p.State, label);
    const ctl = controlBox(p.State); const dis = p.State === 'Disabled';
    if (p.Type === 'Combobox') { const i = ICON('search', 16, dis ? 'icon/disabled' : 'icon/muted'); i.name = 'Leading icon'; ctl.appendChild(i); }
    if (p.Type === 'Person' && p.State !== 'Default') { const a = I('Avatar', { Size: 'Small', Tone: 'Brand' }, { text: { Initials: 'LA' } }); a.name = 'Avatar'; ctl.appendChild(a); }
    await valueText(ctl, p.State, value, ph);
    const ch = ICON(p.State === 'Open' ? 'chevron-up' : 'chevron-down', 16, dis ? 'icon/disabled' : 'icon/default'); ch.name = 'Chevron'; ctl.appendChild(ch);
    await place(c, ctl, p.State);
    await helperRow(c, p.State, 'Helper text', 'Select an option.');
    return c;
  }, { colKey: 'State' });
  linkField(set);
  return set;
});
// ---- Input/Date
const DT = { Date: ['Follow-up date', '22 Oct 2026', 'DD MMM YYYY', 'calendar'], Time: ['Time', '14:30', 'HH:MM', 'clock'], 'Date and time': ['Meeting', '22 Oct 2026, 14:30', 'DD MMM YYYY, HH:MM', 'calendar'] };
await doc(CONT, 'Input/Date', 'Date, time and date-time fields (24-hour time; dates in October–November 2026 in the sample). Opening the field shows DatePicker (date) or a Menu of time slots (time).', async () => {
  const set = await VSET('Input/Date', { Type: Object.keys(DT), State: ['Default', 'Filled', 'Focus', 'Error', 'Disabled'] }, async p => {
    const [label, value, ph, ic] = DT[p.Type];
    const c = await fieldShell(p.State, label); const ctl = controlBox(p.State);
    await valueText(ctl, p.State, value, ph);
    const i = ICON(ic, 16, p.State === 'Disabled' ? 'icon/disabled' : 'icon/default'); i.name = 'Trailing icon'; ctl.appendChild(i);
    await place(c, ctl, p.State);
    await helperRow(c, p.State, 'Helper text', 'Choose a date in the future.');
    return c;
  }, { colKey: 'State' });
  linkField(set);
  return set;
});
// ---- DatePicker
await doc(CONT, 'DatePicker/Day', 'Day cell for DatePicker and mini calendars.', async () => {
  const set = await VSET('DatePicker/Day', { State: ['Default', 'Hover', 'Today', 'Selected', 'Outside', 'Disabled'] }, async p => {
    const M = { Default: [null, 'text/primary'], Hover: ['surface/hover', 'text/primary'], Today: [null, 'status/brand/fg'], Selected: ['brand/primary', 'text/on-primary'], Outside: [null, 'text/muted'], Disabled: [null, 'text/disabled'] }[p.State];
    const c = COMP('day', 'HORIZONTAL', { align: 'CENTER', justify: 'CENTER', radius: 'md', fill: M[0], stroke: p.State === 'Today' ? 'border/selected' : null });
    c.resize(36, 36); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    c.appendChild(await T('22', p.State === 'Selected' || p.State === 'Today' ? 'ds/Label' : 'ds/Body', M[1], { name: 'Day' }));
    return c;
  });
  link(set, 'Day', 'TEXT', '22', 'Day', 'characters');
  return set;
});
await doc(CONT, 'DatePicker', 'Month popover (Monday first). Sample: October 2026, today 20 Oct, selected 22 Oct. Use ds/Elevation/2.', async () => {
  const c = COMP('DatePicker', 'VERTICAL', { gap: 8, pad: 12, fill: 'surface/raised', stroke: 'border/default', radius: 'lg' });
  await c.setEffectStyleIdAsync(ES['ds/Elevation/2'].id);
  const head = AL('Header', 'HORIZONTAL', { align: 'CENTER', justify: 'SPACE_BETWEEN' });
  const prev = I('IconButton', { Variant: 'Ghost', Size: 'Small', State: 'Default' }); setProp(prev, 'Icon', C('Icon/chevron-left').id);
  const next = I('IconButton', { Variant: 'Ghost', Size: 'Small', State: 'Default' }); setProp(next, 'Icon', C('Icon/chevron-right').id);
  add(head, prev, await T('October 2026', 'ds/H4', 'text/primary', { name: 'Month' }), next);
  c.appendChild(head); fillW(head);
  const wk = AL('Weekdays', 'HORIZONTAL', { gap: 0 });
  for (const d of ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']) { const cell = AL(d, 'HORIZONTAL', { justify: 'CENTER', align: 'CENTER', w: 36, h: 24 }); cell.appendChild(await T(d, 'ds/Caption', 'text/muted')); wk.appendChild(cell); }
  c.appendChild(wk);
  const days = [28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1];
  for (let r = 0; r < 5; r++) {
    const row = AL('Week ' + (r + 1), 'HORIZONTAL', { gap: 0 });
    for (let i = 0; i < 7; i++) {
      const k = r * 7 + i, d = days[k];
      const st = (k < 3 || k === 34) ? 'Outside' : d === 20 ? 'Today' : d === 22 ? 'Selected' : 'Default';
      row.appendChild(I('DatePicker/Day', { State: st }, { text: { Day: String(d) } }));
    }
    c.appendChild(row);
  }
  c.description = 'Date picker popover. Override nested Day states/texts for other months.';
  return c;
});
// ---- Input/Search
await doc(CONT, 'Input/Search', 'Search field (top bar, lists, filter bars). Filled shows a clear button. Call Center search covers assigned businesses only — say so in the placeholder.', async () => {
  const set = await VSET('Input/Search', { Size: ['Small', 'Medium'], State: ['Default', 'Filled', 'Focus'] }, async p => {
    const h = p.Size === 'Small' ? 32 : 40;
    const c = COMP('search', 'HORIZONTAL', { gap: 8, pad: [0, 12], align: 'CENTER', radius: 'md', fill: 'surface/default', stroke: p.State === 'Focus' ? 'focus-ring' : 'border/input' });
    c.resize(320, h); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    c.appendChild(ICON('search', 16, 'icon/muted'));
    const t = p.State === 'Filled' ? await T('Glow Beauty', 'ds/Body', 'text/primary', { name: 'Value', w: 120, truncate: 1 }) : await T('Search businesses, phones, handles', 'ds/Body', 'text/placeholder', { name: 'Placeholder', w: 120, truncate: 1 });
    c.appendChild(t); grow(t);
    if (p.State === 'Filled') { const x = ICON('x', 16, 'icon/default'); x.name = 'Clear'; c.appendChild(x); }
    if (p.State === 'Focus') await c.setEffectStyleIdAsync(FOCUS.id);
    return c;
  }, { colKey: 'State' });
  link(set, 'Placeholder', 'TEXT', 'Search businesses, phones, handles', 'Placeholder', 'characters');
  link(set, 'Value', 'TEXT', 'Glow Beauty', 'Value', 'characters');
  return set;
});
// ---- Chip/Filter
await doc(CONT, 'Chip/Filter', 'Filter chip. Active shows the applied value and a remove (x) control; Default opens a menu (chevron).', async () => {
  const set = await VSET('Chip/Filter', { State: ['Default', 'Hover', 'Active', 'Disabled'] }, async p => {
    const act = p.State === 'Active', dis = p.State === 'Disabled';
    const c = COMP('chip', 'HORIZONTAL', { gap: 6, pad: [0, 12], align: 'CENTER', radius: 'full', fill: act ? 'surface/selected' : dis ? 'surface/disabled' : p.State === 'Hover' ? 'surface/hover' : 'surface/default', stroke: act ? 'border/selected' : 'border/default' });
    c.resize(100, 32); c.primaryAxisSizingMode = 'AUTO'; c.counterAxisSizingMode = 'FIXED';
    c.appendChild(await T(act ? 'Status: Active' : 'Category', 'ds/Label Small', act ? 'status/brand/fg' : dis ? 'text/disabled' : 'text/primary', { name: 'Label' }));
    const i = ICON(act ? 'x' : 'chevron-down', 14, act ? 'icon/accent' : dis ? 'icon/disabled' : 'icon/default'); i.name = act ? 'Remove' : 'Chevron'; c.appendChild(i);
    return c;
  });
  link(set, 'Label', 'TEXT', 'Category', 'Label', 'characters');
  return set;
});
// ---- FilterBar
await doc(CONT, 'FilterBar', 'Composed filter row for list screens (1152 wide). Override nested chip labels; hide chips you do not need.', async () => {
  const c = COMP('FilterBar', 'HORIZONTAL', { gap: 8, align: 'CENTER', pad: [8, 0] });
  c.resize(1152, 48); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
  const s = I('Input/Search', { Size: 'Small', State: 'Default' }); s.resize(280, 32);
  const sp = AL('Spacer', 'HORIZONTAL', {});
  add(c, s, I('Chip/Filter', { State: 'Default' }, { text: { Label: 'Category' } }), I('Chip/Filter', { State: 'Active' }, { text: { Label: 'Status: Active' } }), I('Chip/Filter', { State: 'Default' }, { text: { Label: 'Assigned to' } }), I('Link', { Size: 'Small', State: 'Default' }, { text: { Label: 'Clear filters' } }), sp, I('Chip/Filter', { State: 'Default' }, { text: { Label: 'Sort: Last updated' } }));
  grow(sp);
  c.description = 'Search + filter chips + clear + sort.';
  return c;
});
// ---- RadioCard
await doc(CONT, 'RadioCard', 'Rich single choice (e.g. call outcome). Title + description + optional status dot. Selected uses a 2px teal border and surface/selected — plus the filled radio, so selection never relies on colour alone.', async () => {
  const set = await VSET('RadioCard', { State: ['Default', 'Hover', 'Selected', 'Disabled'] }, async p => {
    const sel = p.State === 'Selected', dis = p.State === 'Disabled';
    const c = COMP('rc', 'HORIZONTAL', { gap: 12, pad: [12, 16], align: 'MIN', radius: 'lg', fill: sel ? 'surface/selected' : dis ? 'surface/disabled' : p.State === 'Hover' ? 'surface/hover' : 'surface/default', stroke: sel ? 'border/selected' : 'border/default', sw: sel ? 2 : 1 });
    c.resize(320, 64); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
    const ring = AL('Radio', 'HORIZONTAL', { align: 'CENTER', justify: 'CENTER', radius: 'full', fill: sel ? 'brand/primary' : 'surface/default', stroke: sel ? null : dis ? 'border/default' : 'border/input' });
    size(ring, 16, 16); if (sel) ring.appendChild(DOT('Dot', 6, 'surface/default'));
    const col = AL('Text', 'VERTICAL', { gap: 2 });
    const tr = AL('Title row', 'HORIZONTAL', { gap: 6, align: 'CENTER' });
    add(tr, DOT('Status dot', 8, 'status/info/solid'), await T('Needs another call', 'ds/Label', dis ? 'text/disabled' : 'text/primary', { name: 'Title' }));
    add(col, tr, await T('Schedule a follow-up before saving.', 'ds/Body Small', dis ? 'text/disabled' : 'text/secondary', { name: 'Description', w: 240 }));
    add(c, ring, col); grow(col);
    return c;
  });
  link(set, 'Title', 'TEXT', 'Option title', 'Title', 'characters');
  link(set, 'Description', 'TEXT', 'Short description of the option.', 'Description', 'characters');
  link(set, 'Show status dot', 'BOOLEAN', false, 'Status dot', 'visible');
  return set;
});
await preview(CONT, 'Controls B', [
  async () => I('Select', { Type: 'Person', State: 'Filled' }),
  async () => I('Input/Date', { Type: 'Date and time', State: 'Filled' }),
  async () => I('DatePicker'),
  async () => add(AL('chips', 'HORIZONTAL', { gap: 8 }), I('Chip/Filter', { State: 'Default' }), I('Chip/Filter', { State: 'Active' })),
  async () => I('RadioCard', { State: 'Selected' }, { text: { Title: 'Needs another call' } }),
]);
return finish();
