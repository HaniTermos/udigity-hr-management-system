// C08-dev008-closure-dialog.js — Developer Screen Agent — Phase 6 Batch C — page 44 HiFi — Developer (96:6)
// SCR-DEV-008 Finalize closure & provision project (dialog). Frames: Confirm (DEC-006 Alt A — not selected) Light, Dark,
// Request verification (Alt B — not selected), Not allowed (missing facts; R-12 role reading), Closed but provisioning
// failed (F3), Success (F2 Automatic vs Manual side by side). Desktop only.
// Run AFTER C02: backgrounds clone SCR-DEV-002 frames (fallback: plain shell). Closure stays committed when provisioning fails.
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
function fillSlot(i, nodes, name, gap) { const s = slotOf(i, name || 'Content'); if (!s) { warn('no slot in ' + i.name); return null; } clearSlot(s); if (gap != null) num(s, 'itemSpacing', gap); for (const n of nodes) if (n) put(s, n, hugK(n)); return s; }
// M-6: badges, chips and policy chips HUG inside slots; everything else FILL
function hugK(n) { return n.type === 'INSTANCE' && (/^(Badge|Badge\/Flag|Chip\/Derived) · /.test(n.name) || (n.name.startsWith('Policy · ') && n.variantProperties && n.variantProperties.Size === 'Chip')) ? 'HUG' : 'FILL'; }
// ---- DS builders (every visible text set explicitly)
async function badge(tone, label, size, dot) { const b = await inst('Badge', { Tone: tone, Size: size || 'Small' }, 'Badge · ' + label); setP(b, { Label: label, 'Show dot': dot !== false }); return b; }
async function chip(tone, label) { const c = await inst('Chip', { Tone: tone }, 'Chip/Derived · ' + label); setP(c, { Label: label }); return c; }
async function nchip(dec, title) { const n = await inst('Notice', { Size: 'Chip', Tone: 'Policy pending' }, 'Policy · ' + dec); setP(n, { DEC: dec }); layerText(n, 'Title', title || 'pending', true); return n; }
async function ninline(dec, body) { const n = await inst('Notice', { Size: 'Inline', Tone: 'Policy pending' }, 'Policy · ' + dec); setP(n, { DEC: dec, Body: body }); layerText(n, 'Title', 'Policy pending', true); return n; }
async function button(variant, size, label, icon, state) { const b = await inst('Button', { Variant: variant, Size: size, State: state || 'Default' }, 'Button · ' + label); setP(b, { Label: label, 'Show icon': !!icon }); if (icon) setP(b, { Icon: IC[icon] }); return b; }
async function link(label, size) { const l = await inst('Link', { Size: size || 'Small', State: 'Default' }, 'Link · ' + label); setP(l, { Label: label, 'Show icon': false }); return l; }
async function kv(type, key, value) { const k = await inst('KV', { Type: type }, 'KV · ' + key); setP(k, { Key: key, Value: value }); return k; }
async function banner(tone, title, body, action, size) {
  const b = await inst('Banner', { Tone: tone, Size: size || 'Default' }, 'Banner · ' + (title || body).slice(0, 30));
  setP(b, { Title: title || ' ', Body: body, 'Show title': !!title, 'Show close': false }); if ((size || 'Default') === 'Default') setP(b, { 'Show action': !!action });
  if (action) setP(nested(b, 'Action'), { Label: action, 'Show icon': false }); return b;
}
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

