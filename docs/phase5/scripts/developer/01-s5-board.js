// 01-s5-board.js — Developer Screen Agent — Phase 5 (Udigity Management System)
// S5 Developer Board on page 30 HiFi — Visual Sample (36:4). Spec: docs/phase5/screens/developer-sample-spec.md
// Frame A: board (1440x900, Light). Frame B: same board with the task drawer open on "Content upload".
// Instances of DS components only (IDs from docs/phase5/ds-ids/index.md). Every visible text is set explicitly
// (DS defect: text-property defaults show placeholder text).
// Idempotent: if section "S5 Developer Board" exists, its children are removed and rebuilt (section ID kept).
// Rulings kept: "Waiting for client" is a PROJECT status (SM-PROJECT-001). On a task it is a derived
// client-dependency chip, never a task status/column. Kanban columns = task statuses (SM-TASK-001, proposed, no DEC ID).
const PAGE_ID = '36:4';
const SECTION_NAME = 'S5 Developer Board';
const SEC_X = 0, SEC_Y = 4800;
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));

const OUT = { created: {}, updated: {}, warnings: [] };
const SEM = 'VariableCollectionId:40:3', PRIM = 'VariableCollectionId:40:2';
const V = {};
for (const v of await figma.variables.getLocalVariablesAsync()) {
  if (v.variableCollectionId === SEM) V[v.name] = v;
  else if (v.variableCollectionId === PRIM) V['p/' + v.name] = v;
}
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const GS = {}; for (const s of await figma.getLocalGridStylesAsync()) GS[s.name] = s;

const ID = {
  Shell: '49:1926', Breadcrumb: '49:1006', Badge: '44:435', Chip: '44:509', Notice: '44:549', Button: '45:305',
  IconButton: '45:405', Link: '45:441', Avatar: '44:358', Count: '44:471', Divider: '44:364', Surface: '51:1772',
  KV: '51:1888', Task: '54:2196', Column: '54:2200', TLItem: '54:2309', Milestone: '54:2333', Note: '54:2384',
  Scrim: '53:1814', Drawer: '53:1846', Select: '46:434', Date: '46:594', Textarea: '45:847', Annotation: '44:395'
};
const ICON = { plus: '44:58', more: '44:183', calendar: '44:18', board: '44:113' };

// ---------- helpers ----------
function rec(name, n) { OUT.created[name] = n.id; return n; }
function warn(m) { OUT.warnings.push(m); }
function vv(n) { const v = V[n]; if (!v) throw new Error('Missing variable ' + n); return v; }
function P(n) { return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', vv(n)); }
function num(n, field, val) { const v = V['p/space/' + val]; if (v) n.setBoundVariable(field, v); else n[field] = val; }
function rad(n, key) { const v = V['p/radius/' + key]; for (const c of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) { if (v) n.setBoundVariable(c, v); else n[c] = 8; } }
function AL(name, dir, o) {
  o = o || {};
  const f = figma.createAutoLayout(dir || 'HORIZONTAL'); f.name = name; f.fills = [];
  if (o.gap != null) num(f, 'itemSpacing', o.gap);
  if (o.pad != null) { const a = [].concat(o.pad); const t = a[0], r = a[1] != null ? a[1] : t, b = a[2] != null ? a[2] : t, l = a[3] != null ? a[3] : r; num(f, 'paddingTop', t); num(f, 'paddingRight', r); num(f, 'paddingBottom', b); num(f, 'paddingLeft', l); }
  if (o.fill) f.fills = [P(o.fill)];
  if (o.stroke) { f.strokes = [P(o.stroke)]; f.strokeWeight = 1; f.strokeAlign = 'INSIDE'; }
  if (o.radius) rad(f, o.radius);
  if (o.align) f.counterAxisAlignItems = o.align;
  if (o.wrap) { f.layoutWrap = 'WRAP'; num(f, 'counterAxisSpacing', o.gap != null ? o.gap : 8); }
  return f;
}
// append and size: w/h = 'FILL' | 'HUG' | undefined
function put(parent, child, w, h) { parent.appendChild(child); if (w) child.layoutSizingHorizontal = w; if (h) child.layoutSizingVertical = h; return child; }
function spacer(parent) { const s = figma.createFrame(); s.name = 'Spacer'; s.fills = []; s.resize(1, 1); parent.appendChild(s); s.layoutGrow = 1; return s; }
async function T(chars, style, color, o) {
  o = o || {};
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Regular' };
  t.characters = String(chars);
  const st = TS[style]; if (!st) throw new Error('Missing text style ' + style);
  await t.setTextStyleIdAsync(st.id);
  t.fills = [P(color || 'text/primary')];
  t.name = o.name || String(chars).slice(0, 40);
  if (o.w) { t.textAutoResize = 'HEIGHT'; t.resize(o.w, Math.max(1, t.height)); }
  return t;
}
const _n = {};
async function comp(key) { const id = ID[key]; if (!_n[id]) { const n = await figma.getNodeByIdAsync(id); if (!n) throw new Error('DS component not found: ' + key + ' ' + id); _n[id] = n; } return _n[id]; }
async function inst(key, props, name) {
  const n = await comp(key); let c = n;
  if (n.type === 'COMPONENT_SET') {
    const want = props || {};
    c = n.children.find(ch => ch.variantProperties && Object.entries(want).every(([k, v]) => ch.variantProperties[k] === v));
    if (!c) { warn(`No variant ${JSON.stringify(want)} in ${key}; default used`); c = n.defaultVariant; }
  }
  const i = c.createInstance();
  if (name) i.name = name;
  return i;
}
function setP(i, obj) {
  if (!i) { warn('setP on missing instance ' + JSON.stringify(obj)); return i; }
  const cp = i.componentProperties; const upd = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = Object.keys(cp).find(x => x === k || x.split('#')[0] === k);
    if (!key) { warn(`${i.name}: no property ${k}`); continue; }
    upd[key] = v;
  }
  try { if (Object.keys(upd).length) i.setProperties(upd); } catch (e) { warn(`${i.name}: setProperties failed ${e.message}`); }
  return i;
}
function nested(root, name) { return root.findOne(n => n.type === 'INSTANCE' && n.name === name); }
function layerText(root, name, txt) { const t = root.findOne(n => n.type === 'TEXT' && n.name === name); if (!t) { warn(`no text layer ${name} in ${root.name}`); return; } try { t.characters = txt; } catch (e) { warn(`text ${name}: ${e.message}`); } }
async function findByMain(root, setName) {
  for (const n of root.findAll(x => x.type === 'INSTANCE')) {
    const m = await n.getMainComponentAsync(); if (!m) continue;
    const nm = m.parent && m.parent.type === 'COMPONENT_SET' ? m.parent.name : m.name;
    if (nm === setName) return n;
  }
  return null;
}
function slotOf(i, name) { const s = i.findAll(n => n.type === 'SLOT'); return s.find(x => x.name === name) || s[0] || null; }
function clearSlot(s) { for (const ch of [...s.children]) { try { ch.remove(); } catch (e) { ch.visible = false; warn('slot child hidden (remove failed): ' + ch.name); } } }

