// 02-styles.js — Design-System Agent — Phase 5 (Udigity Management System)
// Text, effect and grid styles + foundations board part A (colour, type, spacing, radius, elevation, grid) on page 20 DS — Foundations (36:2). Board rebuilt on each run.
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

// ======================= 02-styles.js body =======================
const TEXT_STYLES = [["ds/Display","Bold",32,40,-1,null,"Page titles on dashboards, large hero numbers"],["ds/H1","Semi Bold",24,32,-0.5,null,"Screen title (one per screen)"],["ds/H2","Semi Bold",20,28,-0.5,null,"Section titles, dialog titles"],["ds/H3","Semi Bold",16,24,0,null,"Card titles, drawer section titles"],["ds/H4","Semi Bold",14,20,0,null,"Sub-section titles, table group headers"],["ds/Body","Regular",14,20,0,null,"Default UI and paragraph text"],["ds/Body Strong","Medium",14,20,0,null,"Emphasised body text, table primary cell"],["ds/Body Small","Regular",13,18,0,null,"Secondary text, helper text, meta lines"],["ds/Label","Medium",14,20,0,null,"Buttons, form labels, nav items, tabs"],["ds/Label Small","Medium",12,16,0,null,"Small buttons, badges, chips"],["ds/Caption","Regular",12,16,0,null,"Captions, timestamps, axis labels"],["ds/Overline","Semi Bold",11,16,6,"UPPER","Nav section labels, table column headers"],["ds/Number","Medium",14,20,0,null,"Numbers in tables; code: font-variant-numeric: tabular-nums"],["ds/Number Large","Semi Bold",28,36,-0.5,null,"Metric card values (tabular-nums in code)"],["ds/Number XL","Semi Bold",40,48,-1,null,"Attendance timer (tabular-nums in code)"]];
const SEMROWS = [["surface/page","F5F7FA","11151B","grey/50","grey/950"],["surface/default","FFFFFF","1A2029","base/white","grey/900"],["surface/raised","FFFFFF","222932","base/white","grey/850"],["surface/subtle","F5F7FA","222932","grey/50","grey/850"],["surface/sunken","EDF0F4","11151B","grey/100","grey/950"],["surface/hover","EDF0F4","2A323E","grey/100","grey/800"],["surface/pressed","DFE4EA","414B5A","grey/200","grey/700"],["surface/selected","E6F7F7","052A2B","teal/50","teal/950"],["surface/disabled","EDF0F4","2A323E","grey/100","grey/800"],["surface/inverse","0B1A35","EDF0F4","navy/900","grey/100"],["surface/brand","0B1A35","071226","navy/900","navy/950"],["surface/brand-hover","112447","0B1A35","navy/800","navy/900"],["surface/brand-active","17305A","112447","navy/700","navy/800"],["surface/skeleton","DFE4EA","2A323E","grey/200","grey/800"],["border/default","DFE4EA","414B5A","grey/200","grey/700"],["border/subtle","EDF0F4","2A323E","grey/100","grey/800"],["border/strong","C9D1DA","586476","grey/300","grey/600"],["border/input","778395","778395","grey/500","grey/500"],["border/brand","17305A","112447","navy/700","navy/800"],["border/selected","0B8084","22B3B6","teal/600","teal/400"],["text/primary","1A2029","F5F7FA","grey/900","grey/50"],["text/secondary","414B5A","C9D1DA","grey/700","grey/300"],["text/muted","586476","A1ACB9","grey/600","grey/400"],["text/placeholder","586476","A1ACB9","grey/600","grey/400"],["text/disabled","A1ACB9","586476","grey/400","grey/600"],["text/inverse","FFFFFF","11151B","base/white","grey/950"],["text/on-brand","FFFFFF","FFFFFF","base/white","base/white"],["text/on-brand-muted","B3C2DB","B3C2DB","navy/200","navy/200"],["text/on-primary","FFFFFF","11151B","base/white","grey/950"],["text/on-danger","FFFFFF","11151B","base/white","grey/950"],["text/link","0A6669","52C9CB","teal/700","teal/300"],["icon/default","414B5A","C9D1DA","grey/700","grey/300"],["icon/muted","778395","778395","grey/500","grey/500"],["icon/on-brand","B3C2DB","B3C2DB","navy/200","navy/200"],["icon/on-brand-active","FFFFFF","FFFFFF","base/white","base/white"],["icon/accent","0B8084","22B3B6","teal/600","teal/400"],["icon/strong","1A2029","F5F7FA","grey/900","grey/50"],["icon/on-primary","FFFFFF","11151B","base/white","grey/950"],["icon/disabled","A1ACB9","586476","grey/400","grey/600"],["brand/primary","17305A","22B3B6","navy/700","teal/400"],["brand/primary-hover","112447","52C9CB","navy/800","teal/300"],["brand/primary-pressed","0B1A35","8EDDDE","navy/900","teal/200"],["brand/accent","0B8084","22B3B6","teal/600","teal/400"],["brand/accent-strong","0A6669","52C9CB","teal/700","teal/300"],["brand/accent-subtle","E6F7F7","052A2B","teal/50","teal/950"],["focus-ring","0E9CA0","52C9CB","teal/500","teal/300"],["overlay/scrim","071226","000000","alpha/navy-56","alpha/black-64"],["status/success/fg","116338","69C493","success/700","success/300"],["status/success/bg","E7F6ED","0A3A21","success/50","success/900"],["status/success/border","69C493","116338","success/300","success/700"],["status/success/solid","167E47","3DAF73","success/600","success/400"],["status/warning/fg","855500","F5BF55","warning/700","warning/300"],["status/warning/bg","FFF5E1","4A2F00","warning/50","warning/900"],["status/warning/border","F5BF55","855500","warning/300","warning/700"],["status/warning/solid","AD6F00","EBA82B","warning/600","warning/400"],["status/danger/fg","8F2020","EC8888","danger/700","danger/300"],["status/danger/bg","FDECEC","4F1212","danger/50","danger/900"],["status/danger/border","EC8888","8F2020","danger/300","danger/700"],["status/danger/solid","B52A2A","E36060","danger/600","danger/400"],["status/info/fg","1C4A8B","79A9EC","info/700","info/300"],["status/info/bg","E8F1FC","0F2A50","info/50","info/900"],["status/info/border","79A9EC","1C4A8B","info/300","info/700"],["status/info/solid","245EAF","5390E0","info/600","info/400"],["status/neutral/fg","414B5A","C9D1DA","grey/700","grey/300"],["status/neutral/bg","EDF0F4","2A323E","grey/100","grey/800"],["status/neutral/border","C9D1DA","586476","grey/300","grey/600"],["status/neutral/solid","586476","A1ACB9","grey/600","grey/400"],["status/brand/fg","0A6669","52C9CB","teal/700","teal/300"],["status/brand/bg","E6F7F7","052A2B","teal/50","teal/950"],["status/brand/border","52C9CB","0A6669","teal/300","teal/700"],["status/brand/solid","0B8084","22B3B6","teal/600","teal/400"],["status/policy/fg","523C93","A994E3","violet/700","violet/300"],["status/policy/bg","F1EDFB","2C2052","violet/50","violet/900"],["status/policy/border","A994E3","523C93","violet/300","violet/700"],["status/policy/solid","7357C2","A994E3","violet/500","violet/300"],["status/decision/fg","1F3D6E","B3C2DB","navy/600","navy/200"],["status/decision/bg","EEF2F8","0B1A35","navy/50","navy/900"],["status/decision/border","8399BF","17305A","navy/300","navy/700"],["status/decision/solid","2F4F82","8399BF","navy/500","navy/300"],["chart/series-1","0E9CA0","52C9CB","teal/500","teal/300"],["chart/series-2","2F4F82","8399BF","navy/500","navy/300"],["chart/series-3","7357C2","A994E3","violet/500","violet/300"],["chart/series-4","DB6E2C","F2AE7E","orange/500","orange/300"],["chart/series-5","C23F7E","E58DB8","magenta/500","magenta/300"],["chart/series-6","778395","A1ACB9","grey/500","grey/400"],["chart/grid","DFE4EA","414B5A","grey/200","grey/700"],["chart/axis","586476","A1ACB9","grey/600","grey/400"],["chart/target","AD6F00","F5BF55","warning/600","warning/300"]];
const PRIMS = [["navy",[["50","EEF2F8"],["100","D9E1EE"],["200","B3C2DB"],["300","8399BF"],["400","5571A0"],["500","2F4F82"],["600","1F3D6E"],["700","17305A"],["800","112447"],["900","0B1A35"],["950","071226"]]],["teal",[["50","E6F7F7"],["100","C2EDED"],["200","8EDDDE"],["300","52C9CB"],["400","22B3B6"],["500","0E9CA0"],["600","0B8084"],["700","0A6669"],["800","0A5052"],["900","083E40"],["950","052A2B"]]],["grey",[["50","F5F7FA"],["100","EDF0F4"],["200","DFE4EA"],["300","C9D1DA"],["400","A1ACB9"],["500","778395"],["600","586476"],["700","414B5A"],["800","2A323E"],["850","222932"],["900","1A2029"],["950","11151B"]]],["success",[["50","E7F6ED"],["100","C4E8D2"],["300","69C493"],["400","3DAF73"],["500","1E9A58"],["600","167E47"],["700","116338"],["800","0D4C2B"],["900","0A3A21"]]],["warning",[["50","FFF5E1"],["100","FFE6B3"],["300","F5BF55"],["400","EBA82B"],["500","D48A06"],["600","AD6F00"],["700","855500"],["800","664100"],["900","4A2F00"]]],["danger",[["50","FDECEC"],["100","F8CDCD"],["300","EC8888"],["400","E36060"],["500","D63A3A"],["600","B52A2A"],["700","8F2020"],["800","6E1919"],["900","4F1212"]]],["info",[["50","E8F1FC"],["100","C6DBF8"],["300","79A9EC"],["400","5390E0"],["500","2F72CF"],["600","245EAF"],["700","1C4A8B"],["800","16396B"],["900","0F2A50"]]],["violet",[["50","F1EDFB"],["100","DED5F5"],["300","A994E3"],["500","7357C2"],["700","523C93"],["900","2C2052"]]],["orange",[["300","F2AE7E"],["500","DB6E2C"],["700","A24E1A"]]],["magenta",[["300","E58DB8"],["500","C23F7E"],["700","8F2B5B"]]]];
const IDS = { textStyles: {}, effectStyles: {}, gridStyles: {}, board: {} };
// ---- text styles (upsert by name)
const tsExisting = await figma.getLocalTextStylesAsync();
for (const [name, style, sz, lh, ls, tc, desc] of TEXT_STYLES) {
  let s = tsExisting.find(x => x.name === name);
  if (!s) s = figma.createTextStyle();
  s.name = name;
  s.fontName = { family: 'Inter', style };
  s.fontSize = sz;
  s.lineHeight = { value: lh, unit: 'PIXELS' };
  s.letterSpacing = { value: ls, unit: 'PERCENT' };
  s.textCase = tc || 'ORIGINAL';
  s.description = 'Inter ' + style + ' ' + sz + '/' + lh + '. ' + desc;
  TS[name] = s; IDS.textStyles[name] = s.id;
}
// ---- effect styles (upsert by name); focus ring colour bound to Semantic variables (switches with mode)
const esExisting = await figma.getLocalEffectStylesAsync();
const sh = (y, blur, spread, a) => ({ type: 'DROP_SHADOW', color: { r: 11 / 255, g: 26 / 255, b: 53 / 255, a }, offset: { x: 0, y }, radius: blur, spread, visible: true, blendMode: 'NORMAL' });
const ring = (spread, v) => figma.variables.setBoundVariableForEffect({ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 0, y: 0 }, radius: 0, spread, visible: true, blendMode: 'NORMAL' }, 'color', vv(v));
const EFFECTS = [
  ['ds/Elevation/1', [sh(1, 2, 0, 0.06), sh(1, 3, 0, 0.08)], 'Cards at rest, table containers'],
  ['ds/Elevation/2', [sh(4, 8, -2, 0.10), sh(2, 4, -2, 0.06)], 'Menus, popovers, toasts, sticky headers'],
  ['ds/Elevation/3', [sh(16, 24, -4, 0.14), sh(6, 8, -4, 0.06)], 'Dialogs and drawers'],
  ['ds/Focus ring', [ring(2, 'surface/default'), ring(4, 'focus-ring')], '2px surface gap + 2px focus-ring (Semantic focus-ring). Apply to the focused control.'],
  ['ds/Focus ring/Danger', [ring(2, 'surface/default'), ring(4, 'status/danger/solid')], 'Focus ring on a control in error state'],
];
for (const [name, effects, desc] of EFFECTS) {
  let s = esExisting.find(x => x.name === name);
  if (!s) s = figma.createEffectStyle();
  s.name = name; s.effects = effects; s.description = desc;
  ES[name] = s; IDS.effectStyles[name] = s.id;
}
// ---- grid styles
try {
  const gsExisting = await figma.getLocalGridStylesAsync();
  const GRIDS = [
    ['ds/Grid/Desktop content 12-col', [{ pattern: 'COLUMNS', alignment: 'STRETCH', gutterSize: 24, count: 12, offset: 24, visible: true, color: { r: 0.05, g: 0.61, b: 0.63, a: 0.08 } }], 'Apply to the 1200x836 content frame at x240 y64 of a 1440x900 screen. 12 columns, 24 gutter, 24 margin (1152 content).'],
    ['ds/Grid/Mobile 4-col', [{ pattern: 'COLUMNS', alignment: 'STRETCH', gutterSize: 16, count: 4, offset: 16, visible: true, color: { r: 0.05, g: 0.61, b: 0.63, a: 0.08 } }], 'Apply to 390x844 mobile screens. 4 columns, 16 gutter, 16 margin.'],
    ['ds/Grid/Baseline 8', [{ pattern: 'GRID', sectionSize: 8, visible: false, color: { r: 0.9, g: 0.2, b: 0.2, a: 0.06 } }], '8px rhythm (hidden by default).'],
  ];
  for (const [name, grids, desc] of GRIDS) {
    let s = gsExisting.find(x => x.name === name);
    if (!s) s = figma.createGridStyle();
    s.name = name; s.layoutGrids = grids; s.description = desc; IDS.gridStyles[name] = s.id;
  }
} catch (e) { OUT.warnings.push('Grid styles skipped: ' + e.message); }

