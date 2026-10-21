// C02-dev002-deal-detail.js — Developer Screen Agent — Phase 6 Batch C — page 44 HiFi — Developer (96:6)
// SCR-DEV-002 Deal record detail. Frames: Light primary (Signed and paid, awaiting closure), Dark, Accepted opportunity
// (DEC-005 Alt 1 — not selected), Verification rejected (DEC-006 Alt B), Owner view: closure verification review (RW-04),
// Owner view: remove recorded fact (RW-04 dialog), Hidden by policy, Save conflict. Desktop only.
// Four separate facts: accepted ≠ signed ≠ paid ≠ closed. Closure authority DEC-006 / R-12 stays pending (both options labelled).
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
async function chip(tone, label) { const c = await inst('Chip', { Tone: tone }, 'Chip/Derived · ' + label); setP(c, { Label: label }); return c; }
async function nchip(dec, title) { const n = await inst('Notice', { Size: 'Chip', Tone: 'Policy pending' }, 'Policy · ' + dec); setP(n, { DEC: dec }); layerText(n, 'Title', title || 'pending', true); return n; }
async function ninline(dec, body) { const n = await inst('Notice', { Size: 'Inline', Tone: 'Policy pending' }, 'Policy · ' + dec); setP(n, { DEC: dec, Body: body }); layerText(n, 'Title', 'Policy pending', true); return n; }
async function nblock(dec, body, title) { const n = await inst('Notice', { Size: 'Block', Tone: 'Policy pending' }, 'Policy · ' + dec); setP(n, { DEC: dec, Body: body }); layerText(n, 'Title', title || 'Policy pending — not decided', true); return n; }
async function button(variant, size, label, icon, state) { const b = await inst('Button', { Variant: variant, Size: size, State: state || 'Default' }, 'Button · ' + label); setP(b, { Label: label, 'Show icon': !!icon }); if (icon) setP(b, { Icon: IC[icon] }); return b; }
async function iconBtn(icon, name) { const b = await inst('IconButton', { Variant: 'Secondary', Size: 'Medium', State: 'Default' }, 'IconButton · ' + name); setP(b, { Icon: IC[icon], 'Show dot': false }); return b; }
async function link(label, size) { const l = await inst('Link', { Size: size || 'Small', State: 'Default' }, 'Link · ' + label); setP(l, { Label: label, 'Show icon': false }); return l; }
async function avatar(ini) { const a = await inst('Avatar', { Size: 'Small', Tone: 'Neutral' }, 'Avatar · ' + ini); setP(a, { Initials: ini }); return a; }
async function divider() { return inst('Divider', { Orientation: 'Horizontal' }, 'Divider'); }
async function kv(type, key, value) { const k = await inst('KV', { Type: type }, 'KV · ' + key); setP(k, { Key: key, Value: value }); return k; }
async function banner(tone, title, body, action, size) {
  const b = await inst('Banner', { Tone: tone, Size: size || 'Default' }, 'Banner · ' + (title || body).slice(0, 30));
  setP(b, { Title: title || ' ', Body: body, 'Show title': !!title, 'Show close': false }); if ((size || 'Default') === 'Default') setP(b, { 'Show action': !!action });
  if (action) setP(nested(b, 'Action'), { Label: action, 'Show icon': false }); return b;
}
async function access(type, size, title, body, action) { const a = await inst('Access', { Type: type, Size: size }, 'Notice/Access · ' + type); layerText(a, 'Title', title); layerText(a, 'Body', body); const b = nested(a, 'Action'); if (b) { if (action) setP(b, { Label: action, 'Show icon': false }); else b.visible = false; } return a; }
async function card(key, title, sub, action) { const c = await inst(key, null, key + ' · ' + (title || 'content')); if (key === 'Section') { setP(c, { Title: title, Subtitle: sub || ' ', 'Show subtitle': !!sub, 'Show action': !!action }); if (action) setP(nested(c, 'Action'), { Label: action, 'Show icon': false }); } return c; }
async function field(kind, vp, label, value, o) {
  o = o || {}; const f = await inst(kind, vp, 'Field · ' + label);
  const p = { Label: label, 'Show label': true, Required: !!o.req, Value: value || '', Placeholder: o.ph || 'Select', Helper: o.help || ' ', 'Show helper': !!o.help };
  if (o.err) p['Error message'] = o.err; if (o.counter) p.Counter = o.counter;
  if (kind === 'Search') { setP(f, { Placeholder: o.ph || 'Search', Value: value || '' }); return f; }
  setP(f, p); if (o.ini) setP(nested(f, 'Avatar'), { Initials: o.ini }); return f;
}
async function ann(type, title, body) { const a = await inst('Annotation', { Type: type }, 'Annotation · ' + title); setP(a, { Title: title, Body: body }); return a; }
async function row(name, nodes, gap, wrap) { const r = AL(name, 'HORIZONTAL', { gap: gap == null ? 8 : gap, align: 'CENTER', wrap: !!wrap }); for (const n of nodes) if (n) r.appendChild(n); return r; }
// ---- tables composed from Table/HeaderCell + Table/Cell instances (no Table/Row: its columns are fixed)
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
function cloneF(S, f, name) { const d = f.clone(); d.name = name; S.s.appendChild(d); d.x = S.X; S.X += f.width + 120; d.y = 200; d.setExplicitVariableModeForCollection(SEMC, '40:1'); rec(name, d); return d; }
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

