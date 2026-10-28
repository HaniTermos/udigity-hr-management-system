// C12-delivery-monitor.js — Owner Agent — Phase 6 Batch C — page 41 HiFi Owner/Admin (96:3). Run with use_figma.
// SCR-OWN-012 Delivery & exception monitor: L+D; failed detail, retrying, empty.
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
async function cell(spec, w) {
  if (spec == null) spec = '—';
  if (typeof spec === 'string') { const c = await I(ID.td, { Type: 'Text' }, { Text: spec }, 'Cell'); c.resize(w, 56); return c; }
  if (spec.t != null) { const c = await I(ID.td, { Type: 'Text with meta' }, { Text: spec.t, Meta: spec.m || ' ' }, 'Cell'); c.resize(w, 56); return c; }
  if (spec.n != null) { const c = await I(ID.td, { Type: 'Number' }, { Text: spec.n }, 'Cell'); c.resize(w, 56); return c; }
  if (spec.st) { const c = await I(ID.td, { Type: 'Status' }, null, 'Cell'); c.resize(w, 56); const b = nested(c, 'Status'); if (b) setP(b, { Tone: spec.st[0], Label: spec.st[1] }); return c; }
  if (spec.av) { const c = await I(ID.td, { Type: 'Avatar' }, { Text: spec.av[1] }, 'Cell'); c.resize(w, 56); const a = nested(c, 'Avatar'); if (a) setP(a, { Initials: spec.av[0] }); return c; }
  if (spec.cb != null) { const c = await I(ID.td, { Type: 'Checkbox' }, null, 'Cell'); c.resize(w, 56); const b = nested(c, 'Checkbox'); if (b) setP(b, { Checked: spec.cb ? 'True' : 'False' }); return c; }
  if (spec.act) { const c = await I(ID.td, { Type: 'Actions' }, null, 'Cell'); c.resize(w, 56); const b = nested(c, 'Actions'); if (b) setP(b, { Icon: spec.act === true ? 'more' : spec.act }); return c; }
  if (spec.link) { const c = await I(ID.td, { Type: 'Link' }, null, 'Cell'); c.resize(w, 56); const b = nested(c, 'Link'); if (b) setP(b, { Label: spec.link, 'Show icon': false }); return c; }
  // custom: spec.c = array of nodes (or async fn) laid out in a 56-high cell, 12 px side padding, wrap allowed
  const f = AL('Cell · custom', spec.v ? 'VERTICAL' : 'HORIZONTAL', { gap: spec.v ? 2 : 6, pad: [0, 12], align: spec.v ? 'MIN' : 'CENTER', w, h: 56 });
  if (spec.v) f.primaryAxisAlignItems = 'CENTER';
  const kids = typeof spec.c === 'function' ? await spec.c() : spec.c; add(f, kids); if (spec.fill) kids.forEach(fillW);
  f.clipsContent = true;
  return f;
}
async function table(name, cols, rows, o) {
  o = o || {};
  const W = cols.reduce((s, c) => s + c[1], 0);
  const tb = AL('Table · ' + name, 'VERTICAL', { fill: 'surface/default', stroke: 'border/default', radius: 12, clip: true, w: W });
  const hr = AL('Header row', 'HORIZONTAL', { fill: 'surface/sunken' }); stroke(hr, 'border/default', 'b'); add(tb, hr);
  for (const [label, w, align, sort] of cols) { const h = await I(ID.th, { Align: align === 'R' ? 'Right' : 'Left', Sort: sort || 'None' }, { Label: label || ' ' }, 'H · ' + (label || '—')); h.resize(w, 40); hr.appendChild(h); }
  for (let r = 0; r < rows.length; r++) {
    const spec = rows[r], cells = spec.cells || spec;
    const row = AL('Row ' + (r + 1), 'HORIZONTAL', { fill: spec.sel ? 'surface/selected' : spec.hover ? 'surface/hover' : 'surface/default' });
    if (r < rows.length - 1 || o.lastRule) stroke(row, 'border/subtle', 'b');
    for (let i = 0; i < cols.length; i++) row.appendChild(await cell(cells[i], cols[i][1]));
    tb.appendChild(row);
  }
  return tb;
}
// ---- page structure
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
let NAVBADGE = '4'; // review-41 M-17: hidden in the Empty frame (0 open items)
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
    if (l === 'Delivery Monitor') { setP(it, { 'Show badge': !!NAVBADGE }); const bd = nested(it, 'Badge'); if (bd && NAVBADGE) setP(bd, { Count: NAVBADGE }); }
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
function row(name, gap, align) { return AL(name, 'HORIZONTAL', { gap: gap == null ? 8 : gap, align: align || 'CENTER' }); }
function col(name, gap) { return AL(name, 'VERTICAL', { gap: gap == null ? 8 : gap }); }
// Card/Section with title + optional action link; kids go into the native Content slot
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
// ================= SCR-OWN-012 Delivery & exception monitor (WF-NOTIFY-001 D6 · WF-DEAL-002 F3 · AR-13) =================
// Send again exists for reminders only and creates a NEW reminder; the failed one stays failed (AR-13). Notifications: View only.
const sec = await getSec('SCR-OWN-012 — Delivery & exception monitor');
const BASE = 'SCR-OWN-012 — Delivery & exception monitor — Desktop';
const COLS = [['Type', 140], ['Item', 330], ['Recipient', 180], ['Status', 160], ['Reason', 210], ['Action', 132]]; // minor: Item 300→330 (no truncation)
// minor: one action style (Secondary); retrying rows have no action → plain "—"
const act = l => ({ c: async () => [l === '—' ? await T('—', 'ds/Body', 'text/muted', { name: 'No action' }) : await btn('Secondary', l, { size: 'Small' })] });
async function rows(v) {
  return [
    { sel: v === 'detail', cells: [{ c: async () => [await tag('Reminder')] }, { t: 'Meeting reminder · Peak Fitness Gym', m: 'Meeting Thu 22 Oct 14:00' }, { av: ['LA', 'Lina Aoun'] }, { st: ['Danger', 'Failed'] }, { t: 'Email rejected', m: '20 Oct 09:00 · 3 attempts' }, act('Send again')] },
    [{ c: async () => [await tag('Reminder')] }, { t: 'Meeting reminder · Nova Dental Clinic', m: 'Meeting Fri 23 Oct 10:30' }, { av: ['SF', 'Sami Fares'] }, { st: ['Warning', 'Suppressed'] }, { t: 'No access at send time', m: 'C6 · 20 Oct 08:30' }, act('Send again')],
    v === 'retrying' ? [{ c: async () => [await tag('Notification')] }, { t: 'Assignment changed · Lumen Yoga Studio', m: 'In-app + email' }, { av: ['ON', 'Omar Nassar'] }, { st: ['Info', 'Retrying · 2 of 3'] }, { t: 'Automatic retry', m: 'Next try 11:25 · policy Phase 3' }, act('—')]
      : [{ c: async () => [await tag('Notification')] }, { t: 'Assignment changed · Lumen Yoga Studio', m: 'In-app + email' }, { av: ['ON', 'Omar Nassar'] }, { st: ['Danger', 'Failed'] }, { t: 'Email bounced', m: '20 Oct 11:06' }, act('View', 1)],
    [{ c: async () => [await tag('Notification')] }, { t: 'Missing-checkout alert · Omar Nassar', m: 'Session Mon 19 Oct' }, { av: ['RH', 'Rana Haddad'] }, { st: ['Danger', 'Failed'] }, { t: 'Email bounced', m: '19 Oct 18:30' }, act('View', 1)],
  ];
}
async function build(name, x, y, dark, v) {
  const em = v === 'empty'; NAVBADGE = em ? null : '4';
  const { f, cf } = await desk(sec, name, x, y, 'Delivery Monitor', dark);
  addF(cf, await head('Delivery monitor', em ? 'Nothing needs attention' : '4 items · failed or suppressed reminders and notifications, failed project provisioning', [await btn('Secondary', 'Open audit log')]));
  const fl = row('Filters', 8); addF(cf, fl);
  for (const [l, a] of [[em ? 'All · 0' : 'All · 4', 1], ['Reminders · ' + (em ? 0 : 2), 0], ['Notifications · ' + (em ? 0 : 2), 0], ['Project provisioning · 0', 0]]) fl.appendChild(await chipF(l, a));
  const sp = AL('Spacer', 'HORIZONTAL', {}); fl.appendChild(sp); grow(sp);
  const st = await field('select', 'Filled', { value: 'All statuses' }); fl.appendChild(st); st.resize(170, st.height);
  if (em) { addF(cf, await table('Delivery items', COLS, [])); addF(cf, await stateBox('Empty', 'Page', 'No delivery problems', 'Failed or suppressed reminders and notifications, and failed project provisioning (F3), appear here. Security emails that fail (reset link, invitation) are listed too.', null)); fit(f); return f; }
  addF(cf, await table('Delivery items', COLS, await rows(v)));
  const pol = row('Policy', 8); pol.layoutWrap = 'WRAP'; bnum(pol, 'counterAxisSpacing', 6);
  add(pol, await chip('AR-13', 'Send again = new reminder · failed stays failed'), await chip('F2', 'provisioning trigger pending'), await chip('No DEC ID', 'timing, recipients, escalation'));
  addF(cf, pol);
  addF(cf, await T('A failed or suppressed reminder never changes its follow-up or meeting (D5). Suppressed = recipient inactive or without access at send time (C6).', 'ds/Caption', 'text/muted', { name: 'D5 note' }));
  if (v === 'detail') {
    await drawer(f, 'Reminder failed', 'Meeting reminder · Peak Fitness Gym', [
      await kv('Recipient', 'Lina Aoun · Developer · active'), await kv('Channel', 'Email'), await kv('Scheduled', 'Tue 20 Oct · 09:00'),
      await kv('Attempts', '3 automatic (retry policy: Phase 3)'), await kv('Last error', 'Mailbox rejected the message'),
      await kv('Meeting', 'Thu 22 Oct 14:00 · unchanged (D5)'),
      await notice('Inline', 'AR-13', 'Send again creates a new reminder; this failed reminder stays failed and listed.'),
    ], [], [await btn('Secondary', 'Close'), await btn('Primary', 'Send again (new reminder)')]);
  }
  fit(f); return f;
}
const FR = [
  ['Light · primary (failed + suppressed)', 'Light', 80, 80, false, 'primary'], ['Dark · primary', 'Dark', 1600, 80, true, 'primary'],
  ['State · Failed item detail', 'Light — Failed item detail', 80, 1140, false, 'detail'],
  ['State · Retrying', 'Light — Retrying', 1600, 1140, false, 'retrying'],
  ['State · Empty', 'Light — Empty', 3120, 1140, false, 'empty'],
];
for (const [cap, suf, x, y, dark, v] of FR) { await caption(sec, cap, x, y); rec(BASE + ' — ' + suf, await build(BASE + ' — ' + suf, x, y, dark, v)); }
const an = AL('Annotations · SCR-OWN-012', 'HORIZONTAL', { gap: 24 }); sec.appendChild(an); an.x = 80; an.y = 2200;
for (const [t, h, b] of [
  ['Interaction', 'M1 — Send again', 'Reminders only: creates a new reminder for the same follow-up/meeting after re-checking recipient status and access at send time (C6). The failed row stays (AR-13). No “Mark reviewed” action (removed in AR-13).'],
  ['Interaction', 'M2 — View / Retry', 'Notifications: View opens the item detail; no resend. Retrying rows are automatic (policy Phase 3) and have no action. Project provisioning failures (F3) would show Retry › (J-07) and link to the deal.'],
  ['Note', 'M3 — Nav badge', 'Delivery Monitor badge 4 = the open failed + suppressed delivery items listed here (hidden when 0). The dashboard Exceptions card also holds the attendance exception, so its set differs.'],
]) an.appendChild(await anno(t, h, b));
rec('annotations', an);
fitSec(sec);
return OUT;
