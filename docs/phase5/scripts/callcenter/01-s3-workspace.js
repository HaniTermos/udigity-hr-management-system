// 01-s3-workspace.js — Call Center Screen Agent — Phase 5 visual sample S3
// Page "30 HiFi — Visual Sample" (36:4), section "S3 Call Center Workspace" at x=0, y=2400.
// Builds: main frame "S3 / Call Center Workspace — Desktop Light" (1440x900),
// companion "S3 / Outcome branches — panel detail", and "S3 / Annotations".
// Final pass (2026-10-21): MF-04/05 reserved scroll cues, MF-06 footer label + caption, MF-07 no assignee on Decide later.
// Spec: docs/phase5/screens/callcenter-sample-spec.md. DS instances + Semantic/Primitive variables only.
// Idempotent: reuses the section by name and rebuilds only its own "S3 / ..." frames.

const OUT = { created: {}, updated: {}, regions: {}, warnings: [] };
const PAGE_ID = '36:4', SEM_ID = 'VariableCollectionId:40:3', PRIM_ID = 'VariableCollectionId:40:2', LIGHT = '40:1';
const SECTION_NAME = 'S3 Call Center Workspace';

await figma.setCurrentPageAsync(await figma.getNodeByIdAsync(PAGE_ID));
for (const s of ['Regular', 'Medium', 'Semi Bold', 'Bold']) await figma.loadFontAsync({ family: 'Inter', style: s });

// ---------- variables, styles ----------
const semCol = await figma.variables.getVariableCollectionByIdAsync(SEM_ID);
const SV = {}, PV = {};
for (const v of await figma.variables.getLocalVariablesAsync()) {
  if (v.variableCollectionId === SEM_ID) SV[v.name] = v;
  else if (v.variableCollectionId === PRIM_ID) PV[v.name] = v;
}
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const GS = {}; for (const s of await figma.getLocalGridStylesAsync()) GS[s.name] = s;

function paint(name) {
  const v = SV[name];
  const base = { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } };
  if (!v) { OUT.warnings.push('semantic variable missing: ' + name); return base; }
  return figma.variables.setBoundVariableForPaint(base, 'color', v);
}
function bindF(node, field, pname, fallback) {
  const v = PV[pname];
  if (v) { try { node.setBoundVariable(field, v); return; } catch (e) { OUT.warnings.push(`bind ${field} ${pname}: ${e.message}`); } }
  else OUT.warnings.push('primitive missing: ' + pname);
  if (fallback != null) node[field] = fallback;
}

// ---------- DS components ----------
const CID = {
  'Shell/Desktop': '49:1926', 'Breadcrumb': '49:1006', 'Tabs': '49:1198', 'Button': '45:305', 'Link': '45:441',
  'Checkbox': '45:497', 'Radio': '45:522', 'Input': '45:796', 'Textarea': '45:847', 'Select': '46:434', 'Input/Date': '46:594',
  'Input/Search': '46:748', 'RadioCard': '46:831', 'Badge/Count': '44:471', 'Chip/Derived': '44:509',
  'Notice/Policy pending': '44:549', 'Annotation': '44:395', 'Card/Section': '51:1780', 'Card/Inset': '51:1797',
  'List/KeyValue': '51:1888', 'Banner': '53:1960', 'Timeline/Item': '54:2309', 'Banner/Reservation': '55:2533',
  'Queue/BucketHeader': '55:2549', 'Queue/Row': '55:2596', 'Row/Phone': '55:2600', 'Row/Social': '55:2629',
};
const ICON = { calendar: '44:18', ban: '44:173', flag: '44:208', lock: '44:133', link: '44:273' };
const COMPS = {};
for (const [n, id] of Object.entries(CID)) {
  const node = await figma.getNodeByIdAsync(id);
  if (!node) throw new Error('DS component missing: ' + n + ' ' + id);
  COMPS[n] = node;
}
function variantOf(name, props) {
  const c = COMPS[name];
  if (c.type === 'COMPONENT') return c;
  if (!props) return c.defaultVariant;
  const v = c.children.find(ch => ch.type === 'COMPONENT' && Object.entries(props).every(([k, val]) => ch.variantProperties && ch.variantProperties[k] === val));
  if (!v) { OUT.warnings.push(`variant not found ${name} ${JSON.stringify(props)}; default used`); return c.defaultVariant; }
  return v;
}
// set properties by base name (part before #); TEXT values are verified on the bound layer (DS default-text defect)
function prop(inst, obj) {
  if (!inst) return inst;
  const cp = inst.componentProperties, out = {}, texts = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = Object.keys(cp).find(x => x === k || x.split('#')[0] === k);
    if (!key) { OUT.warnings.push(`prop "${k}" missing on ${inst.name}`); continue; }
    out[key] = v;
    if (cp[key].type === 'TEXT') texts.push([key, v]);
  }
  try { inst.setProperties(out); } catch (e) { OUT.warnings.push(`setProperties ${inst.name}: ${e.message}`); }
  if (texts.length) {
    const tnodes = inst.findAllWithCriteria({ types: ['TEXT'] });
    for (const [key, v] of texts) for (const t of tnodes) {
      const r = t.componentPropertyReferences;
      if (r && r.characters === key && t.characters !== v) { try { t.characters = v; } catch (e) { OUT.warnings.push(`text fix ${key}: ${e.message}`); } }
    }
  }
  return inst;
}
function I(name, props, setp, nodeName) {
  const inst = variantOf(name, props).createInstance();
  if (setp) prop(inst, setp);
  if (nodeName) inst.name = nodeName;
  return inst;
}
function nested(inst, name) { return inst.findAllWithCriteria({ types: ['INSTANCE'] }).find(n => n.name === name) || null; }
function layer(inst, name, text) {
  const t = inst.findAllWithCriteria({ types: ['TEXT'] }).find(n => n.name === name);
  if (!t) { OUT.warnings.push(`text layer "${name}" missing on ${inst.name}`); return; }
  if (t.characters !== text) t.characters = text;
}
function hideLayer(inst, name) { const n = inst.findOne(x => x.name === name); if (n) n.visible = false; else OUT.warnings.push(`layer "${name}" missing on ${inst.name}`); }

