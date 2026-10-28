// C06-dev006-project-board.js — Developer Screen Agent — Phase 6 Batch C — page 44 HiFi — Developer (96:6)
// SCR-DEV-006 Project board. Same structure as the approved S5 sample (page 30). Frames: Light primary, Dark,
// "Record delivered" open-task warning (P7), Completed read-only, Save conflict, Hidden by policy, Mobile Light (P1).
// Project status (SM-PROJECT-001, DEC-019 proposed, non-linear) is a separate control; kanban columns are TASK statuses
// (SM-TASK-001, proposed, no DEC ID). "Waiting for client" is only a project status; a task-level wait is the
// "Client dependency" chip. Idempotent: section found by name, children rebuilt, position set only on creation.
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
function fillSlot(i, nodes, name, gap) { const s = slotOf(i, name || 'Content'); if (!s) { warn('no slot in ' + i.name); return null; } clearSlot(s); if (gap != null) num(s, 'itemSpacing', gap); for (const n of nodes) if (n) put(s, n, hugK(n)); return s; }
// M-6: badges, chips and policy chips HUG inside slots; everything else FILL
function hugK(n) { return n.type === 'INSTANCE' && (/^(Badge|Badge\/Flag|Chip\/Derived) · /.test(n.name) || (n.name.startsWith('Policy · ') && n.variantProperties && n.variantProperties.Size === 'Chip')) ? 'HUG' : 'FILL'; }
// ---- DS builders (every visible text set explicitly)
async function badge(tone, label, size, dot) { const b = await inst('Badge', { Tone: tone, Size: size || 'Small' }, 'Badge · ' + label); setP(b, { Label: label, 'Show dot': dot !== false }); return b; }
async function chip(tone, label) { const c = await inst('Chip', { Tone: tone }, 'Chip/Derived · ' + label); setP(c, { Label: label }); return c; }
async function nchip(dec, title) { const n = await inst('Notice', { Size: 'Chip', Tone: 'Policy pending' }, 'Policy · ' + dec); setP(n, { DEC: dec }); layerText(n, 'Title', title || 'pending', true); return n; }
async function ninline(dec, body) { const n = await inst('Notice', { Size: 'Inline', Tone: 'Policy pending' }, 'Policy · ' + dec); setP(n, { DEC: dec, Body: body }); layerText(n, 'Title', 'Policy pending', true); return n; }
async function button(variant, size, label, icon, state) { const b = await inst('Button', { Variant: variant, Size: size, State: state || 'Default' }, 'Button · ' + label); setP(b, { Label: label, 'Show icon': !!icon }); if (icon) setP(b, { Icon: IC[icon] }); return b; }
async function iconBtn(icon, name) { const b = await inst('IconButton', { Variant: 'Secondary', Size: 'Medium', State: 'Default' }, 'IconButton · ' + name); setP(b, { Icon: IC[icon], 'Show dot': false }); return b; }
async function link(label, size) { const l = await inst('Link', { Size: size || 'Small', State: 'Default' }, 'Link · ' + label); setP(l, { Label: label, 'Show icon': false }); return l; }
async function avatar(ini) { const a = await inst('Avatar', { Size: 'Small', Tone: 'Neutral' }, 'Avatar · ' + ini); setP(a, { Initials: ini }); return a; }
async function divider() { return inst('Divider', { Orientation: 'Horizontal' }, 'Divider'); }
async function kv(type, key, value) { const k = await inst('KV', { Type: type }, 'KV · ' + key); setP(k, { Key: key, Value: value }); return k; }
async function tl(type, title, time, body, conn) { const t = await inst('TLItem', { Type: type }, 'Timeline · ' + title); setP(t, { Title: title, Time: time, Body: body, 'Show connector': conn !== false }); return t; }
async function note(accent, author, time, body) { const n = await inst('Note', { Accent: accent }, 'Note · ' + author); setP(n, { Author: author, Time: time, Body: body }); return n; }
async function banner(tone, title, body, action, size) {
  const b = await inst('Banner', { Tone: tone, Size: size || 'Default' }, 'Banner · ' + (title || body).slice(0, 30));
  setP(b, { Title: title || ' ', Body: body, 'Show title': !!title, 'Show close': false }); if ((size || 'Default') === 'Default') setP(b, { 'Show action': !!action });
  if (action) setP(nested(b, 'Action'), { Label: action, 'Show icon': false }); return b;
}
async function access(type, size, title, body, action) { const a = await inst('Access', { Type: type, Size: size }, 'Notice/Access · ' + type); layerText(a, 'Title', title); layerText(a, 'Body', body); const b = nested(a, 'Action'); if (b) { if (action) setP(b, { Label: action, 'Show icon': false }); else b.visible = false; } return a; }
async function card(key, title, sub, action) { const c = await inst(key, null, key + ' · ' + (title || 'content')); if (key === 'Section') { setP(c, { Title: title, Subtitle: sub || ' ', 'Show subtitle': !!sub, 'Show action': !!action }); if (action) setP(nested(c, 'Action'), { Label: action, 'Show icon': false }); } return c; }
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
const MTABS = [['My Day', 'clock'], ['Projects', 'board'], ['Meetings', 'calendar'], ['More', 'menu']];
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
function cloneF(S, f, name) { const d = f.clone(); d.name = name; S.s.appendChild(d); d.x = S.X; S.X += f.width + 120; d.y = 200; d.setExplicitVariableModeForCollection(SEMC, '40:1'); rec(name, d); return d; }
async function scrim(f, mobile) { const s = await inst('Scrim', { Size: mobile ? 'Mobile' : 'Desktop' }, 'Overlay/Scrim'); f.appendChild(s); s.x = 0; s.y = 0; return s; }
const _META = {}; function meta(f) { return _META[f.id] || (_META[f.id] = {}); }
function relayout(f) { for (const i of f.findAll(n => n.type === 'INSTANCE' && n.name.startsWith('Field · '))) { try { if (i.layoutSizingHorizontal === 'FILL') { i.layoutSizingHorizontal = 'FIXED'; i.layoutSizingHorizontal = 'FILL'; } } catch (e) { } } const M = meta(f); kick(M.drawer && M.drawer.body); kick(M.dbody); }
// N44-1/2: drawer(), dialog() and stage() are omitted here (no overlays in C06; C06b draws the dialogs). See C06b.
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

