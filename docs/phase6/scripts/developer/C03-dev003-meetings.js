// C03-dev003-meetings.js — Developer Screen Agent — Phase 6 Batch C — page 44 HiFi — Developer (96:6)
// SCR-DEV-003 Meetings & calendar. Frames: Week Light (primary), Week Dark, List with states (Scheduled, Held,
// Cancelled, Missed — Proposed; Upcoming / Awaiting outcome derived; reminder failed), Empty, Mobile Light (P2).
// SM-MEETING-001: Rescheduled is an event with history, not a state (R-13). Pre-closure meetings depend on DEC-005.
// Idempotent: section found by name, children rebuilt, position set only on creation.
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
function fillSlot(i, nodes, name, gap) { const s = slotOf(i, name || 'Content'); if (!s) { warn('no slot in ' + i.name); return null; } clearSlot(s); if (gap != null) num(s, 'itemSpacing', gap); for (const n of nodes) if (n) put(s, n, 'FILL'); return s; }
// ---- DS builders (every visible text set explicitly)
async function badge(tone, label, size, dot) { const b = await inst('Badge', { Tone: tone, Size: size || 'Small' }, 'Badge · ' + label); setP(b, { Label: label, 'Show dot': dot !== false }); return b; }
async function flag(tone, label) { const b = await inst('Flag', { Tone: tone }, 'Badge/Flag · ' + label); setP(b, { Label: label }); return b; }
async function chip(tone, label) { const c = await inst('Chip', { Tone: tone }, 'Chip/Derived · ' + label); setP(c, { Label: label }); return c; }
async function nchip(dec, title) { const n = await inst('Notice', { Size: 'Chip', Tone: 'Policy pending' }, 'Policy · ' + dec); setP(n, { DEC: dec }); layerText(n, 'Title', title || 'pending', true); return n; }
async function button(variant, size, label, icon, state) { const b = await inst('Button', { Variant: variant, Size: size, State: state || 'Default' }, 'Button · ' + label); setP(b, { Label: label, 'Show icon': !!icon }); if (icon) setP(b, { Icon: IC[icon] }); return b; }
async function iconBtn(icon, name) { const b = await inst('IconButton', { Variant: 'Secondary', Size: 'Medium', State: 'Default' }, 'IconButton · ' + name); setP(b, { Icon: IC[icon], 'Show dot': false }); return b; }
async function link(label, size) { const l = await inst('Link', { Size: size || 'Small', State: 'Default' }, 'Link · ' + label); setP(l, { Label: label, 'Show icon': false }); return l; }
async function avatar(ini) { const a = await inst('Avatar', { Size: 'Small', Tone: 'Neutral' }, 'Avatar · ' + ini); setP(a, { Initials: ini }); return a; }
async function banner(tone, title, body, action, size) {
  const b = await inst('Banner', { Tone: tone, Size: size || 'Default' }, 'Banner · ' + (title || body).slice(0, 30));
  setP(b, { Title: title || ' ', Body: body, 'Show title': !!title, 'Show close': false }); if ((size || 'Default') === 'Default') setP(b, { 'Show action': !!action });
  if (action) setP(nested(b, 'Action'), { Label: action, 'Show icon': false }); return b;
}
async function stateN(type, size, title, body, action) { const s = await inst('State', { Type: type, Size: size }, 'State · ' + type); layerText(s, 'Title', title); if (body != null) layerText(s, 'Body', body, true); if (type !== 'Loading') setP(s, { 'Show action': !!action }); if (action) setP(nested(s, 'Action'), { Label: action, 'Show icon': false }); return s; }
async function access(type, size, title, body, action) { const a = await inst('Access', { Type: type, Size: size }, 'Notice/Access · ' + type); layerText(a, 'Title', title); layerText(a, 'Body', body); const b = nested(a, 'Action'); if (b) { if (action) setP(b, { Label: action, 'Show icon': false }); else b.visible = false; } return a; }
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
const MTABS = [['My Day', 'clock'], ['Tasks', 'board'], ['Meetings', 'calendar'], ['More', 'menu']];
async function mob(S, name, o) {
  const f = figma.createFrame(); f.name = name; S.s.appendChild(f); f.resize(390, 844); f.x = S.X; S.X += 510; f.y = 200; f.fills = [P('surface/page')]; f.clipsContent = true;
  f.setExplicitVariableModeForCollection(SEMC, '40:1');
  const sh = await inst('MShell', { Role: 'Developer' }, 'Shell/Mobile · Developer'); f.appendChild(sh); sh.x = 0; sh.y = 0;
  const h = nested(sh, 'Header');
  if (h) { setP(h, { Back: o.back ? 'True' : 'False' }); setP(h, { Title: o.title, Subtitle: o.sub || ' ', 'Show subtitle': !!o.sub }); setP(nested(h, 'Avatar'), { Initials: o.ini || 'SF' }); } else warn('mobile header not found');
  const tb = nested(sh, 'TabBar');
  if (tb) { if (o.tab) { setP(tb, { Active: String(o.tab) }); for (let i = 0; i < 4; i++) { const t = nested(tb, 'Tab ' + (i + 1)); if (t) setP(t, { Label: MTABS[i][0], Icon: IC[MTABS[i][1]] }); } } else tb.visible = false; }
  const c = AL('Content', 'VERTICAL', { gap: 12, pad: 16 }); f.appendChild(c); c.x = 0; c.y = 56; c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED'; c.resize(390, o.tab ? 724 : (o.foot ? 708 : 788)); c.clipsContent = true;
  let ft = null;
  if (o.foot) { ft = AL('Sticky footer', 'HORIZONTAL', { gap: 8, pad: [12, 16], fill: 'surface/default', align: 'CENTER' }); f.appendChild(ft); ft.x = 0; ft.y = 764; ft.primaryAxisSizingMode = 'FIXED'; ft.counterAxisSizingMode = 'FIXED'; ft.resize(390, 80); ft.strokes = [P('border/default')]; ft.strokeAlign = 'INSIDE'; ft.strokeTopWeight = 1; ft.strokeBottomWeight = 0; ft.strokeLeftWeight = 0; ft.strokeRightWeight = 0; for (const b of o.foot) put(ft, b, 'FILL'); }
  rec(name, f); return { f, c, sh, ft };
}
function dark(S, f, name) { const d = f.clone(); d.name = name; S.s.appendChild(d); d.x = S.X; S.X += f.width + 120; d.y = 200; d.setExplicitVariableModeForCollection(SEMC, '40:2'); rec(name, d); return d; }
async function scrim(f, mobile) { const s = await inst('Scrim', { Size: mobile ? 'Mobile' : 'Desktop' }, 'Overlay/Scrim'); f.appendChild(s); s.x = 0; s.y = 0; return s; }
async function drawer(f, title, sub, nodes, footer) {
  await scrim(f); const dr = await inst('Drawer', null, 'Drawer · ' + title); f.appendChild(dr); dr.x = 960; dr.y = 0;
  setP(dr, { Title: title, Subtitle: sub || ' ', 'Show subtitle': !!sub });
  const bs = slotOf(dr, 'Content'); clearSlot(bs); num(bs, 'itemSpacing', 0);
  const body = AL('Drawer body', 'VERTICAL', { gap: 16 }); bs.appendChild(body);
  try { body.layoutSizingHorizontal = 'FILL'; } catch (e) { body.resize(Math.max(1, bs.width - (bs.paddingLeft || 0) - (bs.paddingRight || 0)), 10); body.layoutSizingHorizontal = 'FIXED'; } body.layoutSizingVertical = 'HUG';
  for (const n of nodes) if (n) put(body, n, 'FILL');
  const fs = dr.findAll(n => n.type === 'SLOT').find(s => s.name === 'Footer');
  if (fs) { clearSlot(fs); const fr = AL('Drawer actions', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); fs.appendChild(fr); try { fr.layoutSizingHorizontal = 'FILL'; } catch (e) { fr.resize(Math.max(1, fs.width - 48), 40); } fr.layoutSizingVertical = 'HUG'; for (const b of footer) { if (b === 'spacer') spacer(fr); else fr.appendChild(b); } } else warn('drawer footer slot not found');
  meta(f).drawer = { dr, bs, body }; return dr;
}
async function dialog(f, title, desc, nodes, sec, pri, o) {
  o = o || {}; await scrim(f, o.mobile); const d = await inst('Dialog', null, 'Dialog · ' + title); f.appendChild(d);
  setP(d, { Title: title, Description: desc || ' ', 'Show description': !!desc, 'Show footer': !!(sec || pri), 'Show close': true });
  if (o.w) d.resize(o.w, d.height);
  fillSlot(d, nodes, 'Content', 12);
  const sb = nested(d, 'Secondary action'), pb = nested(d, 'Primary action');
  if (sb) { if (sec) setP(sb, { Label: sec, 'Show icon': false }); else sb.visible = false; }
  if (pb) { if (pri) { setP(pb, { Label: pri, 'Show icon': false }); if (o.destructive) setP(pb, { Variant: 'Destructive' }); if (o.disabled) setP(pb, { State: 'Disabled' }); } else pb.visible = false; }
  const W = o.mobile ? 390 : 1440, H = o.mobile ? 844 : 900; d.x = Math.round((W - d.width) / 2); d.y = Math.max(o.mobile ? 16 : 40, Math.round((H - d.height) / 2));
  meta(f).dialog = d; return d;
}
function relayout(f) { for (const i of f.findAll(n => n.type === 'INSTANCE' && n.name.startsWith('Field · '))) { try { if (i.layoutSizingHorizontal === 'FILL') { i.layoutSizingHorizontal = 'FIXED'; i.layoutSizingHorizontal = 'FILL'; } } catch (e) { } } }
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
    if (fixedH && p.clipsContent && !(o.scroll && p === c)) { const dy = b.y + b.height - (pb.y + pb.height - (p.paddingBottom || 0)); if (dy > 1.5) over.push(`${n.name} ⊄ ${p.name} +${Math.round(dy)}h`); }
  }
  const M = meta(f);
  for (const k of ['dialog', 'drawer']) if (M[k]) { const d = M[k].dr || M[k]; r[k] = [Math.round(d.width), Math.round(d.height)]; if (d.y + d.height > f.height - 8) warn(`${f.name}: ${k} taller than the frame`); }
  if (M.drawer) { const { bs, body } = M.drawer; const free = Math.round(bs.absoluteBoundingBox.y + bs.height - (bs.paddingBottom || 0) - (body.absoluteBoundingBox.y + body.height)); r.drawerBodyFree = free; if (free < 0) warn(`${f.name}: drawer body taller than its slot by ${-free} px`); }
  if (o.mobile) { const small = []; for (const n of f.findAll(x => x.type === 'INSTANCE' && /^(Button|IconButton|Link|Chip\/Filter) · /.test(x.name) && shown(x, f))) if (n.height < 44) small.push(`${n.name} ${Math.round(n.height)}px`); const bk = f.findOne(x => x.type === 'INSTANCE' && x.name === 'Back'); if (bk && shown(bk, f)) r.backButton = Math.round(bk.height); if (bk && shown(bk, f) && bk.height < 44) small.push('Header Back ' + Math.round(bk.height) + 'px (Component request: Shell/Mobile/Header)'); r.tapTargetsUnder44 = small; if (small.length) warn(`${f.name}: ${small.length} tap target(s) < 44 px`); }
  r.overflow = over.slice(0, 12); if (over.length) warn(`${f.name}: ${over.length} overflow(s), e.g. ${over[0]}`);
  OUT.fit[f.name] = r; return r;
}
// ===== end shared helpers =====

