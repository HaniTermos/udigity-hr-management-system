// B01-cc001-calling-queue.js — Call Center Screen Agent — Phase 6 Batch B — page 43 HiFi — Call Center (96:5)
// Builds: SCR-CC-001 Calling queue. Run order B01 → B07 (sections stack in inventory order; a section is positioned only when first created).
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
function grow(n) { try { if (n.name === 'Spacer' && 'children' in n && !n.children.length) { n.resize(n.width, 1); n.layoutSizingVertical = 'FIXED'; } n.layoutGrow = 1; } catch (e) { W('grow ' + n.name + ': ' + e.message); } return n; } // fit: empty spacers were 100 px tall (CC-007 Owner view Content +18)
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
function hit44(n) { const h = AL('Hit area 44 · ' + n.name, 'HORIZONTAL', { align: 'CENTER' }); h.appendChild(n); h.resize(Math.max(44, n.width), 44); h.layoutSizingVertical = 'FIXED'; h.layoutSizingHorizontal = 'HUG'; return h; }
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
  SEC.appendChild(a); a.setSharedPluginData('udigity.cc', 'ccPart', PART); a.x = 80; a.y = CUR.y; a.resize(w || 1440, 100); a.counterAxisSizingMode = 'FIXED'; a.primaryAxisSizingMode = 'AUTO';
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
    { name: 'Nova Dental Clinic', cat: 'Clinic', out: 'Needs another call', meta: 'Due 14:00 · held by Omar Nassar since 10:24', resv: 'Reserved' }] },
  { label: 'Overdue follow-ups', count: '1', exp: true, rows: [
    { name: 'Sunrise Bakery', cat: 'Shop', out: 'On hold', meta: 'Was due 19 Oct 16:00 · last attempt 15 Oct', flag: ['Danger', 'Overdue'] }] },
  { label: 'New assignments', count: '2', exp: false, rows: [] },
  { label: 'Callback to be scheduled', count: '1', exp: true, rows: [
    { name: 'Cedar Home Realty', cat: 'Real estate', out: 'Needs another call', meta: 'Time not set yet · last attempt 16 Oct' }] },
  { label: 'Data correction requested', count: '1', exp: true, rows: [
    { name: 'Bloom Florist', cat: 'Shop', out: 'On hold', meta: 'Last attempt 14 Oct 12:30', flag: ['Warning', 'Correction submitted · 14 Oct'] }] },
  { label: 'Requires contact', count: '1', exp: false, rows: [] },
];
function qRow(r, sel) {
  const row = I('Queue/Row', { State: sel ? 'Selected' : 'Default' }, { Name: r.name, Meta: r.cat + ' · ' + r.meta, 'Show flag': !!(r.flag || r.resv) }, 'Row · ' + r.name);
  const cat = nested(row, 'Category'); if (cat) cat.visible = false;
  for (const tn of ['Name', 'Meta']) { const t = row.findAllWithCriteria({ types: ['TEXT'] }).find(n => n.name === tn); if (t) { try { t.maxLines = 2; } catch (e) { } } }
  prop(nested(row, 'Outcome'), { Outcome: r.out });
  if (r.flag) prop(nested(row, 'Flag'), { Tone: r.flag[0], Label: r.flag[1] });
  if (r.resv) { const fl = nested(row, 'Flag'); try { fl.swapComponent(variantOf('Chip/Derived', { Tone: 'Amber' })); prop(fl, { Label: r.resv }); } catch (e) { W('Reserved flag: ' + e.message); if (fl) prop(fl, { Tone: 'Warning', Label: r.resv }); } } // N43-11 / O-2: derived amber flag
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
async function workspace(f, o) {
  const c = await deskShell(f, { user: o.user, active: o.active || 'Calling Queue' });
  await pageHeader(c, { crumb: o.crumb || ['Calling Queue', BIZ[o.biz || 'olive'].name], title: o.title || 'Contact workspace', actions: o.actions || [button('Secondary', 'Medium', 'Follow-ups & Calendar', 'calendar'), button('Ghost', 'Medium', 'Do-not-call list (1)', 'ban')] });
  const work = AL('Workspace', 'HORIZONTAL', { gap: 16 }); put(c, work); fillH(work); work.counterAxisAlignItems = 'MIN';
  const Q = o.noQueue ? null : await qColumn(work, { sel: o.sel === undefined ? BIZ[o.biz || 'olive'].name : o.sel, key: o.key, buckets: o.buckets, title: o.qTitle, count: o.qCount });
  const d = await dColumn(work, o);
  const p = pColumn(work);
  return { c, work, Q, D: d.D, ...p };
}
const OUTCOMES = [['On hold — no answer', 'status/warning/solid'], ['Needs another call — call later', 'status/info/solid'], ['Rejected — do not call', 'status/danger/solid'], ['Accepted — creates opportunity', 'status/success/solid']];
// ---------- end workspace module ----------

// ================= SCR-CC-001 Calling queue =================
getSection('SCR-CC-001 — Calling queue');
const COLS = [
  { over: 'DUE NOW', buckets: [QB[0], QB[1]] },
  { over: 'TO START OR SCHEDULE', buckets: [{ label: 'New assignments', count: '2', exp: true, rows: [
      { name: 'Lumen Yoga Studio', cat: 'Gym', out: 'Pending', meta: 'Assigned 19 Oct by Rana Haddad · no attempts yet' },
      { name: 'Urban Cuts Barbershop', cat: 'Salon', out: 'Pending', meta: 'Assigned 19 Oct by Rana Haddad · no attempts yet' }] }, QB[3]] },
  { over: 'NEEDS ATTENTION', buckets: [{ label: 'Requires contact', count: '1', exp: true, rows: [
      { name: 'Bloom Florist', cat: 'Shop', out: 'On hold', meta: 'Last attempt 14 Oct 12:30 · no open follow-up' }] }, QB[4]] },
];
function hideQueueBadge(f) { for (const it of f.findAllWithCriteria({ types: ['INSTANCE'] }).filter(n => n.name === 'Nav/Item · Calling Queue' || n.name === 'Nav/Item · Follow-ups & Calendar')) prop(it, { 'Show badge': false }); } // R43 minors 2-3: no counts while empty/loading/error
async function toolbar(c, owner, loading) {
  const tb = AL('Toolbar', 'HORIZONTAL', { gap: 12, align: 'CENTER' }); put(c, tb);
  const s = I('Input/Search', { Size: 'Medium', State: 'Default' }, { Placeholder: 'Filter by name or phone' }, 'Filter'); tb.appendChild(s); s.resize(240, s.height); s.layoutSizingHorizontal = 'FIXED';
  const tabs = I('Tabs', { Style: 'Segmented', Active: '1' }, null, 'Bucket filter');
  prop(nested(tabs, 'Tab 1'), { Label: 'All buckets' }); prop(nested(tabs, 'Tab 2'), { Label: loading ? 'Due today' : owner ? 'Due today (1)' : 'Due today (2)' }); prop(nested(tabs, 'Tab 3'), { Label: loading ? 'Overdue' : owner ? 'Inaccessible (1)' : 'Overdue (1)' }); hideLayer(tabs, 'Tab 4');
  tb.appendChild(tabs);
  const sp = AL('Spacer', 'HORIZONTAL', {}); tb.appendChild(sp); grow(sp);
  add(tb, derived('Buckets are derived · a business can be in 2'), notice('Chip', 'No DEC ID', null, 'Overdue threshold'));
  return tb;
}
async function board(c, cols, sel) {
  const bd = AL('Bucket board', 'HORIZONTAL', { gap: 16 }); put(c, bd); fillH(bd); bd.counterAxisAlignItems = 'MIN';
  const out = [];
  for (const col of cols) {
    const k = AL('Column · ' + col.over, 'VERTICAL', { fill: 'surface/default', stroke: 'border/default', radius: 'xl', clip: true }); bd.appendChild(k); grow(k); k.layoutSizingVertical = 'HUG';
    const oh = AL('Column label', 'HORIZONTAL', { pad: [12, 16, 8, 16] }); put(k, oh); oh.appendChild(await T(col.over, 'ds/Overline', 'text/muted'));
    for (const b of col.buckets) { put(k, bucketHeader(b)); for (const r of b.rows) put(k, qRow(r, r.name === sel)); }
    if (col.extra) await col.extra(k);
    out.push(k);
  }
  return bd;
}
async function footStrip(c, owner) {
  const fs = AL('Do-not-call strip', 'HORIZONTAL', { gap: 12, pad: [10, 16], align: 'CENTER', fill: 'surface/subtle', stroke: 'border/subtle', radius: 'lg' }); put(c, fs);
  const t = await T('Rejected businesses are excluded from every calling bucket; Start Contact is disabled for them.', 'ds/Caption', 'text/secondary', { w: 300 });
  add(fs, link(owner ? 'Do-not-call list (1)' : 'Rejected: do not call (1) — view only', 'ban'), t, notice('Chip', 'DEC-016', null, 'Reopen rule pending')); grow(t);
  fs.appendChild(await T(owner ? 'Owner view · audited' : 'No check-in needed to call', 'ds/Caption', 'text/muted'));
  return fs;
}
async function stateBox(c, type, title, body, action) {
  const box = AL('State container', 'VERTICAL', { align: 'CENTER', justify: 'CENTER', fill: 'surface/default', stroke: 'border/default', radius: 'xl' }); put(c, box); fillH(box);
  const st = I('State', { Type: type, Size: 'Page' }, { 'Show action': !!action }, 'State · ' + type); box.appendChild(st);
  layer(st, 'Title', title); if (type !== 'Loading') layer(st, 'Body', body);
  if (action) { const a = nested(st, 'Action'); if (a) prop(a, { Label: action }); }
  return st;
}
async function deskQueue(f, dark) {
  const c = await deskShell(f, { active: 'Calling Queue' });
  await pageHeader(c, { title: 'Calling queue', sub: 'Tue 20 Oct 2026 · 7 businesses assigned to you · open a business to see its history and start a contact', actions: [button('Secondary', 'Medium', 'Follow-ups & Calendar', 'calendar'), button('Ghost', 'Medium', 'Do-not-call list (1)', 'ban')] });
  await toolbar(c); await board(c, COLS, 'Olive & Thyme Café'); await footStrip(c);
  fitFrame(f); return f;
}
await deskQueue(frame('Desktop — Light'), false);
await deskQueue(frame('Desktop — Dark', false, true), true);
{
  const f = frame('Desktop — Light — Owner view');
  const c = await deskShell(f, { user: 'rana', active: 'Calling Assignments' });
  const agent = I('Select', { Type: 'Person', State: 'Filled' }, { Label: 'Agent', 'Show label': false, Required: false, Value: 'Maya Khoury', Placeholder: 'Choose agent', 'Show helper': false }, 'Agent switch');
  const av = nested(agent, 'Avatar'); if (av) prop(av, { Initials: 'MK' });
  await pageHeader(c, { crumb: ['Calling Assignments', 'Maya Khoury'], title: 'Calling queue — Maya Khoury', sub: 'Owner view · Mon 2 Nov 2026 · 4 businesses in buckets · 1 do-not-call · 1 assigned but inaccessible', actions: [agent, button('Secondary', 'Medium', 'Open Calling Assignments', 'users')] });
  agent.resize(260, agent.height); agent.layoutSizingHorizontal = 'FIXED';
  put(c, banner('Warning', 'Default', '1 assigned business is inaccessible to Maya Khoury', 'Cedar Home Realty is assigned to Maya but hidden from her by the visibility policy. Decide what happens; the system never reassigns automatically.'));
  await toolbar(c, true);
  await board(c, [
    { over: 'DUE NOW', buckets: [{ label: 'Callbacks due today', count: '1', exp: true, rows: [{ name: 'Nova Dental Clinic', cat: 'Clinic', out: 'Needs another call', meta: 'Due 11:00 · last attempt 28 Oct 10:15' }] },
      { label: 'Overdue follow-ups', count: '1', exp: true, rows: [{ name: 'Sunrise Bakery', cat: 'Shop', out: 'On hold', meta: 'Was due 30 Oct 16:00 · last attempt 27 Oct', flag: ['Danger', 'Overdue'] }] }] },
    { over: 'TO CONTACT', buckets: [{ label: 'Requires contact', count: '2', exp: true, rows: [
      { name: 'Bloom Florist', cat: 'Shop', out: 'On hold', meta: 'Last attempt 29 Oct 12:30 · no open follow-up' },
      { name: 'Urban Cuts Barbershop', cat: 'Salon', out: 'On hold', meta: 'Last attempt 30 Oct 09:40 · no open follow-up' }] },
      { label: 'Data correction requested', count: '1', exp: true, rows: [{ name: 'Bloom Florist', cat: 'Shop', out: 'On hold', meta: 'Correction open since 29 Oct', flag: ['Warning', 'Correction in review'] }] }] },
    { over: 'OWNER ONLY', buckets: [{ label: 'Assigned but inaccessible', count: '1', exp: true, rows: [
      { name: 'Cedar Home Realty', cat: 'Real estate', out: 'Needs another call', meta: 'Hidden from Maya since 31 Oct · last attempt 16 Oct', flag: ['Danger', 'Inaccessible to assignee'] }] }],
      extra: async k => {
        const d = AL('Owner decision', 'VERTICAL', { gap: 8, pad: [12, 16] }); put(k, d);
        put(d, await T('Decide for this business (audited):', 'ds/Label', 'text/primary'));
        const r = AL('Decision buttons', 'HORIZONTAL', { gap: 8 }); put(d, r);
        add(r, button('Secondary', 'Small', 'Reassign…'), button('Ghost', 'Small', 'Unassign'), button('Ghost', 'Small', 'Keep as is'));
        const ch = AL('Policy chips', 'HORIZONTAL', { gap: 6 }); put(d, ch); add(ch, notice('Chip', 'DEC-001', null, '15-day timer'), notice('Chip', 'DEC-002', null, 'Exceptions'));
        put(d, derived('Derived · from the access check, not a stored state'));
      } },
  ]);
  await footStrip(c, true);
  fitFrame(f);
}
{
  const f = frame('Desktop — Light — Empty'); const c = await deskShell(f, { active: 'Calling Queue', qCount: '0' }); hideQueueBadge(f);
  await pageHeader(c, { title: 'Calling queue', sub: 'Tue 20 Oct 2026 · no businesses assigned to you', actions: [button('Secondary', 'Medium', 'Follow-ups & Calendar', 'calendar'), button('Ghost', 'Medium', 'Do-not-call list (1)', 'ban')] });
  await stateBox(c, 'Empty', 'Your calling queue is empty', 'Businesses appear here when the Owner assigns them to you. Follow-ups you schedule bring businesses back on their due day.', 'Open Follow-ups & Calendar');
  fitFrame(f);
}
{
  const f = frame('Desktop — Light — Loading'); const c = await deskShell(f, { active: 'Calling Queue' }); hideQueueBadge(f);
  await pageHeader(c, { title: 'Calling queue', sub: 'Tue 20 Oct 2026 · loading your assigned businesses…', actions: [button('Secondary', 'Medium', 'Follow-ups & Calendar', 'calendar')] });
  await toolbar(c, false, true);
  const bd = AL('Bucket board · loading', 'HORIZONTAL', { gap: 16 }); put(c, bd); fillH(bd); bd.counterAxisAlignItems = 'MIN';
  for (let i = 0; i < 3; i++) { const k = AL('Column skeleton ' + (i + 1), 'VERTICAL', { gap: 12, pad: 16, fill: 'surface/default', stroke: 'border/default', radius: 'xl' }); bd.appendChild(k); grow(k); for (let j = 0; j < 3; j++) put(k, I('Skeleton', { Type: 'Card' }, null, 'Skeleton card')); }
  const st = I('State', { Type: 'Loading', Size: 'Inline' }, null, 'State · Loading'); put(c, st); layer(st, 'Title', 'Loading buckets… a business can appear in more than one.');
  fitFrame(f);
}
{
  const f = frame('Desktop — Light — Error'); const c = await deskShell(f, { active: 'Calling Queue' }); hideQueueBadge(f);
  await pageHeader(c, { title: 'Calling queue', sub: 'Tue 20 Oct 2026', actions: [button('Secondary', 'Medium', 'Follow-ups & Calendar', 'calendar')] });
  await stateBox(c, 'Error', 'We could not load your queue', 'Your assignments and follow-ups are safe. Check your connection and try again.', 'Try again');
  fitFrame(f);
}
async function mobQueue(f, empty) {
  const c = await mobShell(f, { title: 'Calling queue', subtitle: empty ? 'Tue 20 Oct · no businesses' : 'Tue 20 Oct · 7 businesses', tab: 2 });
  if (empty) { const st = I('State', { Type: 'Empty', Size: 'Inline' }, { 'Show action': false }, 'State · Empty'); put(c, st); layer(st, 'Title', 'Your calling queue is empty'); layer(st, 'Body', 'Businesses appear here when the Owner assigns them to you.'); put(c, button('Secondary', 'Large', 'Open Follow-ups', 'calendar')); return; }
  put(c, I('Input/Search', { Size: 'Medium', State: 'Default' }, { Placeholder: 'Filter queue' }, 'Filter'));
  const chips = AL('Chip row (scrolls)', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); c.appendChild(chips);
  for (const [l, a] of [['All', 1], ['Due today · 2', 0], ['Overdue · 1', 0], ['To schedule · 1', 0], ['New · 2', 0], ['Correction · 1', 0]]) chips.appendChild(hit44(I('Chip/Filter', { State: a ? 'Active' : 'Default' }, { Label: l }, 'Chip · ' + l)));
  c.appendChild(derived('Derived · a business can be in 2 buckets'));
  const list = AL('Queue list', 'VERTICAL', { clip: true }); put(c, list); fillH(list);
  for (const b of QB) { put(list, bucketHeader(b)); for (const r of b.rows) put(list, qRow(r, false)); }
  const cue = await cueStrip(c, c.children.length, '↓ More below', 'Scroll cue · mobile queue', true);
  const ft = AL('Do-not-call footer', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(c, ft);
  add(ft, hit44(link('Rejected (1) — view only', 'ban')), notice('Chip', 'DEC-016', null, 'Reopen pending'));
  clipTo(PREFIX + ' mobile ' + (f.name.includes('Dark') ? 'dark' : 'light') + ' queue', list, cue, k => k.name.startsWith('Bucket · ') ? k.name.slice(9) : k.name.startsWith('Row · ') ? k.name.slice(6) : null);
}
newRow();
for (const [s, d, e] of [['Mobile — Light', false, false], ['Mobile — Dark', true, false], ['Mobile — Light — Empty', false, true]]) { const f = frame(s, true, d); await mobQueue(f, e); fitFrame(f); }
await annotations([
  ['Interaction', 'Open a business', 'Selecting a row opens SCR-CC-002 Contact workspace in read mode. Start Contact (reservation) happens there, never from the queue.'],
  ['Note', 'Derived buckets', 'All buckets are derived classifications, not stored states. A business may appear in two buckets (Bloom Florist: Requires contact + Data correction requested). Each row shows the previous outcome and last attempt.'],
  ['Note', 'Rejected excluded', 'Rejected businesses never appear in callable buckets; they are reached only through the view-only Do-not-call list (SCR-CC-008). Reopening authority: DEC-016 pending.'],
  ['Note', 'Hidden items (DEC-001/002)', 'Businesses that fail the access check are omitted for the agent with no hint of existence. Only the Owner view lists them as "Assigned but inaccessible" (B7) with reassign / unassign / keep; nothing is reassigned automatically.'],
  ['Note', 'Reserved (derived, O-2)', 'Amber "Reserved" flag: another user holds the contact reservation (Nova Dental Clinic, Omar Nassar since 10:24). Derived from the reservation, not stored; Owner override · DEC-004 (Proposed) on SCR-CC-005.'],
  ['Note', 'Policies shown', 'Overdue threshold has no DEC ID (pending). No check-in is required to work the queue (contract A1). Owner view is dated Mon 2 Nov 2026 to show a later visibility change.'],
  ['Note', 'Data correction (cross-page)', 'Correction flags follow the Data Entry request states (SCR-DE-006): Submitted → In review → Resolved / Closed / Rejected / Withdrawn. The bucket shows Submitted or In review requests only; Request correction opens SCR-SHR-009 (page 42).'],
  ['Interaction', 'Mobile', 'Chip row scrolls horizontally (intentional). Chips and links sit in 44 px hit areas. The queue list scrolls; the strip under it names the hidden buckets.'],
]);
finishSection();
return OUT;