const S = await startSection('SCR-DEV-006 — Project board', 'UC-PROJ-003/004 · WF-PROJ-001 · SM-PROJECT-001, SM-TASK-001. One project: project status with allowed next statuses, schedule & milestones, task kanban (columns = task statuses), deal context. Desktop + mobile (P1).');
const N = 'SCR-DEV-006 — Project board — ';
const GLOW = { who: 'SF', crumbs: ['Projects', 'Glow Beauty Salon (Downtown branch)', 'Booking website'], title: 'Glow Beauty Salon — Booking website',
  meta: [['Brand', 'Project · In progress'], ['Info', 'Deal · Closed deal']], mine: true, dev: ['SF', 'Sami Fares'], code: 'PRJ-0014 · Salon · glowbeauty.example.com',
  status: ['Brand', 'In progress'], since: 'since 15 Oct 2026 · by Sami Fares',
  moves: [['Secondary', 'Waiting for client…'], ['Secondary', 'Blocked…'], ['Ghost', 'Back to Scheduled'], ['Secondary', 'Record delivered']], rule: 'Non-linear · Completed only from Delivered',
  range: 'Start 14 Oct 2026 → Target delivery 20 Nov 2026', left: '31 days to target', prog: 1 / 11, today: true,
  ms: [['Achieved', 'Wireframes approved', '17 Oct · achieved'], ['Current', 'Content received', '28 Oct · client'], ['Upcoming', 'Booking flow ready', '3 Nov'], ['Final', 'Delivery (target)', '20 Nov']],
  cols: [['To do', [{ title: 'Content upload', sub: 'Logo, price list and 12 photos from the client', short: 'Logo, prices, 12 photos', due: 'Due 28 Oct', chip: 'Client dependency' }, { title: 'Payment page', sub: 'Scope held until the payment policy is decided', short: 'Scope held for DEC-018', due: 'Due 7 Nov', notice: 'DEC-018' }]],
    ['In progress', [{ title: 'Booking flow', sub: 'Service → time slot → confirmation', short: 'Service → slot → confirm', due: 'Due 3 Nov' }]],
    ['Done', [{ title: 'Wireframes approved', sub: 'Milestone achieved', short: 'Milestone achieved', due: '17 Oct', done: true }]], ['Cancelled', []]],
  deal: 'DL-0031', facts: [['Accepted', '2 Oct · Maya Khoury'], ['Signed', '9 Oct · AGR-0109'], ['Paid', '12 Oct · PAY-0112'], ['Closed', '13 Oct · Sami Fares']], proj: 'Provisioned 13 Oct (Scheduled)',
  note: ['Amber', 'Sami Fares · open', '20 Oct, 10:12', 'Client content needed (logo, price list, 12 photos) for Content upload. Project stays In progress.'],
  act: [['Note', 'Dependency added', '20 Oct, 10:12', 'Sami Fares · task Content upload'], ['Status change', 'Project → In progress', '15 Oct, 11:00', 'From Scheduled · Sami Fares']] };
