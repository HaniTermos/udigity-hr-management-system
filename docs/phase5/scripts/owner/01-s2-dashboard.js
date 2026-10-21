// 01-s2-dashboard.js — Owner Screen Agent — Phase 5 (Udigity Management System)
// Phase 6 P4 (2026-10-21): Exceptions card — chips gap 4 and tuneExceptions() keep the DEC-026 chip >= 24 px above the
// card bottom (Light + Dark); returns OUT.fit['Exceptions · <theme>']. Nothing else changed.
// S2 Owner Dashboard (SCR-OWN-001), desktop 1440x900, Light + Dark, page 30 HiFi — Visual Sample (36:4).
// Spec: docs/phase5/screens/owner-sample-spec.md. DS IDs: docs/phase5/ds-ids/index.md.
// DS instances only (plus layout frames, text and chart marks bound to chart/* variables).
// Idempotent: the section is reused; the frames/captions/annotations this script owns are removed and rebuilt.
const PAGE_ID = '36:4';
const SECTION_NAME = 'S2 Owner Dashboard';
const SEM_ID = 'VariableCollectionId:40:3', LIGHT = '40:1', DARK = '40:2';
const ID = {
  shell: '49:1926', metric: '51:1842', section: '51:1780', bar: '56:2566', legend: '56:2484',
  notice: '44:549', button: '45:305', tabs: '49:1198', date: '46:594', select: '46:434', checkbox: '45:497',
  avatar: '44:358', divider: '44:364', progress: '51:1916', annotation: '44:395',
  iWarn: '44:148', iAlert: '44:153', iX: '44:168', iBan: '44:173', iDownload: '44:258',
};
const page = await figma.getNodeByIdAsync(PAGE_ID);
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
const OUT = { created: {}, updated: {}, removed: [], warnings: [], fit: {} };