const S = await startSection('SCR-DEV-008 — Finalize closure & provision project (dialog)', 'UC-DEAL-003, UC-PROJ-002 · WF-DEAL-002 · SM-COMMERCIAL-001. Close a Signed-and-paid deal (accepted + signed + paid), then create or link the project (F2 pending). Closed deal ≠ completed project. Desktop 1440×900.');
const N = 'SCR-DEV-008 — Finalize closure — Desktop — ';
const find = (nm) => page.findOne(n => n.type === 'FRAME' && n.name === nm);
const CED = find('SCR-DEV-002 — Deal record detail — Desktop — Light'), PEAK = find('SCR-DEV-002 — Deal record detail — Desktop — Light — Accepted opportunity (DEC-005 Alt 1, not selected)');
if (!CED || !PEAK) warn('SCR-DEV-002 frames not found — run C02 first; plain shell used as background');
async function base(name, bg) { if (bg) return cloneF(S, bg, name); const { f } = await desk(S, name, 'LA', 'Deals'); return f; }
const DESC = 'Cedar Home Realty — Listings website · DL-0033';
// minor 17: after closure the page behind the dialog shows the Closed deal stage
// N44-4: a closed deal offers no closure or not-proceeding actions (SM-COMMERCIAL-001; "Mark not proceeding…" exists only on non-closed stages)
// [D-8] N44-4: find the CLOSURE fact card as C02 factCard() builds it: 'Section · Commercial facts' › frame 'Facts' › 4× 'Inset · content'
// (Inset instance, Content slot: Overline TEXT 'CLOSURE' + 'Badge · Not recorded' + 'Not closed yet' + 'Needs all three facts').
// 1) by label text (case/space-insensitive, characters or layer name) → nearest Inset ancestor; 2) by 'Not closed yet' / 'Needs all three facts';
// 3) by component name: last Inset in 'Facts' (main component 'Inset' or layer 'Inset · …'). Diagnostics go to OUT.closureLookup.
function _txt(n) { try { return String(n.characters || '').replace(/\s+/g, ' ').trim(); } catch (e) { return ''; } }
function _insetUp(n, root) { let c = n; while (c && c !== root) { if (c.type === 'INSTANCE' && /^Inset( · |$)/.test(c.name)) return c; c = c.parent; } return n && n.parent && n.parent !== root ? n.parent : null; }
async function _isInset(n) { if (n.type !== 'INSTANCE') return false; if (/^Inset( · |$)/.test(n.name)) return true; try { const m = await n.getMainComponentAsync(); const nm = m ? ((m.parent && m.parent.type === 'COMPONENT_SET') ? m.parent.name : m.name) : ''; return /(^|\/)\s*Inset\b/i.test(nm) || (m && m.id === ID.Inset); } catch (e) { return false; } }
async function closureFact(f) {
  OUT.closureLookup = OUT.closureLookup || {}; const dg = OUT.closureLookup[f.name] = { by: null };
  const texts = f.findAll(n => n.type === 'TEXT');
  const lab = texts.find(t => _txt(t).toUpperCase() === 'CLOSURE') || texts.find(t => String(t.name).trim().toUpperCase() === 'CLOSURE');
  let c = lab && _insetUp(lab, f); if (c) { dg.by = 'label'; return c; }
  const st = texts.find(t => _txt(t) === 'Not closed yet' || _txt(t) === 'Needs all three facts'); c = st && _insetUp(st, f); if (c) { dg.by = 'status text'; return c; }
  const facts = f.findOne(n => n.name === 'Facts' && 'children' in n) || (f.findOne(n => n.type === 'INSTANCE' && n.name === 'Section · Commercial facts') || {}).findOne?.(n => n.name === 'Facts');
  if (facts) { const ins = []; for (const ch of facts.findAll(n => n.type === 'INSTANCE')) if (ch.parent === facts && await _isInset(ch)) ins.push(ch);
    if (!ins.length) for (const ch of facts.children) if (await _isInset(ch)) ins.push(ch);
    dg.facts = ins.length; if (ins.length) { const hit = ins.find(i => i.findAll(n => n.type === 'TEXT').some(t => /clos/i.test(_txt(t)))) || ins[ins.length - 1]; dg.by = 'component'; return hit; } }
  dg.facts = facts ? 0 : 'no Facts row'; dg.clos = texts.map(_txt).filter(x => /clos/i.test(x)).slice(0, 8); return null;
}
async function closedBg(f) {
  const b = f.findOne(n => n.type === 'INSTANCE' && n.name === 'Badge · Signed and paid · awaiting closure'); if (!b) warn(f.name + ': stage badge not found'); else { setP(b, { Tone: 'Info', Label: 'Closed deal' }); b.name = 'Badge · Closed deal'; }
  const np = f.findOne(n => n.type === 'INSTANCE' && n.name === 'Button · Mark not proceeding…'); if (np) np.visible = false; else warn(f.name + ': Mark not proceeding button not found');
  const cf = await closureFact(f);
  if (cf) { const fb = cf.findOne(n => n.type === 'INSTANCE' && /^Badge · /.test(n.name)); if (fb) { setP(fb, { Tone: 'Success', Label: 'Recorded', 'Show dot': true }); fb.name = 'Badge · Recorded'; }
    else warn(f.name + ': closure fact card found (' + OUT.closureLookup[f.name].by + ') but it has no Badge');
    for (const t of cf.findAll(n => n.type === 'TEXT')) { const x = _txt(t); if (x === 'Not closed yet') t.characters = '20 Oct 2026'; else if (x === 'Needs all three facts') t.characters = '09:42 · Lina Aoun'; } } else warn(f.name + ': CLOSURE FACT CARD NOT FOUND (label text, status text and Inset component lookups all failed) — Closure fact NOT set to Recorded; N44-4 only partly met. Seen: ' + JSON.stringify(OUT.closureLookup[f.name] || {}).slice(0, 300));
  const cs = f.findOne(n => n.type === 'INSTANCE' && n.name === 'Section · Closure'); if (cs) setP(cs, { Subtitle: 'Closed 20 Oct 2026, 09:42 by Lina Aoun', 'Show subtitle': true });
  const opts = f.findOne(n => n.name === 'Closure options'); if (!opts) { warn(f.name + ': closure options row not found'); return; }
  const sl = opts.parent; opts.visible = false; for (const n of sl.children) if (n.type === 'INSTANCE' && n.name === 'Policy · DEC-006 / R-12') n.visible = false;
  await TF(sl, 'Closed deal. Delivery continues on the project board — closed deal ≠ completed project.', 'ds/Body Small', 'text/secondary');
  sl.appendChild(await button('Secondary', 'Medium', 'Open project board (pending)', null, 'Disabled'));
  await TF(sl, 'Available once the project board exists (F2 pending).', 'ds/Caption', 'text/muted');
}
const facts = async (pay) => [await kv('Check', 'Accepted', '14 Sep 2026 · Omar Nassar'), await kv(pay === false ? 'Not recorded' : 'Check', 'Signed', pay === false ? 'Not recorded' : '7 Oct 2026 · AGR-0133'), await kv(pay === false ? 'Not recorded' : 'Check', 'Paid', pay === false ? 'Not recorded' : '15 Oct 2026 · PAY-0151')];
async function sideCard(title, lines, btn) { const c = await card('Inset'); const sl = fillSlot(c, [await T(title, 'ds/Label', 'text/primary')], 'Content', 6); for (const l of lines) await TF(sl, l, 'ds/Caption', 'text/secondary'); if (btn) sl.appendChild(btn); return c; }
// 1 Confirm (Alt A)
const L = await base(N + 'Light — Confirm (DEC-006 Alt A, not selected)', CED);
await dialog(L, 'Finalize closure', DESC, [
  ...await facts(),
  await T('Closing records you (Lina Aoun) and the time. Closed deal ≠ completed project — delivery continues on the project board.', 'ds/Body Small', 'text/secondary', { w: 472 }),
  await ninline('DEC-006 / R-12', 'This dialog exists only if DEC-006 Alt A (Developer finalizes) is adopted. Not selected.'),
  await ninline('F2', 'After closure the project is created automatically or by hand — not decided.'),
  await row('Other policies', [await nchip('DEC-017', 'one project per deal?'), await nchip('DEC-018', 'no evidence required yet')], 8, true)
], 'Cancel', 'Finalize closure');
fit(L);
dark(S, L, N + 'Dark — Confirm');
// 2 Request verification (Alt B)
{ const f = await base(N + 'Light — Request verification (DEC-006 Alt B, not selected)', CED);
  await dialog(f, 'Request closure verification', DESC, [
    ...await facts(),
    await field('Textarea', { State: 'Filled' }, 'Note to the Owner (optional)', 'Agreement and payment confirmed with the client.', { counter: '48 / 500' }),
    await T('The Owner gets a review item. The deal stays Signed and paid until the Owner verifies (then it closes) or rejects with a reason.', 'ds/Body Small', 'text/secondary', { w: 472 }),
    await ninline('DEC-006 Alt B', 'Owner verification is one of two options — not selected. R-12 → user decision.')
  ], 'Cancel', 'Send for verification');
  fit(f); }
