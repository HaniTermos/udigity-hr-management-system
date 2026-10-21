// 12-fixes.js — Design-System Agent — Phase 5 (Udigity Management System)
// Checkpoint fixes (in place, no rebuild): text-property defaults per component, per-variant sample text (Card/Metric), Menu destructive icon, sidebar active icon tint, Nav/Item label wrapping — page 21 DS — Components (36:3)
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

// TITLE: Checkpoint fixes (in place, no rebuild): text-property defaults per component, per-variant sample text (Card/Metric), Menu destructive icon, sidebar active icon tint, Nav/Item label wrapping — page 21 DS — Components (36:3)
const FIX = { defaults: {}, unlinked: [], menu: [], navTint: [], navWrap: [], missing: [] };
async function node(id, name) { let n = await figma.getNodeByIdAsync(id); if (!n || n.name !== name) n = REG[name] || null; if (!n) FIX.missing.push(name + ' ' + id); return n; }
const [METRIC, QROW, LITEM, MENUITEM, SIDEBAR, NAVITEM] = await Promise.all([
  node('51:1842', 'Card/Metric'), node('55:2596', 'Queue/Row'), node('51:1870', 'List/Item'), node('51:1984', 'Menu/Item'), node('49:976', 'Nav/Sidebar'), node('49:652', 'Nav/Item')]);