// ---- small DS builders (instances + explicit text)
async function badge(tone, size, label, dot) { const b = await inst('Badge', { Tone: tone, Size: size }, 'Badge · ' + label); setP(b, { Label: label, 'Show dot': dot !== false }); return b; }
async function chip(tone, label) { const c = await inst('Chip', { Tone: tone }, 'Chip/Derived · ' + label); setP(c, { Label: label }); return c; }
async function noticeChip(dec, title) { const n = await inst('Notice', { Size: 'Chip', Tone: 'Policy pending' }, 'Notice/Policy pending · ' + dec); setP(n, { DEC: dec }); layerText(n, 'Title', title || 'Policy pending'); return n; }
async function noticeInline(dec, body) { const n = await inst('Notice', { Size: 'Inline', Tone: 'Policy pending' }, 'Notice/Policy pending · ' + dec); setP(n, { DEC: dec, Body: body }); return n; }
async function button(variant, size, label, icon) {
  const b = await inst('Button', { Variant: variant, Size: size, State: 'Default' }, 'Button · ' + label);
  setP(b, { Label: label, 'Show icon': !!icon }); if (icon) setP(b, { Icon: ICON[icon] }); return b;
}
async function iconBtn(variant, icon, name) { const b = await inst('IconButton', { Variant: variant, Size: 'Medium', State: 'Default' }, name); setP(b, { Icon: ICON[icon], 'Show dot': false }); return b; }
async function link(label) { const l = await inst('Link', { Size: 'Small', State: 'Default' }, 'Link · ' + label); setP(l, { Label: label, 'Show icon': false }); return l; }
async function divider(vertical, len) { const d = await inst('Divider', { Orientation: vertical ? 'Vertical' : 'Horizontal' }, 'Divider'); if (vertical) d.resize(1, len || 16); return d; }
async function kv(type, key, value) { const k = await inst('KV', { Type: type }, 'List/KeyValue · ' + key); setP(k, { Key: key, Value: value }); return k; }
async function tl(type, title, time, body, connector) { const t = await inst('TLItem', { Type: type }, 'Timeline/Item · ' + title); setP(t, { Title: title, Time: time, Body: body, 'Show connector': connector !== false }); return t; }
async function note(accent, author, time, body) { const n = await inst('Note', { Accent: accent }, 'ListItem/Note · ' + author); setP(n, { Author: author, Time: time, Body: body }); return n; }
async function sectionHead(title, linkLabel) {
  const h = AL('Header · ' + title, 'HORIZONTAL', { gap: 8, align: 'CENTER' });
  const t = await T(title, 'ds/H4', 'text/primary'); h.appendChild(t);
  spacer(h);
  if (linkLabel) h.appendChild(await link(linkLabel));
  return h;
}

// ---------- section ----------
let section = page.children.find(n => n.type === 'SECTION' && n.name === SECTION_NAME);
if (section) { for (const ch of [...section.children]) ch.remove(); OUT.updated.section = section.id; }
else { section = figma.createSection(); section.name = SECTION_NAME; page.appendChild(section); OUT.created.section = section.id; }
section.x = SEC_X; section.y = SEC_Y;
section.resizeWithoutConstraints(3160, 1700);

