// B07-cc007-cc008-opportunities-dnc.js — Call Center Screen Agent — Phase 6 Batch B — page 43 HiFi — Call Center (96:5)
// Builds: SCR-CC-007 Opportunities & developer handoff + SCR-CC-008 Do-not-call list & reopening. Run order B01 → B07 (sections stack in inventory order; a section is positioned only when first created).
// Spec: docs/phase6/screens/callcenter-spec.md. DS instances + Semantic/Primitive variables only. Idempotent: rebuilds frames inside its own section(s).
// ---------- Call Center helper library (inlined in every Phase 6 Call Center script; derived from phase5 01-s3-workspace.js) ----------
const OUT = { created: {}, updated: {}, removed: [], fit: {}, warnings: [] };
const PAGE_ID = '96:5', SEM_ID = 'VariableCollectionId:40:3', PRIM_ID = 'VariableCollectionId:40:2', LIGHT = '40:1', DARK = '40:2';
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page 96:5 not found');
await figma.setCurrentPageAsync(page);
for (const s of ['Regular', 'Medium', 'Semi Bold', 'Bold']) await figma.loadFontAsync({ family: 'Inter', style: s });
const W = m => OUT.warnings.push(m);
const semCol = await figma.variables.getVariableCollectionByIdAsync(SEM_ID);
if (!semCol) throw new Error('Semantic collection missing');
const SV = {}, PV = {};
for (const v of await figma.variables.getLocalVariablesAsync()) { if (v.variableCollectionId === SEM_ID) SV[v.name] = v; else if (v.variableCollectionId === PRIM_ID) PV[v.name] = v; }
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const GS = {}; for (const s of await figma.getLocalGridStylesAsync()) GS[s.name] = s;
function paint(name) { const v = SV[name], b = { type: 'SOLID', color: { r: .5, g: .5, b: .5 } }; if (!v) { W('semantic missing: ' + name); return b; } return figma.variables.setBoundVariableForPaint(b, 'color', v); }
function bindF(n, field, pn, fb) { const v = PV[pn]; if (v) { try { n.setBoundVariable(field, v); return; } catch (e) { W(`bind ${field} ${pn}: ${e.message}`); } } if (fb != null) n[field] = fb; }
const CID = {
  'Shell/Desktop': '49:1926', 'Shell/Mobile': '49:2034', 'Shell/Mobile/Header': '49:1219', 'Breadcrumb': '49:1006', 'Tabs': '49:1198', 'Button': '45:305', 'IconButton': '45:405', 'Link': '45:441',
  'Checkbox': '45:497', 'Radio': '45:522', 'Input': '45:796', 'Textarea': '45:847', 'Select': '46:434', 'Input/Date': '46:594', 'Input/Search': '46:748',
  'Chip/Filter': '46:768', 'RadioCard': '46:831', 'Badge/Status': '44:435', 'Badge/Outcome': '44:459', 'Badge/Count': '44:471', 'Badge/Flag': '44:491', 'Tag': '44:501',
  'Chip/Derived': '44:509', 'Notice/Policy pending': '44:549', 'Annotation': '44:395', 'Avatar': '44:358', 'Card/Section': '51:1780', 'Card/Inset': '51:1797',
  'List/KeyValue': '51:1888', 'List/Item': '51:1870', 'Table/HeaderRow': '51:1638', 'Table/Row': '51:1740', 'Banner': '53:1960', 'Toast': '53:2032', 'State': '53:2155',
  'Skeleton': '53:2172', 'Notice/Access': '53:2240', 'Overlay/Scrim': '53:1814', 'Dialog': '53:1818', 'Drawer': '53:1846', 'Calendar/Week': '54:2028',
  'Calendar/Event': '54:2024', 'Calendar/Day': '54:2120', 'Timeline/Item': '54:2309', 'ListItem/Note': '54:2384', 'Banner/Reservation': '55:2533', 'Queue/BucketHeader': '55:2549',
  'Queue/Row': '55:2596', 'Row/Phone': '55:2600', 'Row/Social': '55:2629',
};
const ICON = { search: '44:13', 'chevron-left': '44:38', 'chevron-right': '44:43', calendar: '44:18', clock: '44:23', check: '44:48', x: '44:53', plus: '44:58', bell: '44:73', user: '44:78', users: '44:83', home: '44:88', building: '44:93', phone: '44:98', briefcase: '44:103', list: '44:118', lock: '44:133', 'eye-off': '44:143', 'alert-triangle': '44:148', 'alert-circle': '44:153', info: '44:158', 'check-circle': '44:163', 'x-circle': '44:168', ban: '44:173', menu: '44:178', more: '44:183', wifi: '44:198', copy: '44:203', flag: '44:208', shield: '44:213', 'arrow-right': '44:233', edit: '44:263', link: '44:273', refresh: '44:293', hourglass: '44:303', note: '44:318' };
const COMPS = {};
for (const [n, id] of Object.entries(CID)) { const nd = await figma.getNodeByIdAsync(id); if (!nd) throw new Error('DS component missing: ' + n + ' ' + id); COMPS[n] = nd; }
function variantOf(name, props) {
  const c = COMPS[name]; if (c.type === 'COMPONENT') return c; if (!props) return c.defaultVariant;
  const v = c.children.find(ch => ch.type === 'COMPONENT' && Object.entries(props).every(([k, val]) => ch.variantProperties && ch.variantProperties[k] === val));
  if (!v) { W(`variant not found ${name} ${JSON.stringify(props)}`); return c.defaultVariant; } return v;
}
function prop(inst, obj) {
  if (!inst) return inst;
  const cp = inst.componentProperties, out = {}, texts = [];
  for (const [k, v0] of Object.entries(obj)) {
    const key = Object.keys(cp).find(x => x === k || x.split('#')[0] === k);
    if (!key) { W(`prop "${k}" missing on ${inst.name}`); continue; }
    let v = v0; if (cp[key].type === 'INSTANCE_SWAP' && ICON[v]) v = ICON[v];
    out[key] = v; if (cp[key].type === 'TEXT') texts.push([key, v]);
  }
  try { inst.setProperties(out); } catch (e) { W(`setProperties ${inst.name}: ${e.message}`); }
  if (texts.length) { const tn = inst.findAllWithCriteria({ types: ['TEXT'] }); for (const [key, v] of texts) for (const t of tn) { const r = t.componentPropertyReferences; if (r && r.characters === key && t.characters !== v) { try { t.characters = v; } catch (e) { W(`text fix ${key}: ${e.message}`); } } } }
  return inst;
}
function I(name, vp, sp, nodeName) { const i = variantOf(name, vp).createInstance(); if (sp) prop(i, sp); if (nodeName) i.name = nodeName; return i; }
function nested(inst, name) { return inst.findAllWithCriteria({ types: ['INSTANCE'] }).find(n => n.name === name) || null; }
function layer(inst, name, text) { const t = inst.findAllWithCriteria({ types: ['TEXT'] }).find(n => n.name === name); if (!t) { W(`text "${name}" missing on ${inst.name}`); return; } if (t.characters !== text) t.characters = text; }
function AL(name, dir, o = {}) {
  const f = figma.createAutoLayout(dir); f.name = name; f.fills = [];
  if (o.gap != null) bindF(f, 'itemSpacing', 'space/' + o.gap, o.gap);
  if (o.pad != null) { const p = [].concat(o.pad); const [t, r = t, b = t, l = r] = p; bindF(f, 'paddingTop', 'space/' + t, t); bindF(f, 'paddingRight', 'space/' + r, r); bindF(f, 'paddingBottom', 'space/' + b, b); bindF(f, 'paddingLeft', 'space/' + l, l); }
  if (o.fill) f.fills = [paint(o.fill)];
  if (o.stroke) { f.strokes = [paint(o.stroke)]; f.strokeWeight = 1; f.strokeAlign = 'INSIDE'; }
  if (o.radius) for (const c of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) bindF(f, c, 'radius/' + o.radius, null);
  if (o.align) f.counterAxisAlignItems = o.align; if (o.justify) f.primaryAxisAlignItems = o.justify; if (o.clip) f.clipsContent = true;
  return f;
}
async function T(chars, style, color, o = {}) {
  const t = figma.createText(); t.fontName = { family: 'Inter', style: 'Regular' }; t.characters = chars;
  if (TS[style]) await t.setTextStyleIdAsync(TS[style].id); else W('text style missing: ' + style);
  t.fills = [paint(color || 'text/primary')]; t.name = o.name || chars.slice(0, 40);
  if (o.w) { t.resize(o.w, Math.max(16, t.height)); t.textAutoResize = 'HEIGHT'; }
  if (o.align) t.textAlignHorizontal = o.align;
  return t;
}
function add(p, ...k) { for (const x of k) if (x) p.appendChild(x); return p; }
function fillW(n) { if (n.type === 'TEXT') n.textAutoResize = 'HEIGHT'; n.layoutSizingHorizontal = 'FILL'; return n; }
function fillH(n) { n.layoutSizingVertical = 'FILL'; return n; }
function grow(n) { try { if (n.name === 'Spacer' && 'children' in n && !n.children.length) { n.resize(n.width, 1); n.layoutSizingVertical = 'FIXED'; } n.layoutGrow = 1; } catch (e) { W('grow ' + n.name + ': ' + e.message); } return n; } // fit: empty spacers were 100 px tall (CC-007 Owner view Content +18)
function fixedCol(n, w) { n.resize(w, 100); n.layoutSizingHorizontal = 'FIXED'; return n; }
function put(p, n) { p.appendChild(n); fillW(n); return n; }
function reg(k, n) { if (n) OUT.created[k] = n.id; return n; }
function notice(size, dec, body, title) { const n = I('Notice/Policy pending', { Size: size, Tone: 'Policy pending' }, size === 'Chip' ? { DEC: dec } : { DEC: dec, Body: body }, 'Policy · ' + dec); if (title) layer(n, 'Title', title); return n; }
function button(variant, size, label, icon, state) { const p = { Label: label, 'Show icon': !!icon }; if (icon) p.Icon = icon; return I('Button', { Variant: variant, Size: size, State: state || 'Default' }, p, 'Button · ' + label); }
function link(label, icon, size) { const p = { Label: label, 'Show icon': !!icon }; if (icon) p.Icon = icon; return I('Link', { Size: size || 'Small', State: 'Default' }, p, 'Link · ' + label); }
function banner(tone, size, title, body, nodeName) { return I('Banner', { Tone: tone, Size: size }, { Title: title, Body: body, 'Show title': !!title, 'Show action': false, 'Show close': false }, nodeName || 'Banner · ' + (title || body).slice(0, 30)); }
function derived(label, amber) { return I('Chip/Derived', { Tone: amber ? 'Amber' : 'Neutral' }, { Label: label }, 'Derived · ' + label); }
function kv(k, v, type) { return I('List/KeyValue', { Type: type || 'Default' }, { Key: k, Value: v }, 'KV · ' + k); }
function outcome(o) { return I('Badge/Outcome', { Outcome: o }, null, 'Outcome · ' + o); }
async function slotCard(parent, compName, o) {
  const c = I(compName, null, null, o.name); parent.appendChild(c); fillW(c);
  if (compName === 'Card/Section') {
    prop(c, { Title: o.title, Subtitle: o.subtitle || ' ', 'Show subtitle': !!o.subtitle, 'Show action': !!o.action });
    if (o.action) { const a = nested(c, 'Action'); const ap = { Label: o.action.label, 'Show icon': !!o.action.icon }; if (o.action.icon) ap.Icon = o.action.icon; if (a) prop(a, ap); else W('Card action missing: ' + o.name); }
  }
  const slot = c.findAllWithCriteria({ types: ['SLOT'] })[0];
  if (slot) { try { for (const k of [...slot.children]) k.remove(); if (o.gap != null) slot.itemSpacing = o.gap; return { card: c, body: slot }; } catch (e) { W(`slot ${o.name}: ${e.message}`); } }
  else W('no SLOT in ' + o.name);
  return { card: c, body: c };
}
function slotOf(inst, name) { const s = inst.findAllWithCriteria({ types: ['SLOT'] }); return s.find(x => x.name === name) || null; }
function clearSlot(s) { if (s) for (const k of [...s.children]) k.remove(); return s; }
function relBottom(n, f) { return n.absoluteTransform[1][2] - f.absoluteTransform[1][2] + n.height; }
// N43-1/N43-2: port of DEV-002 stage(). Instances moved into a slot keep the layout of their old (320 px default) width, so slot
// content is built detached at the slot's inner width, then moved in: wrapper FILL, children FIXED→FILL, own text HEIGHT+FILL, relayout.
function inInst(n, root) { for (let a = n.parent; a && a !== root; a = a.parent) if (a.type === 'INSTANCE') return true; return false; }
function kick(b) { if (!b || b.removed) return; try { const w = b.width, fill = b.layoutSizingHorizontal === 'FILL'; b.layoutSizingHorizontal = 'FIXED'; b.resize(w - 1, b.height); if (fill) b.layoutSizingHorizontal = 'FILL'; else b.resize(w, b.height); b.layoutSizingVertical = 'HUG'; } catch (e) { W('relayout ' + b.name + ': ' + e.message); } }
function stage(f, s, name, gap, nodes, hug) {
  if (!s) { W('no Content slot in ' + f.name); return null; }
  const w = Math.max(200, Math.round(s.width - (s.paddingLeft || 0) - (s.paddingRight || 0))); for (const k of [...s.children]) k.remove(); try { s.itemSpacing = 0; } catch (e) { }
  const b = AL(name, 'VERTICAL', { gap }); f.appendChild(b); b.resize(w, 10); b.counterAxisSizingMode = 'FIXED'; b.primaryAxisSizingMode = 'AUTO';
  const H = new Set((hug || []).map(n => n.id));
  for (const n of nodes) if (n) { b.appendChild(n); if (!H.has(n.id)) fillW(n); }
  s.appendChild(b); try { b.layoutSizingHorizontal = 'FILL'; } catch (e) { b.layoutSizingHorizontal = 'FIXED'; } b.layoutSizingVertical = 'HUG';
  for (const n of b.children) if (!H.has(n.id)) { try { n.layoutSizingHorizontal = 'FIXED'; n.layoutSizingHorizontal = 'FILL'; } catch (e) { } }
  for (const t of b.findAll(n => n.type === 'TEXT' && !inInst(n, b))) if (t.parent === b || t.layoutSizingHorizontal === 'FILL') { try { t.layoutSizingHorizontal = 'FILL'; t.textAutoResize = 'HEIGHT'; } catch (e) { } }
  kick(b); return b;
}
function overrun(b) { const o = []; if (!b) return o; for (const i of b.findAll(n => n.type === 'INSTANCE' && !inInst(n, b) && n.visible)) { const ib = i.absoluteBoundingBox; if (!ib) continue; if (i.layoutSizingHorizontal === 'FILL' && i.parent === b && Math.abs(i.width - b.width) > 1.5) { o.push(i.name + ' ' + Math.round(i.width) + '/' + Math.round(b.width) + 'w'); continue; } for (const k of i.findAll(x => x.type === 'TEXT' && x.visible)) { const kb = k.absoluteRenderBounds; if (kb && kb.x + kb.width > ib.x + ib.width + 1.5) { o.push(i.name + ' › ' + k.name + ' +' + Math.round(kb.x + kb.width - ib.x - ib.width) + 'w'); break; } } } return o; }
// ---------- sections & frames ----------
let SEC = null, CUR = { x: 80, y: 80, rowH: 0, n: 0 }, PREFIX = '', PART = '';
function getSection(name, part) {
  PREFIX = name.split(' — ')[0]; PART = part || '-';
  let s = page.children.find(n => n.type === 'SECTION' && n.name === name), y0 = 80;
  if (s) {
    for (const k of [...s.children]) { const p = k.getSharedPluginData('udigity.cc', 'ccPart') || '-'; if (k.name.startsWith(PREFIX) && (p === PART || !part)) { OUT.removed.push(k.name); k.remove(); } }
    for (const k of s.children) y0 = Math.max(y0, k.y + k.height + 160);
    OUT.updated['section ' + PREFIX] = s.id;
  } else {
    const bottoms = page.children.filter(n => n.type === 'SECTION').map(n => n.y + n.height);
    s = figma.createSection(); s.name = name; page.appendChild(s);
    s.x = 0; s.y = bottoms.length ? Math.max(...bottoms) + 400 : 0; // placement on creation only
    OUT.created['section ' + PREFIX] = s.id;
  }
  SEC = s; CUR = { x: 80, y: y0, rowH: 0, n: 0 }; return s;
}
function newRow() { if (CUR.n) { CUR.y += CUR.rowH + 160; CUR.x = 80; CUR.rowH = 0; CUR.n = 0; } }
function frame(suffix, mobile, dark) {
  const name = SEC.name + ' — ' + suffix; const w = mobile ? 390 : 1440, h = mobile ? 844 : 900;
  if (CUR.n >= (mobile ? 6 : 4)) newRow();
  const f = figma.createFrame(); f.name = name; SEC.appendChild(f); f.resize(w, h); f.x = CUR.x; f.y = CUR.y; f.clipsContent = true; f.setSharedPluginData('udigity.cc', 'ccPart', PART);
  f.fills = [paint('surface/page')]; f.setExplicitVariableModeForCollection(semCol, dark ? DARK : LIGHT);
  CUR.x += w + 80; CUR.rowH = Math.max(CUR.rowH, h); CUR.n++;
  OUT.created[PREFIX + ' ' + suffix] = f.id; return f;
}
const USERS = {
  maya: { name: 'Maya Khoury', role: 'Call Center', ini: 'MK', att: 'Checked in · 08:58' },
  omar: { name: 'Omar Nassar', role: 'Call Center', ini: 'ON', att: 'Checked in · 09:02' },
  rana: { name: 'Rana Haddad', role: 'Owner/Admin', ini: 'RH', att: 'Checked in · 08:52' },
};
async function deskShell(f, o) {
  const u = USERS[o.user || 'maya'], owner = u === USERS.rana;
  const shell = I('Shell/Desktop', { Role: owner ? 'Owner' : 'Call Center' }, null, 'Shell'); f.appendChild(shell); shell.x = 0; shell.y = 0;
  for (const it of shell.findAllWithCriteria({ types: ['INSTANCE'] }).filter(n => n.name.startsWith('Nav/Item · '))) {
    const label = it.name.slice(11); prop(it, { State: label === o.active ? 'Active' : 'Default', Label: label });
    if (!owner && (label === 'Calling Queue' || label === 'Follow-ups & Calendar')) { prop(it, { 'Show badge': true }); const b = nested(it, 'Badge'); if (b) prop(b, { Count: label === 'Calling Queue' ? (o.qCount || '7') : (o.fCount || '3') }); }
  }
  if (!owner) { const sl = shell.findAllWithCriteria({ types: ['INSTANCE'] }).filter(n => n.name === 'Nav/SectionLabel'); ['MY WORK', 'CALLING'].forEach((l, i) => { if (sl[i]) prop(sl[i], { Label: l }); }); }
  const tb = nested(shell, 'TopBar');
  if (tb) {
    prop(tb, { Name: u.name, Role: u.role, 'Show attendance': true, 'Show search': true });
    const a = nested(tb, 'Attendance'); if (a) prop(a, { Label: u.att });
    const av = nested(tb, 'Avatar'); if (av) prop(av, { Initials: u.ini });
    const se = nested(tb, 'Search'); if (se) prop(se, { Placeholder: owner ? 'Search businesses and employees' : 'Search assigned businesses' });
  } else W('TopBar missing');
  const c = AL('Content', 'VERTICAL', { gap: 12, pad: [20, 24, 16, 24] }); f.appendChild(c);
  c.resize(1200, 836); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED'; c.x = 240; c.y = 64;
  if (GS['ds/Grid/Desktop content 12-col']) await c.setGridStyleIdAsync(GS['ds/Grid/Desktop content 12-col'].id);
  return c;
}
const MTABS = [['My Day', 'clock'], ['Queue', 'phone'], ['Follow-ups', 'calendar'], ['More', 'menu']];
async function pageHeader(parent, o) {
  const hdr = AL('Page header', 'HORIZONTAL', { gap: 12, align: 'CENTER' }); put(parent, hdr);
  const tt = AL('Titles', 'VERTICAL', { gap: 2 });
  if (o.crumb) tt.appendChild(I('Breadcrumb', null, { 'Level 1': o.crumb[0], 'Show level 2': false, 'Level 2': ' ', Current: o.crumb[1] }, 'Breadcrumb'));
  tt.appendChild(await T(o.title, 'ds/H2', 'text/primary', { name: 'Title' }));
  if (o.sub) { const s = await T(o.sub, 'ds/Body Small', 'text/secondary', { name: 'Subtitle', w: 600 }); tt.appendChild(s); fillW(s); }
  hdr.appendChild(tt); grow(tt);
  for (const a of o.actions || []) hdr.appendChild(a);
  return hdr;
}
function fitFrame(f) {
  const r = { w: Math.round(f.width), h: Math.round(f.height), overflow: [] };
  for (const n of f.findAll(x => x.type === 'FRAME' && x.clipsContent && x.layoutMode && x.layoutMode !== 'NONE' && x.visible)) {
    if (n.name.includes('(scrolls)')) continue;
    const vis = n.children.filter(k => k.visible); if (!vis.length) continue;
    if (n.layoutMode === 'VERTICAL') { const ob = Math.round(relBottom(vis[vis.length - 1], n) - n.height); if (ob > 1) r.overflow.push(`${n.name} +${ob}px`); }
  }
  const fx = f.absoluteTransform[0][2];
  for (const n of f.findAll(x => (x.type === 'INSTANCE' || x.type === 'TEXT') && x.visible && x.absoluteBoundingBox)) {
    let p = n.parent, skip = false; while (p && p !== f) { if (p.name.includes('(scrolls)') || p.visible === false) { skip = true; break; } p = p.parent; } if (skip) continue;
    const ox = Math.round(n.absoluteBoundingBox.x + n.absoluteBoundingBox.width - fx - f.width); if (ox > 1) { r.overflow.push(`${n.name} past right edge +${ox}px`); break; }
  }
  OUT.fit[PREFIX + ' ' + f.name.slice(SEC.name.length + 3)] = r; if (r.overflow.length) W(f.name + ': ' + r.overflow.join('; '));
  return r;
}
async function annotations(notes, w) {
  newRow();
  const a = AL(PREFIX + ' — Annotations' + (PART !== '-' ? ' (' + PART + ')' : ''), 'VERTICAL', { gap: 12, pad: 24, fill: 'surface/page', stroke: 'border/default', radius: 'xl' });
  SEC.appendChild(a); a.setSharedPluginData('udigity.cc', 'ccPart', PART); a.x = 80; a.y = CUR.y; a.resize(w || 1440, 100); a.counterAxisSizingMode = 'FIXED'; a.primaryAxisSizingMode = 'AUTO';
  a.setExplicitVariableModeForCollection(semCol, LIGHT);
  a.appendChild(await T(PREFIX + ' annotations (designer notes and intended interactions, not product UI)', 'ds/H3', 'text/primary'));
  for (const [type, title, body] of notes) put(a, I('Annotation', { Type: type }, { Title: title, Body: body }, 'Annotation · ' + title));
  OUT.created['annotations ' + PREFIX] = a.id; CUR.y += a.height; return a;
}
function finishSection() { let mx = 0, my = 0; for (const c of SEC.children) { mx = Math.max(mx, c.x + c.width); my = Math.max(my, c.y + c.height); } SEC.resizeWithoutConstraints(mx + 80, my + 80); OUT.fit['section ' + PREFIX] = [Math.round(SEC.x), Math.round(SEC.y), Math.round(SEC.width), Math.round(SEC.height)]; }
// ---------- end helper library ----------

