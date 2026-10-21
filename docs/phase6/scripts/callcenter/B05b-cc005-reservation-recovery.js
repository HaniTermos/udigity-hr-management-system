// B05b-cc005-reservation-recovery.js — Call Center Screen Agent — Phase 6 Batch B — page 43 HiFi — Call Center (96:5)
// Builds: SCR-CC-005 Contact reservation & concurrency block — part b (expiring, expired, network loss, stale client, mobile). Run order B01 → B07 (sections stack in inventory order; a section is positioned only when first created).
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
function hideLayer(inst, name) { const n = inst.findOne(x => x.name === name); if (n) n.visible = false; else W(`layer "${name}" missing on ${inst.name}`); }
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
function topRule(f, color) { f.strokes = [paint(color)]; f.strokeAlign = 'INSIDE'; f.strokeTopWeight = 1; f.strokeBottomWeight = 0; f.strokeLeftWeight = 0; f.strokeRightWeight = 0; }
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
function grow(n) { n.layoutGrow = 1; return n; }
function fixedCol(n, w) { n.resize(w, 100); n.layoutSizingHorizontal = 'FIXED'; return n; }
function put(p, n) { p.appendChild(n); fillW(n); return n; }
function notice(size, dec, body, title) { const n = I('Notice/Policy pending', { Size: size, Tone: 'Policy pending' }, size === 'Chip' ? { DEC: dec } : { DEC: dec, Body: body }, 'Policy · ' + dec); if (title) layer(n, 'Title', title); return n; }
function button(variant, size, label, icon, state) { const p = { Label: label, 'Show icon': !!icon }; if (icon) p.Icon = icon; return I('Button', { Variant: variant, Size: size, State: state || 'Default' }, p, 'Button · ' + label); }
function link(label, icon, size) { const p = { Label: label, 'Show icon': !!icon }; if (icon) p.Icon = icon; return I('Link', { Size: size || 'Small', State: 'Default' }, p, 'Link · ' + label); }
function banner(tone, size, title, body, nodeName) { return I('Banner', { Tone: tone, Size: size }, { Title: title, Body: body, 'Show title': !!title, 'Show action': false, 'Show close': false }, nodeName || 'Banner · ' + (title || body).slice(0, 30)); }
function status(tone, label, dot) { return I('Badge/Status', { Tone: tone, Size: 'Small' }, { Label: label, 'Show dot': !!dot }, 'Status · ' + label); }
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
function relBottom(n, f) { return n.absoluteTransform[1][2] - f.absoluteTransform[1][2] + n.height; }
// ---------- sections & frames ----------
let SEC = null, CUR = { x: 80, y: 80, rowH: 0, n: 0 }, PREFIX = '', PART = '';
function getSection(name, part) {
  PREFIX = name.split(' — ')[0]; PART = part || '-';
  let s = page.children.find(n => n.type === 'SECTION' && n.name === name), y0 = 80;
  if (s) {
    for (const k of [...s.children]) { const p = k.getPluginData('ccPart') || '-'; if (k.name.startsWith(PREFIX) && (p === PART || !part)) { OUT.removed.push(k.name); k.remove(); } }
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
  const f = figma.createFrame(); f.name = name; SEC.appendChild(f); f.resize(w, h); f.x = CUR.x; f.y = CUR.y; f.clipsContent = true; f.setPluginData('ccPart', PART);
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
async function mobShell(f, o) {
  const shell = I('Shell/Mobile', { Role: 'Call Center' }, null, 'Shell'); f.appendChild(shell); shell.x = 0; shell.y = 0;
  const h = nested(shell, 'Header');
  if (h) { if (o.back) prop(h, { Back: 'True' }); prop(h, { Title: o.title, Subtitle: o.subtitle || ' ', 'Show subtitle': !!o.subtitle }); const av = nested(h, 'Avatar'); if (av) prop(av, { Initials: 'MK' }); } else W('mobile Header missing');
  const tb = nested(shell, 'TabBar');
  if (tb) { prop(tb, { Role: 'Call Center', Active: String(o.tab || 2) }); MTABS.forEach(([l, ic], i) => { const t = nested(tb, 'Tab ' + (i + 1)); if (t) prop(t, { Label: l, Icon: ic }); }); } else W('TabBar missing');
  const c = AL('Content', 'VERTICAL', { gap: 12, pad: 16, clip: true }); f.appendChild(c);
  c.x = 0; c.y = 56; c.resize(390, o.h || 724); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
  return c;
}
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
async function cueStrip(parent, index, label, name, boxed) {
  const h = AL(name, 'HORIZONTAL', boxed ? { gap: 4, pad: [8, 16], align: 'CENTER', justify: 'CENTER', fill: 'surface/subtle', stroke: 'border/subtle', radius: 'lg' } : { gap: 4, pad: [8, 16], align: 'CENTER', justify: 'CENTER', fill: 'surface/subtle' });
  if (!boxed) topRule(h, 'border/subtle');
  const t = await T(label, 'ds/Caption', 'text/secondary', { name: 'Label', align: 'CENTER' }); h.appendChild(t);
  parent.insertChild(Math.min(index, parent.children.length), h); fillW(h); fillW(t);
  return { cue: h, label: t };
}
function clipTo(key, view, cue, describe, prefix) {
  let hidden = [];
  for (let pass = 0; pass < 4; pass++) {
    for (const k of view.children) k.visible = true; hidden = []; let cut = false;
    const lim = view.height - (view.paddingBottom || 0) + 0.5;
    for (const k of view.children) { if (!cut && relBottom(k, view) <= lim) continue; cut = true; k.visible = false; const d = describe(k); if (d) hidden.push(d); }
    if (!cue) break;
    const lbl = (prefix || '↓ More below') + (hidden.length ? ' · ' + hidden.slice(0, 2).join(' · ') + (hidden.length > 2 ? ` +${hidden.length - 2}` : '') : '');
    if (cue.label.characters === lbl) break; cue.label.characters = lbl;
  }
  const vis = [...view.children].filter(k => k.visible).pop();
  OUT.fit[key] = { viewportH: Math.round(view.height), lastVisibleBottom: vis ? Math.round(relBottom(vis, view)) : 0, hiddenBelow: hidden };
  return hidden;
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
  SEC.appendChild(a); a.setPluginData('ccPart', PART); a.x = 80; a.y = CUR.y; a.resize(w || 1440, 100); a.counterAxisSizingMode = 'FIXED'; a.primaryAxisSizingMode = 'AUTO';
  a.setExplicitVariableModeForCollection(semCol, LIGHT);
  a.appendChild(await T(PREFIX + ' annotations (designer notes and intended interactions, not product UI)', 'ds/H3', 'text/primary'));
  for (const [type, title, body] of notes) put(a, I('Annotation', { Type: type }, { Title: title, Body: body }, 'Annotation · ' + title));
  OUT.created['annotations ' + PREFIX] = a.id; CUR.y += a.height; return a;
}
function finishSection() { let mx = 0, my = 0; for (const c of SEC.children) { mx = Math.max(mx, c.x + c.width); my = Math.max(my, c.y + c.height); } SEC.resizeWithoutConstraints(mx + 80, my + 80); OUT.fit['section ' + PREFIX] = [Math.round(SEC.x), Math.round(SEC.y), Math.round(SEC.width), Math.round(SEC.height)]; }
// ---------- end helper library ----------

// ---------- workspace module (queue column + business detail column + contact panel; approved S3 layout) ----------
const QB = [
  { label: 'Callbacks due today', count: '2', exp: true, rows: [
    { name: 'Olive & Thyme Café', cat: 'Café', out: 'Needs another call', meta: 'Due 10:30 · last attempt 13 Oct 15:10' },
    { name: 'Nova Dental Clinic', cat: 'Clinic', out: 'Needs another call', meta: 'Due 14:00 · last attempt 16 Oct 11:45' }] },
  { label: 'Overdue follow-ups', count: '1', exp: true, rows: [
    { name: 'Sunrise Bakery', cat: 'Shop', out: 'On hold', meta: 'Was due 19 Oct 16:00 · last attempt 15 Oct', flag: ['Danger', 'Overdue'] }] },
  { label: 'New assignments', count: '2', exp: false, rows: [] },
  { label: 'Callback to be scheduled', count: '1', exp: true, rows: [
    { name: 'Cedar Home Realty', cat: 'Real estate', out: 'Needs another call', meta: 'Time not set yet · last attempt 16 Oct' }] },
  { label: 'Data correction requested', count: '1', exp: true, rows: [
    { name: 'Bloom Florist', cat: 'Shop', out: 'On hold', meta: 'Last attempt 14 Oct 12:30', flag: ['Warning', 'Correction requested 14 Oct'] }] },
  { label: 'Requires contact', count: '1', exp: false, rows: [] },
];
function qRow(r, sel) {
  const row = I('Queue/Row', { State: sel ? 'Selected' : 'Default' }, { Name: r.name, Meta: r.cat + ' · ' + r.meta, 'Show flag': !!r.flag }, 'Row · ' + r.name);
  const cat = nested(row, 'Category'); if (cat) cat.visible = false;
  for (const tn of ['Name', 'Meta']) { const t = row.findAllWithCriteria({ types: ['TEXT'] }).find(n => n.name === tn); if (t) { try { t.maxLines = 2; } catch (e) { } } }
  prop(nested(row, 'Outcome'), { Outcome: r.out });
  if (r.flag) prop(nested(row, 'Flag'), { Tone: r.flag[0], Label: r.flag[1] });
  return row;
}
function bucketHeader(b) { const bh = I('Queue/BucketHeader', { Expanded: b.exp ? 'True' : 'False' }, { Label: b.label }, 'Bucket · ' + b.label); prop(nested(bh, 'Count'), { Count: b.count }); return bh; }
async function qColumn(parent, o = {}) {
  const Q = AL('Queue column', 'VERTICAL', { fill: 'surface/default', stroke: 'border/default', radius: 'xl', clip: true });
  parent.appendChild(Q); fixedCol(Q, 344); fillH(Q);
  const qh = AL('Queue header', 'VERTICAL', { gap: 10, pad: 16 }); put(Q, qh);
  const qt = AL('Title row', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
  const qtt = await T(o.title || 'My calling queue', 'ds/H3', 'text/primary', { name: 'Title' });
  add(qt, qtt, I('Badge/Count', { Tone: 'Neutral' }, { Count: o.count || '7' }, 'Business count'), await T('businesses', 'ds/Caption', 'text/muted'));
  put(qh, qt); grow(qtt);
  put(qh, I('Input/Search', { Size: 'Small', State: 'Default' }, { Placeholder: 'Filter queue' }, 'Filter'));
  const tabs = I('Tabs', { Style: 'Segmented', Active: '1' }, null, 'Queue view');
  prop(nested(tabs, 'Tab 1'), { Label: 'All buckets' }); prop(nested(tabs, 'Tab 2'), { Label: 'Due today (2)' }); hideLayer(tabs, 'Tab 3'); hideLayer(tabs, 'Tab 4');
  qh.appendChild(tabs); qh.appendChild(derived('Derived · a business can be in 2 buckets'));
  const list = AL('Queue list', 'VERTICAL', { clip: true }); put(Q, list); fillH(list);
  const B = o.buckets || QB;
  for (const b of B) { put(list, bucketHeader(b)); for (const r of b.rows) put(list, qRow(r, r.name === o.sel)); }
  const qf = AL('Queue footer', 'VERTICAL', { gap: 8, pad: [12, 16] }); topRule(qf, 'border/default'); put(Q, qf);
  add(qf, link('Rejected: do not call (1) — view only', 'ban'), notice('Chip', 'DEC-016', null, 'Reopen rule pending'));
  const cue = await cueStrip(Q, Q.children.indexOf(qf), '↓ More below', 'Scroll cue · queue', false);
  clipTo(PREFIX + ' ' + (o.key || '') + ' queue', list, cue, k => { if (k.name.startsWith('Bucket · ')) { const b = B.find(x => 'Bucket · ' + x.label === k.name); return b ? `${b.label} (${b.count})` : null; } return k.name.startsWith('Row · ') ? k.name.slice(6) : null; });
  return Q;
}
const BIZ = {
  olive: { name: 'Olive & Thyme Café', cat: 'Café', phones: [['+000 70 000 106', 'Main'], ['+000 70 000 116', 'Owner mobile']], web: 'oliveandthyme.example.com', handle: '@oliveandthyme.demo', notes: 'Family-run, two branches planned. Prefers calls after 10:00.' },
  nova: { name: 'Nova Dental Clinic', cat: 'Clinic', phones: [['+000 70 000 107', 'Reception']], web: 'novadental.example.com', handle: '@novadental.demo', notes: 'Reception answers 09:00–13:00; ask for the office manager.' },
  harbor: { name: 'Harbor Auto Care', cat: 'Services', phones: [['+000 70 000 109', 'Main']], web: 'harborauto.example.com', handle: '@harborauto.demo', notes: 'Workshop line; owner rarely available.' },
};
const TL_OLIVE = [
  { type: 'Upcoming', title: 'Follow-up due today · 10:30', time: 'Due now', body: 'Owner back from supplier visit — discuss menu website. Scheduled by Maya Khoury on 13 Oct.' },
  { type: 'Call attempt', title: 'Call attempt · Maya Khoury', time: '13 Oct, 15:10', body: 'Spoke to manager. Owner decides; call back 20 Oct morning.', out: 'Needs another call' },
  { type: 'Call attempt', title: 'Call attempt · Maya Khoury', time: '9 Oct, 11:02', body: 'No answer on main line.', out: 'On hold' },
  { type: 'Call attempt', title: 'Call attempt · Maya Khoury', time: '7 Oct, 14:25', body: 'No answer; voicemail full.', out: 'On hold' },
];
async function dColumn(parent, o) {
  const b = BIZ[o.biz || 'olive'];
  const col = AL('Business detail column', 'VERTICAL', { gap: 8 }); parent.appendChild(col); fixedCol(col, 400); fillH(col);
  const D = AL('Detail scroll area', 'VERTICAL', { gap: 12, clip: true }); put(col, D); fillH(D);
  if (o.top) await o.top(D);
  const biz = await slotCard(D, 'Card/Section', { name: 'Business · ' + b.name, title: b.name, subtitle: o.bizSub || (b.cat + ' · Assigned to you'), action: { label: 'Request correction', icon: 'flag' } });
  for (const [num, lab] of b.phones) {
    const ph = I('Row/Phone', null, { Number: num, 'Show copy': true }, 'Phone · ' + lab); prop(nested(ph, 'Label tag'), { Label: lab });
    biz.body.appendChild(ph); try { ph.resize(ph.width, 40); ph.clipsContent = true; } catch (e) { } fillW(ph); try { ph.layoutSizingVertical = 'FIXED'; } catch (e) { }
  }
  put(biz.body, kv('Website', b.web));
  const items = [];
  const hist = await slotCard(D, 'Card/Section', { name: 'Call history', title: 'Call history', subtitle: o.histSub || '3 attempts · newest first', action: { label: 'Open full history' } });
  const TL = o.history || TL_OLIVE;
  TL.forEach((t, i) => { const it = I('Timeline/Item', { Type: t.type }, { Title: t.title, Time: t.time, Body: t.body, 'Show connector': i < TL.length - 1 }, 'Timeline · ' + t.time); if (t.out) prop(nested(it, 'Outcome'), { Outcome: t.out }); put(hist.body, it); items.push(it); });
  put(hist.body, await T('Each attempt is its own record; a later outcome never changes past attempts.', 'ds/Caption', 'text/muted', { w: 300 }));
  const det = await slotCard(D, 'Card/Section', { name: 'Business details', title: 'Business details', subtitle: 'Read-only · use Request correction to fix data' });
  put(det.body, kv('Category', b.cat));
  const ig = I('Row/Social', { Metrics: 'Recorded' }, { Platform: 'Instagram', Handle: b.handle }, 'Social · Instagram'); layer(ig, 'Metrics', '2,140 followers'); put(det.body, ig);
  const fb = I('Row/Social', { Metrics: 'Not recorded' }, { Platform: 'Facebook', Handle: b.handle }, 'Social · Facebook'); layer(fb, 'Metrics', 'Not recorded'); put(det.body, fb);
  for (const [k, v] of [['Extra notes', b.notes], ['Created by', 'Karim Saleh · 2 Oct 2026 09:14']]) put(det.body, kv(k, v));
  const dc = await cueStrip(col, 1, '↓ Scroll for business details', 'Scroll cue · detail', true);
  const below = items.filter(n => relBottom(n, D) > D.height + 0.5).length;
  dc.label.characters = below ? `↓ Scroll for ${below} more history item${below > 1 ? 's' : ''} and business details` : '↓ Scroll for business details';
  OUT.fit[PREFIX + ' ' + (o.key || '') + ' detail'] = { viewportH: Math.round(D.height), historyItemsBelowFold: below, firstAttemptBottom: items[1] ? Math.round(relBottom(items[1], D)) : null };
  return { col, D };
}
function pColumn(parent, w) {
  const P = AL('Contact panel', 'VERTICAL', { fill: 'surface/default', stroke: 'border/default', radius: 'xl', clip: true }); parent.appendChild(P); fixedCol(P, w || 376); fillH(P);
  const pb = AL('Panel body', 'VERTICAL', { gap: 8, pad: [12, 16, 8, 16], clip: true }); put(P, pb); fillH(pb);
  const pf = AL('Panel footer', 'VERTICAL', { gap: 8, pad: [12, 16], fill: 'surface/default' }); topRule(pf, 'border/default'); put(P, pf);
  return { P, pb, pf };
}
async function panelTitle(pb, title, sub, actionLabel) {
  const ph = AL('Panel header', 'HORIZONTAL', { gap: 8, align: 'MIN' }); const tt = AL('Titles', 'VERTICAL', { gap: 2 });
  add(tt, await T(title, 'ds/H3', 'text/primary', { name: 'Title' })); if (sub) put(tt, await T(sub, 'ds/Caption', 'text/muted', { name: 'Sub', w: 200 }));
  ph.appendChild(tt); if (actionLabel) ph.appendChild(button('Ghost', 'Small', actionLabel)); put(pb, ph); grow(tt); return ph;
}
async function workspace(f, o) {
  const c = await deskShell(f, { user: o.user, active: o.active || 'Calling Queue' });
  await pageHeader(c, { crumb: o.crumb || ['Calling Queue', BIZ[o.biz || 'olive'].name], title: o.title || 'Contact workspace', actions: o.actions || [button('Secondary', 'Medium', 'Follow-ups & Calendar', 'calendar'), button('Ghost', 'Medium', 'Do-not-call list (1)', 'ban')] });
  const work = AL('Workspace', 'HORIZONTAL', { gap: 16 }); put(c, work); fillH(work); work.counterAxisAlignItems = 'MIN';
  const Q = o.noQueue ? null : await qColumn(work, { sel: o.sel === undefined ? BIZ[o.biz || 'olive'].name : o.sel, key: o.key, buckets: o.buckets, title: o.qTitle, count: o.qCount });
  const d = await dColumn(work, o);
  const p = pColumn(work);
  return { c, work, Q, D: d.D, ...p };
}
function radioCard(title, dot, selected, disabled) {
  const rc = I('RadioCard', { State: disabled ? 'Disabled' : selected ? 'Selected' : 'Default' }, { Title: title, Description: ' ', 'Show status dot': true }, 'Outcome · ' + title.split(' — ')[0]);
  hideLayer(rc, 'Description'); for (const fl of ['paddingTop', 'paddingBottom']) bindF(rc, fl, 'space/8', 8);
  const d = rc.findOne(n => n.name === 'Status dot'); if (d && 'fills' in d) d.fills = [paint(dot)]; return rc;
}
const OUTCOMES = [['On hold — no answer', 'status/warning/solid'], ['Needs another call — call later', 'status/info/solid'], ['Rejected — do not call', 'status/danger/solid'], ['Accepted — creates opportunity', 'status/success/solid']];
async function outcomeGroup(pb, sel, disabled) {
  const ol = AL('Outcome label', 'HORIZONTAL', { gap: 6, align: 'CENTER', justify: 'SPACE_BETWEEN' });
  add(ol, await T('Outcome *', 'ds/Label', 'text/primary', { name: 'Label' }), notice('Chip', 'D4', null, 'pending'), notice('Chip', 'DEC-005', null, 'pending')); put(pb, ol);
  const og = AL('Outcome group', 'VERTICAL', { gap: 6 }); put(pb, og);
  OUTCOMES.forEach(([t, dot], i) => put(og, radioCard(t, dot, i === sel, disabled)));
  return og;
}
// ---------- end workspace module ----------

// ---------- contact-panel module (log attempt form parts) ----------
async function followUp(pb) {
  const fu = AL('Follow-up (Needs another call)', 'VERTICAL', { gap: 8, pad: 12, fill: 'surface/subtle', stroke: 'border/subtle', radius: 'lg' }); put(pb, fu);
  const ft = AL('Follow-up title', 'HORIZONTAL', { gap: 8, align: 'CENTER', justify: 'SPACE_BETWEEN' }); put(fu, ft);
  const tabs = I('Tabs', { Style: 'Segmented', Active: '1' }, null, 'Schedule mode'); prop(nested(tabs, 'Tab 1'), { Label: 'Set now' }); prop(nested(tabs, 'Tab 2'), { Label: 'Set later' }); hideLayer(tabs, 'Tab 3'); hideLayer(tabs, 'Tab 4');
  add(ft, await T('Follow-up', 'ds/H4', 'text/primary'), tabs);
  put(fu, I('Input/Date', { Type: 'Date and time', State: 'Filled' }, { Label: 'Date and time (company timezone)', Value: 'Thu 22 Oct 2026 · 11:00', Required: true, 'Show label': true, 'Show helper': false }, 'Follow-up date and time'));
  const p = I('Input', { Type: 'Text', State: 'Filled' }, { Label: 'Purpose', Value: 'Owner back — present menu website options', 'Show label': true, Required: false, 'Show helper': false, 'Show icon': false }, 'Follow-up purpose'); put(fu, p);
  return p;
}
function notes(pb, v) { return put(pb, I('Textarea', { State: 'Filled' }, { Label: 'Notes', Value: v || 'Owner not in yet; manager asked for Thursday 11:00. Interested in online menu and table booking.', 'Show label': true, Required: false, 'Show helper': false, Counter: '104 / 2000' }, 'Notes')); }

// ---------- reservation module (SCR-CC-005 frames share the approved workspace layout) ----------
const TL_NOVA = [
  { type: 'Status change', title: 'Reassigned to Maya Khoury · Rana Haddad', time: '20 Oct, 09:15', body: 'Previous assignee: Omar Nassar. Open follow-up transferred.' },
  { type: 'Call attempt', title: 'Call attempt · Omar Nassar', time: '16 Oct, 11:45', body: 'Office manager interested in a booking page; call back 20 Oct 14:00.', out: 'Needs another call' },
  { type: 'Call attempt', title: 'Call attempt · Omar Nassar', time: '12 Oct, 10:20', body: 'Reception busy; asked to call later.', out: 'On hold' },
];
function resvBanner(D, state, title, body, policy) {
  const r = I('Banner/Reservation', { State: state, Size: 'Banner' }, { 'Show policy': policy !== false }, 'Reservation · ' + state); put(D, r);
  layer(r, 'Title', title); layer(r, 'Body', body); return r;
}
async function resvDesk(suffix, o) {
  const f = frame(suffix, false, o.dark);
  const biz = o.biz || 'olive';
  const ws = await workspace(f, { key: suffix, user: o.user, biz, noQueue: o.noQueue, active: o.active, crumb: o.crumb, history: o.history || (biz === 'nova' ? TL_NOVA : undefined), histSub: biz === 'nova' ? '2 attempts · reassigned today' : undefined, bizSub: o.bizSub,
    top: async D => { resvBanner(D, o.state, o.title, o.body, o.policy); if (o.topExtra) await o.topExtra(D); } });
  if (o.noQueue) grow(ws.D.parent);
  await o.panel(ws.pb, ws.pf, ws);
  if (o.cue !== false) {
    const cue = await cueStrip(ws.P, 1, '↓ More below', 'Scroll cue · panel', false);
    clipTo(PREFIX + ' ' + suffix + ' panel', ws.pb, cue, k => k.name.startsWith('Policy · ') ? k.name.slice(9) + ' label' : k.name);
    if (!OUT.fit[PREFIX + ' ' + suffix + ' panel'].hiddenBelow.length) cue.cue.visible = false;
  }
  return { f, ws };
}
async function draftNotes(pb, label) {
  put(pb, I('Textarea', { State: 'Filled' }, { Label: label || 'Notes (kept on this device)', Value: 'Owner not in yet; manager asked for Thursday 11:00. Interested in online menu and table booking.', 'Show label': true, Required: false, 'Show helper': false, Counter: '104 / 2000' }, 'Notes'));
}
async function footRow(pf, items, cap) {
  const row = AL('Footer actions', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(pf, row);
  items.forEach((b, i) => { row.appendChild(b); if (i === items.length - 1) fillW(b); });
  if (cap) put(pf, await T(cap, 'ds/Caption', 'text/muted', { w: 340 }));
  if (items.length > 1 && items[items.length - 1].width < 128) { row.layoutMode = 'VERTICAL'; for (const b of items) fillW(b); }
}
// ---------- end reservation module ----------

// ================= SCR-CC-005 Contact reservation & concurrency block — part b =================
getSection('SCR-CC-005 — Contact reservation & concurrency block', 'b');
async function formPanel(pb, pf, o) {
  await panelTitle(pb, 'Log call attempt', o.sub || 'Attempt: 20 Oct 2026 · 10:32', o.action);
  if (o.pre) await o.pre(pb);
  await outcomeGroup(pb, 1, o.disabled);
  if (o.followUp !== false) await followUp(pb);
  await draftNotes(pb, o.notesLabel || 'Notes');
  await footRow(pf, o.buttons, o.cap);
}
const R = [
  ['Desktop — Light — Expiring', { state: 'Expiring', title: 'Reservation ends in 2 min · 10:41', body: 'No activity for 8 min, so renewal paused (idle rule pending; times illustrative). Save now, or keep the reservation.',
    panel: (pb, pf) => formPanel(pb, pf, { action: 'Keep reservation', buttons: [button('Ghost', 'Medium', 'Save, keep reservation'), button('Primary', 'Medium', 'Save attempt')], cap: 'Reservation is released only after the save succeeds.' }) }],
  ['Desktop — Light — Reservation expired', { state: 'Expired', title: 'Reservation expired · 10:41', body: 'Another agent may now contact this business. Your notes are kept on this device; start the contact again to save them.',
    panel: (pb, pf) => formPanel(pb, pf, { sub: 'Draft · not saved', notesLabel: 'Notes (kept on this device)', pre: async pb => put(pb, banner('Warning', 'Inline', 'Saving needs a new reservation', 'Start the contact again. If someone else holds it now, you will see who and since when.')),
      buttons: [button('Ghost', 'Medium', 'Discard draft'), button('Primary', 'Medium', 'Start contact again', 'refresh')], cap: 'A new reservation is a new instance; the expired one stays in the log.' }) }],
  ['Desktop — Light — Network loss', { state: 'Offline', title: 'You are offline · since 10:38', body: 'Renewals are failing and will retry. Notes stay in the form. If the lease ends before you reconnect, the reservation expires.',
    panel: (pb, pf) => formPanel(pb, pf, { buttons: [button('Ghost', 'Medium', 'Retry now', 'refresh'), button('Primary', 'Medium', 'Save attempt', null, 'Disabled')], cap: 'Saving is paused until the connection is back. Nothing is lost.' }) }],
  ['Desktop — Light — Stale client', { state: 'Expired', title: 'Reservation no longer held', body: 'It was released from your other tab at 10:37. This page still showed it as yours; the server checks every save.',
    panel: (pb, pf) => formPanel(pb, pf, { sub: 'Draft · save not accepted', followUp: false, notesLabel: 'Notes (kept on this device)',
      pre: async pb => { put(pb, banner('Error', 'Inline', 'Save not accepted', 'The reservation behind this page had ended. Your draft is kept.')); put(pb, notice('Block', 'B3-Q05', 'Late save after losing a reservation is undecided. Alt A: reject the save and keep the draft until you re-acquire. Alt B: keep only the call attempt; outcome and follow-up need a new reservation.')); },
      buttons: [button('Ghost', 'Medium', 'Copy notes', 'copy'), button('Primary', 'Medium', 'Start contact again', 'refresh')], cap: 'Neither alternative is selected; both paths are drawn in the spec.' }) }],
];
for (const [s, o] of R) { const r = await resvDesk(s, Object.assign({ crumb: ['Calling Queue', 'Olive & Thyme Café'] }, o)); fitFrame(r.f); }
async function mob(suffix, other) {
  const f = frame(suffix, true);
  const c = await mobShell(f, { back: true, title: other ? 'Nova Dental Clinic' : 'Log call attempt', subtitle: other ? 'Clinic · Needs another call' : 'Olive & Thyme Café · draft', tab: 2, h: 596 });
  const view = AL('Viewport', 'VERTICAL', { gap: 10, clip: true }); put(c, view); fillH(view);
  if (other) {
    resvBanner(view, 'Reserved by other', 'Reserved by Omar Nassar · since 10:24', 'You can read this business but cannot start a contact until the reservation ends.');
    const s = await slotCard(view, 'Card/Inset', { name: 'Reservation details', gap: 4 });
    for (const [k, v] of [['Holder', 'Omar Nassar'], ['Since', '10:24'], ['Lease ends', '10:34 if not renewed']]) put(s.body, kv(k, v));
    const t = TL_NOVA[1]; const it = I('Timeline/Item', { Type: t.type }, { Title: t.title, Time: t.time, Body: t.body, 'Show connector': false }, 'Latest attempt'); prop(nested(it, 'Outcome'), { Outcome: t.out }); put(view, it);
    view.appendChild(notice('Chip', 'DEC-004', null, 'Times illustrative'));
  } else {
    resvBanner(view, 'Expired', 'Reservation expired · 10:41', 'Your notes are kept on this device. Start the contact again to save.');
    await outcomeGroup(view, 1); await draftNotes(view);
  }
  const cue = await cueStrip(c, c.children.length, '↓ More below', 'Scroll cue · mobile', true);
  clipTo(PREFIX + ' ' + suffix + ' viewport', view, cue, k => ({ Notes: 'Notes', 'Latest attempt': 'Latest attempt', 'Outcome group': 'Outcomes' })[k.name] || (k.name.startsWith('Policy · ') ? 'Policy label' : null));
  if (!OUT.fit[PREFIX + ' ' + suffix + ' viewport'].hiddenBelow.length) cue.cue.visible = false;
  const ft = AL('Sticky footer', 'VERTICAL', { gap: 8, pad: [12, 16], fill: 'surface/default' }); topRule(ft, 'border/default'); f.appendChild(ft);
  ft.x = 0; ft.y = 652; ft.resize(390, 128); ft.primaryAxisSizingMode = 'FIXED'; ft.counterAxisSizingMode = 'FIXED';
  if (other) { put(ft, button('Primary', 'Large', 'Start Contact', 'phone', 'Disabled')); await footRow(ft, [button('Ghost', 'Large', 'Back to queue'), button('Secondary', 'Large', 'Retry', 'refresh')]); }
  else { put(ft, button('Primary', 'Large', 'Start contact again', 'refresh')); put(ft, button('Ghost', 'Large', 'Discard draft')); }
  fitFrame(f);
}
newRow();
await mob('Mobile — Light — Reserved by another agent', true);
await mob('Mobile — Light — Reservation expired', false);
await annotations([
  ['Note', 'Expiring', 'Shown when renewals pause (idle per DEC-004) and the lease is about to end. "Keep reservation" renews; saving releases it after success.'],
  ['Note', 'Expired', 'Lease elapsed (idle, network loss, closed browser, revoked session). The business is free; the draft stays on the device. Start contact again creates a new reservation or shows the collision.'],
  ['Note', 'Network loss', 'Renewals retry until lease end. On reconnect: still held → continue; expired and free → re-acquire; held by someone else → collision with the draft kept and saving blocked.'],
  ['Note', 'Stale client (B3-Q05)', 'Every renewal and save is validated on the server. Mismatch → "Reservation no longer held". Alt A / Alt B are both shown as undecided; neither is selected.'],
  ['Interaction', 'Mobile', 'Large (48 px) footer buttons; banners fill the width. Reserved-by-other keeps Start Contact disabled with Retry and Back to queue.'],
]);
finishSection();
return OUT;
