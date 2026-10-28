// A06-shr-attendance.js — Shared Agent — Phase 6 Batch A (A06). Page 40 HiFi — Auth, Shared & Employees (96:2). Screens: SCR-SHR-004 My Attendance history.
// Spec: docs/phase6/screens/shared-spec.md · interactions: docs/phase6/interaction-spec.md §Shared. Run with use_figma (operator only).
// Idempotent: each screen's section is created once (stacked 400 px under existing sections) and never moved; its own frames are rebuilt.
const SCRIPT = 'A06-shr-attendance.js';
// ---------- Shared Agent helper library P6 (inlined in every Shared Agent Phase 6 script; same as P5 + shells/overlays/fit) ----------
// Rules: DS instances only (pages 20/21); layout frames + text bound to Semantic variables; never move/resize children of instances;
// every visible text set explicitly; sections positioned only when first created (stacked under existing sections, 400 px gap).
const PAGE_ID = '96:2';
const SEM_ID = 'VariableCollectionId:40:3', LIGHT = '40:1', DARK = '40:2';
const CID = {
  'Brand/Logo': '44:342', 'Avatar': '44:358', 'Divider': '44:364', 'Placeholder/Box': '44:368', 'Annotation': '44:395',
  'Badge/Status': '44:435', 'Badge/Count': '44:471', 'Badge/Flag': '44:491', 'Tag': '44:501', 'Chip/Derived': '44:509', 'Notice/Policy pending': '44:549',
  'Button': '45:305', 'IconButton': '45:405', 'Link': '45:441', 'Checkbox': '45:497', 'Radio': '45:522', 'Input': '45:796', 'Textarea': '45:847',
  'Select': '46:434', 'Input/Date': '46:594', 'Input/Search': '46:748', 'Chip/Filter': '46:768', 'RadioCard': '46:831',
  'Breadcrumb': '49:1006', 'Shell/Mobile/Header': '49:1219', 'Shell/Mobile/TabBar': '49:1588', 'Shell/Desktop': '49:1926', 'Shell/Mobile': '49:2034',
  'Table/HeaderCell': '51:1599', 'Table/Cell': '51:1634', 'Table/Pagination': '51:1744',
  'Card/Surface': '51:1772', 'Card/Section': '51:1780', 'Card/Inset': '51:1797', 'List/Item': '51:1870', 'List/KeyValue': '51:1888', 'Progress/Bar': '51:1916',
  'Overlay/Scrim': '53:1814', 'Dialog': '53:1818', 'Drawer': '53:1846', 'Banner': '53:1960', 'Banner/ErrorSummary': '53:1964', 'Toast': '53:2032',
  'State': '53:2155', 'Skeleton': '53:2172', 'Notice/Access': '53:2240',
  'Attendance/Timer': '55:2215', 'Attendance/VerificationStatus': '55:2243', 'Attendance/Panel': '55:2399'
};
const ICONS = Object.fromEntries('search:13,calendar:18,clock:23,chevron-down:28,chevron-up:33,chevron-left:38,chevron-right:43,check:48,x:53,plus:58,minus:63,filter:68,bell:73,user:78,users:83,home:88,building:93,phone:98,briefcase:103,folder:108,board:113,list:118,chart:123,settings:128,lock:133,eye:138,eye-off:143,alert-triangle:148,alert-circle:153,info:158,check-circle:163,x-circle:168,ban:173,menu:178,more:183,more-vertical:188,map-pin:193,wifi:198,copy:203,flag:208,shield:213,mail:218,arrow-up:223,arrow-down:228,arrow-right:233,trend-up:238,trend-down:243,spinner:248,log-out:253,download:258,edit:263,trash:268,link:273,globe:278,at-sign:283,file-text:288,refresh:293,target:298,hourglass:303,pause-circle:308,play:313,note:318,grip:323'.split(',').map(s => { const [k, v] = s.split(':'); return [k, '44:' + v]; }));
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const semCol = await figma.variables.getVariableCollectionByIdAsync(SEM_ID);
if (!semCol) throw new Error('Semantic collection ' + SEM_ID + ' not found');
const V = {};
for (const v of await figma.variables.getLocalVariablesAsync()) if (v.variableCollectionId === SEM_ID) V[v.name] = v;
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const GS = {}; for (const s of await figma.getLocalGridStylesAsync()) GS[s.name] = s;
const OUT = { script: SCRIPT, page: PAGE_ID, created: {}, updated: {}, removed: [], warnings: [], fit: {}, overflow: [] };
const warn = m => OUT.warnings.push(m);
const FITS = [], FOLD_OK = new Set();