// ---------- layout helpers ----------
function AL(name, dir, o = {}) {
  const f = figma.createAutoLayout(dir);
  f.name = name; f.fills = [];
  if (o.gap != null) bindF(f, 'itemSpacing', 'space/' + o.gap, o.gap);
  if (o.pad != null) {
    const p = Array.isArray(o.pad) ? o.pad : [o.pad];
    const [t, r = t, b = t, l = r] = p;
    bindF(f, 'paddingTop', 'space/' + t, t); bindF(f, 'paddingRight', 'space/' + r, r);
    bindF(f, 'paddingBottom', 'space/' + b, b); bindF(f, 'paddingLeft', 'space/' + l, l);
  }
  if (o.fill) f.fills = [paint(o.fill)];
  if (o.stroke) { f.strokes = [paint(o.stroke)]; f.strokeWeight = 1; f.strokeAlign = 'INSIDE'; }
  if (o.radius) for (const c of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) bindF(f, c, 'radius/' + o.radius, null);
  if (o.align) f.counterAxisAlignItems = o.align;
  if (o.justify) f.primaryAxisAlignItems = o.justify;
  if (o.clip) f.clipsContent = true;
  return f;
}
function topRule(f, color) { f.strokes = [paint(color)]; f.strokeAlign = 'INSIDE'; f.strokeTopWeight = 1; f.strokeBottomWeight = 0; f.strokeLeftWeight = 0; f.strokeRightWeight = 0; }
async function T(chars, style, color, o = {}) {
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Regular' };
  t.characters = chars;
  if (TS[style]) await t.setTextStyleIdAsync(TS[style].id); else OUT.warnings.push('text style missing: ' + style);
  t.fills = [paint(color || 'text/primary')];
  t.name = o.name || chars.slice(0, 40);
  if (o.w) { t.resize(o.w, Math.max(16, t.height)); t.textAutoResize = 'HEIGHT'; }
  return t;
}
function add(parent, ...kids) { for (const k of kids) parent.appendChild(k); return parent; }
function fillW(n) { n.layoutSizingHorizontal = 'FILL'; return n; }
function fillH(n) { n.layoutSizingVertical = 'FILL'; return n; }
function grow(n) { n.layoutGrow = 1; return n; }
function fixedCol(n, w) { n.resize(w, 100); n.layoutSizingHorizontal = 'FIXED'; return n; }
function reg(key, node) { OUT.regions[key] = node.id; return node; }

function notice(size, dec, body, title) {
  const n = I('Notice/Policy pending', { Size: size, Tone: 'Policy pending' }, size === 'Chip' ? { DEC: dec } : { DEC: dec, Body: body }, 'Policy · ' + dec);
  if (title) layer(n, 'Title', title);
  return n;
}
function button(variant, size, label, icon, state) {
  const p = { Label: label, 'Show icon': !!icon };
  if (icon) p.Icon = ICON[icon];
  return I('Button', { Variant: variant, Size: size, State: state || 'Default' }, p, 'Button · ' + label);
}
// Card with native Content slot; falls back to a token-bound frame if the slot cannot be filled.
async function slotCard(parent, compName, o) {
  const c = I(compName, null, null, o.name);
  parent.appendChild(c); fillW(c);
  if (compName === 'Card/Section') {
    prop(c, { Title: o.title, Subtitle: o.subtitle || ' ', 'Show subtitle': !!o.subtitle, 'Show action': !!o.action });
    if (o.action) {
      const a = nested(c, 'Action');
      const ap = { Label: o.action.label, 'Show icon': !!o.action.icon };
      if (o.action.icon) ap.Icon = ICON[o.action.icon];
      if (a) prop(a, ap); else OUT.warnings.push('Card/Section Action link not found: ' + o.name);
    }
  }
  const slot = c.findAllWithCriteria({ types: ['SLOT'] })[0];
  if (slot) {
    try {
      const probe = figma.createFrame(); slot.appendChild(probe); probe.remove();
      for (const k of [...slot.children]) { try { k.remove(); } catch (e) { k.visible = false; } }
      return { card: c, body: slot };
    } catch (e) { OUT.warnings.push(`slot not fillable on ${o.name}: ${e.message}; token-frame fallback`); }
  } else OUT.warnings.push(`no SLOT in ${o.name}; token-frame fallback`);
  // fallback (same tokens as the DS card)
  c.remove();
  const inset = compName === 'Card/Inset';
  const f = AL(o.name, 'VERTICAL', inset ? { gap: 12, pad: 16, fill: 'surface/subtle', stroke: 'border/subtle', radius: 'lg' } : { gap: 16, pad: 20, fill: 'surface/default', stroke: 'border/default', radius: 'xl' });
  parent.appendChild(f); fillW(f);
  if (!inset) {
    const head = AL('Header', 'HORIZONTAL', { gap: 12, align: 'MIN' });
    const tx = AL('Titles', 'VERTICAL', { gap: 2 });
    tx.appendChild(await T(o.title, 'ds/H3', 'text/primary', { name: 'Title' }));
    if (o.subtitle) { const st = await T(o.subtitle, 'ds/Body Small', 'text/secondary', { name: 'Subtitle', w: 240 }); tx.appendChild(st); fillW(st); }
    head.appendChild(tx); f.appendChild(head); fillW(head); grow(tx);
    if (o.action) { const l = I('Link', { Size: 'Small', State: 'Default' }, { Label: o.action.label, 'Show icon': !!o.action.icon }, 'Action'); if (o.action.icon) prop(l, { Icon: ICON[o.action.icon] }); head.appendChild(l); }
  }
  const body = AL('Content', 'VERTICAL', { gap: 12 });
  f.appendChild(body); fillW(body);
  return { card: f, body };
}