// 3 Not allowed — missing facts (+ R-12 role reading)
{ const f = await base(N + 'Light — Not allowed (missing facts)', PEAK);
  await dialog(f, 'Closure not available yet', 'Peak Fitness Gym — Member app · DL-0040', [
    await banner('Error', null, 'Finalize needs accepted + signed + paid. Missing: signature and payment.', null, 'Inline'),
    await kv('Check', 'Accepted', '14 Oct 2026 · Maya Khoury'), await kv('Not recorded', 'Signed', 'Not recorded'), await kv('Not recorded', 'Paid', 'Not recorded'),
    await ninline('R-12', 'Role reading: under DEC-005 Alt 2 × DEC-006 a Developer could not record facts or close before closure — user decision, not settled.')
  ], 'Back to deal', null);
  fit(f); }
// 4 F3 — closed, provisioning failed
{ const f = await base(N + 'Light — Closed, provisioning failed (F3)', CED); await closedBg(f);
  await dialog(f, 'Deal closed — project not created', DESC, [
    await banner('Success', null, 'Closure saved 20 Oct 2026, 09:42 by Lina Aoun. Stage: Closed deal.', null, 'Inline'),
    await banner('Error', null, 'The project board could not be created. The closure stays saved — it is not undone.', null, 'Inline'),
    await row('Condition', [await chip('Amber', 'Project provisioning pending'), await nchip('F3', 'Proposed')], 8),
    await T('The Owner sees this on the Delivery monitor (SCR-OWN-012) and can retry. Nothing else is required from you.', 'ds/Body Small', 'text/secondary', { w: 472 })
  ], null, 'Back to deal');
  fit(f); }
