// D03-shr-conflict-patterns.js — Shared Agent — Phase 6 Batch D (D03). Page 45 HiFi — Cross-cutting States (96:7). Screens: SCR-SHR-014 Save conflict, SCR-SHR-015 System state patterns.
// Spec: docs/phase6/screens/shared-spec.md · interactions: docs/phase6/interaction-spec.md §Shared. Run with use_figma (operator only).
// Idempotent: each screen's section is created once (stacked 400 px under existing sections) and never moved; its own frames are rebuilt.
const SCRIPT = 'D03-shr-conflict-patterns.js';
// ---------- Shared Agent helper library P6 (inlined in every Shared Agent Phase 6 script; same as P5 + shells/overlays/fit) ----------
// Rules: DS instances only (pages 20/21); layout frames + text bound to Semantic variables; never move/resize children of instances;
// every visible text set explicitly; sections positioned only when first created (stacked under existing sections, 400 px gap).
const PAGE_ID = '96:7';
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
// mobile access/state notice (DS icon + text styles)
async function mobNotice(ic, title, body) {
  const n = AL('Notice', 'VERTICAL', { gap: 8, pad: [24, 8], align: 'CENTER' });
  add(n, [await icon(ic, 32)]); add(n, [await TX(title, 'ds/H3', 'text/primary', { name: 'Title', align: 'CENTER' }), await TX(body, 'ds/Body Small', 'text/secondary', { name: 'Body', align: 'CENTER' })], true);
  return n;
}
// Progress/Bar: use its value property when present; never resize the Fill child.
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
// ---- overlays: none on this script's screens (X-10: unused scrim/dialog/drawer helpers dropped; D02 holds the staged versions)
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
// Touch IconButton: set nested Icon of Close/Back to the intended glyph (override only, no x/y/size).
const _TI = { Close: await node(ICONS['x']), Back: await node(ICONS['chevron-left']) };
function fixTouchIcons(root) {
  for (const b of root.findAllWithCriteria({ types: ['INSTANCE'] }).filter(n => _TI[n.name])) {
    const ic = b.findOne(n => n.type === 'INSTANCE' && n.name === 'Icon'); if (!ic) continue;
    try { ic.swapComponent(_TI[b.name]); OUT.touchIconFix = (OUT.touchIconFix || 0) + 1; } catch (e) { warn('touch icon swap ' + b.name + ': ' + e.message); }
  }
}
// ================= SCR-SHR-014 Save conflict + SCR-SHR-015 System state patterns (page 45) =================
// ---------- SCR-SHR-014 — desktop: Data Entry edits a business (Karim Saleh); mobile: Developer edits a task (Lina Aoun)
const DCOLS = [['Field', 150], ['When you opened (10:31)', 210], ['Saved by Rana Haddad (10:42)', 294], ['Your edit (not saved)', 294], ['Result', 162]];
const DIFF = [
  ['Primary phone', '+000 70 000 101', '+000 70 000 108', '+000 70 000 101 (unchanged)', ['Their change', 'Neutral']],
  ['Instagram handle', '@glowbeauty.demo', '@glowbeauty.demo (unchanged)', '@glowbeautysalon.demo', ['Your change', 'Info']],
  ['Website', 'glowbeauty.example.com', 'downtown.glowbeauty.example.com', 'glowbeauty.example.com/downtown', ['Both changed', 'Warning']]
];
async function tcell(v, w, status) {
  const c = await I('Table/Cell', { Type: status ? 'Status' : 'Text' }, { Text: status ? ' ' : v, Meta: ' ' }, 'C · ' + (status ? status[0] : v).slice(0, 24));
  c.resize(w, 56); if (status) await nestedProps(c, 'Status', { Label: status[0], Tone: status[1], 'Show dot': false });
  return c;
}
async function diffTable() {
  const t = AL('Diff table', 'VERTICAL', { fill: 'surface/default', stroke: 'border/subtle', radius: 8, clip: true });
  const hr = AL('Header row', 'HORIZONTAL', {}); for (const [l, w] of DCOLS) { const h = await I('Table/HeaderCell', { Align: 'Left', Sort: 'None' }, { Label: l }, 'H · ' + l); h.resize(w, 40); hr.appendChild(h); } add(t, [hr]);
  for (const r of DIFF) { const rr = AL('Row · ' + r[0], 'HORIZONTAL', { fill: 'surface/default' }); rule(rr, false, true, 'border/subtle'); for (let i = 0; i < 4; i++) rr.appendChild(await tcell(r[i], DCOLS[i][1])); rr.appendChild(await tcell(null, DCOLS[4][1], r[4])); add(t, [rr]); }
  return t;
}
async function conflictDesk(f) {
  await deskShell(f, 'Data Entry', 'Businesses');
  const c = await deskContent(f, 16);
  await pageHead(c, 'Edit business', 'Glow Beauty Salon · Downtown branch · Salon', null, ['Businesses', 'Edit', 'Glow Beauty Salon']);
  add(c, [await banner('Warning', 'Default', 'Someone else changed this business while you were editing', 'Rana Haddad saved changes at 10:42. Nothing was overwritten. Review the differences, then re-apply your edits or reload the latest version.')], true);
  add(c, [await sectionCard('Changes since you opened this record', '3 fields differ · your edits are kept on this page until you choose', [await diffTable(),
    await TX('Re-applying puts your edits on top of the latest saved version; you review them again before saving. “Both changed” fields show both values side by side.', 'ds/Body Small', 'text/secondary', { name: 'Re-apply note' })], { gap: 12 })], true);
  const r = row('Conflict actions', 8, { justify: 'MAX' });
  add(r, [await btn('Ghost', 'Cancel editing', 'Medium'), await btn('Secondary', 'Reload latest', 'Medium', 'Default', 'refresh', 'Reload latest'), await btn('Primary', 'Re-apply my edits', 'Medium', 'Default', null, 'Re-apply my edits')]);
  add(c, [r], true);
}
async function conflictMob(f) {
  await mobHeader(f, 'Edit task', 'Booking flow', 'Developer');
  const c = mobContent(f, 56, 844 - 56 - 128, 12);
  const fields = [['Due date', 'Fri 30 Oct', 'Tue 3 Nov (Sami Fares, 11:20)', 'Mon 2 Nov'], ['Description', 'Booking flow for 3 services', 'Booking flow for 3 services + deposit note', 'Booking flow for 4 services']];
  const kids = [await banner('Warning', 'Inline', 'This task changed while you were editing', 'Sami Fares saved at 11:20. Nothing was overwritten.')];
  for (const [k, o, t, m] of fields) kids.push(await inset([await TX(k, 'ds/Label', 'text/primary', { name: 'Field' }), await kv('When opened', o), await kv('Saved', t), await kv('Your edit', m)], 'Diff · ' + k, 2));
  add(c, kids, true);
  const ft = mobFooter(f, 128);
  add(ft, [await btn('Primary', 'Re-apply my edits', 'Large', 'Default', null, 'Re-apply'), await btn('Secondary', 'Reload latest', 'Large', 'Default', 'refresh', 'Reload')], true);
}
{
  const S = screen('SCR-SHR-014', 'Save conflict');
  const prim = [];
  for (const dark of [false, true]) { const f = frame(S.sec, FN(S.scr, 'Save conflict', 'Desktop', dark ? 'Dark' : 'Light', 'Field-level diff'), 1440, 900, dark); await conflictDesk(f); S.L.put(f); prim.push(f); }
  { const f = frame(S.sec, FN(S.scr, 'Save conflict', 'Mobile', 'Light', 'Field-level diff'), 390, 844, false); await conflictMob(f); S.L.put(f); prim.push(f); }
  await notes(S.sec, S.L, S.scr, [
    ['Interaction', 'Intended interactions', 'Triggered on save when the record version changed (business edit, contact log, task, deal record, profile). Re-apply my edits → form reopens on the latest version with my edits applied → save again. Reload latest → discards my unsaved edits after confirming. Nothing is ever overwritten silently.'],
    ['Note', 'Roles', 'Desktop: Data Entry business edit (Call Center and Developer never edit master data — they use Request correction). Mobile: Developer task edit (sitemap M5).']
  ]);
  for (const f of prim) { fixTouchIcons(f); fitReport(f); }
  finishSection(S.sec);
}