function P(name) { const v = V[name]; if (!v) throw new Error('Missing semantic variable ' + name); return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', v); }
function fill(n, name) { n.fills = name ? [P(name)] : []; return n; }
function strokeOf(n, name, w) { n.strokes = [P(name)]; n.strokeWeight = w || 1; n.strokeAlign = 'INSIDE'; return n; }
function rule(n, top, bottom, name) { strokeOf(n, name || 'border/default'); n.strokeTopWeight = top ? 1 : 0; n.strokeBottomWeight = bottom ? 1 : 0; n.strokeLeftWeight = 0; n.strokeRightWeight = 0; return n; }
// ---- component lookup
const _nodes = {};
async function node(id) { if (!_nodes[id]) { _nodes[id] = await figma.getNodeByIdAsync(id); if (!_nodes[id]) throw new Error('DS node not found ' + id); } return _nodes[id]; }
const pv = nm => Object.fromEntries(nm.split(',').map(s => s.split('=').map(x => x.trim())));
async function variant(name, props) {
  const n = await node(CID[name]);
  if (n.type === 'COMPONENT') return n;
  const want = props || {};
  const hit = n.children.find(ch => { const p = pv(ch.name); return Object.entries(want).every(([k, v]) => p[k] === v); }) || (Object.keys(want).length ? null : n.defaultVariant);
  if (!hit) throw new Error(`No variant ${JSON.stringify(want)} in ${name}`);
  return hit;
}
function setProp(inst, prop, value) {
  const cp = inst.componentProperties;
  const key = Object.keys(cp).find(k => k === prop || k.split('#')[0] === prop);
  if (!key) { warn(`prop ${prop} not on ${inst.name}`); return; }
  let val = value;
  if (cp[key].type === 'INSTANCE_SWAP' && ICONS[value]) val = ICONS[value];
  try { inst.setProperties({ [key]: val }); }
  catch (e) { if (val === '') { try { inst.setProperties({ [key]: ' ' }); } catch (e2) { warn(`set ${prop} on ${inst.name}: ${e2.message}`); } } else warn(`set ${prop} on ${inst.name}: ${e.message}`); }
}
function setProps(inst, o) { if (inst && o) for (const [k, v] of Object.entries(o)) setProp(inst, k, v); return inst; }
// I(name, variantProps, props, layerName): instance + text/bool/swap props; warns on any TEXT prop left at its default
async function I(name, vprops, props, layerName) {
  const inst = (await variant(name, vprops)).createInstance();
  if (layerName) inst.name = layerName;
  setProps(inst, props);
  const given = Object.keys(props || {});
  for (const [k, d] of Object.entries(inst.componentProperties)) if (d.type === 'TEXT' && !given.includes(k.split('#')[0])) warn(`${inst.name}: TEXT prop ${k.split('#')[0]} left at default`);
  return inst;
}
async function icon(name, size) { const inst = (await node(ICONS[name])).createInstance(); inst.name = 'Icon/' + name; if (size && size !== 20) inst.resize(size, size); return inst; }
function nested(root, layerName) { return root.findOne(n => n.type === 'INSTANCE' && n.name === layerName); }
async function setChars(t, chars) {
  const fonts = t.fontName === figma.mixed ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName];
  for (const f of fonts) await figma.loadFontAsync(f);
  t.characters = String(chars);
}
async function setText(root, layerName, chars, parentName) {
  const t = root.findOne(n => n.type === 'TEXT' && n.name === layerName && (!parentName || (n.parent && n.parent.name === parentName)));
  if (!t) { warn(`text layer ${layerName} not found in ${root.name}`); return; }
  await setChars(t, chars);
}
async function nestedProps(root, layerName, props) { const n = nested(root, layerName); if (!n) { warn(`nested ${layerName} not found in ${root.name}`); return null; } setProps(n, props); return n; }
async function findByMain(root, setName) {
  for (const n of root.findAllWithCriteria({ types: ['INSTANCE'] })) {
    const m = await n.getMainComponentAsync(); if (!m) continue;
    const nm = m.parent && m.parent.type === 'COMPONENT_SET' ? m.parent.name : m.name;
    if (nm === setName) return n;
  }
  return null;
}
// ---- layout primitives
function AL(name, dir, o) {
  o = o || {};
  const f = figma.createAutoLayout(dir || 'VERTICAL'); f.name = name; f.fills = [];
  if (o.gap != null) f.itemSpacing = o.gap;
  if (o.pad != null) { const a = [].concat(o.pad); const [t, r, b, l] = a.length === 1 ? [a[0], a[0], a[0], a[0]] : a.length === 2 ? [a[0], a[1], a[0], a[1]] : a; f.paddingTop = t; f.paddingRight = r; f.paddingBottom = b; f.paddingLeft = l; }
  if (o.fill) fill(f, o.fill);
  if (o.stroke) strokeOf(f, o.stroke);
  if (o.radius != null) f.cornerRadius = o.radius;
  if (o.align) f.counterAxisAlignItems = o.align;
  if (o.justify) f.primaryAxisAlignItems = o.justify;
  if (o.wrap) { f.layoutWrap = 'WRAP'; f.counterAxisSpacing = o.gap == null ? 8 : o.gap; }
  if (o.w != null || o.h != null) { f.resize(o.w || Math.max(1, f.width), o.h || Math.max(1, f.height)); if (o.w != null) f.layoutSizingHorizontal = 'FIXED'; if (o.h != null) f.layoutSizingVertical = 'FIXED'; }
  if (o.clip != null) f.clipsContent = o.clip;
  return f;
}
async function TX(chars, style, color, o) {
  o = o || {};
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Regular' };
  t.characters = String(chars);
  const st = TS[style]; if (!st) throw new Error('Missing text style ' + style);
  await t.setTextStyleIdAsync(st.id);
  fill(t, color || 'text/primary');
  t.name = o.name || String(chars).slice(0, 40);
  if (o.align) t.textAlignHorizontal = o.align;
  return t;
}
function add(parent, kids, fillW) {
  for (const k of [].concat(kids)) {
    if (!k) continue;
    parent.appendChild(k);
    if (fillW) { try { if (k.type === 'TEXT') k.textAutoResize = 'HEIGHT'; k.layoutSizingHorizontal = 'FILL'; } catch (e) { warn('fill width ' + k.name + ': ' + e.message); } }
  }
  return parent;
}
function grow(n) { try { n.layoutGrow = 1; } catch (e) {} return n; }
function row(name, gap, o) { return AL(name, 'HORIZONTAL', Object.assign({ gap: gap == null ? 8 : gap, align: 'CENTER' }, o || {})); }
async function card(kind, layerName, props, gap) {
  const inst = await I(kind, null, props || {}, layerName);
  const slot = inst.findOne(n => n.type === 'SLOT');
  if (!slot) { warn(`${kind}: no SLOT found in instance ${layerName}`); return { node: inst, body: null }; }
  for (const ch of [...slot.children]) ch.remove();
  if (gap != null) { try { slot.itemSpacing = gap; } catch (e) {} }
  return { node: inst, body: slot };
}
function fillBody(c, kids) { if (c.body) add(c.body, kids, true); else warn('card body missing; children dropped for ' + c.node.name); return c; }
async function sectionCard(title, sub, kids, o) {
  o = o || {};
  const c = await card('Card/Section', o.layer || title, { Title: title, Subtitle: sub || ' ', 'Show subtitle': !!sub, 'Show action': !!o.action }, o.gap == null ? 12 : o.gap);
  if (o.action) { const a = c.node.findOne(n => n.type === 'INSTANCE' && n.name === 'Action') || await findByMain(c.node, 'Link'); if (a) setProps(a, { Label: o.action, 'Show icon': false }); else warn('Card action link not found: ' + title); }
  fillBody(c, kids); return c.node;
}
async function inset(kids, layer, gap) { const c = await card('Card/Inset', layer || 'Inset', {}, gap == null ? 8 : gap); fillBody(c, kids); return c.node; }
async function policy(size, dec, body, layerName, tone) { return I('Notice/Policy pending', { Size: size, Tone: tone || 'Policy pending' }, { DEC: dec, Body: body }, layerName || ('Policy ' + dec)); }
async function impl(body, size, dec) { return policy(size || 'Inline', dec || 'Impl. decision', body, 'Implementation note', 'Implementation decision'); }
async function chips(list, name) { const r = row(name || 'Policy chips', 8, { wrap: true }); for (const [d, b] of list) add(r, [await policy('Chip', d, b)]); return r; }
async function badge(label, tone, size, dot) { return I('Badge/Status', { Tone: tone || 'Neutral', Size: size || 'Small' }, { Label: label, 'Show dot': !!dot }, 'Badge · ' + label); }
async function derived(label, amber) { return I('Chip/Derived', { Tone: amber ? 'Amber' : 'Neutral' }, { Label: label }, 'Derived · ' + label); }
async function btn(variant, label, size, state, ic, layer) { return I('Button', { Variant: variant, Size: size || 'Medium', State: state || 'Default' }, { Label: label, 'Show icon': !!ic, Icon: ic || 'check' }, layer || label); }
async function link(label, size, ic) { return I('Link', { Size: size || 'Small', State: 'Default' }, { Label: label, 'Show icon': !!ic, Icon: ic || 'arrow-right' }, 'Link · ' + label); }
async function banner(tone, size, title, body, layer) { return I('Banner', { Tone: tone, Size: size || 'Inline' }, { Title: title, Body: body, 'Show title': !!title, 'Show action': false, 'Show close': false }, layer || 'Banner · ' + tone); }
async function toast(tone, title, body) { return I('Toast', { Tone: tone }, { Title: title, Body: body || ' ', 'Show body': !!body }, 'Toast · ' + title.slice(0, 24)); }
async function kv(k, v, type) { return I('List/KeyValue', { Type: type || 'Default' }, { Key: k, Value: v }, 'KV · ' + k); }
async function li(title, meta, ic, b, chevron) {
  const n = await I('List/Item', { State: 'Default' }, { Title: title, Meta: meta, Icon: ic || 'list', 'Show leading': !!ic, 'Show badge': !!b, 'Show chevron': chevron !== false }, 'Item · ' + title.slice(0, 30));
  if (b) { const bd = nested(n, 'Badge'); if (bd) setProps(bd, { Label: b[0], Tone: b[1] || 'Neutral', 'Show dot': false }); else warn('List badge not found'); }
  return n;
}
const BASE = { 'Show label': true, Required: false, Value: ' ', Placeholder: ' ', Helper: ' ', 'Error message': ' ', 'Show helper': false };
async function inp(type, state, o, layer) { return I('Input', { Type: type, State: state }, Object.assign({}, BASE, { 'Show icon': false, Icon: 'mail', 'Country code': '+000', Suffix: ' ' }, o), layer || o.Label); }
async function ta(state, o, layer) { return I('Textarea', { State: state }, Object.assign({}, BASE, { Counter: ' ' }, o), layer || o.Label); }
async function dt(type, state, o, layer) { return I('Input/Date', { Type: type, State: state }, Object.assign({}, BASE, o), layer || o.Label); }
async function stateBlock(type, size, title, body, action) {
  const s = await I('State', { Type: type, Size: size || 'Page' }, { 'Show action': !!action }, 'State · ' + type);
  await setText(s, 'Title', title); if (type !== 'Loading') await setText(s, 'Body', body);
  if (action) await nestedProps(s, 'Action', { Label: action, 'Show icon': false });
  return s;
}
async function access(type, size, title, body, action) {
  const s = await I('Notice/Access', { Type: type, Size: size || 'Page' }, {}, 'Access · ' + type);
  await setText(s, 'Title', title); await setText(s, 'Body', body);
  if (action) await nestedProps(s, 'Action', { Label: action, 'Show icon': false });
  return s;
}
// mobile access/state notice (Notice/Access Page is 480 wide with fixed text widths, so phones use this layout of DS icon + text styles)
async function mobNotice(ic, title, body) {
  const n = AL('Notice', 'VERTICAL', { gap: 8, pad: [24, 8], align: 'CENTER' });
  add(n, [await icon(ic, 32)]); add(n, [await TX(title, 'ds/H3', 'text/primary', { name: 'Title', align: 'CENTER' }), await TX(body, 'ds/Body Small', 'text/secondary', { name: 'Body', align: 'CENTER' })], true);
  return n;
}
// Progress/Bar value: P5 makes the bar value-driven (DS maintainer). Use its value property when present; never resize the instance's Fill child.
async function setProgress(bar, ratio) {
  if (!bar) return;
  const cp = bar.componentProperties;
  const key = Object.keys(cp).find(k => /^(value ?%|percent|progress|fill|amount|level)$/i.test(k.split('#')[0].trim()));
  if (!key) { warn(`${bar.name}: Progress/Bar has no value property yet (P5) — fill left at component default`); return; }
  const d = cp[key];
  if (d.type === 'VARIANT') {
    const m = await bar.getMainComponentAsync(); const set = m && m.parent && m.parent.type === 'COMPONENT_SET' ? m.parent : null;
    const def = set && Object.entries(set.componentPropertyDefinitions).find(([k]) => k === key);
    const opts = def ? def[1].variantOptions : [];
    let best = null, bd = 1e9; for (const o of opts) { const n = parseFloat(o); if (!isNaN(n)) { const r = n > 1 ? n / 100 : n; if (Math.abs(r - ratio) < bd) { bd = Math.abs(r - ratio); best = o; } } }
    if (best != null) setProp(bar, key, best); else warn(`${bar.name}: no numeric option on ${key}`);
  } else if (d.type === 'TEXT') setProp(bar, key, String(Math.round(ratio * 100)));
  else warn(`${bar.name}: unsupported value property type ${d.type}`);
}
// ---- people, shells (representative roles)
const PEOPLE = { 'Call Center': ['Maya Khoury', 'Call Center', 'MK', 'Search assigned businesses'], Owner: ['Rana Haddad', 'Owner/Admin', 'RH', 'Search businesses and employees'], 'Data Entry': ['Karim Saleh', 'Data Entry', 'KS', 'Search businesses'], Developer: ['Lina Aoun', 'Developer', 'LA', 'Search deals and projects'] };
const SECT = { 'Call Center': ['MY WORK', 'CALLING'], 'Data Entry': ['MY WORK', 'BUSINESSES'], Developer: ['MY WORK', 'DELIVERY'], Owner: ['OVERVIEW', 'PEOPLE', 'BUSINESSES', 'CALLING', 'DELIVERY', 'ADMIN'] };
const TABS = { Owner: [['Today', 'home'], ['My Day', 'clock'], ['Alerts', 'bell'], ['More', 'menu']], 'Data Entry': [['My Day', 'clock'], ['Businesses', 'building'], ['Alerts', 'bell'], ['More', 'menu']], 'Call Center': [['My Day', 'clock'], ['Queue', 'phone'], ['Follow-ups', 'calendar'], ['More', 'menu']], Developer: [['My Day', 'clock'], ['Tasks', 'board'], ['Meetings', 'calendar'], ['More', 'menu']] };
async function deskShell(f, role, active, att) {
  const sh = await I('Shell/Desktop', { Role: role }, {}, 'Shell');
  f.appendChild(sh); sh.x = 0; sh.y = 0;
  for (const it of sh.findAllWithCriteria({ types: ['INSTANCE'] }).filter(n => n.name.startsWith('Nav/Item · '))) {
    const label = it.name.slice('Nav/Item · '.length);
    setProps(it, { State: label === active ? 'Active' : 'Default', Label: label });
    if (label === 'Calling Queue') { setProps(it, { 'Show badge': true }); const b = nested(it, 'Badge'); if (b) setProps(b, { Count: '7' }); }
  }
  const sl = sh.findAllWithCriteria({ types: ['INSTANCE'] }).filter(n => n.name === 'Nav/SectionLabel');
  (SECT[role] || []).forEach((l, i) => { if (sl[i]) setProps(sl[i], { Label: l }); });
  const tb = nested(sh, 'TopBar'), p = PEOPLE[role];
  if (tb) {
    setProps(tb, { Name: p[0], Role: p[1], 'Show attendance': true, 'Show search': true });
    const a = att || ['Checked in · 08:58', 'Success'];
    await nestedProps(tb, 'Attendance', { Label: a[0], Tone: a[1] });
    await nestedProps(tb, 'Search', { Placeholder: p[3] });
    await nestedProps(tb, 'Notifications', { 'Show dot': true });
    await nestedProps(tb, 'Avatar', { Initials: p[2] });
  } else warn('TopBar not found in shell ' + f.name);
  return sh;
}
async function deskContent(f, gap, pad) {
  const c = AL('Content', 'VERTICAL', { gap: gap == null ? 16 : gap, pad: pad == null ? 24 : pad, clip: true });
  f.appendChild(c); c.resize(1200, 836); c.x = 240; c.y = 64; c.layoutSizingHorizontal = 'FIXED'; c.layoutSizingVertical = 'FIXED';
  const g = GS['ds/Grid/Desktop content 12-col']; if (g) await c.setGridStyleIdAsync(g.id);
  FITS.push([f.name, c]); return c;
}
async function pageHead(c, title, sub, right, crumb) {
  const r = AL('Page header', 'HORIZONTAL', { gap: 16, align: 'CENTER' });
  const t = AL('Titles', 'VERTICAL', { gap: 4 });
  add(r, [t]); grow(t);
  if (crumb) add(t, [await I('Breadcrumb', null, { 'Level 1': crumb[0], 'Level 2': crumb[2] || ' ', 'Show level 2': !!crumb[2], Current: crumb[1] }, 'Breadcrumb')]);
  add(t, [await TX(title, 'ds/H1', 'text/primary', { name: 'Title' })], true);
  if (sub) add(t, [await TX(sub, 'ds/Body', 'text/secondary', { name: 'Subtitle' })], true);
  if (right) add(r, [].concat(right));
  add(c, [r], true); return r;
}
function columns(parent, leftW, gap) {
  const r = AL('Columns', 'HORIZONTAL', { gap: gap == null ? 24 : gap }); add(parent, [r], true);
  const a = AL('Column A', 'VERTICAL', { gap: 16 }), b = AL('Column B', 'VERTICAL', { gap: 16 });
  add(r, [a, b]); a.resize(leftW, 10); a.layoutSizingHorizontal = 'FIXED'; a.layoutSizingVertical = 'HUG'; b.layoutSizingHorizontal = 'FILL'; b.layoutSizingVertical = 'HUG';
  return [a, b];
}
async function mobShell(f, role, active, title, sub) {
  const sh = await I('Shell/Mobile', { Role: role }, {}, 'Shell');
  f.appendChild(sh); sh.x = 0; sh.y = 0;
  const h = nested(sh, 'Header');
  if (h) { setProps(h, { Title: title, Subtitle: sub || ' ', 'Show subtitle': !!sub }); const av = nested(h, 'Avatar'); if (av) setProps(av, { Initials: PEOPLE[role][2] }); } else warn('Mobile header not found');
  const tb = nested(sh, 'TabBar');
  if (tb) {
    try { tb.setProperties({ Role: role, Active: String(active || 1) }); } catch (e) { warn('TabBar variant: ' + e.message); }
    for (let i = 0; i < 4; i++) { const t = nested(tb, 'Tab ' + (i + 1)); if (t) setProps(t, { Label: TABS[role][i][0], Icon: TABS[role][i][1] }); else warn('Tab ' + (i + 1) + ' not found'); }
  } else warn('TabBar not found');
  return sh;
}
async function mobHeader(f, title, sub, role) {
  const h = await I('Shell/Mobile/Header', { Back: 'True' }, { Title: title, Subtitle: sub || ' ', 'Show subtitle': !!sub }, 'Header');
  f.appendChild(h); h.x = 0; h.y = 0; const av = nested(h, 'Avatar'); if (av) setProps(av, { Initials: PEOPLE[role || 'Call Center'][2] });
  return h;
}
function mobContent(f, y, h, gap) {
  const c = AL('Content', 'VERTICAL', { pad: 16, gap: gap == null ? 12 : gap, clip: true });
  f.appendChild(c); c.x = 0; c.y = y; c.resize(390, h); c.layoutSizingHorizontal = 'FIXED'; c.layoutSizingVertical = 'FIXED';
  FITS.push([f.name, c]); return c;
}
function mobFooter(f, h) {
  const ft = AL('Footer', 'VERTICAL', { pad: [12, 16], gap: 8, fill: 'surface/default' });
  f.appendChild(ft); ft.x = 0; ft.y = 844 - h; ft.resize(390, h); ft.layoutSizingHorizontal = 'FIXED'; ft.layoutSizingVertical = 'FIXED';
  rule(ft, true, false); return ft;
}
// ---- overlays (Dialog / Drawer fill their native slots)
async function scrim(f, mobile) { const s = await I('Overlay/Scrim', { Size: mobile ? 'Mobile' : 'Desktop' }, {}, 'Scrim'); f.appendChild(s); s.x = 0; s.y = 0; return s; }
async function dialog(f, title, desc, kids, sec, pri, w) {
  const d = await I('Dialog', null, { Title: title, Description: desc || ' ', 'Show description': !!desc, 'Show footer': !!(sec || pri), 'Show close': true }, 'Dialog · ' + title);
  f.appendChild(d); if (w) d.resize(w, d.height);
  const slot = d.findOne(n => n.type === 'SLOT');
  if (slot) { for (const ch of [...slot.children]) ch.remove(); add(slot, kids, true); } else warn('Dialog slot not found');
  const s = nested(d, 'Secondary action'), p = nested(d, 'Primary action');
  if (s) { if (sec) setProps(s, Object.assign({ 'Show icon': false }, sec)); else s.visible = false; } else warn('Dialog secondary not found');
  if (p) { if (pri) setProps(p, Object.assign({ 'Show icon': false }, pri)); else p.visible = false; } else warn('Dialog primary not found');
  d.x = Math.round((1440 - d.width) / 2); d.y = Math.max(24, Math.round((900 - d.height) / 2));
  if (d.height > 852) OUT.overflow.push(f.name + ': dialog taller than frame (' + Math.round(d.height) + ')');
  return d;
}
async function drawer(f, title, sub, kids, left, right) {
  const d = await I('Drawer', null, { Title: title, Subtitle: sub || ' ', 'Show subtitle': !!sub }, 'Drawer · ' + title);
  f.appendChild(d); d.x = 960; d.y = 0;
  const slots = d.findAll(n => n.type === 'SLOT');
  if (slots.length < 2) { warn('Drawer slots not found'); return d; }
  for (const s of slots) for (const ch of [...s.children]) ch.remove();
  add(slots[0], kids, true);
  if (left) add(slots[1], [left]);
  const grp = row('Footer actions', 8, { justify: 'MAX' }); add(slots[1], [grp]); grow(grp); add(grp, right || []);
  FITS.push([f.name + ' › drawer', slots[0]]);
  return d;
}
// ---- auth layout (signed-out screens: S1 visual direction)
async function authDesk(f, kids) {
  f.layoutMode = 'HORIZONTAL'; f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'FIXED'; f.itemSpacing = 0;
  const brand = AL('Brand panel', 'VERTICAL', { pad: 64, gap: 24, fill: 'surface/brand', justify: 'SPACE_BETWEEN' });
  f.appendChild(brand); brand.resize(600, 900); brand.layoutSizingHorizontal = 'FIXED'; brand.layoutSizingVertical = 'FILL';
  const mid = AL('Brand message', 'VERTICAL', { gap: 16 });
  add(mid, [await TX('Udigity Management System', 'ds/Display', 'text/on-brand', { name: 'Product name' }), await TX('Attendance, businesses, calls and projects in one place.', 'ds/Body', 'text/on-brand-muted', { name: 'Product line' })], true);
  const foot = AL('Brand footer', 'VERTICAL', { gap: 12 });
  const acc = figma.createRectangle(); acc.name = 'Accent rule'; acc.resize(48, 3); fill(acc, 'brand/accent');
  add(foot, [acc, await TX('Internal system · authorised Udigity staff only', 'ds/Caption', 'text/on-brand-muted', { name: 'Staff only' })]);
  add(brand, [await I('Brand/Logo', { Size: 'Medium', Surface: 'On brand' }, {}, 'Logo placeholder')]); add(brand, [mid, foot], true);
  const right = AL('Panel', 'VERTICAL', { gap: 16, align: 'CENTER', justify: 'CENTER' });
  f.appendChild(right); right.layoutSizingHorizontal = 'FILL'; right.layoutSizingVertical = 'FILL';
  const c = await card('Card/Surface', 'Auth card', {}, 16);
  right.appendChild(c.node); c.node.resize(440, c.node.height); c.node.layoutSizingHorizontal = 'FIXED'; try { c.node.layoutSizingVertical = 'HUG'; } catch (e) {}
  fillBody(c, kids);
  add(right, [await TX('© 2026 Udigity · Need access? Ask the Owner/Admin.', 'ds/Caption', 'text/muted', { name: 'Footer' })]);
  return c.node;
}
async function authMob(f, kids) {
  const w = AL('Signed-out layout', 'VERTICAL', { pad: [40, 16, 24, 16], gap: 20 });
  f.appendChild(w); w.x = 0; w.y = 0; w.resize(390, 844); w.layoutSizingHorizontal = 'FIXED'; w.layoutSizingVertical = 'FIXED';
  add(w, [await I('Brand/Logo', { Size: 'Small', Surface: 'Default' }, {}, 'Logo placeholder')]);
  const c = await card('Card/Surface', 'Auth card', {}, 16); add(w, [c.node], true); fillBody(c, kids);
  add(w, [await TX('© 2026 Udigity · Need access? Ask the Owner/Admin.', 'ds/Caption', 'text/muted', { name: 'Footer', align: 'CENTER' })], true);
  FITS.push([f.name, w]); return c.node;
}
// ---- sections, frames, placement, fit (idempotent: a screen's own frames are rebuilt; its section never moves)
function getSection(name) {
  let s = page.children.find(n => n.type === 'SECTION' && n.name === name);
  if (!s) {
    let b = -400; for (const n of page.children) if (n.type === 'SECTION') b = Math.max(b, n.y + n.height);
    s = figma.createSection(); s.name = name; s.x = 0; s.y = b + 400; OUT.created['§ ' + name] = s.id;
  } else OUT.updated['§ ' + name] = s.id;
  return s;
}
function clearScreen(sec, scr) { for (const ch of [...sec.children]) if (ch.name.startsWith(scr + ' — ')) { OUT.removed.push(ch.name + ' ' + ch.id); ch.remove(); } }
function lay() { return { x: 80, y: 80, rh: 0, put(f) { f.x = this.x; f.y = this.y; this.x += f.width + 80; this.rh = Math.max(this.rh, f.height); }, row() { if (this.rh) this.y += this.rh + 120; this.x = 80; this.rh = 0; } }; }
function frame(sec, name, w, h, dark) {
  const f = figma.createFrame(); f.name = name; sec.appendChild(f);
  f.resize(w, h); f.clipsContent = true; fill(f, 'surface/page');
  f.setExplicitVariableModeForCollection(semCol, dark ? DARK : LIGHT);
  OUT.created[name] = f.id; return f;
}
function shown(n, root) { for (let p = n; p && p !== root; p = p.parent) if (p.visible === false) return false; return true; }
function fitReport(f) {
  const fb = f.absoluteBoundingBox, r = { size: Math.round(f.width) + '×' + Math.round(f.height), right: [], fold: 0, rows: [] };
  for (const t of f.findAllWithCriteria({ types: ['TEXT'] })) {
    if (!shown(t, f)) continue; const b = t.absoluteBoundingBox; if (!b) continue;
    if (b.y >= fb.y + fb.height) r.fold++; else if (b.x + b.width > fb.x + fb.width + 1) r.right.push(t.characters.slice(0, 24));
  }
  for (const n of f.findAllWithCriteria({ types: ['FRAME'] })) {
    if (n.id.startsWith('I') || n.layoutMode !== 'HORIZONTAL' || n.layoutWrap === 'WRAP' || !shown(n, f)) continue;
    const kids = n.children.filter(k => k.visible && k.layoutPositioning !== 'ABSOLUTE'); if (!kids.length) continue;
    const used = kids.reduce((s, k) => s + k.width, 0) + n.itemSpacing * (kids.length - 1) + n.paddingLeft + n.paddingRight;
    if (used > n.width + 1) r.rows.push(n.name + ' +' + Math.round(used - n.width));
  }
  for (const [nm, c] of FITS) if (nm === f.name || nm === f.name + ' › drawer') {
    const kids = c.children.filter(k => k.visible); if (!kids.length) continue;
    const used = kids.reduce((s, k) => s + k.height, 0) + (c.itemSpacing || 0) * (kids.length - 1) + (c.paddingTop || 0) + (c.paddingBottom || 0);
    r[nm === f.name ? 'content' : 'drawer'] = Math.round(used) + '/' + Math.round(c.height);
    if (used > c.height + 1) { const m = `${nm}: content ${Math.round(used - c.height)}px past the bottom` + (FOLD_OK.has(f.name) ? ' (scroll intended, annotated)' : ''); OUT.overflow.push(m); }
  }
  OUT.fit[f.name] = r;
  if (r.right.length) OUT.overflow.push(f.name + ': text past right edge: ' + r.right.slice(0, 3).join(' | '));
  if (r.rows.length) OUT.overflow.push(f.name + ': row overflow ' + r.rows.slice(0, 3).join(', '));
}
async function notes(sec, L, scr, list) {
  L.row(); const n = AL(scr + ' — Notes', 'HORIZONTAL', { gap: 24 }); sec.appendChild(n);
  for (const [type, title, body] of list) add(n, [await I('Annotation', { Type: type }, { Title: title, Body: body }, title)]);
  L.put(n); OUT.created[n.name] = n.id;
}
function finishSection(sec) { let mx = 0, my = 0; for (const c of sec.children) { mx = Math.max(mx, c.x + c.width); my = Math.max(my, c.y + c.height); } sec.resizeWithoutConstraints(mx + 80, my + 80); }
function overlapCheck() {
  const s = page.children.filter(n => n.type === 'SECTION');
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { const a = s[i], b = s[j]; if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) OUT.warnings.push('Section overlap: ' + a.name + ' × ' + b.name); }
  OUT.sections = s.map(n => `${n.name} ${n.id} @${Math.round(n.x)},${Math.round(n.y)} ${Math.round(n.width)}×${Math.round(n.height)}`);
}
// screen(scr, name): section + clear + layout cursor; F(...) frame name helper
const FN = (scr, nm, dev, th, st) => `${scr} — ${nm} — ${dev} — ${th}${st ? ' — ' + st : ''}`;
function screen(scr, nm) { const sec = getSection(`${scr} — ${nm}`); clearScreen(sec, scr); return { sec, L: lay(), scr, nm }; }
// ---------- end helper library ----------
// ---- My Attendance building blocks (shared by A06/A07)
// Fix R40-06: Check-out 140→180 so "Corrected · was 17:20" shows the original time in full (Punctuality 180→160, action 190→170; total 1152 unchanged).
const COLS = [['Date', 180], ['Check-in', 110], ['Check-out', 180], ['Duration', 120, 'Right'], ['Punctuality', 160], ['Status', 232], ['', 170]];
async function cell(spec, w) {
  if (typeof spec === 'string') spec = { t: 'text', v: spec };
  if (spec.t === 'chip' || spec.t === 'flag') {
    const c = AL('Cell · ' + spec.v, 'HORIZONTAL', { pad: [0, 12], gap: 6, align: 'CENTER', w, h: 56 });
    add(c, [spec.t === 'chip' ? await derived(spec.v, spec.amber) : await I('Badge/Flag', { Tone: spec.tone || 'Warning' }, { Label: spec.v }, 'Flag · ' + spec.v)]);
    return c;
  }
  const type = { text: 'Text', meta: 'Text with meta', status: 'Status', link: 'Link', num: 'Number' }[spec.t];
  const c = await I('Table/Cell', { Type: type }, { Text: spec.v || ' ', Meta: spec.m || ' ' }, 'C · ' + (spec.v || type).slice(0, 24));
  c.resize(w, 56);
  if (spec.t === 'status') await nestedProps(c, 'Status', { Label: spec.v, Tone: spec.tone || 'Neutral', 'Show dot': false });
  if (spec.t === 'link') await nestedProps(c, 'Link', { Label: spec.v, 'Show icon': false });
  return c;
}
async function table(rows) {
  const t = AL('Sessions table', 'VERTICAL', { fill: 'surface/default', stroke: 'border/default', radius: 12, clip: true });
  const hr = AL('Header row', 'HORIZONTAL', {});
  for (const [l, w, al] of COLS) { const h = await I('Table/HeaderCell', { Align: al || 'Left', Sort: l === 'Date' ? 'Descending' : 'None' }, { Label: l || ' ' }, 'H · ' + (l || 'Action')); h.resize(w, 40); hr.appendChild(h); }
  add(t, [hr]);
  for (const r of rows) { const rr = AL('Row', 'HORIZONTAL', { fill: 'surface/default' }); rule(rr, false, true, 'border/subtle'); for (let i = 0; i < COLS.length; i++) rr.appendChild(await cell(r[i], COLS[i][1])); add(t, [rr]); }
  return t;
}
const ON = { t: 'chip', v: 'On time' }, LATE = { t: 'chip', v: 'Late', amber: true }, CLOSED = { t: 'status', v: 'Closed' }, VIEW = { t: 'link', v: 'View' };
const BASE_ROWS = [
  [{ t: 'meta', v: 'Mon 19 Oct', m: 'Call Center' }, '08:52', '18:01', { t: 'num', v: '9h 09m' }, ON, CLOSED, VIEW],
  [{ t: 'meta', v: 'Fri 16 Oct', m: 'Call Center' }, '09:14', '18:20', { t: 'num', v: '9h 06m' }, LATE, CLOSED, VIEW],
  [{ t: 'meta', v: 'Thu 15 Oct', m: 'Call Center' }, '08:55', '17:40', { t: 'num', v: '8h 45m' }, ON, CLOSED, VIEW],
  [{ t: 'meta', v: 'Wed 14 Oct', m: 'Call Center' }, '08:50', '18:00', { t: 'num', v: '9h 10m' }, ON, CLOSED, VIEW],
  [{ t: 'meta', v: 'Tue 13 Oct', m: 'Call Center' }, '08:57', '18:05', { t: 'num', v: '9h 08m' }, ON, CLOSED, VIEW]
];
function rowsFor(st) {
  const today = [{ t: 'meta', v: 'Tue 20 Oct', m: 'Today' }, '08:58', 'Not yet', { t: 'num', v: '5h 34m' }, ON, { t: 'status', v: 'Open', tone: 'Info' }, VIEW];
  if (st === 'Forgotten checkout flagged') return [
    [{ t: 'meta', v: 'Tue 20 Oct', m: 'Today' }, '—', '—', { t: 'num', v: '—' }, { t: 'text', v: 'Not checked in' }, { t: 'status', v: 'Check-in blocked', tone: 'Warning' }, VIEW],
    [{ t: 'meta', v: 'Mon 19 Oct', m: 'Call Center' }, '08:47', 'Not recorded', { t: 'num', v: '—' }, ON, { t: 'flag', v: 'Forgotten checkout' }, { t: 'link', v: 'Request correction' }], ...BASE_ROWS.slice(1)];
  if (st === 'Provisional / pending review rows (if adopted)') return [today,
    [{ t: 'meta', v: 'Mon 19 Oct', m: 'Office check failed' }, '08:52', '18:01', { t: 'num', v: '9h 09m' }, ON, { t: 'status', v: 'Provisional · DEC-026 Alt B', tone: 'Warning' }, VIEW],
    [{ t: 'meta', v: 'Fri 16 Oct', m: 'Office check failed' }, '09:14', '18:20 requested', { t: 'num', v: '—' }, LATE, { t: 'status', v: 'Pending review · Alt C', tone: 'Info' }, VIEW], ...BASE_ROWS.slice(2)];
  if (st === 'Correction outcomes') return [today,
    [{ t: 'meta', v: 'Mon 19 Oct', m: 'Request sent 20 Oct 08:40' }, '08:47', { t: 'meta', v: '18:05 proposed', m: 'Recorded: none' }, { t: 'num', v: '—' }, ON, { t: 'status', v: 'Correction pending', tone: 'Warning' }, VIEW],
    [{ t: 'meta', v: 'Fri 16 Oct', m: 'By Rana Haddad' }, '09:14', { t: 'meta', v: '18:20', m: 'Corrected · was 17:20' }, { t: 'num', v: '9h 06m' }, LATE, { t: 'status', v: 'Corrected', tone: 'Success' }, VIEW],
    [{ t: 'meta', v: 'Thu 15 Oct', m: 'Reason: office log 17:40' }, '08:55', '17:40', { t: 'num', v: '8h 45m' }, ON, { t: 'status', v: 'Correction rejected', tone: 'Danger' }, VIEW], ...BASE_ROWS.slice(3)];
  return [today, ...BASE_ROWS];
}
async function filters(active) { const r = row('Period filters', 8); for (const l of ['This week', 'October 2026', 'Custom range']) add(r, [await I('Chip/Filter', { State: l === active ? 'Active' : 'Default' }, { Label: l }, 'Filter · ' + l)]); return r; }
async function stats(st) {
  const r = AL('Stats', 'HORIZONTAL', { gap: 16 });
  for (const [k, v] of [['Closed sessions', '6'], ['Hours (closed)', '54h 27m'], ['Average day', '9h 04m · vs 9 h'], ['Open problems', st === 'Forgotten checkout flagged' ? '1' : '0']]) {
    const n = await inset([await TX(k, 'ds/Caption', 'text/muted', { name: 'Stat label' }), await TX(v, 'ds/H3', 'text/primary', { name: 'Stat value' })], 'Stat · ' + k, 2);
    add(r, [n]); grow(n);
  }
  return r;
}
async function attDesk(f, st) {
  await deskShell(f, 'Call Center', 'My Attendance', st === 'Forgotten checkout flagged' ? ['Not checked in', 'Neutral'] : null);
  const c = await deskContent(f, 16);
  await pageHead(c, 'My Attendance', 'Your sessions, hours and punctuality', await filters(st === 'Empty' ? 'Custom range' : 'October 2026'));
  add(c, [await chips([['DEC-011', 'Correction route'], ['DEC-026', 'Review states'], ['DEC-007', 'Schedule'], ['DEC-022', 'Rest days']])], true);
  if (st === 'Loading') { for (let i = 0; i < 7; i++) add(c, [await I('Skeleton', { Type: 'Table row' }, {}, 'Skeleton row')], true); add(c, [await stateBlock('Loading', 'Inline', 'Loading your sessions…')]); return; }
  if (st === 'Empty') { add(c, [await stateBlock('Empty', 'Page', 'No sessions in this period', 'You have no attendance sessions between 1 and 9 Oct 2026. Try another period.', 'Show October 2026')]); return; }
  add(c, [await stats(st)], true);
  if (st === 'Forgotten checkout flagged') {
    add(c, [await banner('Warning', 'Default', 'Mon 19 Oct has no checkout', 'The session is still open, so check-in is blocked today. It is never closed automatically.')], true);
    add(c, [await policy('Inline', 'DEC-011', '“Request correction” exists only under Alt B (employee request). Under Alt A the Owner corrects it. Not selected.')], true);
  }
  if (st === 'Provisional / pending review rows (if adopted)') add(c, [await policy('Inline', 'DEC-026', 'Provisional and pending-review rows appear only if Alt B or Alt C is adopted. None selected.')], true);
  if (st === 'Correction outcomes') add(c, [await policy('Inline', 'DEC-011', 'Correction requests and their outcomes exist only under Alt B. The original record is always kept.')], true);
  add(c, [await table(rowsFor(st))]);
}
async function attMob(f) {
  await mobShell(f, 'Call Center', 4, 'My Attendance', 'October 2026');
  const c = mobContent(f, 56, 724, 12);
  const fr = row('Period filters', 8, { wrap: true }); for (const l of ['This week', 'October 2026']) add(fr, [await I('Chip/Filter', { State: l === 'October 2026' ? 'Active' : 'Default' }, { Label: l }, 'Filter · ' + l)]);
  add(c, [fr, await inset([await kv('Hours (closed)', '54h 27m'), await kv('Average day', '9h 04m · vs 9 h')], 'Stats', 4), await chips([['DEC-011', 'Correction route'], ['DEC-026', 'Review states']])], true);
  // Fix R40-05: punctuality moves into the row title (never truncated); meta keeps times + duration only; "derived" stated once under the list.
  const list = [['Tue 20 Oct · On time', '08:58 – now · 5h 34m', ['Open', 'Info']], ['Mon 19 Oct · On time', '08:52 – 18:01 · 9h 09m', ['Closed', 'Neutral']], ['Fri 16 Oct · Late', '09:14 – 18:20 · 9h 06m', ['Closed', 'Neutral']], ['Thu 15 Oct · On time', '08:55 – 17:40 · 8h 45m', ['Closed', 'Neutral']], ['Wed 14 Oct · On time', '08:50 – 18:00 · 9h 10m', ['Closed', 'Neutral']]];
  const card0 = await card('Card/Surface', 'Sessions', {}, 0);
  const items = []; for (const [t, m, b] of list) items.push(await li(t, m, 'clock', b, false));
  fillBody(card0, items); add(c, [card0.node, await TX('On time / Late are derived from check-in; schedule start and grace are pending (DEC-007/008).', 'ds/Caption', 'text/muted', { name: 'Derived note' })], true);
  FOLD_OK.add(f.name);
}