// ---- 1. property defaults (set level; one default per property is a Figma rule)
function setDefaults(set, map) {
  if (!set) return;
  const defs = set.componentPropertyDefinitions;
  for (const [prop, val] of Object.entries(map)) {
    const key = Object.keys(defs).find(k => k.split('#')[0] === prop && defs[k].type === 'TEXT');
    if (!key) { FIX.missing.push(set.name + '.' + prop); continue; }
    set.editComponentProperty(key, { defaultValue: val });
    FIX.defaults[set.name + '.' + prop] = val;
  }
}
const D = [
  [METRIC, { Label: 'Calls completed today', Value: '128', Delta: '+12% vs last week', Caption: 'Target: 150 per day' }],
  [QROW, { Name: 'Olive & Thyme Café', Meta: 'Callback 14:30 · Last attempt 14 Oct 12:30' }],
  [LITEM, { Title: 'Call back Olive & Thyme Café', Meta: 'Today · 14:30 · Follow-up' }],
];
const BYNAME = [
  ['Badge/Status', { Label: 'Active' }], ['Chip/Derived', { Label: 'Overdue 2 days' }], ['Badge/Flag', { Label: 'Correction requested' }],
  ['Card/Task', { Title: 'Booking flow' }], ['Timeline/Item', { Title: 'Call attempt by Maya Khoury', Body: 'Owner busy; asked to call back after 17:00.' }],
  ['RadioCard', { Title: 'Needs another call', Description: 'Schedule a follow-up before saving.' }],
  ['Input', { Label: 'Business name', Value: 'Glow Beauty Salon', Placeholder: 'Enter business name', Helper: 'As shown on the shop sign.' }],
  ['Textarea', { Label: 'Notes', Value: 'Owner asked to call back after 17:00.', Placeholder: 'Add a note about this call…', Helper: 'Visible to your team.' }],
  ['Field/Metric', { Label: 'Instagram followers', Value: '12,400', Placeholder: 'Enter a number', Helper: 'Whole number, as shown on the profile.' }],
  ['Select', { Label: 'Category', Value: 'Salon', Placeholder: 'Select category' }],
  ['Input/Date', { Label: 'Follow-up date', Value: '22 Oct 2026', Placeholder: 'DD MMM YYYY' }],
  ['Banner', { Title: 'Title', Body: 'Explain what happened and what to do next.' }],
  ['Toast', { Title: 'Saved', Body: 'Olive & Thyme Café moved to Follow-ups.' }],
  ['Kanban/Column', { Title: 'In progress' }], ['Menu/Item', { Label: 'Open business' }],
];
for (const [s, m] of D) setDefaults(s, m);
for (const [n, m] of BYNAME) setDefaults(REG[n] || null, m);
// Badge/Status and Chip/Derived: the Label property must stay (it is the badge's API), so the
// set-level default is one sensible label; Card/Metric variants whose sample differs are unlinked
// for that layer only and get their own text (override that text layer directly on instances).
async function unlinkText(set, variantProps, layer, text) {
  if (!set) return;
  const v = set.children.find(c => Object.entries(variantProps).every(([k, val]) => pv(c.name)[k] === val));
  if (!v) { FIX.missing.push(set.name + ' ' + JSON.stringify(variantProps)); return; }
  let t = null; walk(v, n => { if (!t && n.type === 'TEXT' && n.name === layer) t = n; });
  if (!t) { FIX.missing.push(set.name + ' ' + layer); return; }
  const refs = Object.assign({}, t.componentPropertyReferences || {}); delete refs.characters;
  t.componentPropertyReferences = refs;
  await Promise.all(t.getStyledTextSegments(['fontName']).map(s => figma.loadFontAsync(s.fontName)));
  t.characters = text;
  FIX.unlinked.push(`${set.name} ${JSON.stringify(variantProps)} ${layer}="${text}"`);
}
await unlinkText(METRIC, { Trend: 'Pending' }, 'Value', '—');
await unlinkText(METRIC, { Trend: 'Pending' }, 'Caption', 'Target not defined yet');
await unlinkText(METRIC, { Trend: 'Down' }, 'Delta', '−8% vs last week');
await unlinkText(METRIC, { Trend: 'Flat' }, 'Delta', 'No change');
// ---- 2. Menu/Item Destructive: icon = ban (unlink from the Icon swap property in those variants)
if (MENUITEM) {
  const ban = C('Icon/ban');
  for (const v of MENUITEM.children.filter(c => pv(c.name).Type === 'Destructive')) {
    let ic = null; walk(v, n => { if (!ic && n.type === 'INSTANCE' && n.name === 'Icon') ic = n; });
    if (!ic) { FIX.missing.push('Menu/Item icon ' + v.name); continue; }
    const refs = Object.assign({}, ic.componentPropertyReferences || {}); delete refs.mainComponent;
    ic.componentPropertyReferences = refs;
    ic.swapComponent(ban); ic.name = 'Icon';
    tint(ic, pv(v.name).State === 'Disabled' ? 'icon/disabled' : 'status/danger/fg');
    FIX.menu.push(v.id);
  }
}
// ---- 3. Active nav icons on navy: Glyph stroke -> icon/on-brand-active (main variants + every sidebar's active items)
if (NAVITEM) for (const v of NAVITEM.children.filter(c => pv(c.name).State === 'Active')) { const ic = v.findAllWithCriteria({ types: ['INSTANCE'] }).find(n => n.name === 'Icon'); if (ic) { tint(ic, 'icon/on-brand-active'); FIX.navTint.push(v.id); } }
if (SIDEBAR) for (const sb of SIDEBAR.children) for (const it of sb.findAllWithCriteria({ types: ['INSTANCE'] }).filter(n => n.name.startsWith('Nav/Item · '))) {
  const mc = await it.getMainComponentAsync();
  if (mc && pv(mc.name).State === 'Active') { const ic = it.findAllWithCriteria({ types: ['INSTANCE'] }).find(n => n.name === 'Icon'); if (ic) { tint(ic, 'icon/on-brand-active'); FIX.navTint.push(it.id); } }
}
// ---- 4. Nav/Item: long labels wrap to 2 lines (approved low-fi behaviour) instead of truncating.
// Height hugs with min height 36 (Default) / 32 (Compact); one-line items keep their height.
if (NAVITEM) for (const v of NAVITEM.children) {
  const compact = pv(v.name).Density === 'Compact';
  const lab = v.findAllWithCriteria({ types: ['TEXT'] }).find(n => n.name === 'Label');
  if (lab) { lab.textTruncation = 'ENDING'; lab.maxLines = 2; }
  pad(v, compact ? 6 : 8, 12);
  v.minHeight = compact ? 32 : 36;
  v.counterAxisSizingMode = 'AUTO';
  const ind = v.findAllWithCriteria({ types: ['RECTANGLE'] }).find(n => n.name === 'Indicator');
  if (ind) ind.constraints = { horizontal: 'MIN', vertical: 'STRETCH' };
  FIX.navWrap.push(v.id);
}
return finish({ fixes: FIX });
