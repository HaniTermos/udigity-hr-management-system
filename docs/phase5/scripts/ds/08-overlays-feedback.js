// 08-overlays-feedback.js — Design-System Agent — Phase 5 (Udigity Management System)
// Overlays and feedback — Overlay/Scrim, Dialog and Drawer (content slots), Banner, Banner/ErrorSummary (list slot), Toast, State (empty/loading/error/session/conflict), Skeleton, Notice/Access (permission denied / hidden by policy / context-limited) — page 21 DS — Components (36:3)
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

// TITLE: Overlays and feedback — Overlay/Scrim, Dialog and Drawer (content slots), Banner, Banner/ErrorSummary (list slot), Toast, State (empty/loading/error/session/conflict), Skeleton, Notice/Access (permission denied / hidden by policy / context-limited) — page 21 DS — Components (36:3)
const CONT = await container('DS 08 — Overlays and feedback', 'Dialogs and drawers with content slots, banners, toasts, page/inline states, skeletons and access notices. Feedback always pairs an icon and text with the tone colour.');
const TONE = { Info: ['info', 'info'], Success: ['success', 'check-circle'], Warning: ['warning', 'alert-triangle'], Error: ['danger', 'alert-circle'] };
function closeBtn(name) { const b = I('IconButton', { Variant: 'Ghost', Size: 'Small', State: 'Default' }); setProp(b, 'Icon', C('Icon/x').id); b.name = name || 'Close'; return b; }
function btn(variant, label, name) { const b = I('Button', { Variant: variant, Size: 'Medium', State: 'Default' }, { text: { Label: label } }); b.name = name || label; return b; }
function topRule(n, top, bottom) { stroke(n, 'border/default'); n.strokeTopWeight = top ? 1 : 0; n.strokeBottomWeight = bottom ? 1 : 0; n.strokeLeftWeight = 0; n.strokeRightWeight = 0; }
await doc(CONT, 'Overlay/Scrim', 'Backdrop behind dialogs and drawers (overlay/scrim: navy 56% light, black 64% dark).', async () => {
  return VSET('Overlay/Scrim', { Size: ['Desktop', 'Mobile'] }, async p => { const c = COMP('scrim', null, { fill: 'overlay/scrim' }); if (p.Size === 'Desktop') c.resize(1440, 900); else c.resize(390, 844); return c; });
});
await doc(CONT, 'Dialog', 'Centred dialog, 520 default (resize to 400 / 720). Header (title, description, close), "Content" slot, footer actions (nested Buttons exposed — switch the primary to Destructive for irreversible actions). ds/Elevation/3.', async () => {
  const c = COMP('Dialog', 'VERTICAL', { gap: 16, pad: 24, fill: 'surface/raised', radius: '2xl' });
  c.resize(520, 240); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
  await c.setEffectStyleIdAsync(ES['ds/Elevation/3'].id);
  const head = AL('Header', 'HORIZONTAL', { gap: 12, align: 'MIN' });
  const tx = AL('Titles', 'VERTICAL', { gap: 4 });
  add(tx, await T('Dialog title', 'ds/H2', 'text/primary', { name: 'Title', w: 400 }), await T('Short description of what happens next.', 'ds/Body', 'text/secondary', { name: 'Description', w: 400 }));
  const x = closeBtn(); add(head, tx, x); grow(tx); expose(x);
  for (const t of tx.children) fillW(t);
  c.appendChild(head); fillW(head);
  SLOT(c, 'Content', 'Dialog content');
  const foot = AL('Footer', 'HORIZONTAL', { gap: 8, align: 'CENTER', justify: 'MAX' });
  const b1 = btn('Secondary', 'Cancel', 'Secondary action'), b2 = btn('Primary', 'Confirm', 'Primary action');
  add(foot, b1, b2); c.appendChild(foot); fillW(foot); expose(b1); expose(b2);
  link(c, 'Title', 'TEXT', 'Dialog title', 'Title', 'characters');
  link(c, 'Description', 'TEXT', 'Short description of what happens next.', 'Description', 'characters');
  link(c, 'Show description', 'BOOLEAN', true, 'Description', 'visible');
  link(c, 'Show footer', 'BOOLEAN', true, 'Footer', 'visible');
  link(c, 'Show close', 'BOOLEAN', true, 'Close', 'visible');
  c.description = 'Dialog with native content slot (K-1).';
  return c;
});
await doc(CONT, 'Drawer', 'Right drawer 480x900 over Overlay/Scrim (x 960). Header (title, subtitle, close), "Content" slot (scrolls), "Footer" slot (defaults to Cancel + Save). ds/Elevation/3.', async () => {
  const c = COMP('Drawer', 'VERTICAL', { fill: 'surface/raised', clip: true });
  c.resize(480, 900); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
  await c.setEffectStyleIdAsync(ES['ds/Elevation/3'].id);
  const head = AL('Header', 'HORIZONTAL', { gap: 12, pad: [20, 24], align: 'MIN' }); topRule(head, false, true);
  const tx = AL('Titles', 'VERTICAL', { gap: 4 });
  add(tx, await T('Schedule follow-up', 'ds/H2', 'text/primary', { name: 'Title' }), await T('Olive & Thyme Café', 'ds/Body Small', 'text/secondary', { name: 'Subtitle' }));
  const x = closeBtn(); add(head, tx, x); grow(tx); expose(x);
  c.appendChild(head); fillW(head);
  const body = SLOT(c, 'Content', 'Drawer content'); pad(body.slot, 24); grow(body.slot);
  const foot = SLOT(c, 'Footer', 'Footer actions');
  pad(foot.slot, 16, 24); foot.slot.layoutMode = 'HORIZONTAL'; foot.slot.primaryAxisAlignItems = 'MAX'; topRule(foot.slot, true, false);
  if (foot.mode === 'slot') { foot.ph.remove(); const b1 = btn('Secondary', 'Cancel'), b2 = btn('Primary', 'Save'); add(foot.slot, b1, b2); }
  link(c, 'Title', 'TEXT', 'Drawer title', 'Title', 'characters');
  link(c, 'Subtitle', 'TEXT', 'Subtitle', 'Subtitle', 'characters');
  link(c, 'Show subtitle', 'BOOLEAN', true, 'Subtitle', 'visible');
  c.description = 'Drawer with Content and Footer slots.';
  return c;
});
await doc(CONT, 'Banner', 'Page/section message. Tone by icon + title + colour. Default (720, resizable, optional action + close) and Inline (360, inside cards and forms).', async () => {
  const set = await VSET('Banner', { Tone: Object.keys(TONE), Size: ['Default', 'Inline'] }, async p => {
    const [t, ic] = TONE[p.Tone], inl = p.Size === 'Inline';
    const c = COMP('ban', 'HORIZONTAL', { gap: inl ? 8 : 12, pad: inl ? [10, 12] : [12, 16], align: 'MIN', fill: `status/${t}/bg`, stroke: `status/${t}/border`, radius: 'md' });
    c.resize(inl ? 360 : 720, 48); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
    const i = ICON(ic, 20, `status/${t}/fg`); i.name = 'Icon';
    const tx = AL('Text', 'VERTICAL', { gap: 2 });
    const a = await T(p.Tone === 'Error' ? 'Could not save the business' : p.Tone + ' title', 'ds/Label', `status/${t}/fg`, { name: 'Title', w: 200 });
    const b = await T('Explain what happened and what to do next.', 'ds/Body Small', 'text/primary', { name: 'Body', w: 200 });
    add(tx, a, b); add(c, i, tx); grow(tx); fillW(a); fillW(b);
    if (!inl) { const l = I('Link', { Size: 'Small', State: 'Default' }, { text: { Label: 'Action' } }); l.name = 'Action'; const x = closeBtn(); add(c, l, x); expose(l); }
    return c;
  }, { colKey: 'Size' });
  link(set, 'Title', 'TEXT', 'Banner title', 'Title', 'characters');
  link(set, 'Body', 'TEXT', 'Explain what happened and what to do next.', 'Body', 'characters');
  link(set, 'Show title', 'BOOLEAN', true, 'Title', 'visible');
  link(set, 'Show action', 'BOOLEAN', true, 'Action', 'visible');
  link(set, 'Show close', 'BOOLEAN', true, 'Close', 'visible');
  return set;
});
await doc(CONT, 'Banner/ErrorSummary', 'Error summary at the top of a form with an "Errors" list slot (defaults to linked items that jump to each field).', async () => {
  const c = COMP('Banner/ErrorSummary', 'VERTICAL', { gap: 8, pad: [12, 16], fill: 'status/danger/bg', stroke: 'status/danger/border', radius: 'md' });
  c.resize(720, 100); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
  const head = AL('Head', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
  add(head, ICON('alert-circle', 20, 'status/danger/fg'), await T('Fix 3 problems before saving', 'ds/Label', 'status/danger/fg', { name: 'Title' }));
  c.appendChild(head);
  const list = SLOT(c, 'Errors', 'Error list');
  if (list.mode === 'slot') { list.ph.remove(); pad(list.slot, 0, 0, 0, 28); list.slot.itemSpacing = 4; for (const l of ['Phone — enter a number in the format 70 000 000', 'Category — select a category', 'Instagram followers — enter a value or tick Unknown']) add(list.slot, I('Link', { Size: 'Small', State: 'Default' }, { text: { Label: l } })); }
  link(c, 'Title', 'TEXT', 'Fix 3 problems before saving', 'Title', 'characters');
  return c;
});
await doc(CONT, 'Toast', 'Transient confirmation (bottom-right desktop, above tab bar mobile). Auto-dismiss except Error. ds/Elevation/2.', async () => {
  const set = await VSET('Toast', { Tone: Object.keys(TONE) }, async p => {
    const [t, ic] = TONE[p.Tone];
    const c = COMP('toast', 'HORIZONTAL', { gap: 12, pad: [12, 16], align: 'MIN', fill: 'surface/raised', stroke: 'border/default', radius: 'lg' });
    c.resize(360, 56); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
    await c.setEffectStyleIdAsync(ES['ds/Elevation/2'].id);
    const tx = AL('Text', 'VERTICAL', { gap: 2 });
    const a = await T(p.Tone === 'Success' ? 'Attempt saved' : p.Tone + ' message', 'ds/Label', 'text/primary', { name: 'Title', w: 200 });
    const b = await T('Olive & Thyme Café moved to Follow-ups.', 'ds/Body Small', 'text/secondary', { name: 'Body', w: 200 });
    add(tx, a, b); const x = closeBtn(); add(c, ICON(ic, 20, `status/${t}/fg`), tx, x); grow(tx); fillW(a); fillW(b);
    return c;
  });
  link(set, 'Title', 'TEXT', 'Toast title', 'Title', 'characters');
  link(set, 'Body', 'TEXT', 'Toast body', 'Body', 'characters');
  link(set, 'Show body', 'BOOLEAN', true, 'Body', 'visible');
  return set;
});
const ST = {
  'Empty': ['folder', 'neutral', 'No businesses yet', 'Businesses you add or are assigned will appear here.', 'Add business'],
  'No results': ['search', 'neutral', 'No matches', 'Try a different name, phone or handle, or clear filters.', 'Clear filters'],
  'Loading': [null, 'neutral', 'Loading businesses…', '', ''],
  'Error': ['alert-circle', 'danger', 'Something went wrong', 'We could not load this list. Your data is safe — try again.', 'Try again'],
  'Session expired': ['lock', 'warning', 'Session expired', 'Sign in again to continue. Unsaved changes on this page are kept.', 'Sign in'],
  'Save conflict': ['refresh', 'warning', 'Someone else changed this record', 'Review the latest version, then re-apply your changes.', 'Review changes'],
};
await doc(CONT, 'State', 'Page and inline states. Page (480, centred in the content area) and Inline (360, inside cards/lists — EmptyState/Inline requests map here). Loading uses skeleton bars, not spinners, for lists. Standard copy is built in per type; override the Title/Body text layers directly when a screen needs specific wording.', async () => {
  const set = await VSET('State', { Type: Object.keys(ST), Size: ['Page', 'Inline'] }, async p => {
    const [ic, t, title, body, action] = ST[p.Type], page_ = p.Size === 'Page';
    if (p.Type === 'Loading') {
      const c = COMP('st', 'VERTICAL', { gap: 10, pad: page_ ? 32 : 16, align: page_ ? 'CENTER' : 'MIN' });
      c.resize(page_ ? 480 : 360, 120); c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO';
      for (const w of page_ ? [416, 360, 300] : [296, 240]) c.appendChild(RECT('Skeleton', w, 12, 'surface/skeleton', { radius: 'sm' }));
      c.appendChild(await T(title, 'ds/Caption', 'text/muted', { name: 'Title' }));
      return c;
    }
    const c = COMP('st', page_ ? 'VERTICAL' : 'HORIZONTAL', { gap: page_ ? 12 : 12, pad: page_ ? 32 : 16, align: page_ ? 'CENTER' : 'MIN', fill: page_ ? null : 'surface/subtle', radius: page_ ? null : 'lg' });
    c.resize(page_ ? 480 : 360, 120); if (page_) { c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO'; } else { c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO'; }
    const circ = AL('Icon circle', 'HORIZONTAL', { justify: 'CENTER', align: 'CENTER', radius: 'full', fill: `status/${t}/bg`, w: page_ ? 48 : 36, h: page_ ? 48 : 36 });
    circ.appendChild(ICON(ic, page_ ? 24 : 20, `status/${t}/fg`));
    const tx = AL('Text', 'VERTICAL', { gap: 4, align: page_ ? 'CENTER' : 'MIN' });
    add(tx, await T(title, page_ ? 'ds/H3' : 'ds/Label', 'text/primary', { name: 'Title', w: page_ ? 416 : 260, align: page_ ? 'CENTER' : 'LEFT' }), await T(body, 'ds/Body Small', 'text/secondary', { name: 'Body', w: page_ ? 416 : 260, align: page_ ? 'CENTER' : 'LEFT' }));
    add(c, circ, tx); if (!page_) grow(tx);
    const act = page_ ? I('Button', { Variant: p.Type === 'Empty' ? 'Primary' : 'Secondary', Size: 'Medium', State: 'Default' }, { text: { Label: action } }) : I('Link', { Size: 'Small', State: 'Default' }, { text: { Label: action } });
    act.name = 'Action'; if (page_) c.appendChild(act); else tx.appendChild(act);
    return c;
  }, { colKey: 'Size' });
  link(set, 'Show action', 'BOOLEAN', true, 'Action', 'visible');
  return set;
});
await doc(CONT, 'Skeleton', 'Loading placeholders (surface/skeleton). Compose lists and cards from these while data loads.', async () => {
  return VSET('Skeleton', { Type: ['Text line', 'Avatar', 'Table row', 'Card'] }, async p => {
    if (p.Type === 'Text line') { const c = COMP('sk', null, { fill: 'surface/skeleton', radius: 'sm' }); c.resize(240, 12); return c; }
    if (p.Type === 'Avatar') { const c = COMP('sk', null, { fill: 'surface/skeleton', radius: 'full' }); c.resize(32, 32); return c; }
    if (p.Type === 'Table row') {
      const c = COMP('sk', 'HORIZONTAL', { gap: 24, pad: [20, 12], align: 'CENTER', fill: 'surface/default' }); topRule(c, false, true);
      for (const w of [16, 280, 160, 96, 180, 80]) c.appendChild(RECT('bar', w, 12, 'surface/skeleton', { radius: 'sm' }));
      return c;
    }
    const c = COMP('sk', 'VERTICAL', { gap: 10, pad: 20, fill: 'surface/default', stroke: 'border/default', radius: 'xl' });
    for (const w of [120, 200, 160]) c.appendChild(RECT('bar', w, w === 200 ? 24 : 12, 'surface/skeleton', { radius: 'sm' }));
    return c;
  });
});
const AC = {
  'Permission denied': ['lock', 'You do not have access to this page', 'Your role cannot open this screen. If you need access, ask the Owner/Admin.', 'Go to My Day'],
  'Hidden by policy': ['eye-off', 'This record is not visible to you', 'It exists, but the visibility policy hides it from your role. No details are shown.', 'Back to list'],
  'Context-limited': ['shield', 'Limited business context', 'You see only the business details needed for this deal or project (DEC-005 pending).', 'Back to deal'],
};
await doc(CONT, 'Notice/Access', 'Permission and visibility notices (SCR-SHR-011 permission denied, SCR-SHR-012 hidden by policy, context-limited view). Never reveal hidden data; context-limited depends on DEC-005 — keep the policy label visible.', async () => {
  const set = await VSET('Notice/Access', { Type: Object.keys(AC), Size: ['Page', 'Inline'] }, async p => {
    const [ic, title, body, action] = AC[p.Type], pg = p.Size === 'Page';
    const c = COMP('acc', pg ? 'VERTICAL' : 'HORIZONTAL', { gap: 12, pad: pg ? 32 : [10, 12], align: pg ? 'CENTER' : 'MIN', fill: pg ? null : 'status/neutral/bg', stroke: pg ? null : 'status/neutral/border', radius: pg ? null : 'md' });
    c.resize(pg ? 480 : 480, 64); if (pg) { c.counterAxisSizingMode = 'FIXED'; c.primaryAxisSizingMode = 'AUTO'; } else { c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO'; }
    const circ = AL('Icon circle', 'HORIZONTAL', { justify: 'CENTER', align: 'CENTER', radius: 'full', fill: pg ? 'status/neutral/bg' : null, w: pg ? 48 : 20, h: pg ? 48 : 20 });
    circ.appendChild(ICON(ic, pg ? 24 : 20, 'status/neutral/fg'));
    const tx = AL('Text', 'VERTICAL', { gap: 4, align: pg ? 'CENTER' : 'MIN' });
    add(tx, await T(title, pg ? 'ds/H3' : 'ds/Label', 'text/primary', { name: 'Title', w: pg ? 416 : 420, align: pg ? 'CENTER' : 'LEFT' }), await T(body, 'ds/Body Small', 'text/secondary', { name: 'Body', w: pg ? 416 : 420, align: pg ? 'CENTER' : 'LEFT' }));
    add(c, circ, tx); if (!pg) grow(tx);
    if (pg) { const b = I('Button', { Variant: 'Secondary', Size: 'Medium', State: 'Default' }, { text: { Label: action } }); b.name = 'Action'; c.appendChild(b); }
    if (p.Type === 'Context-limited') { const n = I('Notice/Policy pending', { Size: 'Chip', Tone: 'Policy pending' }, { text: { DEC: 'DEC-005' } }); n.name = 'Policy'; (pg ? c : tx).appendChild(n); }
    return c;
  }, { colKey: 'Size' });
  return set;
});
await preview(CONT, 'Feedback', [
  async () => I('Banner', { Tone: 'Warning', Size: 'Inline' }),
  async () => I('Toast', { Tone: 'Success' }),
  async () => I('State', { Type: 'Empty', Size: 'Inline' }),
  async () => I('Notice/Access', { Type: 'Hidden by policy', Size: 'Inline' }),
]);
return finish();
