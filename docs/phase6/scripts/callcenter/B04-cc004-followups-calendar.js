// B04-cc004-followups-calendar.js — Call Center Screen Agent — Phase 6 Batch B — page 43 HiFi — Call Center (96:5)
// Builds: SCR-CC-004 Follow-ups & calendar. Run order B01 → B07 (sections stack in inventory order; a section is positioned only when first created).
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
function reg(k, n) { if (n) OUT.created[k] = n.id; return n; }
function notice(size, dec, body, title) { const n = I('Notice/Policy pending', { Size: size, Tone: 'Policy pending' }, size === 'Chip' ? { DEC: dec } : { DEC: dec, Body: body }, 'Policy · ' + dec); if (title) layer(n, 'Title', title); return n; }
function button(variant, size, label, icon, state) { const p = { Label: label, 'Show icon': !!icon }; if (icon) p.Icon = icon; return I('Button', { Variant: variant, Size: size, State: state || 'Default' }, p, 'Button · ' + label); }
function link(label, icon, size) { const p = { Label: label, 'Show icon': !!icon }; if (icon) p.Icon = icon; return I('Link', { Size: size || 'Small', State: 'Default' }, p, 'Link · ' + label); }
function banner(tone, size, title, body, nodeName) { return I('Banner', { Tone: tone, Size: size }, { Title: title, Body: body, 'Show title': !!title, 'Show action': false, 'Show close': false }, nodeName || 'Banner · ' + (title || body).slice(0, 30)); }
function status(tone, label, dot) { return I('Badge/Status', { Tone: tone, Size: 'Small' }, { Label: label, 'Show dot': !!dot }, 'Status · ' + label); }
function derived(label, amber) { return I('Chip/Derived', { Tone: amber ? 'Amber' : 'Neutral' }, { Label: label }, 'Derived · ' + label); }
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
function slotOf(inst, name) { const s = inst.findAllWithCriteria({ types: ['SLOT'] }); return s.find(x => x.name === name) || null; }
function clearSlot(s) { if (s) for (const k of [...s.children]) k.remove(); return s; }
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