const sh1 = await T('S5 Developer Board', 'ds/Display', 'text/primary', { name: 'Section title' });
section.appendChild(sh1); sh1.x = 80; sh1.y = 56;
const sh2 = await T('SCR-DEV-006 Project board + SCR-DEV-007 Task drawer · WF-PROJ-001 · SM-PROJECT-001 · SM-TASK-001 · Desktop 1440×900, Light. Fictional data (brief §5). A = board; B = task drawer open on "Content upload".', 'ds/Body', 'text/secondary', { name: 'Section subtitle', w: 1800 });
section.appendChild(sh2); sh2.x = 80; sh2.y = 104;
rec('Section title', sh1); rec('Section subtitle', sh2);

// ---------- Frame A ----------
const FA = figma.createFrame(); FA.name = 'S5 / Developer Board — Desktop — Light';
section.appendChild(FA); FA.resize(1440, 900); FA.x = 80; FA.y = 200; FA.fills = [P('surface/page')]; FA.clipsContent = true;
FA.setExplicitVariableModeForCollection(await figma.variables.getVariableCollectionByIdAsync(SEM), '40:1');
rec('Frame A — Board', FA);

// Shell
const shell = await inst('Shell', { Role: 'Developer' }, 'Shell/Desktop · Developer');
FA.appendChild(shell); shell.x = 0; shell.y = 0; rec('A · Shell', shell);
const NAV = [['My Day', 'Default'], ['My Attendance', 'Default'], ['Deals', 'Default'], ['Meetings & Calendar', 'Default'], ['Projects', 'Active'], ['My Profile', 'Default']];
for (const [lab, st] of NAV) {
  const it = nested(shell, 'Nav/Item · ' + lab);
  if (!it) { warn('nav item not found: ' + lab); continue; }
  setP(it, { State: st }); setP(it, { Label: lab, 'Show badge': false });
}
{ const pj = nested(shell, 'Nav/Item · Projects'); if (pj) setP(pj, { Icon: ICON.board }); }
{ const secs = shell.findAll(n => n.type === 'INSTANCE' && n.name === 'Nav/SectionLabel'); ['MY WORK', 'DELIVERY'].forEach((t, i) => { if (secs[i]) setP(secs[i], { Label: t }); }); }
{
  const tb = nested(shell, 'TopBar');
  if (tb) {
    setP(tb, { Name: 'Sami Fares', Role: 'Developer', 'Show attendance': true, 'Show search': true });
    layerText(tb, 'Name', 'Sami Fares'); layerText(tb, 'Role', 'Developer');
    setP(nested(tb, 'Avatar'), { Initials: 'SF' });
    setP(nested(tb, 'Search'), { Placeholder: 'Search projects, tasks…', Value: '' });
    setP(nested(tb, 'Attendance'), { Label: 'Checked in · 08:51' });
  } else warn('TopBar not found in shell');
}

// Content frame
const content = figma.createAutoLayout('VERTICAL'); content.name = 'Content';
FA.appendChild(content);
content.primaryAxisSizingMode = 'FIXED'; content.counterAxisSizingMode = 'FIXED';
content.resize(1200, 836); content.x = 240; content.y = 64; content.fills = [];
num(content, 'paddingTop', 24); num(content, 'paddingRight', 24); num(content, 'paddingBottom', 24); num(content, 'paddingLeft', 24); num(content, 'itemSpacing', 16);
if (GS['ds/Grid/Desktop content 12-col']) await content.setGridStyleIdAsync(GS['ds/Grid/Desktop content 12-col'].id);
rec('A · Content', content);