const S = await startSection('SCR-DEV-002 — Deal record detail', 'UC-DEAL-001/002 · WF-DEAL-002, WF-DEAL-001 · SM-COMMERCIAL-001. One deal: stage, signature/payment facts, closure, handoff context, meetings, context-limited business info. Desktop 1440×900.');
const N = 'SCR-DEV-002 — Deal record detail — Desktop — ';
const CEDAR = { biz: 'Cedar Home Realty', deal: 'Listings website', id: 'DL-0033', cat: 'Real estate', phone: '+000 70 000 103', web: 'cedar.example.com',
  facts: [['ACCEPTED', true, '14 Sep 2026', 'Omar Nassar · from call'], ['SIGNATURE', true, '7 Oct 2026', 'Agreement AGR-0133'], ['PAYMENT', true, '15 Oct 2026', 'Confirmation PAY-0151'], ['CLOSURE', false, 'Not closed yet', 'Needs all three facts']],
  stage: ['Warning', 'Signed and paid · awaiting closure'], needs: 'Listings with search by area and price; an enquiry form on each listing.', interest: 'Website with property listings',
  meetings: [['Discovery call', '22 Sep 2026 · 2 attendees', 'Success', 'Held'], ['Scope review', '1 Oct 2026 · 1 attendee', 'Success', 'Held']] };
const PEAK = { biz: 'Peak Fitness Gym', deal: 'Member app', id: 'DL-0040', cat: 'Gym', phone: '+000 70 000 102', web: 'peakfitness.example.com',
  facts: [['ACCEPTED', true, '14 Oct 2026', 'Maya Khoury · from call'], ['SIGNATURE', false, 'Not recorded', 'Agreement not signed yet'], ['PAYMENT', false, 'Not recorded', 'No payment yet'], ['CLOSURE', false, 'Not closed yet', 'Needs all three facts']],
  stage: ['Neutral', 'Accepted opportunity'], needs: 'Member app with class booking and a membership card; launch before January.', interest: 'Mobile app for members',
  meetings: [['Member app kickoff', 'Wed 21 Oct, 14:00 · Upcoming', 'Info', 'Scheduled']] };