// ================= SCR-CC-004 Follow-ups & calendar =================
getSection('SCR-CC-004 — Follow-ups & calendar');
const OPEN = [
  { g: 'Overdue', time: 'Mon 19 Oct · 16:00', name: 'Sunrise Bakery', meta: 'Ask the owner about a seasonal menu page · Maya Khoury', chip: ['Overdue · 1 day', true] },
  { g: 'Due today', time: 'Today · 10:30', name: 'Olive & Thyme Café', meta: 'Owner back from supplier visit — discuss menu website · Maya Khoury', chip: ['Due now', false] },
  { g: 'Due today', time: 'Today · 14:00', name: 'Nova Dental Clinic', meta: 'Confirm decision on the patient booking page · Maya Khoury', chip: ['Due today', false] },
];
const CLOSED = [
  { time: 'Tue 13 Oct · 15:00', name: 'Olive & Thyme Café', meta: 'Completed by call attempt 13 Oct 15:10', st: ['Success', 'Completed'] },
  { time: 'Wed 14 Oct · 12:00', name: 'Bloom Florist', meta: 'Cancelled 14 Oct · reason: phone number wrong, correction requested', st: ['Neutral', 'Cancelled'] },
];
// N43-6: DEC-002 row 5 (scheduled callback visibility) is pending; Alt B is labelled, never selected
const dec002 = () => notice('Chip', 'DEC-002', null, 'Alt B pending · callback + 48 h visibility');
async function fuRow(parent, r, closed) {
  const row = AL('Follow-up · ' + r.name, 'HORIZONTAL', { gap: 12, pad: [10, 0], align: 'CENTER' }); topRule(row, 'border/subtle'); put(parent, row);
  const tm = await T(r.time, 'ds/Label', closed ? 'text/muted' : 'text/primary', { w: 132, name: 'Time' }); row.appendChild(tm);
  const tx = AL('Text', 'VERTICAL', { gap: 2 }); row.appendChild(tx); grow(tx);
  put(tx, await T(r.name, 'ds/Body Strong', 'text/primary', { w: 200, name: 'Business' })); put(tx, await T(r.meta, 'ds/Caption', 'text/muted', { w: 200, name: 'Meta' }));
  if (closed) row.appendChild(status(r.st[0], r.st[1]));
  else { const ch = AL('Chips', 'HORIZONTAL', { gap: 6, align: 'CENTER' }); add(ch, status('Info', 'Scheduled'), derived(r.chip[0], r.chip[1])); tx.appendChild(ch); add(row, button('Ghost', 'Small', 'Reschedule', 'clock'), button('Ghost', 'Small', 'Complete', 'check'), button('Ghost', 'Small', 'Cancel')); }
  return row;
}
async function viewTabs(active) {
  const t = I('Tabs', { Style: 'Segmented', Active: active }, null, 'View switch'); prop(nested(t, 'Tab 1'), { Label: 'List' }); prop(nested(t, 'Tab 2'), { Label: 'Week' }); hideLayer(t, 'Tab 3'); hideLayer(t, 'Tab 4'); return t;
}
async function header(c, active, sub) {
  await pageHeader(c, { title: 'Follow-ups & Calendar', sub: sub || 'Tue 20 Oct 2026 · your callback commitments · company timezone', actions: [await viewTabs(active), button('Primary', 'Medium', 'Schedule follow-up', 'plus')] });
}
async function toolbar(c) {
  const tb = AL('Toolbar', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(c, tb);
  for (const [l, a] of [['Open (3)', 1], ['Completed', 0], ['Cancelled', 0], ['All', 0]]) tb.appendChild(I('Chip/Filter', { State: a ? 'Active' : 'Default' }, { Label: l }, 'Chip · ' + l));
  const sp = AL('Spacer', 'HORIZONTAL', {}); tb.appendChild(sp); grow(sp);
  add(tb, derived('Due today and Overdue are derived'), notice('Chip', 'No DEC ID', null, 'Reminder timing · overdue threshold'));
}
async function listDesk(f) {
  const c = await deskShell(f, { active: 'Follow-ups & Calendar' });
  await header(c, '1'); await toolbar(c);
  put(c, banner('Warning', 'Default', 'A reminder could not be sent', 'The 13:45 email reminder for Nova Dental Clinic failed and will be retried. The follow-up itself is unaffected.'));
  const body = AL('Body', 'HORIZONTAL', { gap: 16 }); put(c, body); fillH(body); body.counterAxisAlignItems = 'MIN';
  // N43-6: the list scrolls in the S3 pattern (clipped viewport + "More below" strip in reserved space, naming hidden groups)
  const lc = AL('List column', 'VERTICAL', { gap: 8 }); body.appendChild(lc); grow(lc); fillH(lc);
  const left = AL('Open follow-ups (viewport)', 'VERTICAL', { gap: 12, clip: true }); put(lc, left); fillH(left);
  for (const g of ['Overdue', 'Due today']) {
    const rows = OPEN.filter(r => r.g === g);
    const cs = await slotCard(left, 'Card/Section', { name: 'Group · ' + g, title: `${g} · ${rows.length}`, subtitle: g === 'Overdue' ? 'Scheduled and past due (derived) · threshold pending' : 'Scheduled for today (derived, company timezone)', gap: 0 });
    if (g === 'Overdue') { const pr = AL('Policy row', 'HORIZONTAL', { gap: 8, pad: [4, 0, 8, 0], align: 'CENTER' }); put(cs.body, pr); pr.appendChild(dec002()); }
    for (const r of rows) await fuRow(cs.body, r);
  }
  const cl = await slotCard(left, 'Card/Section', { name: 'Group · Recently closed', title: 'Recently closed', subtitle: 'Completed and cancelled follow-ups are final', gap: 0 });
  for (const r of CLOSED) await fuRow(cl.body, r, true);
  const lcue = await cueStrip(lc, lc.children.length, '↓ More below', 'Scroll cue · list', true);
  clipTo(PREFIX + ' ' + f.name.split(' — ').slice(2).join(' — ') + ' list', left, lcue, k => k.name === 'Group · Recently closed' ? `Recently closed (${CLOSED.length})` : k.name.startsWith('Group · ') ? k.name.slice(8) : null);
  if (!OUT.fit[PREFIX + ' ' + f.name.split(' — ').slice(2).join(' — ') + ' list'].hiddenBelow.length) lcue.cue.visible = false;
  const right = AL('Today agenda', 'VERTICAL', { gap: 12 }); body.appendChild(right); fixedCol(right, 358);
  const day = I('Calendar/Day', null, { Date: 'Tuesday 20 October' }, 'Calendar/Day · Today'); put(right, day);
  const ev = day.findAllWithCriteria({ types: ['INSTANCE'] }).filter(n => n.componentProperties && Object.keys(n.componentProperties).some(k => k.startsWith('Time')));
  if (ev[0]) prop(ev[0], { Kind: 'Follow-up', Time: '10:30–11:00', Title: 'Call back Olive & Thyme Café' });
  if (ev[1]) prop(ev[1], { Kind: 'Follow-up', Time: '14:00–14:30', Title: 'Nova Dental Clinic — follow-up' });
  if (ev.length < 2) W('Calendar/Day events not found');
  const b = day.findAllWithCriteria({ types: ['INSTANCE'] }).find(n => n.componentProperties && Object.keys(n.componentProperties).some(k => k.startsWith('Label')) ); if (b) prop(b, { Label: 'Today' });
  put(right, await T('Owner sees every agent’s follow-ups with an agent filter. Reminders never change a follow-up (D5).', 'ds/Caption', 'text/muted', { w: 340 }));
  return c;
}
for (const [s, d] of [['Desktop — Light', false], ['Desktop — Dark', true]]) { const f = frame(s, false, d); await listDesk(f); fitFrame(f); }
{
  const f = frame('Desktop — Light — Week calendar'); const c = await deskShell(f, { active: 'Follow-ups & Calendar' });
  await header(c, '2', 'Week of Mon 19 – Sun 25 Oct 2026 · company timezone');
  const nav = AL('Week navigation', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(c, nav);
  add(nav, I('IconButton', { Variant: 'Secondary', Size: 'Small', State: 'Default' }, { Icon: 'chevron-left' }, 'Previous week'), await T('Mon 19 – Sun 25 Oct 2026', 'ds/H4', 'text/primary'), I('IconButton', { Variant: 'Secondary', Size: 'Small', State: 'Default' }, { Icon: 'chevron-right' }, 'Next week'), button('Ghost', 'Small', 'Today'));
  const sp = AL('Spacer', 'HORIZONTAL', {}); nav.appendChild(sp); grow(sp);
  add(nav, derived('Overdue is derived'), notice('Chip', 'No DEC ID', null, 'Overdue threshold'));
  const wrap = figma.createFrame(); wrap.name = 'Week wrapper'; wrap.fills = []; c.appendChild(wrap); wrap.resize(1148, 528);
  const wk = I('Calendar/Week', null, null, 'Calendar/Week'); wrap.appendChild(wk); wk.x = 0; wk.y = 0;
  for (const e of wk.findAllWithCriteria({ types: ['INSTANCE'] }).filter(n => n.componentProperties && Object.keys(n.componentProperties).some(k => k.startsWith('Time')))) e.visible = false;
  for (const [d, start, dur, kind, time, title] of [[0, 16, 0.5, 'Overdue', '16:00 · overdue', 'Sunrise Bakery'], [1, 10.5, 0.5, 'Follow-up', '10:30–11:00', 'Olive & Thyme Café'], [1, 14, 0.5, 'Follow-up', '14:00–14:30', 'Nova Dental Clinic'], [0, 9.5, 0.5, 'Done', '09:30 · completed', 'Peak Fitness Gym']]) {
    const e = I('Calendar/Event', { Kind: kind }, { Time: time, Title: title }, 'Event · ' + title); wrap.appendChild(e);
    e.resize(148, Math.max(60 * dur - 4, 44)); // titles kept to one line: two-line titles were clipped at 44 px (review CC-8)
    e.x = 56 + d * 156 + 4; e.y = 48 + (start - 9) * 60 + 2;
  }
  put(c, await T('Cancelled follow-ups are not shown on the calendar. Select an event to open it; Reschedule opens SCR-CC-006.', 'ds/Caption', 'text/muted', { w: 600 }));
  fitFrame(f);
}
{
  const f = frame('Desktop — Light — Empty'); const c = await deskShell(f, { active: 'Follow-ups & Calendar', fCount: '0' });
  const it = f.findAllWithCriteria({ types: ['INSTANCE'] }).find(n => n.name === 'Nav/Item · Follow-ups & Calendar'); if (it) prop(it, { 'Show badge': false });
  await header(c, '1');
  const box = AL('State container', 'VERTICAL', { align: 'CENTER', justify: 'CENTER', fill: 'surface/default', stroke: 'border/default', radius: 'xl' }); put(c, box); fillH(box);
  const st = I('State', { Type: 'Empty', Size: 'Page' }, { 'Show action': true }, 'State · Empty'); box.appendChild(st);
  layer(st, 'Title', 'No follow-ups scheduled'); layer(st, 'Body', 'Follow-ups you schedule while logging a call, or from the calling queue, appear here.');
  const a = nested(st, 'Action'); if (a) prop(a, { Label: 'Open calling queue' });
  fitFrame(f);
}
{
  const f = frame('Desktop — Light — Cancel with reason (D2 guard)'); await listDesk(f);
  const sc = I('Overlay/Scrim', { Size: 'Desktop' }, null, 'Overlay/Scrim'); f.appendChild(sc); sc.x = 0; sc.y = 0;
  const dl = I('Dialog', null, { Title: 'Cancel follow-up?', Description: 'Olive & Thyme Café · Tue 20 Oct 2026 · 10:30', 'Show description': true, 'Show footer': true, 'Show close': true }, 'Dialog · Cancel follow-up'); f.appendChild(dl);
  // N43-2: body built detached at the slot's inner width (stage), so the Reason textarea and the notice FILL the dialog (no 320 px fields)
  const s = slotOf(dl, 'Content') || dl.findAllWithCriteria({ types: ['SLOT'] })[0];
  const db = stage(f, s, 'Dialog body', 12, [
    I('Textarea', { State: 'Filled' }, { Label: 'Reason', Value: 'Owner travelling this week; manager will confirm a new time.', 'Show label': true, Required: true, 'Show helper': false, Counter: '58 / 500' }, 'Reason'),
    banner('Info', 'Inline', 'Last open follow-up', 'Olive & Thyme Café is Needs another call. Add a replacement, or it moves to Callback to be scheduled.'),
    I('Radio', { Selected: 'True', State: 'Default' }, { Label: 'Set "callback to be scheduled" (no time yet)' }, 'Option · marker'),
    I('Radio', { Selected: 'False', State: 'Default' }, { Label: 'Schedule a replacement follow-up now' }, 'Option · replacement'),
    await T('Cancelled is final; pending reminders are cancelled. The cancellation and reason are audited.', 'ds/Caption', 'text/muted', { w: 440 })]);
  if (db) { const ta = db.children.find(n => n.name === 'Reason'); const ov = overrun(db); OUT.fit[PREFIX + ' cancel dialog body'] = { bodyW: Math.round(db.width), reasonW: ta ? Math.round(ta.width) : null, overrun: ov }; if (ov.length) W('Cancel dialog: ' + ov.length + ' stale/overrunning layer(s), e.g. ' + ov[0] + ' (operator: re-lay-out FIXED→FILL)'); }
  const b1 = nested(dl, 'Secondary action'), b2 = nested(dl, 'Primary action');
  if (b1) prop(b1, { Label: 'Keep follow-up', 'Show icon': false }); if (b2) prop(b2, { Variant: 'Destructive', Label: 'Cancel follow-up', 'Show icon': false }); if (!b1 || !b2) W('Dialog footer buttons missing');
  dl.x = Math.round((1440 - dl.width) / 2); dl.y = Math.round((900 - dl.height) / 2);
  reg(PREFIX + ' cancel dialog', dl); fitFrame(f);
}
async function mob(suffix, dark, empty) {
  const f = frame(suffix, true, dark);
  const c = await mobShell(f, { title: 'Follow-ups', subtitle: empty ? 'Tue 20 Oct · none open' : 'Tue 20 Oct · 3 open', tab: 3 });
  c.appendChild(hit44(await viewTabs('1')));
  if (empty) { const st = I('State', { Type: 'Empty', Size: 'Inline' }, { 'Show action': false }, 'State · Empty'); put(c, st); layer(st, 'Title', 'No follow-ups scheduled'); layer(st, 'Body', 'Follow-ups you schedule from a call appear here.'); put(c, button('Secondary', 'Large', 'Open calling queue', 'phone')); fitFrame(f); return; }
  const chips = AL('Chip row (scrolls)', 'HORIZONTAL', { gap: 8 }); c.appendChild(chips);
  for (const [l, a] of [['Open · 3', 1], ['Completed', 0], ['Cancelled', 0]]) chips.appendChild(hit44(I('Chip/Filter', { State: a ? 'Active' : 'Default' }, { Label: l }, 'Chip · ' + l)));
  const view = AL('List viewport', 'VERTICAL', { gap: 8, clip: true }); put(c, view); fillH(view);
  put(view, banner('Warning', 'Inline', 'Reminder not sent', 'Nova Dental Clinic 13:45 reminder failed; it will retry. Follow-up unaffected.'));
  const li = (t, m, tone, lab, ic) => { const x = I('List/Item', { State: 'Default' }, { Title: t, Meta: m, Icon: ic || 'calendar', 'Show leading': true, 'Show badge': true, 'Show chevron': true }, 'Item · ' + t); const b = nested(x, 'Badge'); if (b) prop(b, { Tone: tone, Label: lab, 'Show dot': false }); return x; };
  const mp = AL('Policy chips', 'HORIZONTAL', { gap: 6 }); mp.layoutWrap = 'WRAP'; mp.counterAxisSpacing = 6; put(view, mp); // N43-6
  add(mp, notice('Chip', 'No DEC ID', null, 'Overdue threshold · reminder timing'), dec002());
  put(view, await T('OVERDUE (DERIVED)', 'ds/Overline', 'text/muted'));
  put(view, li('Sunrise Bakery', 'Was due Mon 19 Oct 16:00', 'Danger', 'Overdue', 'alert-circle'));
  put(view, await T('DUE TODAY (DERIVED)', 'ds/Overline', 'text/muted'));
  put(view, li('Olive & Thyme Café', 'Today 10:30 · supplier visit follow-up', 'Warning', 'Due now'));
  put(view, li('Nova Dental Clinic', 'Today 14:00 · booking page decision', 'Info', '14:00'));
  // minor: closed items are not listed under the "Open · 3" filter; they show under Completed / Cancelled
  const cue = await cueStrip(c, c.children.length, '↓ More below', 'Scroll cue · mobile list', true);
  clipTo(PREFIX + ' ' + suffix + ' list', view, cue, k => k.name.startsWith('Item · ') ? k.name.slice(7) : null);
  if (!OUT.fit[PREFIX + ' ' + suffix + ' list'].hiddenBelow.length) cue.cue.visible = false;
  fitFrame(f);
}
newRow();
await mob('Mobile — Light', false); await mob('Mobile — Dark', true); await mob('Mobile — Light — Empty', false, true);
await annotations([
  ['Note', 'Follow-up states', 'Scheduled, Completed and Cancelled are the only states (SM-FOLLOWUP-001). Due today and Overdue are derived classifications (dashed chips), not states. Completed and Cancelled are final; a new contact need creates a new follow-up.'],
  ['Interaction', 'Row actions', 'Reschedule opens SCR-CC-006 (new time + reason, history kept). Complete asks for a completion note (or happens through a linked call attempt). Cancel requires a reason; the D2 guard runs when it is the last open follow-up of a Needs another call business.'],
  ['Note', 'Reminders (D5)', 'A failed reminder is flagged and retried; it never changes or blocks the follow-up. Reminder lead time, overdue threshold and escalation have no DEC ID (pending).'],
  ['Note', 'Pending policy (N43-6)', 'DEC-002 row 5: how long a scheduled callback keeps a business visible after day 15. Alt B (exempt until callback date-time + 48 h) is labelled as pending beside the Overdue group on desktop and mobile; Alt A is not ruled out and nothing is decided. Overdue threshold and reminder timing: No DEC ID (pending), labelled on desktop and mobile.'],
  ['Note', 'List scroll (S3)', 'The desktop list scrolls in a clipped viewport; the strip beneath it names the hidden groups, e.g. "More below · Recently closed (2)". Nothing overlaps content.'],
  ['Note', 'Scope', 'Call Center sees own follow-ups; the Owner sees all with an agent filter (C1). No reservation is needed to schedule, reschedule, complete or cancel outside a call. Rejected businesses cannot get new or rescheduled follow-ups.'],
  ['Interaction', 'Mobile', 'List is the default; tap a row for the action sheet (Reschedule / Complete / Cancel). View switch and chips sit in 44 px hit areas.'],
]);
finishSection();
return OUT;
