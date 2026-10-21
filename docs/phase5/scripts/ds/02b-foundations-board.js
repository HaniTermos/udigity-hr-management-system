// 02b-foundations-board.js — Design-System Agent — Phase 5 (Udigity Management System)
// Foundations board part B (icons, interaction states, chart styles, contrast table) appended to the board from 02-styles.js.
// Run with use_figma. Idempotent: existing components with the same name are skipped (set REBUILD = true to rebuild).
const PAGE_ID = '36:2';
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

// ======================= 02b-foundations-board.js body =======================
const CONTRAST = [["text/primary","surface/default","text",16.37,15.26,4.5,"1A2029/FFFFFF","F5F7FA/1A2029"],["text/primary","surface/page","text",15.26,17.06,4.5,"1A2029/F5F7FA","F5F7FA/11151B"],["text/primary","surface/sunken","text",14.32,17.06,4.5,"1A2029/EDF0F4","F5F7FA/11151B"],["text/primary","surface/raised","text",16.37,13.67,4.5,"1A2029/FFFFFF","F5F7FA/222932"],["text/primary","surface/selected","text",14.82,14.26,4.5,"1A2029/E6F7F7","F5F7FA/052A2B"],["text/primary","surface/hover","text",14.32,12.05,4.5,"1A2029/EDF0F4","F5F7FA/2A323E"],["text/secondary","surface/default","text",8.83,10.62,4.5,"414B5A/FFFFFF","C9D1DA/1A2029"],["text/secondary","surface/page","text",8.23,11.87,4.5,"414B5A/F5F7FA","C9D1DA/11151B"],["text/secondary","surface/sunken","text",7.72,11.87,4.5,"414B5A/EDF0F4","C9D1DA/11151B"],["text/muted","surface/default","text",6,7.11,4.5,"586476/FFFFFF","A1ACB9/1A2029"],["text/muted","surface/page","text",5.59,7.95,4.5,"586476/F5F7FA","A1ACB9/11151B"],["text/muted","surface/sunken","text",5.25,7.95,4.5,"586476/EDF0F4","A1ACB9/11151B"],["text/muted","surface/hover","text",5.25,5.61,4.5,"586476/EDF0F4","A1ACB9/2A323E"],["text/placeholder","surface/default","text",6,7.11,4.5,"586476/FFFFFF","A1ACB9/1A2029"],["text/link","surface/default","text",6.74,8.25,4.5,"0A6669/FFFFFF","52C9CB/1A2029"],["text/link","surface/page","text",6.28,9.22,4.5,"0A6669/F5F7FA","52C9CB/11151B"],["text/on-brand","surface/brand","text",17.31,18.69,4.5,"FFFFFF/0B1A35","FFFFFF/071226"],["text/on-brand","surface/brand-active","text",13.07,15.36,4.5,"FFFFFF/17305A","FFFFFF/112447"],["text/on-brand-muted","surface/brand","text",9.61,10.37,4.5,"B3C2DB/0B1A35","B3C2DB/071226"],["text/on-brand-muted","surface/brand-hover","text",8.53,9.61,4.5,"B3C2DB/112447","B3C2DB/0B1A35"],["text/on-primary","brand/primary","text",13.07,7.14,4.5,"FFFFFF/17305A","11151B/22B3B6"],["text/on-primary","brand/primary-hover","text",15.36,9.22,4.5,"FFFFFF/112447","11151B/52C9CB"],["text/on-danger","status/danger/solid","text",6.31,5.33,4.5,"FFFFFF/B52A2A","11151B/E36060"],["text/inverse","surface/inverse","text",17.31,16.02,4.5,"FFFFFF/0B1A35","11151B/EDF0F4"],["text/on-primary","brand/accent","text",4.73,7.14,4.5,"FFFFFF/0B8084","11151B/22B3B6"],["status/success/fg","status/success/bg","text",6.56,6.05,4.5,"116338/E7F6ED","69C493/0A3A21"],["status/warning/fg","status/warning/bg","text",5.88,7.34,4.5,"855500/FFF5E1","F5BF55/4A2F00"],["status/danger/fg","status/danger/bg","text",7.68,5.91,4.5,"8F2020/FDECEC","EC8888/4F1212"],["status/info/fg","status/info/bg","text",7.67,5.93,4.5,"1C4A8B/E8F1FC","79A9EC/0F2A50"],["status/neutral/fg","status/neutral/bg","text",7.72,8.38,4.5,"414B5A/EDF0F4","C9D1DA/2A323E"],["status/brand/fg","status/brand/bg","text",6.1,7.71,4.5,"0A6669/E6F7F7","52C9CB/052A2B"],["status/policy/fg","status/policy/bg","text",7.52,5.6,4.5,"523C93/F1EDFB","A994E3/2C2052"],["status/decision/fg","status/decision/bg","text",9.58,9.61,4.5,"1F3D6E/EEF2F8","B3C2DB/0B1A35"],["status/success/fg","surface/default","text",7.33,7.73,4.5,"116338/FFFFFF","69C493/1A2029"],["status/warning/fg","surface/default","text",6.37,9.72,4.5,"855500/FFFFFF","F5BF55/1A2029"],["status/danger/fg","surface/default","text",8.77,6.58,4.5,"8F2020/FFFFFF","EC8888/1A2029"],["status/info/fg","surface/default","text",8.74,6.78,4.5,"1C4A8B/FFFFFF","79A9EC/1A2029"],["status/neutral/fg","surface/default","text",8.83,10.62,4.5,"414B5A/FFFFFF","C9D1DA/1A2029"],["status/brand/fg","surface/default","text",6.74,8.25,4.5,"0A6669/FFFFFF","52C9CB/1A2029"],["status/policy/fg","surface/default","text",8.65,6.26,4.5,"523C93/FFFFFF","A994E3/1A2029"],["status/decision/fg","surface/default","text",10.76,9.09,4.5,"1F3D6E/FFFFFF","B3C2DB/1A2029"],["text/primary","status/success/bg","text",14.66,11.93,4.5,"1A2029/E7F6ED","F5F7FA/0A3A21"],["text/primary","status/warning/bg","text",15.13,11.53,4.5,"1A2029/FFF5E1","F5F7FA/4A2F00"],["text/primary","status/danger/bg","text",14.34,13.71,4.5,"1A2029/FDECEC","F5F7FA/4F1212"],["text/primary","status/info/bg","text",14.36,13.34,4.5,"1A2029/E8F1FC","F5F7FA/0F2A50"],["text/primary","status/neutral/bg","text",14.32,12.05,4.5,"1A2029/EDF0F4","F5F7FA/2A323E"],["text/primary","status/brand/bg","text",14.82,14.26,4.5,"1A2029/E6F7F7","F5F7FA/052A2B"],["text/primary","status/policy/bg","text",14.23,13.63,4.5,"1A2029/F1EDFB","F5F7FA/2C2052"],["text/primary","status/decision/bg","text",14.57,16.13,4.5,"1A2029/EEF2F8","F5F7FA/0B1A35"],["text/secondary","status/success/bg","text",7.9,8.3,4.5,"414B5A/E7F6ED","C9D1DA/0A3A21"],["text/secondary","status/warning/bg","text",8.16,8.02,4.5,"414B5A/FFF5E1","C9D1DA/4A2F00"],["text/secondary","status/danger/bg","text",7.73,9.54,4.5,"414B5A/FDECEC","C9D1DA/4F1212"],["text/secondary","status/info/bg","text",7.74,9.28,4.5,"414B5A/E8F1FC","C9D1DA/0F2A50"],["text/muted","surface/subtle","text",5.59,6.37,4.5,"586476/F5F7FA","A1ACB9/222932"],["text/secondary","surface/subtle","text",8.23,9.51,4.5,"414B5A/F5F7FA","C9D1DA/222932"],["text/muted","surface/raised","text",6,6.37,4.5,"586476/FFFFFF","A1ACB9/222932"],["text/muted","surface/selected","text",5.43,6.64,4.5,"586476/E6F7F7","A1ACB9/052A2B"],["status/brand/fg","surface/selected","text",6.1,7.71,4.5,"0A6669/E6F7F7","52C9CB/052A2B"],["text/disabled","surface/disabled","exempt",2.02,2.15,0,"A1ACB9/EDF0F4","586476/2A323E"],["border/input","surface/default","ui",3.84,4.26,3,"778395/FFFFFF","778395/1A2029"],["border/strong","surface/default","decor",1.54,2.73,0,"C9D1DA/FFFFFF","586476/1A2029"],["focus-ring","surface/default","ui",3.34,8.25,3,"0E9CA0/FFFFFF","52C9CB/1A2029"],["focus-ring","surface/page","ui",3.11,9.22,3,"0E9CA0/F5F7FA","52C9CB/11151B"],["focus-ring","surface/brand","ui",5.18,9.41,3,"0E9CA0/0B1A35","52C9CB/071226"],["brand/accent","surface/default","ui",4.73,6.39,3,"0B8084/FFFFFF","22B3B6/1A2029"],["icon/default","surface/default","ui",8.83,10.62,3,"414B5A/FFFFFF","C9D1DA/1A2029"],["icon/muted","surface/default","ui",3.84,4.26,3,"778395/FFFFFF","778395/1A2029"],["icon/on-brand","surface/brand","ui",9.61,10.37,3,"B3C2DB/0B1A35","B3C2DB/071226"],["icon/accent","surface/default","ui",4.73,6.39,3,"0B8084/FFFFFF","22B3B6/1A2029"],["icon/on-primary","brand/primary","ui",13.07,7.14,3,"FFFFFF/17305A","11151B/22B3B6"],["border/selected","surface/default","ui",4.73,6.39,3,"0B8084/FFFFFF","22B3B6/1A2029"],["brand/accent","surface/brand","ui",3.66,7.29,3,"0B8084/0B1A35","22B3B6/071226"],["chart/series-1","surface/default","ui",3.34,8.25,3,"0E9CA0/FFFFFF","52C9CB/1A2029"],["chart/series-2","surface/default","ui",8.2,5.67,3,"2F4F82/FFFFFF","8399BF/1A2029"],["chart/series-3","surface/default","ui",5.42,6.26,3,"7357C2/FFFFFF","A994E3/1A2029"],["chart/series-4","surface/default","ui",3.34,8.68,3,"DB6E2C/FFFFFF","F2AE7E/1A2029"],["chart/series-5","surface/default","ui",4.88,6.89,3,"C23F7E/FFFFFF","E58DB8/1A2029"],["chart/series-6","surface/default","ui",3.84,7.11,3,"778395/FFFFFF","A1ACB9/1A2029"],["chart/target","surface/default","ui",4.16,9.72,3,"AD6F00/FFFFFF","F5BF55/1A2029"],["status/success/solid","surface/default","ui",5.11,5.91,3,"167E47/FFFFFF","3DAF73/1A2029"],["status/warning/solid","surface/default","ui",4.16,7.93,3,"AD6F00/FFFFFF","EBA82B/1A2029"],["status/danger/solid","surface/default","ui",6.31,4.76,3,"B52A2A/FFFFFF","E36060/1A2029"],["status/info/solid","surface/default","ui",6.37,5.02,3,"245EAF/FFFFFF","5390E0/1A2029"],["status/neutral/solid","surface/default","ui",6,7.11,3,"586476/FFFFFF","A1ACB9/1A2029"],["status/brand/solid","surface/default","ui",4.73,6.39,3,"0B8084/FFFFFF","22B3B6/1A2029"],["status/policy/solid","surface/default","ui",5.42,6.26,3,"7357C2/FFFFFF","A994E3/1A2029"],["status/decision/solid","surface/default","ui",8.2,5.67,3,"2F4F82/FFFFFF","8399BF/1A2029"]];
const IDS = { board: {} };
const BOARD = page.children.find(c => c.name === 'DS Foundations — Board');
if (!BOARD) throw new Error('Run 02-styles.js first (board missing)');
for (const n of ['Icons', 'Interaction and focus states', 'Chart styles', 'Contrast — computed WCAG ratios']) for (const old of BOARD.children.filter(c => c.name === '§ ' + n)) old.remove();
async function section(title, desc) {
  const s = AL('§ ' + title, 'VERTICAL', { gap: 20 });
  add(s, await T(title, 'ds/H1', 'text/primary'));
  if (desc) s.appendChild(await T(desc, 'ds/Body', 'text/secondary', { w: 1100 }));
  BOARD.appendChild(s); IDS.board[title] = s.id;
  return s;
}
let s;
// 8 icons
s = await section('Icons', 'Approach: one in-house set of simple line icons drawn as native vectors from SVG paths on a 24-unit grid, 1.75 stroke, round caps and joins, no fills. Components "Icon/<name>" live on page 21 DS — Components (20x20 default; resize instances to 16 or 24). Stroke binds to icon/default; components override it (icon/on-brand, icon/accent, status fg). Icons are swapped with INSTANCE_SWAP properties, never variants. No external icon assets are imported. Icons are never the only carrier of meaning: always pair status icons with a text label.');
// 9 interaction states
s = await section('Interaction and focus states', 'Every interactive component has Default, Hover, Focus, Disabled (and Loading or Error where relevant). Focus = ds/Focus ring effect (2px gap + 2px focus-ring) and is never removed. Disabled = surface/disabled + text/disabled (contrast exempt, but always paired with an explanation where the reason is not obvious). Error = status/danger border + message text, never colour alone.');
const strow = AL('States', 'HORIZONTAL', { gap: 24 });
for (const [st, bg, tx] of [['Default', 'brand/primary', 'text/on-primary'], ['Hover', 'brand/primary-hover', 'text/on-primary'], ['Pressed', 'brand/primary-pressed', 'text/on-primary'], ['Focus', 'brand/primary', 'text/on-primary'], ['Disabled', 'surface/disabled', 'text/disabled']]) {
  const c = AL(st, 'VERTICAL', { gap: 8, align: 'CENTER' });
  const b = AL('Button sample', 'HORIZONTAL', { pad: [10, 16], fill: bg, radius: 'md', align: 'CENTER' });
  b.appendChild(await T('Save business', 'ds/Label', tx));
  if (st === 'Focus') await b.setEffectStyleIdAsync(ES['ds/Focus ring'].id);
  add(c, b, await T(st, 'ds/Caption', 'text/muted'));
  strow.appendChild(c);
}
s.appendChild(strow);
// 10 charts
s = await section('Chart styles', 'Series colours chart/series-1…6 (Light | Dark switch with mode). Use in order; max 6 series; never encode meaning by colour alone — always label series in a legend or directly. Grid lines chart/grid 1px, axis labels ds/Caption in chart/axis, target lines chart/target dashed and labelled (targets are pending DEC-020 where shown).');
const crow = AL('Series', 'HORIZONTAL', { gap: 16 });
for (let i = 1; i <= 6; i++) { const c = AL('series-' + i, 'VERTICAL', { gap: 6, align: 'CENTER' }); add(c, RECT('sw', 64, 40, 'chart/series-' + i, { radius: 'sm' }), await T('chart/series-' + i, 'ds/Caption', 'text/secondary')); crow.appendChild(c); }
for (const n of ['chart/grid', 'chart/axis', 'chart/target']) { const c = AL(n, 'VERTICAL', { gap: 6, align: 'CENTER' }); add(c, RECT('sw', 64, 40, n, { radius: 'sm' }), await T(n, 'ds/Caption', 'text/secondary')); crow.appendChild(c); }
s.appendChild(crow);
// 11 contrast
s = await section('Contrast — computed WCAG ratios', 'Ratios computed with the WCAG 2.x relative-luminance formula from the hex values of each actual foreground/background token pair, in both modes. Thresholds: text 4.5:1; UI/graphics (borders of inputs, focus ring, icons, chart marks) 3:1; disabled text is exempt. FAIL marks are shown in red; there are none in this version. Note: status/warning/solid (Light #AD6F00) is for non-text marks only — never place white text on it (4.16:1).');
const tbl = AL('Contrast table', 'VERTICAL', { gap: 0, fill: 'surface/default', stroke: 'border/default', radius: 'lg', clip: true });
const hdr = AL('Header row', 'HORIZONTAL', { pad: [8, 12], gap: 12, fill: 'surface/sunken', align: 'CENTER' });
for (const [h, w] of [['Foreground', 200], ['Background', 180], ['Use', 64], ['Need', 48], ['Light sample', 96], ['Light ratio', 150], ['Dark sample', 96], ['Dark ratio', 150]]) hdr.appendChild(await T(h, 'ds/Overline', 'text/muted', { w }));
tbl.appendChild(hdr);
for (const [fg, bg, kind, L, D, need, lh, dh] of CONTRAST) {
  const r = AL(fg + ' on ' + bg, 'HORIZONTAL', { pad: [6, 12], gap: 12, align: 'CENTER' });
  stroke(r, 'border/subtle'); r.strokeTopWeight = 1; r.strokeBottomWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0;
  add(r, await T(fg, 'ds/Body Small', 'text/primary', { w: 200 }), await T(bg, 'ds/Body Small', 'text/secondary', { w: 180 }), await T(kind, 'ds/Caption', 'text/muted', { w: 64 }), await T(need ? need + ':1' : '—', 'ds/Caption', 'text/muted', { w: 48 }));
  for (const [mode, val, hx] of [[LIGHT, L, lh], [DARK, D, dh]]) {
    const smp = AL('sample', 'HORIZONTAL', { pad: [4, 8], fill: bg, radius: 'sm', justify: 'CENTER', w: 96 });
    smp.setExplicitVariableModeForCollection(semCol, mode);
    const isText = fg.startsWith('text') || fg.endsWith('/fg');
    if (isText) smp.appendChild(await T('Aa 123', 'ds/Label', fg)); else { const m = RECT('mark', 40, 16, fg, { radius: 'xs' }); smp.appendChild(m); }
    const ok = !need || val >= need;
    r.appendChild(smp);
    r.appendChild(await T(val.toFixed(2) + ':1 ' + (need ? (ok ? 'PASS' : 'FAIL') : 'exempt') + '  #' + hx.replace('/', ' / #'), 'ds/Caption', ok ? 'text/primary' : 'status/danger/fg', { w: 150 }));
  }
  tbl.appendChild(r);
}
s.appendChild(tbl);
return finish({ ids: IDS, boardId: BOARD.id });