// ================= SCR-CC-007 Opportunities & developer handoff  +  SCR-CC-008 Do-not-call list & reopening =================
function table(parent, heads, rows) {
  const box = AL('Table', 'VERTICAL', { fill: 'surface/default', stroke: 'border/default', radius: 'xl', clip: true }); put(parent, box);
  const h = I('Table/HeaderRow', null, null, 'Table header'); put(box, h);
  const HC = ['Business', 'Phone', 'Status', 'Assigned to', 'Updated'];
  { const cbh = nested(h, 'H · Checkbox'); if (cbh) cbh.visible = false; }
  HC.forEach((x, i) => { const n = nested(h, 'H · ' + x); if (n) prop(n, { Label: heads[i] }); else W('header cell missing: ' + x); });
  { const ah = nested(h, 'H · Actions'); if (ah) prop(ah, { Label: ' ' }); }
  for (const r of rows) {
    const row = I('Table/Row', { State: r.sel ? 'Selected' : 'Default' }, null, 'Row · ' + r.biz[0]); put(box, row);
    const cell = n => nested(row, 'C · ' + n);
    const cb = cell('Checkbox'); if (cb) cb.visible = false;
    prop(cell('Business'), { Text: r.biz[0], Meta: r.biz[1] }); prop(cell('Phone'), { Text: r.col2 });
    const st = nested(cell('Status'), 'Status'); if (st) prop(st, { Tone: r.st[0], Label: r.st[1], 'Show dot': false });
    const as = cell('Assigned to'); prop(as, { Text: r.who[0] }); const av = nested(as, 'Avatar'); if (av) { if (r.who[1]) prop(av, { Initials: r.who[1] }); else av.visible = false; }
    prop(cell('Updated'), { Text: r.last });
  }
  return box;
}
function chipRow(parent, chips, extra) {
  const r = AL('Filters', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(parent, r);
  for (const [l, a] of chips) r.appendChild(I('Chip/Filter', { State: a ? 'Active' : 'Default' }, { Label: l }, 'Chip · ' + l));
  const sp = AL('Spacer', 'HORIZONTAL', {}); r.appendChild(sp); grow(sp); for (const x of extra || []) r.appendChild(x); return r;
}
// N43-9: the dialog body is staged at the slot's inner width, so the Reason textarea and the disabled Select FILL it (no 320 px field, no detached chevron)
function dialog(f, title, desc, nodes) {
  const sc = I('Overlay/Scrim', { Size: 'Desktop' }, null, 'Overlay/Scrim'); f.appendChild(sc); sc.x = 0; sc.y = 0;
  const dl = I('Dialog', null, { Title: title, Description: desc, 'Show description': true, 'Show footer': true, 'Show close': true }, 'Dialog · ' + title); f.appendChild(dl);
  const db = stage(f, slotOf(dl, 'Content') || dl.findAllWithCriteria({ types: ['SLOT'] })[0], 'Dialog body', 12, nodes);
  if (db) { const ov = overrun(db); OUT.fit[PREFIX + ' ' + title + ' body'] = { bodyW: Math.round(db.width), overrun: ov }; if (ov.length) W(title + ': ' + ov.length + ' stale/overrunning layer(s), e.g. ' + ov[0]); }
  return { dl, db };
}
// N43-10: audit-record rows whose values wrap (key column fixed, value FILL + HEIGHT) instead of List/KeyValue, whose value column is fixed
async function recRow(k, v) { const r = AL('Record · ' + k, 'HORIZONTAL', { gap: 16, pad: [6, 0] }); r.appendChild(await T(k, 'ds/Label', 'text/secondary', { name: 'Key', w: 200 })); put(r, await T(v, 'ds/Body Small', 'text/primary', { name: 'Value', w: 400 })); return r; }
function dialogFoot(dl, a, b, destructive) { const b1 = nested(dl, 'Secondary action'), b2 = nested(dl, 'Primary action'); if (b1) prop(b1, { Label: a, 'Show icon': false }); if (b2) prop(b2, { Variant: destructive ? 'Destructive' : 'Primary', Label: b, 'Show icon': false }); dl.x = 460; dl.y = Math.round((900 - dl.height) / 2); }
function toast(f, title, body) { const t = I('Toast', { Tone: 'Success' }, { Title: title, Body: body, 'Show body': true }, 'Toast · ' + title); f.appendChild(t); t.x = 1440 - 24 - t.width; t.y = 80; return t; }
// ---------------- SCR-CC-007 ----------------
getSection('SCR-CC-007 — Opportunities & developer handoff');
const OPP = (assigned, owner) => [
  { sel: true, biz: ['Olive & Thyme Café', 'Menu website · accepted 22 Oct 11:04'], col2: owner ? 'Maya Khoury' : 'Accepted opportunity', st: assigned ? ['Success', 'Developer assigned'] : ['Warning', 'Not yet assigned'], who: assigned ? ['Lina Aoun', 'LA'] : ['Not yet assigned', null], last: 'Not arranged' },
  { biz: ['Lumen Yoga Studio', 'Class booking site · accepted 20 Oct'], col2: owner ? 'Maya Khoury' : 'Accepted opportunity', st: ['Success', 'Developer assigned'], who: ['Lina Aoun', 'LA'], last: 'Fri 23 Oct 10:00' },
  { biz: ['Peak Fitness Gym', 'Member app · accepted 19 Oct'], col2: owner ? 'Maya Khoury' : 'Accepted opportunity', st: ['Success', 'Developer assigned'], who: ['Lina Aoun', 'LA'], last: 'Mon 26 Oct 14:00' },
];
async function oppPage(f, o = {}) {
  const c = await deskShell(f, { user: o.owner ? 'rana' : 'maya', active: o.owner ? 'Deals & Meetings' : 'Opportunities & Handoffs' });
  await pageHeader(c, { title: o.owner ? 'Opportunities & Handoffs — all agents' : 'Opportunities & Handoffs', sub: o.owner ? 'Thu 22 Oct 2026 · accepted opportunities from every agent · not closed deals' : 'Thu 22 Oct 2026 · accepted opportunities you created · not closed deals', actions: [button('Secondary', 'Medium', 'Calling queue', 'phone')] });
  if (o.empty) {
    const box = AL('State container', 'VERTICAL', { align: 'CENTER', justify: 'CENTER', fill: 'surface/default', stroke: 'border/default', radius: 'xl' }); put(c, box); fillH(box);
    const st = I('State', { Type: 'Empty', Size: 'Page' }, { 'Show action': true }, 'State · Empty'); box.appendChild(st);
    layer(st, 'Title', 'No accepted opportunities yet'); layer(st, 'Body', 'When a call ends with Accepted, the opportunity appears here for developer handoff.'); const a = nested(st, 'Action'); if (a) prop(a, { Label: 'Open calling queue' });
    return c;
  }
  if (o.owner) put(c, banner('Warning', 'Default', 'Developer not yet assigned · 1', 'Olive & Thyme Café (created by Maya Khoury, 22 Oct) has no developer. Assign one or ask the agent to.'));
  chipRow(c, [['All (3)', 1], [o.assigned ? 'Developer not yet assigned (0)' : 'Developer not yet assigned (1)', 0], ['Meeting not yet arranged (1)', 0]], [derived('Both conditions are derived')]);
  { const pr = AL('Policy chips', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(c, pr); add(pr, notice('Chip', 'DEC-005', null, 'Developer access before closure'), notice('Chip', 'DEC-017', null, 'Several deals per business')); }
  table(c, ['Opportunity', o.owner ? 'Created by' : 'Stage', 'Handoff', 'Developer', 'First meeting'], OPP(o.assigned, o.owner));
  const card = await slotCard(c, 'Card/Section', { name: 'Handoff · Olive & Thyme Café', title: 'Handoff · Olive & Thyme Café', subtitle: o.assigned ? 'Developer assigned · meeting not yet arranged (derived)' : 'Developer not yet assigned (E3) · meeting not yet arranged (derived)', action: { label: 'Edit handoff context', icon: 'edit' } });
  const cols = AL('Handoff columns', 'HORIZONTAL', { gap: 24 }); put(card.body, cols); cols.counterAxisAlignItems = 'MIN';
  const L = AL('Context', 'VERTICAL', { gap: 4 }); cols.appendChild(L); grow(L);
  for (const [k, v] of [['Client needs', 'Menu website with table booking'], ['Service interest', 'Website + booking'], ['Call notes', 'Owner wants an online menu and table booking before the second branch opens.'], ['Created by', 'Maya Khoury · 22 Oct 11:04 (call save)'], ['Commercial stage', 'Accepted opportunity — not a closed deal']]) put(L, kv(k, v));
  const R = AL('Developer', 'VERTICAL', { gap: 12 }); cols.appendChild(R); fixedCol(R, 400);
  const dev = I('Select', { Type: 'Person', State: o.assigned ? 'Filled' : 'Default' }, { Label: 'Developer', Value: o.assigned ? 'Lina Aoun' : ' ', Placeholder: 'Choose a developer', 'Show label': true, Required: false, 'Show helper': true, Helper: 'Active developers only. The developer gets a handoff notification.' }, 'Developer select'); put(R, dev);
  const av = nested(dev, 'Avatar'); if (av) { if (o.assigned) prop(av, { Initials: 'LA' }); else av.visible = false; }
  const br = AL('Handoff actions', 'HORIZONTAL', { gap: 8 }); put(R, br);
  if (o.assigned) add(br, button('Primary', 'Medium', 'Schedule first meeting', 'calendar'), button('Ghost', 'Medium', 'Reassign developer'));
  else add(br, button('Primary', 'Medium', 'Assign developer', 'user'), button('Secondary', 'Medium', 'Schedule first meeting', 'calendar'));
  put(R, notice('Inline', 'DEC-005', 'Whether the developer can open this opportunity before closure is undecided.'));
  return c;
}
for (const [s, d, o] of [['Desktop — Light', false, {}], ['Desktop — Dark', true, {}], ['Desktop — Light — Developer assigned', false, { assigned: true }], ['Desktop — Light — Empty', false, { empty: true }], ['Desktop — Light — Owner view', false, { owner: true }]]) {
  const f = frame(s, false, d); await oppPage(f, o);
  if (o.assigned) reg(PREFIX + ' assigned toast', toast(f, 'Lina Aoun assigned', 'Olive & Thyme Café · handoff notification sent. Meeting not yet arranged.'));
  fitFrame(f);
}
await annotations([
  ['Note', 'Accepted opportunity (E5)', 'Created by the Accepted call save in stage "Accepted opportunity" — never a closed deal. Developer not yet assigned (E3) is visible to the Owner; meeting not yet arranged is derived.'],
  ['Interaction', 'Assign / reassign / meeting', 'Call Center or Owner assigns an active Developer (E2) → handoff notification (its failure never undoes the assignment). Schedule first meeting opens SCR-DEV-004 (page 44). Edit handoff context edits needs/interest/notes only.'],
  ['Note', 'Policies', 'DEC-005 developer access before closure; DEC-017 several deals per business (a second Accepted on Olive & Thyme Café would follow DEC-017). No mobile frame (inventory Mob —).'],
], 1440);
finishSection();
// ---------------- SCR-CC-008 ----------------
getSection('SCR-CC-008 — Do-not-call list & reopening');
const DNC = [{ sel: true, biz: ['Harbor Auto Care', 'Services · rejected by Maya Khoury'], col2: '+000 70 000 109', st: ['Danger', 'Do not call'], who: ['Maya Khoury', 'MK'], last: '15 Oct 16:22' }];
async function dncPage(f, o = {}) {
  const c = await deskShell(f, { user: o.owner ? 'rana' : 'maya', active: o.owner ? 'Calling Assignments' : 'Do-not-call List' });
  await pageHeader(c, { title: 'Do-not-call list', sub: 'Rejected businesses · excluded from calling, assignment and new follow-ups' + (o.owner ? ' · Owner view' : ' · view only'), actions: [button('Secondary', 'Medium', 'Calling queue', 'phone')] });
  put(c, banner('Info', 'Default', 'Reopening is controlled', o.owner ? 'Reopening needs a reason and is audited. Who may reopen, and to which outcome, is still undecided (DEC-016).' : 'You can view this list but cannot reopen a business. Who may reopen, and to which outcome, is undecided (DEC-016).'));
  chipRow(c, [[o.reopened ? 'Rejected (0)' : 'Rejected (1)', 1], ['Reopened', 0]], [notice('Chip', 'DEC-016', null, 'Reopening authority'), notice('Chip', 'D4', null, 'Open follow-ups on Rejected')]);
  if (o.reopened) {
    const tb = table(c, ['Business', 'Phone', 'Status', 'Assigned to', 'Rejected'], []);
    const st = I('State', { Type: 'Empty', Size: 'Inline' }, { 'Show action': false }, 'State · Empty'); put(tb, st); layer(st, 'Title', 'No businesses on the do-not-call list'); layer(st, 'Body', 'Rejected businesses appear here; they never show in calling buckets.');
    const card = await slotCard(c, 'Card/Section', { name: 'Recently reopened', title: 'Recently reopened · Harbor Auto Care', subtitle: 'Reopening record (call history kept)' });
    const rows = [];
    for (const [k, v] of [['Reopened by', 'Rana Haddad · Tue 20 Oct 2026 11:02'], ['Reason', 'Owner emailed asking for a website quote.'], ['Previous outcome', 'Rejected (15 Oct, Maya Khoury)'], ['New outcome', 'Set by DEC-016 (undecided)'], ['Assignment', 'Unchanged · Maya Khoury'], ['History', '2 call attempts kept']]) rows.push(await recRow(k, v));
    rows.push(derived('Back to calling eligibility · re-enters buckets by its new outcome'));
    stage(f, card.body, 'Record body', 4, rows, [rows[rows.length - 1]]);
    return c;
  }
  table(c, ['Business', 'Phone', 'Status', 'Assigned to', 'Rejected'], DNC);
  const card = await slotCard(c, 'Card/Section', { name: 'Detail · Harbor Auto Care', title: 'Harbor Auto Care', subtitle: 'Do not call · Start Contact disabled', action: { label: 'Request correction', icon: 'flag' } });
  const cols = AL('Detail columns', 'HORIZONTAL', { gap: 24 }); put(card.body, cols); cols.counterAxisAlignItems = 'MIN';
  const L = AL('Record', 'VERTICAL', { gap: 4 }); cols.appendChild(L); grow(L);
  for (const [k, v] of [['Rejected by', 'Maya Khoury · 15 Oct 2026 16:22'], ['Reason', 'Not interested — asked not to be called again'], ['Open follow-ups', 'None'], ['Call history', '2 attempts · kept']]) put(L, kv(k, v));
  const R = AL('Actions', 'VERTICAL', { gap: 10 }); cols.appendChild(R); fixedCol(R, 480);
  const br = AL('Buttons', 'HORIZONTAL', { gap: 8 }); put(R, br);
  add(br, button('Secondary', 'Medium', 'Open business'), button('Primary', 'Medium', 'Start Contact', 'phone', 'Disabled'), button(o.owner ? 'Primary' : 'Secondary', 'Medium', 'Reopen…', 'refresh', o.owner ? 'Default' : 'Disabled'));
  put(R, await T(o.owner ? 'Reopen asks for a reason; the outcome after reopening follows DEC-016.' : 'Reopen not permitted for your role. If DEC-016 adopts request-and-approve, a request flow is needed (B3-Q09).', 'ds/Caption', 'text/muted', { w: 380 }));
  put(R, notice('Inline', 'DEC-016', 'Who may reopen a Rejected business, and to which outcome, is undecided.'));
  return c;
}
for (const [s, d] of [['Desktop — Light', false], ['Desktop — Dark', true]]) { const f = frame(s, false, d); await dncPage(f); fitFrame(f); }
{
  const f = frame('Desktop — Light — Owner reopen (reason)'); await dncPage(f, { owner: true });
  const { dl } = dialog(f, 'Reopen Harbor Auto Care?', 'Rejected 15 Oct 2026 by Maya Khoury', [
    I('Textarea', { State: 'Filled' }, { Label: 'Reason', Value: 'Owner emailed asking for a website quote.', 'Show label': true, Required: true, 'Show helper': true, Helper: 'Required. Recorded with your name and the time.', Counter: '41 / 500' }, 'Reason'),
    I('Select', { Type: 'Select', State: 'Disabled' }, { Label: 'Outcome after reopening', Value: 'Set by DEC-016 (undecided)', Placeholder: 'Set by DEC-016 (undecided)', 'Show label': true, Required: false, 'Show helper': false }, 'Outcome after reopening'),
    notice('Inline', 'DEC-016', 'Who may reopen and the outcome after reopening are undecided; no value is preselected.'),
    banner('Info', 'Inline', 'History and assignment are kept', 'All call attempts stay. The reopening is audited (call_outcome.reopened).')]);
  dialogFoot(dl, 'Cancel', 'Reopen business'); reg(PREFIX + ' reopen dialog', dl); fitFrame(f);
}
{ const f = frame('Desktop — Light — Reopened'); await dncPage(f, { owner: true, reopened: true }); reg(PREFIX + ' reopened toast', toast(f, 'Harbor Auto Care reopened', 'Back to calling eligibility; it re-enters Maya Khoury’s queue by its new outcome.')); fitFrame(f); }
await annotations([
  ['Note', 'Enforcement (WF-REJECT-001)', 'Rejected = do not call everywhere: Start Contact blocked, new/rescheduled follow-ups blocked, excluded from assignment and work lists. Data-correction requests stay available.'],
  ['Interaction', 'Reopen', 'Reopen → reason (required) → single save: reopening record (by, at, reason, previous and new outcome); history and assignment kept; audit call_outcome.reopened; business re-enters calling via WF-CALL-001.'],
  ['Note', 'Pending', 'DEC-016 reopening authority and post-reopen outcome (Call Center shown "not permitted"; Owner shown with reason; neither decided). D4 open follow-ups. ICR-4: request-and-approve would need a new flow. No mobile frame (inventory Mob —).'],
['Note', 'Request correction target', 'Request correction opens SCR-SHR-009 (page 42, frame 175:10802); the request goes to Data Entry (WF-BIZ-002).'],
], 1440);
finishSection();
return OUT;