// ---------- section (idempotent) ----------
const page = figma.currentPage;
let section = page.children.find(n => n.type === 'SECTION' && n.name === SECTION_NAME);
if (section) {
  for (const k of [...section.children]) if (k.name.startsWith('S3 / ')) k.remove();
  OUT.updated.section = section.id;
} else {
  section = figma.createSection(); section.name = SECTION_NAME; page.appendChild(section);
  OUT.created.section = section.id;
  section.x = 0; section.y = 2400; // initial placement only; a re-run keeps the section where it is
}

// =====================================================================
// MAIN FRAME
// =====================================================================
const main = figma.createFrame();
main.name = 'S3 / Call Center Workspace — Desktop Light';
section.appendChild(main);
main.resize(1440, 900); main.x = 80; main.y = 80;
main.fills = [paint('surface/page')]; main.clipsContent = true;
main.setExplicitVariableModeForCollection(semCol, LIGHT);
OUT.created.mainFrame = main.id;

// R0/R1 shell
const shell = I('Shell/Desktop', { Role: 'Call Center' }, null, 'Shell');
main.appendChild(shell); shell.x = 0; shell.y = 0;
reg('shell', shell);
for (const it of shell.findAllWithCriteria({ types: ['INSTANCE'] }).filter(n => n.name.startsWith('Nav/Item · '))) {
  const label = it.name.slice('Nav/Item · '.length);
  prop(it, { State: label === 'Calling Queue' ? 'Active' : 'Default' });
  prop(it, { Label: label });
  if (label === 'Calling Queue' || label === 'Follow-ups & Calendar') {
    prop(it, { 'Show badge': true });
    const b = nested(it, 'Badge'); if (b) prop(b, { Count: label === 'Calling Queue' ? '7' : '3' });
  }
}
const secLabels = shell.findAllWithCriteria({ types: ['INSTANCE'] }).filter(n => n.name === 'Nav/SectionLabel');
['MY WORK', 'CALLING'].forEach((l, i) => { if (secLabels[i]) prop(secLabels[i], { Label: l }); });
const topBar = nested(shell, 'TopBar');
if (topBar) {
  prop(topBar, { Name: 'Maya Khoury', Role: 'Call Center', 'Show attendance': true, 'Show search': true });
  prop(nested(topBar, 'Attendance'), { Label: 'Checked in · 08:58' });
  prop(nested(topBar, 'Avatar'), { Initials: 'MK' });
  prop(nested(topBar, 'Search'), { Placeholder: 'Search assigned businesses' });
} else OUT.warnings.push('TopBar not found in shell');

// final pass (MF-04/05): scroll cue is an in-flow strip in RESERVED space below the scroll viewport.
// It is never absolute and never overlaps content; the viewport above it shrinks by its height.
async function scrollCue(parent, index, label, name, boxed) {
  const h = AL(name, 'HORIZONTAL', boxed
    ? { gap: 4, pad: [8, 16], align: 'CENTER', justify: 'CENTER', fill: 'surface/subtle', stroke: 'border/subtle', radius: 'lg' }
    : { gap: 4, pad: [8, 16], align: 'CENTER', justify: 'CENTER', fill: 'surface/subtle' });
  if (!boxed) topRule(h, 'border/subtle');
  const t = await T(label, 'ds/Caption', 'text/secondary', { name: 'Label' });
  t.textAlignHorizontal = 'CENTER';
  h.appendChild(t);
  parent.insertChild(Math.min(index, parent.children.length), h);
  fillW(h); fillW(t); t.textAutoResize = 'HEIGHT';
  return { cue: h, label: t };
}
function relBottom(node, frame) { return node.absoluteTransform[1][2] - frame.absoluteTransform[1][2] + node.height; }
OUT.fit = {};

// content frame 1200x836 at (240,64)
// repair r2: tighter vertical padding/gap gives every column 16 px more height
const content = AL('Content', 'VERTICAL', { gap: 12, pad: [20, 24, 16, 24] });
main.appendChild(content);
content.resize(1200, 836); content.primaryAxisSizingMode = 'FIXED'; content.counterAxisSizingMode = 'FIXED';
content.x = 240; content.y = 64;
if (GS['ds/Grid/Desktop content 12-col']) await content.setGridStyleIdAsync(GS['ds/Grid/Desktop content 12-col'].id);
reg('content', content);

// R2 page header
const hdr = AL('R2 Page header', 'HORIZONTAL', { gap: 12, align: 'CENTER' });
content.appendChild(hdr); fillW(hdr);
const titles = AL('Titles', 'VERTICAL', { gap: 2 });
const bc = I('Breadcrumb', null, { 'Level 1': 'Calling Queue', 'Show level 2': false, Current: 'Olive & Thyme Café' }, 'Breadcrumb');
add(titles, bc, await T('Contact workspace', 'ds/H2', 'text/primary', { name: 'Title' }));
add(hdr, titles, button('Secondary', 'Medium', 'Follow-ups & Calendar', 'calendar'), button('Ghost', 'Medium', 'Do-not-call list (1)', 'ban'));
grow(titles);
reg('R2 header', hdr);

// workspace row
const work = AL('Workspace', 'HORIZONTAL', { gap: 16 });
content.appendChild(work); fillW(work); fillH(work);
work.counterAxisAlignItems = 'MIN';