// R1 Page header
const hdr = AL('R1 Page header', 'VERTICAL', { gap: 6 }); put(content, hdr, 'FILL');
const bc = await inst('Breadcrumb', null, 'Breadcrumb');
setP(bc, { 'Level 1': 'Projects', 'Level 2': 'Glow Beauty Salon (Downtown branch)', Current: 'Booking website', 'Show level 2': true });
hdr.appendChild(bc);
const titleRow = AL('Title row', 'HORIZONTAL', { gap: 12, align: 'CENTER' }); put(hdr, titleRow, 'FILL');
titleRow.appendChild(await T('Glow Beauty Salon — Booking website', 'ds/H1', 'text/primary', { name: 'Title' }));
spacer(titleRow);
titleRow.appendChild(await button('Secondary', 'Medium', 'Edit schedule', 'calendar'));
titleRow.appendChild(await button('Primary', 'Medium', 'Add task', 'plus'));
titleRow.appendChild(await iconBtn('Secondary', 'more', 'More actions'));
const meta = AL('Meta row', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(hdr, meta, 'FILL');
meta.appendChild(await badge('Brand', 'Small', 'Project · In progress'));
meta.appendChild(await badge('Info', 'Small', 'Deal · Closed deal'));
meta.appendChild(await chip('Neutral', 'Assigned to me'));
meta.appendChild(await divider(true, 16));
{ const av = await inst('Avatar', { Size: 'Small', Tone: 'Neutral' }, 'Avatar · SF'); setP(av, { Initials: 'SF' }); meta.appendChild(av); }
meta.appendChild(await T('Sami Fares · assigned developer', 'ds/Body Small', 'text/secondary'));
meta.appendChild(await divider(true, 16));
meta.appendChild(await T('PRJ-0014 · Salon · glowbeauty.example.com', 'ds/Body Small', 'text/muted'));
rec('A · R1 Page header', hdr);

// Split: left column + right rail
const split = AL('Main split', 'HORIZONTAL', { gap: 16 }); put(content, split, 'FILL', 'FILL');
const left = AL('Left column', 'VERTICAL', { gap: 8 }); put(split, left, 'FILL', 'FILL');

// R2 Project status bar (distinct from task status)
const sbar = AL('R2 Project status bar', 'VERTICAL', { gap: 10, pad: [12, 16], fill: 'surface/default', stroke: 'border/default', radius: 'lg' });
put(left, sbar, 'FILL');
const s1 = AL('Current status', 'HORIZONTAL', { gap: 12, align: 'CENTER' }); put(sbar, s1, 'FILL');
s1.appendChild(await T('PROJECT STATUS', 'ds/Overline', 'text/muted'));
s1.appendChild(await badge('Brand', 'Large', 'In progress'));
s1.appendChild(await T('since 15 Oct 2026 · by Sami Fares', 'ds/Caption', 'text/muted'));
spacer(s1);
s1.appendChild(await noticeChip('DEC-019', 'Policy pending · statuses proposed'));
const s2 = AL('Allowed next statuses', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(sbar, s2, 'FILL');
s2.appendChild(await T('Move project to:', 'ds/Label Small', 'text/secondary'));
s2.appendChild(await button('Secondary', 'Small', 'Waiting for client…'));
s2.appendChild(await button('Secondary', 'Small', 'Blocked…'));
s2.appendChild(await button('Ghost', 'Small', 'Back to Scheduled'));
// MF-11: Record delivered is a project-status change -> Secondary (the only primary on the page is "Add task").
s2.appendChild(await button('Secondary', 'Small', 'Record delivered'));
// MF-08: rule caption takes the remaining width and wraps (2 lines fit the 32 px button row) — never cut.
const ruleCap = await T('Non-linear · Completed only from Delivered', 'ds/Caption', 'text/muted', { name: 'Rule caption', w: 160 });
s2.appendChild(ruleCap); ruleCap.layoutSizingHorizontal = 'FILL'; ruleCap.textAutoResize = 'HEIGHT';
rec('A · R2 Project status bar', sbar);

// R3 Schedule & milestones (Card/Surface + Timeline/Milestone instances on a track)
const sched = await inst('Surface', null, 'R3 Schedule & milestones'); put(left, sched, 'FILL');
{
  const sl = slotOf(sched, 'Content'); clearSlot(sl);
  const h = AL('Schedule header', 'HORIZONTAL', { gap: 12, align: 'CENTER' });
  h.appendChild(await T('Schedule & milestones', 'ds/H4', 'text/primary'));
  h.appendChild(await T('Start 14 Oct 2026 → Target delivery 20 Nov 2026', 'ds/Body Small', 'text/secondary'));
  spacer(h);
  h.appendChild(await chip('Neutral', '31 days to target'));
  put(sl, h, 'FILL');
  const W = 760, step = (W - 132) / 3, todayX = Math.round(66 + step * (3 / 11));
  const tr = figma.createFrame(); tr.name = 'Milestone track'; tr.fills = []; tr.resize(W, 92); tr.clipsContent = false;
  sl.appendChild(tr);
  const track = figma.createRectangle(); track.name = 'Track'; tr.appendChild(track); track.resize(W - 132, 4); track.x = 66; track.y = 34; track.fills = [P('surface/sunken')]; rad(track, 'full');
  const prog = figma.createRectangle(); prog.name = 'Progress'; tr.appendChild(prog); prog.resize(todayX - 66, 4); prog.x = 66; prog.y = 34; prog.fills = [P('brand/accent')]; rad(prog, 'full');
  const MS = [['Achieved', 'Wireframes approved', '17 Oct · achieved'], ['Current', 'Content received', '28 Oct · client'], ['Upcoming', 'Booking flow ready', '3 Nov'], ['Final', 'Delivery (target)', '20 Nov']];
  for (let i = 0; i < MS.length; i++) {
    const m = await inst('Milestone', { State: MS[i][0] }, 'Timeline/Milestone · ' + MS[i][1]);
    setP(m, { Label: MS[i][1], Date: MS[i][2] });
    tr.appendChild(m); m.x = Math.round(i * step); m.y = 26;
  }
  const tline = figma.createRectangle(); tline.name = 'Today line'; tr.appendChild(tline); tline.resize(2, 42); tline.x = todayX - 1; tline.y = 6; tline.fills = [P('status/warning/solid')];
  const pill = AL('Today', 'HORIZONTAL', { pad: [2, 6], radius: 'sm', fill: 'status/warning/bg' });
  pill.appendChild(await T('Today · 20 Oct', 'ds/Caption', 'status/warning/fg'));
  tr.appendChild(pill); pill.x = todayX + 4; pill.y = 0;
}
rec('A · R3 Schedule & milestones', sched);

// Tasks header
const th = AL('Tasks header', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(left, th, 'FILL');
th.appendChild(await T('Tasks', 'ds/H4', 'text/primary'));
{ const c = await inst('Count', { Tone: 'Neutral' }, 'Badge/Count · tasks'); setP(c, { Count: '4' }); th.appendChild(c); }
{ const t = await T('Columns are task statuses (proposed, no DEC ID). Moving a task never changes the project status.', 'ds/Caption', 'text/muted', { w: 500 }); th.appendChild(t); t.layoutGrow = 1; }

// R4 Kanban (columns = task statuses, SM-TASK-001)
const kan = AL('R4 Task kanban', 'HORIZONTAL', { gap: 8 }); put(left, kan, 'FILL', 'FILL');
// MF-09: the DS column header holds an empty "Spacer" auto-layout (≈100 px tall) that pushed cards ~60 px down.
// It is hidden (visibility override only — no x/y/size on instance children); the column "+" is off because the page
// header "Add task" is the single add action. Cards hug; the sub-line may wrap to 2 lines; overflow -> "+n more".
const COLS = [];
async function column(title, count) {
  const c = await inst('Column', null, 'Kanban/Column · ' + title);
  put(kan, c, 'FILL', 'FILL');
  setP(c, { Title: title, 'Show add': false });
  const cnt = nested(c, 'Count'); if (cnt) setP(cnt, { Count: String(count) }); else warn('Count badge not found in column ' + title);
  const sp = c.findOne(n => n.name === 'Spacer' && n.parent && n.parent.name === 'Header');
  if (sp) { try { sp.visible = false; } catch (e) { warn('column spacer hide failed: ' + e.message); } }
  const sl = slotOf(c, 'Cards'); clearSlot(sl);
  rec('A · Column · ' + title, c); COLS.push({ title, c, sl });
  return sl;
}
const SUBFIT = [];
async function taskCard(sl, d) {
  const t = await inst('Task', { State: d.done ? 'Done' : 'Default' }, 'Card/Task · ' + d.title);
  put(sl, t, 'FILL');
  try { t.layoutSizingVertical = 'HUG'; } catch (e) { warn('card hug: ' + e.message); }
  setP(t, { Title: d.title, Due: d.due, 'Show chip': !!d.chip, 'Show notice': !!d.notice });
  // sub-line: allow 2 lines (text-truncation override, not a size); fall back to a one-line copy if the override is refused
  const pj = t.findOne(n => n.type === 'TEXT' && n.componentPropertyReferences && /^Project/.test(n.componentPropertyReferences.characters || ''));
  let two = false;
  if (pj) { try { pj.textTruncation = 'ENDING'; pj.maxLines = 2; two = pj.maxLines === 2 && pj.textAutoResize === 'HEIGHT'; } catch (e) { warn('sub-line maxLines override refused (' + d.title + '): ' + e.message); } }
  else warn('Project text layer not found in card ' + d.title);
  setP(t, { Project: two ? d.sub : d.short });
  setP(nested(t, 'Avatar'), { Initials: 'SF' });
  const ch = nested(t, 'Derived chip'); if (ch) setP(ch, { Label: d.chip || 'Client dependency' });
  const nt = nested(t, 'Policy'); if (nt) { setP(nt, { DEC: d.notice || 'DEC-018' }); layerText(nt, 'Title', 'pending'); }
  if (d.done) { const b = await findByMain(t, 'Badge/Status'); if (b) setP(b, { Label: 'Done' }); }
  rec('A · Task · ' + d.title, t);
  SUBFIT.push({ d, t, pj, nt: d.notice ? nt : null, two });
  return t;
}
const cTodo = await column('To do', 2);
await taskCard(cTodo, { title: 'Content upload', sub: 'Logo, price list and 12 photos from the client', short: 'Logo, prices, 12 photos', due: 'Due 28 Oct', chip: 'Client dependency' });
await taskCard(cTodo, { title: 'Payment page', sub: 'Scope held until the payment policy is decided', short: 'Scope held for DEC-018', due: 'Due 7 Nov', notice: 'DEC-018' });
const cProg = await column('In progress', 1);
await taskCard(cProg, { title: 'Booking flow', sub: 'Service → time slot → confirmation', short: 'Service → slot → confirm', due: 'Due 3 Nov' });
const cDone = await column('Done', 1);
await taskCard(cDone, { title: 'Wireframes approved', sub: 'Milestone achieved', short: 'Milestone achieved', due: '17 Oct', done: true });
const cCan = await column('Cancelled', 0, false);
{
  const e = AL('Empty · Cancelled', 'VERTICAL', { gap: 4, pad: [8, 4] });
  put(cCan, e, 'FILL');
  const a = await T('No cancelled tasks', 'ds/Label Small', 'text/secondary', { w: 160 }); put(e, a, 'FILL');
  const b = await T('Cancelling needs a reason (Proposed).', 'ds/Caption', 'text/muted', { w: 160 }); put(e, b, 'FILL');
}
// ---- fit checks (MF-09): sub-lines never truncated, DEC chip never clipped, no card cut by the column bottom
async function measure(ref, text) {
  const m = figma.createText(); page.appendChild(m); m.fontName = { family: 'Inter', style: 'Regular' }; m.characters = text;
  if (typeof ref.textStyleId === 'string' && ref.textStyleId) await m.setTextStyleIdAsync(ref.textStyleId);
  m.textAutoResize = 'WIDTH_AND_HEIGHT'; const w1 = m.width, h1 = m.height;
  m.textAutoResize = 'HEIGHT'; m.resize(Math.max(1, ref.width), h1); const lines = Math.round(m.height / Math.max(1, h1));
  m.remove(); return { w1, lines };
}
async function fitKanban() {
OUT.fit = { cards: [], columns: [] };
for (const s of SUBFIT) {
  if (s.pj) {
    let r = await measure(s.pj, s.two ? s.d.sub : s.d.short);
    if (s.two && r.lines > 2) { setP(s.t, { Project: s.d.short }); r = await measure(s.pj, s.d.short); }
    const cap = s.two ? 2 : 1;
    if (r.lines > cap) warn(`sub-line still exceeds ${cap} line(s) on ${s.d.title}`);
    OUT.fit.cards.push(`${s.d.title}: ${s.two ? '2-line' : '1-line'} sub-line, ${r.lines} line(s), width ${Math.round(s.pj.width)}`);
  }
  if (s.nt) {
    const cw = s.t.width - 24;
    if (s.nt.width > cw + 0.5) warn(`DEC chip ${Math.round(s.nt.width)} wider than card content ${Math.round(cw)} on ${s.d.title}`);
    OUT.fit.cards.push(`${s.d.title}: DEC chip ${Math.round(s.nt.width)} / ${Math.round(cw)}`);
  }
}
for (const col of COLS) {
  const cb = col.c.absoluteBoundingBox; const limit = cb.y + cb.height - 8;
  const cards = col.sl.children.filter(n => n.type === 'INSTANCE');
  const over = () => cards.length && (() => { const lb = cards[cards.length - 1].absoluteBoundingBox; return lb.y + lb.height > limit; })();
  const hidden = [];
  while (cards.length > 1 && over()) { const k = cards.pop(); hidden.unshift(k); }
  if (hidden.length) {
    const more = AL('More cards', 'VERTICAL', { gap: 6, pad: [4, 4] });
    const titles = hidden.map(k => k.name.replace('Card/Task · ', '')).join(', ');
    const notices = SUBFIT.filter(s => s.nt && hidden.includes(s.t)).map(s => s.d.notice);
    for (const k of hidden) { delete OUT.created['A · Task · ' + k.name.replace('Card/Task · ', '')]; k.remove(); }
    col.sl.appendChild(more); more.layoutSizingHorizontal = 'FILL';
    more.appendChild(await link('+' + hidden.length + ' more · ' + titles));
    for (const dec of notices) more.appendChild(await noticeChip(dec, 'pending'));
    // the "+n more" row itself must fit; drop one more card if not
    const mb = more.absoluteBoundingBox; if (mb.y + mb.height > limit) warn('column ' + col.title + ': "+n more" row still past the column bottom');
    rec('A · More · ' + col.title, more);
  }
  const lastB = col.sl.children.length ? (() => { const lb = col.sl.children[col.sl.children.length - 1].absoluteBoundingBox; return Math.round(limit - (lb.y + lb.height)); })() : null;
  OUT.fit.columns.push(`${col.title}: column h ${Math.round(cb.height)}, free below last item ${lastB}, hidden ${hidden.length}`);
}
}
rec('A · R4 Task kanban', kan);

// R5 Right rail (Card/Surface, sections separated by dividers)
const rail = await inst('Surface', null, 'R5 Right rail');
split.appendChild(rail); rail.resize(336, rail.height); rail.layoutSizingHorizontal = 'FIXED'; rail.layoutSizingVertical = 'FILL'; rail.clipsContent = true;
{
  const sl = slotOf(rail, 'Content'); clearSlot(sl); num(sl, 'itemSpacing', 8);
  // Deal context
  const deal = AL('Deal context', 'VERTICAL', { gap: 6 }); put(sl, deal, 'FILL');
  put(deal, await sectionHead('Deal context', 'Open deal DL-0031'), 'FILL');
  put(deal, await T('Closed ≠ Completed: delivery continues here.', 'ds/Caption', 'text/muted', { w: 296 }), 'FILL');
  for (const [k, v] of [['Accepted', '2 Oct · Maya Khoury'], ['Signed', '9 Oct · AGR-0109'], ['Paid', '12 Oct · PAY-0112'], ['Closed', '13 Oct · Sami Fares']]) put(deal, await kv('Check', k, v), 'FILL');
  put(deal, await noticeInline('DEC-006 / R-12', 'Closure authority pending: Developer vs Owner verification not decided.'), 'FILL');
  put(deal, await kv('Default', 'Project', 'Provisioned 13 Oct (Scheduled)'), 'FILL');
  put(deal, await noticeInline('F2', 'Provisioning trigger pending: automatic at closure vs manual.'), 'FILL');
  put(sl, await divider(false), 'FILL');
  // Client dependencies & notes
  const notes = AL('Client dependencies & notes', 'VERTICAL', { gap: 8 }); put(sl, notes, 'FILL');
  put(notes, await sectionHead('Client dependencies & notes', 'Add note'), 'FILL');
  put(notes, await note('Amber', 'Sami Fares · open', '20 Oct, 10:12', 'Client content needed (logo, price list, 12 photos) for Content upload. Project stays In progress.'), 'FILL');
  put(sl, await divider(false), 'FILL');
  // Activity
  const act = AL('Activity', 'VERTICAL', { gap: 8 }); put(sl, act, 'FILL');
  put(act, await sectionHead('Activity', 'View all'), 'FILL');
  put(act, await tl('Note', 'Client dependency added', '20 Oct, 10:12', 'Sami Fares · task Content upload'), 'FILL');
  put(act, await tl('Status change', 'Project → In progress', '15 Oct, 11:00', 'Project status, from Scheduled · Sami Fares'), 'FILL', null);
  const lastTl = act.children[act.children.length - 1]; setP(lastTl, { 'Show connector': false });
}
rec('A · R5 Right rail', rail);
{ // never show a half-cut activity item at the rail bottom: drop trailing items that pass the rail's inner bottom
  const rb = rail.absoluteBoundingBox, limit = rb.y + rb.height - 16;
  const act = rail.findOne(n => n.type === 'FRAME' && n.name === 'Activity');
  if (act) {
    const items = () => act.children.filter(n => n.type === 'INSTANCE');
    while (items().length > 1) { const it = items()[items().length - 1]; const b = it.absoluteBoundingBox; if (b.y + b.height <= limit) break; it.remove(); }
    const its = items(); if (its.length) setP(its[its.length - 1], { 'Show connector': false });
    const lb = its.length ? its[its.length - 1].absoluteBoundingBox : null;
    if (lb && lb.y + lb.height > limit) warn('rail: first activity item still past the rail bottom');
    OUT.fit_rail = 'activity items shown: ' + its.length;
  }
}
await fitKanban(); // after the rail exists, so column widths are final

// ---------- Frame B (clone of A + scrim + task drawer) ----------
const FB = FA.clone(); FB.name = 'S5 / Developer Board — Desktop — Light — Task drawer';
section.appendChild(FB); FB.x = 80 + 1440 + 120; FB.y = 200;
rec('Frame B — Task drawer', FB);
const scrim = await inst('Scrim', { Size: 'Desktop' }, 'Overlay/Scrim'); FB.appendChild(scrim); scrim.x = 0; scrim.y = 0; rec('B · Scrim', scrim);
const dr = await inst('Drawer', null, 'Drawer · Task detail'); FB.appendChild(dr); dr.x = 960; dr.y = 0; rec('B · Drawer', dr);
setP(dr, { Title: 'Content upload', Subtitle: 'Task · PRJ-0014 · Glow Beauty Salon — Booking website', 'Show subtitle': true });
{
  let body = slotOf(dr, 'Content'); const foot = dr.findAll(n => n.type === 'SLOT').find(s => s.name === 'Footer') || dr.findAll(n => n.type === 'SLOT')[1];
  clearSlot(body); num(body, 'itemSpacing', 0);
  const bodySlot = body;
  // MF-10: body = the slot's inner width (no fixed 432); every field FILLs it, so all share one width.
  const inner = AL('Drawer body', 'VERTICAL', { gap: 16 }); bodySlot.appendChild(inner);
  try { inner.layoutSizingHorizontal = 'FILL'; } catch (e) { inner.resize(Math.max(1, bodySlot.width - (bodySlot.paddingLeft || 0) - (bodySlot.paddingRight || 0)), 10); inner.layoutSizingHorizontal = 'FIXED'; }
  inner.layoutSizingVertical = 'HUG';
  body = inner; rec('B · Drawer body', inner);
  const st = await inst('Select', { Type: 'Select', State: 'Filled' }, 'Select · Task status');
  setP(st, { Label: 'Task status', 'Show label': true, Required: false, Value: 'To do', Placeholder: 'Select status', Helper: 'Task status only (proposed, no DEC ID). Project status stays In progress.', 'Show helper': true });
  put(body, st, 'FILL');
  // MF-12: task chip reads "Client dependency"; "Waiting for client" is reserved for the project status.
  const dep = AL('Client dependency', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); put(body, dep, 'FILL');
  dep.appendChild(await chip('Amber', 'Client dependency'));
  { const t = await T('Client content pending on this task — not a task status.', 'ds/Body Small', 'text/secondary', { w: 260 }); dep.appendChild(t); t.layoutSizingHorizontal = 'FILL'; }
  const ow = await inst('Select', { Type: 'Person', State: 'Filled' }, 'Select · Owner');
  setP(ow, { Label: 'Owner', 'Show label': true, Required: false, Value: 'Sami Fares', Placeholder: 'Select owner', Helper: '', 'Show helper': false });
  setP(nested(ow, 'Avatar'), { Initials: 'SF' });
  put(body, ow, 'FILL');
  const dates = AL('Dates', 'HORIZONTAL', { gap: 16 }); put(body, dates, 'FILL');
  const DF = [];
  for (const [l, v] of [['Start date', '21 Oct 2026'], ['Due date', '28 Oct 2026']]) {
    const d = await inst('Date', { Type: 'Date', State: 'Filled' }, 'Input/Date · ' + l);
    setP(d, { Label: l, 'Show label': true, Required: false, Value: v, Placeholder: 'DD MMM YYYY', Helper: '', 'Show helper': false });
    put(dates, d, 'FILL'); DF.push(d);
  }
  const ta = await inst('Textarea', { State: 'Filled' }, 'Textarea · Description');
  setP(ta, { Label: 'Description', 'Show label': true, Required: false, Value: 'Upload logo, price list and 12 salon photos once received from the client. Optimise images for web.', Placeholder: 'Describe the task', Helper: '', 'Show helper': false, Counter: '101 / 500' });
  put(body, ta, 'FILL');
  put(body, await note('Amber', 'Sami Fares', '20 Oct, 10:12', 'Client dependency: waiting for logo (SVG), price list and 12 photos.'), 'FILL');
  body.appendChild(await link('Mark dependency resolved'));
  // Fit check: a field (or any visible layer in it) must not pass its own box or the body edge.
  // 2-column dates first; if a date control cannot shrink to half width (DS min width), stack them full width.
  const spill = (n) => { const ib = inner.absoluteBoundingBox, nb = n.absoluteBoundingBox; let m = nb.x + nb.width - (ib.x + ib.width);
    for (const k of n.findAll(x => x.visible !== false && x.absoluteRenderBounds)) { const kb = k.absoluteRenderBounds; m = Math.max(m, kb.x + kb.width - (nb.x + nb.width), kb.x + kb.width - (ib.x + ib.width)); } return m; };
  let dateSpill = Math.max(...DF.map(spill));
  if (dateSpill > 0.5) { dates.layoutMode = 'VERTICAL'; for (const d of DF) d.layoutSizingHorizontal = 'FILL'; OUT.fit_drawer_dates = 'stacked (2-column spilled ' + Math.round(dateSpill) + ' px)'; }
  else OUT.fit_drawer_dates = '2-column';
  for (const f of [st, ow, ta, ...DF]) { const m = spill(f); if (m > 0.5) warn('drawer: ' + f.name + ' spills ' + Math.round(m) + ' px past the body'); }
  { const sb = bodySlot.absoluteBoundingBox, ib = inner.absoluteBoundingBox; const free = Math.round(sb.y + sb.height - (bodySlot.paddingBottom || 0) - (ib.y + ib.height)); OUT.fit_drawer_body = 'free height ' + free; if (free < 0) warn('drawer body taller than its slot by ' + (-free) + ' px'); }
  if (foot) {
    clearSlot(foot);
    const fr = AL('Drawer actions', 'HORIZONTAL', { gap: 8, align: 'CENTER' }); foot.appendChild(fr);
    try { fr.layoutSizingHorizontal = 'FILL'; } catch (e) { fr.resize(Math.max(1, foot.width - (foot.paddingLeft || 0) - (foot.paddingRight || 0)), 40); fr.layoutSizingHorizontal = 'FIXED'; }
    fr.layoutSizingVertical = 'HUG';
    fr.appendChild(await button('Ghost', 'Medium', 'Cancel task…'));
    spacer(fr);
    fr.appendChild(await button('Secondary', 'Medium', 'Close'));
    fr.appendChild(await button('Primary', 'Medium', 'Save changes'));
    rec('B · Drawer actions', fr);
  } else warn('Drawer footer slot not found');
}

// ---------- Annotations (designer notes, not product UI) ----------
const ann = AL('Annotations', 'HORIZONTAL', { gap: 24, align: 'MIN' });
section.appendChild(ann); ann.x = 80; ann.y = 1180;
const NOTES = [
  ['Interaction', 'A1 — Project status control', 'Allowed next from In progress (SM-PROJECT-001, DEC-019 proposed): Waiting for client (note required), Blocked (reason required), Back to Scheduled, Record delivered (open tasks → warning only, OQ-10). Completed only from Delivered. Invalid transitions are rejected.'],
  ['Interaction', 'A2 — Task cards', 'Click a card → task drawer (frame B). Drag between columns changes task status only (SM-TASK-001): Cancelled needs a reason; Done → In progress = reopen (Proposed, not when project Completed). Columns scroll; when cards exceed the column, "+n more" expands it.'],
  ['Note', 'A3 — Client dependency ≠ status', '"Waiting for client" is only a project status (status bar). The dashed amber "Client dependency" chip on the Content upload task is derived from an open client note (tooltip: "Client content pending; not a status"); the task stays To do and the project stays In progress unless the whole project waits.'],
  ['Note', 'A4 — Closed ≠ Completed (G1)', 'Accepted, signed, paid and closed are recorded facts. "Closed · Sami Fares" does not select DEC-006 Alt A (R-12). Provisioning trigger is F2 (pending). No amounts until DEC-018.'],
  ['Interaction', 'A5 — Drawer save', 'Save conflict → reload or retry; nothing changes (SCR-DEV-007 25:10190). Success toast: "Task saved. Project status unchanged." Out of scope here: Delivered warning, Completed read-only, hidden by policy, mobile.']
];
for (const [type, title, body] of NOTES) {
  const a = await inst('Annotation', { Type: type }, 'Annotation · ' + title);
  setP(a, { Title: title, Body: body }); ann.appendChild(a); rec('Annotation · ' + title, a);
}
rec('Annotations row', ann);
section.resizeWithoutConstraints(3160, Math.max(1500, Math.ceil(ann.y + ann.height + 80)));

// ---------- report ----------
const ovf = [];
for (const fr of [FA, FB]) for (const n of fr.findAll(x => x.type === 'TEXT')) {
  if (!n.visible) continue;
  if (/^(Label|Value|Status|Derived|Caption|Meta line|Task title|Column|Section title|Subtitle|Activity title|Activity details\.|Note text\.|Milestone|Author|Key|Drawer title|Toast title|DEC-000|Helper text)$/.test(n.characters)) ovf.push(fr.name.slice(-12) + ' · ' + n.name + ' = "' + n.characters + '"');
}
OUT.placeholderTextLeft = ovf.slice(0, 40);
OUT.bounds = { statusBar: [sbar.width, sbar.height], schedule: [sched.width, sched.height], section: [section.x, section.y, section.width, section.height], frameA: [FA.x, FA.y], frameB: [FB.x, FB.y], left: [left.width, left.height], rail: [rail.width, rail.height], kanban: [kan.width, kan.height] };
return OUT;
