// B08-search-results.js — Data Entry Screen Agent — Phase 6 Batch B (Udigity Management System)
// Page 42 HiFi — Data Entry (96:4). Builds: SCR-SHR-010 Search results.
// Run order: 8 of 8 (B01 → B08). Spec: docs/phase6/screens/dataentry-spec.md.
// DS instances only (no detaching, no instance-child x/y/size); fills bound to Semantic variables; Light 40:1 / Dark 40:2.
// Idempotent: each section is found by name; its children are removed and rebuilt. A section is positioned only when
// first created (x 0, y = bottom of the lowest section on the page + 400; 0 on an empty page). Re-runs never move it.
// Returns created/updated IDs, fit checks (content used/available), overflow list, tap targets and warnings.
// ---------- constants ----------
const PAGE_ID = '96:4';
const SEM_ID = 'VariableCollectionId:40:3', LIGHT = '40:1', DARK = '40:2';
const CID = {
  'Shell/Desktop': '49:1926', 'Shell/Mobile': '49:2034', 'Breadcrumb': '49:1006', 'Tabs': '49:1198',
  'Card/Section': '51:1780', 'Card/Surface': '51:1772', 'Card/Inset': '51:1797',
  'Input': '45:796', 'Select': '46:434', 'Input/Date': '46:594', 'Input/Search': '46:748', 'Textarea': '45:847', 'Field/Metric': '45:891',
  'Checkbox': '45:497', 'RadioCard': '46:831', 'Chip/Filter': '46:768', 'Button': '45:305', 'IconButton': '45:405', 'Link': '45:441',
  'Notice/Policy pending': '44:549', 'Notice/Access': '53:2240', 'Badge/Status': '44:435', 'Badge/Flag': '44:491', 'Tag': '44:501',
  'Banner': '53:1960', 'Banner/ErrorSummary': '53:1964', 'Overlay/Scrim': '53:1814', 'Dialog': '53:1818', 'Drawer': '53:1846',
  'Toast': '53:2032', 'State': '53:2155', 'Skeleton': '53:2172', 'List/KeyValue': '51:1888', 'Placeholder/Box': '44:368',
  'Annotation': '44:395', 'Table/HeaderCell': '51:1599', 'Table/Cell': '51:1634', 'Table/Pagination': '51:1744', 'Timeline/Item': '54:2309',
};
const ICONS = { trash: '44:268', plus: '44:58', edit: '44:263', flag: '44:208', search: '44:13', lock: '44:133', refresh: '44:293', more: '44:183' };

// ---------- setup ----------
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const semCol = await figma.variables.getVariableCollectionByIdAsync(SEM_ID);
if (!semCol) throw new Error('Semantic collection ' + SEM_ID + ' not found');
const V = {};
for (const v of await figma.variables.getLocalVariablesAsync()) { if (v.variableCollectionId === SEM_ID) V[v.name] = v; else V['p/' + v.name] = v; }
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const GS = {}; for (const s of await figma.getLocalGridStylesAsync()) GS[s.name] = s;
const SET = {}, missing = [];
await Promise.all(Object.entries(CID).map(async ([k, id]) => { const n = await figma.getNodeByIdAsync(id); if (!n) missing.push(k + ' ' + id); else SET[k] = n; }));
if (missing.length) throw new Error('DS components not found: ' + missing.join(', '));
const W = [];
const R = { created: {}, updated: {}, warnings: W, checks: {}, overflow: [], placeholderText: [], tapTargets: {} };