const S = await startSection('SCR-DEV-003 — Meetings & calendar', 'UC-DEAL-004, UC-DEAL-001 · WF-DEAL-001 · SM-MEETING-001. Developer meetings as a week calendar or a list. Desktop 1440×900 + mobile 390×844 (P2). Today = Tue 20 Oct 2026, 09:20.');
const N = 'SCR-DEV-003 — Meetings & calendar — ';
async function head(c) {
  const h = AL('Page header', 'VERTICAL', { gap: 4 }); put(c, h, 'FILL');
  const tr = AL('Title row', 'HORIZONTAL', { gap: 12, align: 'CENTER' }); put(h, tr, 'FILL');
  tr.appendChild(await T('Meetings & calendar', 'ds/H1', 'text/primary', { name: 'Title' })); spacer(tr);
  tr.appendChild(await nchip('DEC-005', 'who may schedule')); tr.appendChild(await button('Secondary', 'Medium', 'Schedule meeting', 'plus'));
  await TF(h, 'Meetings on deals you can access. Rescheduling keeps the previous time in the meeting history.', 'ds/Body Small', 'text/secondary');
}
async function toolbar(c, active) {
  const r = AL('Toolbar', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(c, r, 'FILL');
  r.appendChild(await tabs('Segmented', active, ['Week', 'List']));
  r.appendChild(await iconBtn('chevl', 'Previous week')); r.appendChild(await iconBtn('chevr', 'Next week'));
  r.appendChild(await button('Ghost', 'Medium', 'Today')); r.appendChild(await T('19 – 25 Oct 2026', 'ds/H4', 'text/primary'));
  spacer(r); r.appendChild(await fchip('My meetings', true)); r.appendChild(await fchip('Status: Any', false));
}
async function week(name) {
  const { f, c } = await desk(S, name, 'LA', 'Meetings & Calendar');
  await head(c); await toolbar(c, 1);
  const w = await inst('Week', null, 'Calendar/Week'); put(c, w);
  const ev = w.findAll(n => n.type === 'INSTANCE' && n.parent === w).sort((a, b) => (a.x - b.x) || (a.y - b.y));
  const E = [['Done', '09:30–10:00 · Held', 'Lumen Yoga Studio — handover'], ['Overdue', '11:00 · Awaiting outcome', 'Sunrise Bakery — scope call'], ['Meeting', '10:00–10:30', 'Bloom Florist — requirements'], ['Meeting', '14:00–15:00', 'Peak Fitness Gym — Member app kickoff'], ['Meeting', '14:30–15:00', 'Nova Dental Clinic — content review'], null];
  if (ev.length !== 6) warn('Calendar/Week: expected 6 events, found ' + ev.length);
  ev.forEach((e, i) => { const d = E[i]; if (!d) { e.visible = false; return; } setP(e, { Kind: d[0] }); setP(e, { Time: d[1], Title: d[2] }); e.name = 'Event · ' + d[2]; });
  const lg = AL('Legend', 'HORIZONTAL', { gap: 12, align: 'CENTER', wrap: true }); put(c, lg, 'FILL');
  for (const [t, l] of [['Info', 'Scheduled'], ['Success', 'Held']]) lg.appendChild(await badge(t, l));
  lg.appendChild(await chip('Amber', 'Awaiting outcome (derived)')); lg.appendChild(await chip('Neutral', 'Upcoming (derived)'));
  lg.appendChild(await T('Cancelled and Missed meetings are listed in List view. Event kind is shown by icon and label, not colour only.', 'ds/Caption', 'text/muted'));
  put(c, await row('Policy row', [await nchip('R-13', 'Missed is a proposed state'), await nchip('No DEC ID', 'reminder timing'), await nchip('DEC-005', 'Alt 2: closed-deal meetings only')], 8, true), 'FILL');
  fit(f); return f;
}
async function list(name, empty) {
  const { f, c } = await desk(S, name, 'LA', 'Meetings & Calendar');
  await head(c); await toolbar(c, 2);
  if (empty) {
    const a = AL('State area', 'VERTICAL', { align: 'CENTER', justify: 'CENTER', fill: 'surface/default', stroke: 'border/default', radius: 'lg' }); put(c, a, 'FILL', 'FILL');
    a.appendChild(await stateN('Empty', 'Page', 'No meetings this week', 'Meetings on deals you can access appear here. Under DEC-005 Alt 2 only meetings on closed deals would be shown.', null));
    fit(f); return f;
  }
  put(c, await banner('Warning', 'Reminder not sent', 'The reminder for Peak Fitness Gym — Member app kickoff (Wed 21 Oct, 14:00) could not be delivered. The meeting is still scheduled.', null), 'FILL');
  const nodes = (arr) => ({ t: 'nodes', f: async () => { const o = []; for (const [k, a, b] of arr) o.push(k === 'chip' ? await chip(a, b) : k === 'flag' ? await flag(a, b) : k === 'btn' ? await button('Secondary', 'Small', a) : k === 'link' ? await link(a) : await T(a, 'ds/Caption', 'text/muted')); return o; } });
  await table(c, [['When', 156], ['Meeting', 316], ['Attendees', 176], ['Status', 148], ['Condition', 'FILL'], ['', 156]], [
    [{ t: 'meta', a: 'Mon 19 Oct', b: '11:00–11:30' }, { t: 'meta', a: 'Sunrise Bakery — scope call', b: 'DL-0037 · Signed' }, { t: 'text', a: 'Lina Aoun' }, { t: 'status', tone: 'Info', a: 'Scheduled' }, nodes([['chip', 'Amber', 'Awaiting outcome']]), nodes([['btn', 'Record outcome…']])],
    [{ t: 'meta', a: 'Tue 20 Oct', b: '10:00–10:30' }, { t: 'meta', a: 'Bloom Florist — requirements', b: 'DL-0039 · Paid' }, { t: 'text', a: 'Lina Aoun, Maya Khoury' }, { t: 'status', tone: 'Info', a: 'Scheduled' }, nodes([['chip', 'Neutral', 'Upcoming']]), nodes([['btn', 'Reschedule…']])],
    [{ t: 'meta', a: 'Wed 21 Oct', b: '14:00–15:00' }, { t: 'meta', a: 'Peak Fitness Gym — Member app kickoff', b: 'DL-0040 · Accepted opportunity' }, { t: 'text', a: 'Lina Aoun, Maya Khoury' }, { t: 'status', tone: 'Info', a: 'Scheduled' }, nodes([['chip', 'Neutral', 'Upcoming'], ['flag', 'Warning', 'Reminder failed'], ['t', 'Rescheduled 1× · was Tue 20 Oct, 15:00']]), nodes([['btn', 'Reschedule…']])],
    [{ t: 'meta', a: 'Mon 19 Oct', b: '09:30–10:00' }, { t: 'meta', a: 'Lumen Yoga Studio — handover', b: 'DL-0034 · Closed deal' }, { t: 'text', a: 'Lina Aoun, Omar Nassar' }, { t: 'status', tone: 'Success', a: 'Held' }, nodes([['t', 'Discovery notes added']]), nodes([['link', 'View notes']])],
    [{ t: 'meta', a: 'Thu 15 Oct', b: '12:00–12:30' }, { t: 'meta', a: 'Cedar Home Realty — contract walkthrough', b: 'DL-0033 · Signed and paid' }, { t: 'text', a: 'Lina Aoun' }, { t: 'status', tone: 'Warning', a: 'Missed' }, nodes([['chip', 'Amber', 'Needs rearranging'], ['t', 'Missed is Proposed (R-13)']]), nodes([['btn', 'Reschedule…']])],
    [{ t: 'meta', a: 'Fri 16 Oct', b: '15:00–15:30' }, { t: 'meta', a: 'Urban Cuts Barbershop — training session', b: 'DL-0024 · Closed deal' }, { t: 'text', a: 'Lina Aoun' }, { t: 'status', tone: 'Neutral', a: 'Cancelled' }, nodes([['t', 'Reason: client asked to cancel']]), nodes([['t', 'No further actions']])]
  ]);
  put(c, await row('Policy row', [await nchip('DEC-005', 'pre-closure meetings only under Alt 1'), await nchip('R-13', 'Missed — Proposed'), await T('Upcoming / Awaiting outcome are derived from Scheduled + time; they are not states.', 'ds/Caption', 'text/muted')], 8, true), 'FILL');
  fit(f); return f;
}
const W = await week(N + 'Desktop — Light');
dark(S, W, N + 'Desktop — Dark');
await list(N + 'Desktop — Light — List with states');
await list(N + 'Desktop — Light — Empty', true);
{ // Mobile (P2) — agenda list; List/Item rows are the tap targets (>= 56 px)
  const { f, c } = await mob(S, N + 'Mobile — Light', { title: 'Meetings', sub: 'Week 19–25 Oct', tab: 3, ini: 'LA' });
  put(c, await banner('Warning', null, 'Reminder for Peak Fitness Gym kickoff was not sent. The meeting is still scheduled.', null, 'Inline'), 'FILL');
  const LI = async (t, m, tone, lab) => { const i = await inst('ListItem', { State: 'Default' }, 'List/Item · ' + t); setP(i, { Title: t, Meta: m, Icon: IC.calendar, 'Show leading': true, 'Show badge': true, 'Show chevron': true }); setP(nested(i, 'Badge'), { Tone: tone, Label: lab, 'Show dot': true }); return i; };
  for (const [g, items] of [
    ['NEEDS AN OUTCOME', [['Sunrise Bakery — scope call', 'Mon 19 Oct, 11:00 · awaiting outcome', 'Info', 'Scheduled']]],
    ['TODAY · TUE 20 OCT', [['Bloom Florist — requirements', '10:00–10:30 · upcoming', 'Info', 'Scheduled']]],
    ['TOMORROW · WED 21 OCT', [['Peak Fitness Gym — kickoff', '14:00–15:00 · rescheduled 1×', 'Info', 'Scheduled']]],
    ['EARLIER', [['Lumen Yoga Studio — handover', 'Mon 19 Oct · notes added', 'Success', 'Held'], ['Cedar Home Realty — walkthrough', 'Thu 15 Oct · needs rearranging', 'Warning', 'Missed']]]
  ]) { put(c, await T(g, 'ds/Overline', 'text/muted'), 'FILL'); for (const it of items) put(c, await LI(...it), 'FILL'); }
  put(c, await nchip('DEC-005', 'pre-closure meetings'), null);
  fit(f, { mobile: true, scroll: true });
}
await endSection(S, [
  ['Interaction', 'I1 — Open / act', 'Click an event or row → meeting drawer (SCR-DEV-004). Row actions: Reschedule… (Scheduled or Missed), Record outcome… (Scheduled after start time), Cancel (in drawer, reason). Held: only notes can be amended. Cancelled: no further actions.'],
  ['Interaction', 'I2 — Week navigation', 'Week / List segmented control; previous / next week; Today. "My meetings" filter on by default; status filter. Mobile: agenda list grouped by need → day; tap a row → full-screen meeting sheet.'],
  ['Note', 'N1 — States vs derived', 'States: Scheduled, Held, Cancelled, Missed (Proposed, R-13). Derived chips: Upcoming, Awaiting outcome, Needs rearranging. Rescheduled is an event with history ("Rescheduled 1×").'],
  ['Note', 'N2 — Reminder failure', 'A failed reminder never changes or blocks the meeting (Proposed, D5 analogy). Timing and recipients have no DEC ID. DEC-005: who may schedule and whether pre-closure meetings appear.']
]);
return OUT;