function spacerNode() { const s = figma.createFrame(); s.name = 'Spacer'; s.fills = []; s.resize(1, 1); return s; }
async function sectionHead(t, l) { const r = await row('Head · ' + t, [await T(t, 'ds/H4', 'text/primary')]); if (l) { const sp = spacerNode(); r.appendChild(sp); sp.layoutGrow = 1; r.appendChild(await link(l)); } return r; }
async function factCard(D, owner, mode) {
  const cs = await card('Section', 'Commercial facts', 'Accepted ≠ signed ≠ paid ≠ closed — four separate recorded facts', null);
  const r = AL('Facts', 'HORIZONTAL', { gap: 12 });
  for (const [k, ok, v, m] of D.facts) {
    const ins = await card('Inset'); r.appendChild(ins); ins.layoutSizingHorizontal = 'FILL';
    const req = k === 'CLOSURE' && (owner || mode === 'rejected');
    const b = ok ? await badge('Success', 'Recorded') : req ? await badge(mode === 'rejected' ? 'Danger' : 'Warning', mode === 'rejected' ? 'Rejected' : 'Requested') : await badge('Neutral', 'Not recorded', 'Small', false);
    const sl = fillSlot(ins, [await T(k, 'ds/Overline', 'text/muted'), b], 'Content', 6);
    await TF(sl, req ? (mode === 'rejected' ? 'Verification rejected' : 'Awaiting your review') : v, 'ds/Body Strong', 'text/primary');
    await TF(sl, req ? (mode === 'rejected' ? '19 Oct · reason above' : 'Requested 18 Oct, 16:05') : m, 'ds/Caption', 'text/muted');
  }
  fillSlot(cs, [r, await row('Fact policies', [await nchip('DEC-018', 'evidence · deposit · amounts'), await T('No attachment or amount is required.', 'ds/Caption', 'text/muted')], 8)], 'Content', 12);
  return cs;
}
async function closureCard(mode) {
  const cs = await card('Section', 'Closure', mode === 'accepted' ? 'Closure needs signature and payment first' : 'All three facts are recorded', null);
  const items = [];
  if (mode === 'main' || mode === 'conflict') {
    items.push(await row('Closure options', [await button('Primary', 'Medium', 'Finalize closure…'), await T('or', 'ds/Caption', 'text/muted'), await button('Secondary', 'Medium', 'Request closure verification')], 8));
    items.push(await ninline('DEC-006 / R-12', 'Not decided: Finalize = Alt A (Developer closes, SCR-DEV-008) · Request verification = Alt B (Owner verifies). Only one will exist. R-12 → user decision.'));
  }
  if (mode === 'accepted') {
    items.push(await row('Record facts', [await button('Secondary', 'Medium', 'Record signature…'), await button('Secondary', 'Medium', 'Record payment…'), await T('Either order (Proposed)', 'ds/Caption', 'text/muted')], 8));
    items.push(await ninline('R-12', 'Recording facts before closure is possible only under DEC-005 Alt 1. DEC-005 Alt 2 × DEC-006 is a user decision.'));
  }
  if (mode === 'rejected') {
    items.push(await row('Rejected actions', [await button('Secondary', 'Medium', 'Request verification again'), await T('Only the Owner can remove a wrong fact (with a reason).', 'ds/Caption', 'text/muted')], 12));
    items.push(await nchip('DEC-006', 'Alt B — not selected'));
  }
  if (mode === 'owner') {
    items.push(await row('Owner actions', [await button('Primary', 'Medium', 'Verify & finalize closure'), await button('Secondary', 'Medium', 'Reject with reason…'), await button('Ghost', 'Medium', 'Remove recorded fact…')], 8));
    items.push(await ninline('DEC-006 Alt B / R-12', 'Owner verification is one of two closure options — not selected. The Owner may finalize directly under either option (Proposed).'));
  }
  fillSlot(cs, items, 'Content', 10); return cs;
}
async function handoff(p, D) {
  put(p, await sectionHead('Handoff context'), 'FILL');
  await TF(p, D.interest, 'ds/Body Strong', 'text/primary'); await TF(p, D.needs, 'ds/Body Small', 'text/secondary');
  p.appendChild(await link('Previous call notes (2) · from Call Center'));
}
async function rail(D, mode) {
  const r = await card('Surface', 'Right rail'); const sl = fillSlot(r, [], 'Content', 10);
  put(sl, await sectionHead('Business context'), 'FILL');
  put(sl, await access('Context-limited', 'Inline', 'Limited business context', 'Only what this deal needs is shown (DEC-005 pending).'), 'FILL');
  for (const [k, v] of [['Business', D.biz], ['Category', D.cat], ['Phone', D.phone], ['Website', D.web]]) put(sl, await kv('Default', k, v), 'FILL');
  put(sl, await divider(), 'FILL');
  const ms = AL('Meetings', 'VERTICAL', { gap: 4 }); put(sl, ms, 'FILL');
  put(ms, await sectionHead('Meetings', 'Schedule'), 'FILL');
  for (const [t, m, tone, lab] of D.meetings) { const i = await inst('ListItem', { State: 'Default' }, 'List/Item · ' + t); setP(i, { Title: t, Meta: m, Icon: IC.calendar, 'Show leading': true, 'Show badge': true, 'Show chevron': false }); setP(nested(i, 'Badge'), { Tone: tone, Label: lab, 'Show dot': true }); put(ms, i, 'FILL'); }
  if (mode === 'accepted') { put(sl, await divider(), 'FILL'); await handoff(sl, D); }
  return r;
}
async function detail(name, mode) {
  const owner = mode === 'owner';
  const D = mode === 'accepted' ? PEAK : CEDAR;
  const { f, c } = await desk(S, name, owner ? 'RH' : 'LA', owner ? 'Deals & Meetings' : 'Deals');
  const h = AL('Page header', 'VERTICAL', { gap: 6 }); put(c, h, 'FILL');
  const bc = await inst('Breadcrumb', null, 'Breadcrumb'); setP(bc, { 'Level 1': 'Deals', 'Level 2': D.biz, Current: D.deal, 'Show level 2': true }); h.appendChild(bc);
  const tr = AL('Title row', 'HORIZONTAL', { gap: 12, align: 'CENTER' }); put(h, tr, 'FILL');
  tr.appendChild(await T(D.biz + ' — ' + D.deal, 'ds/H1', 'text/primary', { name: 'Title' })); spacer(tr);
  if (!owner) tr.appendChild(await button('Ghost', 'Medium', 'Mark not proceeding…'));
  tr.appendChild(await iconBtn('more', 'More actions'));
  const meta = AL('Meta row', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(h, meta, 'FILL');
  meta.appendChild(await badge(D.stage[0], D.stage[1], 'Large'));
  if (!owner) meta.appendChild(await chip('Neutral', 'Assigned to me'));
  meta.appendChild(await avatar('LA')); meta.appendChild(await T('Lina Aoun · assigned developer', 'ds/Body Small', 'text/secondary'));
  meta.appendChild(await T(D.id + ' · ' + D.cat, 'ds/Body Small', 'text/muted'));
  if (mode === 'accepted') put(c, await nblock('DEC-005', 'You see this accepted opportunity only if DEC-005 Alt 1 (assigned scoping access) is adopted. Under Alt 2 this page is not available to Developers before closure.', 'Pre-closure access — policy pending'), 'FILL');
  if (mode === 'rejected') put(c, await banner('Error', 'Closure verification rejected', 'Rana Haddad, 19 Oct 2026, 11:20: “Payment reference PAY-0151 does not match agreement AGR-0133. Please check with the client.” The deal stays Signed and paid.', null), 'FILL');
  if (mode === 'conflict') put(c, await banner('Warning', 'This deal changed while you were working', 'Rana Haddad removed the payment fact at 10:42, so the stage is now Signed (payment outstanding). Your closure request was not sent. Nothing was overwritten.', 'Review changes'), 'FILL');
  if (owner) put(c, await banner('Warning', 'Closure verification requested by Lina Aoun', 'Sent 18 Oct 2026, 16:05: “Agreement and payment confirmed with the client.” Shown only if DEC-006 Alt B is adopted.', null), 'FILL');
  const split = AL('Main split', 'HORIZONTAL', { gap: 16 }); put(c, split, 'FILL', 'FILL');
  const left = AL('Left column', 'VERTICAL', { gap: 16 }); put(split, left, 'FILL', 'FILL');
  put(left, await factCard(D, owner, mode), 'FILL');
  put(left, await closureCard(mode), 'FILL');
  if (mode === 'main') { const hc = await card('Surface', 'Handoff'); const sl = fillSlot(hc, [], 'Content', 6); await handoff(sl, D); put(left, hc, 'FILL'); }
  const r = await rail(D, mode); split.appendChild(r); r.resize(336, r.height); r.layoutSizingHorizontal = 'FIXED'; r.layoutSizingVertical = 'FILL'; r.clipsContent = true;
  fit(f); return f;
}
const L = await detail(N + 'Light', 'main');
dark(S, L, N + 'Dark');
await detail(N + 'Light — Accepted opportunity (DEC-005 Alt 1, not selected)', 'accepted');
await detail(N + 'Light — Verification rejected (DEC-006 Alt B, not selected)', 'rejected');
const OV = await detail(N + 'Light — Owner view: closure verification review (DEC-006 Alt B, not selected)', 'owner');
{ // RW-04 second frame: Owner removes a recorded fact (reason required)
  const f = cloneF(S, OV, N + 'Light — Owner view: remove recorded fact');
  await dialog(f, 'Remove recorded fact', 'The stage goes back from Signed and paid to Signed (payment outstanding). The removal stays in the deal history and the audit log.', [
    await field('Select', { Type: 'Select', State: 'Filled' }, 'Fact to remove', 'Payment · 15 Oct 2026 · PAY-0151', { req: true }),
    await field('Textarea', { State: 'Filled' }, 'Reason', 'Entered on the wrong deal — this payment belongs to Bloom Florist.', { req: true, counter: '66 / 500', help: 'Required. Shown in history and audit.' }),
    await kv('Default', 'Stage after removal', 'Signed (payment outstanding)'),
    await ninline('DEC-006 / R-12', 'Owner-only correction before closure (Proposed). Closure authority stays pending.')
  ], 'Cancel', 'Remove fact', { destructive: true });
  fit(f);
}
{ // Hidden by policy — generic title, no data
  const { f, c } = await desk(S, N + 'Light — Hidden by policy', 'LA', 'Deals');
  const bc = await inst('Breadcrumb', null, 'Breadcrumb'); setP(bc, { 'Level 1': 'Deals', 'Level 2': 'Deals', Current: 'Record not available', 'Show level 2': false }); put(c, bc);
  const a = AL('State area', 'VERTICAL', { gap: 16, align: 'CENTER', justify: 'CENTER', fill: 'surface/default', stroke: 'border/default', radius: 'lg' }); put(c, a, 'FILL', 'FILL');
  a.appendChild(await access('Hidden by policy', 'Page', 'This deal is not visible to you', 'It may exist, but the visibility policy hides it from your role. No details are shown.', 'Back to deals'));
  a.appendChild(await row('Policy row', [await nchip('DEC-002', '15-day visibility'), await nchip('DEC-005', 'pre-closure access')], 8));
  fit(f);
}
await detail(N + 'Light — Save conflict', 'conflict');
await endSection(S, [
  ['Interaction', 'I1 — Record a fact', '"Record signature…" / "Record payment…" open a small form (date + reference, Proposed; no attachment or amount until DEC-018). Saving changes the stage only: Accepted → Signed / Paid → Signed and paid. Either order (OQ-05).'],
  ['Interaction', 'I2 — Closure', 'Alt A: "Finalize closure…" → SCR-DEV-008. Alt B: "Request closure verification" → Owner review item; Owner verifies & finalizes or rejects with a reason (banner on this page). Neither option is selected; only one will ship.'],
  ['Interaction', 'I3 — Owner correction', '"Remove recorded fact…" (Owner only, before closure): choose fact + required reason → stage reverts; original entry kept in history and audit (G3).'],
  ['Note', 'N1 — Not proceeding', '"Mark not proceeding…" needs a reason (Proposed) and exists on any non-closed stage. Calling-outcome effect is open (OQ-04).'],
  ['Implementation', 'N2 — Conflict / hidden', 'Save conflict: reload and re-apply; nothing overwritten (SCR-SHR-014 pattern). Hidden by policy: generic title, no record data, no count.']
]);
return OUT;