// ---------- helpers ----------
function vv(n) { const v = V[n]; if (!v) throw new Error('Missing variable ' + n); return v; }
function P(n, op) { const p = figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', vv(n)); return op == null ? p : Object.assign({}, p, { opacity: op }); }
function fill(n, name, op) { n.fills = name ? [P(name, op)] : []; return n; }
function bnum(n, field, px) { const v = V['p/space/' + px]; if (v) n.setBoundVariable(field, v); else n[field] = px; }
function pad(n, px) { for (const f of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) bnum(n, f, px); }
function AL(name, dir, o) {
  o = o || {};
  const f = figma.createAutoLayout(dir || 'HORIZONTAL'); f.name = name; f.fills = [];
  if (o.gap != null) bnum(f, 'itemSpacing', o.gap);
  if (o.pad != null) pad(f, o.pad);
  if (o.align) f.counterAxisAlignItems = o.align;
  return f;
}
// fixed width, hugging height (for auto-layout frames)
function W(f, w) {
  f.resize(w, Math.max(f.height, 1));
  if (f.layoutMode === 'VERTICAL') { f.counterAxisSizingMode = 'FIXED'; f.primaryAxisSizingMode = 'AUTO'; }
  else { f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'AUTO'; }
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
function fillW(n) { n.layoutSizingHorizontal = 'FILL'; return n; }
// wrap a horizontal row that is already inside an auto-layout parent: fill width, wrap to new lines instead of clipping
function wrapRow(r, rowGap) { fillW(r); r.layoutWrap = 'WRAP'; bnum(r, 'counterAxisSpacing', rowGap == null ? 4 : rowGap); return r; }
// set a TEXT layer directly by name (for texts that are no longer property-linked in the DS); loads its fonts first
async function setText(root, name, chars) {
  const t = root.findOne(n => n.type === 'TEXT' && n.name === name);
  if (!t) { OUT.warnings.push(`text layer ${name} not found in ${root.name}`); return; }
  if (t.characters === chars) return;
  const fonts = t.fontName === figma.mixed ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName];
  for (const fn of fonts) await figma.loadFontAsync(fn);
  t.characters = chars;
}
const NODES = {};
async function node(id) { if (!NODES[id]) { NODES[id] = await figma.getNodeByIdAsync(id); if (!NODES[id]) throw new Error('DS node not found: ' + id); } return NODES[id]; }
const pv = name => Object.fromEntries(name.split(', ').map(s => s.split('=').map(x => x.trim())));
async function I(setId, variant, props, name) {
  const n = await node(setId);
  let comp = n;
  if (n.type === 'COMPONENT_SET') {
    comp = n.children.find(ch => Object.entries(variant || {}).every(([k, v]) => pv(ch.name)[k] === v));
    if (!comp) throw new Error(`No variant ${JSON.stringify(variant)} in ${n.name}`);
  }
  const inst = comp.createInstance();
  if (props) setP(inst, props);
  if (name) inst.name = name;
  return inst;
}
function setP(inst, props) {
  const cp = inst.componentProperties, o = {};
  for (const [k, v] of Object.entries(props)) {
    const key = Object.keys(cp).find(x => x === k || x.split('#')[0] === k);
    if (!key) { OUT.warnings.push(`prop ${k} not on ${inst.name}`); continue; }
    o[key] = v;
  }
  if (Object.keys(o).length) inst.setProperties(o);
  return inst;
}
function nested(root, name) { return root.findOne(n => n.type === 'INSTANCE' && n.name === name); }
function txt(root, name) { return root.findOne(n => n.type === 'TEXT' && n.name === name); }
async function icon(id, size, color) {
  const ic = (await node(id)).createInstance(); ic.name = 'Icon';
  ic.resize(size, size);
  for (const v of ic.findAllWithCriteria({ types: ['VECTOR'] })) v.strokes = [P(color)];
  return ic;
}
// Notice/Policy pending chip; title = text after the ID (null hides it)
async function chip(dec, title) {
  const c = await I(ID.notice, { Size: 'Chip', Tone: 'Policy pending' }, { DEC: dec, Body: dec + ' pending' }, 'Policy · ' + dec);
  const t = txt(c, 'Title');
  if (t) { if (title == null) t.visible = false; else t.characters = title; }
  return c;
}
async function avatar(initials) { return I(ID.avatar, { Size: 'Small', Tone: 'Neutral' }, { Initials: initials }, 'Avatar ' + initials); }

// Card/Section with fixed size, padding 16, gap 12; content goes into the native "Content" slot
async function card(parent, key, title, action, buildBody) {
  const c = await I(ID.section, null, { Title: title, 'Show subtitle': false, 'Show action': true }, 'Card · ' + key);
  parent.appendChild(c);
  c.resize(368, 271);
  c.layoutSizingHorizontal = 'FIXED'; c.layoutSizingVertical = 'FIXED';
  pad(c, 16); bnum(c, 'itemSpacing', 12);
  c.clipsContent = true;
  const act = nested(c, 'Action'); if (act) setP(act, { Label: action }); else OUT.warnings.push('Card ' + key + ': Action link not found');
  const body = await buildBody();
  const slot = c.findAllWithCriteria({ types: ['SLOT'] })[0];
  if (!slot) { OUT.warnings.push('Card ' + key + ': no SLOT; body left beside frame'); return { card: c, body }; }
  for (const k of [...slot.children]) k.remove();
  slot.appendChild(body);
  const fresh = slot.children[slot.children.length - 1];
  const cb = c.absoluteBoundingBox, bb = fresh.absoluteBoundingBox;
  if (cb && bb) {
    const over = Math.round((bb.y + bb.height) - (cb.y + cb.height - 16)); if (over > 0) OUT.warnings.push(`Card ${key}: body overflows by ${over}px`);
    // right-edge check (MF-02/03): no text, instance or mark may pass the card's inner padding edge
    const edge = cb.x + cb.width - 16;
    for (const n of fresh.findAll(n => n.type === 'TEXT' || n.type === 'INSTANCE' || n.type === 'RECTANGLE' || n.type === 'FRAME')) {
      const a = n.absoluteBoundingBox; if (!a || !n.visible) continue;
      const o = Math.round(a.x + a.width - edge); if (o > 0) { OUT.warnings.push(`Card ${key}: "${n.name}" passes the right padding by ${o}px`); break; }
    }
  }
  return { card: c, body: fresh };
}
// Final pass (MF-02/03): the Card/Section slot clips a few px inside 336, so every body and plot uses CW = 324
// (12 px spare inside the 16 px card padding). Nothing inside a card is sized wider than CW.
const CW = 324;
function bodyFrame(name, gap) { const b = AL(name, 'VERTICAL', { gap }); W(b, CW); return b; }

// ---------- content builders ----------
async function headerRow() {
  const row = AL('R1 Header & filters', 'HORIZONTAL', { gap: 12, align: 'CENTER' });
  const tg = AL('Title group', 'VERTICAL', { gap: 0 });
  add(tg, await T('Dashboard', 'ds/H1', 'text/primary', { name: 'Title' }), await T('Updated 11:20 · company time', 'ds/Caption', 'text/muted', { name: 'Meta' }));
  const sp = AL('Spacer', 'HORIZONTAL', {});
  const fl = AL('Filters', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
  const tabs = await I(ID.tabs, { Style: 'Segmented', Active: '2' }, null, 'Period');
  ['Today', '7 days', '30 days', 'Custom'].forEach((l, i) => { const t = nested(tabs, 'Tab ' + (i + 1)); if (t) { setP(t, { Label: l, 'Show count': false }); if (i === 3) t.visible = false; } });
  const date = await I(ID.date, { Type: 'Date', State: 'Filled' }, { Label: 'Date range', 'Show label': false, Value: '14–20 Oct 2026', Placeholder: 'Select dates', 'Show helper': false, Required: false }, 'Date range');
  const cmp = await I(ID.checkbox, { Checked: 'True', State: 'Default' }, { Label: 'Compare 7–13 Oct', 'Show label': true }, 'Compare');
  const role = await I(ID.select, { Type: 'Select', State: 'Filled' }, { Label: 'Role', 'Show label': false, Value: 'All roles', Placeholder: 'All roles', 'Show helper': false, Required: false }, 'Role filter');
  const emp = await I(ID.select, { Type: 'Select', State: 'Filled' }, { Label: 'Employee', 'Show label': false, Value: 'All employees', Placeholder: 'All employees', 'Show helper': false, Required: false }, 'Employee filter');
  const exp = await I(ID.button, { Variant: 'Secondary', Size: 'Medium', State: 'Default' }, { Label: 'Export', 'Show icon': true, Icon: ID.iDownload }, 'Export');
  add(fl, tabs, date, cmp, role, emp, exp);
  // Final pass (MF-01): narrower fields (each still fits its value) so Export ends inside the 24 px right padding
  for (const [n, w] of [[date, 164], [role, 108], [emp, 144]]) { n.resize(w, n.height); try { n.layoutSizingVertical = 'HUG'; } catch (e) { } }
  add(row, tg, sp, fl);
  sp.layoutGrow = 1;
  return { row, exp };
}

async function metricsRow() {
  const row = AL('R2 KPI strip', 'HORIZONTAL', { gap: 24 });
  row.resize(1152, 158); // fixed before FILL children (a hugging parent would collapse them)
  const tiles = [
    { k: 'Call attempts', trend: 'Up', p: { Label: 'Call attempts', Value: '184', Delta: '+23 vs 161 (7–13 Oct)', Caption: 'Period · 14–20 Oct' } },
    { k: 'Businesses contacted', trend: 'Up', p: { Label: 'Businesses contacted', Value: '97', Delta: '+7 vs 90 (7–13 Oct)', Caption: 'Distinct · ≠ attempts' } },
    { k: 'Accepted opportunities', trend: 'Pending', dec: 'B-1', p: { Label: 'Accepted opportunities', Value: '3', Delta: '', Caption: 'Snapshot · current stage' } },
    { k: 'Closed deals in period', trend: 'Down', p: { Label: 'Closed deals in period', Value: '1', Delta: '−1 vs 2 (7–13 Oct)', Caption: '≠ accepted · 14–20 Oct' } },
    { k: 'Development workload', trend: 'Pending', dec: 'SB-3', p: { Label: 'Development workload', Value: '3 · 5 · 12', Delta: '', Caption: 'Deals · Projects · Tasks' } },
  ];
  const ids = {};
  for (const t of tiles) {
    const m = await I(ID.metric, { Trend: t.trend }, Object.assign({ 'Show caption': true }, t.p), 'KPI · ' + t.k);
    if (t.dec) { const pol = nested(m, 'Policy'); if (pol) { setP(pol, { DEC: t.dec, Body: t.dec + ' pending' }); const tt = txt(pol, 'Title'); if (tt) tt.characters = 'Policy pending'; } else OUT.warnings.push('KPI ' + t.k + ': Policy chip not found'); }
    // DS fix 12 unlinked Value/Caption (Pending) and Delta (Down/Flat): set those layers directly
    for (const k of ['Label', 'Value', 'Delta', 'Caption']) if (t.p[k]) await setText(m, k, t.p[k]);
    row.appendChild(m);
    m.layoutSizingHorizontal = 'FILL'; m.layoutSizingVertical = 'FILL';
    ids[t.k] = m.id;
  }
  return { row, ids };
}

async function attendanceBody() {
  const b = bodyFrame('Attendance body', 8);
  const stats = AL('Stats', 'HORIZONTAL', { gap: 20 });
  for (const [v, l, col] of [['4 of 6', 'Checked in now', 'text/primary'], ['2', 'Not checked in yet', 'text/primary'], ['1', 'Missing checkout', 'status/warning/fg']]) {
    const s = AL('Stat · ' + l, 'VERTICAL', { gap: 0 });
    add(s, await T(v, 'ds/H2', col, { name: 'Value' }), await T(l, 'ds/Caption', 'text/secondary', { name: 'Label' }));
    stats.appendChild(s);
  }
  const lineA = AL('Checked in people', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
  const avA = AL('Avatars', 'HORIZONTAL', { gap: 4 });
  for (const i of ['RH', 'KS', 'MK', 'LA']) avA.appendChild(await avatar(i));
  add(lineA, avA, await T('In 08:52–09:14 · 0 checked out', 'ds/Caption', 'text/secondary', { name: 'In caption' }));
  const lineB = AL('Not checked in people', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
  const avB = AL('Avatars', 'HORIZONTAL', { gap: 4 });
  for (const i of ['ON', 'SF']) avB.appendChild(await avatar(i));
  add(lineB, avB, await T('Omar Nassar, Sami Fares · ≠ absent', 'ds/Caption', 'text/secondary', { name: 'Not in caption' }));
  const dv = await I(ID.divider, { Orientation: 'Horizontal' }, null, 'Divider');
  const pol = AL('Policy rows', 'VERTICAL', { gap: 4 });
  const chips = AL('Chips', 'HORIZONTAL', { gap: 8 });
  add(chips, await chip('DEC-007', null), await chip('DEC-008', null), await chip('DEC-022', null));
  add(pol, await T('Absent on a scheduled day: policy pending', 'ds/Body Small', 'text/secondary', { name: 'Absent row' }),
    await T('Late arrivals: policy pending', 'ds/Body Small', 'text/secondary', { name: 'Late row' }), chips);
  add(b, stats, lineA, lineB, dv, pol);
  fillW(dv);
  fillW(stats); stats.primaryAxisAlignItems = 'SPACE_BETWEEN'; // three stats spread across CW, never clipped
  wrapRow(chips);
  return b;
}

async function callingBody() {
  const b = bodyFrame('Calling body', 8);
  // Chart/Bar is a fixed 560-wide sample whose children cannot be moved in an instance:
  // the bars are drawn as marks bound to chart/* variables, with Chart/Legend instances.
  const lg = AL('Legend', 'HORIZONTAL', { gap: 16, align: 'CENTER' });
  lg.appendChild(await I(ID.legend, { Series: '1' }, { Label: 'Call attempts' }, 'Legend · Call attempts'));
  lg.appendChild(await I(ID.legend, { Series: '2' }, { Label: 'Businesses contacted (per day)' }, 'Legend · Businesses contacted'));
  const GUT = 40, PW = CW - GUT - 4, PH = 115, TOPP = 6, MAX = 60;
  const plot = figma.createFrame(); plot.name = 'Calling plot (marks bound to chart/*)'; plot.fills = []; plot.resize(CW, 147); plot.clipsContent = true;
  for (const v of [0, 15, 30, 45, 60]) {
    const y = TOPP + PH - (v / MAX) * PH;
    const g = figma.createRectangle(); g.name = 'Grid ' + v; plot.appendChild(g); g.resize(PW, 1); g.x = GUT; g.y = y; fill(g, 'chart/grid');
    const l = await T(String(v), 'ds/Caption', 'text/muted', { name: 'Y ' + v, w: 32, align: 'RIGHT' }); plot.appendChild(l); l.x = 0; l.y = y - 8;
  }
  const XL = ['14', '15', '16', '17', '18', '19', '20'];
  const A = [31, 34, 29, 12, 0, 56, 22], B = [19, 20, 16, 7, 0, 30, 13];
  const slot = PW / 7, bw = 14, total = bw * 2 + 3;
  for (let i = 0; i < 7; i++) {
    const l = await T(XL[i], 'ds/Caption', 'text/muted', { name: 'X ' + XL[i], w: Math.floor(slot), align: 'CENTER' }); plot.appendChild(l); l.x = GUT + i * slot; l.y = TOPP + PH + 6;
    [[A[i], 1], [B[i], 2]].forEach(([v, s], k) => {
      if (!v) return;
      const h = (v / MAX) * PH;
      const r = figma.createRectangle(); r.name = `Bar ${XL[i]} Oct s${s}`; plot.appendChild(r);
      r.resize(bw, h); r.x = GUT + i * slot + (slot - total) / 2 + k * (bw + 3); r.y = TOPP + PH - h;
      r.topLeftRadius = 2; r.topRightRadius = 2; fill(r, 'chart/series-' + s);
      if (i === 6) r.opacity = 0.5;
    });
  }
  const cap = await T('Oct 14–20 · 20 = today to 11:20 (lighter). Daily distinct counts sum to 105; period distinct is 97.', 'ds/Caption', 'text/muted', { name: 'Chart caption', w: CW });
  add(b, lg, plot, cap);
  wrapRow(lg); fillW(cap);
  return b;
}

async function exceptionsBody() {
  const b = bodyFrame('Exceptions body', 6);
  const rows = [
    [ID.iWarn, 'status/warning/fg', 'Missing checkout', 'Omar Nassar · Mon 19 Oct, in 09:04', 'Ghost', 'Review'],
    [ID.iX, 'status/danger/fg', 'Reminder failed', 'Peak Fitness Gym · Lina Aoun', 'Secondary', 'Send again'],
    [ID.iBan, 'status/warning/fg', 'Reminder suppressed', 'Nova Dental Clinic · Sami Fares', 'Secondary', 'Send again'],
    [ID.iAlert, 'status/danger/fg', 'Notification failed', 'Assignment changed · Omar Nassar', 'Ghost', 'View'],
  ];
  for (const [ic, col, t1, t2, bv, bl] of rows) {
    const r = AL('Exception · ' + t1, 'HORIZONTAL', { gap: 8, align: 'CENTER' });
    const tc = AL('Text', 'VERTICAL', { gap: 0 });
    const a = await T(t1, 'ds/Body Strong', 'text/primary', { name: 'Title', w: 160, truncate: 1 });
    const m = await T(t2, 'ds/Caption', 'text/muted', { name: 'Meta', w: 160, truncate: 1 });
    add(tc, a, m);
    const btn = await I(ID.button, { Variant: bv, Size: 'Small', State: 'Default' }, { Label: bl, 'Show icon': false }, 'Action · ' + bl);
    add(r, await icon(ic, 16, col), tc, btn);
    b.appendChild(r); fillW(r);
    tc.layoutGrow = 1; fillW(a); fillW(m);
    btn.layoutSizingHorizontal = 'HUG'; // the button keeps its full label; the text column gives way (truncates)
  }
  // Phase 6 P4: chip gap 4 (was 8) so both chips fit one line when the widths allow; see tuneExceptions()
  const chips = AL('Chips', 'HORIZONTAL', { gap: 4 });
  // DEC-026 sits under the Missing checkout row; ID-only chip (tight cell, spec §12) so the row fits one line
  add(chips, await chip('AR-13', 'Send again = new reminder'), await chip('DEC-026', null));
  b.appendChild(chips); wrapRow(chips);
  return b;
}

async function businessesBody() {
  const b = bodyFrame('Businesses body', 10);
  const cells = [
    ['Total businesses', '248', { chip: 'C-01' }], ['Added 14–20 Oct', '37', { text: '+8 vs 29' }],
    ['Unassigned', '18', { text: '≠ Pending' }], ['Pending', '96', null],
    ['On hold', '14', null], ['Callback requests', '11', { chip: 'B3-Q11' }],
    ['Rejected', '42', null], ['Needing corrections', '5', null],
  ];
  for (let r = 0; r < 4; r++) {
    const row = AL('Row ' + (r + 1), 'HORIZONTAL', { gap: 8 });
    b.appendChild(row); fillW(row);
    for (const [l, v, x] of cells.slice(r * 2, r * 2 + 2)) {
      const c = AL('Cell · ' + l, 'VERTICAL', { gap: 2 });
      const vr = AL('Value row', 'HORIZONTAL', { gap: 6, align: 'CENTER' });
      vr.appendChild(await T(v, 'ds/H3', 'text/primary', { name: 'Value' }));
      if (x && x.chip) vr.appendChild(await chip(x.chip, null));
      if (x && x.text) vr.appendChild(await T(x.text, 'ds/Caption', 'text/muted', { name: 'Note' }));
      add(c, await T(l, 'ds/Caption', 'text/secondary', { name: 'Label' }), vr);
      row.appendChild(c); c.layoutGrow = 1;
    }
  }
  return b;
}

async function pipelineBody() {
  const b = bodyFrame('Pipeline body', 8);
  const sum = await T('14–20 Oct: 2 accepted · 1 closed · 1 completed', 'ds/Body Small', 'text/secondary', { name: 'Period summary', w: CW });
  const lg = AL('Legend', 'HORIZONTAL', { gap: 16, align: 'CENTER' });
  // dashed style is shown by the line itself (legend label per spec §7.2)
  for (const [s, l] of [['1', 'Accepted'], ['2', 'Closed deal'], ['3', 'Project completed']]) lg.appendChild(await I(ID.legend, { Series: s }, { Label: l }, 'Legend · ' + l));
  const chips = AL('Chips', 'HORIZONTAL', { gap: 8 });
  add(chips, await chip('DEC-019', 'statuses'), await chip('DEC-018', 'revenue not shown'));
  // lay out summary, legend and chips first (wrapping rows), then shrink the plot by any extra wrapped height
  add(b, sum, lg, chips);
  wrapRow(lg); wrapRow(chips); fillW(sum);
  const one = r => Math.max(...r.children.map(k => k.height));
  const extra = Math.max(0, Math.ceil(lg.height - one(lg))) + Math.max(0, Math.ceil(chips.height - one(chips)));
  // Chart/Line has two series only: three step series are drawn as marks bound to chart/* variables
  // Final pass (MF-03): plot inset 16 px on the right; the last tick "20 Oct" is end-aligned to the plot frame edge
  const GUT = 20, PW = CW - GUT - 16, PH = 95 - extra, TOPP = 6, MAXV = 6;
  const plot = figma.createFrame(); plot.name = 'Pipeline plot (marks bound to chart/*)'; plot.fills = []; plot.resize(CW, 123 - extra); plot.clipsContent = true;
  const X = d => ((d - 1) / 19) * PW, Y = v => PH - (v / MAXV) * PH;
  const band = figma.createRectangle(); band.name = 'Selected period 14–20 Oct'; plot.appendChild(band);
  band.resize(X(20) - X(13.5) + 6, PH); band.x = GUT + X(13.5); band.y = TOPP; fill(band, 'brand/accent-subtle');
  for (const v of [0, 2, 4, 6]) {
    const g = figma.createRectangle(); g.name = 'Grid ' + v; plot.appendChild(g); g.resize(PW, 1); g.x = GUT; g.y = TOPP + Y(v); fill(g, 'chart/grid');
    const l = await T(String(v), 'ds/Caption', 'text/muted', { name: 'Y ' + v, w: 16, align: 'RIGHT' }); plot.appendChild(l); l.x = 0; l.y = TOPP + Y(v) - 8;
  }
  for (const [d, lab] of [[1, '1 Oct'], [5, '5'], [10, '10'], [15, '15'], [20, '20 Oct']]) {
    const l = await T(lab, 'ds/Caption', 'text/muted', { name: 'X ' + lab, w: 48, align: d === 20 ? 'RIGHT' : d === 1 ? 'LEFT' : 'CENTER' }); plot.appendChild(l);
    l.x = d === 20 ? CW - 48 : d === 1 ? GUT : GUT + X(d) - 24; l.y = TOPP + PH + 4;
  }
  const SER = [
    ['Accepted', 'chart/series-1', [[2, 1], [6, 2], [9, 3], [13, 4], [15, 5], [19, 6]], null],
    ['Closed deal', 'chart/series-2', [[7, 1], [12, 2], [16, 3]], null],
    ['Project completed', 'chart/series-3', [[8, 1], [16, 2]], [4, 3]],
  ];
  for (const [name, col, ev, dash] of SER) {
    let d = `M${X(1).toFixed(1)} ${Y(0).toFixed(1)}`;
    for (const [day, v] of ev) d += ` H${X(day).toFixed(1)} V${Y(v).toFixed(1)}`;
    d += ` H${X(20).toFixed(1)}`;
    const svg = figma.createNodeFromSvg(`<svg width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${d}" stroke="#000000" stroke-width="2" stroke-linejoin="round"/></svg>`);
    svg.name = 'Series · ' + name; svg.fills = []; plot.appendChild(svg); svg.x = GUT; svg.y = TOPP; svg.clipsContent = false;
    for (const v of svg.findAllWithCriteria({ types: ['VECTOR'] })) { v.strokes = [P(col)]; v.strokeWeight = 2; if (dash) v.dashPattern = dash; }
  }
  b.insertChild(2, plot);
  return b;
}

async function targetsBody() {
  const b = bodyFrame('Targets body', 10);
  const chips = AL('Chips', 'HORIZONTAL', { gap: 8 });
  add(chips, await chip('DEC-020', 'pending'), await chip('DEC-025', 'pending'));
  b.appendChild(chips); wrapRow(chips);
  const bars = AL('Bars', 'VERTICAL', { gap: 10 });
  b.appendChild(bars); fillW(bars);
  // labels are drawn as a fill-width row (label grows and truncates, value hugs) so the value is never clipped;
  // the DS Progress/Bar shows the track and fill only
  for (const [l, v, pct] of [['Karim Saleh — businesses added', '6 / 10', 0.6], ['Maya Khoury — call attempts', '22 / 40', 0.55], ['Omar Nassar — call attempts', '0 / 40 (not in yet)', 0]]) {
    const who = l.split(' —')[0];
    const g = AL('Target · ' + who, 'VERTICAL', { gap: 6 });
    bars.appendChild(g); fillW(g);
    const top = AL('Labels', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
    g.appendChild(top); fillW(top);
    const lt = await T(l, 'ds/Body Small', 'text/secondary', { name: 'Label', w: 160, truncate: 1 });
    const vt = await T(v, 'ds/Label Small', 'text/primary', { name: 'Value' });
    add(top, lt, vt); vt.textAutoResize = 'WIDTH_AND_HEIGHT'; lt.layoutGrow = 1; fillW(lt);
    // Final pass: no size is set on instance children. The bar is drawn from the DS Progress/Bar paints
    // (Track = surface/sunken, Fill = tone), copied with their variable bindings, CW wide.
    const pb = await I(ID.progress, { Tone: 'Brand' }, { Label: l, Value: v, 'Show labels': false }, 'tmp');
    const tr = pb.findOne(n => n.name === 'Track'), fl = pb.findOne(n => n.name === 'Fill');
    const H = tr ? tr.height : 8;
    const bar = figma.createFrame(); bar.name = 'Progress · ' + who + ' (Progress/Bar tokens)'; bar.resize(CW, H); bar.cornerRadius = H / 2; bar.clipsContent = true;
    bar.fills = tr ? JSON.parse(JSON.stringify(tr.fills)) : [P('surface/sunken')];
    if (pct > 0 && fl) {
      const r = figma.createRectangle(); r.name = 'Fill ' + Math.round(pct * 100) + '%'; bar.appendChild(r);
      r.resize(Math.round(CW * pct), H); r.cornerRadius = H / 2;
      r.fills = JSON.parse(JSON.stringify(fl.fills));
    }
    if (!tr || !fl) OUT.warnings.push('Progress/Bar Track/Fill not found (' + who + ')');
    pb.remove();
    g.appendChild(bar); fillW(bar);
  }
  const foot = await T('Counted by action timestamp (A2). What counts: DEC-020; daily cadence: DEC-025. No overall % shown.', 'ds/Caption', 'text/muted', { name: 'Targets caption', w: CW });
  b.appendChild(foot); fillW(foot);
  return b;
}

// Phase 6 P4: the DEC-026 chip must clear the Exceptions card bottom edge by >= 24 px (16 px card padding + 8 px).
// The card height is fixed (row R3 = 271), so the exception-row gap steps 6 -> 4 -> 2 until the chips clear it.
function tuneExceptions(label, cardNode, body) {
  const chips = body.findOne(n => n.name === 'Chips');
  if (!chips) { OUT.warnings.push(label + ': Exceptions chips row not found (P4)'); return; }
  const clear = () => { const cb = cardNode.absoluteBoundingBox, kb = chips.absoluteBoundingBox; return Math.round(cb.y + cb.height - (kb.y + kb.height)); };
  let gap = 6, c = clear();
  while (c < 24 && gap > 2) { gap -= 2; bnum(body, 'itemSpacing', gap); c = clear(); }
  const one = Math.max(...chips.children.map(k => k.height));
  OUT.fit['Exceptions · ' + label] = { chipBottomClearance: c, rowGap: gap, chipLines: chips.height > one * 1.5 ? 2 : 1, target: 24 };
  OUT.warnings = OUT.warnings.filter(w => w.indexOf('Card Exceptions: body overflows') !== 0);
  if (c < 16) OUT.warnings.push(`${label}: DEC-026 chip still inside the card padding (clearance ${c}px)`);
  else if (c < 24) OUT.warnings.push(`${label}: DEC-026 chip clearance ${c}px (< 24 target, clear of the 16 px padding)`);
}

// ---------- screen ----------
async function buildScreen(label, modeId, x, sec) {
  const ids = {};
  const f = figma.createFrame();
  f.name = `S2 — SCR-OWN-001 Owner dashboard — Desktop 1440 — ${label}`;
  sec.appendChild(f); f.resize(1440, 900); f.x = x; f.y = 80; f.clipsContent = true;
  fill(f, 'surface/page');
  f.setExplicitVariableModeForCollection(semCol, modeId);
  ids.frame = f.id;
  // shell
  const shell = await I(ID.shell, { Role: 'Owner' }, null, 'Shell/Desktop · Owner');
  f.appendChild(shell); shell.x = 0; shell.y = 0; ids.shell = shell.id;
  const top = nested(shell, 'TopBar');
  if (top) {
    setP(top, { Name: 'Rana Haddad', Role: 'Owner/Admin', 'Show attendance': true, 'Show search': true });
    const att = nested(top, 'Attendance'); if (att) setP(att, { Label: 'Checked in · 08:52' });
    const se = nested(top, 'Search'); if (se) setP(se, { Placeholder: 'Search businesses and employees', Value: '' });
    const bell = nested(top, 'Notifications'); if (bell) setP(bell, { 'Show dot': true });
    const av = nested(top, 'Avatar'); if (av) setP(av, { Initials: 'RH' });
  } else OUT.warnings.push('TopBar not found in shell');
  const sb = nested(shell, 'Sidebar');
  if (sb) {
    for (const l of ['Dashboard', 'Attendance', 'Employees', 'Targets & Work Lists', 'Businesses', 'Correction Requests', 'Categories', 'Calling Assignments', 'Follow-ups & Calendar', 'Deals & Meetings', 'Projects', 'Reports & Exports', 'Audit Log', 'Delivery Monitor', 'Settings', 'My Day (check in)', 'My Profile']) {
      const it = nested(sb, 'Nav/Item · ' + l); if (!it) { OUT.warnings.push('Nav item not found: ' + l); continue; }
      setP(it, { Label: l });
      if (l === 'Delivery Monitor') { setP(it, { 'Show badge': true }); const bd = nested(it, 'Badge'); if (bd) setP(bd, { Count: '4' }); }
    }
  } else OUT.warnings.push('Sidebar not found in shell');
  // content frame
  const cf = AL('Content · Owner dashboard', 'VERTICAL', { gap: 12, pad: 24 });
  f.appendChild(cf); cf.resize(1200, 836); cf.x = 240; cf.y = 64;
  const gs = GS['ds/Grid/Desktop content 12-col']; if (gs) await cf.setGridStyleIdAsync(gs.id); else OUT.warnings.push('Grid style missing');
  ids.content = cf.id;
  const h = await headerRow(), r1 = h.row; cf.appendChild(r1); r1.resize(1152, 48); fillW(r1); r1.layoutSizingVertical = 'FIXED'; ids.r1 = r1.id;
  { const rb = r1.absoluteBoundingBox, eb = h.exp.absoluteBoundingBox; if (rb && eb) { const o = Math.round(eb.x + eb.width - (rb.x + rb.width)); if (o > 0) OUT.warnings.push(`${label}: Export passes the header edge by ${o}px`); } }
  const m = await metricsRow(); cf.appendChild(m.row); m.row.resize(1152, 158); fillW(m.row); m.row.layoutSizingVertical = 'FIXED'; ids.r2 = m.row.id; ids.kpi = m.ids;
  ids.cards = {};
  const r3 = AL('R3 Attendance · Calling · Exceptions', 'HORIZONTAL', { gap: 24 });
  cf.appendChild(r3); r3.resize(1152, 271); fillW(r3); r3.layoutSizingVertical = 'FIXED'; ids.r3 = r3.id;
  for (const [k, t, a, fn] of [['Attendance', 'Attendance today', 'Open attendance', attendanceBody], ['Calling', 'Calling activity · 14–20 Oct', 'Open report', callingBody], ['Exceptions', 'Exceptions · 4', 'Delivery monitor', exceptionsBody]]) {
    const c = await card(r3, k, t, a, fn); ids.cards[k] = { card: c.card.id, body: c.body.id };
    if (k === 'Exceptions') tuneExceptions(label, c.card, c.body);
  }
  const r4 = AL('R4 Businesses · Pipeline · Targets', 'HORIZONTAL', { gap: 24 });
  cf.appendChild(r4); r4.resize(1152, 271); fillW(r4); r4.layoutSizingVertical = 'FIXED'; ids.r4 = r4.id;
  for (const [k, t, a, fn] of [['Businesses', 'Businesses · now', 'Open list', businessesBody], ['Pipeline', 'Pipeline events · October', 'Deals & meetings', pipelineBody], ['Targets', 'Targets · today', 'Targets & work lists', targetsBody]]) {
    const c = await card(r4, k, t, a, fn); ids.cards[k] = { card: c.card.id, body: c.body.id };
  }
  return ids;
}

// ---------- section (reuse) and rebuild of owned nodes ----------
let sec = page.children.find(n => n.type === 'SECTION' && n.name === SECTION_NAME);
if (!sec) { sec = figma.createSection(); sec.name = SECTION_NAME; page.appendChild(sec); OUT.created.section = sec.id; }
else OUT.updated.section = sec.id;
sec.x = 3400; sec.y = 0; // orchestrator placement (other sections occupy y 2400+)
const OWNED = /^(S2 — |S2 caption|S2 annotations)/;
for (const c of [...sec.children]) if (OWNED.test(c.name)) { OUT.removed.push(c.name); c.remove(); }
sec.resizeWithoutConstraints(3120, 1300);

for (const [label, x] of [['Light', 80], ['Dark', 1600]]) {
  const cap = await T(`${label} · 1440×900 · SCR-OWN-001 Owner dashboard`, 'ds/H4', 'text/secondary', { name: 'S2 caption · ' + label });
  sec.appendChild(cap); cap.x = x; cap.y = 44;
  OUT.created['caption ' + label] = cap.id;
}
OUT.created.light = await buildScreen('Light', LIGHT, 80, sec);
OUT.created.dark = await buildScreen('Dark', DARK, 1600, sec);

// designer annotations (not product UI) — apply to both frames
const ann = AL('S2 annotations', 'HORIZONTAL', { gap: 24 });
sec.appendChild(ann); ann.x = 80; ann.y = 1020;
const NOTES = [
  ['Interaction', 'N1 — Period, compare, filters', 'Today / 7 days / 30 days, the date range and Compare update every period metric. Snapshot tiles ignore the period. Export opens Reports & Exports (synchronous, ADR-010).'],
  ['Note', 'N2 — G1 distinctions', 'Attempts ≠ businesses contacted; accepted ≠ closed ≠ completed project; not checked in yet ≠ absent. Missing policy values read "policy pending", never 0 (WF-REPORT-001 D2).'],
  ['Note', 'N3 — Accepted opportunities (B-1)', 'Deals currently in stage Accepted opportunity: Peak Fitness Gym, Lumen Yoga Studio, Nova Dental Clinic. Excludes Signed, Paid, Closed deal and Not proceeding. Not a calling-outcome count.'],
  ['Note', 'N4 — Development workload (SB-3, Proposed)', 'Lina Aoun 2 · 4 · 7; Sami Fares 1 · 1 · 5. Deals = non-terminal deals assigned; Projects = Scheduled, In progress, Waiting for client, Blocked; Tasks = open tasks. Never summed.'],
  ['Interaction', 'N5 — Exceptions', 'Review opens the OWN-004 exception detail. Send again creates a new reminder; the failed one stays failed (AR-13). Notifications have no Send again: View opens the Delivery Monitor.'],
  ['Note', 'N6 — Calling chart', '20 Oct is today (to 11:20), drawn lighter. Daily distinct counts sum to 105; the period distinct count is 97 because some businesses were called on more than one day.'],
];
OUT.created.annotations = { row: ann.id };
for (const [type, title, body] of NOTES) {
  const a = await I(ID.annotation, { Type: type }, { Title: title, Body: body }, 'Annotation · ' + title.split(' —')[0]);
  ann.appendChild(a); OUT.created.annotations[title.split(' —')[0]] = a.id;
}
return OUT;