// 5 Success — F2 Automatic vs Manual
{ const f = await base(N + 'Light — Success (F2 Automatic vs Manual)', CED); await closedBg(f);
  const pair = AL('F2 alternatives', 'HORIZONTAL', { gap: 12 });
  const a = await sideCard('If F2 Automatic', ['Project provisioning pending (derived, queued).', 'The board appears in Projects when created (Scheduled).']);
  const b = await sideCard('If F2 Manual', ['Closed deal without project (derived) until someone creates it.'], await button('Secondary', 'Small', 'Create project board'));
  put(pair, a, 'FILL'); put(pair, b, 'FILL');
  await dialog(f, 'Deal closed', DESC, [
    await banner('Success', null, 'Closed 20 Oct 2026, 09:42 by Lina Aoun. Accepted, signed and paid are all recorded.', null, 'Inline'),
    pair, await ninline('F2', 'Provisioning trigger pending — both alternatives shown; neither is selected.')
  ], 'Close', 'Open project board (pending)', { disabled: true });
  fit(f); }
await endSection(S, [
  ['Interaction', 'I1 — Confirm', 'Opened from "Finalize closure…" on SCR-DEV-002 (Alt A). Guard: accepted + signed + paid. Confirm → stage Closed deal, closer + time recorded, then provisioning per F2. Cancel / close → nothing changes.'],
  ['Interaction', 'I2 — Alt B request', '"Send for verification" raises an Owner review item; the deal stays Signed and paid. Owner verifies (closes) or rejects with a reason (SCR-DEV-002 rejected banner).'],
  ['Note', 'N1 — Not allowed', 'Missing fact → blocked with the missing facts named; only "Back to deal". Role not permitted (Data Entry always; R-12 reading) → Permission denied pattern; nothing saved.'],
  ['Note', 'N2 — F3', 'Provisioning failure never rolls back closure. "Project provisioning pending" is derived and visible to the Owner with retry (Proposed). Closed deal ≠ completed project (G1).'],
  ['Note', 'N3 — Closed background (N44-4)', 'Behind F3 and Success the deal page shows the closed state: stage Closed deal, Closure fact recorded, no "Finalize closure…" / "Request closure verification" and no "Mark not proceeding…" (non-closed stages only). "Open project board" stays disabled until the board exists (F2).']
]);
return OUT;
