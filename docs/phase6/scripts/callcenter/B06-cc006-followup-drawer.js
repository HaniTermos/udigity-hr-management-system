// B06-cc006-followup-drawer.js — Call Center Screen Agent — Phase 6 Batch B — page 43 HiFi — Call Center (96:5)
// Builds: SCR-CC-006 Follow-up create / reschedule (drawer). Run order B01 → B07 (sections stack in inventory order; a section is positioned only when first created).
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
function grow(n) { n.layoutGrow = 1; return n; }
function put(p, n) { p.appendChild(n); fillW(n); return n; }
function reg(k, n) { if (n) OUT.created[k] = n.id; return n; }
function notice(size, dec, body, title) { const n = I('Notice/Policy pending', { Size: size, Tone: 'Policy pending' }, size === 'Chip' ? { DEC: dec } : { DEC: dec, Body: body }, 'Policy · ' + dec); if (title) layer(n, 'Title', title); return n; }
function button(variant, size, label, icon, state) { const p = { Label: label, 'Show icon': !!icon }; if (icon) p.Icon = icon; return I('Button', { Variant: variant, Size: size, State: state || 'Default' }, p, 'Button · ' + label); }
function link(label, icon, size) { const p = { Label: label, 'Show icon': !!icon }; if (icon) p.Icon = icon; return I('Link', { Size: size || 'Small', State: 'Default' }, p, 'Link · ' + label); }
function banner(tone, size, title, body, nodeName) { return I('Banner', { Tone: tone, Size: size }, { Title: title, Body: body, 'Show title': !!title, 'Show action': false, 'Show close': false }, nodeName || 'Banner · ' + (title || body).slice(0, 30)); }
function status(tone, label, dot) { return I('Badge/Status', { Tone: tone, Size: 'Small' }, { Label: label, 'Show dot': !!dot }, 'Status · ' + label); }
function derived(label, amber) { return I('Chip/Derived', { Tone: amber ? 'Amber' : 'Neutral' }, { Label: label }, 'Derived · ' + label); }
function kv(k, v, type) { return I('List/KeyValue', { Type: type || 'Default' }, { Key: k, Value: v }, 'KV · ' + k); }
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
  SEC.appendChild(a); a.setPluginData('ccPart', PART); a.x = 80; a.y = CUR.y; a.resize(w || 1440, 100); a.counterAxisSizingMode = 'FIXED'; a.primaryAxisSizingMode = 'AUTO';
  a.setExplicitVariableModeForCollection(semCol, LIGHT);
  a.appendChild(await T(PREFIX + ' annotations (designer notes and intended interactions, not product UI)', 'ds/H3', 'text/primary'));
  for (const [type, title, body] of notes) put(a, I('Annotation', { Type: type }, { Title: title, Body: body }, 'Annotation · ' + title));
  OUT.created['annotations ' + PREFIX] = a.id; CUR.y += a.height; return a;
}
function finishSection() { let mx = 0, my = 0; for (const c of SEC.children) { mx = Math.max(mx, c.x + c.width); my = Math.max(my, c.y + c.height); } SEC.resizeWithoutConstraints(mx + 80, my + 80); OUT.fit['section ' + PREFIX] = [Math.round(SEC.x), Math.round(SEC.y), Math.round(SEC.width), Math.round(SEC.height)]; }
// ---------- end helper library ----------