const URBAN = { who: 'SF', crumbs: ['Projects', 'Urban Cuts Barbershop', 'Online booking'], title: 'Urban Cuts Barbershop — Online booking', ro: true,
  meta: [['Success', 'Project · Completed'], ['Info', 'Deal · Closed deal']], mine: false, dev: ['LA', 'Lina Aoun'], code: 'PRJ-0012 · Salon · urbancuts.example.com',
  status: ['Success', 'Completed'], since: 'since 14 Oct 2026 · by Lina Aoun', moves: null, rule: 'Completed is final · reopening is not modelled (OQ-15)',
  range: 'Start 28 Sep 2026 → Delivered 10 Oct 2026', left: 'Completed 14 Oct', prog: 1, today: false,
  ms: [['Achieved', 'Design approved', '1 Oct · achieved'], ['Achieved', 'Booking live', '6 Oct · achieved'], ['Achieved', 'Delivered', '10 Oct · achieved'], ['Final', 'Completed', '14 Oct']],
  cols: [['To do', []], ['In progress', []], ['Done', [{ title: 'Site design', sub: 'Design approved by the client', short: 'Design approved', due: '1 Oct', done: true }, { title: 'Booking calendar', sub: 'Chair and barber availability', short: 'Chair availability', due: '6 Oct', done: true }, { title: 'Staff profiles', sub: 'Five barbers with photos', short: 'Five barbers', due: '8 Oct', done: true }]], ['Cancelled', [{ title: 'Gift cards', sub: 'Cancelled · client removed it from scope', short: 'Cancelled · out of scope', due: 'Cancelled 2 Oct' }]]],
  deal: 'DL-0024', facts: [['Accepted', '3 Sep · Omar Nassar'], ['Signed', '15 Sep · AGR-0098'], ['Paid', '20 Sep · PAY-0102'], ['Closed', '28 Sep · Lina Aoun']], proj: 'Provisioned 28 Sep (Scheduled)',
  note: ['Neutral', 'Lina Aoun', '14 Oct, 16:20', 'Client confirmed the booking site is live. Project completed.'],
  act: [['Status change', 'Project → Completed', '14 Oct, 16:20', 'From Delivered · Lina Aoun'], ['Status change', 'Project → Delivered', '10 Oct, 12:00', 'From In progress · Lina Aoun']] };