// ---- foundations board (documentation; rebuilt on every run)
for (const old of page.children.filter(c => c.name === 'DS Foundations — Board')) old.remove();
const BOARD = figma.createAutoLayout('VERTICAL'); BOARD.name = 'DS Foundations — Board'; page.appendChild(BOARD);
BOARD.x = 0; BOARD.y = 0; fill(BOARD, 'surface/page'); pad(BOARD, 64); gap(BOARD, 72); rad(BOARD, 'xl');
async function section(title, desc) {
  const s = AL('§ ' + title, 'VERTICAL', { gap: 20 });
  add(s, await T(title, 'ds/H1', 'text/primary'));
  if (desc) s.appendChild(await T(desc, 'ds/Body', 'text/secondary', { w: 1100 }));
  BOARD.appendChild(s); IDS.board[title] = s.id;
  return s;
}
const bullet = async (lines, w) => { const f = AL('Rules', 'VERTICAL', { gap: 6 }); for (const l of lines) f.appendChild(await T('• ' + l, 'ds/Body', 'text/primary', { w: w || 1100 })); return f; };
// header
const head = AL('Header', 'VERTICAL', { gap: 8 });
add(head, await T('Udigity Management System — Design Foundations', 'ds/Display'),
  await T('Phase 5 design system (P5-1, October 2026). Brand: deep navy, turquoise/teal, white. Character: professional, clean, calm, operational. Light is the default mode; dark previews set the Semantic collection to Dark on the frame. All component fills, strokes and text colours bind to Semantic variables; spacing and radii bind to Primitives.', 'ds/Body', 'text/secondary', { w: 1100 }),
  await T('Logo: the Udigity logo file has not been supplied. Use the component "Brand/Logo (placeholder — awaiting supplied file)" only. Never draw or invent the logo.', 'ds/Body Strong', 'status/warning/fg', { w: 1100 }));