// ================= SCR-CC-006 Follow-up create / reschedule (drawer) =================
getSection('SCR-CC-006 — Follow-up create / reschedule (drawer)');
async function bgRow(parent, time, name, meta, chip) {
  const row = AL('Row · ' + name, 'HORIZONTAL', { gap: 12, pad: [10, 0], align: 'CENTER' }); topRule(row, 'border/subtle'); put(parent, row);
  row.appendChild(await T(time, 'ds/Label', 'text/primary', { w: 132 }));
  const tx = AL('Text', 'VERTICAL', { gap: 2 }); row.appendChild(tx); grow(tx);
  put(tx, await T(name, 'ds/Body Strong', 'text/primary', { w: 200 })); put(tx, await T(meta, 'ds/Caption', 'text/muted', { w: 200 }));
  if (chip) row.appendChild(derived(chip[0], chip[1]));
}
async function bg(f, success) {
  const c = await deskShell(f, { active: 'Follow-ups & Calendar' });
  const tabs = I('Tabs', { Style: 'Segmented', Active: '1' }, null, 'View switch'); prop(nested(tabs, 'Tab 1'), { Label: 'List' }); prop(nested(tabs, 'Tab 2'), { Label: 'Week' }); hideLayer(tabs, 'Tab 3'); hideLayer(tabs, 'Tab 4');
  await pageHeader(c, { title: 'Follow-ups & Calendar', sub: 'Tue 20 Oct 2026 · your callback commitments · company timezone', actions: [tabs, button('Primary', 'Medium', 'Schedule follow-up', 'plus')] });
  const a = await slotCard(c, 'Card/Section', { name: 'Group · Due today', title: 'Due today · 2', subtitle: 'Scheduled for today (derived)', gap: 0 });
  await bgRow(a.body, 'Today · 10:30', 'Olive & Thyme Café', 'Owner back from supplier visit — discuss menu website', ['Due now', false]);
  await bgRow(a.body, 'Today · 14:00', 'Nova Dental Clinic', 'Confirm decision on the patient booking page', ['Due today', false]);
  const b = await slotCard(c, 'Card/Section', { name: success ? 'Group · Upcoming' : 'Group · To schedule', title: success ? 'Upcoming · 1' : 'Callback to be scheduled · 1', subtitle: success ? 'Scheduled after today' : 'Needs another call without a time yet (D2 marker)', gap: 0 });
  await bgRow(b.body, success ? 'Wed 21 Oct · 09:30' : 'Time not set', 'Cedar Home Realty', success ? 'Call back after the open house · Maya Khoury' : 'Client asked for a callback on 16 Oct', success ? null : ['To schedule', true]);
  return c;
}
async function drawer(f, title, sub, fields, foot) {
  const sc = I('Overlay/Scrim', { Size: 'Desktop' }, null, 'Overlay/Scrim'); f.appendChild(sc); sc.x = 0; sc.y = 0;
  const dr = I('Drawer', null, { Title: title, Subtitle: sub, 'Show subtitle': true }, 'Drawer · ' + title); f.appendChild(dr); dr.x = 960; dr.y = 0;
  const body = clearSlot(slotOf(dr, 'Content')), ft = clearSlot(slotOf(dr, 'Footer'));
  if (!body || !ft) { W('Drawer slots missing'); return dr; }
  const inner = AL('Drawer body', 'VERTICAL', { gap: 16 }); body.appendChild(inner); fillW(inner); inner.layoutSizingVertical = 'HUG';
  await fields(inner);
  const row = AL('Drawer actions', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); ft.appendChild(row); fillW(row);
  const sp = AL('Spacer', 'HORIZONTAL', {}); add(row, foot[0], sp, foot[1]); grow(sp);
  const sb = body.absoluteBoundingBox, ib = inner.absoluteBoundingBox;
  OUT.fit[PREFIX + ' ' + f.name.slice(SEC.name.length + 3) + ' drawer'] = { bodyFreeHeight: Math.round(sb.y + sb.height - (body.paddingBottom || 0) - (ib.y + ib.height)), innerW: Math.round(inner.width) };
  if (sb.y + sb.height - (body.paddingBottom || 0) < ib.y + ib.height) W(f.name + ': drawer body taller than its slot');
  reg(PREFIX + ' ' + f.name.slice(SEC.name.length + 3) + ' drawer', dr); return dr;
}
const dateF = (state, value, err) => I('Input/Date', { Type: 'Date and time', State: state }, { Label: 'Date and time (company timezone)', Value: value, Placeholder: 'DD MMM YYYY · HH:MM', Required: true, 'Show label': true, 'Show helper': true, Helper: 'Must be in the future.', 'Error message': err || 'Choose a time in the future.' }, 'Date and time');
function respF() { const s = I('Select', { Type: 'Person', State: 'Filled' }, { Label: 'Responsible', Value: 'Maya Khoury', Placeholder: 'Choose person', 'Show label': true, Required: true, 'Show helper': true, Helper: 'Defaults to the assignee: an active Call Center agent or the Owner.' }, 'Responsible'); const av = nested(s, 'Avatar'); if (av) prop(av, { Initials: 'MK' }); return s; }
async function createFields(b, err) {
  if (err) put(b, banner('Error', 'Inline', 'Fix 1 field to save', 'The follow-up time is in the past.'));
  else put(b, banner('Info', 'Inline', 'Clears “Callback to be scheduled”', 'Saving schedules the callback the client asked for on 16 Oct (Needs another call).'));
  put(b, err ? dateF('Error', 'Tue 20 Oct 2026 · 09:00', 'Choose a time in the future. Now: Tue 20 Oct, 10:32 (company timezone).') : dateF('Filled', 'Wed 21 Oct 2026 · 09:30'));
  put(b, respF());
  put(b, I('Input', { Type: 'Text', State: 'Filled' }, { Label: 'Purpose', Value: 'Call back after the open house', 'Show label': true, Required: false, 'Show helper': false, 'Show icon': false }, 'Purpose'));
  put(b, I('Textarea', { State: 'Filled' }, { Label: 'Note', Value: 'Agent prefers mornings; ask about property listing pages.', 'Show label': true, Required: false, 'Show helper': false, Counter: '56 / 1000' }, 'Note'));
  put(b, notice('Inline', 'No DEC ID', 'Reminder lead time and escalation are undecided. A reminder failure never changes the follow-up.'));
  put(b, await T('No contact reservation is needed to schedule outside a call.', 'ds/Caption', 'text/muted', { w: 400 }));
}
async function rescheduleFields(b, conflict) {
  if (conflict) {
    put(b, banner('Warning', 'Inline', 'This follow-up changed while you were editing', 'It was completed by a call attempt at 10:35 (Maya Khoury, other tab). Completed follow-ups are final. Nothing was overwritten.'));
    const st = I('State', { Type: 'Save conflict', Size: 'Inline' }, { 'Show action': false }, 'State · Save conflict'); put(b, st);
    layer(st, 'Title', 'Status now: Completed · 10:35'); layer(st, 'Body', 'Reload to see the latest. If another call is needed, schedule a new follow-up.');
  }
  put(b, kv('Current time', 'Tue 20 Oct 2026 · 10:30'));
  put(b, dateF('Filled', 'Thu 22 Oct 2026 · 11:00'));
  put(b, I('Select', { Type: 'Select', State: 'Filled' }, { Label: 'Reason', Value: 'Client asked for another time', Placeholder: 'Choose a reason', 'Show label': true, Required: true, 'Show helper': false }, 'Reason'));
  put(b, I('Textarea', { State: 'Filled' }, { Label: 'Note', Value: 'Manager called back: owner returns Thursday morning.', 'Show label': true, Required: false, 'Show helper': false, Counter: '51 / 1000' }, 'Note'));
  put(b, await T('Reschedule history', 'ds/H4', 'text/primary'));
  const TLH = [['Follow-up', 'Scheduled for Tue 20 Oct 10:30 · Maya Khoury', '13 Oct, 15:10', 'Created in the call save (Needs another call).']];
  for (const [ty, t, tm, bd] of TLH) put(b, I('Timeline/Item', { Type: ty }, { Title: t, Time: tm, Body: bd, 'Show connector': false }, 'History · ' + tm));
  put(b, await T('Each reschedule adds a history row (previous time, new time, by, at, reason); pending reminders are replaced.', 'ds/Caption', 'text/muted', { w: 400 }));
}
const FOOT = (l) => [button('Secondary', 'Medium', 'Cancel'), button('Primary', 'Medium', l)];
for (const [s, d] of [['Desktop — Light — Create', false], ['Desktop — Dark — Create', true]]) { const f = frame(s, false, d); await bg(f); await drawer(f, 'Schedule follow-up', 'Cedar Home Realty · Callback to be scheduled', b => createFields(b), FOOT('Save follow-up')); fitFrame(f); }
{ const f = frame('Desktop — Light — Reschedule'); await bg(f); await drawer(f, 'Reschedule follow-up', 'Olive & Thyme Café · due today 10:30', b => rescheduleFields(b), FOOT('Save new time')); fitFrame(f); }
{ const f = frame('Desktop — Light — Past time rejected'); await bg(f); await drawer(f, 'Schedule follow-up', 'Cedar Home Realty · Callback to be scheduled', b => createFields(b, true), FOOT('Save follow-up')); fitFrame(f); }
newRow();
{ const f = frame('Desktop — Light — Save conflict'); await bg(f); await drawer(f, 'Reschedule follow-up', 'Olive & Thyme Café · due today 10:30', b => rescheduleFields(b, true), [button('Secondary', 'Medium', 'Close'), button('Primary', 'Medium', 'Reload', 'refresh')]); fitFrame(f); }
{
  const f = frame('Desktop — Light — Success'); await bg(f, true);
  const t = I('Toast', { Tone: 'Success' }, { Title: 'Follow-up scheduled', Body: 'Cedar Home Realty · Wed 21 Oct 09:30. It left Callback to be scheduled.', 'Show body': true }, 'Toast · Scheduled'); f.appendChild(t);
  t.x = 1440 - 24 - t.width; t.y = 80; reg(PREFIX + ' success toast', t); fitFrame(f);
}
async function mob(suffix, err) {
  const f = frame(suffix, true);
  const h = I('Shell/Mobile/Header', { Back: 'True' }, { Title: 'Schedule follow-up', Subtitle: 'Cedar Home Realty', 'Show subtitle': true }, 'Header'); f.appendChild(h); h.x = 0; h.y = 0; h.resize(390, h.height);
  const av = nested(h, 'Avatar'); if (av) prop(av, { Initials: 'MK' });
  const c = AL('Content', 'VERTICAL', { gap: 12, pad: 16, clip: true }); f.appendChild(c); c.x = 0; c.y = 56; c.resize(390, 696); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED';
  await createFields(c, err);
  const ft = AL('Sticky footer', 'HORIZONTAL', { gap: 8, pad: [12, 16], align: 'CENTER', fill: 'surface/default' }); topRule(ft, 'border/default'); f.appendChild(ft);
  ft.x = 0; ft.y = 752; ft.resize(390, 92); ft.primaryAxisSizingMode = 'FIXED'; ft.counterAxisSizingMode = 'FIXED';
  const s = button('Primary', 'Large', 'Save follow-up'); add(ft, button('Ghost', 'Large', 'Cancel'), s); fillW(s);
  const lastVis = [...c.children].pop(); OUT.fit[PREFIX + ' ' + suffix + ' form'] = { contentH: 696, lastBottom: Math.round(relBottom(lastVis, c)) };
  fitFrame(f);
}
await mob('Mobile — Light — Create', false);
await mob('Mobile — Light — Past time rejected', true);
await annotations([
  ['Interaction', 'Open', 'Opened from the queue (Callback to be scheduled), the contact workspace, or Reschedule on SCR-CC-004. Desktop: right drawer over a scrim; mobile: full-screen sheet with sticky actions.'],
  ['Note', 'Validation', 'Time must be in the future (company timezone); responsible user must be an active Call Center agent or the Owner; Rejected businesses cannot be scheduled. Errors stay inline; nothing is saved.'],
  ['Note', 'Reschedule', 'Requires a reason; adds a history row; the follow-up stays Scheduled (self-transition); pending reminders are cancelled and replaced. Reminder timing has no DEC ID.'],
  ['Interaction', 'Save conflict / success', 'Conflict: the latest status is shown and nothing is overwritten; Reload. Success: toast, drawer closes, the row moves to its derived group and the D2 marker clears.'],
]);
finishSection();
return OUT;
