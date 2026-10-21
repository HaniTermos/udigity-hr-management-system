// 04-controls-a.js — Design-System Agent — Phase 5 (Udigity Management System)
// Controls A — Button, IconButton, Link, Checkbox, Radio, Input (text/phone/URL/number/password), Textarea, Field/Metric with Unknown — page 21 DS — Components (36:3)
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

// TITLE: Controls A — Button, IconButton, Link, Checkbox, Radio, Input (text/phone/URL/number/password), Textarea, Field/Metric with Unknown — page 21 DS — Components (36:3)
const CONT = await container('DS 04 — Controls A', 'Buttons, links, checkbox, radio, text inputs (with helper/error text), textarea and the metric field with an "Unknown" checkbox. States: Default, Hover, Focus (ds/Focus ring), Disabled, Loading/Error where relevant.');
const FOCUS = ES['ds/Focus ring'], FOCUS_D = ES['ds/Focus ring/Danger'];
// ---- Button
const BTN = {
  Primary: { bg: 'brand/primary', hov: 'brand/primary-hover', fg: 'text/on-primary', ic: 'icon/on-primary' },
  Secondary: { bg: 'surface/default', hov: 'surface/hover', fg: 'text/primary', ic: 'icon/default', bd: 'border/strong' },
  Ghost: { bg: null, hov: 'surface/hover', fg: 'text/primary', ic: 'icon/default' },
  Destructive: { bg: 'status/danger/solid', hov: 'status/danger/fg', fg: 'text/on-danger', ic: 'icon/on-primary' },
};
const BSZ = { Small: [32, 12, 6, 'ds/Label Small', 16], Medium: [40, 16, 8, 'ds/Label', 20], Large: [48, 20, 8, 'ds/Label', 20] };
await doc(CONT, 'Button', 'Variant × State × Size (60 variants, kept in one set so instances can switch size/state). Properties: Label, Show icon, Icon (swap). Full width: set the instance to FILL in auto layout. Loading keeps the label and shows a spinner; Disabled uses surface/disabled + text/disabled.', async () => {
  const set = await VSET('Button', { Variant: Object.keys(BTN), Size: Object.keys(BSZ), State: ['Default', 'Hover', 'Focus', 'Disabled', 'Loading'] }, async p => {
    const b = BTN[p.Variant], [h, px, g, ts, isz] = BSZ[p.Size];
    const dis = p.State === 'Disabled';
    const bg = dis ? (p.Variant === 'Ghost' ? null : 'surface/disabled') : (p.State === 'Hover' ? b.hov : b.bg);
    const c = COMP('btn', 'HORIZONTAL', { gap: g, pad: [0, px], align: 'CENTER', justify: 'CENTER', radius: 'md', fill: bg, stroke: b.bd ? (dis ? 'border/default' : b.bd) : null });
    c.resize(100, h); c.primaryAxisSizingMode = 'AUTO'; c.counterAxisSizingMode = 'FIXED';
    if (p.State === 'Loading') { const sp = ICON('spinner', isz, b.ic); sp.name = 'Spinner'; c.appendChild(sp); }
    else { const li = ICON('plus', isz, dis ? 'icon/disabled' : b.ic); li.name = 'Leading icon'; c.appendChild(li); }
    c.appendChild(await T('Button', ts, dis ? 'text/disabled' : b.fg, { name: 'Label' }));
    if (p.State === 'Focus') await c.setEffectStyleIdAsync(FOCUS.id);
    return c;
  }, { colKey: 'State' });
  link(set, 'Label', 'TEXT', 'Button', 'Label', 'characters');
  link(set, 'Show icon', 'BOOLEAN', false, 'Leading icon', 'visible');
  link(set, 'Icon', 'INSTANCE_SWAP', C('Icon/plus').id, 'Leading icon', 'mainComponent');
  set.description = 'Primary (one per view), Secondary, Ghost (low emphasis, toolbars), Destructive (irreversible; always confirm). Never colour-only: label states the action.';
  return set;
});
// ---- IconButton
await doc(CONT, 'IconButton', 'Square icon-only button. Always give it an accessible name in code (tooltip/aria-label). "Show dot" marks unread notifications.', async () => {
  const M = { Ghost: [null, 'surface/hover', 'icon/default', null], Secondary: ['surface/default', 'surface/hover', 'icon/default', 'border/strong'], Primary: ['brand/primary', 'brand/primary-hover', 'icon/on-primary', null] };
  const set = await VSET('IconButton', { Variant: Object.keys(M), Size: ['Small', 'Medium'], State: ['Default', 'Hover', 'Focus', 'Disabled'] }, async p => {
    const [bg, hov, ic, bd] = M[p.Variant]; const d = p.Size === 'Small' ? 32 : 40; const dis = p.State === 'Disabled';
    const c = COMP('ib', 'HORIZONTAL', { align: 'CENTER', justify: 'CENTER', radius: 'md', fill: dis ? (bg ? 'surface/disabled' : null) : (p.State === 'Hover' ? hov : bg), stroke: bd ? (dis ? 'border/default' : bd) : null });
    c.resize(d, d); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    const i = ICON('more', p.Size === 'Small' ? 16 : 20, dis ? 'icon/disabled' : ic); i.name = 'Icon'; c.appendChild(i);
    const dot = DOT('Dot', 8, 'status/danger/solid'); stroke(dot, 'surface/default', 2, 'OUTSIDE'); c.appendChild(dot); dot.layoutPositioning = 'ABSOLUTE'; dot.x = d - 12; dot.y = 4;
    if (p.State === 'Focus') await c.setEffectStyleIdAsync(FOCUS.id);
    return c;
  }, { colKey: 'State' });
  link(set, 'Icon', 'INSTANCE_SWAP', C('Icon/more').id, 'Icon', 'mainComponent');
  link(set, 'Show dot', 'BOOLEAN', false, 'Dot', 'visible');
  return set;
});
// ---- Link
await doc(CONT, 'Link', 'Inline text link / text button (Button "Link"/"Tertiary" requests map here). Underlined on hover; focus ring on keyboard focus.', async () => {
  const set = await VSET('Link', { Size: ['Medium', 'Small'], State: ['Default', 'Hover', 'Focus', 'Disabled'] }, async p => {
    const dis = p.State === 'Disabled';
    const c = COMP('lnk', 'HORIZONTAL', { gap: 4, align: 'CENTER', pad: [0, 2], radius: 'xs' });
    const t = await T('Link', p.Size === 'Small' ? 'ds/Label Small' : 'ds/Label', dis ? 'text/disabled' : 'text/link', { name: 'Label' });
    if (p.State === 'Hover') t.textDecoration = 'UNDERLINE';
    const i = ICON('arrow-right', 16, dis ? 'icon/disabled' : 'icon/accent'); i.name = 'Trailing icon';
    add(c, t, i);
    if (p.State === 'Focus') await c.setEffectStyleIdAsync(FOCUS.id);
    return c;
  }, { colKey: 'State' });
  link(set, 'Label', 'TEXT', 'Link', 'Label', 'characters');
  link(set, 'Show icon', 'BOOLEAN', false, 'Trailing icon', 'visible');
  link(set, 'Icon', 'INSTANCE_SWAP', C('Icon/arrow-right').id, 'Trailing icon', 'mainComponent');
  return set;
});
// ---- Checkbox
await doc(CONT, 'Checkbox', 'Checked = False / True / Indeterminate. Label property; hide the label only when an adjacent visible label exists.', async () => {
  const set = await VSET('Checkbox', { Checked: ['False', 'True', 'Indeterminate'], State: ['Default', 'Hover', 'Focus', 'Disabled'] }, async p => {
    const dis = p.State === 'Disabled', on = p.Checked !== 'False';
    const c = COMP('cb', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
    const box = AL('Box', 'HORIZONTAL', { align: 'CENTER', justify: 'CENTER', radius: 'xs', fill: on ? (dis ? 'surface/pressed' : 'brand/primary') : (dis ? 'surface/disabled' : p.State === 'Hover' ? 'surface/hover' : 'surface/default'), stroke: on ? null : (dis ? 'border/default' : 'border/input') });
    size(box, 16, 16);
    if (on) box.appendChild(ICON(p.Checked === 'True' ? 'check' : 'minus', 14, dis ? 'icon/disabled' : 'icon/on-primary'));
    if (p.State === 'Focus') await box.setEffectStyleIdAsync(FOCUS.id);
    add(c, box, await T('Label', 'ds/Body', dis ? 'text/disabled' : 'text/primary', { name: 'Label' }));
    return c;
  }, { colKey: 'State' });
  link(set, 'Label', 'TEXT', 'Label', 'Label', 'characters');
  link(set, 'Show label', 'BOOLEAN', true, 'Label', 'visible');
  return set;
});
// ---- Radio
await doc(CONT, 'Radio', 'Single choice within a group (use RadioCard for rich options).', async () => {
  const set = await VSET('Radio', { Selected: ['False', 'True'], State: ['Default', 'Focus', 'Disabled'] }, async p => {
    const dis = p.State === 'Disabled', on = p.Selected === 'True';
    const c = COMP('rd', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
    const ring = AL('Circle', 'HORIZONTAL', { align: 'CENTER', justify: 'CENTER', radius: 'full', fill: dis ? 'surface/disabled' : (on ? 'brand/primary' : 'surface/default'), stroke: on ? null : (dis ? 'border/default' : 'border/input') });
    size(ring, 16, 16);
    if (on) ring.appendChild(DOT('Dot', 6, dis ? 'icon/disabled' : 'surface/default'));
    if (p.State === 'Focus') await ring.setEffectStyleIdAsync(FOCUS.id);
    add(c, ring, await T('Option', 'ds/Body', dis ? 'text/disabled' : 'text/primary', { name: 'Label' }));
    return c;
  }, { colKey: 'State' });
  link(set, 'Label', 'TEXT', 'Option', 'Label', 'characters');
  return set;
});
// ---- shared field scaffold
const FW = 320;
async function fieldShell(state, label) {
  const dis = state === 'Disabled', err = state === 'Error' || state === 'Empty error';
  const c = COMP('field', 'VERTICAL', { gap: 6 });
  c.resize(FW, 70); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
  const lr = AL('Label row', 'HORIZONTAL', { gap: 4, align: 'CENTER' });
  add(lr, await T(label, 'ds/Label', dis ? 'text/disabled' : 'text/primary', { name: 'Label' }), await T('*', 'ds/Label', 'status/danger/fg', { name: 'Required' }));
  c.appendChild(lr);
  return { c, dis, err };
}
function controlBox(state, h, dir) {
  const dis = state === 'Disabled' || state === 'Unknown', err = state === 'Error' || state === 'Empty error';
  const ctl = AL('Control', dir || 'HORIZONTAL', { gap: 8, pad: dir ? [10, 12] : [0, 12], align: dir ? 'MIN' : 'CENTER', radius: 'md', fill: dis ? 'surface/disabled' : 'surface/default', stroke: dis ? 'border/default' : err ? 'status/danger/solid' : state === 'Focus' ? 'focus-ring' : 'border/input' });
  size(ctl, FW, h || 40);
  return ctl;
}
async function valueTexts(ctl, state, value, placeholder, align) {
  const dis = state === 'Disabled' || state === 'Unknown';
  const t = state === 'Default' || state === 'Empty error'
    ? await T(placeholder, 'ds/Body', 'text/placeholder', { name: 'Placeholder', w: 120, truncate: 1 })
    : await T(value, 'ds/Body', dis ? 'text/disabled' : 'text/primary', { name: 'Value', w: 120, truncate: 1 });
  if (align) t.textAlignHorizontal = align;
  ctl.appendChild(t); grow(t);
  return t;
}
async function helperRow(c, state, helper, error, counter) {
  const err = state === 'Error' || state === 'Empty error';
  const hr = AL('Helper row', 'HORIZONTAL', { gap: 4, align: 'MIN' });
  if (err) { const i = ICON('alert-circle', 16, 'status/danger/fg'); i.name = 'Error icon'; hr.appendChild(i); }
  const t = err ? await T(error, 'ds/Body Small', 'status/danger/fg', { name: 'Error', w: 200 }) : await T(helper, 'ds/Body Small', 'text/muted', { name: 'Helper', w: 200 });
  hr.appendChild(t); grow(t);
  if (counter) hr.appendChild(await T('0 / 500', 'ds/Caption', 'text/muted', { name: 'Counter' }));
  c.appendChild(hr); fillW(hr);
}
async function finishField(c, ctl, state) {
  c.insertChild(1, ctl); fillW(ctl);
  if (state === 'Focus') await ctl.setEffectStyleIdAsync(FOCUS.id);
}
function linkField(set, o) {
  link(set, 'Label', 'TEXT', o.label, 'Label', 'characters');
  link(set, 'Show label', 'BOOLEAN', true, 'Label row', 'visible');
  link(set, 'Required', 'BOOLEAN', false, 'Required', 'visible');
  if (o.value != null) link(set, 'Value', 'TEXT', o.value, 'Value', 'characters');
  if (o.placeholder != null) link(set, 'Placeholder', 'TEXT', o.placeholder, 'Placeholder', 'characters');
  link(set, 'Helper', 'TEXT', o.helper, 'Helper', 'characters');
  link(set, 'Error message', 'TEXT', o.error, 'Error', 'characters');
  link(set, 'Show helper', 'BOOLEAN', true, 'Helper row', 'visible');
}
// ---- Input
const STATES = ['Default', 'Filled', 'Focus', 'Error', 'Disabled'];
const ITYPES = { Text: ['Business name', 'Glow Beauty Salon', 'Enter business name'], Phone: ['Phone', '70 000 101', '70 000 000'], URL: ['Website', 'glowbeauty.example.com', 'name.example.com'], Number: ['Followers', '12,400', '0'], Password: ['Password', '••••••••••', 'Enter password'] };
await doc(CONT, 'Input', 'Text field with label, helper/error text (swap by state) and type-specific adornments: Phone (country code + number; fictional format +000 70 000 1xx), URL (https:// prefix; example.com only), Number (right-aligned, suffix), Password (Show action). Placeholder shows only in Default; Value in other states. Width 320 default — resize the instance or set FILL.', async () => {
  const set = await VSET('Input', { Type: Object.keys(ITYPES), State: STATES }, async p => {
    const [label, value, ph] = ITYPES[p.Type];
    const { c, dis } = await fieldShell(p.State, label);
    const ctl = controlBox(p.State);
    if (p.Type === 'Text') { const i = ICON('building', 16, dis ? 'icon/disabled' : 'icon/muted'); i.name = 'Leading icon'; ctl.appendChild(i); }
    if (p.Type === 'Phone') { const cc = AL('Country', 'HORIZONTAL', { gap: 4, align: 'CENTER' }); add(cc, await T('+000', 'ds/Body', dis ? 'text/disabled' : 'text/primary', { name: 'Country code' }), ICON('chevron-down', 16, 'icon/muted')); add(ctl, cc, RECT('Separator', 1, 20, 'border/default')); }
    if (p.Type === 'URL') ctl.appendChild(await T('https://', 'ds/Body', 'text/muted', { name: 'Prefix' }));
    await valueTexts(ctl, p.State, value, ph, p.Type === 'Number' ? 'RIGHT' : null);
    if (p.Type === 'Number') ctl.appendChild(await T('followers', 'ds/Body Small', 'text/muted', { name: 'Suffix' }));
    if (p.Type === 'Password') { add(ctl, ICON('eye', 16, 'icon/muted'), await T('Show', 'ds/Label Small', dis ? 'text/disabled' : 'text/link', { name: 'Action' })); }
    await finishField(c, ctl, p.State);
    await helperRow(c, p.State, 'Helper text', 'Explain what is wrong and how to fix it.');
    return c;
  }, { colKey: 'State' });
  linkField(set, { label: 'Label', value: 'Value', placeholder: 'Placeholder', helper: 'Helper text', error: 'Explain what is wrong and how to fix it.' });
  link(set, 'Show icon', 'BOOLEAN', false, 'Leading icon', 'visible');
  link(set, 'Icon', 'INSTANCE_SWAP', C('Icon/building').id, 'Leading icon', 'mainComponent');
  link(set, 'Country code', 'TEXT', '+000', 'Country code', 'characters');
  link(set, 'Suffix', 'TEXT', 'followers', 'Suffix', 'characters');
  set.description = 'Form input. Error = danger border + icon + message (never colour alone). Disabled explains why nearby when not obvious.';
  return set;
});
// ---- Textarea
await doc(CONT, 'Textarea', 'Multi-line field with counter (notes, call summaries). Height 96 default; resize the Control for longer notes.', async () => {
  const set = await VSET('Textarea', { State: STATES }, async p => {
    const { c } = await fieldShell(p.State, 'Notes');
    const ctl = controlBox(p.State, 96, 'VERTICAL');
    const t = p.State === 'Default' ? await T('Add a note about this call…', 'ds/Body', 'text/placeholder', { name: 'Placeholder', w: 296 }) : await T('Owner asked to call back after 17:00. Interested in a booking website.', 'ds/Body', p.State === 'Disabled' ? 'text/disabled' : 'text/primary', { name: 'Value', w: 296 });
    ctl.appendChild(t); fillW(t);
    await finishField(c, ctl, p.State);
    await helperRow(c, p.State, 'Visible to your team.', 'Summary is required to save this attempt.', true);
    return c;
  });
  linkField(set, { label: 'Label', value: 'Value', placeholder: 'Placeholder', helper: 'Helper text', error: 'Error message' });
  link(set, 'Counter', 'TEXT', '0 / 500', 'Counter', 'characters');
  return set;
});
// ---- Field/Metric with Unknown
await doc(CONT, 'Field/Metric', 'Metric input with an "Unknown" checkbox (Data Entry request). States: Value, Empty error, Unknown (input disabled and reads "Unknown"). Whether Unknown is allowed per metric is pending DEC-014/023 — keep the policy label next to the field on screens.', async () => {
  const set = await VSET('Field/Metric', { State: ['Value', 'Empty error', 'Unknown'] }, async p => {
    const { c } = await fieldShell(p.State, 'Instagram followers');
    const row = AL('Control row', 'HORIZONTAL', { gap: 12, align: 'CENTER' });
    const ctl = controlBox(p.State);
    await valueTexts(ctl, p.State === 'Value' ? 'Filled' : p.State, p.State === 'Unknown' ? 'Unknown' : '12,400', 'Enter a number', 'RIGHT');
    add(row, ctl, I('Checkbox', { Checked: p.State === 'Unknown' ? 'True' : 'False', State: 'Default' }, { text: { Label: 'Unknown' }, name: 'Unknown checkbox' }));
    grow(ctl);
    c.insertChild(1, row); fillW(row);
    await helperRow(c, p.State, p.State === 'Unknown' ? 'Marked Unknown — stored as not recorded.' : 'Whole number, as shown on the profile.', 'Enter a value or tick Unknown.');
    return c;
  });
  linkField(set, { label: 'Label', value: 'Value', placeholder: 'Placeholder', helper: 'Helper text', error: 'Enter a value or tick Unknown.' });
  return set;
});
await preview(CONT, 'Controls A', [
  async () => add(AL('btns', 'HORIZONTAL', { gap: 12, align: 'CENTER' }), I('Button', { Variant: 'Primary', Size: 'Medium', State: 'Default' }, { text: { Label: 'Save business' } }), I('Button', { Variant: 'Secondary', Size: 'Medium', State: 'Default' }, { text: { Label: 'Cancel' } }), I('Button', { Variant: 'Destructive', Size: 'Medium', State: 'Default' }, { text: { Label: 'Delete' } }), I('IconButton', { Variant: 'Ghost', Size: 'Medium', State: 'Default' }), I('Link', { Size: 'Medium', State: 'Default' }, { text: { Label: 'View history' } })),
  async () => I('Input', { Type: 'Phone', State: 'Filled' }, { text: { Value: '70 000 101' } }),
  async () => I('Input', { Type: 'URL', State: 'Error' }),
  async () => I('Field/Metric', { State: 'Unknown' }),
]);
return finish();
