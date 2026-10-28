// C05-attendance-corrections.js — Owner Agent — Phase 6 Batch C — page 41 HiFi Owner/Admin (96:3). Run with use_figma.
// SCR-OWN-005 Corrections & review queue: L+D policy-neutral; DEC-011 Alt A / Alt B readings (not selected); validation, conflict, success, empty.
// Idempotent: the section (found by name) is emptied and rebuilt in place; it is positioned only when first created (stack bottom + 400).
// Returns { created, updated, removed, fit, warnings }.
const PAGE_ID = '96:3';
const SEM_ID = 'VariableCollectionId:40:3', LIGHT = '40:1', DARK = '40:2';
const ID = {
  shell: '49:1926', shellM: '49:2034', metric: '51:1842', section: '51:1780', surface: '51:1772', inset: '51:1797',
  notice: '44:549', button: '45:305', iconBtn: '45:405', link: '45:441', tabs: '49:1198', date: '46:594', select: '46:434',
  input: '45:796', textarea: '45:847', search: '46:748', checkbox: '45:497', radio: '45:522', radioCard: '46:831',
  chipF: '46:768', avatar: '44:358', divider: '44:364', progress: '51:1916', annotation: '44:395', badge: '44:435',
  outcome: '44:459', count: '44:471', flag: '44:491', tag: '44:501', derived: '44:509', th: '51:1599', td: '51:1634',
  pag: '51:1744', li: '51:1870', kv: '51:1888', scrim: '53:1814', dialog: '53:1818', drawer: '53:1846',
  banner: '53:1960', toast: '53:2032', state: '53:2155', skel: '53:2172', access: '53:2240', legend: '56:2484',
  resv: '55:2533'
};
const IC = {
  search: '44:13', calendar: '44:18', clock: '44:23', 'chevron-down': '44:28', 'chevron-right': '44:43', check: '44:48',
  x: '44:53', plus: '44:58', filter: '44:68', bell: '44:73', user: '44:78', users: '44:83', home: '44:88', building: '44:93',
  phone: '44:98', briefcase: '44:103', board: '44:113', list: '44:118', chart: '44:123', settings: '44:128', lock: '44:133',
  eye: '44:138', 'alert-triangle': '44:148', 'alert-circle': '44:153', info: '44:158', 'check-circle': '44:163',
  'x-circle': '44:168', ban: '44:173', menu: '44:178', more: '44:183', 'map-pin': '44:193', wifi: '44:198', flag: '44:208',
  shield: '44:213', mail: '44:218', 'arrow-right': '44:233', spinner: '44:248', 'log-out': '44:253', download: '44:258',
  edit: '44:263', trash: '44:268', 'file-text': '44:288', refresh: '44:293', target: '44:298', hourglass: '44:303'
};
const NAV = ['Dashboard', 'Attendance', 'Employees', 'Targets & Work Lists', 'Businesses', 'Correction Requests', 'Categories', 'Calling Assignments', 'Follow-ups & Calendar', 'Deals & Meetings', 'Projects', 'Reports & Exports', 'Audit Log', 'Delivery Monitor', 'Settings', 'My Day (check in)', 'My Profile'];
const page = await live(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const semCol = await figma.variables.getVariableCollectionByIdAsync(SEM_ID);
if (!semCol) throw new Error('Semantic collection ' + SEM_ID + ' not found');
const primCol = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === 'Primitives');
const V = {};
for (const v of await figma.variables.getLocalVariablesAsync()) {
  if (v.variableCollectionId === semCol.id) V[v.name] = v;
  else if (primCol && v.variableCollectionId === primCol.id) V['p/' + v.name] = v;
}
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const GS = {}; for (const s of await figma.getLocalGridStylesAsync()) GS[s.name] = s;
const OUT = { created: {}, updated: {}, removed: 0, fit: {}, warnings: [] };
const warn = m => OUT.warnings.push(m);
const rec = (k, n) => { if (n) OUT.created[k] = n.id; return n; };

