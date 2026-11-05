// C04-attendance-monitoring.js — Owner Agent — Phase 6 Batch C — page 41 HiFi Owner/Admin (96:3). Run with use_figma.
// SCR-OWN-004 Attendance monitoring & exception alerts (preserved ID): desktop L+D, mobile L+D; Empty, Not configured, Alert failed, Exception detail.
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
// OP-9: wrap texts inside an instance by override only (HEIGHT + FILL on the text and its in-instance auto-layout parents);
// resize() is never called on an instance child. Returns the texts still running past the instance box (px over).
async function wrapIn(inst, names) {
  if (!ok(inst)) return [];
  for (const id of ids(inst, n => n.type === 'TEXT' && (!names || names.includes(n.name)))) {
    const t = await live(id); if (!t) continue; // O-9: re-queried; an earlier override may have replaced it
    for (let p = t; ok(p) && p.id !== inst.id; p = p.parent) {
      try { if (p.type === 'TEXT') p.textAutoResize = 'HEIGHT'; const q = p.parent; if (q && q.layoutMode && q.layoutMode !== 'NONE') p.layoutSizingHorizontal = 'FILL'; } catch (e) { warn('wrapIn ' + inst.name + ' › ' + p.name + ': ' + e.message); }
    }
  }
  try { if (inst.parent && inst.parent.layoutMode && inst.parent.layoutMode !== 'NONE') inst.layoutSizingVertical = 'HUG'; } catch (e) { }
  const b = inst.absoluteBoundingBox; if (!b) return [];
  const out = [];
  for (const id of ids(inst, n => n.type === 'TEXT' && n.visible && n.characters.trim())) {
    const t = await live(id); if (!t) continue;
    try { const a = t.absoluteBoundingBox; if (!a) continue; const o = Math.round(a.x + a.width - b.x - b.width); if (o > 0.5) out.push([t, o]); } catch (e) { }
  }
  return out;
}
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
async function mob(sec, name, x, y, title, sub, dark) {
  const f = figma.createFrame(); f.name = name; sec.appendChild(f); f.resize(390, 844); f.x = x; f.y = y; f.clipsContent = true; fill(f, 'surface/page');
  f.setExplicitVariableModeForCollection(semCol, dark ? DARK : LIGHT);
  const sh = await I(ID.shellM, { Role: 'Owner' }, null, 'Shell/Mobile · Owner'); f.appendChild(sh); sh.x = 0; sh.y = 0;
  const h = nested(sh, 'Header'); if (h) { setP(h, { Title: title, Subtitle: sub, 'Show subtitle': true }); const av = nested(h, 'Avatar'); if (av) setP(av, { Initials: 'RH' }); } else warn('Mobile header not found');
  const tb = nested(sh, 'TabBar');
  if (tb) { setP(tb, { Role: 'Owner', Active: '1' }); [['Today', 'home'], ['My Day', 'clock'], ['Alerts', 'bell'], ['More', 'menu']].forEach(([l, i], k) => { const t = nested(tb, 'Tab ' + (k + 1)); if (t) setP(t, { Label: l, Icon: i }); }); } else warn('TabBar not found');
  const cf = AL('Content', 'VERTICAL', { gap: 12, pad: 16, clip: true }); f.appendChild(cf); cf.resize(390, 724); cf.x = 0; cf.y = 56;
  cf.primaryAxisSizingMode = 'FIXED'; cf.counterAxisSizingMode = 'FIXED';
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
// O-7 (M-16): text-cut check. A text whose box runs past any ancestor box is clipped; a truncating text (textTruncation
// ENDING) whose natural width does not fit its box shows "…". Both are reported, so a cut can no longer pass as OK.
function natW(t) {
  const m = figma.createText();
  try { m.fontName = t.getRangeFontName(0, 1); m.fontSize = t.getRangeFontSize(0, 1); m.letterSpacing = t.getRangeLetterSpacing(0, 1); m.textAutoResize = 'WIDTH_AND_HEIGHT'; m.characters = t.characters; return m.width; }
  catch (e) { return 0; } finally { m.remove(); }
}
async function cuts(root) {
  const o = []; const r = ok(root) ? await live(root.id) : null; if (!r) return o;
  let stale = 0;
  for (const id of ids(r, n => n.type === 'TEXT')) {
    const t = await live(id); if (!t) { stale++; continue; } // O-9: re-queried by id; removed or missing → skipped
    try {
      if (!t.characters.trim()) continue;
      let off = false; for (let p = t; ok(p) && p.id !== r.id; p = p.parent) if (p.visible === false) { off = true; break; } if (off) continue;
      const a = t.absoluteBoundingBox; if (!a) continue; let m = null;
      for (let p = t.parent; ok(p) && !m; p = p.id === r.id ? null : p.parent) { const b = p.absoluteBoundingBox; if (b && b.width > 0 && a.x + a.width > b.x + b.width + 0.5) m = 'past ' + p.name + ' +' + Math.round(a.x + a.width - b.x - b.width) + 'px'; }
      if (!m && t.textTruncation === 'ENDING') { const w = natW(t), L = t.maxLines || 1; if (L === 1 ? w > t.width + 0.5 : w > t.width * L * 0.9) m = 'truncated (' + Math.round(w) + ' > ' + Math.round(t.width) + (L > 1 ? '×' + L : '') + ')'; }
      if (m) o.push('“' + t.characters.slice(0, 32) + '” ' + m);
    } catch (e) { stale++; } // went stale mid-check
  }
  if (stale) OUT.stale = (OUT.stale || 0) + stale;
  return o;
}
async function fit(f) {
  const cf = f.findChild(n => n.name === 'Content'); if (!cf) return;
  const kids = cf.children.filter(k => k.visible && k.layoutPositioning !== 'ABSOLUTE'); if (!kids.length) return;
  const last = kids[kids.length - 1];
  const free = Math.round(cf.height - cf.paddingBottom - (last.y + last.height));
  const inner = cf.width - cf.paddingLeft - cf.paddingRight;
  const wide = kids.filter(k => k.width > inner + 0.5).map(k => k.name + ' ' + Math.round(k.width));
  OUT.fit[f.name] = { contentFree: free, widthOver: wide };
  if (free < 0) warn(f.name + ': content overflows the 836/724 viewport by ' + (-free) + 'px (below fold, clipped)');
  if (wide.length) warn(f.name + ': wider than the column: ' + wide.join(', '));
  const cut = await cuts(f); OUT.fit[f.name].textCut = cut; if (cut.length) warn(f.name + ': text cut · ' + cut.slice(0, 8).join(' | '));
}
// ================= SCR-OWN-004 Attendance monitoring & exception alerts (preserved ID) =================
// WF-ATT-001/002/003 Part 1 · WF-NOTIFY-001 · SM-ATTENDANCE-001. Desktop (Light + Dark) and mobile "Today" tab (Light + Dark).
const sec = await getSec('SCR-OWN-004 — Attendance monitoring & exception alerts');
const BD = 'SCR-OWN-004 — Attendance monitoring & exception alerts — Desktop', BM = 'SCR-OWN-004 — Attendance monitoring & exception alerts — Mobile';
async function tile(value, label, cap, color, extra) {
  const k = [await T(value, 'ds/H2', color || 'text/primary', { name: 'Value' }), await T(label, 'ds/Label', 'text/primary', { name: 'Label' })];
  if (cap) k.push(await T(cap, 'ds/Caption', 'text/muted', { name: 'Caption' }));
  if (extra) k.push(extra);
  const s = await surface(k, { gap: 2, name: 'Tile · ' + label });
  if (extra) try { extra.layoutSizingHorizontal = 'HUG'; } catch (e) { } // review-41 minor: chip not stretched to the tile width
  return s;
}
async function tiles(v, mobile) {
  const ok = v === 'empty';
  return [
    // Phase 6 fit fix: shorter captions on mobile so the policy chips stay above the tab bar
    await tile(ok ? '5 of 6' : '4 of 6', 'Checked in now', mobile ? null : 'In 08:52–09:14'),
    await tile('0', 'Checked out', mobile ? null : 'Sessions closed today'),
    await tile(ok ? '1' : '2', 'Not checked in yet', mobile ? '≠ absent' : '≠ absent (scheduled days: DEC-022)'),
    await tile(ok ? '0' : '1', 'Missing checkout', ok ? 'None open' : 'Omar Nassar · 19 Oct', ok ? 'text/primary' : 'status/warning/fg'),
    mobile ? null : await tile('—', 'Late arrivals', 'Not configured · policy pending', 'text/muted', await chip('DEC-008', null)),
  ].filter(Boolean);
}
async function punct() { return { c: [await derived('Unclassified')] }; }
// review-41 M-06: DEC-009 (verification mode) is undecided, so no pass/fail result is shown — only that a check-in was recorded
const REC = { t: 'Recorded', m: 'Mode pending · DEC-009' };
async function rows(v) {
  const ok = v === 'empty';
  return [
    [{ av: ['RH', 'Rana Haddad'] }, { st: ['Success', 'Checked in'] }, '08:52', '—', REC, await punct()],
    [{ av: ['KS', 'Karim Saleh'] }, { st: ['Success', 'Checked in'] }, '09:02', '—', REC, await punct()],
    [{ av: ['MK', 'Maya Khoury'] }, { st: ['Success', 'Checked in'] }, '08:58', '—', REC, await punct()],
    [{ av: ['LA', 'Lina Aoun'] }, { st: ['Success', 'Checked in'] }, '09:14', '—', { v: true, c: [await T('Remote · if adopted', 'ds/Caption', 'text/secondary', { name: 'Remote' }), await chip('DEC-010', null)] }, await punct()],
    ok ? [{ av: ['ON', 'Omar Nassar'] }, { st: ['Success', 'Checked in'] }, '09:01', '—', REC, await punct()]
      : { sel: v === 'detail', cells: [{ av: ['ON', 'Omar Nassar'] }, { st: ['Warning', 'Open since 19 Oct'] }, { t: '09:04', m: 'Mon 19 Oct' } /* O-7 N41-2: time on its own line, never cut */, '—', { t: 'Check-in blocked', m: 'until corrected' }, { c: [await flag('Warning', 'Missing checkout')] }] },
    [{ av: ['SF', 'Sami Fares'] }, { st: ['Neutral', 'Not checked in yet'] }, '—', '—', '—', { c: [await T('≠ absent', 'ds/Caption', 'text/muted', { name: 'G1' })] }],
  ];
}
async function exRow(ic, color, t1, t2, label) {
  const r = row('Exception · ' + t1, 8);
  const tc = col('Text', 0);
  const a = await T(t1, 'ds/Body Strong', 'text/primary', { name: 'Title', w: 160, truncate: 1 }), m = await T(t2, 'ds/Caption', 'text/muted', { name: 'Meta', w: 160, truncate: 2 });
  add(tc, a, m); add(r, await icon(ic, 16, color), tc); grow(tc); fillW(a); fillW(m);
  if (label) r.appendChild(await btn('Secondary', label, { size: 'Small' })); // review-41 minor: one action style
  return r;
}
async function exceptions(v) {
  if (v === 'empty') { // OP-9: Empty title/body wrap inside the State (override only; cut "No exceptions today" +70px)
    const st = await stateBox('Empty', 'Inline', 'No exceptions today', 'No missing checkouts and no failed alerts. Missing check-in alerts stay off until a schedule exists.', null);
    const c = await sectionCard('Exceptions & alerts · 0', 'Review all', [st]); await wrapIn(st); return c;
  }
  const pol = row('Chips', 4); pol.layoutWrap = 'WRAP'; bnum(pol, 'counterAxisSpacing', 4);
  add(pol, await chip('DEC-007', null), await chip('DEC-008', null), await chip('DEC-022', null));
  return sectionCard('Exceptions & alerts · 2', 'Review all', [ // O-7 N41-2: short link so the heading is not cut (the header keeps "Corrections & review"). review-41 minor: the info row is not counted (mobile = 2)
    await exRow('alert-triangle', 'status/warning/fg', 'Missing checkout', 'Omar Nassar · Mon 19 Oct, in 09:04 · session stays open', 'Review'),
    await exRow('x-circle', 'status/danger/fg', 'Alert not delivered', 'Missing-checkout alert to Rana Haddad · 19 Oct 18:30', 'View'),
    await exRow('info', 'icon/default', 'Missing check-in alerts off', 'Need working days, shift start and grace first', null),
    pol, await notice('Inline', 'No DEC ID', 'Alert recipients, timing and escalation are not decided.'),
  ], { gap: 12 });
}
async function buildD(name, x, y, dark, v) {
  const { f, cf } = await desk(sec, name, x, y, 'Attendance', dark);
  const d = await field('date', 'Filled', { value: 'Tue 20 Oct 2026', ph: 'Select date' }), e = await field('select', 'Filled', { value: 'All employees', ph: 'All employees' });
  d.resize(180, d.height); e.resize(180, e.height);
  addF(cf, await head('Attendance', 'Tue 20 Oct 2026 · 11:20 company time · live', [d, e, await btn('Secondary', 'Corrections & review')]));
  if (v === 'unconfigured') addF(cf, await banner('Warning', 'Work schedule not configured', 'Punctuality shows “Unclassified” and missing check-ins are not detected until Settings › Attendance has working days, shift start and grace (DEC-007, DEC-008, DEC-022).', { action: 'Open settings' }));
  if (v === 'alertfail') addF(cf, await banner('Error', 'Missing-checkout alert could not be delivered', 'The email to Rana Haddad failed at 19 Oct 18:30. The exception itself is listed here; delivery details are in Delivery monitor.', { action: 'Open delivery monitor' }));
  const st = row('Summary tiles', 16, 'MIN'); addF(cf, st); for (const t of await tiles(v)) { st.appendChild(t); t.layoutSizingHorizontal = 'FILL'; try { t.layoutSizingVertical = 'FILL'; } catch (e) { } } // minor: equal tile heights
  const main = row('Main', 24, 'MIN'); addF(cf, main);
  const left = col('Today', 8);
  // review-41 M-05: Employee 140→180 and Verification 130→170 (names and "Check-in blocked" no longer truncate); In/Out/Punctuality narrowed; table 816
  // O-7 N41-2: Employee 180→170, In 100→110 (table stays 816); Omar's In cell shows 09:04 over Mon 19 Oct
  add(left, await table('Today', [['Employee', 170], ['Status', 160], ['In', 110], ['Out', 56], ['Verification', 170], ['Punctuality', 150]], await rows(v)));
  const pc = row('Punctuality policy', 6); add(pc, await chip('DEC-007/008', 'schedule & grace pending → Unclassified'), await chip('DEC-009', 'office check mode'));
  add(left, pc);
  main.appendChild(left);
  const ex = await exceptions(v); main.appendChild(ex); ex.layoutSizingHorizontal = 'FILL';
  if (v === 'detail') {
    await drawer(f, 'Missing checkout', 'Omar Nassar · Call Center', [
      await kv('Session', 'Mon 19 Oct 2026'), await kv('Check-in', '09:04 · recorded (mode: DEC-009 pending)'), await kv('Checkout', 'Not recorded', 'Not recorded'),
      await kv('Session state', 'Open — never closed automatically'), await kv('Detected', '19 Oct 18:30 · scheduled check'), await kv('Alert', 'To Rana Haddad · not delivered'),
      await kv('Effect', 'Omar’s next check-in is blocked until corrected'),
      await notice('Inline', 'DEC-011', 'Who may correct (Owner only, or employee request + Owner review) is pending.'),
      await notice('Inline', 'No DEC ID', 'Detection timing and alert recipients are not decided.'),
    ], [], [await btn('Secondary', 'Close'), await btn('Primary', 'Correct session')]);
  }
  await fit(f); return f;
}
async function buildM(name, x, y, dark) {
  const { f, cf } = await mob(sec, name, x, y, 'Today', 'Tue 20 Oct · 11:20', dark);
  bnum(cf, 'itemSpacing', 8);
  const t = await tiles('primary', true);
  for (let i = 0; i < 2; i++) { const r = row('Tiles ' + (i + 1), 12, 'MIN'); addF(cf, r); for (const k of t.slice(i * 2, i * 2 + 2)) { r.appendChild(k); k.layoutSizingHorizontal = 'FILL'; } }
  addF(cf, await sectionCard('Exceptions · 2', null, [
    await li('Missing checkout', 'Omar Nassar · 19 Oct, in 09:04', 'alert-triangle'),
    await li('Alert not delivered', 'Checkout alert · 19 Oct', 'x-circle'),
  ], { gap: 0 }));
  addF(cf, await sectionCard('Not checked in yet · 2', null, [
    await li('Omar Nassar', 'Open since 19 Oct · blocked', 'user', { chevron: false }),
    await li('Sami Fares', 'No session today · ≠ absent', 'user', { chevron: false }),
  ], { gap: 0 }));
  const pc = row('Policy', 4); pc.layoutWrap = 'WRAP'; bnum(pc, 'counterAxisSpacing', 4);
  add(pc, await chip('DEC-007', null), await chip('DEC-008', null), await chip('DEC-022', null), await chip('DEC-010', null)); addF(cf, pc);
  await fit(f); return f;
}
const FR = [
  ['Light · primary', BD + ' — Light', 80, 80, false, 'primary', buildD], ['Dark · primary', BD + ' — Dark', 1600, 80, true, 'primary', buildD],
  ['Mobile · Light (Owner “Today” tab)', BM + ' — Light', 3120, 80, false, 0, buildM], ['Mobile · Dark', BM + ' — Dark', 3590, 80, true, 0, buildM],
  ['State · Empty (no exceptions)', BD + ' — Light — Empty', 80, 1140, false, 'empty', buildD],
  ['State · Schedule not configured', BD + ' — Light — Schedule not configured', 1600, 1140, false, 'unconfigured', buildD],
  ['State · Alert delivery failed', BD + ' — Light — Alert delivery failed', 3120, 1140, false, 'alertfail', buildD],
  ['State · Exception detail (drawer)', BD + ' — Light — Exception detail', 4640, 1140, false, 'detail', buildD],
];
for (const [cap, n, x, y, dark, v, fn] of FR) { await caption(sec, cap, x, y); rec(n, await fn(n, x, y, dark, v)); }
const an = AL('Annotations · SCR-OWN-004', 'HORIZONTAL', { gap: 24 }); sec.appendChild(an); an.x = 80; an.y = 2200;
for (const [t, h, b] of [
  ['Interaction', 'A1 — Exceptions', 'Review opens the exception detail drawer; Correct session goes to SCR-OWN-005 with the session preselected. View opens SCR-OWN-012 filtered to the alert. Corrections & review opens SCR-OWN-005.'],
  ['Note', 'A2 — G1 and derived values', '“Not checked in yet” is a live fact, not an absence: absence needs a scheduled working day (DEC-022). Punctuality, missing check-in/checkout and remote are derived, never states. A missing checkout is never closed automatically. Verification reads “Recorded · mode pending (DEC-009)”: no pass/fail until a mode is decided.'],
  ['Note', 'A3 — Mobile', 'Owner mobile home is “Today” (sitemap §4). Rows are full-width list items (≥ 56 px tap height). Late arrivals are omitted on mobile until DEC-008 exists; the chips stay visible.'],
]) an.appendChild(await anno(t, h, b));
rec('annotations', an);
fitSec(sec);
return OUT;
