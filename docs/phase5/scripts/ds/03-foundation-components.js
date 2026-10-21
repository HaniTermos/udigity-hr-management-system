// 03-foundation-components.js — Design-System Agent — Phase 5 (Udigity Management System)
// Icons (Icon/*), Brand/Logo placeholder, Avatar, Divider, Placeholder/Box, Annotation, badges, tags, Chip/Derived, Notice/Policy pending — page 21 DS — Components (36:3)
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

// TITLE: Icons (Icon/*), Brand/Logo placeholder, Avatar, Divider, Placeholder/Box, Annotation, badges, tags, Chip/Derived, Notice/Policy pending — page 21 DS — Components (36:3)
const CONT = await container('DS 03 — Icons, brand and labels', 'Icon set (native vectors from SVG paths, 24-unit grid, 1.75 stroke, rendered 20x20), brand placeholder, avatar, divider, placeholder box, annotation, status badges, tags, derived chips and the Notice/Policy pending component. Everything binds to Semantic variables.');
const CIRC = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z';
const ICONS = [
  ['search', 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4'], ['calendar', 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4'], ['clock', CIRC + ' M12 7v5l3 2'],
  ['chevron-down', 'M6 9l6 6 6-6'], ['chevron-up', 'M6 15l6-6 6 6'], ['chevron-left', 'M15 6l-6 6 6 6'], ['chevron-right', 'M9 6l6 6-6 6'],
  ['check', 'M5 12.5l4.5 4.5L19 7.5'], ['x', 'M6 6l12 12 M18 6L6 18'], ['plus', 'M12 5v14 M5 12h14'], ['minus', 'M5 12h14'],
  ['filter', 'M4 5h16l-6 8v6l-4-2v-4z'], ['bell', 'M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z M10 21h4'], ['user', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0'],
  ['users', 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2 20a7 7 0 0 1 14 0 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14a6 6 0 0 1 4 6'],
  ['home', 'M4 11l8-7 8 7v9h-5v-6H9v6H4z'], ['building', 'M5 21V4h10v17 M15 9h4v12 M8 8h4 M8 12h4 M8 16h4 M3 21h18'],
  ['phone', 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z'],
  ['briefcase', 'M4 8h16v11H4z M9 8V5h6v3 M4 13h16'], ['folder', 'M3 6h6l2 2h10v11H3z'], ['board', 'M4 4h4v16H4z M10 4h4v10h-4z M16 4h4v13h-4z'],
  ['list', 'M9 6h11 M9 12h11 M9 18h11 M4 6h1 M4 12h1 M4 18h1'], ['chart', 'M4 20V10 M10 20V4 M16 20v-7 M3 20h18'],
  ['settings', 'M4 7h10 M18 7h2 M4 17h4 M12 17h8 M16 5v4 M10 15v4'], ['lock', 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3'],
  ['eye', 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  ['eye-off', 'M3 3l18 18 M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.6 M6.6 6.6C3.8 8.3 2 12 2 12s4 6 10 6c1.7 0 3.2-.4 4.5-1.1'],
  ['alert-triangle', 'M12 4l9 16H3z M12 10v4 M12 17v.5'], ['alert-circle', CIRC + ' M12 7v6 M12 16v.5'], ['info', CIRC + ' M12 11v5 M12 8v.5'],
  ['check-circle', CIRC + ' M8 12l3 3 5-6'], ['x-circle', CIRC + ' M9 9l6 6 M15 9l-6 6'], ['ban', CIRC + ' M5.6 5.6l12.8 12.8'],
  ['menu', 'M4 6h16 M4 12h16 M4 18h16'], ['more', 'M5 12h.01 M12 12h.01 M19 12h.01', 3], ['more-vertical', 'M12 5v.01 M12 12v.01 M12 19v.01', 3],
  ['map-pin', 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  ['wifi', 'M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5v.01'],
  ['copy', 'M8 8h12v12H8z M16 8V4H4v12h4'], ['flag', 'M5 21V4 M5 4h11l-2 4 2 4H5'], ['shield', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
  ['mail', 'M3 6h18v12H3z M3 7l9 6 9-6'], ['arrow-up', 'M12 19V5 M6 11l6-6 6 6'], ['arrow-down', 'M12 5v14 M6 13l6 6 6-6'], ['arrow-right', 'M5 12h14 M13 6l6 6-6 6'],
  ['trend-up', 'M3 17l6-6 4 4 8-8 M15 7h6v6'], ['trend-down', 'M3 7l6 6 4-4 8 8 M15 17h6v-6'], ['spinner', 'M12 3a9 9 0 1 0 9 9'],
  ['log-out', 'M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10'], ['download', 'M12 4v11 M7 10l5 5 5-5 M4 20h16'], ['edit', 'M4 20h4L19 9l-4-4L4 16z'],
  ['trash', 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13'], ['link', 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  ['globe', CIRC + ' M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18'], ['at-sign', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8'],
  ['file-text', 'M6 3h9l4 4v14H6z M15 3v4h4 M9 12h7 M9 16h7'], ['refresh', 'M20 11a8 8 0 0 0-14.9-3 M4 4v4h4 M4 13a8 8 0 0 0 14.9 3 M20 20v-4h-4'],
  ['target', CIRC + ' M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'], ['hourglass', 'M7 3h10 M7 21h10 M8 3c0 5 8 5 8 9s-8 4-8 9 M16 3c0 5-8 5-8 9s8 4 8 9'],
  ['pause-circle', CIRC + ' M10 9v6 M14 9v6'], ['play', 'M8 5l11 7-11 7z'], ['note', 'M5 4h14v12l-4 4H5z M15 20v-4h4'], ['grip', 'M9 6v.01 M15 6v.01 M9 12v.01 M15 12v.01 M9 18v.01 M15 18v.01', 3],
];
// ---- Icons (one component per glyph; swap with INSTANCE_SWAP)
{
  const gname = 'doc · Icons';
  let g = CONT.children.find(c => c.name === gname);
  if (!g) {
    g = AL(gname, 'VERTICAL', { gap: 12 });
    add(g, await T('Icons', 'ds/H2'), await T('Icon/<name> components, 20x20, single vector layer "Glyph" (stroke bound to icon/default). Resize instances to 16/24; tint by overriding the Glyph stroke with icon/* or status/*/fg. Name of the glyph layer is identical in every icon so tint overrides survive swaps.', 'ds/Body Small', 'text/secondary', { w: 960 }));
    const grid = AL('Icon grid', 'HORIZONTAL', { gap: 16 }); grid.layoutWrap = 'WRAP'; grid.counterAxisSpacing = 16; size(grid, 1200);
    g.appendChild(grid); CONT.appendChild(g);
  }
  const grid = g.children.find(c => c.name === 'Icon grid');
  OUT.created.icons = {};
  for (const [n, d, sw] of ICONS) {
    const name = 'Icon/' + n;
    if (has(name) && !REBUILD) { OUT.existing[name] = REG[name].id; continue; }
    if (has(name) && REBUILD) { const cell = REG[name].parent; REG[name].remove(); if (cell && cell.name === 'cell ' + n) cell.remove(); }
    const f = figma.createNodeFromSvg(`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${d}" stroke="#414B5A" stroke-width="${sw || 1.75}" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
    TMP.appendChild(f);
    const c = figma.createComponentFromNode(f);
    c.name = name; c.fills = []; c.clipsContent = false;
    for (const v of c.findAllWithCriteria({ types: ['VECTOR'] })) { v.name = 'Glyph'; v.strokes = [P('icon/default')]; v.constraints = { horizontal: 'SCALE', vertical: 'SCALE' }; }
    c.description = 'Line icon "' + n + '" (24 grid, 1.75 stroke). Default 20px; tint via Glyph stroke override.';
    const cell = AL('cell ' + n, 'VERTICAL', { gap: 6, align: 'CENTER', w: 88 });
    add(cell, c, await T(n, 'ds/Caption', 'text/muted'));
    grid.appendChild(cell);
    REG[name] = c; OUT.created.icons[name] = c.id;
  }
}
// ---- Brand/Logo placeholder
await doc(CONT, 'Brand/Logo (placeholder — awaiting supplied file)', 'Neutral placeholder only. The Udigity logo file has not been supplied: never draw or invent the logo. Replace the inner content when the file arrives (keep the component name/ID so all instances update).', async () => {
  const S = { Small: [132, 32], Medium: [168, 40], Large: [220, 56] };
  return VSET('Brand/Logo (placeholder — awaiting supplied file)', { Size: ['Small', 'Medium', 'Large'], Surface: ['Default', 'On brand'] }, async p => {
    const ob = p.Surface === 'On brand';
    const c = COMP('logo', 'VERTICAL', { justify: 'CENTER', align: 'CENTER', gap: 0, stroke: ob ? 'icon/on-brand' : 'border/strong', dash: [4, 3], radius: 'md', fill: ob ? null : 'surface/subtle' });
    c.resize(S[p.Size][0], S[p.Size][1]); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    c.appendChild(await T(p.Size === 'Small' ? 'Logo placeholder' : 'Udigity logo', p.Size === 'Large' ? 'ds/Label' : 'ds/Label Small', ob ? 'text/on-brand' : 'text/secondary'));
    if (p.Size !== 'Small') c.appendChild(await T('placeholder — awaiting supplied file', 'ds/Caption', ob ? 'text/on-brand-muted' : 'text/muted'));
    return c;
  }, { description: 'Placeholder for the Udigity logo — awaiting supplied file. Do not draw a logo.' });
});
// ---- Avatar
await doc(CONT, 'Avatar', 'Initials only (no photos in the sample). Tone Brand for people in the user menu; Neutral in lists.', async () => {
  const D = { Small: 24, Medium: 32, Large: 40 };
  const set = await VSET('Avatar', { Size: ['Small', 'Medium', 'Large'], Tone: ['Brand', 'Neutral'] }, async p => {
    const c = COMP('a', 'HORIZONTAL', { justify: 'CENTER', align: 'CENTER', radius: 'full', fill: p.Tone === 'Brand' ? 'status/brand/bg' : 'status/neutral/bg' });
    c.resize(D[p.Size], D[p.Size]); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    const t = await T('RH', p.Size === 'Large' ? 'ds/Label' : 'ds/Label Small', p.Tone === 'Brand' ? 'status/brand/fg' : 'status/neutral/fg', { name: 'Initials' });
    c.appendChild(t); return c;
  });
  link(set, 'Initials', 'TEXT', 'RH', 'Initials', 'characters');
  return set;
});
// ---- Divider
await doc(CONT, 'Divider', '1px rule bound to border/default. Resize the instance (or set FILL in auto layout).', async () => {
  return VSET('Divider', { Orientation: ['Horizontal', 'Vertical'] }, async p => {
    const c = COMP('d', null, { fill: 'border/default' });
    if (p.Orientation === 'Horizontal') c.resize(240, 1); else c.resize(1, 24);
    return c;
  });
});
// ---- Placeholder/Box
await doc(CONT, 'Placeholder/Box', 'Dashed box for slots and limited previews (e.g. "Limited preview — pending DEC-003"). Resize freely; default content of every slot.', async () => {
  const c = COMP('Placeholder/Box', 'VERTICAL', { justify: 'CENTER', align: 'CENTER', gap: 4, pad: 16, fill: 'surface/subtle', stroke: 'border/strong', dash: [6, 4], radius: 'md' });
  c.resize(320, 120); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
  add(c, await T('Content slot', 'ds/Label', 'text/secondary', { name: 'Label' }), await T('Replace with content', 'ds/Caption', 'text/muted', { name: 'Hint' }));
  link(c, 'Label', 'TEXT', 'Content slot', 'Label', 'characters');
  link(c, 'Hint', 'TEXT', 'Replace with content', 'Hint', 'characters');
  c.description = 'Dashed placeholder. Used as default slot content and for limited/policy-pending previews.';
  return c;
});
// ---- Annotation
await doc(CONT, 'Annotation', 'Designer annotation card (not product UI): notes, intended interactions (prototype is out of scope, so interactions are annotated), implementation notes.', async () => {
  const set = await VSET('Annotation', { Type: ['Note', 'Interaction', 'Implementation'] }, async p => {
    const ic = { Note: 'note', Interaction: 'arrow-right', Implementation: 'settings' }[p.Type];
    const c = COMP('ann', 'VERTICAL', { gap: 6, pad: 12, fill: 'surface/subtle', stroke: 'border/strong', dash: [4, 3], radius: 'md' });
    c.resize(320, 80); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    const head = AL('Head', 'HORIZONTAL', { gap: 6, align: 'CENTER' });
    add(head, ICON(ic, 16, 'icon/default'), await T(p.Type === 'Note' ? 'NOTE' : p.Type === 'Interaction' ? 'INTENDED INTERACTION' : 'IMPLEMENTATION NOTE', 'ds/Overline', 'text/secondary', { name: 'Kind' }));
    const ti = await T('N1 — Annotation title', 'ds/Label', 'text/primary', { name: 'Title', w: 296 });
    const bo = await T('Explain the behaviour, the source document and any pending decision here.', 'ds/Body Small', 'text/secondary', { name: 'Body', w: 296 });
    add(c, head, ti, bo);
    return c;
  });
  link(set, 'Title', 'TEXT', 'N1 — Annotation title', 'Title', 'characters');
  link(set, 'Body', 'TEXT', 'Explain the behaviour, the source document and any pending decision here.', 'Body', 'characters');
  return set;
});
// ---- Badge/Status
const TONES = ['Neutral', 'Info', 'Success', 'Warning', 'Danger', 'Brand'];
await doc(CONT, 'Badge/Status', 'Stored status label. Always text + tone (never colour only); the dot is decorative. Sizes Small (tables, cards) and Large (record headers).', async () => {
  const set = await VSET('Badge/Status', { Tone: TONES, Size: ['Small', 'Large'] }, async p => {
    const t = p.Tone.toLowerCase();
    const c = COMP('b', 'HORIZONTAL', { gap: 6, align: 'CENTER', pad: p.Size === 'Small' ? [2, 8] : [4, 10], fill: `status/${t}/bg`, stroke: `status/${t}/border`, radius: 'full' });
    add(c, DOT('Dot', p.Size === 'Small' ? 6 : 8, `status/${t}/solid`), await T(p.Tone === 'Neutral' ? 'Draft' : p.Tone, p.Size === 'Small' ? 'ds/Label Small' : 'ds/Label', `status/${t}/fg`, { name: 'Label' }));
    return c;
  });
  link(set, 'Label', 'TEXT', 'Status', 'Label', 'characters');
  link(set, 'Show dot', 'BOOLEAN', true, 'Dot', 'visible');
  return set;
});
// ---- Badge/Outcome (call outcomes)
await doc(CONT, 'Badge/Outcome', 'Call-attempt outcome. Each outcome has its own icon and label so it never depends on colour.', async () => {
  const M = { 'Pending': ['neutral', 'clock'], 'On hold': ['warning', 'pause-circle'], 'Needs another call': ['info', 'phone'], 'Rejected': ['danger', 'x-circle'], 'Accepted': ['success', 'check-circle'] };
  return VSET('Badge/Outcome', { Outcome: Object.keys(M) }, async p => {
    const [t, ic] = M[p.Outcome];
    const c = COMP('o', 'HORIZONTAL', { gap: 4, align: 'CENTER', pad: [2, 8], fill: `status/${t}/bg`, stroke: `status/${t}/border`, radius: 'full' });
    add(c, ICON(ic, 14, `status/${t}/fg`), await T(p.Outcome, 'ds/Label Small', `status/${t}/fg`, { name: 'Label' }));
    return c;
  });
});
// ---- Badge/Count
await doc(CONT, 'Badge/Count', 'Numeric count (nav items, tabs, bucket headers).', async () => {
  const M = { Neutral: ['status/neutral/bg', 'status/neutral/fg'], Brand: ['status/brand/bg', 'status/brand/fg'], Danger: ['status/danger/solid', 'text/on-danger'], 'On brand': ['surface/brand-active', 'text/on-brand'] };
  const set = await VSET('Badge/Count', { Tone: Object.keys(M) }, async p => {
    const c = COMP('c', 'HORIZONTAL', { justify: 'CENTER', align: 'CENTER', pad: [2, 6], fill: M[p.Tone][0], radius: 'full' });
    c.minWidth = 20;
    c.appendChild(await T('7', 'ds/Label Small', M[p.Tone][1], { name: 'Count' }));
    return c;
  });
  link(set, 'Count', 'TEXT', '7', 'Count', 'characters');
  return set;
});
// ---- Badge/Flag
await doc(CONT, 'Badge/Flag', 'Flag on a record (e.g. "Correction requested 14 Oct", "Changed by Karim Saleh").', async () => {
  const set = await VSET('Badge/Flag', { Tone: ['Warning', 'Danger', 'Info', 'Neutral'] }, async p => {
    const t = p.Tone.toLowerCase();
    const c = COMP('f', 'HORIZONTAL', { gap: 4, align: 'CENTER', pad: [2, 8], fill: `status/${t}/bg`, radius: 'sm' });
    add(c, ICON('flag', 14, `status/${t}/fg`), await T('Correction requested', 'ds/Label Small', `status/${t}/fg`, { name: 'Label' }));
    return c;
  });
  link(set, 'Label', 'TEXT', 'Correction requested', 'Label', 'characters');
  return set;
});
// ---- Tag
await doc(CONT, 'Tag', 'Neutral descriptive label (category, phone label "Primary", platform).', async () => {
  const M = { Neutral: ['surface/sunken', 'text/secondary', null], Brand: ['brand/accent-subtle', 'status/brand/fg', null], Outline: [null, 'text/secondary', 'border/strong'] };
  const set = await VSET('Tag', { Tone: Object.keys(M) }, async p => {
    const c = COMP('t', 'HORIZONTAL', { gap: 4, align: 'CENTER', pad: [2, 6], fill: M[p.Tone][0], stroke: M[p.Tone][2], radius: 'sm' });
    c.appendChild(await T('Salon', 'ds/Label Small', M[p.Tone][1], { name: 'Label' }));
    return c;
  });
  link(set, 'Label', 'TEXT', 'Salon', 'Label', 'characters');
  return set;
});
// ---- Chip/Derived
await doc(CONT, 'Chip/Derived', 'Derived (computed, not stored) value — dashed outline distinguishes it from stored statuses.', async () => {
  const set = await VSET('Chip/Derived', { Tone: ['Neutral', 'Amber'] }, async p => {
    const t = p.Tone === 'Amber' ? 'warning' : 'neutral';
    const c = COMP('d', 'HORIZONTAL', { gap: 4, align: 'CENTER', pad: [2, 8], stroke: `status/${t}/fg`, dash: [3, 2], radius: 'full' });
    c.appendChild(await T(p.Tone === 'Amber' ? 'Waiting for client' : 'Overdue 2 days', 'ds/Label Small', `status/${t}/fg`, { name: 'Label' }));
    return c;
  });
  link(set, 'Label', 'TEXT', 'Derived', 'Label', 'characters');
  return set;
});
// ---- Notice/Policy pending
await doc(CONT, 'Notice/Policy pending', 'Mandatory label wherever an unresolved policy (DEC-xxx, R-xx, B-x…) affects the screen. Never pick an alternative silently. Sizes: Block (title + wrapping body, 360 default, resize width), Inline (one wrapping line, 320), Chip (single line, hug). Tone "Implementation decision" marks choices deferred to implementation.', async () => {
  const set = await VSET('Notice/Policy pending', { Size: ['Block', 'Inline', 'Chip'], Tone: ['Policy pending', 'Implementation decision'] }, async p => {
    const t = p.Tone === 'Policy pending' ? 'policy' : 'decision';
    const title = p.Tone === 'Policy pending' ? 'Policy pending' : 'Implementation decision';
    if (p.Size === 'Chip') {
      const c = COMP('chip', 'HORIZONTAL', { gap: 4, align: 'CENTER', pad: [2, 8], fill: `status/${t}/bg`, stroke: `status/${t}/border`, radius: 'full' });
      add(c, ICON('hourglass', 14, `status/${t}/fg`), await T('DEC-000', 'ds/Label Small', `status/${t}/fg`, { name: 'DEC' }), await T(title, 'ds/Caption', `status/${t}/fg`, { name: 'Title' }));
      return c;
    }
    if (p.Size === 'Inline') {
      const c = COMP('inline', 'HORIZONTAL', { gap: 6, align: 'MIN', pad: [6, 10], fill: `status/${t}/bg`, stroke: `status/${t}/border`, radius: 'sm' });
      c.resize(320, 32); c.counterAxisSizingMode = 'AUTO'; c.primaryAxisSizingMode = 'FIXED';
      const lab = AL('Lead', 'HORIZONTAL', { gap: 4, align: 'CENTER' });
      add(lab, ICON('hourglass', 16, `status/${t}/fg`), await T('DEC-000', 'ds/Label Small', `status/${t}/fg`, { name: 'DEC' }));
      const body = await T(title + ' — short description of what is undecided.', 'ds/Body Small', `status/${t}/fg`, { name: 'Body', w: 200 });
      add(c, lab, body); grow(body);
      return c;
    }
    const c = COMP('block', 'VERTICAL', { gap: 6, pad: [12, 16], fill: `status/${t}/bg`, stroke: `status/${t}/border`, radius: 'md' });
    c.resize(360, 80); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
    const head = AL('Head', 'HORIZONTAL', { gap: 6, align: 'CENTER' });
    add(head, ICON('hourglass', 16, `status/${t}/fg`), await T('DEC-000', 'ds/Label Small', `status/${t}/fg`, { name: 'DEC' }), await T(title, 'ds/Label', `status/${t}/fg`, { name: 'Title' }));
    const body = await T('Describe what is undecided and what the screen shows meanwhile. Text wraps; resize the instance width as needed.', 'ds/Body Small', `status/${t}/fg`, { name: 'Body', w: 328 });
    add(c, head, body); fillW(body);
    return c;
  });
  link(set, 'DEC', 'TEXT', 'DEC-000', 'DEC', 'characters');
  link(set, 'Body', 'TEXT', 'Describe what is undecided and what the screen shows meanwhile.', 'Body', 'characters');
  return set;
});
await preview(CONT, 'Labels', [
  async () => add(AL('row', 'HORIZONTAL', { gap: 8 }), I('Badge/Status', { Tone: 'Success', Size: 'Small' }, { text: { Label: 'Active' } }), I('Badge/Status', { Tone: 'Warning', Size: 'Small' }, { text: { Label: 'On hold' } }), I('Badge/Outcome', { Outcome: 'Needs another call' }), I('Badge/Count', { Tone: 'Danger' })),
  async () => I('Notice/Policy pending', { Size: 'Block', Tone: 'Policy pending' }, { text: { DEC: 'DEC-020', Body: 'Target metrics are not defined yet. Values shown are placeholders.' } }),
  async () => add(AL('row2', 'HORIZONTAL', { gap: 8 }), I('Notice/Policy pending', { Size: 'Chip', Tone: 'Policy pending' }, { text: { DEC: 'DEC-015' } }), I('Chip/Derived', { Tone: 'Amber' }), I('Brand/Logo (placeholder — awaiting supplied file)', { Size: 'Small', Surface: 'Default' })),
]);
return finish();
