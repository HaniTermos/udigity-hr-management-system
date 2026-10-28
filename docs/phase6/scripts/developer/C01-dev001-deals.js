// C01-dev001-deals.js — Developer Screen Agent — Phase 6 Batch C — page 44 HiFi — Developer (96:6)
// SCR-DEV-001 Deals. Frames: Light primary (closed deals, company-wide eligible), Dark, Accepted opportunities
// (DEC-005 Alt 1 — not selected), Owner view (needs attention), Empty, Loading, Load error. Desktop only (inventory Mob "—").
// Rules: Developers see eligible CLOSED deals only (RW-01); inaccessible rows omitted, not counted (WF-ACCESS-001).
// Idempotent: the section is found by name; its children are rebuilt; its position is set only when it is created.
// Spec: docs/phase6/screens/developer-spec.md · Interactions: docs/phase6/interaction-spec.md (Developer section).
// ===== shared helpers (identical in C01–C05) =====
const PAGE_ID = '96:6';
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const OUT = { created: {}, updated: {}, fit: {}, warnings: [] };
const SEM = 'VariableCollectionId:40:3', PRIM = 'VariableCollectionId:40:2';
const SEMC = await figma.variables.getVariableCollectionByIdAsync(SEM);
const V = {};
for (const v of await figma.variables.getLocalVariablesAsync()) { if (v.variableCollectionId === SEM) V[v.name] = v; else if (v.variableCollectionId === PRIM) V['p/' + v.name] = v; }
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const GS = {}; for (const s of await figma.getLocalGridStylesAsync()) GS[s.name] = s;
const ID = { Shell: '49:1926', MShell: '49:2034', Breadcrumb: '49:1006', Tabs: '49:1198', Badge: '44:435', Flag: '44:491', Chip: '44:509', Notice: '44:549', Button: '45:305', IconButton: '45:405', Link: '45:441', Avatar: '44:358', Count: '44:471', Divider: '44:364', Surface: '51:1772', Section: '51:1780', Inset: '51:1797', Metric: '51:1842', ListItem: '51:1870', KV: '51:1888', HCell: '51:1599', Cell: '51:1634', Task: '54:2196', Column: '54:2200', TLItem: '54:2309', Milestone: '54:2333', Note: '54:2384', Week: '54:2028', Scrim: '53:1814', Dialog: '53:1818', Drawer: '53:1846', Banner: '53:1960', ErrSum: '53:1964', Toast: '53:2032', State: '53:2155', Skeleton: '53:2172', Access: '53:2240', Select: '46:434', Date: '46:594', Search: '46:748', FChip: '46:768', RadioCard: '46:831', Input: '45:796', Textarea: '45:847', Annotation: '44:395' };
const IC = { plus: '44:58', more: '44:183', calendar: '44:18', board: '44:113', briefcase: '44:103', clock: '44:23', menu: '44:178', refresh: '44:293', check: '44:48', edit: '44:263', chevl: '44:38', chevr: '44:43', flag: '44:208', x: '44:53' };
function rec(k, n) { if (n) OUT.created[k] = n.id; return n; }
function warn(m) { OUT.warnings.push(m); }
function vv(n) { const v = V[n]; if (!v) throw new Error('Missing variable ' + n); return v; }
function P(n) { return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', vv(n)); }
function num(n, f, val) { const v = V['p/space/' + val]; if (v) n.setBoundVariable(f, v); else n[f] = val; }
function rad(n, key) { const v = V['p/radius/' + key]; for (const c of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) { if (v) n.setBoundVariable(c, v); else n[c] = 8; } }
function AL(name, dir, o) {
  o = o || {}; const f = figma.createAutoLayout(dir || 'HORIZONTAL'); f.name = name; f.fills = [];
  if (o.gap != null) num(f, 'itemSpacing', o.gap);
  if (o.pad != null) { const a = [].concat(o.pad); const t = a[0], r = a[1] != null ? a[1] : t, b = a[2] != null ? a[2] : t, l = a[3] != null ? a[3] : r; num(f, 'paddingTop', t); num(f, 'paddingRight', r); num(f, 'paddingBottom', b); num(f, 'paddingLeft', l); }
  if (o.fill) f.fills = [P(o.fill)];
  if (o.stroke) { f.strokes = [P(o.stroke)]; f.strokeWeight = 1; f.strokeAlign = 'INSIDE'; }
  if (o.radius) rad(f, o.radius);
  if (o.align) f.counterAxisAlignItems = o.align;
  if (o.justify) f.primaryAxisAlignItems = o.justify;
  if (o.wrap) { f.layoutWrap = 'WRAP'; num(f, 'counterAxisSpacing', o.gap != null ? o.gap : 8); }
  return f;
}
function bottomRule(f, col) { f.strokes = [P(col || 'border/subtle')]; f.strokeAlign = 'INSIDE'; f.strokeTopWeight = 0; f.strokeLeftWeight = 0; f.strokeRightWeight = 0; f.strokeBottomWeight = 1; }
function put(p, c, w, h) { p.appendChild(c); if (w) c.layoutSizingHorizontal = w; if (h) c.layoutSizingVertical = h; return c; }
function spacer(p) { const s = figma.createFrame(); s.name = 'Spacer'; s.fills = []; s.resize(1, 1); p.appendChild(s); s.layoutGrow = 1; return s; }
async function T(chars, style, color, o) {
  o = o || {}; const t = figma.createText(); t.fontName = { family: 'Inter', style: 'Regular' }; t.characters = String(chars);
  const st = TS[style]; if (!st) throw new Error('Missing text style ' + style); await t.setTextStyleIdAsync(st.id);
  t.fills = [P(color || 'text/primary')]; t.name = o.name || String(chars).slice(0, 40);
  if (o.w) { t.textAutoResize = 'HEIGHT'; t.resize(o.w, Math.max(1, t.height)); }
  if (o.center) t.textAlignHorizontal = 'CENTER';
  return t;
}
async function TF(p, chars, style, color) { const t = await T(chars, style, color, { w: 200 }); put(p, t, 'FILL'); t.textAutoResize = 'HEIGHT'; return t; }
const _n = {};
async function comp(key) { const id = ID[key]; if (!_n[id]) { const n = await figma.getNodeByIdAsync(id); if (!n) throw new Error('DS component not found: ' + key + ' ' + id); _n[id] = n; } return _n[id]; }
async function inst(key, props, name) {
  const n = await comp(key); let c = n;
  if (n.type === 'COMPONENT_SET') { const w = props || {}; c = n.children.find(ch => ch.variantProperties && Object.entries(w).every(([k, v]) => ch.variantProperties[k] === v)); if (!c) { warn(`No variant ${JSON.stringify(w)} in ${key}; default used`); c = n.defaultVariant; } }
  const i = c.createInstance(); if (name) i.name = name; return i;
}
function setP(i, obj) {
  if (!i) { warn('setP on missing instance ' + JSON.stringify(obj).slice(0, 80)); return i; }
  const cp = i.componentProperties, upd = {};
  for (const [k, v] of Object.entries(obj)) { const key = Object.keys(cp).find(x => x === k || x.split('#')[0] === k); if (!key) { warn(`${i.name}: no property ${k}`); continue; } upd[key] = v; }
  try { if (Object.keys(upd).length) i.setProperties(upd); } catch (e) { warn(`${i.name}: setProperties failed ${e.message}`); }
  return i;
}
function nested(root, name) { return root.findOne(n => n.type === 'INSTANCE' && n.name === name); }
function layerText(root, name, txt, quiet) { const t = root.findOne(n => n.type === 'TEXT' && n.name === name); if (!t) { if (!quiet) warn(`no text layer ${name} in ${root.name}`); return; } try { t.characters = txt; } catch (e) { warn(`text ${name}: ${e.message}`); } }
function slotOf(i, name) { const s = i.findAll(n => n.type === 'SLOT'); return s.find(x => x.name === name) || s[0] || null; }
function clearSlot(s) { if (!s) return; for (const ch of [...s.children]) { try { ch.remove(); } catch (e) { ch.visible = false; } } }
function fillSlot(i, nodes, name, gap) { const s = slotOf(i, name || 'Content'); if (!s) { warn('no slot in ' + i.name); return null; } clearSlot(s); if (gap != null) num(s, 'itemSpacing', gap); for (const n of nodes) if (n) put(s, n, hugK(n)); return s; }
// M-6: badges, chips and policy chips HUG inside slots; everything else FILL
function hugK(n) { return n.type === 'INSTANCE' && (/^(Badge|Badge\/Flag|Chip\/Derived) · /.test(n.name) || (n.name.startsWith('Policy · ') && n.variantProperties && n.variantProperties.Size === 'Chip')) ? 'HUG' : 'FILL'; }
// ---- DS builders (every visible text set explicitly)
async function badge(tone, label, size, dot) { const b = await inst('Badge', { Tone: tone, Size: size || 'Small' }, 'Badge · ' + label); setP(b, { Label: label, 'Show dot': dot !== false }); return b; }
async function flag(tone, label) { const b = await inst('Flag', { Tone: tone }, 'Badge/Flag · ' + label); setP(b, { Label: label }); return b; }
async function chip(tone, label) { const c = await inst('Chip', { Tone: tone }, 'Chip/Derived · ' + label); setP(c, { Label: label }); return c; }
async function nchip(dec, title) { const n = await inst('Notice', { Size: 'Chip', Tone: 'Policy pending' }, 'Policy · ' + dec); setP(n, { DEC: dec }); layerText(n, 'Title', title || 'pending', true); return n; }
async function ninline(dec, body) { const n = await inst('Notice', { Size: 'Inline', Tone: 'Policy pending' }, 'Policy · ' + dec); setP(n, { DEC: dec, Body: body }); layerText(n, 'Title', 'Policy pending', true); return n; }
async function nblock(dec, body, title) { const n = await inst('Notice', { Size: 'Block', Tone: 'Policy pending' }, 'Policy · ' + dec); setP(n, { DEC: dec, Body: body }); layerText(n, 'Title', title || 'Policy pending — not decided', true); return n; }
async function button(variant, size, label, icon, state) { const b = await inst('Button', { Variant: variant, Size: size, State: state || 'Default' }, 'Button · ' + label); setP(b, { Label: label, 'Show icon': !!icon }); if (icon) setP(b, { Icon: IC[icon] }); return b; }
async function link(label, size) { const l = await inst('Link', { Size: size || 'Small', State: 'Default' }, 'Link · ' + label); setP(l, { Label: label, 'Show icon': false }); return l; }
async function avatar(ini) { const a = await inst('Avatar', { Size: 'Small', Tone: 'Neutral' }, 'Avatar · ' + ini); setP(a, { Initials: ini }); return a; }
async function stateN(type, size, title, body, action) { const s = await inst('State', { Type: type, Size: size }, 'State · ' + type); layerText(s, 'Title', title); if (body != null) layerText(s, 'Body', body, true); if (type !== 'Loading') setP(s, { 'Show action': !!action }); if (action) setP(nested(s, 'Action'), { Label: action, 'Show icon': false }); return s; }
async function access(type, size, title, body, action) { const a = await inst('Access', { Type: type, Size: size }, 'Notice/Access · ' + type); layerText(a, 'Title', title); layerText(a, 'Body', body); const b = nested(a, 'Action'); if (b) { if (action) setP(b, { Label: action, 'Show icon': false }); else b.visible = false; } return a; }
async function field(kind, vp, label, value, o) {
  o = o || {}; const f = await inst(kind, vp, 'Field · ' + label);
  const p = { Label: label, 'Show label': true, Required: !!o.req, Value: value || '', Placeholder: o.ph || 'Select', Helper: o.help || ' ', 'Show helper': !!o.help };
  if (o.err) p['Error message'] = o.err; if (o.counter) p.Counter = o.counter;
  if (kind === 'Search') { setP(f, { Placeholder: o.ph || 'Search', Value: value || '' }); return f; }
  setP(f, p); if (o.ini) setP(nested(f, 'Avatar'), { Initials: o.ini }); return f;
}
async function fchip(label, active) { const c = await inst('FChip', { State: active ? 'Active' : 'Default' }, 'Chip/Filter · ' + label); setP(c, { Label: label }); return c; }
async function tabs(style, active, labels, counts) {
  const t = await inst('Tabs', { Style: style, Active: String(active) }, 'Tabs · ' + labels.join('/'));
  for (let i = 0; i < 4; i++) { const it = nested(t, 'Tab ' + (i + 1)); if (!it) continue; if (i >= labels.length) { it.visible = false; continue; } setP(it, { Label: labels[i], 'Show count': !!(counts && counts[i] != null) }); if (counts && counts[i] != null) { const cb = nested(it, 'Count badge') || nested(it, 'Count'); if (cb) setP(cb, { Count: String(counts[i]) }); else warn('tab count badge not found: ' + labels[i]); } }
  return t;
}
async function ann(type, title, body) { const a = await inst('Annotation', { Type: type }, 'Annotation · ' + title); setP(a, { Title: title, Body: body }); return a; }
async function row(name, nodes, gap, wrap) { const r = AL(name, 'HORIZONTAL', { gap: gap == null ? 8 : gap, align: 'CENTER', wrap: !!wrap }); for (const n of nodes) if (n) r.appendChild(n); return r; }
// ---- tables composed from Table/HeaderCell + Table/Cell instances (no Table/Row: its columns are fixed)
async function table(parent, cols, rows) {
  const t = AL('Table', 'VERTICAL', { fill: 'surface/default', stroke: 'border/default', radius: 'lg' }); t.clipsContent = true; put(parent, t, 'FILL');
  const hr = AL('Header row', 'HORIZONTAL', { fill: 'surface/sunken' }); bottomRule(hr, 'border/default'); put(t, hr, 'FILL');
  for (const [lab, w, al] of cols) { const h = await inst('HCell', { Align: al || 'Left', Sort: 'None' }, 'TH · ' + (lab || 'actions')); setP(h, { Label: lab || ' ' }); hr.appendChild(h); h.resize(w === 'FILL' ? 80 : w, 40); if (w === 'FILL') h.layoutSizingHorizontal = 'FILL'; }
  for (const r of rows) {
    const tr = AL('Row · ' + (r[0].a || 'row').slice(0, 40), 'HORIZONTAL', { fill: 'surface/default', align: 'CENTER' }); bottomRule(tr); put(t, tr, 'FILL');
    for (let i = 0; i < cols.length; i++) { const w = cols[i][1], s = r[i] || { t: 'text', a: '' }; let c;
      if (s.t === 'nodes') { c = AL('Cell · ' + cols[i][0], 'HORIZONTAL', { gap: 6, pad: [8, 12], align: 'CENTER', wrap: true }); for (const n of await s.f()) c.appendChild(n); tr.appendChild(c); if (w === 'FILL') c.layoutSizingHorizontal = 'FILL'; else { c.layoutSizingHorizontal = 'FIXED'; c.resize(w, Math.max(56, c.height)); } c.layoutSizingVertical = 'HUG'; c.minHeight = 56; continue; }
      const type = { meta: 'Text with meta', text: 'Text', avatar: 'Avatar', status: 'Status', link: 'Link' }[s.t];
      c = await inst('Cell', { Type: type }, 'TD · ' + cols[i][0]); tr.appendChild(c); c.resize(w === 'FILL' ? 80 : w, 56); if (w === 'FILL') c.layoutSizingHorizontal = 'FILL';
      if (s.t === 'meta' || s.t === 'text' || s.t === 'avatar') setP(c, { Text: s.a, Meta: s.b || ' ' });
      if (s.t === 'avatar') setP(nested(c, 'Avatar'), { Initials: s.ini });
      if (s.t === 'status') setP(nested(c, 'Status'), { Tone: s.tone, Label: s.a, 'Show dot': true });
      if (s.t === 'link') setP(nested(c, 'Link'), { Label: s.a, 'Show icon': false });
    }
  }
  return t;
}
// ---- sections, frames
async function startSection(name, sub) {
  let s = page.children.find(n => n.type === 'SECTION' && n.name === name);
  if (s) { for (const ch of [...s.children]) ch.remove(); OUT.updated[name] = s.id; }
  else { s = figma.createSection(); s.name = name; page.appendChild(s); const o = page.children.filter(n => n.type === 'SECTION' && n !== s); s.x = 0; s.y = o.length ? Math.max(...o.map(x => x.y + x.height)) + 400 : 0; OUT.created[name] = s.id; }
  s.resizeWithoutConstraints(2000, 1400);
  const a = await T(name, 'ds/Display', 'text/primary', { name: 'Section title' }); s.appendChild(a); a.x = 80; a.y = 56;
  const b = await T(sub, 'ds/Body', 'text/secondary', { name: 'Section subtitle', w: 2400 }); s.appendChild(b); b.x = 80; b.y = 112;
  return { s, X: 80, name };
}
async function endSection(S, notes) {
  const r = AL('Annotations', 'HORIZONTAL', { gap: 24, align: 'MIN' }); S.s.appendChild(r); r.x = 80; r.y = 1180;
  for (const [t, ti, b] of notes) r.appendChild(rec(S.name + ' › Annotation · ' + ti, await ann(t, ti, b)));
  S.s.resizeWithoutConstraints(Math.max(S.X - 40, r.width + 160), Math.ceil(r.y + r.height + 80));
  for (const o of page.children) if (o.type === 'SECTION' && o !== S.s && o.y > S.s.y && o.y < S.s.y + S.s.height + 400) warn(`${S.name} now ends at ${S.s.y + S.s.height}; next section ${o.name} starts at ${o.y} (needs 400 px gap — orchestrator to re-flow)`);
  OUT.fit[S.name + ' (section)'] = [S.s.x, S.s.y, Math.round(S.s.width), Math.round(S.s.height)];
}
const WHO = { LA: ['Lina Aoun', 'Developer', 'Checked in · 08:47'], SF: ['Sami Fares', 'Developer', 'Checked in · 08:51'], RH: ['Rana Haddad', 'Owner/Admin', 'Checked in · 08:30'] };
async function desk(S, name, who, nav, search) {
  const f = figma.createFrame(); f.name = name; S.s.appendChild(f); f.resize(1440, 900); f.x = S.X; S.X += 1560; f.y = 200; f.fills = [P('surface/page')]; f.clipsContent = true;
  f.setExplicitVariableModeForCollection(SEMC, '40:1');
  const owner = who === 'RH', role = owner ? 'Owner' : 'Developer';
  const sh = await inst('Shell', { Role: role }, 'Shell/Desktop · ' + role); f.appendChild(sh); sh.x = 0; sh.y = 0;
  for (const it of sh.findAll(n => n.type === 'INSTANCE' && n.name.startsWith('Nav/Item · '))) { const lab = it.name.slice(11); setP(it, { State: lab === nav ? 'Active' : 'Default' }); setP(it, { Label: lab, 'Show badge': false }); const icn = { 'Deals': 'briefcase', 'Deals & Meetings': 'briefcase', 'Meetings & Calendar': 'calendar', 'Projects': 'board' }[lab]; if (icn) setP(it, { Icon: IC[icn] }); }
  const secs = sh.findAll(n => n.type === 'INSTANCE' && n.name === 'Nav/SectionLabel'); (owner ? ['OVERVIEW', 'PEOPLE', 'BUSINESSES', 'CALLING', 'DELIVERY', 'ADMIN'] : ['MY WORK', 'DELIVERY']).forEach((t, i) => { if (secs[i]) setP(secs[i], { Label: t }); });
  const tb = nested(sh, 'TopBar');
  if (tb) { const w = WHO[who]; setP(tb, { Name: w[0], Role: w[1], 'Show attendance': true, 'Show search': true }); layerText(tb, 'Name', w[0], true); layerText(tb, 'Role', w[1], true); setP(nested(tb, 'Avatar'), { Initials: who }); setP(nested(tb, 'Search'), { Placeholder: search || 'Search deals, projects, tasks…', Value: '' }); setP(nested(tb, 'Attendance'), { Label: w[2] }); } else warn('TopBar not found');
  const c = figma.createAutoLayout('VERTICAL'); c.name = 'Content'; f.appendChild(c); c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED'; c.resize(1200, 836); c.x = 240; c.y = 64; c.fills = []; c.clipsContent = true;
  for (const k of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) num(c, k, 24); num(c, 'itemSpacing', 16);
  if (GS['ds/Grid/Desktop content 12-col']) await c.setGridStyleIdAsync(GS['ds/Grid/Desktop content 12-col'].id);
  rec(name, f); return { f, c };
}
function dark(S, f, name) { const d = f.clone(); d.name = name; S.s.appendChild(d); d.x = S.X; S.X += f.width + 120; d.y = 200; d.setExplicitVariableModeForCollection(SEMC, '40:2'); rec(name, d); return d; }
async function scrim(f, mobile) { const s = await inst('Scrim', { Size: mobile ? 'Mobile' : 'Desktop' }, 'Overlay/Scrim'); f.appendChild(s); s.x = 0; s.y = 0; return s; }
async function drawer(f, title, sub, nodes, footer) {
  await scrim(f); const dr = await inst('Drawer', null, 'Drawer · ' + title); f.appendChild(dr); dr.x = 960; dr.y = 0;
  setP(dr, { Title: title, Subtitle: sub || ' ', 'Show subtitle': !!sub });
  const bs = slotOf(dr, 'Content'), body = stage(f, bs, 'Drawer body', 16, nodes);
  const fs = dr.findAll(n => n.type === 'SLOT').find(s => s.name === 'Footer');
  if (fs) { clearSlot(fs); const fr = AL('Drawer actions', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); fs.appendChild(fr); try { fr.layoutSizingHorizontal = 'FILL'; } catch (e) { fr.resize(Math.max(1, fs.width - 48), 40); } fr.layoutSizingVertical = 'HUG'; for (const b of footer) { if (b === 'spacer') spacer(fr); else fr.appendChild(b); } } else warn('drawer footer slot not found');
  meta(f).drawer = { dr, bs, body }; return dr;
}
async function dialog(f, title, desc, nodes, sec, pri, o) {
  o = o || {}; await scrim(f, o.mobile); const d = await inst('Dialog', null, 'Dialog · ' + title); f.appendChild(d);
  setP(d, { Title: title, Description: desc || ' ', 'Show description': !!desc, 'Show footer': !!(sec || pri), 'Show close': true });
  if (o.w) d.resize(o.w, d.height);
  meta(f).dbody = stage(f, slotOf(d, 'Content'), 'Dialog body', 12, nodes);
  const sb = nested(d, 'Secondary action'), pb = nested(d, 'Primary action');
  if (sb) { if (sec) setP(sb, { Label: sec, 'Show icon': false }); else sb.visible = false; }
  if (pb) { if (pri) { setP(pb, { Label: pri, 'Show icon': false }); if (o.destructive) setP(pb, { Variant: 'Destructive' }); if (o.disabled) setP(pb, { State: 'Disabled' }); } else pb.visible = false; }
  const W = o.mobile ? 390 : 1440, H = o.mobile ? 844 : 900; d.x = Math.round((W - d.width) / 2); d.y = Math.max(o.mobile ? 16 : 40, Math.round((H - d.height) / 2));
  meta(f).dialog = d; return d;
}
const _META = {}; function meta(f) { return _META[f.id] || (_META[f.id] = {}); }
function relayout(f) { for (const i of f.findAll(n => n.type === 'INSTANCE' && n.name.startsWith('Field · '))) { try { if (i.layoutSizingHorizontal === 'FILL') { i.layoutSizingHorizontal = 'FIXED'; i.layoutSizingHorizontal = 'FILL'; } } catch (e) { } } const M = meta(f); kick(M.drawer && M.drawer.body); kick(M.dbody); }
// N44-1/2: nested instances moved into another instance's slot keep the layout of their old (320 default) width. So the
// slot body is built detached, at the slot's inner width, in a plain frame (layout runs there, as on mobile), then:
// 1 append to slot, 2 wrapper FILL, 3 children FILL, 4 own text HEIGHT+FILL, 5 relayout (wrapper width really changes).
function stage(f, s, name, gap, nodes) {
  if (!s) { warn('no Content slot in ' + f.name); return null; }
  const W = Math.max(200, Math.round(s.width - (s.paddingLeft || 0) - (s.paddingRight || 0))); clearSlot(s); num(s, 'itemSpacing', 0);
  const b = AL(name, 'VERTICAL', { gap }); f.appendChild(b); b.resize(W, 10); b.counterAxisSizingMode = 'FIXED'; b.primaryAxisSizingMode = 'AUTO';
  for (const n of nodes) if (n) put(b, n, hugK(n));
  s.appendChild(b); try { b.layoutSizingHorizontal = 'FILL'; } catch (e) { b.layoutSizingHorizontal = 'FIXED'; } b.layoutSizingVertical = 'HUG';
  for (const n of b.children) if (hugK(n) === 'FILL') { try { n.layoutSizingHorizontal = 'FILL'; } catch (e) { } }
  for (const t of b.findAll(n => n.type === 'TEXT' && !lockedIn(n, b))) if (t.parent === b || t.layoutSizingHorizontal === 'FILL') { try { t.layoutSizingHorizontal = 'FILL'; t.textAutoResize = 'HEIGHT'; } catch (e) { } }
  kick(b); return b;
}
function kick(b) { if (!b || b.removed) return; try { const w = b.width, fill = b.layoutSizingHorizontal === 'FILL'; b.layoutSizingHorizontal = 'FIXED'; b.resize(w - 1, b.height); if (fill) b.layoutSizingHorizontal = 'FILL'; else b.resize(w, b.height); b.layoutSizingVertical = 'HUG'; } catch (e) { warn('relayout ' + b.name + ': ' + e.message); } }
// fit: FILL layers inside slot instances that kept an old width, or that render past their instance box
function stale(b) {
  const o = []; if (!b || b.removed) return o; const inner = p => p.width - (p.paddingLeft || 0) - (p.paddingRight || 0);
  for (const i of b.findAll(n => n.type === 'INSTANCE' && !lockedIn(n, b) && shown(n, b))) {
    const ib = i.absoluteBoundingBox; if (!ib) continue; let m = null;
    for (const k of i.findAll(x => shown(x, i))) {
      const p = k.parent; if (p && p.layoutMode === 'VERTICAL' && k.layoutSizingHorizontal === 'FILL' && Math.abs(k.width - inner(p)) > 1.5) { m = k.name + ' ' + Math.round(k.width) + '/' + Math.round(inner(p)); break; }
      const kb = k.absoluteRenderBounds; if (kb && kb.x + kb.width > ib.x + ib.width + 1.5) { m = k.name + ' +' + Math.round(kb.x + kb.width - ib.x - ib.width) + 'w'; break; }
    }
    if (m) o.push(i.name + ' › ' + m);
  }
  return o;
}
function lockedIn(p, root) { for (let a = p.parent; a && a !== root; a = a.parent) if (a.type === 'INSTANCE') return true; return false; } // D-5: p sits inside another instance, so scripts cannot resize it
function shown(n, root) { for (let p = n; p && p !== root; p = p.parent) if (p.visible === false) return false; return true; }
function fit(f, o) {
  o = o || {}; relayout(f); const r = { size: [Math.round(f.width), Math.round(f.height)] }, over = [];
  const c = f.children.find(n => n.name === 'Content');
  if (c) { const cb = c.absoluteBoundingBox; let mb = cb.y; for (const ch of c.children) { if (ch.visible === false) continue; const b = ch.absoluteBoundingBox; if (b) mb = Math.max(mb, b.y + b.height); } r.contentUsed = Math.round(mb - cb.y); r.contentH = Math.round(cb.height); const free = Math.round(cb.y + cb.height - (c.paddingBottom || 0) - mb); r.contentFree = free; if (free < 0) { if (o.scroll) r.belowFold = -free; else warn(`${f.name}: content overflows by ${-free} px`); } }
  for (const n of f.findAll(x => x.parent && x.parent !== f && x.layoutPositioning !== 'ABSOLUTE')) {
    const p = n.parent; if (!p.layoutMode || p.layoutMode === 'NONE' || !shown(n, f)) continue;
    const pb = p.absoluteBoundingBox, b = n.absoluteBoundingBox; if (!pb || !b || b.width < 1) continue;
    const dx = b.x + b.width - (pb.x + pb.width - (p.paddingRight || 0)); if (dx > 1.5) over.push(`${n.name} ⊄ ${p.name} +${Math.round(dx)}w`);
    const fixedH = p.layoutMode === 'VERTICAL' ? p.primaryAxisSizingMode === 'FIXED' : p.counterAxisSizingMode === 'FIXED';
    if (fixedH && p.clipsContent && !(o.scroll && p === c)) { const dy = b.y + b.height - (pb.y + pb.height - (p.paddingBottom || 0)); if (dy > 1.5) { const m = `${n.name} ⊄ ${p.name} +${Math.round(dy)}h`; if (p.type === 'INSTANCE' && lockedIn(p, f) && dy <= (p.paddingBottom || 0) + 0.5) (r.padOnly = r.padOnly || []).push(m + ' (bottom padding only, not clipped; component geometry)'); else over.push(m); } }
  }
  const M = meta(f);
  for (const k of ['dialog', 'drawer']) if (M[k]) { const d = k === 'drawer' ? M[k].dr : M[k]; r[k] = [Math.round(d.width), Math.round(d.height)]; if (d.y + d.height > f.height - (k === 'drawer' ? 0 : 8) + 0.5) warn(`${f.name}: ${k} taller than the frame`); }
  if (M.drawer) { const { bs, body } = M.drawer; const free = Math.round(bs.absoluteBoundingBox.y + bs.height - (bs.paddingBottom || 0) - (body.absoluteBoundingBox.y + body.height)); r.drawerBodyFree = free; if (free < 0) warn(`${f.name}: drawer body taller than its slot by ${-free} px`); }
  if (o.mobile) { const small = []; for (const n of f.findAll(x => x.type === 'INSTANCE' && /^(Button|IconButton|Link|Chip\/Filter) · /.test(x.name) && shown(x, f))) if (n.height < 44) small.push(`${n.name} ${Math.round(n.height)}px`); const bk = f.findOne(x => x.type === 'INSTANCE' && x.name === 'Back'); if (bk && shown(bk, f)) r.backButton = Math.round(bk.height); if (bk && shown(bk, f) && bk.height < 44) small.push('Header Back ' + Math.round(bk.height) + 'px (Component request: Shell/Mobile/Header)'); r.tapTargetsUnder44 = small; if (small.length) warn(`${f.name}: ${small.length} tap target(s) < 44 px`); }
  { const M = meta(f), st = stale(M.drawer && M.drawer.body).concat(stale(M.dbody)); r.stale = st.slice(0, 8); if (st.length) warn(`${f.name}: ${st.length} stale/overrunning layer(s) in the overlay, e.g. ${st[0]}`); }
  r.overflow = over.slice(0, 12); if (over.length) warn(`${f.name}: ${over.length} overflow(s), e.g. ${over[0]}`);
  OUT.fit[f.name] = r; return r;
}
// ===== end shared helpers =====

const S = await startSection('SCR-DEV-001 — Deals', 'UC-PROJ-001, UC-DEAL-001 · WF-DEAL-001/002, WF-ACCESS-001 · SM-COMMERCIAL-001. Company-wide eligible closed deals; accepted opportunities only under DEC-005 Alt 1 (not selected). Desktop 1440×900. Fictional data (Phase 5 brief §5).');
const N = 'SCR-DEV-001 — Deals — Desktop — ';
const PS = { 'In progress': 'Brand', 'Waiting for client': 'Warning', 'Blocked': 'Danger', 'Completed': 'Success', 'Scheduled': 'Neutral', 'Delivered': 'Info' };
const mine = () => chip('Neutral', 'Assigned to me');
const proj = (s, extra) => ({ t: 'nodes', f: async () => [await badge(PS[s], s), ...(extra ? [await chip('Amber', extra)] : [])] });
const CLOSED = [
  [{ t: 'meta', a: 'Nova Dental Clinic — Patient booking portal', b: 'DL-0035 · Clinic' }, { t: 'status', tone: 'Info', a: 'Closed deal' }, { t: 'avatar', a: 'Lina Aoun', ini: 'LA' }, { t: 'text', a: '16 Oct 2026' }, { t: 'nodes', f: async () => [await chip('Amber', 'Project provisioning pending'), await nchip('F2', 'pending')] }, { t: 'nodes', f: async () => [await mine()] }, { t: 'link', a: 'Open' }],
  [{ t: 'meta', a: 'Glow Beauty Salon — Booking website', b: 'DL-0031 · Salon · Downtown branch' }, { t: 'status', tone: 'Info', a: 'Closed deal' }, { t: 'avatar', a: 'Sami Fares', ini: 'SF' }, { t: 'text', a: '13 Oct 2026' }, proj('In progress'), { t: 'nodes', f: async () => [] }, { t: 'link', a: 'Open' }],
  [{ t: 'meta', a: 'Lumen Yoga Studio — Class schedule site', b: 'DL-0034 · Gym' }, { t: 'status', tone: 'Info', a: 'Closed deal' }, { t: 'avatar', a: 'Lina Aoun', ini: 'LA' }, { t: 'text', a: '9 Oct 2026' }, proj('Waiting for client'), { t: 'nodes', f: async () => [await mine()] }, { t: 'link', a: 'Open' }],
  [{ t: 'meta', a: 'Harbor Auto Care — Service reminders', b: 'DL-0027 · Services' }, { t: 'status', tone: 'Info', a: 'Closed deal' }, { t: 'avatar', a: 'Sami Fares', ini: 'SF' }, { t: 'text', a: '2 Oct 2026' }, proj('Blocked', 'Delivery overdue'), { t: 'nodes', f: async () => [] }, { t: 'link', a: 'Open' }],
  [{ t: 'meta', a: 'Urban Cuts Barbershop — Online booking', b: 'DL-0024 · Salon' }, { t: 'status', tone: 'Info', a: 'Closed deal' }, { t: 'avatar', a: 'Lina Aoun', ini: 'LA' }, { t: 'text', a: '28 Sep 2026' }, proj('Completed'), { t: 'nodes', f: async () => [await mine()] }, { t: 'link', a: 'Open' }]
];
const CCOLS = [['Deal', 300], ['Stage', 132], ['Developer', 156], ['Closed on', 112], ['Project status', 240], ['For you', 'FILL'], ['', 72]];
async function header(c, owner) {
  await pageHeadSimple(c, owner ? 'Deals' : 'Deals', owner ? 'All deal records with their commercial stage. Owner view.' : 'Closed deals from the whole company that you are eligible to see. Closed deal ≠ completed project — delivery runs on the project board.');
}
async function pageHeadSimple(c, title, sub) {
  const h = AL('Page header', 'VERTICAL', { gap: 4 }); put(c, h, 'FILL');
  const r = await row('Title row', [await T(title, 'ds/H1', 'text/primary', { name: 'Title' })], 12); put(h, r, 'FILL');
  await TF(h, sub, 'ds/Body Small', 'text/secondary');
}
async function tabsRow(c, active, owner, mode) {
  const r = AL('Tabs row', 'HORIZONTAL', { gap: 12, align: 'CENTER' }); put(c, r, 'FILL');
  // M-3: count follows the visible rows — 0 on Empty, hidden while Loading / on Load error
  const cnt = mode === 'empty' ? 0 : (mode === 'loading' || mode === 'error') ? null : 5;
  if (owner) r.appendChild(await tabs('Underline', 1, ['All deals', 'Closed deals', 'Not proceeding'], [10, 5, 1]));
  else { r.appendChild(await tabs('Underline', active, ['Closed deals', 'Accepted opportunities'], [active === 2 ? 5 : cnt, active === 2 ? 4 : null])); r.appendChild(await nchip('DEC-005', active === 2 ? 'Alt 1 — not selected' : 'tab only if Alt 1')); }
  return r;
}
async function filters(c, chips) {
  const r = AL('Filter bar', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(c, r, 'FILL');
  const s = await field('Search', { Size: 'Medium', State: 'Default' }, 'Search', '', { ph: 'Search deals or businesses' }); r.appendChild(s); s.resize(300, s.height);
  for (const [l, a] of chips) r.appendChild(await fchip(l, a));
  spacer(r); r.appendChild(await T('Sorted by stage date, newest first', 'ds/Caption', 'text/muted'));
  return r;
}
async function deals(name, mode) {
  const owner = mode === 'owner';
  const { f, c } = await desk(S, name, owner ? 'RH' : 'LA', owner ? 'Deals & Meetings' : 'Deals');
  await header(c, owner); await tabsRow(c, mode === 'accepted' ? 2 : 1, owner, mode);
  if (mode === 'closed' || mode === 'empty' || mode === 'loading') await filters(c, [['Assigned to me', false], ['Developer: Any', false], ['Closed: last 30 days', false], ['Project status: Any', false]]);
  if (mode === 'closed') {
    await table(c, CCOLS, CLOSED);
    const cap = await row('Caption row', [await T('Closed deals only · no pre-closure or unassigned rows · rows you cannot access are omitted and not counted (WF-ACCESS-001).', 'ds/Caption', 'text/muted')]); put(c, cap, 'FILL');
    const pol = await row('Policy row', [await nchip('DEC-002', '15-day visibility pending'), await nchip('DEC-017', 'one or many deals per business'), await nchip('Proposed', 'stage names, no DEC ID')], 8, true); put(c, pol, 'FILL');
  }
  if (mode === 'accepted') {
    put(c, await nblock('DEC-005', 'This tab exists only if DEC-005 Alt 1 is adopted: it lists pre-closure deal records assigned to you. Under Alt 2 the tab is absent and you see closed deals only. Neither is selected.', 'Pre-closure access — policy pending'), 'FILL');
    await filters(c, [['Stage: Any', false], ['Accepted: last 60 days', false]]);
    const next = (t, ch) => ({ t: 'nodes', f: async () => [...(ch ? [await chip('Neutral', ch)] : []), await T(t, 'ds/Body Small', 'text/secondary')] });
    await table(c, [['Deal', 292], ['Stage', 184], ['Developer', 150], ['Stage since', 124], ['Next', 'FILL'], ['', 72]], [
      [{ t: 'meta', a: 'Peak Fitness Gym — Member app', b: 'DL-0040 · Gym' }, { t: 'status', tone: 'Neutral', a: 'Accepted opportunity' }, { t: 'avatar', a: 'Lina Aoun', ini: 'LA' }, { t: 'text', a: '14 Oct 2026' }, next('Meeting Wed 21 Oct, 14:00', 'Upcoming'), { t: 'link', a: 'Open' }],
      [{ t: 'meta', a: 'Cedar Home Realty — Listings website', b: 'DL-0033 · Real estate' }, { t: 'status', tone: 'Warning', a: 'Signed and paid' }, { t: 'avatar', a: 'Lina Aoun', ini: 'LA' }, { t: 'text', a: '15 Oct 2026' }, next('Awaiting closure · authority DEC-006 pending'), { t: 'link', a: 'Open' }],
      [{ t: 'meta', a: 'Bloom Florist — Delivery orders site', b: 'DL-0039 · Shop' }, { t: 'status', tone: 'Neutral', a: 'Paid' }, { t: 'avatar', a: 'Lina Aoun', ini: 'LA' }, { t: 'text', a: '17 Oct 2026' }, next('Signature outstanding'), { t: 'link', a: 'Open' }],
      [{ t: 'meta', a: 'Sunrise Bakery — Online ordering', b: 'DL-0037 · Shop' }, { t: 'status', tone: 'Neutral', a: 'Signed' }, { t: 'avatar', a: 'Lina Aoun', ini: 'LA' }, { t: 'text', a: '12 Oct 2026' }, next('Payment outstanding'), { t: 'link', a: 'Open' }]
    ]);
    put(c, await row('Caption row', [await T('Only records assigned to you · accepted ≠ signed ≠ paid ≠ closed · signature and payment may be recorded in either order (Proposed).', 'ds/Caption', 'text/muted')]), 'FILL');
    put(c, await row('Policy row', [await nchip('R-12', 'Alt 2 × DEC-006 → user'), await nchip('DEC-002', 'visibility after 15 days')], 8), 'FILL');
  }
  if (mode === 'owner') {
    const fb = AL('Filter bar', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(c, fb, 'FILL');
    fb.appendChild(await fchip('Needs attention', true)); fb.appendChild(await fchip('Developer not yet assigned · 1', false)); fb.appendChild(await fchip('Closure verification requested · 1', false)); fb.appendChild(await nchip('DEC-006', 'Alt B — not selected')); spacer(fb);
    const dev = (n, i) => ({ t: 'avatar', a: n, ini: i });
    await table(c, [['Deal', 292], ['Stage', 184], ['Developer', 224], ['Stage since', 120], ['Attention', 'FILL'], ['', 84]], [
      [{ t: 'meta', a: 'Olive & Thyme Café — Loyalty app', b: 'DL-0041 · Café' }, { t: 'status', tone: 'Neutral', a: 'Accepted opportunity' }, { t: 'nodes', f: async () => [await chip('Amber', 'Developer not yet assigned')] }, { t: 'text', a: '19 Oct 2026' }, { t: 'nodes', f: async () => [await button('Secondary', 'Small', 'Assign developer…')] }, { t: 'link', a: 'Open' }],
      [{ t: 'meta', a: 'Cedar Home Realty — Listings website', b: 'DL-0033 · Real estate' }, { t: 'status', tone: 'Warning', a: 'Signed and paid' }, dev('Lina Aoun', 'LA'), { t: 'text', a: '15 Oct 2026' }, { t: 'nodes', f: async () => [await flag('Warning', 'Closure verification requested'), await nchip('DEC-006', 'Alt B')] }, { t: 'link', a: 'Review' }],
      [{ t: 'meta', a: 'Nova Dental Clinic — Patient booking portal', b: 'DL-0035 · Clinic' }, { t: 'status', tone: 'Info', a: 'Closed deal' }, dev('Lina Aoun', 'LA'), { t: 'text', a: '16 Oct 2026' }, { t: 'nodes', f: async () => [await chip('Amber', 'Project provisioning pending'), await nchip('F2', 'pending')] }, { t: 'link', a: 'Open' }]
    ]);
    put(c, await row('Caption row', [await T('Owner sees every deal record. "Developer not yet assigned" and "Project provisioning pending" are derived conditions, not stages (E3, F3).', 'ds/Caption', 'text/muted')]), 'FILL');
    put(c, await ninline('Proposed', 'Where the Owner finds closure review items: this "Needs attention" filter plus the Owner dashboard attention list (RW-04) — proposed, not decided.'), 'FILL');
  }
  if (mode === 'empty' || mode === 'error') {
    const a = AL('State area', 'VERTICAL', { align: 'CENTER', justify: 'CENTER', fill: 'surface/default', stroke: 'border/default', radius: 'lg' }); put(c, a, 'FILL', 'FILL');
    a.appendChild(mode === 'empty'
      ? await stateN('Empty', 'Page', 'No eligible closed deals yet', 'Closed deals from the whole company appear here when you are eligible to see them. Deals hidden by policy are not listed or counted.', null)
      : await stateN('Error', 'Page', 'Deals could not be loaded', 'Nothing was changed. Check your connection and try again.', 'Try again'));
  }
  if (mode === 'loading') {
    const t = AL('Table (loading)', 'VERTICAL', { fill: 'surface/default', stroke: 'border/default', radius: 'lg' }); t.clipsContent = true; put(c, t, 'FILL');
    for (let i = 0; i < 6; i++) put(t, await inst('Skeleton', { Type: 'Table row' }, 'Skeleton · row ' + (i + 1)), 'FILL');
    put(c, await row('Caption row', [await T('Loading deals…', 'ds/Caption', 'text/muted')]), 'FILL');
  }
  fit(f); return f;
}
const L = await deals(N + 'Light', 'closed');
dark(S, L, N + 'Dark');
await deals(N + 'Light — Accepted opportunities (DEC-005 Alt 1, not selected)', 'accepted');
await deals(N + 'Light — Owner view: needs attention', 'owner');
await deals(N + 'Light — Empty', 'empty');
await deals(N + 'Light — Loading', 'loading');
await deals(N + 'Light — Load error', 'error');
await endSection(S, [
  ['Interaction', 'I1 — Open a deal', 'Row or "Open" → SCR-DEV-002 for that deal. Filters: stage, developer, date, project status; "Assigned to me" is a derived chip, not a filter-only state. Rows the user cannot access are omitted and not counted.'],
  ['Note', 'N1 — Eligible closed deals only (RW-01)', 'The Closed-deals tab never lists pre-closure or unassigned records. "Accepted opportunities" exists only under DEC-005 Alt 1 (assigned rows only); under Alt 2 the tab is absent. Neither alternative is selected.'],
  ['Note', 'N2 — Owner view', 'Owner sees all records and two derived attention conditions: Developer not yet assigned (E3) and Project provisioning pending (F3). Closure verification requested appears only if DEC-006 Alt B is adopted.'],
  ['Implementation', 'N3 — States', 'Empty: no action (Developers do not create deals). Loading: skeleton rows. Load error: nothing changed, Try again. Hidden-by-policy records never appear as rows (see SCR-SHR-012).']
]);
return OUT;