// ---------- core helpers ----------
function vv(n) { const v = V[n]; if (!v) throw new Error('Missing variable ' + n); return v; }
function P(n) { return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', vv(n)); }
function bnum(n, f, x) { const v = V['p/space/' + x]; if (v) { try { n.setBoundVariable(f, v); return; } catch (e) { } } n[f] = x; }
function pad(n, t, r, b, l) { if (r == null) r = t; if (b == null) b = t; if (l == null) l = r; bnum(n, 'paddingTop', t); bnum(n, 'paddingRight', r); bnum(n, 'paddingBottom', b); bnum(n, 'paddingLeft', l); }
function gap(n, g) { bnum(n, 'itemSpacing', g); }
function AL(name, dir, g, align) { const f = figma.createAutoLayout(dir || 'HORIZONTAL'); f.name = name; f.fills = []; f.clipsContent = false; if (g != null) gap(f, g); if (align) f.counterAxisAlignItems = align; return f; }
async function T(chars, style, color, w, name) {
  const t = figma.createText(); t.fontName = { family: 'Inter', style: 'Regular' }; t.characters = chars;
  if (!TS[style]) throw new Error('Missing text style ' + style);
  await t.setTextStyleIdAsync(TS[style].id); t.fills = [P(color)]; t.name = name || chars.slice(0, 40);
  if (w) { t.textAutoResize = 'HEIGHT'; t.resize(w, Math.max(t.height, 1)); }
  return t;
}
const pv = s => Object.fromEntries(s.split(', ').map(x => x.split('=').map(y => y.trim())));
function I(name, vp, tx_, bo) {
  const n = SET[name]; let c = n;
  if (n.type === 'COMPONENT_SET') { c = n.children.find(ch => Object.entries(vp || {}).every(([k, v]) => pv(ch.name)[k] === v)); if (!c) throw new Error('No variant ' + JSON.stringify(vp) + ' in ' + name); }
  const inst = c.createInstance(); props(inst, tx_); props(inst, bo); return inst;
}
function props(inst, o) {
  if (!inst || !o) return inst;
  const cp = inst.componentProperties, upd = {}, empty = [];
  for (const [k, v] of Object.entries(o)) {
    const key = Object.keys(cp).find(x => x === k || x.split('#')[0] === k);
    if (!key) { W.push('prop ' + k + ' not on ' + inst.name); continue; }
    if (v === '') empty.push(key); else upd[key] = v;
  }
  if (Object.keys(upd).length) inst.setProperties(upd);
  for (const key of empty) { try { inst.setProperties({ [key]: '' }); } catch (e) { inst.setProperties({ [key]: ' ' }); } }
  return inst;
}
function nested(root, name) { return root ? root.findOne(n => n.type === 'INSTANCE' && n.name === name) : null; }
function tx(inst, layer, chars) { const t = inst.findOne(n => n.type === 'TEXT' && n.name === layer); if (!t) { W.push('text layer ' + layer + ' missing in ' + inst.name); return; } t.characters = chars; }
function slotOf(inst, name) {
  const s = inst.findAllWithCriteria({ types: ['SLOT'] }).find(n => n.name === (name || 'Content'));
  if (!s) throw new Error('Slot ' + (name || 'Content') + ' not found in ' + inst.name);
  for (const c of [...s.children]) c.remove(); return s;
}
function put(parent, node, fill) { parent.appendChild(node); if (fill) node.layoutSizingHorizontal = 'FILL'; return node; }
function grow(n) { n.layoutGrow = 1; return n; }
function spacer(parent) { const s = AL('Spacer', 'HORIZONTAL', 0); parent.appendChild(s); s.layoutGrow = 1; return s; }
function hug(n) { n.layoutSizingVertical = 'HUG'; return n; }

// ---------- DS instance factories (every visible text set) ----------
function btn(variant, label, o) {
  o = o || {};
  const b = I('Button', { Variant: variant, Size: o.size || 'Medium', State: o.state || 'Default' }, { Label: label }, { 'Show icon': !!o.icon });
  if (o.icon) props(b, { Icon: ICONS[o.icon] }); b.name = label; return b;
}
function iconBtn(icon, o) { o = o || {}; const b = I('IconButton', { Variant: o.variant || 'Ghost', Size: o.size || 'Medium', State: o.disabled ? 'Disabled' : 'Default' }, { Icon: ICONS[icon] }, { 'Show dot': false }); b.name = o.name || icon; return b; }
function linkI(label, size, disabled) { const l = I('Link', { Size: size || 'Small', State: disabled ? 'Disabled' : 'Default' }, { Label: label }, { 'Show icon': false }); l.name = label; return l; }
function chip(dec) { const c = I('Notice/Policy pending', { Size: 'Chip', Tone: 'Policy pending' }, { DEC: dec }); c.name = 'Policy · ' + dec; return c; }
function notice(size, dec, body) { const c = I('Notice/Policy pending', { Size: size, Tone: 'Policy pending' }, { DEC: dec, Body: body }); c.name = 'Policy · ' + dec; return c; }
function kv(k, v, type) { const n = I('List/KeyValue', { Type: type || 'Default' }, { Key: k, Value: v }); n.name = 'KV · ' + k; return n; }
function badge(tone, label, size) { const b = I('Badge/Status', { Tone: tone, Size: size || 'Small' }, { Label: label }, { 'Show dot': false }); b.name = 'Badge · ' + label; return b; }
function flag(tone, label) { const b = I('Badge/Flag', { Tone: tone }, { Label: label }); b.name = 'Flag · ' + label; return b; }
function tag(label, tone) { const t = I('Tag', { Tone: tone || 'Neutral' }, { Label: label }); t.name = 'Tag · ' + label; return t; }
function fchip(label, state) { const c = I('Chip/Filter', { State: state || 'Default' }, { Label: label }); c.name = 'Filter · ' + label; return c; }
function selectF(label, value, o) {
  o = o || {}; const st = o.err ? 'Error' : o.disabled ? 'Disabled' : value ? 'Filled' : 'Default';
  const t = { Label: label || ' ' }; if (value) t.Value = value; else t.Placeholder = o.placeholder || 'Select';
  if (o.err) t['Error message'] = o.err; else if (o.helper) t.Helper = o.helper;
  const s = I('Select', { Type: 'Select', State: st }, t, { 'Show label': !!label, Required: !!o.required, 'Show helper': !!(o.err || o.helper) });
  s.name = 'Select · ' + (label || value); return s;
}
function inputF(type, label, value, o) {
  o = o || {}; const st = o.err ? 'Error' : o.disabled ? 'Disabled' : value ? 'Filled' : 'Default';
  const t = { Label: label }; if (value) t.Value = value; else t.Placeholder = o.placeholder || ' ';
  if (st === 'Error') { t['Error message'] = o.err; if (!value) t.Value = ' '; } else if (o.helper) t.Helper = o.helper;
  if (type === 'Phone') t['Country code'] = '+000';
  const n = I('Input', { Type: type, State: st }, t, { 'Show label': true, Required: !!o.required, 'Show helper': !!(o.err || o.helper), 'Show icon': false });
  n.name = 'Input · ' + label; return n;
}
function textareaF(label, value, o) {
  o = o || {}; const st = o.err ? 'Error' : value ? 'Filled' : 'Default';
  const t = { Label: label, Counter: (value || '').length + ' / ' + (o.max || 500) };
  if (value) t.Value = value; else t.Placeholder = o.placeholder || ' ';
  if (o.err) t['Error message'] = o.err; else if (o.helper) t.Helper = o.helper;
  const n = I('Textarea', { State: st }, t, { 'Show label': true, Required: !!o.required, 'Show helper': !!(o.err || o.helper) });
  n.name = 'Textarea · ' + label; return n;
}
function searchF(value, placeholder, size) {
  const s = I('Input/Search', { Size: size || 'Medium', State: value ? 'Filled' : 'Default' }, value ? { Value: value, Placeholder: placeholder || ' ' } : { Placeholder: placeholder || 'Search' });
  s.name = 'Search'; return s;
}
function radioCard(title, desc, state) { const r = I('RadioCard', { State: state || 'Default' }, { Title: title, Description: desc }, { 'Show status dot': false }); r.name = 'Option · ' + title; return r; }
function annotation(type, title, body) { const a = I('Annotation', { Type: type }, { Title: title, Body: body }); a.name = title; return a; }
function toast(tone, title, body) { const t = I('Toast', { Tone: tone }, { Title: title, Body: body || ' ' }, { 'Show body': !!body }); t.name = 'Toast · ' + title; return t; }
function banner(tone, size, title, body, action) {
  const b = I('Banner', { Tone: tone, Size: size || 'Default' }, { Title: title, Body: body }, { 'Show title': true, 'Show action': !!action && size !== 'Inline', 'Show close': false });
  if (action && size !== 'Inline') props(nested(b, 'Action'), { Label: action });
  b.name = 'Banner · ' + title; return b;
}
function stateI(type, size, title, body, action) {
  const s = I('State', { Type: type, Size: size || 'Page' }, null, { 'Show action': !!action && type !== 'Loading' });
  tx(s, 'Title', title); if (type !== 'Loading') tx(s, 'Body', body || ' ');
  if (action && type !== 'Loading') props(nested(s, 'Action'), { Label: action });
  s.name = 'State · ' + type; return s;
}
function access(type, size, title, body, action) {
  const a = I('Notice/Access', { Type: type, Size: size || 'Page' });
  tx(a, 'Title', title); tx(a, 'Body', body);
  if (size !== 'Inline') props(nested(a, 'Action'), { Label: action || 'Back' });
  if (type === 'Context-limited') props(nested(a, 'Policy'), { DEC: 'DEC-005' });
  a.name = 'Access · ' + type; return a;
}
function tabsI(labels, active) {
  const t = I('Tabs', { Style: 'Underline', Active: String(active || 1) }); t.name = 'Tabs';
  for (let i = 0; i < 4; i++) { const it = nested(t, 'Tab ' + (i + 1)); if (!it) { W.push('Tab ' + (i + 1) + ' missing'); continue; } if (labels[i]) props(it, { Label: labels[i], 'Show count': false }); else it.visible = false; }
  return t;
}
function card(parent, title, o) {
  o = o || {};
  const c = I('Card/Section', null, { Title: title, Subtitle: o.sub || ' ' }, { 'Show subtitle': !!o.sub, 'Show action': !!o.action });
  c.name = 'Card · ' + title; put(parent, c, o.fill !== false);
  if (o.action) props(nested(c, 'Action'), { Label: o.action });
  return { inst: c, slot: slotOf(c) };
}
function surface(parent, name) { const c = I('Card/Surface'); c.name = name; put(parent, c, true); return { inst: c, slot: slotOf(c) }; }
function inset(parent, name) { const c = I('Card/Inset'); c.name = name; put(parent, c, true); return { inst: c, slot: slotOf(c) }; }
function row(name, g, align) { return AL(name, 'HORIZONTAL', g == null ? 8 : g, align || 'CENTER'); }
function col(name, g) { return AL(name, 'VERTICAL', g == null ? 12 : g); }
function wrapRow(parent, name, nodes) { const r = row(name, 8); put(parent, r, true); r.layoutWrap = 'WRAP'; r.counterAxisSpacing = 8; for (const n of nodes) r.appendChild(n); return r; }

// ---------- shells ----------
const PEOPLE = {
  'Data Entry': ['Karim Saleh', 'Data Entry', 'KS', 'Checked in · 08:51', 'Search businesses, phones, handles'],
  Owner: ['Rana Haddad', 'Owner/Admin', 'RH', 'Checked in · 08:30', 'Search businesses, phones, handles'],
  'Call Center': ['Maya Khoury', 'Call Center', 'MK', 'Checked in · 08:58', 'Search assigned businesses'],
  Developer: ['Lina Aoun', 'Developer', 'LA', 'Checked in · 09:05', 'Search deals and projects'],
};
const NAVS = {
  'Data Entry': [['MY WORK', 'BUSINESSES'], ['My Day', 'My Attendance', 'Businesses', 'Add Business', 'Correction Requests', 'Categories [DEC-015]', 'My Profile']],
  Owner: [['OVERVIEW', 'PEOPLE', 'BUSINESSES', 'CALLING', 'DELIVERY', 'ADMIN'], ['Dashboard', 'Attendance', 'Employees', 'Targets & Work Lists', 'Businesses', 'Correction Requests', 'Categories', 'Calling Assignments', 'Follow-ups & Calendar', 'Deals & Meetings', 'Projects', 'Reports & Exports', 'Audit Log', 'Delivery Monitor', 'Settings', 'My Day (check in)', 'My Profile']],
  'Call Center': [['MY WORK', 'CALLING'], ['My Day', 'My Attendance', 'Calling Queue', 'Follow-ups & Calendar', 'Opportunities & Handoffs', 'Do-not-call List', 'My Profile']],
  Developer: [['MY WORK', 'DELIVERY'], ['My Day', 'My Attendance', 'Deals', 'Meetings & Calendar', 'Projects', 'My Profile']],
};
const MTABS = { 'Data Entry': ['My Day', 'Businesses', 'Alerts', 'More'], 'Call Center': ['My Day', 'Queue', 'Follow-ups', 'More'], Developer: ['My Day', 'Tasks', 'Meetings', 'More'], Owner: ['Today', 'My Day', 'Alerts', 'More'] };
function shell(frame, role, active, query) {
  const sh = I('Shell/Desktop', { Role: role }); sh.name = 'Shell · ' + role;
  frame.appendChild(sh); sh.x = 0; sh.y = 0;
  const p = PEOPLE[role], tb = nested(sh, 'TopBar');
  if (tb) {
    props(tb, { Name: p[0], Role: p[1], 'Show attendance': true, 'Show search': true });
    props(nested(tb, 'Avatar'), { Initials: p[2] }); props(nested(tb, 'Attendance'), { Label: p[3] });
    const s = nested(tb, 'Search');
    if (s) { if (query) { try { s.setProperties({ State: 'Filled' }); } catch (e) { W.push('search state: ' + e.message); } props(s, { Value: query, Placeholder: p[4] }); } else props(s, { Placeholder: p[4] }); }
  } else W.push('TopBar not found');
  const sb = nested(sh, 'Sidebar');
  if (sb) {
    for (const l of NAVS[role][1]) { const it = nested(sb, 'Nav/Item · ' + l); if (it) props(it, { Label: l, State: l === active ? 'Active' : 'Default' }); else W.push('nav item missing: ' + l); }
    const secs = sb.findAll(n => n.type === 'INSTANCE' && n.name === 'Nav/SectionLabel');
    NAVS[role][0].forEach((l, i) => { if (secs[i]) props(secs[i], { Label: l }); });
    if (role === 'Call Center') props(nested(nested(sb, 'Nav/Item · Calling Queue'), 'Badge'), { Count: '7' });
  } else W.push('Sidebar not found');
  return sh;
}
async function content(frame) {
  const ct = figma.createFrame(); frame.appendChild(ct);
  ct.name = 'Content'; ct.fills = []; ct.layoutMode = 'VERTICAL';
  ct.resize(1200, 836); ct.primaryAxisSizingMode = 'FIXED'; ct.counterAxisSizingMode = 'FIXED';
  ct.x = 240; ct.y = 64; pad(ct, 24, 24, 16, 24); gap(ct, 16); ct.clipsContent = true;
  if (GS['ds/Grid/Desktop content 12-col']) await ct.setGridStyleIdAsync(GS['ds/Grid/Desktop content 12-col'].id);
  return ct;
}
function mShell(frame, role, o) {
  const sh = I('Shell/Mobile', { Role: role }); sh.name = 'Shell · Mobile ' + role; frame.appendChild(sh); sh.x = 0; sh.y = 0;
  let h = nested(sh, 'Header');
  if (h) {
    if (o.back) { try { h.setProperties({ Back: 'True' }); } catch (e) { W.push('header back: ' + e.message); } h = nested(sh, 'Header'); }
    props(h, { Title: o.title, Subtitle: o.sub || ' ', 'Show subtitle': !!o.sub }); props(nested(h, 'Avatar'), { Initials: PEOPLE[role][2] });
    const bk = nested(h, 'Back'); if (bk) R.tapTargets[frame.name + ' · header Back (DS)'] = Math.round(bk.height);
  } else W.push('mobile header not found');
  const tb = nested(sh, 'TabBar');
  if (tb) {
    try { tb.setProperties({ Active: String(o.tab || 1) }); } catch (e) { W.push('tabbar: ' + e.message); }
    MTABS[role].forEach((l, i) => { const t = nested(tb, 'Tab ' + (i + 1)); if (t) props(t, { Label: l }); else W.push('mobile tab ' + (i + 1) + ' missing'); });
  } else W.push('mobile tab bar not found');
  return sh;
}
async function mContent(frame, top, h) {
  const ct = AL('Content', 'VERTICAL', 12); frame.appendChild(ct);
  ct.x = 0; ct.y = top == null ? 56 : top; ct.resize(390, h || 724); ct.primaryAxisSizingMode = 'FIXED'; ct.counterAxisSizingMode = 'FIXED';
  pad(ct, 16, 16, 16, 16); ct.clipsContent = true;
  if (GS['ds/Grid/Mobile 4-col']) await ct.setGridStyleIdAsync(GS['ds/Grid/Mobile 4-col'].id);
  return ct;
}
// Mobile tap target: wrap anything under 44 px in a 44 px hit area and record the measured size.
const TAPS = [];
function tap(node) {
  if (node.height >= 44 && node.width >= 44) { TAPS.push(node); return node; }
  const parent = node.parent, idx = parent ? parent.children.indexOf(node) : -1;
  const fillH = !!parent && parent.layoutMode && parent.layoutMode !== 'NONE' && node.layoutSizingHorizontal === 'FILL';
  const w = AL('Tap area · ' + node.name, 'HORIZONTAL', 0, 'CENTER'); w.primaryAxisAlignItems = 'CENTER';
  w.appendChild(node); w.minHeight = 44; if (node.width < 44) w.minWidth = 44;
  if (parent) parent.insertChild(idx, w);
  if (fillH) { w.layoutSizingHorizontal = 'FILL'; node.layoutSizingHorizontal = 'FILL'; }
  TAPS.push(w); return w;
}
function checkTaps(frame) {
  for (const n of TAPS) { if (n.removed) continue; let p = n; while (p && p !== frame) p = p.parent; if (!p) continue; const k = frame.name.split(' — ').slice(-2).join(' ') + ' · ' + n.name; R.tapTargets[k] = Math.round(n.width) + '×' + Math.round(n.height); if (n.height < 44) W.push('tap target under 44 px: ' + k); }
}

// ---------- sections and frames ----------
async function sectionFor(name, lines) {
  let s = page.children.find(n => n.type === 'SECTION' && n.name === name);
  if (s) { for (const c of [...s.children]) c.remove(); R.updated[name] = s.id; }
  else {
    const others = page.children.filter(n => n.type === 'SECTION');
    const y = others.length ? Math.max(...others.map(n => n.y + n.height)) + 400 : 0;
    s = figma.createSection(); s.name = name; page.appendChild(s); s.x = 0; s.y = y; R.created[name] = s.id;
  }
  const h = AL('Section header', 'VERTICAL', 8); s.appendChild(h); h.x = 100; h.y = 60;
  h.appendChild(await T(name, 'ds/H1', 'text/primary', null, 'Title'));
  for (const l of lines) h.appendChild(await T(l, 'ds/Body', 'text/secondary', 1800, 'Info'));
  return { node: s, base: name, x: 100, y: 260 };
}
function screen(S, label, o) {
  o = o || {}; const w = o.mobile ? 390 : 1440, h = o.mobile ? 844 : 900;
  const f = figma.createFrame(); S.node.appendChild(f);
  f.name = S.base + ' — ' + label; f.resize(w, h); f.x = S.x; f.y = S.y; S.x += w + 120;
  f.fills = [P('surface/page')]; f.clipsContent = true;
  f.setExplicitVariableModeForCollection(semCol, o.dark ? DARK : LIGHT);
  R.created[f.name] = f.id; return f;
}
function cloneScreen(S, src, label, dark) {
  const c = src.clone(); S.node.appendChild(c);
  c.name = S.base + ' — ' + label; c.x = S.x; c.y = S.y; S.x += c.width + 120;
  c.setExplicitVariableModeForCollection(semCol, dark ? DARK : LIGHT);
  R.created[c.name] = c.id; return c;
}
async function notesColumn(S, items, pols) {
  const c = AL('Notes · ' + S.base.split(' — ')[0], 'VERTICAL', 16); S.node.appendChild(c);
  c.x = S.x; c.y = S.y; c.resize(440, 100); c.primaryAxisSizingMode = 'AUTO'; c.counterAxisSizingMode = 'FIXED';
  c.fills = [P('surface/default')]; c.strokes = [P('border/default')]; c.strokeWeight = 1; c.cornerRadius = 16; pad(c, 24, 24, 24, 24);
  c.setExplicitVariableModeForCollection(semCol, LIGHT);
  c.appendChild(await T('Notes and intended interactions', 'ds/H3', 'text/primary', null, 'Heading'));
  for (const [t, ti, b] of items) put(c, annotation(t, ti, b), true);
  if (pols && pols.length) { c.appendChild(await T('Pending policies', 'ds/H3', 'text/primary', null, 'Heading')); for (const [d, b] of pols) put(c, notice('Block', d, b), true); }
  S.x += 440 + 120; R.created[c.name] = c.id; return c;
}
function finishSection(S) {
  const s = S.node; let maxR = 0, maxB = 0;
  for (const c of s.children) { maxR = Math.max(maxR, c.x + c.width); maxB = Math.max(maxB, c.y + c.height); }
  s.resizeWithoutConstraints(Math.ceil(maxR + 100), Math.ceil(maxB + 100));
  R.checks[s.name] = { x: s.x, y: s.y, w: Math.round(s.width), h: Math.round(s.height) };
  for (const o of page.children) {
    if (o.type !== 'SECTION' || o === s) continue;
    if (o.y < s.y + s.height + 400 && o.y + o.height + 400 > s.y) W.push('section gap under 400 px / overlap: ' + s.name + ' × ' + o.name + ' (orchestrator re-flow)');
  }
}

// ---------- table (Table/HeaderCell + Table/Cell instances in local rows) ----------
function cell(v, w, right) {
  let c;
  if (v == null || typeof v === 'string') c = I('Table/Cell', { Type: right ? 'Number' : 'Text' }, { Text: v == null ? '—' : v });
  else if (v.m != null) c = I('Table/Cell', { Type: 'Text with meta' }, { Text: v.t, Meta: v.m });
  else if (v.link) { c = I('Table/Cell', { Type: 'Link' }); props(nested(c, 'Link'), { Label: v.link }); }
  if (c) { c.resize(w, 56); c.name = 'Cell'; return c; }
  const f = AL('Cell', v.stack ? 'VERTICAL' : 'HORIZONTAL', v.stack ? 4 : 6, v.stack ? 'MIN' : 'CENTER'); f.resize(w, 56);
  f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'FIXED'; pad(f, 0, 12, 0, 12);
  if (v.stack) f.primaryAxisAlignItems = 'CENTER';
  for (const n of v.n) f.appendChild(n);
  return f;
}
function table(parent, cols, rows, o) {
  o = o || {};
  const tb = AL(o.name || 'Table', 'VERTICAL', 0); parent.appendChild(tb); tb.layoutSizingHorizontal = 'FILL';
  tb.fills = [P('surface/default')]; tb.strokes = [P('border/default')]; tb.strokeWeight = 1; tb.cornerRadius = 12; tb.clipsContent = true;
  const hr = AL('Header row', 'HORIZONTAL', 0); tb.appendChild(hr);
  for (const c of cols) { const h = I('Table/HeaderCell', { Align: c.r ? 'Right' : 'Left', Sort: c.sort || 'None' }, { Label: c.l || ' ' }); h.resize(c.w, 40); h.name = 'H · ' + (c.l || 'actions'); hr.appendChild(h); }
  rows.forEach((rw, i) => {
    const r = AL(rw.name || 'Row ' + (i + 1), 'HORIZONTAL', 0, 'CENTER'); tb.appendChild(r);
    r.fills = [P(rw.muted ? 'surface/subtle' : rw.sel ? 'surface/selected' : 'surface/default')];
    r.strokes = [P('border/subtle')]; r.strokeTopWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0; r.strokeBottomWeight = 1;
    rw.c.forEach((v, j) => r.appendChild(cell(v, cols[j].w, cols[j].r)));
  });
  if (o.body) for (const n of o.body) put(tb, n, true);
  if (o.pager) { const pg = I('Table/Pagination', null, { Range: o.pager }); put(tb, pg, true); tx(pg, 'Per page', '10 per page'); }
  return tb;
}

// ---------- fit / overflow / placeholder checks ----------
const DEFAULTS = ['Dialog title', 'Short description of what happens next.', 'Drawer title', 'Section title', 'Banner title', 'Explain what happened and what to do next.', 'Column', 'Cell text', 'Meta line', 'Toast title', 'Toast body', 'DEC-000', 'Helper text', 'Schedule follow-up', 'Olive & Thyme Café moved to Follow-ups.', 'Confirm', 'Dialog content', 'Drawer content', 'Section content', 'Inset content', 'Card content'];
function shown(n, root) { let p = n; while (p && p !== root) { if (p.visible === false) return false; p = p.parent; } return true; }
function fit(frame) {
  const key = frame.name.replace(/^SCR-[A-Z]+-\d+ — [^—]+ — /, '');
  const fb = frame.absoluteBoundingBox, rec = {};
  const ct = frame.children.find(n => n.name === 'Content');
  if (ct) { let b = 0; for (const c of ct.children) if (c.visible) b = Math.max(b, c.y + c.height); rec.content = Math.round(b) + '/' + Math.round(ct.height - ct.paddingBottom); }
  for (const f of frame.findAll(n => n.type === 'FRAME' && n.clipsContent && n.layoutMode !== 'NONE' && !n.id.startsWith('I'))) {
    if (!shown(f, frame)) continue;
    const ah = f.height - (f.paddingBottom || 0), aw = f.width - (f.paddingRight || 0);
    for (const c of f.children) {
      if (!c.visible || c.layoutPositioning === 'ABSOLUTE') continue;
      if (c.y + c.height > ah + 1) R.overflow.push(frame.name + ' · ' + f.name + ' › ' + c.name + ' bottom +' + Math.round(c.y + c.height - ah));
      if (c.x + c.width > aw + 1) R.overflow.push(frame.name + ' · ' + f.name + ' › ' + c.name + ' right +' + Math.round(c.x + c.width - aw));
    }
  }
  for (const t of frame.findAll(n => n.type === 'TEXT')) {
    if (!shown(t, frame)) continue;
    const b = t.absoluteBoundingBox; if (!b) continue;
    if (b.x + b.width > fb.x + fb.width + 1 || b.y + b.height > fb.y + fb.height + 1) R.overflow.push(frame.name + ' · text past frame edge: "' + t.characters.slice(0, 30) + '"');
    if (DEFAULTS.includes(t.characters)) R.placeholderText.push(frame.name + ' · ' + t.name + ' = "' + t.characters + '"');
  }
  R.checks[key] = rec;
  return rec;
}
function slotFit(label, slot, inner) {
  const sb = slot.absoluteBoundingBox, ib = inner.absoluteBoundingBox;
  const free = Math.round(sb.y + sb.height - (slot.paddingBottom || 0) - (ib.y + ib.height));
  const spillR = Math.round(ib.x + ib.width - (sb.x + sb.width - (slot.paddingRight || 0)));
  R.checks[label] = { freeHeight: free, spillRight: spillR };
  if (free < 0) W.push(label + ': content taller than its slot by ' + (-free) + ' px');
  if (spillR > 0) W.push(label + ': content wider than its slot by ' + spillR + ' px');
}
function center(frame, node, w, h) { node.x = Math.round(((w || frame.width) - node.width) / 2); node.y = Math.max(40, Math.round(((h || frame.height) - node.height) / 2)); }
function scrimOn(frame, mobile) { const s = I('Overlay/Scrim', { Size: mobile ? 'Mobile' : 'Desktop' }); s.name = 'Scrim'; frame.appendChild(s); s.x = 0; s.y = 0; return s; }
function toastOn(frame, t, mobile) { frame.appendChild(t); if (mobile) { t.resize(358, t.height); t.x = 16; t.y = 780 - 16 - t.height; } else { t.x = 1440 - 24 - t.width; t.y = 900 - 104 - t.height; } return t; }

// =============== SCR-SHR-010 — Search results ===============
const S = await sectionFor('SCR-SHR-010 — Search results', [
  'Roles: all (scoped). UC-BIZ-008 · WF-ACCESS-001. Desktop P2 · no mobile frame required (global search is in the top bar).',
  'Frames: Data Entry Light (primary) · Dark · Owner view (hidden markers) · Empty — no hint of hidden matches (Call Center scope). Policies: DEC-001/002, DEC-003 (no leakage through search).',
]);
const SCOLS = [{ l: 'Business', w: 300 }, { l: 'Matched on', w: 200 }, { l: 'Phones', w: 220 }, { l: 'Social', w: 220 }, { l: 'Flags', w: 140 }, { l: '', w: 72 }];
const HITS = [
  ['Olive & Thyme Café', 'Café', '+000 70 000 151', '@oliveandthyme.demo', null],
  ['Sunrise Bakery', 'Shop', '+000 70 000 157', '@sunrisebakery.demo', null],
  ['Lumen Yoga Studio', 'Gym', '+000 70 000 159', '@lumenyoga.demo', null],
];
async function results(frame, o) {
  o = o || {};
  shell(frame, o.role || 'Data Entry', o.nav || 'Businesses', o.q || '70 000 15');
  const ct = await content(frame);
  const h = put(ct, AL('Page header', 'HORIZONTAL', 24, 'MIN'), true);
  const t = AL('Titles', 'VERTICAL', 4); h.appendChild(t); grow(t);
  t.appendChild(await T('Search results for “' + (o.q || '70 000 15') + '”', 'ds/H1', 'text/primary', null, 'H1'));
  const sub = row('Sub-line', 8); t.appendChild(sub);
  sub.appendChild(await T(o.sub, 'ds/Body Small', 'text/secondary', null, 'Sub-line'));
  for (const d of o.chips || ['DEC-001/002', 'DEC-003']) sub.appendChild(chip(d));
  if (o.owner) put(ct, banner('Info', 'Default', 'Owner view', 'Results include businesses hidden from other roles. Other roles never see them, or any hint that they exist.'), true);
  wrapRow(ct, 'Match type', [fchip('All (' + (o.count != null ? o.count : 3) + ')', 'Active'), fchip('Name'), fchip('Phone'), fchip('Social handle')]);
  if (o.empty) {
    const b = AL('State area', 'VERTICAL', 0, 'CENTER'); b.primaryAxisAlignItems = 'CENTER'; pad(b, 48, 0, 48, 0);
    b.appendChild(stateI('No results', 'Page', 'No businesses found', 'No business you can open matches “' + o.q + '”. Check the number, or search by name or social handle.', 'Clear search'));
    put(ct, b, true);
    return ct;
  }
  const hits = HITS.slice();
  if (o.owner) hits.splice(1, 0, ['Harbor Auto Care', 'Services', '+000 70 000 155', '@harborauto.demo', 'hidden']);
  table(ct, SCOLS, hits.map(x => ({ name: 'Result · ' + x[0], c: [{ t: x[0], m: x[1] }, { n: [badge('Neutral', 'Phone')] }, x[2], x[3], x[4] ? { n: [flag('Info', 'Hidden from others')] } : '—', { link: 'Open' }] })), { pager: 'Showing ' + hits.length + ' of ' + hits.length });
  return ct;
}
const F1 = screen(S, 'Desktop — Light'); await results(F1, { sub: '3 businesses match the phone digits. Results show only businesses you can open.' });
const F2 = cloneScreen(S, F1, 'Desktop — Dark', true);
const F3 = screen(S, 'Desktop — Light — Owner view'); await results(F3, { role: 'Owner', owner: true, count: 4, sub: '4 businesses match the phone digits.' });
const F4 = screen(S, 'Desktop — Light — Empty (Call Center scope)'); await results(F4, { role: 'Call Center', nav: 'Calling Queue', q: '70 000 155', empty: true, count: 0, sub: 'Searching businesses assigned to you.', chips: ['DEC-003'] });
await notesColumn(S, [
  ['Interaction', 'Search', 'Typing in the top-bar search and pressing Enter opens this page; phone digits are normalised, names and handles match partially. Match-type chips narrow the list. Open → Business detail (SCR-SHR-008), re-checked on open.'],
  ['Note', 'No leakage', 'Candidates are access-checked before counting. Non-owners never see hidden or context-limited businesses here, and the empty state gives no hint that a match exists (the Call Center example’s number belongs to a hidden business).'],
], [['DEC-001/002', 'Visibility window and exceptions decide which businesses appear.'], ['DEC-003', 'Search must not reveal hidden matches.']]);
for (const f of [F1, F2, F3, F4]) fit(f);
finishSection(S);
return R;
