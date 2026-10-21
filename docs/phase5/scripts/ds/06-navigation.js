// 06-navigation.js — Design-System Agent — Phase 5 (Udigity Management System)
// Navigation — Nav/Item, Nav/SectionLabel, Nav/Sidebar (per role), Nav/TopBar, Breadcrumb, Tabs/Item, Tabs, Shell/Mobile/Header, Shell/Mobile/Tab, Shell/Mobile/TabBar (role x active tab), Shell/Desktop, Shell/Mobile — page 21 DS — Components (36:3)
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

// TITLE: Navigation — Nav/Item, Nav/SectionLabel, Nav/Sidebar (per role), Nav/TopBar, Breadcrumb, Tabs/Item, Tabs, Shell/Mobile/Header, Shell/Mobile/Tab, Shell/Mobile/TabBar (role x active tab), Shell/Desktop, Shell/Mobile — page 21 DS — Components (36:3)
const CONT = await container('DS 06 — Navigation and shells', 'Desktop left navigation (240, navy) + top bar (64); mobile header (56) + bottom tab bar (64). Role variants follow the approved sitemap (P4-NAV-1). Navigation is not authorization: hidden items are a convenience only.');
const FOCUS = ES['ds/Focus ring'];
// ---- Nav/Item
await doc(CONT, 'Nav/Item', 'Sidebar item on navy. Active = surface/brand-active + teal indicator bar + white text (not colour-only: indicator shape + weight). Density Compact (32) is used by the Owner sidebar, which has 16 items. Policy-dependent items keep their label, e.g. "Categories [DEC-015]".', async () => {
  const set = await VSET('Nav/Item', { Density: ['Default', 'Compact'], State: ['Default', 'Hover', 'Active', 'Disabled'] }, async p => {
    const act = p.State === 'Active', h = p.Density === 'Compact' ? 32 : 36;
    const c = COMP('nav', 'HORIZONTAL', { gap: 10, pad: [0, 12], align: 'CENTER', radius: 'md', fill: act ? 'surface/brand-active' : p.State === 'Hover' ? 'surface/brand-hover' : null });
    c.resize(216, h); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    const ic = ICON('home', 20, act ? 'icon/on-brand-active' : 'icon/on-brand'); ic.name = 'Icon';
    const t = await T('Dashboard', 'ds/Label', act ? 'text/on-brand' : 'text/on-brand-muted', { name: 'Label', w: 120, truncate: 1 });
    const b = I('Badge/Count', { Tone: 'On brand' }); b.name = 'Badge';
    add(c, ic, t, b); grow(t); expose(b);
    if (act) { const ind = RECT('Indicator', 3, h - 12, 'brand/accent', { radius: 'full' }); c.appendChild(ind); ind.layoutPositioning = 'ABSOLUTE'; ind.x = 0; ind.y = 6; }
    if (p.State === 'Disabled') c.opacity = 0.5;
    return c;
  }, { colKey: 'State' });
  link(set, 'Label', 'TEXT', 'Dashboard', 'Label', 'characters');
  link(set, 'Icon', 'INSTANCE_SWAP', C('Icon/home').id, 'Icon', 'mainComponent');
  link(set, 'Show badge', 'BOOLEAN', false, 'Badge', 'visible');
  return set;
});
await doc(CONT, 'Nav/SectionLabel', 'Section heading inside the sidebar (OVERVIEW, PEOPLE, …).', async () => {
  const c = COMP('Nav/SectionLabel', 'HORIZONTAL', { pad: [12, 12, 4, 12], align: 'CENTER' });
  c.resize(216, 32); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO';
  c.appendChild(await T('Section', 'ds/Overline', 'text/on-brand-muted', { name: 'Label' }));
  link(c, 'Label', 'TEXT', 'SECTION', 'Label', 'characters');
  return c;
});
// ---- Nav/Sidebar per role
const ROLES = {
  Owner: { compact: true, nav: [['OVERVIEW'], ['Dashboard', 'home', 1], ['Attendance', 'check-circle'], ['PEOPLE'], ['Employees', 'users'], ['Targets & Work Lists', 'target'], ['BUSINESSES'], ['Businesses', 'building'], ['Correction Requests', 'edit'], ['Categories', 'list'], ['CALLING'], ['Calling Assignments', 'phone'], ['Follow-ups & Calendar', 'calendar'], ['DELIVERY'], ['Deals & Meetings', 'briefcase'], ['Projects', 'board'], ['ADMIN'], ['Reports & Exports', 'download'], ['Audit Log', 'file-text'], ['Delivery Monitor', 'chart'], ['Settings', 'settings']], bottom: [['My Day (check in)', 'clock'], ['My Profile', 'user']] },
  'Data Entry': { nav: [['MY WORK'], ['My Day', 'clock', 1], ['My Attendance', 'check-circle'], ['BUSINESSES'], ['Businesses', 'building'], ['Add Business', 'plus'], ['Correction Requests', 'edit'], ['Categories [DEC-015]', 'list']], bottom: [['My Profile', 'user']] },
  'Call Center': { nav: [['MY WORK'], ['My Day', 'clock', 1], ['My Attendance', 'check-circle'], ['CALLING'], ['Calling Queue', 'phone', 0, '7'], ['Follow-ups & Calendar', 'calendar'], ['Opportunities & Handoffs', 'briefcase'], ['Do-not-call List', 'ban']], bottom: [['My Profile', 'user']] },
  Developer: { nav: [['MY WORK'], ['My Day', 'clock', 1], ['My Attendance', 'check-circle'], ['DELIVERY'], ['Deals', 'briefcase'], ['Meetings & Calendar', 'calendar'], ['Projects', 'board']], bottom: [['My Profile', 'user']] },
};
async function navEntry(e, compact) {
  if (e.length === 1) return I('Nav/SectionLabel', null, { text: { Label: e[0] } });
  const it = I('Nav/Item', { Density: compact ? 'Compact' : 'Default', State: e[2] ? 'Active' : 'Default' }, { text: { Label: e[0] } });
  it.name = 'Nav/Item · ' + e[0];
  setProp(it, 'Icon', C('Icon/' + e[1]).id);
  if (e[3]) { setProp(it, 'Show badge', true); const b = it.findAllWithCriteria({ types: ['INSTANCE'] }).find(n => n.name === 'Badge'); if (b) setProp(b, 'Count', e[3]); }
  return it;
}
await doc(CONT, 'Nav/Sidebar', 'Role sidebars (240x900). The home item is active by default; to mark another screen active set that nested Nav/Item State=Active and the home item State=Default. The nav list scrolls (clipped) above the fixed bottom block.', async () => {
  return VSET('Nav/Sidebar', { Role: Object.keys(ROLES) }, async p => {
    const R = ROLES[p.Role];
    const c = COMP('sb', 'VERTICAL', { fill: 'surface/brand', clip: true });
    c.resize(240, 900); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    const head = AL('Header', 'HORIZONTAL', { pad: [16, 20], align: 'CENTER' });
    head.appendChild(I('Brand/Logo (placeholder — awaiting supplied file)', { Size: 'Small', Surface: 'On brand' }));
    const nav = AL('Nav list', 'VERTICAL', { gap: 2, pad: [4, 12], clip: true });
    for (const e of R.nav) nav.appendChild(await navEntry(e, R.compact));
    const bot = AL('Bottom', 'VERTICAL', { gap: 2, pad: [12, 12, 16, 12] });
    stroke(bot, 'border/brand'); bot.strokeTopWeight = 1; bot.strokeBottomWeight = 0; bot.strokeLeftWeight = 0; bot.strokeRightWeight = 0;
    for (const e of R.bottom) bot.appendChild(await navEntry(e, R.compact));
    add(c, head, nav, bot); fillW(head); fillW(nav); grow(nav); fillW(bot);
    return c;
  });
});
// ---- Nav/TopBar
await doc(CONT, 'Nav/TopBar', 'Desktop top bar (1200x64): global search (scope differs per role — Call Center sees assigned businesses only), attendance chip, notifications, user menu. Nested Search, Attendance badge and Avatar are exposed instances.', async () => {
  const c = COMP('Nav/TopBar', 'HORIZONTAL', { gap: 16, pad: [0, 24], align: 'CENTER', fill: 'surface/default' });
  c.resize(1200, 64); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
  stroke(c, 'border/default'); c.strokeTopWeight = 0; c.strokeBottomWeight = 1; c.strokeLeftWeight = 0; c.strokeRightWeight = 0;
  const s = I('Input/Search', { Size: 'Medium', State: 'Default' }); s.name = 'Search'; s.resize(360, 40);
  const sp = AL('Spacer', 'HORIZONTAL', {});
  const att = I('Badge/Status', { Tone: 'Success', Size: 'Large' }, { text: { Label: 'Checked in · 08:42' } }); att.name = 'Attendance';
  const bell = I('IconButton', { Variant: 'Ghost', Size: 'Medium', State: 'Default' }); bell.name = 'Notifications'; setProp(bell, 'Icon', C('Icon/bell').id); setProp(bell, 'Show dot', true);
  const user = AL('User', 'HORIZONTAL', { gap: 10, align: 'CENTER' });
  const av = I('Avatar', { Size: 'Medium', Tone: 'Brand' }, { text: { Initials: 'RH' } }); av.name = 'Avatar';
  const tx = AL('Identity', 'VERTICAL', {});
  add(tx, await T('Rana Haddad', 'ds/Label', 'text/primary', { name: 'Name' }), await T('Owner/Admin', 'ds/Caption', 'text/muted', { name: 'Role' }));
  add(user, av, tx, ICON('chevron-down', 16, 'icon/default'));
  const dv = I('Divider', { Orientation: 'Vertical' });
  add(c, s, sp, att, bell, dv, user); grow(sp);
  for (const n of [s, att, av, bell]) expose(n);
  link(c, 'Name', 'TEXT', 'Rana Haddad', 'Name', 'characters');
  link(c, 'Role', 'TEXT', 'Owner/Admin', 'Role', 'characters');
  link(c, 'Show attendance', 'BOOLEAN', true, 'Attendance', 'visible');
  link(c, 'Show search', 'BOOLEAN', true, 'Search', 'visible');
  return c;
});
// ---- Breadcrumb
await doc(CONT, 'Breadcrumb', 'Up to three levels; the current page is plain text.', async () => {
  const c = COMP('Breadcrumb', 'HORIZONTAL', { gap: 6, align: 'CENTER' });
  add(c, await T('Businesses', 'ds/Body Small', 'text/link', { name: 'Level 1' }), (() => { const i = ICON('chevron-right', 14, 'icon/muted'); i.name = 'Sep 1'; return i; })(),
    await T('Glow Beauty Salon', 'ds/Body Small', 'text/link', { name: 'Level 2' }), (() => { const i = ICON('chevron-right', 14, 'icon/muted'); i.name = 'Sep 2'; return i; })(),
    await T('Edit', 'ds/Body Small', 'text/secondary', { name: 'Current' }));
  link(c, 'Level 1', 'TEXT', 'Businesses', 'Level 1', 'characters');
  link(c, 'Level 2', 'TEXT', 'Glow Beauty Salon', 'Level 2', 'characters');
  link(c, 'Current', 'TEXT', 'Edit', 'Current', 'characters');
  link(c, 'Show level 2', 'BOOLEAN', true, ['Level 2', 'Sep 2'], 'visible');
  return c;
});
// ---- Tabs/Item and Tabs
await doc(CONT, 'Tabs/Item', 'Tab. Underline style for page sections; Segmented style for compact view switches (SegmentedControl requests map here). Active is marked by indicator/raised surface and weight, not colour only.', async () => {
  const set = await VSET('Tabs/Item', { Style: ['Underline', 'Segmented'], State: ['Default', 'Hover', 'Active', 'Disabled'] }, async p => {
    const act = p.State === 'Active', dis = p.State === 'Disabled', seg = p.Style === 'Segmented';
    const h = seg ? 32 : 40;
    const c = COMP('tab', 'HORIZONTAL', { gap: 6, pad: [0, seg ? 12 : 4], align: 'CENTER', justify: 'CENTER', radius: seg ? 'md' : null, fill: seg ? (act ? 'surface/default' : p.State === 'Hover' ? 'surface/hover' : null) : null });
    c.resize(80, h); c.primaryAxisSizingMode = 'AUTO'; c.counterAxisSizingMode = 'FIXED';
    const b = I('Badge/Count', { Tone: act ? 'Brand' : 'Neutral' }); b.name = 'Count badge';
    add(c, await T('Tab', act ? 'ds/Label' : 'ds/Body', dis ? 'text/disabled' : act ? 'text/primary' : 'text/secondary', { name: 'Label' }), b); expose(b);
    if (seg && act) await c.setEffectStyleIdAsync(ES['ds/Elevation/1'].id);
    if (!seg && act) { const ind = RECT('Indicator', Math.max(c.width, 8), 2, 'brand/accent'); c.appendChild(ind); ind.layoutPositioning = 'ABSOLUTE'; ind.x = 0; ind.y = h - 2; ind.constraints = { horizontal: 'STRETCH', vertical: 'MAX' }; }
    return c;
  }, { colKey: 'State' });
  link(set, 'Label', 'TEXT', 'Tab', 'Label', 'characters');
  link(set, 'Show count', 'BOOLEAN', false, 'Count badge', 'visible');
  return set;
});
await doc(CONT, 'Tabs', 'Tab bar with an active-tab variant property (Active = 1…4). Override nested labels; hide unused items.', async () => {
  const LABELS = ['Details', 'Activity', 'Contacts', 'History'];
  return VSET('Tabs', { Style: ['Underline', 'Segmented'], Active: ['1', '2', '3', '4'] }, async p => {
    const seg = p.Style === 'Segmented';
    const c = COMP('tabs', 'HORIZONTAL', seg ? { gap: 4, pad: 4, fill: 'surface/sunken', radius: 'lg' } : { gap: 24 });
    if (!seg) { stroke(c, 'border/default'); c.strokeTopWeight = 0; c.strokeBottomWeight = 1; c.strokeLeftWeight = 0; c.strokeRightWeight = 0; }
    LABELS.forEach((l, i) => { const t = I('Tabs/Item', { Style: p.Style, State: String(i + 1) === p.Active ? 'Active' : 'Default' }, { text: { Label: l } }); t.name = 'Tab ' + (i + 1); c.appendChild(t); expose(t); });
    return c;
  });
});
// ---- Mobile
await doc(CONT, 'Shell/Mobile/Header', 'Mobile header (390x56): optional back, title + subtitle, avatar.', async () => {
  const set = await VSET('Shell/Mobile/Header', { Back: ['False', 'True'] }, async p => {
    const c = COMP('mh', 'HORIZONTAL', { gap: 8, pad: [0, 16], align: 'CENTER', fill: 'surface/default' });
    c.resize(390, 56); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    stroke(c, 'border/default'); c.strokeTopWeight = 0; c.strokeBottomWeight = 1; c.strokeLeftWeight = 0; c.strokeRightWeight = 0;
    if (p.Back === 'True') { const b = I('IconButton', { Variant: 'Ghost', Size: 'Medium', State: 'Default' }); setProp(b, 'Icon', C('Icon/chevron-left').id); b.name = 'Back'; c.appendChild(b); }
    const tx = AL('Titles', 'VERTICAL', {});
    add(tx, await T('My Day', 'ds/H3', 'text/primary', { name: 'Title' }), await T('Tue 20 Oct 2026', 'ds/Caption', 'text/muted', { name: 'Subtitle' }));
    const av = I('Avatar', { Size: 'Medium', Tone: 'Brand' }, { text: { Initials: 'MK' } }); av.name = 'Avatar';
    add(c, tx, av); grow(tx); expose(av);
    return c;
  });
  link(set, 'Title', 'TEXT', 'My Day', 'Title', 'characters');
  link(set, 'Subtitle', 'TEXT', 'Tue 20 Oct 2026', 'Subtitle', 'characters');
  link(set, 'Show subtitle', 'BOOLEAN', true, 'Subtitle', 'visible');
  return set;
});
await doc(CONT, 'Shell/Mobile/Tab', 'Bottom tab. Active = teal icon + label + top indicator.', async () => {
  const set = await VSET('Shell/Mobile/Tab', { State: ['Default', 'Active'] }, async p => {
    const act = p.State === 'Active';
    const c = COMP('mt', 'VERTICAL', { gap: 2, align: 'CENTER', justify: 'CENTER' });
    c.resize(96, 56); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    const ic = ICON('clock', 24, act ? 'icon/accent' : 'icon/muted'); ic.name = 'Icon';
    add(c, ic, await T('My Day', 'ds/Label Small', act ? 'status/brand/fg' : 'text/muted', { name: 'Label' }));
    if (act) { const ind = RECT('Indicator', 32, 3, 'brand/accent', { radius: 'full' }); c.appendChild(ind); ind.layoutPositioning = 'ABSOLUTE'; ind.x = 32; ind.y = 0; ind.constraints = { horizontal: 'CENTER', vertical: 'MIN' }; }
    return c;
  });
  link(set, 'Label', 'TEXT', 'My Day', 'Label', 'characters');
  link(set, 'Icon', 'INSTANCE_SWAP', C('Icon/clock').id, 'Icon', 'mainComponent');
  return set;
});
const TABS = { Owner: [['Today', 'home'], ['My Day', 'clock'], ['Alerts', 'bell'], ['More', 'menu']], 'Data Entry': [['My Day', 'clock'], ['Businesses', 'building'], ['Alerts', 'bell'], ['More', 'menu']], 'Call Center': [['My Day', 'clock'], ['Queue', 'phone'], ['Follow-ups', 'calendar'], ['More', 'menu']], Developer: [['My Day', 'clock'], ['Tasks', 'board'], ['Meetings', 'calendar'], ['More', 'menu']] };
await doc(CONT, 'Shell/Mobile/TabBar', 'Bottom tab bar (390x64) with Role and Active (1–4) variant properties — tab sets follow sitemap §4.', async () => {
  return VSET('Shell/Mobile/TabBar', { Role: Object.keys(TABS), Active: ['1', '2', '3', '4'] }, async p => {
    const c = COMP('tb', 'HORIZONTAL', { pad: [4, 0, 4, 0], align: 'CENTER', fill: 'surface/default' });
    c.resize(390, 64); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
    stroke(c, 'border/default'); c.strokeTopWeight = 1; c.strokeBottomWeight = 0; c.strokeLeftWeight = 0; c.strokeRightWeight = 0;
    TABS[p.Role].forEach(([l, ic], i) => { const t = I('Shell/Mobile/Tab', { State: String(i + 1) === p.Active ? 'Active' : 'Default' }, { text: { Label: l } }); setProp(t, 'Icon', C('Icon/' + ic).id); t.name = 'Tab ' + (i + 1); c.appendChild(t); grow(t); });
    return c;
  }, { colKey: 'Active' });
});
// ---- Shells
const PEOPLE = { Owner: ['Rana Haddad', 'Owner/Admin', 'RH'], 'Data Entry': ['Karim Saleh', 'Data Entry', 'KS'], 'Call Center': ['Maya Khoury', 'Call Center', 'MK'], Developer: ['Lina Aoun', 'Developer', 'LA'] };
await doc(CONT, 'Shell/Desktop', 'Desktop shell 1440x900: role sidebar at (0,0), top bar at (240,0). Assembly: place the screen content frame (1200x836) at x 240, y 64 above the shell instance; apply grid style ds/Grid/Desktop content 12-col to it. For dark frames set the Semantic mode to Dark on the screen frame.', async () => {
  return VSET('Shell/Desktop', { Role: Object.keys(PEOPLE) }, async p => {
    const c = COMP('sd', null, { fill: 'surface/page' }); c.resize(1440, 900); c.clipsContent = true;
    const sb = I('Nav/Sidebar', { Role: p.Role }); sb.name = 'Sidebar'; c.appendChild(sb); sb.x = 0; sb.y = 0;
    const tb = I('Nav/TopBar', null, { text: { Name: PEOPLE[p.Role][0], Role: PEOPLE[p.Role][1] } }); tb.name = 'TopBar'; c.appendChild(tb); tb.x = 240; tb.y = 0;
    const av = tb.findAllWithCriteria({ types: ['INSTANCE'] }).find(n => n.name === 'Avatar'); if (av) setProp(av, 'Initials', PEOPLE[p.Role][2]);
    const ca = FR('Content area', 1200, 836, {}); c.appendChild(ca); ca.x = 240; ca.y = 64;
    if (p.Role === 'Call Center') { const s = tb.findAllWithCriteria({ types: ['INSTANCE'] }).find(n => n.name === 'Search'); if (s) setProp(s, 'Placeholder', 'Search assigned businesses'); }
    expose(sb); expose(tb);
    return c;
  });
});
await doc(CONT, 'Shell/Mobile', 'Mobile shell 390x844: header (0,0) and tab bar (0,780). Content goes in the 390x724 area between them (y 56) with 16 margins; apply ds/Grid/Mobile 4-col.', async () => {
  return VSET('Shell/Mobile', { Role: Object.keys(TABS) }, async p => {
    const c = COMP('sm', null, { fill: 'surface/page' }); c.resize(390, 844); c.clipsContent = true;
    const h = I('Shell/Mobile/Header', { Back: 'False' }); h.name = 'Header'; c.appendChild(h); h.x = 0; h.y = 0;
    const av = h.findAllWithCriteria({ types: ['INSTANCE'] }).find(n => n.name === 'Avatar'); if (av) setProp(av, 'Initials', PEOPLE[p.Role][2]);
    const ca = FR('Content area', 390, 724, {}); c.appendChild(ca); ca.x = 0; ca.y = 56;
    const tb = I('Shell/Mobile/TabBar', { Role: p.Role, Active: '1' }); tb.name = 'TabBar'; c.appendChild(tb); tb.x = 0; tb.y = 780;
    expose(h); expose(tb);
    return c;
  });
});
await preview(CONT, 'Navigation', [
  async () => I('Tabs', { Style: 'Underline', Active: '2' }),
  async () => I('Tabs', { Style: 'Segmented', Active: '1' }),
  async () => I('Shell/Mobile/TabBar', { Role: 'Call Center', Active: '2' }),
  async () => I('Breadcrumb'),
]);
return finish();