// ---------- SCR-SHR-015 System state patterns (reference sheet; may exceed 900 high, W3 rule)
async function pattern(title, sub, kids, w) { const n = await sectionCard(title, sub, kids, { gap: 12, layer: 'Pattern · ' + title }); n.resize(w || 432, n.height); n.layoutSizingHorizontal = 'FIXED'; return n; }
// R45-02: summary links use status/danger/fg + underline (on danger/bg: 7.68 L, 5.91 D)
async function sLink(t) { const l = await link(t); for (const x of l.findAllWithCriteria({ types: ['TEXT'] })) { x.fills = [P('status/danger/fg')]; x.textDecoration = 'UNDERLINE'; } return l; }
async function errSummary() {
  const e = await I('Banner/ErrorSummary', null, { Title: 'Fix 2 problems before saving' }, 'Error summary');
  const slot = e.findOne(n => n.type === 'SLOT');
  if (slot) { for (const ch of [...slot.children]) ch.remove(); add(slot, [await sLink('Phone — enter a number like +000 70 000 101'), await sLink('Category — select a category')]); } else warn('ErrorSummary slot not found');
  return e;
}
async function sheet(f) {
  f.layoutMode = 'VERTICAL'; f.primaryAxisSizingMode = 'AUTO'; f.counterAxisSizingMode = 'FIXED'; f.itemSpacing = 24;
  f.paddingTop = f.paddingBottom = 48; f.paddingLeft = f.paddingRight = 48; f.clipsContent = false;
  add(f, [await TX('System state patterns', 'ds/H1', 'text/primary', { name: 'Sheet title' }), await TX('Reference for every screen: use these instead of inventing new state UI. Copy is illustrative; screens override it with their own wording.', 'ds/Body', 'text/secondary', { name: 'Sheet subtitle' })], true);
  const g = AL('Pattern grid', 'HORIZONTAL', { gap: 24, wrap: true }); add(f, [g], true);
  const sk = AL('Skeleton lines', 'VERTICAL', { gap: 8 }); add(sk, [await I('Skeleton', { Type: 'Text line' }, {}, 'Line'), await I('Skeleton', { Type: 'Text line' }, {}, 'Line'), await I('Skeleton', { Type: 'Avatar' }, {}, 'Avatar')]);
  const sd = row('Stored vs derived', 12, { wrap: true }); add(sd, [await badge('Closed', 'Neutral', 'Small'), await derived('Overdue 2 days', true), await derived('On time')]);
  const pl = row('Policy labels', 8, { wrap: true }); add(pl, [await policy('Chip', 'DEC-020', 'Target metrics'), await impl('Session lifetime', 'Chip')]);
  const pats = [
    ['Loading', 'Skeletons for lists and cards; no spinners for lists', [await stateBlock('Loading', 'Inline', 'Loading businesses…'), sk]],
    ['Empty', 'Nothing to show yet; say what will appear', [await stateBlock('Empty', 'Inline', 'No follow-ups today', 'Follow-ups you schedule appear here.')]],
    ['No results', 'Search or filters matched nothing', [await stateBlock('No results', 'Inline', 'No matches for “Cedar”', 'Try a different name, phone or handle, or clear filters.', 'Clear filters')]],
    ['Load error', 'The list could not load; data is safe', [await stateBlock('Error', 'Inline', 'Couldn’t load this list', 'Your data is safe. Try again in a moment.', 'Try again')]],
    ['Validation error', 'Summary on submit + inline field message', [await errSummary(), await inp('Text', 'Error', { Label: 'Business name', Value: ' ', Placeholder: 'Enter business name', 'Error message': 'Enter the business name.' }, 'Business name')]],
    ['Save failed', 'Nothing was lost; retry in place', [await banner('Error', 'Inline', 'Couldn’t save your changes', 'Nothing was lost — your edits are still on this page. Try again.'), await btn('Secondary', 'Try again', 'Medium', 'Default', 'refresh', 'Try again')]],
    ['Offline', 'Saving pauses; nothing is sent', [await banner('Warning', 'Inline', 'You’re offline', 'Saving is paused until your connection returns.'), await btn('Primary', 'Save (offline)', 'Medium', 'Disabled', null, 'Save disabled')]],
    ['Success', 'Toast; auto-dismisses (errors stay until closed)', [await toast('Success', 'Business saved', 'Glow Beauty Salon was updated.')]],
    ['Session expired', 'Inline notice before the SCR-SHR-013 page', [await stateBlock('Session expired', 'Inline', 'Session expired', 'Sign in again to continue.', 'Sign in')]],
    ['Restricted', 'No data shown; never hints at hidden records', [await access('Hidden by policy', 'Inline', 'This record isn’t available to you', 'It is outside what your role can see.'), await access('Permission denied', 'Inline', 'Your role can’t do this', 'Ask the Owner/Admin if you need it.')]],
    ['Stored vs derived', 'Solid badge = stored status; dashed chip = derived', [sd]],
    ['Pending policy labels', 'Violet = pending policy; neutral = implementation decision', [pl, await policy('Inline', 'DEC-012', 'Whether a work summary is required is undecided.')]]
  ];
  for (const [t, s, k] of pats) add(g, [await pattern(t, s, k, t === 'Restricted' ? 888 : 432)]);
}
async function offlineDesk(f) {
  await deskShell(f, 'Developer', 'Projects');
  const c = await deskContent(f, 16);
  await pageHead(c, 'Booking flow', 'Task · Glow Beauty Salon — Booking website', null, ['Projects', 'Booking flow', 'Glow Beauty Salon — Booking website']);
  add(c, [await banner('Warning', 'Default', 'You’re offline', 'Saving is paused until your connection returns. Nothing has been sent.')], true);
  const [a] = columns(c, 760);
  const r = row('Task actions', 8, { justify: 'MAX' }); add(r, [await btn('Ghost', 'Cancel', 'Medium'), await btn('Primary', 'Save (offline)', 'Medium', 'Disabled', null, 'Save disabled')]);
  add(a, [await sectionCard('Task details', 'Edits stay on this page while offline', [
    await inp('Text', 'Filled', { Label: 'Title', Value: 'Booking flow', Placeholder: 'Task title', 'Error message': ' ' }, 'Title'),
    await dt('Date', 'Filled', { Label: 'Due date', Value: 'Fri 30 Oct 2026', Placeholder: 'DD MMM YYYY', 'Error message': ' ' }),
    await ta('Filled', { Label: 'Description', Value: 'Online booking for 3 services with confirmation email.', Placeholder: 'Describe the task', 'Error message': ' ', Counter: '54 / 2000' }),
    await chips([['DEC-019', 'Task statuses']]), r], { gap: 12 })], true);
}
async function patternsMob(f) {
  await mobShell(f, 'Developer', 2, 'Tasks', 'State patterns · mobile');
  const c = mobContent(f, 56, 724, 12);
  add(c, [await banner('Warning', 'Inline', 'You’re offline', 'Saving is paused until your connection returns.'), await stateBlock('Loading', 'Inline', 'Loading tasks…'),
    await stateBlock('Empty', 'Inline', 'No tasks due today', 'Tasks assigned to you appear here.'), await stateBlock('Error', 'Inline', 'Couldn’t load tasks', 'Your data is safe. Try again.', 'Try again'),
    await banner('Error', 'Inline', 'Couldn’t save', 'Nothing was lost. Try again.')], true);
  const t = await toast('Success', 'Task saved', 'Booking flow was updated.'); f.appendChild(t); t.x = 15; t.y = 844 - 64 - 16 - t.height;
}
{
  const S = screen('SCR-SHR-015', 'System state patterns');
  const prim = [];
  for (const dark of [false, true]) { const f = frame(S.sec, FN(S.scr, 'System state patterns', 'Desktop', dark ? 'Dark' : 'Light', 'Reference sheet'), 1440, 900, dark); await sheet(f); S.L.put(f); prim.push(f); }
  { const f = frame(S.sec, FN(S.scr, 'System state patterns', 'Mobile', 'Light'), 390, 844, false); await patternsMob(f); S.L.put(f); prim.push(f); }
  S.L.row();
  const f2 = frame(S.sec, FN(S.scr, 'System state patterns', 'Desktop', 'Light', 'Offline in context'), 1440, 900, false); await offlineDesk(f2); S.L.put(f2);
  await notes(S.sec, S.L, S.scr, [
    ['Interaction', 'Intended interactions', 'Try again re-requests in place. Toasts auto-dismiss (Error toasts stay until closed). Offline: Save disabled with its reason in the label; saving resumes on reconnect (no automatic background send is promised). Validation summary links jump to each field.'],
    ['Note', 'Scope', 'Covers every brief §6 state without its own screen. Dedicated screens: SCR-SHR-011 permission denied, SCR-SHR-012 hidden by policy, SCR-SHR-013 session ended, SCR-SHR-014 save conflict.']
  ]);
  for (const f of [...prim, f2]) fitReport(f);
  finishSection(S.sec);
}
overlapCheck();
return OUT;