// ---------- R3 queue ----------
const Q = AL('R3 Queue', 'VERTICAL', { fill: 'surface/default', stroke: 'border/default', radius: 'xl', clip: true });
work.appendChild(Q); fixedCol(Q, 344); fillH(Q);
reg('R3 queue', Q);
const qh = AL('Queue header', 'VERTICAL', { gap: 10, pad: 16 });
Q.appendChild(qh); fillW(qh);
const qt = AL('Title row', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
const qtt = await T('My calling queue', 'ds/H3', 'text/primary', { name: 'Title' });
add(qt, qtt, I('Badge/Count', { Tone: 'Neutral' }, { Count: '7' }, 'Business count'), await T('businesses', 'ds/Caption', 'text/muted'));
qh.appendChild(qt); fillW(qt); grow(qtt);
const qs = I('Input/Search', { Size: 'Small', State: 'Default' }, { Placeholder: 'Filter queue' }, 'Filter');
qh.appendChild(qs); fillW(qs);
const qtabs = I('Tabs', { Style: 'Segmented', Active: '1' }, null, 'Queue view');
prop(nested(qtabs, 'Tab 1'), { Label: 'All buckets' }); prop(nested(qtabs, 'Tab 2'), { Label: 'Due today (2)' });
hideLayer(qtabs, 'Tab 3'); hideLayer(qtabs, 'Tab 4');
qh.appendChild(qtabs);
qh.appendChild(I('Chip/Derived', { Tone: 'Neutral' }, { Label: 'Derived · a business can be in 2 buckets' }, 'Derived note'));

const qlist = AL('Queue list', 'VERTICAL', { clip: true });
Q.appendChild(qlist); fillW(qlist); fillH(qlist);
const BUCKETS = [
  { label: 'Callbacks due today', count: '2', exp: true, rows: [
    { name: 'Olive & Thyme Café', cat: 'Café', out: 'Needs another call', meta: 'Due 10:30 · last attempt 13 Oct 15:10', sel: true },
    { name: 'Nova Dental Clinic', cat: 'Clinic', out: 'Needs another call', meta: 'Due 14:00 · last attempt 16 Oct 11:45' }] },
  { label: 'Overdue follow-ups', count: '1', exp: true, rows: [
    { name: 'Sunrise Bakery', cat: 'Shop', out: 'On hold', meta: 'Was due 19 Oct 16:00 · last attempt 15 Oct', flag: ['Danger', 'Overdue'] }] },
  { label: 'New assignments', count: '2', exp: false, rows: [] },
  { label: 'Callback to be scheduled', count: '1', exp: true, rows: [
    { name: 'Cedar Home Realty', cat: 'Real estate', out: 'Needs another call', meta: 'Time not set yet · last attempt 16 Oct' }] },
  { label: 'Data correction requested', count: '1', exp: true, rows: [
    { name: 'Bloom Florist', cat: 'Shop', out: 'On hold', meta: 'Last attempt 14 Oct 12:30', flag: ['Warning', 'Correction requested 14 Oct'] }] },
  { label: 'Requires contact', count: '1', exp: false, rows: [] },
];
for (const b of BUCKETS) {
  const bh = I('Queue/BucketHeader', { Expanded: b.exp ? 'True' : 'False' }, { Label: b.label }, 'Bucket · ' + b.label);
  prop(nested(bh, 'Count'), { Count: b.count });
  qlist.appendChild(bh); fillW(bh);
  for (const r of b.rows) {
    // repair r2: category moves to the meta line (Category tag hidden) so full names fit; name/meta may wrap to 2 lines
    const row = I('Queue/Row', { State: r.sel ? 'Selected' : 'Default' }, { Name: r.name, Meta: r.cat + ' · ' + r.meta, 'Show flag': !!r.flag }, 'Row · ' + r.name);
    const cat = nested(row, 'Category'); if (cat) cat.visible = false; else OUT.warnings.push('Queue/Row Category missing');
    for (const tn of ['Name', 'Meta']) {
      const t = row.findAllWithCriteria({ types: ['TEXT'] }).find(n => n.name === tn);
      if (t) { try { t.maxLines = 2; } catch (e) { OUT.warnings.push(`Queue/Row ${tn} maxLines: ${e.message}`); } }
    }
    prop(nested(row, 'Outcome'), { Outcome: r.out });
    if (r.flag) prop(nested(row, 'Flag'), { Tone: r.flag[0], Label: r.flag[1] });
    qlist.appendChild(row); fillW(row);
    if (r.sel) reg('selected row', row);
  }
}
const qf = AL('Queue footer', 'VERTICAL', { gap: 8, pad: [12, 16] });
topRule(qf, 'border/default');
Q.appendChild(qf); fillW(qf);
add(qf,
  I('Link', { Size: 'Small', State: 'Default' }, { Label: 'Rejected: do not call (1) — view only', 'Show icon': true, Icon: ICON.ban }, 'Do-not-call link'),
  notice('Chip', 'DEC-016', null, 'Reopen rule pending'));
{
  const qc = await scrollCue(Q, Q.children.indexOf(qf), '↓ More below', 'Scroll cue · queue', false);
  // MF-04 r2: the queue list is its own clipping viewport (FILL) ending ABOVE the cue strip + footer.
  // Any header/row not FULLY inside it is hidden (with everything after it), so the cut falls between rows.
  // The label names exactly those hidden items. Iterate because the label can wrap and change the viewport height.
  let hidden = [];
  for (let pass = 0; pass < 4; pass++) {
    for (const k of qlist.children) k.visible = true;
    hidden = [];
    let cut = false;
    for (const k of qlist.children) {
      if (!cut && relBottom(k, qlist) <= qlist.height + 0.5) continue;
      cut = true; k.visible = false;
      if (k.name.startsWith('Bucket · ')) { const b = BUCKETS.find(x => 'Bucket · ' + x.label === k.name); hidden.push(b ? `${b.label} (${b.count})` : k.name.slice(9)); }
      else if (k.name.startsWith('Row · ')) hidden.push(k.name.slice(6));
    }
    const lbl = hidden.length ? '↓ More below · ' + hidden.slice(0, 2).join(' · ') + (hidden.length > 2 ? ` +${hidden.length - 2}` : '') : '↓ Scroll for more';
    if (qc.label.characters === lbl) break;
    qc.label.characters = lbl;
  }
  const lastVis = [...qlist.children].filter(k => k.visible).pop();
  OUT.fit.queue = { hiddenBelow: hidden, lastVisibleBottom: lastVis ? Math.round(relBottom(lastVis, qlist)) : 0, viewportHeight: Math.round(qlist.height) };
  reg('queue scroll cue', qc.cue);
}

// ---------- R4 business detail ----------
// final pass (MF-05): outer column = clipped scroll viewport (FILL) + reserved scroll-cue strip below it
const Dcol = AL('R4 Business detail', 'VERTICAL', { gap: 8 });
work.appendChild(Dcol); fixedCol(Dcol, 400); fillH(Dcol);
reg('R4 detail', Dcol);
const D = AL('Detail scroll area', 'VERTICAL', { gap: 12, clip: true });
Dcol.appendChild(D); fillW(D); fillH(D);
reg('R4 scroll area', D);
const resv = I('Banner/Reservation', { State: 'Reserved by me', Size: 'Banner' }, { 'Show policy': false }, 'Reservation · Reserved by me');
D.appendChild(resv); fillW(resv);
layer(resv, 'Title', 'Reserved by you · since 10:31');
layer(resv, 'Body', 'Renews while this workspace is open; expires 10:41 if not renewed. Switching tabs does not release it.');
reg('reservation banner', resv);
const n4 = notice('Inline', 'DEC-004', 'Lease length, idle rule and Owner override are undecided; times shown are illustrative.');
D.appendChild(n4); fillW(n4);

const biz = await slotCard(D, 'Card/Section', { name: 'Business · Olive & Thyme Café', title: 'Olive & Thyme Café', subtitle: 'Café · Assigned to you', action: { label: 'Request correction', icon: 'flag' } });
reg('business card', biz.card);
for (const [num, lab] of [['+000 70 000 106', 'Main'], ['+000 70 000 116', 'Owner mobile']]) {
  const ph = I('Row/Phone', null, { Number: num, 'Show copy': true }, 'Phone · ' + lab);
  prop(nested(ph, 'Label tag'), { Label: lab });
  biz.body.appendChild(ph);
  // repair r2: the DS Spacer inside Row/Phone is 100 px tall. Instance children are never resized;
  // the row instance itself (top level) gets a fixed 40 px height and clips the empty spacer.
  try { ph.resize(ph.width, 40); ph.clipsContent = true; } catch (e) { OUT.warnings.push('Row/Phone height: ' + e.message); }
  fillW(ph); try { ph.layoutSizingVertical = 'FIXED'; } catch (e) { OUT.warnings.push('Row/Phone fixed: ' + e.message); }
}
const web = I('List/KeyValue', { Type: 'Default' }, { Key: 'Website', Value: 'oliveandthyme.example.com' }, 'Website');
biz.body.appendChild(web); fillW(web);
// final pass (MF-05): social accounts move to Business details so the call-critical card
// (phones, website) and the latest call attempt are both above the fold.

const histItems = [];
const hist = await slotCard(D, 'Card/Section', { name: 'Call history', title: 'Call history', subtitle: '3 attempts · newest first', action: { label: 'Open full history' } });
reg('call history', hist.card);
const TL = [
  { type: 'Upcoming', title: 'Follow-up due today · 10:30', time: 'Due now', body: 'Owner back from supplier visit — discuss menu website. Scheduled by Maya Khoury on 13 Oct.' },
  { type: 'Call attempt', title: 'Call attempt · Maya Khoury', time: '13 Oct, 15:10', body: 'Spoke to manager. Owner decides; call back 20 Oct morning.', out: 'Needs another call' },
  { type: 'Call attempt', title: 'Call attempt · Maya Khoury', time: '9 Oct, 11:02', body: 'No answer on main line.', out: 'On hold' },
  { type: 'Call attempt', title: 'Call attempt · Maya Khoury', time: '7 Oct, 14:25', body: 'No answer; voicemail full.', out: 'On hold', last: true },
];
for (const t of TL) {
  const it = I('Timeline/Item', { Type: t.type }, { Title: t.title, Time: t.time, Body: t.body, 'Show connector': !t.last }, 'Timeline · ' + t.time);
  if (t.out) prop(nested(it, 'Outcome'), { Outcome: t.out });
  hist.body.appendChild(it); fillW(it); histItems.push(it);
}
const histCap = await T('Each attempt is its own record; a later outcome never changes past attempts.', 'ds/Caption', 'text/muted', { w: 300 });
hist.body.appendChild(histCap); fillW(histCap);

const det = await slotCard(D, 'Card/Section', { name: 'Business details', title: 'Business details', subtitle: 'Read-only · use Request correction to fix data' });
const kvRow = (k, v) => { const kv = I('List/KeyValue', { Type: 'Default' }, { Key: k, Value: v }, 'Detail · ' + k); det.body.appendChild(kv); fillW(kv); };
kvRow('Category', 'Café');
const ig = I('Row/Social', { Metrics: 'Recorded' }, { Platform: 'Instagram', Handle: '@oliveandthyme.demo' }, 'Social · Instagram');
layer(ig, 'Metrics', '2,140 followers');
const fb = I('Row/Social', { Metrics: 'Not recorded' }, { Platform: 'Facebook', Handle: '@oliveandthyme.demo' }, 'Social · Facebook');
layer(fb, 'Metrics', 'Not recorded');
add(det.body, ig, fb); fillW(ig); fillW(fb);
for (const [k, v] of [['Extra notes', 'Family-run, two branches planned. Prefers calls after 10:00.'], ['Created by', 'Karim Saleh · 2 Oct 2026 09:14'], ['Last updated', 'Karim Saleh · 5 Oct 2026 16:40']]) kvRow(k, v);
reg('business details', det.card);
// final pass (MF-05): reserved cue strip below the viewport; then verify the LATEST ATTEMPT (histItems[1]) is fully visible.
// Fallback if not: the DEC-004 inline notice moves into the reservation banner's own policy chip (DS design).
const dc = await scrollCue(Dcol, 1, '↓ Scroll for earlier attempts and business details', 'Scroll cue · detail', true);
reg('detail scroll cue', dc.cue);
{
  const latest = histItems[1];
  const fits = () => relBottom(latest, D) <= D.height;
  OUT.fit.detail = { latestAttemptBottom: Math.round(relBottom(latest, D)), viewportHeight: Math.round(D.height), fallback: null };
  if (!fits()) {
    n4.remove();
    prop(resv, { 'Show policy': true });
    layer(resv, 'Body', 'Renews while this workspace is open; expires 10:41 if not renewed. Length, idle rule and override are pending; times are illustrative.');
    OUT.fit.detail.fallback = 'DEC-004 inline notice replaced by the banner policy chip';
    OUT.fit.detail.latestAttemptBottom = Math.round(relBottom(latest, D));
    if (!fits()) OUT.warnings.push('Latest call attempt still below the fold: ' + JSON.stringify(OUT.fit.detail));
  }
  const earlier = histItems.slice(2).filter(n => relBottom(n, D) > D.height + 0.5).length;
  dc.label.characters = earlier
    ? `↓ Scroll for ${earlier} earlier attempt${earlier > 1 ? 's' : ''} and business details`
    : '↓ Scroll for business details';
  OUT.fit.detail.earlierAttemptsBelow = earlier;
}

// ---------- R5 contact panel ----------
const P = AL('R5 Contact panel', 'VERTICAL', { fill: 'surface/default', stroke: 'border/default', radius: 'xl', clip: true });
work.appendChild(P); fixedCol(P, 376); fillH(P);
reg('R5 panel', P);
const pb = AL('Panel body', 'VERTICAL', { gap: 8, pad: [12, 16, 8, 16], clip: true });
P.appendChild(pb); fillW(pb); fillH(pb);
const ph = AL('Panel header', 'HORIZONTAL', { gap: 8, align: 'MIN' });
const pht = AL('Titles', 'VERTICAL', { gap: 2 });
add(pht, await T('Log call attempt', 'ds/H3', 'text/primary', { name: 'Title' }), await T('Attempt: 20 Oct 2026 · 10:32', 'ds/Caption', 'text/muted', { name: 'Attempt time', w: 200 }));
add(ph, pht, button('Ghost', 'Small', 'Cancel contact'));
pb.appendChild(ph); fillW(ph); grow(pht); fillW(pht.children[1]);

const ol = AL('Outcome label', 'HORIZONTAL', { gap: 6, align: 'CENTER' });
const olt = await T('Outcome *', 'ds/Label', 'text/primary', { name: 'Label' });
add(ol, olt, notice('Chip', 'D4', null, 'pending'), notice('Chip', 'DEC-005', null, 'pending'));
pb.appendChild(ol); fillW(ol); ol.primaryAxisAlignItems = 'SPACE_BETWEEN';

const OUTCOMES = [
  ['On hold — no answer', 'status/warning/solid', false],
  ['Needs another call — call later', 'status/info/solid', true],
  ['Rejected — do not call', 'status/danger/solid', false],
  ['Accepted — creates opportunity', 'status/success/solid', false],
];
function radioCard(title, dot, selected, nodeName) {
  const rc = I('RadioCard', { State: selected ? 'Selected' : 'Default' }, { Title: title, Description: ' ', 'Show status dot': true }, nodeName);
  hideLayer(rc, 'Description');
  // repair r2: compact vertical padding on the instance itself (not a child)
  for (const f of ['paddingTop', 'paddingBottom']) { try { bindF(rc, f, 'space/8', 8); } catch (e) { OUT.warnings.push('RadioCard padding: ' + e.message); } }
  const d = rc.findOne(n => n.name === 'Status dot');
  if (d && 'fills' in d) d.fills = [paint(dot)];
  return rc;
}
const og = AL('Outcome group', 'VERTICAL', { gap: 8 });
pb.appendChild(og); fillW(og);
for (const [t, dot, sel] of OUTCOMES) { const rc = radioCard(t, dot, sel, 'Outcome · ' + t.split(' — ')[0]); og.appendChild(rc); fillW(rc); }
reg('outcome group', og);

// repair r1: token frame with Card/Inset tokens but 12px padding so DS inputs keep their 320 minimum width
const fuCard = AL('Follow-up (Needs another call)', 'VERTICAL', { gap: 8, pad: 12, fill: 'surface/subtle', stroke: 'border/subtle', radius: 'lg' });
pb.appendChild(fuCard); fillW(fuCard);
const fu = { card: fuCard, body: fuCard };
reg('follow-up inset', fu.card);
// repair r2: title and short Segmented labels share one row (saves a row; fits the 320 inner width)
const fut = AL('Follow-up title', 'HORIZONTAL', { gap: 8, align: 'CENTER', justify: 'SPACE_BETWEEN' });
const futt = await T('Follow-up', 'ds/H4', 'text/primary');
const fuTabs = I('Tabs', { Style: 'Segmented', Active: '1' }, null, 'Schedule mode');
prop(nested(fuTabs, 'Tab 1'), { Label: 'Set now' }); prop(nested(fuTabs, 'Tab 2'), { Label: 'Set later' });
hideLayer(fuTabs, 'Tab 3'); hideLayer(fuTabs, 'Tab 4');
add(fut, futt, fuTabs);
fu.body.appendChild(fut); fillW(fut);
const fDate = I('Input/Date', { Type: 'Date and time', State: 'Filled' }, { Label: 'Date and time (company timezone)', Value: 'Thu 22 Oct 2026 · 11:00', Required: true, 'Show label': true, 'Show helper': false }, 'Follow-up date and time');
fu.body.appendChild(fDate); fillW(fDate);
const fPurpose = I('Input', { Type: 'Text', State: 'Filled' }, { Label: 'Purpose', Value: 'Owner back — present menu website options', 'Show label': true, Required: false, 'Show helper': false, 'Show icon': false }, 'Follow-up purpose');
fu.body.appendChild(fPurpose); fillW(fPurpose);

const notes = I('Textarea', { State: 'Filled' }, { Label: 'Notes', Value: 'Owner not in yet; manager asked for Thursday 11:00. Interested in online menu and table booking.', 'Show label': true, Required: false, 'Show helper': false, Counter: '104 / 2000' }, 'Notes');
pb.appendChild(notes); fillW(notes);

// final pass (MF-06): one primary ("Save attempt" = save + release). The secondary says exactly what it keeps.
// Ghost (spec §8.6) hugs its label; the primary fills the rest. Spec caption restored under the actions.
const pf = AL('Panel footer', 'VERTICAL', { gap: 8, pad: [12, 16], fill: 'surface/default' });
topRule(pf, 'border/default');
P.appendChild(pf); fillW(pf);
const pfRow = AL('Footer actions', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
pf.appendChild(pfRow); fillW(pfRow);
const bKeep = button('Ghost', 'Medium', 'Save, keep reservation'), bSave = button('Primary', 'Medium', 'Save attempt');
add(pfRow, bKeep, bSave); fillW(bSave);
const pfCap = await T('Reservation is released only after the save succeeds.', 'ds/Caption', 'text/muted', { name: 'Reservation caption', w: 340 });
pf.appendChild(pfCap); fillW(pfCap);
OUT.fit.footer = { keepWidth: Math.round(bKeep.width), saveWidth: Math.round(bSave.width), stacked: false };
if (bSave.width < 128) { // too tight side by side: stack (primary first), both full width
  pfRow.layoutMode = 'VERTICAL'; pfRow.insertChild(0, bSave); fillW(bSave); fillW(bKeep);
  OUT.fit.footer.stacked = true;
}
reg('save button', bSave); reg('save keep reservation button', bKeep); reg('reservation caption', pfCap);
// repair r2: the Notes field must be fully visible above the fixed footer; trim progressively if not
{
  const overflow = () => Math.round(relBottom(notes, pb) - (pb.height - pb.paddingBottom));
  OUT.fit.panel = { overflowBefore: overflow(), steps: [] };
  const steps = [
    ['Notes counter row hidden', () => hideLayer(notes, 'Helper row')],
    ['Outcome group gap 6', () => bindF(og, 'itemSpacing', 'space/6', 6)],
    ['Purpose label folded into value', () => prop(fPurpose, { 'Show label': false, Value: 'Purpose: owner back — present menu options' })],
  ];
  for (const [label, fn] of steps) { if (overflow() <= 0) break; try { fn(); OUT.fit.panel.steps.push(label); } catch (e) { OUT.warnings.push(label + ': ' + e.message); } }
  OUT.fit.panel.overflowAfter = overflow();
  if (OUT.fit.panel.overflowAfter > 0) OUT.warnings.push('Notes still clipped by ' + OUT.fit.panel.overflowAfter + ' px');
}

// =====================================================================
// COMPANION — outcome branches
// =====================================================================
const comp = AL('S3 / Outcome branches — panel detail', 'VERTICAL', { gap: 16, pad: 24, fill: 'surface/page', stroke: 'border/default', radius: 'xl' });
section.appendChild(comp); comp.x = 1600; comp.y = 80;
comp.setExplicitVariableModeForCollection(semCol, LIGHT);
OUT.created.companionFrame = comp.id;
const cTitle = await T('Outcome branches — Log call attempt panel', 'ds/H2', 'text/primary');
const cCap = await T('The four outcomes are separate choices and are not sequential. The main frame shows Needs another call; these are the other three branches of the same panel.', 'ds/Body Small', 'text/secondary', { w: 1040 });
add(comp, cTitle, cCap);
const cols = AL('Branches', 'HORIZONTAL', { gap: 16, align: 'MIN' });
comp.appendChild(cols);

async function branch(over, title, dot) {
  const col = AL('Branch — ' + title.split(' — ')[0], 'VERTICAL', { gap: 10, pad: 16, fill: 'surface/default', stroke: 'border/default', radius: 'xl' });
  cols.appendChild(col); fixedCol(col, 336);
  const o = await T(over, 'ds/Overline', 'text/muted'); col.appendChild(o);
  const rc = radioCard(title, dot, true, 'Outcome · ' + title.split(' — ')[0]); col.appendChild(rc); fillW(rc);
  return col;
}
async function capt(col, text) { const c = await T(text, 'ds/Caption', 'text/muted', { w: 300 }); col.appendChild(c); fillW(c); return c; }
function put(col, n) { col.appendChild(n); fillW(n); return n; }

// A — On hold
const bA = await branch('BRANCH A — ON HOLD', 'On hold — no answer', 'status/warning/solid');
bA.appendChild(I('Checkbox', { Checked: 'False', State: 'Default' }, { Label: 'Add a follow-up (optional)', 'Show label': true }, 'Optional follow-up'));
await capt(bA, 'Optional follow-up (D3). The business returns to the Requires contact bucket.');
reg('branch A', bA);

// B — Rejected
const bB = await branch('BRANCH B — REJECTED', 'Rejected — do not call', 'status/danger/solid');
put(bB, I('Select', { Type: 'Select', State: 'Filled' }, { Label: 'Rejection reason', Value: 'Not interested — asked not to be called again', 'Show label': true, Required: false, 'Show helper': false }, 'Rejection reason'));
put(bB, I('Banner', { Tone: 'Warning', Size: 'Inline' }, { Title: 'Removes from calling', Body: 'Saving removes this business from all calling buckets. Start Contact and new follow-ups are blocked.', 'Show title': true, 'Show action': false, 'Show close': false }, 'Rejected warning'));
bB.appendChild(await T('Open follow-ups', 'ds/Label', 'text/primary'));
for (const r of ['Cancel open follow-ups (system reason)', 'Keep open follow-ups', 'Agent chooses in this save']) bB.appendChild(I('Radio', { Selected: 'False', State: 'Disabled' }, { Label: r }, 'D4 option · ' + r));
put(bB, notice('Inline', 'D4', 'Handling of open follow-ups on Rejected is undecided; no option is preselected.'));
await capt(bB, 'Any callback-to-be-scheduled marker is cleared in the same save (B1).');
put(bB, notice('Inline', 'DEC-016', 'Who may reopen a Rejected business, and to which outcome, is undecided.'));
reg('branch B', bB);

// C — Accepted
const bC = await branch('BRANCH C — ACCEPTED', 'Accepted — creates opportunity', 'status/success/solid');
put(bC, I('Input', { Type: 'Text', State: 'Filled' }, { Label: 'Client needs', Value: 'Menu website with table booking', 'Show label': true, Required: false, 'Show helper': false, 'Show icon': false }, 'Client needs'));
put(bC, I('Select', { Type: 'Select', State: 'Filled' }, { Label: 'Service interest', Value: 'Website + booking', 'Show label': true, Required: false, 'Show helper': false }, 'Service interest'));
const devRow = AL('Developer choice', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
const devT = await T('Developer', 'ds/Label', 'text/primary');
const devTabs = I('Tabs', { Style: 'Segmented', Active: '2' }, null, 'Developer mode');
prop(nested(devTabs, 'Tab 1'), { Label: 'Assign now' }); prop(nested(devTabs, 'Tab 2'), { Label: 'Decide later' });
hideLayer(devTabs, 'Tab 3'); hideLayer(devTabs, 'Tab 4');
add(devRow, devT, devTabs); put(bC, devRow); grow(devT);
// final pass (MF-07, contract E3): deferred assignment = no assignee. Plain Select (no avatar slot), and any
// Avatar instance that a DS variant still carries is hidden (visibility override only; no x/y/size on children).
const devSel = put(bC, I('Select', { Type: 'Select', State: 'Disabled' }, { Label: 'Developer (optional)', Value: 'Not yet assigned', Placeholder: 'Not yet assigned', 'Show label': true, Required: false, 'Show helper': true, Helper: 'Shows as Developer not yet assigned to the Owner.' }, 'Developer select'));
for (const n of devSel.findAllWithCriteria({ types: ['INSTANCE'] })) {
  let isAvatar = /^avatar/i.test(n.name);
  if (!isAvatar) { try { const mc = await n.getMainComponentAsync(); isAvatar = !!mc && (mc.id === '44:358' || (mc.parent && mc.parent.id === '44:358')); } catch (e) { /* ignore */ } }
  if (isAvatar) { n.visible = false; OUT.fit.developerAvatarHidden = (OUT.fit.developerAvatarHidden || 0) + 1; }
}
reg('developer select', devSel);
bC.appendChild(I('Checkbox', { Checked: 'False', State: 'Default' }, { Label: 'Arrange meeting now (optional)', 'Show label': true }, 'Meeting optional'));
const res = await slotCard(bC, 'Card/Inset', { name: 'Result preview' });
const r1 = await T('Creates: Olive & Thyme Café — Accepted opportunity', 'ds/Body Strong', 'text/primary', { w: 260 });
const r2 = await T('Not a closed deal. If an open deal already exists: DEC-017 (undecided).', 'ds/Caption', 'text/muted', { w: 260 });
add(res.body, r1, r2); fillW(r1); fillW(r2);
put(bC, notice('Inline', 'DEC-005', 'Whether the assigned developer can open this opportunity before closure is undecided.'));
put(bC, notice('Inline', 'D4', 'Open follow-ups and the callback marker on Accepted are undecided.'));
reg('branch C', bC);

// =====================================================================
// ANNOTATIONS
// =====================================================================
const ann = AL('S3 / Annotations', 'VERTICAL', { gap: 12, pad: 24, fill: 'surface/page', stroke: 'border/default', radius: 'xl' });
section.appendChild(ann);
ann.resize(Math.max(comp.width, 1088), 100); ann.counterAxisSizingMode = 'FIXED'; ann.primaryAxisSizingMode = 'AUTO';
ann.setExplicitVariableModeForCollection(semCol, LIGHT);
OUT.created.annotationsFrame = ann.id;
ann.appendChild(await T('S3 annotations (designer notes, not product UI)', 'ds/H3', 'text/primary'));
const NOTES = [
  ['Interaction', 'Queue row → workspace', 'Selecting a row opens the business in read mode; Start Contact acquires the reservation (the frame shows the reserved state). Collapsed buckets: New assignments (Lumen Yoga Studio, Urban Cuts Barbershop) and Requires contact (Bloom Florist). Rejected businesses never appear in callable buckets (WF-REJECT-001).'],
  ['Note', 'Contact reservation (SCR-CC-005)', 'Released only after a successful save; switching tabs is not a release. Reserved by another agent, expiring, expired, offline and overridden use the other Banner/Reservation states. Duration, idle rule and override: DEC-004 pending.'],
  ['Interaction', 'Save attempt', 'Validate → one all-or-nothing save (attempt row, outcome, follow-up, D2 marker; Accepted adds one accepted opportunity) → release reservation → the business moves to buckets by its new outcome. Save, keep reservation (ghost) logs the same attempt but keeps the business reserved, to try another number. Footer caption: reservation is released only after the save succeeds.'],
  ['Note', 'Needs another call (D2)', 'Always has a follow-up or an explicit callback-to-be-scheduled marker; never silently missing. "Set later" (schedule later) sets the marker.'],
  ['Note', 'Accepted · Decide later (E3)', 'Deferred developer assignment stores no assignee: the disabled Developer field shows Not yet assigned with no avatar or name. The Owner sees Developer not yet assigned.'],
  ['Note', 'Read-only master data', 'Request correction opens the SCR-SHR-009 drawer; corrections go to Data Entry (WF-BIZ-002). Unknown social metrics show Not recorded, never invented numbers.'],
  ['Note', 'Scroll regions', 'Queue list, detail column and panel body scroll; the panel footer stays fixed. A scroll-cue strip in reserved space under each scroll viewport (never over content) names what is clipped below. Business details (with social accounts) sit below Call history; the latest attempt stays above the fold. The follow-up date must be in the future (validation message on save).'],
];
for (const [type, title, body] of NOTES) {
  const a = I('Annotation', { Type: type }, { Title: title, Body: body }, 'Annotation · ' + title);
  ann.appendChild(a); fillW(a);
}

// ---------- final sizing ----------
ann.x = 1600; ann.y = comp.y + comp.height + 40;
const W = 1600 + Math.max(comp.width, ann.width) + 80;
const H = Math.max(80 + 900 + 80, ann.y + ann.height + 80);
section.resizeWithoutConstraints(W, H);

OUT.created.regions = OUT.regions; delete OUT.regions;
OUT.bounds = { section: [section.x, section.y, section.width, section.height], main: [main.x, main.y, 1440, 900], companion: [comp.x, comp.y, comp.width, comp.height], annotations: [ann.x, ann.y, ann.width, ann.height] };
return OUT;
