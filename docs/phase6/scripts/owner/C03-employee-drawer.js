// C03-employee-drawer.js — Owner Agent — Phase 6 Batch C — page 41 HiFi Owner/Admin (96:3). Run with use_figma.
// SCR-OWN-003 Employee create/edit drawer: Edit L+D; Create, duplicate email, conflict, deactivate, role change, success. Needs C02.
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
function row(name, gap, align) { return AL(name, 'HORIZONTAL', { gap: gap == null ? 8 : gap, align: align || 'CENTER' }); }
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
function dupe(f, name, x, y, dark) { const c = f.clone(); c.name = name; c.x = x; c.y = y; if (dark != null) c.setExplicitVariableModeForCollection(semCol, dark ? DARK : LIGHT); rec(name, c); return c; }
// ================= SCR-OWN-003 Employee create / edit (drawer) (WF-EMP-001, WF-AUTH-002) =================
// Backdrop = clone of the SCR-OWN-002 Light/Dark primary frames (run C02 first).
const sec = await getSec('SCR-OWN-003 — Employee create / edit');
const BASE = 'SCR-OWN-003 — Employee create / edit — Desktop';
const SRC = { L: 'SCR-OWN-002 — Employees — Desktop — Light', D: 'SCR-OWN-002 — Employees — Desktop — Dark' };
const srcF = {};
for (const [k, n] of Object.entries(SRC)) { srcF[k] = page.findOne(x => x.type === 'FRAME' && x.name === n); if (!srcF[k]) throw new Error('Run C02 first: frame not found: ' + n); }
function back(name, x, y, dark) { const c = srcF[dark ? 'D' : 'L'].clone(); sec.appendChild(c); c.name = name; c.x = x; c.y = y; return c; }
const H4 = (t) => T(t, 'ds/H4', 'text/primary', { name: 'Group · ' + t });
async function two(a, b) { const r = row('Two fields', 12, 'MIN'); add(r, a, b); fillW(a); fillW(b); return r; }
async function profile(v) {
  const c = v === 'create', d = v === 'dupe';
  const st = c ? 'Default' : 'Filled';
  const name = await field('input', st, { label: 'Full name', req: true, value: c ? '' : d ? 'Omar Nassar' : 'Maya Khoury', ph: 'First and last name' });
  const mail = await field('input', d ? 'Error' : st, { label: 'Email', req: true, value: c ? '' : d ? 'omar.nassar@udigity.example' : 'maya.khoury@udigity.example', ph: 'name@udigity.example', error: d ? 'This email already belongs to Omar Nassar (Call Center). Use another email or open that employee.' : '', helper: c ? 'Used for sign-in and the invitation link.' : '' });
  const ph = await field('input', st, { type: 'Phone', label: 'Phone', value: c ? '' : '70 000 121', ph: '70 000 000' });
  const dep = await field('input', st, { label: 'Department', value: c ? '' : 'Calling', ph: 'e.g. Calling' });
  const job = await field('input', st, { label: 'Job title', value: c ? '' : 'Call Center agent', ph: 'e.g. Call Center agent' });
  // Phase 6 fit fix: name + job title share a row so the drawer body fits its slot (was 48–254 px over)
  return [await H4('Profile details'), await two(name, job), mail, await two(ph, dep)];
}
async function body(v) {
  const k = [];
  if (v === 'dupe') k.push(await banner('Error', 'Fix 1 problem before saving', 'Email — this address is already in use.', { size: 'Inline' }));
  if (v === 'conflict') k.push(await stateBox('Save conflict', 'Inline', 'This employee changed while you were editing', 'Rana Haddad saved new details in another tab at 11:14. Nothing was saved here. Review the latest version, then re-apply your change.', 'Review changes'));
  k.push(...await profile(v));
  if (v === 'create' || v === 'dupe') {
    k.push(await field('select', 'Default', { label: 'Role', req: true, ph: 'Select one role', helper: 'Exactly one role. An Owner/Admin account must enroll 2FA at first sign-in.' }));
    k.push(await notice('Inline', 'Impl. decision', 'Credential setup: an invitation link is queued to the employee’s email. The account shows “credentials not yet set” until it is used.', null, 'Implementation decision'));
    return k;
  }
  if (v === 'conflict') return k; // conflict: review first; role/status actions return after reload
  k.push(await divider(), await H4('Role and status'));
  k.push(await T('Not edited in this form. Change role revokes sessions; Deactivate lists open work first.', 'ds/Caption', 'text/muted', { name: 'Role note' }));
  k.push(await kv('Role', 'Call Center'), await kv('Account · sessions', 'Active · 1 session since 08:58'));
  const r = row('Role actions', 8); add(r, await btn('Secondary', 'Change role…'), await btn('Destructive', 'Deactivate…')); k.push(r);
  k.push(await T('Send reset link (footer) queues an email; you never see the password. Delivery failures appear in Delivery monitor.', 'ds/Caption', 'text/muted', { name: 'Reset note' }));
  return k;
}
async function withDrawer(name, x, y, dark, v) {
  const f = back(name, x, y, dark);
  const create = v === 'create' || v === 'dupe';
  // Send reset link moved to the footer (left) so it is never clipped by the drawer body
  await drawer(f, create ? 'Add employee' : 'Edit employee', create ? 'New account · Owner only' : 'Maya Khoury · Call Center', await body(v), create ? [] : [await btn('Ghost', 'Send reset link', { icon: 'mail' })], [await btn('Secondary', 'Cancel'), await btn('Primary', create ? 'Create employee' : 'Save changes')]);
  return f;
}
async function deactivate(name, x, y) {
  const f = back(name, x, y, false);
  const k = [
    await T('Open work stays assigned to Omar and is flagged “assignee inactive”. Nothing is moved automatically.', 'ds/Body', 'text/primary', { name: 'Lead' }),
    await kv('Calling assignments', '37 — reassign in Calling assignments'),
    await kv('Open follow-ups', '2 — Bloom Florist 21 Oct, Sunrise Bakery 22 Oct'),
    await kv('Active contact reservation', 'None', 'Not recorded'),
    await kv('Deals, meetings, projects, tasks', 'None', 'Not recorded'),
    await kv('Open attendance session', 'Mon 19 Oct, in 09:04 (missing checkout)'),
    await kv('Open correction requests', 'None', 'Not recorded'),
    await notice('Inline', 'No DEC ID', 'Handling of a deactivated employee’s open work: you decide per item in its own screen.'),
    await T('All of Omar’s sessions are revoked now; any later request from this account is refused.', 'ds/Caption', 'text/muted', { name: 'Revocation note' }),
  ];
  await dialog(f, 'Deactivate Omar Nassar?', 'Signs Omar out everywhere now. History stays attributed to Omar.', 640, k, 'Cancel', ['Deactivate and revoke sessions', 'Destructive']);
  return f;
}
async function roleChange(name, x, y) {
  const f = back(name, x, y, false);
  const k = [
    await kv('Current role', 'Data Entry'),
    await field('select', 'Filled', { label: 'New role', req: true, value: 'Call Center', helper: 'One role per employee.' }),
    await kv('Open items tied to Data Entry', '2 correction requests — stay listed, not moved'),
    await notice('Inline', 'Proposed', 'Sessions are revoked on a role change (required at least for a change to Owner, so no admin access exists without 2FA).'),
  ];
  await dialog(f, 'Change Karim Saleh’s role', 'Proposed: Karim is signed out everywhere and signs in again with the new role.', 560, k, 'Cancel', ['Change role and revoke sessions', 'Primary']);
  return f;
}
async function success(name, x, y) {
  const f = back(name, x, y, false);
  const a = await toast('Success', 'Changes saved', 'Maya Khoury · profile details updated (audited).');
  const b = await toast('Info', 'Reset link queued', 'Maya receives it by email. If delivery fails it appears in Delivery monitor.');
  f.appendChild(b); f.appendChild(a); b.x = 1056; a.x = 1056; b.y = 900 - 24 - b.height; a.y = b.y - 12 - a.height;
  return f;
}
const FR = [
  ['Light · primary (edit)', 'Light — Edit', 80, 80, false, 'edit', withDrawer], ['Dark · primary (edit)', 'Dark — Edit', 1600, 80, true, 'edit', withDrawer],
  ['State · Create new', 'Light — Create new', 80, 1140, false, 'create', withDrawer],
  ['State · Validation error (duplicate email)', 'Light — Validation error, duplicate email', 1600, 1140, false, 'dupe', withDrawer],
  ['State · Save conflict', 'Light — Save conflict', 3120, 1140, false, 'conflict', withDrawer],
  ['State · Deactivate impact (confirm dialog)', 'Light — Deactivate impact', 4640, 1140, false, 0, deactivate],
  ['State · Change role (confirm dialog)', 'Light — Change role', 80, 2200, false, 0, roleChange],
  ['State · Success (+ reset link queued)', 'Light — Success', 1600, 2200, false, 0, success],
];
for (const [cap, suf, x, y, dark, v, fn] of FR) { await caption(sec, cap, x, y); const n = BASE + ' — ' + suf; rec(n, fn === withDrawer ? await fn(n, x, y, dark, v) : await fn(n, x, y)); }
const an = AL('Annotations · SCR-OWN-003', 'HORIZONTAL', { gap: 24 }); sec.appendChild(an); an.x = 80; an.y = 3260;
for (const [t, h, b] of [
  ['Interaction', 'D1 — Edit (M1)', 'Profile fields only; role and status are never in the edit path (RV4-04). Save validates required name/email, email format and uniqueness (Proposed) → toast; conflict → reload/review (SHR-014 pattern).'],
  ['Interaction', 'D2 — Change role (M2) / Deactivate (M3)', 'Each opens its confirm dialog. Change role: impact list, sessions revoked (Proposed). Deactivate: open-items list, sessions revoked (Confirmed), items flagged, not moved. Disabled on your own account and the last active Owner (Proposed).'],
  ['Interaction', 'D3 — Reset link', 'Send reset link queues an email (asynchronous, AR-15): the toast says “queued”, never “sent”. Failures surface in SCR-OWN-012.'],
]) an.appendChild(await anno(t, h, b));
rec('annotations', an);
fitSec(sec);
return OUT;