BOARD.appendChild(head);

// 1 primitives
let s = await section('Colour — Primitives', 'Raw palette (collection "Primitives", hidden from pickers). Never bind components to primitives directly; use Semantic tokens.');
for (const [scale, steps] of PRIMS) {
  const row = AL('Ramp ' + scale, 'HORIZONTAL', { gap: 8, align: 'CENTER' });
  row.appendChild(await T(scale, 'ds/H4', 'text/primary', { w: 80 }));
  for (const [k, hex] of steps) {
    const cell = AL(scale + '/' + k, 'VERTICAL', { gap: 4 });
    const sw = RECT('swatch', 72, 48, null, { radius: 'md' }); sw.fills = [P('p/' + scale + '/' + k)]; stroke(sw, 'border/subtle');
    add(cell, sw, await T(k, 'ds/Label Small', 'text/primary'), await T('#' + hex, 'ds/Caption', 'text/muted'));
    row.appendChild(cell);
  }
  s.appendChild(row);
}
// 2 semantic light / dark
s = await section('Colour — Semantic tokens (Light | Dark)', 'Collection "Semantic", modes Light and Dark; each token aliases a primitive. The two panels below are the same token list rendered with the Light and Dark modes.');
const semRow = AL('Semantic panels', 'HORIZONTAL', { gap: 24 });
for (const [label, mode, idx] of [['Light', LIGHT, 1], ['Dark', DARK, 2]]) {
  const panel = AL('Semantic — ' + label, 'VERTICAL', { gap: 12, pad: 24, fill: 'surface/default', stroke: 'border/default', radius: 'xl' });
  panel.setExplicitVariableModeForCollection(semCol, mode);
  panel.appendChild(await T(label + ' mode', 'ds/H3'));
  const grid = AL('Tokens', 'HORIZONTAL', { gap: 8 }); grid.layoutWrap = 'WRAP'; grid.counterAxisSpacing = 8; size(grid, 560);
  for (const r of SEMROWS) {
    const it = AL(r[0], 'HORIZONTAL', { gap: 8, align: 'CENTER', w: 276 });
    const chip = RECT('chip', 28, 28, r[0], { radius: 'sm', stroke: 'border/default' });
    const tx = AL('t', 'VERTICAL', {});
    add(tx, await T(r[0], 'ds/Label Small', 'text/primary'), await T('#' + r[idx] + ' · ' + r[idx + 2], 'ds/Caption', 'text/muted'));
    add(it, chip, tx); grid.appendChild(it);
  }
  add(panel, grid); semRow.appendChild(panel);
}
s.appendChild(semRow);
// 3 typography
s = await section('Typography', 'Inter only (Regular, Medium, Semi Bold, Bold). Use text styles, never ad-hoc sizes. Numbers in tables, metrics and the timer use tabular figures in code (font-variant-numeric: tabular-nums).');
for (const [name, style, sz, lh] of TEXT_STYLES) {
  const row = AL(name, 'HORIZONTAL', { gap: 24, align: 'CENTER' });
  add(row, await T(name, 'ds/Label', 'text/primary', { w: 160 }), await T('Inter ' + style + ' · ' + sz + '/' + lh, 'ds/Caption', 'text/muted', { w: 180 }),
    await T(name.indexOf('Number') >= 0 ? '1,248 · 08:42:15' : 'Peak Fitness Gym — Member app', name, 'text/primary'));
  s.appendChild(row);
}
// 4 spacing
s = await section('Spacing', 'Primitives space/* (scope: gap and padding). Base unit 4; 8-point rhythm for layout. Typical: control padding 12–16, card padding 20–24, section gap 24–32, page padding 24.');
for (const sp of [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64]) {
  const row = AL('space/' + sp, 'HORIZONTAL', { gap: 16, align: 'CENTER' });
  const bar = RECT('bar', Math.max(sp, 1) * 4, 16, 'brand/accent', { radius: 'xs' });
  if (sp === 0) bar.opacity = 0.2;
  add(row, await T('space/' + sp, 'ds/Label', 'text/primary', { w: 120 }), await T(sp + 'px', 'ds/Caption', 'text/muted', { w: 60 }), bar);
  s.appendChild(row);
}
// 5 radius
s = await section('Radius', 'Primitives radius/*. Inputs and buttons md (6), cards xl (12), dialogs/drawers 2xl (16) on exposed corners, badges and chips full.');
const rrow = AL('Radius row', 'HORIZONTAL', { gap: 24 });
for (const [k, v] of [['none', 0], ['xs', 2], ['sm', 4], ['md', 6], ['lg', 8], ['xl', 12], ['2xl', 16], ['full', 999]]) {
  const c = AL('radius/' + k, 'VERTICAL', { gap: 8, align: 'CENTER' });
  add(c, RECT('shape', 72, 72, 'brand/accent-subtle', { radius: k, stroke: 'brand/accent' }), await T('radius/' + k, 'ds/Label Small'), await T(v + 'px', 'ds/Caption', 'text/muted'));
  rrow.appendChild(c);
}
s.appendChild(rrow);
// 6 elevation
s = await section('Elevation', 'Restrained shadows (navy-tinted). Prefer borders for structure; use elevation only for layering. In dark mode elevation is carried mainly by lighter surfaces (surface/raised).');
const erow = AL('Elevation row', 'HORIZONTAL', { gap: 32 });
for (const [n, d] of [['ds/Elevation/1', 'Cards, tables'], ['ds/Elevation/2', 'Menus, popovers, toasts'], ['ds/Elevation/3', 'Dialogs, drawers'], ['ds/Focus ring', 'Keyboard focus']]) {
  const c = AL(n, 'VERTICAL', { gap: 6, pad: 20, fill: 'surface/raised', radius: 'xl', w: 220, h: 120 });
  if (n === 'ds/Focus ring') { rad(c, 'md'); stroke(c, 'border/input'); }
  await c.setEffectStyleIdAsync(ES[n].id);
  add(c, await T(n, 'ds/Label'), await T(d, 'ds/Caption', 'text/muted'));
  erow.appendChild(c);
}
s.appendChild(erow);
// 7 grid and layout
s = await section('Grid and layout', 'Desktop 1440x900: left navigation 240 (navy), top bar 64, content frame 1200x836 at x240 y64 with 24 padding → 1152 content column on a 12-column grid (24 gutter). Mobile 390x844: header 56, bottom tab bar 64 (+ safe area), 4 columns, 16 gutter, 16 margin. Grid styles: ds/Grid/Desktop content 12-col, ds/Grid/Mobile 4-col.');
const gridRow = AL('Grid diagrams', 'HORIZONTAL', { gap: 48, align: 'MIN' });
const desk = FR('Desktop 1440 (50%)', 720, 450, { fill: 'surface/page', stroke: 'border/default', clip: true });
const side = RECT('Sidebar 240', 120, 450, 'surface/brand'); side.x = 0; side.y = 0; desk.appendChild(side);
const top = RECT('Top bar 64', 600, 32, 'surface/default', { stroke: 'border/default' }); top.x = 120; top.y = 0; desk.appendChild(top);
for (let i = 0; i < 12; i++) { const col = RECT('col ' + (i + 1), 37, 394, 'brand/accent', {}); col.opacity = 0.14; col.x = 120 + 12 + i * (37 + 12); col.y = 44; desk.appendChild(col); }
const mob = FR('Mobile 390 (50%)', 195, 422, { fill: 'surface/page', stroke: 'border/default', clip: true });
const mh = RECT('Header 56', 195, 28, 'surface/default', { stroke: 'border/default' }); mob.appendChild(mh);
for (let i = 0; i < 4; i++) { const col = RECT('col ' + (i + 1), 38.25, 334, 'brand/accent'); col.opacity = 0.14; col.x = 8 + i * (38.25 + 8); col.y = 40; mob.appendChild(col); }
const tb = RECT('Tab bar 64', 195, 32, 'surface/default', { stroke: 'border/default' }); tb.y = 390; mob.appendChild(tb);
add(gridRow, desk, mob, await bullet(['Content max width 1152 on desktop; cards align to grid columns (3 col = 270, 4 col = 368, 6 col = 564, 12 col = 1152).', 'Drawers 480 wide, right-aligned over scrim; dialogs 400 / 520 / 720 centred.', 'Tables span the content column; numeric columns right-aligned.', 'Mobile: one column of cards, 16 margin; primary action reachable at the bottom; no hover-only actions.', 'Breakpoints (code): mobile < 768, tablet 768–1279 (collapsible nav), desktop ≥ 1280.'], 520));
s.appendChild(gridRow);
return finish({ ids: IDS, boardId: BOARD.id, next: 'Run 02b-foundations-board.js to add icons, states, charts and contrast sections' });