// ================= SCR-SHR-004 My Attendance history =================
// ---------- SCR-SHR-004
{
  const S = screen('SCR-SHR-004', 'My Attendance history');
  const prim = [];
  for (const dark of [false, true]) { const f = frame(S.sec, FN(S.scr, 'My Attendance', 'Desktop', dark ? 'Dark' : 'Light'), 1440, 900, dark); await attDesk(f); S.L.put(f); prim.push(f); }
  { const f = frame(S.sec, FN(S.scr, 'My Attendance', 'Mobile', 'Light'), 390, 844, false); await attMob(f); S.L.put(f); prim.push(f); }
  S.L.row();
  const states = [];
  for (const st of ['Empty', 'Forgotten checkout flagged', 'Provisional / pending review rows (if adopted)', 'Correction outcomes', 'Loading']) {
    if (states.length === 3) S.L.row();
    const f = frame(S.sec, FN(S.scr, 'My Attendance', 'Desktop', 'Light', st.replace(' / ', ' & ')), 1440, 900, false); await attDesk(f, st); S.L.put(f); states.push(f);
  }
  await notes(S.sec, S.L, S.scr, [
    ['Interaction', 'Intended interactions', 'Period chips filter the list. View opens the session detail (times, verification, summary). “Request correction” (forgotten checkout row) opens SCR-SHR-005 — only under DEC-011 Alt B. Reached from the sidebar “My Attendance” and the user menu; mobile via More.'],
    ['Note', 'Derived vs stored', 'Punctuality chips and “vs 9 h” are derived (dashed chips). Status badges are stored. Rest days (DEC-022) are not listed as absences. Provisional / pending-review rows exist only if DEC-026 Alt B / C is adopted.']
  ]);
  for (const f of [...prim, ...states]) fitReport(f);
  finishSection(S.sec);
}

overlapCheck();
return OUT;