async function sectionHead(t, l) { const h = AL('Header · ' + t, 'HORIZONTAL', { gap: 8, align: 'CENTER' }); h.appendChild(await T(t, 'ds/H4', 'text/primary')); spacer(h); if (l) h.appendChild(await link(l)); return h; }
async function board(name, D, ban, stale) {
  const { f, c } = await desk(S, name, D.who, 'Projects', 'Search projects, tasks…');
  const hdr = AL('R1 Page header', 'VERTICAL', { gap: 6 }); put(c, hdr, 'FILL');
  const bc = await inst('Breadcrumb', null, 'Breadcrumb'); setP(bc, { 'Level 1': D.crumbs[0], 'Level 2': D.crumbs[1], Current: D.crumbs[2], 'Show level 2': true }); hdr.appendChild(bc);
  const tr = AL('Title row', 'HORIZONTAL', { gap: 12, align: 'CENTER' }); put(hdr, tr, 'FILL');
  tr.appendChild(await T(D.title, 'ds/H1', 'text/primary', { name: 'Title' })); spacer(tr);
  tr.appendChild(await button('Secondary', 'Medium', 'Edit schedule', 'calendar', D.ro ? 'Disabled' : null)); tr.appendChild(await button('Primary', 'Medium', 'Add task', 'plus', D.ro ? 'Disabled' : null)); tr.appendChild(await iconBtn('more', 'More actions'));
  const meta = AL('Meta row', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(hdr, meta, 'FILL');
  for (const [t, l] of D.meta) meta.appendChild(await badge(t, l));
  if (D.mine) meta.appendChild(await chip('Neutral', 'Assigned to me'));
  meta.appendChild(await avatar(D.dev[0])); meta.appendChild(await T(D.dev[1] + ' · assigned developer', 'ds/Body Small', 'text/secondary')); meta.appendChild(await T(D.code, 'ds/Body Small', 'text/muted'));
  if (ban) put(c, await banner(ban[0], ban[1], ban[2], ban[3]), 'FILL');
  const split = AL('Main split', 'HORIZONTAL', { gap: 16 }); put(c, split, 'FILL', 'FILL');
  const left = AL('Left column', 'VERTICAL', { gap: 8 }); put(split, left, 'FILL', 'FILL');
  // R2 project status bar — distinct from task status
  const sb = AL('R2 Project status bar', 'VERTICAL', { gap: 10, pad: [12, 16], fill: 'surface/default', stroke: 'border/default', radius: 'lg' }); put(left, sb, 'FILL');
  const s1 = AL('Current status', 'HORIZONTAL', { gap: 12, align: 'CENTER' }); put(sb, s1, 'FILL');
  s1.appendChild(await T('PROJECT STATUS', 'ds/Overline', 'text/muted')); s1.appendChild(await badge(D.status[0], D.status[1], 'Large')); if (stale) s1.appendChild(await chip('Amber', 'Out of date · reload')); else s1.appendChild(await T(D.since, 'ds/Caption', 'text/muted')); spacer(s1); // D-5: stale → chip replaces the since caption (was DEC-019 chip +125w)
  s1.appendChild(await nchip('DEC-019', 'Policy pending · statuses proposed'));
  const s2 = AL('Allowed next statuses', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(sb, s2, 'FILL');
  if (D.moves) { s2.appendChild(await T('Move project to:', 'ds/Label Small', 'text/secondary')); for (const [v, l] of D.moves) s2.appendChild(await button(v, 'Small', l, null, stale ? 'Disabled' : null)); }
  else s2.appendChild(await badge('Neutral', 'Read-only', 'Small', false));
  const rc = await T(stale ? 'Status actions are paused until you reload the project.' : D.rule, 'ds/Caption', 'text/muted', { name: 'Rule caption', w: 160 }); s2.appendChild(rc); rc.layoutSizingHorizontal = 'FILL';
  // R3 schedule & milestones
  const sched = await card('Surface', 'R3 Schedule & milestones'); put(left, sched, 'FILL');
  { const sl = fillSlot(sched, [], 'Content');
    const h = AL('Schedule header', 'HORIZONTAL', { gap: 12, align: 'CENTER' }); h.appendChild(await T('Schedule & milestones', 'ds/H4', 'text/primary')); h.appendChild(await T(D.range, 'ds/Body Small', 'text/secondary')); spacer(h); h.appendChild(await chip('Neutral', D.left)); put(sl, h, 'FILL');
    const W = 756, step = (W - 132) / 3, tx = Math.round(66 + (W - 132) * D.prog);
    const trk = figma.createFrame(); trk.name = 'Milestone track'; trk.fills = []; trk.resize(W, 92); trk.clipsContent = false; sl.appendChild(trk);
    const a = figma.createRectangle(); a.name = 'Track'; trk.appendChild(a); a.resize(W - 132, 4); a.x = 66; a.y = 34; a.fills = [P('surface/sunken')]; rad(a, 'full');
    const b = figma.createRectangle(); b.name = 'Progress'; trk.appendChild(b); b.resize(Math.max(1, tx - 66), 4); b.x = 66; b.y = 34; b.fills = [P('brand/accent')]; rad(b, 'full');
    for (let i = 0; i < 4; i++) { const m = await inst('Milestone', { State: D.ms[i][0] }, 'Milestone · ' + D.ms[i][1]); setP(m, { Label: D.ms[i][1], Date: D.ms[i][2] }); trk.appendChild(m); m.x = Math.round(i * step); m.y = 26; }
    if (D.today) { const l = figma.createRectangle(); l.name = 'Today line'; trk.appendChild(l); l.resize(2, 42); l.x = tx - 1; l.y = 6; l.fills = [P('status/warning/solid')];
      const pill = AL('Today', 'HORIZONTAL', { pad: [2, 6], radius: 'sm', fill: 'status/warning/bg' }); pill.appendChild(await T('Today · 20 Oct', 'ds/Caption', 'status/warning/fg')); trk.appendChild(pill); pill.x = tx + 4; pill.y = 0; } }
  const th = AL('Tasks header', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(left, th, 'FILL');
  th.appendChild(await T('Tasks', 'ds/H4', 'text/primary'));
  { const n = D.cols.reduce((s, x) => s + x[1].length, 0); const k = await inst('Count', { Tone: 'Neutral' }, 'Badge/Count · tasks'); setP(k, { Count: String(n) }); th.appendChild(k); }
  { const t = await T('Columns are task statuses (proposed, no DEC ID). Moving a task never changes the project status.', 'ds/Caption', 'text/muted', { w: 500 }); th.appendChild(t); t.layoutGrow = 1; }
  // R4 kanban
  const kan = AL('R4 Task kanban', 'HORIZONTAL', { gap: 8 }); put(left, kan, 'FILL', 'FILL');
  const COLS = [];
  for (const [title, cards] of D.cols) {
    const col = await inst('Column', null, 'Kanban/Column · ' + title); put(kan, col, 'FILL', 'FILL');
    setP(col, { Title: title, 'Show add': false }); const cnt = nested(col, 'Count'); if (cnt) setP(cnt, { Count: String(cards.length) });
    const sp = col.findOne(n => n.name === 'Spacer' && n.parent && n.parent.name === 'Header'); if (sp) { try { sp.visible = false; } catch (e) { } }
    const sl = slotOf(col, 'Cards'); clearSlot(sl); COLS.push({ title, col, sl, cards: [] });
    for (const d of cards) {
      const t = await inst('Task', { State: d.done ? 'Done' : 'Default' }, 'Card/Task · ' + d.title); put(sl, t, 'FILL'); try { t.layoutSizingVertical = 'HUG'; } catch (e) { }
      setP(t, { Title: d.title, Due: d.due, 'Show chip': !!d.chip, 'Show notice': !!d.notice });
      const pj = t.findOne(n => n.type === 'TEXT' && n.componentPropertyReferences && /^Project/.test(n.componentPropertyReferences.characters || ''));
      let two = false; if (pj) { try { pj.textTruncation = 'ENDING'; pj.maxLines = 2; two = pj.maxLines === 2; } catch (e) { } }
      setP(t, { Project: two ? d.sub : d.short }); setP(nested(t, 'Avatar'), { Initials: D.dev[0] });
      const ch = nested(t, 'Derived chip'); if (ch) setP(ch, { Label: d.chip || 'Client dependency' });
      const nt = nested(t, 'Policy'); if (nt) { setP(nt, { DEC: d.notice || 'DEC-018' }); layerText(nt, 'Title', 'pending', true); }
      if (d.done) { const bd = t.findAll(n => n.type === 'INSTANCE' && n.name !== 'Avatar' && n.name !== 'Derived chip' && n.name !== 'Policy').find(n => 'Label' in (n.componentProperties || {}) || Object.keys(n.componentProperties || {}).some(k => k.startsWith('Label'))); if (bd) setP(bd, { Label: 'Done' }); }
      COLS[COLS.length - 1].cards.push(t);
    }
    if (!cards.length) { const e = AL('Empty · ' + title, 'VERTICAL', { gap: 4, pad: [8, 4] }); put(sl, e, 'FILL'); await TF(e, 'No tasks', 'ds/Label Small', 'text/secondary'); if (title === 'Cancelled') await TF(e, 'Cancelling needs a reason (Proposed).', 'ds/Caption', 'text/muted'); }
  }
  // R5 right rail
  const rail = await card('Surface', 'R5 Right rail'); split.appendChild(rail); rail.resize(336, rail.height); rail.layoutSizingHorizontal = 'FIXED'; rail.layoutSizingVertical = 'FILL'; rail.clipsContent = true;
  { const sl = fillSlot(rail, [], 'Content', 8);
    const dl = AL('Deal context', 'VERTICAL', { gap: 6 }); put(sl, dl, 'FILL');
    put(dl, await sectionHead('Deal context', 'Open deal ' + D.deal), 'FILL'); await TF(dl, 'Closed ≠ Completed: delivery continues here.', 'ds/Caption', 'text/muted');
    for (const [k, v] of D.facts) put(dl, await kv('Check', k, v), 'FILL');
    put(dl, await ninline('DEC-006 / R-12', 'Closure authority pending: Developer vs Owner verification not decided.'), 'FILL');
    put(dl, await kv('Default', 'Project', D.proj), 'FILL');
    put(dl, await row('Correction entry', [await T('Business details wrong?', 'ds/Caption', 'text/muted'), await link('Request correction')], 8), 'FILL'); // M-1 → SCR-SHR-009
    put(sl, await divider(), 'FILL');
    const nb = AL('Notes', 'VERTICAL', { gap: 8 }); put(sl, nb, 'FILL');
    put(nb, await sectionHead(D.ro ? 'Notes' : 'Client dependencies & notes', D.ro ? null : 'Add note'), 'FILL'); put(nb, await note(...D.note), 'FILL');
    put(sl, await divider(), 'FILL');
    const ac = AL('Activity', 'VERTICAL', { gap: 8 }); put(sl, ac, 'FILL'); put(ac, await sectionHead('Activity', 'View all'), 'FILL');
    for (const a of D.act) put(ac, await tl(a[0], a[1], a[2], a[3]), 'FILL');
    const lim = rail.absoluteBoundingBox.y + rail.height - 16; const its = () => ac.children.filter(n => n.type === 'INSTANCE');
    while (its().length > 1 && its()[its().length - 1].absoluteBoundingBox.y + its()[its().length - 1].height > lim) its()[its().length - 1].remove();
    const l = its(); if (l.length) setP(l[l.length - 1], { 'Show connector': false });
    // P6 review fix: if even one activity item would be clipped by the rail, hide the Activity block and its divider
    if (l.length && l[l.length - 1].absoluteBoundingBox.y + l[l.length - 1].height > lim) { ac.visible = false; const dv = sl.children[sl.children.indexOf(ac) - 1]; if (dv) dv.visible = false; OUT.fit[name + ' · rail activity hidden (no room)'] = true; }
    OUT.fit[name + ' · rail activity shown'] = l.length; }
  // kanban fit: never cut a card at the column bottom; overflow → "+n more"
  for (const k of COLS) {
    const cb = k.col.absoluteBoundingBox, lim = cb.y + cb.height - 8, hid = [];
    while (k.cards.length > 1) { const last = k.cards[k.cards.length - 1], b = last.absoluteBoundingBox; if (b.y + b.height <= lim) break; hid.unshift(k.cards.pop()); }
    if (hid.length) { const names = hid.map(x => x.name.slice(12)).join(', '); for (const x of hid) x.remove(); const m = AL('More cards', 'VERTICAL', { gap: 6, pad: [4, 4] }); put(k.sl, m, 'FILL'); const ml = await link('+' + hid.length + ' more'); ml.name = 'Link · +' + hid.length + ' more · ' + names; m.appendChild(ml); OUT.fit[name + ' · ' + k.title + ' hidden cards'] = names; } // D-5: label only (names were +71w)
    OUT.fit[name + ' · column ' + k.title] = 'h ' + Math.round(cb.height) + ', hidden ' + hid.length;
  }
  fit(f); return f;
}
const L = await board(N + 'Desktop — Light', GLOW);
dark(S, L, N + 'Desktop — Dark');
// P7 "Record delivered" warning + Waiting for client… / Blocked… dialogs: C06b (clones the Light board)
await board(N + 'Desktop — Light — Completed (read-only)', URBAN, ['Info', 'This project is completed and read-only', 'Tasks, schedule and status can no longer change. Reopening a completed project is an open question (OQ-15).', null]);
await board(N + 'Desktop — Light — Save conflict', GLOW, ['Warning', 'Project status changed by someone else', 'Rana Haddad set the project to Waiting for client at 10:05. Your change to Blocked was not saved. Nothing was overwritten.', 'Reload project'], true);
{ // Hidden by policy
  const { f, c } = await desk(S, N + 'Desktop — Light — Hidden by policy', 'SF', 'Projects', 'Search projects, tasks…');
  const bc = await inst('Breadcrumb', null, 'Breadcrumb'); setP(bc, { 'Level 1': 'Projects', 'Level 2': 'Projects', Current: 'Project not available', 'Show level 2': false }); put(c, bc);
  const a = AL('State area', 'VERTICAL', { gap: 16, align: 'CENTER', justify: 'CENTER', fill: 'surface/default', stroke: 'border/default', radius: 'lg' }); put(c, a, 'FILL', 'FILL');
  const aw = AL('Access wrap', 'VERTICAL'); a.appendChild(aw); aw.resize(480, 10); aw.layoutSizingHorizontal = 'FIXED'; aw.layoutSizingVertical = 'HUG'; put(aw, await access('Hidden by policy', 'Page', 'This project is not visible to you', 'It may exist, but the visibility policy hides it from your role (for example after the 15-day window). No details are shown.', 'Back to projects'), 'FILL');
  a.appendChild(await nchip('DEC-002', '15-day visibility · active / completed project'));
  fit(f);
}
{ // Mobile (P1) — column list (flow M5): status card, then tasks grouped by task status
  const { f, c } = await mob(S, N + 'Mobile — Light', { title: 'Booking website', sub: 'Glow Beauty Salon · PRJ-0014', back: true, tab: 2, ini: 'SF' });
  const sc = await card('Surface', 'Project status card'); put(c, sc, 'FILL');
  const sl = fillSlot(sc, [], 'Content', 10);
  put(sl, await row('Status row', [await T('PROJECT STATUS', 'ds/Overline', 'text/muted'), await badge('Brand', 'In progress', 'Large')], 8), 'FILL');
  await TF(sl, 'since 15 Oct · Sami Fares · target 20 Nov', 'ds/Caption', 'text/muted');
  const br = AL('Actions', 'HORIZONTAL', { gap: 8 }); put(sl, br, 'FILL'); put(br, await button('Secondary', 'Large', 'Change status'), 'FILL'); put(br, await button('Primary', 'Large', 'Add task', 'plus'), 'FILL');
  put(sl, await nchip('DEC-019', 'statuses proposed'), null);
  const lr = AL('Deal links', 'VERTICAL', { gap: 4 }); put(sl, lr, 'FILL'); put(lr, await button('Ghost', 'Large', 'Open deal DL-0031'), 'FILL'); put(lr, await button('Ghost', 'Large', 'Request correction', 'flag'), 'FILL');
  for (const [g, cards] of GLOW.cols) {
    put(c, await T(g.toUpperCase() + ' · ' + cards.length, 'ds/Overline', 'text/muted'), 'FILL');
    for (const d of cards) { const t = await inst('Task', { State: d.done ? 'Done' : 'Default' }, 'Card/Task · ' + d.title); put(c, t, 'FILL'); setP(t, { Title: d.title, Due: d.due, Project: d.short, 'Show chip': !!d.chip, 'Show notice': !!d.notice }); setP(nested(t, 'Avatar'), { Initials: 'SF' }); const ch = nested(t, 'Derived chip'); if (ch) setP(ch, { Label: 'Client dependency' }); const nt = nested(t, 'Policy'); if (nt) { setP(nt, { DEC: 'DEC-018' }); layerText(nt, 'Title', 'pending', true); } }
  }
  fit(f, { mobile: true, scroll: true });
}
await endSection(S, [
  ['Interaction', 'I1 — Project status', 'Allowed next from In progress: Waiting for client… (note required), Blocked… (reason required), Back to Scheduled, Record delivered. Completed only from Delivered. Non-linear: no status forces Waiting/Blocked. Invalid transitions are not offered. Completed = read-only.'],
  ['Interaction', 'I2 — Record delivered (P7)', 'If any task is not Done/Cancelled → warning dialog lists open tasks. "Record delivered" sets project status only; tasks unchanged. "Review open tasks" closes the dialog and filters the board; Cancel/close changes nothing. No open tasks → no dialog.'],
  ['Interaction', 'I3 — Tasks', 'Click a card → task drawer (SCR-DEV-007). Drag between columns changes task status only. Cancel needs a reason; Done → In progress = reopen (not when project Completed). "+n more" expands a column.'],
  ['Note', 'N1 — Client dependency ≠ status', '"Waiting for client" is only a project status. The amber "Client dependency" chip on a task is derived from an open client note; the task keeps its own status.'],
  ['Implementation', 'N2 — States', 'Save conflict: banner, nothing overwritten, Reload project. Hidden by policy: generic, no data (DEC-002). Mobile: status card + task list grouped by task status; cards and 48 px buttons are the tap targets.']
]);
return OUT;