function vv(n) { const v = V[n]; if (!v) throw new Error('Missing variable ' + n); return v; }
function P(n) { return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', vv(n)); }
function fill(n, name) { n.fills = name ? [P(name)] : []; return n; }
function stroke(n, name, sides) {
  n.strokes = [P(name)]; n.strokeAlign = 'INSIDE';
  if (sides) { n.strokeTopWeight = sides.includes('t') ? 1 : 0; n.strokeBottomWeight = sides.includes('b') ? 1 : 0; n.strokeLeftWeight = sides.includes('l') ? 1 : 0; n.strokeRightWeight = sides.includes('r') ? 1 : 0; }
  else n.strokeWeight = 1;
  return n;
}
function bnum(n, field, px) { const v = V['p/space/' + px]; if (v) { try { n.setBoundVariable(field, v); return; } catch (e) { } } n[field] = px; }
function AL(name, dir, o) {
  o = o || {};
  const f = figma.createAutoLayout(dir || 'VERTICAL'); f.name = name; f.fills = [];
  if (o.gap != null) bnum(f, 'itemSpacing', o.gap);
  if (o.pad != null) { const p = [].concat(o.pad), q = p.length === 1 ? [p[0], p[0], p[0], p[0]] : p.length === 2 ? [p[0], p[1], p[0], p[1]] : p; ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach((k, i) => bnum(f, k, q[i])); }
  if (o.align) f.counterAxisAlignItems = o.align;
  if (o.justify) f.primaryAxisAlignItems = o.justify;
  if (o.fill) fill(f, o.fill);
  if (o.stroke) stroke(f, o.stroke, o.sides);
  if (o.radius != null) f.cornerRadius = o.radius;
  if (o.w != null || o.h != null) {
    f.resize(o.w || Math.max(1, f.width), o.h || Math.max(1, f.height));
    if (o.w != null) { if (dir === 'HORIZONTAL') f.primaryAxisSizingMode = 'FIXED'; else f.counterAxisSizingMode = 'FIXED'; }
    if (o.h != null) { if (dir === 'HORIZONTAL') f.counterAxisSizingMode = 'FIXED'; else f.primaryAxisSizingMode = 'FIXED'; }
  }
  if (o.clip != null) f.clipsContent = o.clip;
  if (o.wrap) { f.layoutWrap = 'WRAP'; bnum(f, 'counterAxisSpacing', o.wrap === true ? 8 : o.wrap); }
  return f;
}
async function T(chars, style, color, o) {
  o = o || {};
  const t = figma.createText();
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
function fillW(n) { try { if (n.type === 'TEXT') n.textAutoResize = 'HEIGHT'; n.layoutSizingHorizontal = 'FILL'; } catch (e) { warn('fillW ' + n.name + ': ' + e.message); } return n; }
function grow(n) { try { n.layoutGrow = 1; if (n.name === 'Spacer' && 'children' in n && !n.children.length) n.resize(n.width, 1); } catch (e) { } return n; } // fit: empty spacers were 100 px tall
function addF(p, ...kids) { for (const k of kids.flat()) if (k) { p.appendChild(k); fillW(k); } return p; }
// O-9 (OP-11 C11 "node … does not exist" in cuts): never trust a cached node or an instance sub-layer id (I…;…). Swaps,
// setProperties and relayout replace sub-layers, so every lookup is guarded, re-queried right before use, and removed/missing nodes are skipped.
function ok(n) { try { return !!n && !n.removed; } catch (e) { return false; } }
async function live(id) { if (!id) return null; try { const n = await figma.getNodeByIdAsync(id); return ok(n) ? n : null; } catch (e) { return null; } }
function ids(root, pred) { try { return ok(root) ? root.findAll(n => { try { return pred(n); } catch (e) { return false; } }).map(n => n.id) : []; } catch (e) { return []; } }
const NODES = {};
async function node(id) { let n = NODES[id]; if (!ok(n)) { n = await live(id); if (!n) throw new Error('DS node not found: ' + id); NODES[id] = n; } return n; } // O-9: re-queried if removed
const pv = name => Object.fromEntries(name.split(',').map(s => s.split('=').map(x => x.trim())));
function setP(inst, props) {
  const cp = inst.componentProperties, o = {};
  for (const [k, v] of Object.entries(props || {})) {
    const key = Object.keys(cp).find(x => x === k || x.split('#')[0] === k);
    if (!key) { warn(`prop ${k} not on ${inst.name}`); continue; }
    o[key] = cp[key].type === 'INSTANCE_SWAP' && IC[v] ? IC[v] : (cp[key].type === 'TEXT' && v === '' ? ' ' : v);
  }
  if (Object.keys(o).length) { try { inst.setProperties(o); } catch (e) { warn(`setProperties ${inst.name}: ${e.message}`); } }
  return inst;
}
async function I(setId, variant, props, name) {
  const n = await node(setId);
  let comp = n;
  if (n.type === 'COMPONENT_SET') {
    comp = n.children.find(ch => Object.entries(variant || {}).every(([k, v]) => pv(ch.name)[k] === v)) || (variant ? null : n.defaultVariant);
    if (!comp) throw new Error(`No variant ${JSON.stringify(variant)} in ${n.name}`);
  }
  const inst = comp.createInstance();
  if (name) inst.name = name;
  setP(inst, props);
  return inst;
}
function nested(root, name) { return root.findOne(n => n.type === 'INSTANCE' && n.name === name); }
async function setText(root, name, chars) {
  const t = root.type === 'TEXT' && root.name === name ? root : root.findOne(n => n.type === 'TEXT' && n.name === name);
  if (!t) { warn(`text ${name} not found in ${root.name}`); return null; }
  if (t.characters === String(chars)) return t;
  const fonts = t.fontName === figma.mixed ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName];
  for (const fn of fonts) await figma.loadFontAsync(fn);
  t.characters = String(chars);
  return t;
}
async function icon(name, size, color) {
  const ic = (await node(IC[name])).createInstance(); ic.name = 'Icon/' + name;
  if (size && size !== 20) ic.resize(size, size);
  if (color) for (const v of ic.findAllWithCriteria({ types: ['VECTOR'] })) v.strokes = [P(color)];
  return ic;
}
// ---- small DS builders
async function chip(dec, title) {
  const c = await I(ID.notice, { Size: 'Chip', Tone: 'Policy pending' }, { DEC: dec, Body: dec + ' pending' }, 'Policy · ' + dec);
  const t = c.findOne(n => n.type === 'TEXT' && n.name === 'Title');
  if (t) { if (title == null) t.visible = false; else await setText(t, 'Title', title); }
  return c;
}
async function notice(size, dec, body, title, tone) {
  const c = await I(ID.notice, { Size: size, Tone: tone || 'Policy pending' }, { DEC: dec, Body: body }, 'Policy · ' + dec);
  const t = c.findOne(n => n.type === 'TEXT' && n.name === 'Title');
  if (t) await setText(t, 'Title', title || (tone ? 'Implementation decision' : 'Policy pending'));
  return c;
}
const badge = (tone, label, size) => I(ID.badge, { Tone: tone, Size: size || 'Small' }, { Label: label, 'Show dot': true }, 'Badge · ' + label);
const flag = (tone, label) => I(ID.flag, { Tone: tone }, { Label: label }, 'Flag · ' + label);
const derived = (label, tone) => I(ID.derived, { Tone: tone || 'Neutral' }, { Label: label }, 'Derived · ' + label);
const tag = (label, tone) => I(ID.tag, { Tone: tone || 'Neutral' }, { Label: label }, 'Tag · ' + label);
async function btn(variant, label, o) {
  o = o || {};
  const b = await I(ID.button, { Variant: variant, Size: o.size || 'Medium', State: o.state || 'Default' }, { Label: label, 'Show icon': !!o.icon }, 'Button · ' + label);
  if (o.icon) setP(b, { Icon: o.icon });
  return b;
}
const avatar = (ini, size) => I(ID.avatar, { Size: size || 'Small', Tone: 'Neutral' }, { Initials: ini }, 'Avatar ' + ini);
const divider = () => I(ID.divider, { Orientation: 'Horizontal' }, null, 'Divider');
async function field(kind, state, o) {
  o = o || {};
  const set = { input: ID.input, select: ID.select, date: ID.date, textarea: ID.textarea }[kind];
  const v = kind === 'input' ? { Type: o.type || 'Text', State: state } : kind === 'select' ? { Type: o.type || 'Select', State: state } : kind === 'date' ? { Type: o.type || 'Date', State: state } : { State: state };
  const p = { Label: o.label || '', 'Show label': o.label != null, Required: !!o.req, Value: o.value || '', Placeholder: o.ph || 'Select', Helper: o.helper || '', 'Show helper': !!(o.helper || o.error), 'Error message': o.error || '' };
  if (kind === 'input') { p['Show icon'] = false; p['Country code'] = '+000'; p.Suffix = o.suffix || ''; }
  if (kind === 'textarea') { p.Counter = o.counter || ''; delete p.Placeholder; p.Placeholder = o.ph || 'Add a note'; }
  return I(set, v, p, (o.label || kind) + ' field');
}
async function chipF(label, active) { return I(ID.chipF, { State: active ? 'Active' : 'Default' }, { Label: label }, 'Filter · ' + label); }
async function radio(label, sel) { return I(ID.radio, { Selected: sel ? 'True' : 'False', State: 'Default' }, { Label: label }, 'Radio · ' + label); }
async function kv(k, v, type) { return I(ID.kv, { Type: type || 'Default' }, { Key: k, Value: v }, 'KV · ' + k); }
async function li(title, meta, ic, o) {
  o = o || {};
  const n = await I(ID.li, { State: o.hover ? 'Hover' : 'Default' }, { Title: title, Meta: meta, 'Show leading': !!ic, 'Show badge': false, 'Show chevron': o.chevron !== false }, 'Item · ' + title);
  if (ic) setP(n, { Icon: ic });
  return n;
}
async function banner(tone, title, body, o) {
  o = o || {};
  const b = await I(ID.banner, { Tone: tone, Size: o.size || 'Default' }, { Title: title, Body: body, 'Show title': true, 'Show action': !!o.action, 'Show close': false }, 'Banner · ' + title);
  if (o.action) { const a = nested(b, 'Action'); if (a) setP(a, { Label: o.action, 'Show icon': false }); }
  return b;
}
async function toast(tone, title, body) { return I(ID.toast, { Tone: tone }, { Title: title, Body: body, 'Show body': !!body }, 'Toast · ' + title); }
async function stateBox(type, size, title, body, action) {
  const s = await I(ID.state, { Type: type, Size: size || 'Inline' }, { 'Show action': !!action }, 'State · ' + type);
  await setText(s, 'Title', title);
  if (type !== 'Loading') await setText(s, 'Body', body || ' ');
  if (action) { const a = nested(s, 'Action'); if (a) setP(a, { Label: action, 'Show icon': false }); }
  return s;
}
async function access(type, size, title, body, action) {
  const s = await I(ID.access, { Type: type, Size: size || 'Page' }, null, 'Access · ' + type);
  await setText(s, 'Title', title); await setText(s, 'Body', body);
  const a = nested(s, 'Action'); if (a) setP(a, { Label: action || 'Go to My Day', 'Show icon': false });
  return s;
}
async function anno(type, title, body) { return I(ID.annotation, { Type: type }, { Title: title, Body: body }, 'Annotation · ' + title.split(' —')[0]); }
// Progress/Bar: value-driven Percent axis (DS 13, P5) when present; else token-drawn track/fill (Phase 5 method) + warning
async function progress(label, value, ratio, tone) {
  const set = await node(ID.progress);
  const axes = set.type === 'COMPONENT_SET' ? set.componentPropertyDefinitions : {};
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 20) * 5));
  if (axes.Percent) {
    const pb = await I(ID.progress, { Tone: tone || 'Brand', Percent: String(pct) }, { Label: label, Value: value, 'Show labels': true }, 'Progress · ' + label);
    // DS-13 Percent variants: Label/Value texts are not bound to the props (Component request) — set the texts directly (text override only)
    for (const [nm, ch] of [['Label', label], ['Value', value]]) { const t = pb.findOne(n => n.type === 'TEXT' && n.name === nm); if (t && t.characters !== ch) { const fs = t.fontName === figma.mixed ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName]; for (const f of fs) await figma.loadFontAsync(f); t.characters = ch; } }
    return pb;
  }
  warn('Progress/Bar has no Percent axis yet (P5): token-drawn bar used for ' + label);
  const g = AL('Progress · ' + label, 'VERTICAL', { gap: 6 });
  const top = AL('Labels', 'HORIZONTAL', { gap: 8 }); add(g, top); fillW(top);
  const a = await T(label, 'ds/Body Small', 'text/secondary', { name: 'Label' }); add(top, a, await T(value, 'ds/Label Small', 'text/primary', { name: 'Value' })); grow(a);
  const bar = AL('Track (Progress/Bar tokens)', 'HORIZONTAL', { fill: 'surface/sunken', radius: 4, h: 8, w: 200, clip: true }); add(g, bar); fillW(bar);
  if (pct > 0) { const r = figma.createRectangle(); r.name = 'Fill ' + pct + '%'; bar.appendChild(r); r.layoutPositioning = 'ABSOLUTE'; r.constraints = { horizontal: 'SCALE', vertical: 'STRETCH' }; r.resize(Math.max(1, bar.width * pct / 100), 8); r.cornerRadius = 4; fill(r, tone === 'Warning' ? 'status/warning/fg' : 'brand/accent'); }
  return g;
}
async function tabs(labels, active, style) {
  const t = await I(ID.tabs, { Style: style || 'Underline', Active: String(active || 1) }, null, 'Tabs');
  for (let i = 0; i < 4; i++) { const it = nested(t, 'Tab ' + (i + 1)); if (!it) continue; if (i < labels.length) setP(it, { Label: labels[i], 'Show count': false }); else it.visible = false; }
  return t;
}
// ---- tables (Table/HeaderCell + Table/Cell instances in local rows; widths set on the cells themselves)
async function getSec(name) {
  let s = page.children.find(n => n.type === 'SECTION' && n.name === name);
  if (s) { OUT.updated.section = s.id; for (const c of [...s.children]) { c.remove(); OUT.removed++; } return s; }
  s = figma.createSection(); s.name = name; page.appendChild(s);
  let y = 0; for (const o of page.children) if (o.type === 'SECTION' && o !== s) y = Math.max(y, o.y + o.height + 400);
  s.x = 0; s.y = y; OUT.created.section = s.id;
  return s;
}
function fitSec(sec) { let mx = 0, my = 0; for (const c of sec.children) { mx = Math.max(mx, c.x + c.width); my = Math.max(my, c.y + c.height); } sec.resizeWithoutConstraints(mx + 80, my + 80); OUT.fit.section = { w: Math.round(sec.width), h: Math.round(sec.height) }; }
async function caption(sec, text, x, y) { const c = await T(text, 'ds/H4', 'text/secondary', { name: 'Caption · ' + text.slice(0, 60) }); sec.appendChild(c); c.x = x; c.y = y - 40; return c; }
// desktop frame + Owner shell; active = nav label
async function desk(sec, name, x, y, active, dark, who) {
  who = who || ['Owner', 'Rana Haddad', 'Owner/Admin', 'RH', 'Checked in · 08:52'];
  const f = figma.createFrame(); f.name = name; sec.appendChild(f); f.resize(1440, 900); f.x = x; f.y = y; f.clipsContent = true; fill(f, 'surface/page');
  f.setExplicitVariableModeForCollection(semCol, dark ? DARK : LIGHT);
  const sh = await I(ID.shell, { Role: who[0] }, null, 'Shell/Desktop · ' + who[0]); f.appendChild(sh); sh.x = 0; sh.y = 0;
  const top = nested(sh, 'TopBar');
  if (top) {
    setP(top, { Name: who[1], Role: who[2], 'Show attendance': true, 'Show search': true });
    const at = nested(top, 'Attendance'); if (at) setP(at, { Label: who[4] });
    const se = nested(top, 'Search'); if (se) setP(se, { Placeholder: who[0] === 'Owner' ? 'Search businesses and employees' : 'Search assigned businesses', Value: '' });
    const bell = nested(top, 'Notifications'); if (bell) setP(bell, { 'Show dot': true });
    const av = nested(top, 'Avatar'); if (av) setP(av, { Initials: who[3] });
  } else warn('TopBar not found');
  const sb = nested(sh, 'Sidebar');
  if (sb && who[0] === 'Owner') for (const l of NAV) {
    const it = nested(sb, 'Nav/Item · ' + l); if (!it) { warn('Nav item not found: ' + l); continue; }
    setP(it, { Label: l, State: l === active ? 'Active' : 'Default' });
    if (l === 'Delivery Monitor') { setP(it, { 'Show badge': true }); const bd = nested(it, 'Badge'); if (bd) setP(bd, { Count: '4' }); }
  } else if (!sb) warn('Sidebar not found');
  const cf = AL('Content', 'VERTICAL', { gap: 16, pad: 24, clip: true }); f.appendChild(cf); cf.resize(1200, 836); cf.x = 240; cf.y = 64;
  cf.primaryAxisSizingMode = 'FIXED'; cf.counterAxisSizingMode = 'FIXED';
  const gs = GS['ds/Grid/Desktop content 12-col']; if (gs) await cf.setGridStyleIdAsync(gs.id);
  return { f, cf };
}
async function head(title, meta, actions) {
  const r = AL('Page header', 'HORIZONTAL', { gap: 12, align: 'CENTER' });
  const tg = AL('Titles', 'VERTICAL', { gap: 2 });
  add(tg, await T(title, 'ds/H1', 'text/primary', { name: 'Title' }), meta ? await T(meta, 'ds/Caption', 'text/muted', { name: 'Meta' }) : null);
  add(r, tg); grow(tg); add(r, actions || []);
  return r;
}
function wFix(n, w) { n.resize(w, n.height); try { n.layoutSizingVertical = 'HUG'; } catch (e) { } return n; }
function row(name, gap, align) { return AL(name, 'HORIZONTAL', { gap: gap == null ? 8 : gap, align: align || 'CENTER' }); }
function col(name, gap) { return AL(name, 'VERTICAL', { gap: gap == null ? 8 : gap }); }
// Card/Section with title + optional action link; kids go into the native Content slot
async function sectionCard(title, action, kids, o) {
  o = o || {};
  const c = await I(ID.section, null, { Title: title, Subtitle: o.sub || ' ', 'Show subtitle': !!o.sub, 'Show action': !!action }, 'Card · ' + title);
  if (action) { const a = nested(c, 'Action'); if (a) setP(a, { Label: action, 'Show icon': false }); }
  try { if (c.layoutMode !== 'NONE') c.primaryAxisSizingMode = 'AUTO'; } catch (e) { }
  const slot = c.findOne(n => n.type === 'SLOT');
  if (!slot) { warn('No slot in Card · ' + title); return c; }
  for (const k of [...slot.children]) k.remove();
  try { bnum(slot, 'itemSpacing', o.gap == null ? 12 : o.gap); } catch (e) { }
  for (const k of kids.flat()) if (k) { slot.appendChild(k); fillW(k); }
  return c;
}
async function surface(kids, o) {
  o = o || {};
  const c = await I(o.inset ? ID.inset : ID.surface, null, null, o.name || 'Surface');
  try { if (c.layoutMode !== 'NONE') c.primaryAxisSizingMode = 'AUTO'; } catch (e) { }
  const slot = c.findOne(n => n.type === 'SLOT');
  if (!slot) { warn('No slot in surface'); return c; }
  for (const k of [...slot.children]) k.remove();
  try { bnum(slot, 'itemSpacing', o.gap == null ? 12 : o.gap); } catch (e) { }
  for (const k of kids.flat()) if (k) { slot.appendChild(k); fillW(k); }
  return c;
}
function slotOf(inst, name) { const s = inst.findAll(n => n.type === 'SLOT'); return s.find(x => x.name === name) || (name === 'Footer' ? s[1] : s[0]); }
// overlays: drawer at x 960 over scrim; dialog centred. footer = [leftNodes[], rightNodes[]]
async function drawer(f, title, sub, kids, left, right) {
  const sc = await I(ID.scrim, { Size: 'Desktop' }, null, 'Scrim'); f.appendChild(sc); sc.x = 0; sc.y = 0;
  const d = await I(ID.drawer, null, { Title: title, Subtitle: sub || ' ', 'Show subtitle': !!sub }, 'Drawer · ' + title); f.appendChild(d); d.x = 960; d.y = 0;
  const body = slotOf(d, 'Content'), foot = slotOf(d, 'Footer');
  const inner = AL('Drawer body', 'VERTICAL', { gap: 16 });
  if (body) { for (const k of [...body.children]) k.remove(); body.appendChild(inner); fillW(inner); } else warn('Drawer Content slot missing');
  addF(inner, kids);
  if (foot) {
    for (const k of [...foot.children]) k.remove();
    const fr = AL('Drawer actions', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); foot.appendChild(fr); fillW(fr);
    add(fr, left || []); const sp = AL('Spacer', 'HORIZONTAL', {}); fr.appendChild(sp); grow(sp); add(fr, right || []);
  } else warn('Drawer Footer slot missing');
  if (body) { const sb = body.absoluteBoundingBox, ib = inner.absoluteBoundingBox; const free = Math.round(sb.y + sb.height - (body.paddingBottom || 0) - (ib.y + ib.height)); OUT.fit[f.name + ' · drawer free'] = free; if (free < 0) warn(f.name + ': drawer body taller than its slot by ' + (-free) + 'px'); }
  return d;
}
async function dialog(f, title, desc, w, kids, sec, pri, o) {
  o = o || {};
  const mobile = f.width < 500;
  const sc = await I(ID.scrim, { Size: mobile ? 'Mobile' : 'Desktop' }, null, 'Scrim'); f.appendChild(sc); sc.x = 0; sc.y = 0;
  const d = await I(ID.dialog, null, { Title: title, Description: desc || ' ', 'Show description': !!desc, 'Show footer': true, 'Show close': true }, 'Dialog · ' + title); f.appendChild(d);
  d.resize(w, d.height);
  const body = slotOf(d, 'Content');
  const inner = AL('Dialog body', 'VERTICAL', { gap: 12 });
  if (body) { for (const k of [...body.children]) k.remove(); body.appendChild(inner); fillW(inner); } else warn('Dialog Content slot missing');
  addF(inner, kids);
  const s2 = nested(d, 'Secondary action'), p2 = nested(d, 'Primary action');
  if (s2) setP(s2, { Label: sec || 'Cancel', 'Show icon': false });
  if (p2) { setP(p2, { Label: pri[0], 'Show icon': false, Variant: pri[1] || 'Primary', State: pri[2] || 'Default' }); }
  d.x = Math.round((f.width - w) / 2); d.y = Math.max(24, Math.round((f.height - d.height) / 2));
  if (d.y + d.height > f.height - 16) warn(f.name + ': dialog taller than frame (' + Math.round(d.height) + 'px)');
  OUT.fit[f.name + ' · dialog h'] = Math.round(d.height);
  return d;
}
// fit check for a content frame: free vertical space and any child wider than the column
function fit(f) {
  const cf = f.findChild(n => n.name === 'Content'); if (!cf) return;
  const kids = cf.children.filter(k => k.visible && k.layoutPositioning !== 'ABSOLUTE'); if (!kids.length) return;
  const last = kids[kids.length - 1];
  const free = Math.round(cf.height - cf.paddingBottom - (last.y + last.height));
  const inner = cf.width - cf.paddingLeft - cf.paddingRight;
  const wide = kids.filter(k => k.width > inner + 0.5).map(k => k.name + ' ' + Math.round(k.width));
  OUT.fit[f.name] = { contentFree: free, widthOver: wide };
  if (free < 0) warn(f.name + ': content overflows the 836/724 viewport by ' + (-free) + 'px (below fold, clipped)');
  if (wide.length) warn(f.name + ': wider than the column: ' + wide.join(', '));
}
// ================= SCR-OWN-005 Attendance corrections & review queue (WF-ATT-003 Part 2 · SM-ATTENDANCE-001 · SM-CORRECTION-001) =================
// DEC-011 Alt A / Alt B are drawn as separate reading frames, each labelled "not selected". DEC-026 review rows are "if adopted".
const sec = await getSec('SCR-OWN-005 — Attendance corrections & review queue');
const BASE = 'SCR-OWN-005 — Attendance corrections & review queue — Desktop';
async function qRow(t1, t2, extra, sel) {
  const r = AL('Queue item · ' + t1, 'VERTICAL', { gap: 4, pad: [10, 12], radius: 8, fill: sel ? 'surface/selected' : null });
  if (sel) stroke(r, 'border/default');
  addF(r, await T(t1, 'ds/Body Strong', 'text/primary', { name: 'Title' }), await T(t2, 'ds/Caption', 'text/muted', { name: 'Meta' }));
  const c = row('Chips', 4); add(c, extra); r.appendChild(c);
  return r;
}
// review-41 M-07: only real work is counted (1). The DEC-026 Alt B/C rows are a separated, dashed preview, outside the count.
// M-08: the Alt B reading lists the employee requests when that tab is active. M-09: after Success Omar has left the queue.
async function preview() {
  const pv = AL('Preview · DEC-026 (not counted)', 'VERTICAL', { gap: 6, pad: 8, radius: 8, stroke: 'border/default' }); pv.dashPattern = [4, 4];
  addF(pv, await T('Preview · +2 if DEC-026 Alt B/C adopted (not counted)', 'ds/Label Small', 'text/secondary', { name: 'Preview label' }),
    await qRow('Checkout pending review', 'Sami Fares · Fri 16 Oct · checkout attempt 18:02', [await chip('DEC-026', 'Alt C, if adopted')]),
    await qRow('Provisional checkout', 'Lina Aoun · Thu 15 Oct · checkout 17:55', [await chip('DEC-026', 'Alt B, if adopted')]));
  return pv;
}
async function queue(v) {
  if (v === 'altB') return sectionCard('Employee requests · 1', null, [
    await qRow('Checkout correction request', 'Omar Nassar · Mon 19 Oct · sent 20 Oct 08:41', [await chip('DEC-011', 'Alt B reading')], true),
    await T('Requests exist only under DEC-011 Alt B. Not selected.', 'ds/Caption', 'text/muted', { name: 'DEC-011 note' }),
  ], { gap: 8 });
  const live = v === 'success' ? [await T('Omar Nassar’s missing checkout was corrected and left the queue.', 'ds/Caption', 'text/muted', { name: 'Resolved note' })]
    : [await qRow('Missing checkout', 'Omar Nassar · Mon 19 Oct · in 09:04, no checkout', [await flag('Warning', 'Blocks next check-in')], true)];
  return sectionCard('Needs review · ' + (v === 'success' ? '0' : '1'), null, [...live, await divider(), await preview()], { gap: 8 });
}
async function times(v) {
  const r = row('Corrected times', 12, 'MIN');
  const d = await field('date', 'Filled', { label: 'Checkout date', req: true, value: '19 Oct 2026', ph: 'DD MMM YYYY' });
  const t = await field('date', v === 'invalid' ? 'Error' : 'Filled', { type: 'Time', label: 'Checkout time', req: true, value: v === 'invalid' ? '08:30' : '18:05', ph: 'HH:MM', error: 'Checkout must be after check-in (09:04), not overlap another session and not be in the future.' });
  add(r, d, t); fillW(d); fillW(t);
  return r;
}
async function detail(v) {
  const k = [];
  if (v === 'conflict') k.push(await stateBox('Save conflict', 'Inline', 'This session changed while you were editing', 'Rana Haddad saved a correction in another tab at 11:16. Nothing was saved here. Review the latest version.', 'Review latest'));
  // Phase 6 fit fix: the 'original kept' heading moves into the card subtitle for the long states
  if (v === 'primary' || v === 'empty' || v === 'success') k.push(await T('Original session (kept, never overwritten)', 'ds/H4', 'text/primary', { name: 'Original' }));
  k.push(await kv('Check-in', '09:04 · recorded (mode: DEC-009 pending)')); // review-41 M-06: no pass/fail while DEC-009 is open
  if (v === 'success') { // M-09: the form is closed; the saved record is shown read-only
    k.push(await kv('Checkout', '18:05 · corrected (adjusted)'), await kv('Session state', 'Closed · check-in unblocked'), await divider(),
      await kv('Correction', 'Saved 11:18 by Rana Haddad'), await T('Saved beside the original and audited as attendance.corrected.', 'ds/Caption', 'text/muted', { name: 'Saved note' }));
    return k;
  }
  else k.push(await kv('Checkout', 'Not recorded', 'Not recorded'), await kv('Session state', 'Open · next check-in blocked'));
  k.push(await divider());
  if (v === 'conflict') { const b = row('Actions', 8); const sp = AL('Spacer', 'HORIZONTAL', {}); add(b, sp, await btn('Secondary', 'Cancel'), await btn('Primary', 'Review latest')); grow(sp); k.push(b); return k; }
  if (v === 'primary' || v === 'empty') {
    k.push(await notice('Block', 'DEC-011', 'Alt A: you enter corrected times and a reason. Alt B: the employee submits a request and you approve or reject it with a reason. Neither is selected; both readings are drawn as their own frames beside this one.', 'Correction authority — policy pending'));
    k.push(await T('Whichever applies, the correction is saved beside the original, audited as attendance.corrected, and unblocks check-in.', 'ds/Caption', 'text/muted', { name: 'Common rule' }));
    return k;
  }
  if (v === 'altB') {
    const h = row('Reading', 8); add(h, await T('Employee request', 'ds/H4', 'text/primary', { name: 'Request' }), await chip('DEC-011', 'Alt B reading — not selected')); k.push(h);
    k.push(await kv('Requested by', 'Omar Nassar · 20 Oct 08:41'), await kv('Proposed checkout', 'Mon 19 Oct · 18:05'), await kv('Employee’s reason', 'Forgot to check out; left at 18:05.'));
    k.push(await field('textarea', 'Default', { label: 'Reason (required to reject)', ph: 'Why the request is rejected' }));
    const b = row('Actions', 8); const sp = AL('Spacer', 'HORIZONTAL', {}); add(b, sp, await btn('Secondary', 'Reject…'), await btn('Primary', 'Approve and apply')); grow(sp); k.push(b);
    return k;
  }
  const h = row('Reading', 8); add(h, await T('Correction', 'ds/H4', 'text/primary', { name: 'Correction' }), await chip('DEC-011', 'Alt A reading — not selected')); k.push(h);
  k.push(await times(v));
  k.push(await field('textarea', 'Filled', { label: 'Reason', req: true, value: 'Omar confirmed he left at 18:05 and forgot to check out.', helper: 'Saved beside the original and audited (attendance.corrected).' }));
  const b = row('Actions', 8); const sp = AL('Spacer', 'HORIZONTAL', {}); add(b, sp, await btn('Secondary', 'Cancel'), await btn('Primary', 'Save correction', { state: v === 'success' ? 'Disabled' : 'Default' })); grow(sp); k.push(b);
  return k;
}
async function build(name, x, y, dark, v) {
  const { f, cf } = await desk(sec, name, x, y, 'Attendance', dark);
  addF(cf, await head('Corrections & review', 'Attendance · originals are never overwritten · every change is audited', [await btn('Secondary', 'Open attendance')]));
  addF(cf, await tabs(v === 'altB' ? ['Review queue · 1', 'Employee requests · 1', 'Corrected sessions'] : ['Review queue · ' + (v === 'empty' || v === 'success' ? '0' : '1'), 'Corrected sessions'], v === 'altB' ? 2 : 1));
  if (v === 'empty') {
    addF(cf, await stateBox('Empty', 'Page', 'Nothing to review', 'Missing checkouts, correction requests (DEC-011 Alt B) and failed-checkout review items (DEC-026 Alt B/C) appear here.', null));
  } else {
    const main = row('Main', 24, 'MIN'); addF(cf, main);
    const q = await queue(v); main.appendChild(q); wFix(q, 400);
    const long = !(v === 'primary' || v === 'empty' || v === 'success');
    const d = await sectionCard('Omar Nassar · Mon 19 Oct 2026', null, await detail(v), { sub: long ? 'Call Center · missing checkout · original session kept, never overwritten' : 'Call Center · missing checkout', gap: long ? 8 : 12 });
    main.appendChild(d); d.layoutSizingHorizontal = 'FILL';
  }
  fit(f);
  if (v === 'success') { // M-09: toast bottom-right, clear of any action (the detail card has none in this state)
    const t = await toast('Success', 'Correction saved', 'Original kept · audited (attendance.corrected) · Omar can check in again.'); f.appendChild(t); t.x = 1056; t.y = 900 - 24 - t.height;
    const tb = t.absoluteBoundingBox; for (const id of ids(f, n => n.type === 'INSTANCE' && /^Button/.test(n.name) && n.visible)) { const b = await live(id); if (!b) continue; const a = b.absoluteBoundingBox; /* O-9 guarded */ if (a && a.x < tb.x + tb.width && a.x + a.width > tb.x && a.y < tb.y + tb.height && a.y + a.height > tb.y) warn(name + ': toast covers ' + b.name); }
  }
  return f;
}
const FR = [
  ['Light · primary (policy-neutral)', 'Light', 80, 80, false, 'primary'], ['Dark · primary', 'Dark', 1600, 80, true, 'primary'],
  ['Reading · DEC-011 Alt A — not selected', 'Light — DEC-011 Alt A reading', 80, 1140, false, 'altA'],
  ['Reading · DEC-011 Alt B — not selected', 'Light — DEC-011 Alt B reading', 1600, 1140, false, 'altB'],
  ['State · Validation error', 'Light — Validation error', 3120, 1140, false, 'invalid'],
  ['State · Save conflict', 'Light — Save conflict', 4640, 1140, false, 'conflict'],
  ['State · Success (audit noted)', 'Light — Success', 80, 2200, false, 'success'],
  ['State · Empty queue', 'Light — Empty queue', 1600, 2200, false, 'empty'],
];
for (const [cap, suf, x, y, dark, v] of FR) { await caption(sec, cap, x, y); rec(BASE + ' — ' + suf, await build(BASE + ' — ' + suf, x, y, dark, v)); }
const an = AL('Annotations · SCR-OWN-005', 'HORIZONTAL', { gap: 24 }); sec.appendChild(an); an.x = 80; an.y = 3260;
for (const [t, h, b] of [
  ['Note', 'C1 — DEC-011 not selected', 'The primary frame shows the facts and the pending rule only. Alt A and Alt B are separate reading frames. The “Employee requests” tab and SCR-SHR-005 exist only under Alt B.'],
  ['Interaction', 'C2 — Save', 'Validate: checkout after check-in, no overlap, not in the future → one save writes the correction record beside the original, audits attendance.corrected, closes or adjusts the session and unblocks check-in. Save failed or conflict: nothing changes.'],
  ['Note', 'C3 — DEC-026 review items', 'Provisional (Alt B) and pending-review (Alt C) checkouts appear in this queue only if that alternative is adopted. Until then they are a dashed preview, never counted in tab or heading totals.'],
]) an.appendChild(await anno(t, h, b));
rec('annotations', an);
fitSec(sec);
return OUT;
