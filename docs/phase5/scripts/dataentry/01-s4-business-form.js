// 01-s4-business-form.js — Data Entry Screen Agent — Phase 5 (Udigity Management System)
// Builds section "S4 Business Form" on page 30 HiFi — Visual Sample (36:4); placed at x=0, y=3600 on first creation only:
//   F1 Create business — inline validation · F2 Create business — duplicate blocked (visible match)
//   F3 Edit business — save conflict · N1 annotation (hidden-match variant, policies, interactions)
// Spec: docs/phase5/screens/dataentry-sample-spec.md. DS instances only; fills bound to Semantic variables.
// Idempotent: if the section exists, its children are removed and rebuilt (the section ID and position stay).
// Phase 6 P2/P3 (2026-10-21): readable DEC-003 pending copy in the hidden-match dialog; shadow no longer clipped.
// Every visible text of every instance is set explicitly (DS defect: TEXT-property defaults show placeholders).
const PAGE_ID = '36:4';
const SECTION_NAME = 'S4 Business Form';
const SEM_ID = 'VariableCollectionId:40:3', LIGHT_MODE = '40:1';
const CID = {
  'Shell/Desktop': '49:1926', 'Breadcrumb': '49:1006', 'Card/Section': '51:1780', 'Card/Inset': '51:1797',
  'Input': '45:796', 'Select': '46:434', 'Input/Date': '46:594', 'Textarea': '45:847', 'Field/Metric': '45:891',
  'Checkbox': '45:497', 'Button': '45:305', 'IconButton': '45:405', 'Link': '45:441',
  'Notice/Policy pending': '44:549', 'Badge/Status': '44:435', 'Badge/Flag': '44:491',
  'Banner': '53:1960', 'Banner/ErrorSummary': '53:1964', 'Overlay/Scrim': '53:1814', 'Dialog': '53:1818',
  'List/KeyValue': '51:1888', 'Placeholder/Box': '44:368', 'Annotation': '44:395',
};
const ICONS = { trash: '44:268', plus: '44:58' };

// ---------- setup ----------
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const semCol = await figma.variables.getVariableCollectionByIdAsync(SEM_ID);
if (!semCol) throw new Error('Semantic collection ' + SEM_ID + ' not found');
const V = {};
for (const v of await figma.variables.getLocalVariablesAsync()) {
  if (v.variableCollectionId === SEM_ID) V[v.name] = v; else V['p/' + v.name] = v;
}
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const GS = {}; for (const s of await figma.getLocalGridStylesAsync()) GS[s.name] = s;
const SET = {};
const missing = [];
await Promise.all(Object.entries(CID).map(async ([k, id]) => { const n = await figma.getNodeByIdAsync(id); if (!n) missing.push(k + ' ' + id); else SET[k] = n; }));
if (missing.length) throw new Error('DS components not found: ' + missing.join(', '));
const W = [];
const R = { created: {}, updated: {}, warnings: W, checks: {} };

// ---------- helpers ----------
function vv(n) { const v = V[n]; if (!v) throw new Error('Missing variable ' + n); return v; }
function P(n) { return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', vv(n)); }
function bnum(n, f, x) { const v = V['p/space/' + x]; if (v) { try { n.setBoundVariable(f, v); return; } catch (e) { } } n[f] = x; }
function pad(n, t, r, b, l) { bnum(n, 'paddingTop', t); bnum(n, 'paddingRight', r); bnum(n, 'paddingBottom', b); bnum(n, 'paddingLeft', l); }
function gap(n, g) { bnum(n, 'itemSpacing', g); }
function AL(name, dir, g, align) {
  const f = figma.createAutoLayout(dir || 'HORIZONTAL'); f.name = name; f.fills = [];
  if (g != null) gap(f, g);
  if (align) f.counterAxisAlignItems = align;
  return f;
}
async function T(chars, style, color, w, name) {
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Regular' };
  t.characters = chars;
  if (!TS[style]) throw new Error('Missing text style ' + style);
  await t.setTextStyleIdAsync(TS[style].id);
  t.fills = [P(color)];
  t.name = name || chars.slice(0, 40);
  if (w) { t.textAutoResize = 'HEIGHT'; t.resize(w, Math.max(t.height, 1)); }
  return t;
}
const pv = s => Object.fromEntries(s.split(', ').map(x => x.split('=').map(y => y.trim())));
function I(name, vp, tx, bo) {
  const n = SET[name]; let c = n;
  if (n.type === 'COMPONENT_SET') {
    c = n.children.find(ch => Object.entries(vp || {}).every(([k, v]) => pv(ch.name)[k] === v));
    if (!c) throw new Error('No variant ' + JSON.stringify(vp) + ' in ' + name);
  }
  const inst = c.createInstance();
  props(inst, tx); props(inst, bo);
  return inst;
}
function props(inst, o) {
  if (!inst || !o) return inst;
  const cp = inst.componentProperties, upd = {}, empty = [];
  for (const [k, v] of Object.entries(o)) {
    const key = Object.keys(cp).find(x => x === k || x.split('#')[0] === k);
    if (!key) { W.push('prop ' + k + ' not on ' + inst.name); continue; }
    if (v === '') empty.push(key); else upd[key] = v;
  }
  if (Object.keys(upd).length) inst.setProperties(upd);
  for (const key of empty) { try { inst.setProperties({ [key]: '' }); } catch (e) { inst.setProperties({ [key]: ' ' }); } }
  return inst;
}
function findI(root, name) { return root.findOne(n => n.type === 'INSTANCE' && n.name === name); }
function slotOf(inst, name) {
  const s = inst.findAllWithCriteria({ types: ['SLOT'] }).find(n => n.name === (name || 'Content'));
  if (!s) throw new Error('Slot ' + (name || 'Content') + ' not found in ' + inst.name);
  for (const c of [...s.children]) c.remove();
  return s;
}
function put(parent, node, fill) {
  parent.appendChild(node);
  const n = parent.children[parent.children.length - 1];
  if (fill) n.layoutSizingHorizontal = 'FILL';
  return n;
}

// ---------- DS instance factories (all visible texts set) ----------
function input(type, state, o) {
  const tx = { Label: o.label };
  if (state === 'Default') tx.Placeholder = o.placeholder || ''; else tx.Value = o.value;
  if (state === 'Error') tx['Error message'] = o.error; else if (o.helper) tx.Helper = o.helper;
  if (type === 'Phone') tx['Country code'] = '+000';
  return I('Input', { Type: type, State: state }, tx, { 'Show label': true, Required: !!o.required, 'Show helper': state === 'Error' || !!o.helper, 'Show icon': false });
}
function select(label, value) {
  return I('Select', { Type: 'Select', State: 'Filled' }, { Label: label, Value: value }, { 'Show label': true, Required: true, 'Show helper': false });
}
function dateIn(o) {
  return I('Input/Date', { Type: 'Date', State: o.unknown ? 'Disabled' : 'Filled' }, { Label: 'Last post', Value: o.unknown ? 'Unknown' : o.v }, { 'Show label': true, Required: true, 'Show helper': false });
}
function metric(o) {
  const st = o.err ? 'Empty error' : o.unknown ? 'Unknown' : 'Value';
  const tx = { Label: 'Followers' };
  if (st === 'Empty error') { tx.Placeholder = 'Enter a number'; tx['Error message'] = o.err; } else tx.Value = o.unknown ? 'Unknown' : o.v;
  const m = I('Field/Metric', { State: st }, tx, { 'Show label': true, Required: true, 'Show helper': !!o.err });
  props(findI(m, 'Unknown checkbox'), { Label: 'Unknown' });
  return m;
}
function checkbox(label, checked, disabled) {
  return I('Checkbox', { Checked: checked ? 'True' : 'False', State: disabled ? 'Disabled' : 'Default' }, { Label: label }, { 'Show label': true });
}
function btn(variant, label, size, icon) {
  const b = I('Button', { Variant: variant, Size: size || 'Medium', State: 'Default' }, { Label: label }, { 'Show icon': !!icon });
  if (icon) props(b, { Icon: ICONS[icon] });
  b.name = label; return b;
}
function iconBtn(icon, disabled, size) {
  const b = I('IconButton', { Variant: 'Ghost', Size: size || 'Medium', State: disabled ? 'Disabled' : 'Default' }, { Icon: ICONS[icon] }, { 'Show dot': false });
  b.name = disabled ? 'Remove (disabled)' : 'Remove'; return b;
}
function linkI(label, size) { const l = I('Link', { Size: size || 'Small', State: 'Default' }, { Label: label }, { 'Show icon': false }); l.name = label; return l; }
function chip(dec) { const c = I('Notice/Policy pending', { Size: 'Chip', Tone: 'Policy pending' }, { DEC: dec }); c.name = 'Policy · ' + dec; return c; }
function notice(size, dec, body) { const c = I('Notice/Policy pending', { Size: size, Tone: 'Policy pending' }, { DEC: dec, Body: body }); c.name = 'Policy · ' + dec; return c; }
function kv(k, v) { const n = I('List/KeyValue', { Type: 'Default' }, { Key: k, Value: v }); n.name = 'KV · ' + k; return n; }
function card(parent, title, action) {
  const c = I('Card/Section', null, { Title: title }, { 'Show subtitle': false, 'Show action': !!action });
  c.name = 'Card · ' + title;
  const n = put(parent, c, true);
  if (action) props(findI(n, 'Action'), { Label: action });
  return { inst: n, slot: slotOf(n) };
}
function inset(parent, name) {
  const c = I('Card/Inset'); c.name = name;
  const n = put(parent, c, true);
  return { inst: n, slot: slotOf(n) };
}
// right-hand control (icon button / checkbox) aligned to the 40px input control below a 20px label + 6px gap
function alignWrap(node) {
  const w = AL('Align · ' + node.name, 'VERTICAL', 0);
  w.appendChild(node);
  w.paddingTop = Math.max(0, Math.round(26 + (40 - node.height) / 2));
  return w;
}

// ---------- shell ----------
const NAV = ['My Day', 'My Attendance', 'Businesses', 'Add Business', 'Correction Requests', 'Categories [DEC-015]', 'My Profile'];
function shell(frame, active) {
  const sh = I('Shell/Desktop', { Role: 'Data Entry' }); sh.name = 'Shell · Data Entry';
  frame.appendChild(sh); sh.x = 0; sh.y = 0;
  const tb = findI(sh, 'TopBar');
  if (tb) {
    props(tb, { Name: 'Karim Saleh', Role: 'Data Entry', 'Show attendance': true, 'Show search': true });
    props(findI(tb, 'Avatar'), { Initials: 'KS' });
    props(findI(tb, 'Search'), { Placeholder: 'Search businesses, phones, handles' });
    props(findI(tb, 'Attendance'), { Label: 'Checked in · 08:51' });
  } else W.push('TopBar not found in shell');
  const sb = findI(sh, 'Sidebar');
  if (sb) {
    for (const l of NAV) { const it = findI(sb, 'Nav/Item · ' + l); if (it) props(it, { Label: l, State: l === active ? 'Active' : 'Default' }); else W.push('nav item missing: ' + l); }
    const secs = sb.findAll(n => n.type === 'INSTANCE' && n.name === 'Nav/SectionLabel');
    ['MY WORK', 'BUSINESSES'].forEach((l, i) => { if (secs[i]) props(secs[i], { Label: l }); });
  } else W.push('Sidebar not found in shell');
  return sh;
}

// ---------- screen frame ----------
let section = page.children.find(n => n.type === 'SECTION' && n.name === SECTION_NAME);
// Phase 6 lesson 3: the position is set only when the section is first created (the orchestrator owns page layout).
if (section) { for (const c of [...section.children]) c.remove(); R.updated.section = section.id; }
else { section = figma.createSection(); section.name = SECTION_NAME; page.appendChild(section); section.x = 0; section.y = 3600; R.created.section = section.id; }

function screen(name, x, y) {
  const f = figma.createFrame(); section.appendChild(f);
  f.name = name; f.resize(1440, 900); f.x = x; f.y = y;
  f.fills = [P('surface/page')]; f.clipsContent = true;
  f.setExplicitVariableModeForCollection(semCol, LIGHT_MODE);
  return f;
}

async function buildForm(frame, D) {
  shell(frame, D.activeNav);
  const ct = figma.createFrame(); frame.appendChild(ct);
  ct.name = 'Content'; ct.fills = []; ct.layoutMode = 'VERTICAL';
  ct.resize(1200, 836); ct.primaryAxisSizingMode = 'FIXED'; ct.counterAxisSizingMode = 'FIXED';
  ct.x = 240; ct.y = 64; pad(ct, 24, 24, 16, 24); gap(ct, 16); ct.clipsContent = true;
  if (GS['ds/Grid/Desktop content 12-col']) await ct.setGridStyleIdAsync(GS['ds/Grid/Desktop content 12-col'].id);

  // header
  const head = put(ct, AL('Page header', 'HORIZONTAL', 24, 'MIN'), true);
  const titles = AL('Titles', 'VERTICAL', 4);
  head.appendChild(titles); titles.layoutGrow = 1;
  const bc = I('Breadcrumb', null, { 'Level 1': 'Businesses', 'Level 2': D.bc[1] || ' ', Current: D.bc[2] }, { 'Show level 2': !!D.bc[1] });
  titles.appendChild(bc);
  titles.appendChild(await T(D.title, 'ds/H1', 'text/primary', null, 'H1'));
  const sub = AL('Duplicate note', 'HORIZONTAL', 8, 'CENTER');
  sub.appendChild(await T(D.sub, 'ds/Body Small', 'text/secondary', D.errors ? 380 : 640, 'Sub-line'));
  sub.appendChild(chip('DEC-003'));
  titles.appendChild(sub);
  if (D.errors) {
    const es = I('Banner/ErrorSummary', null, { Title: D.errors.title });
    es.name = 'Error summary'; es.resize(564, es.height);
    head.appendChild(es);
    const list = es.findAllWithCriteria({ types: ['SLOT'] }).find(n => n.name === 'Errors');
    const links = list ? list.children.filter(n => n.type === 'INSTANCE') : [];
    D.errors.items.forEach((t, i) => { if (links[i]) props(links[i], { Label: t }); else W.push('error summary link missing ' + i); });
    links.slice(D.errors.items.length).forEach(l => { l.visible = false; });
    R.created[D.key + ' · Error summary'] = es.id;
  }
  if (D.footer.history) head.appendChild(linkI('View edit history', 'Medium'));
  if (D.conflict) {
    const b = I('Banner', { Tone: 'Warning', Size: 'Default' }, { Title: D.conflict.title, Body: D.conflict.body }, { 'Show title': true, 'Show action': true, 'Show close': false });
    b.name = 'Save conflict banner';
    const bn = put(ct, b, true);
    props(findI(bn, 'Action'), { Label: D.conflict.action });
    R.created[D.key + ' · Conflict banner'] = bn.id;
  }

  // body: three columns 270 | 270 | 564
  const body = put(ct, AL('Body', 'HORIZONTAL', 24, 'MIN'), true);
  body.layoutSizingVertical = 'FILL'; body.clipsContent = true;
  const cols = [270, 270, 564].map((w, i) => { const c = AL('Column ' + 'ABC'[i], 'VERTICAL', 16); body.appendChild(c); c.resize(w, 100); c.layoutSizingVertical = 'HUG'; return c; });

  // Column A — Business details
  const A = card(cols[0], 'Business details');
  put(A.slot, input('Text', 'Filled', { label: 'Business name', value: D.name, required: true, helper: 'Name and phones are used to find duplicates.' }), true);
  put(A.slot, chip('DEC-013'));
  put(A.slot, select('Category', D.category), true);
  put(A.slot, linkI('Suggest a new category'));
  put(A.slot, chip('DEC-015'));
  put(A.slot, checkbox('Has website', D.website.checked));
  if (D.website.checked) put(A.slot, D.website.err
    ? input('URL', 'Error', { label: 'Website address', value: '', required: true, error: D.website.err })
    : input('URL', 'Filled', { label: 'Website address', value: D.website.value, required: true }), true);

  // Column B — Phone numbers + Notes
  const B = card(cols[1], 'Phone numbers', 'Add phone');
  put(B.slot, chip('B2'));
  D.phones.forEach((p, i) => {
    const row = put(B.slot, AL('Phone row ' + (i + 1), 'HORIZONTAL', 8, 'MIN'), true);
    const inp = put(row, p.err ? input('Phone', 'Error', { label: 'Phone ' + (i + 1), value: p.v, error: p.err }) : input('Phone', 'Filled', { label: 'Phone ' + (i + 1), value: p.v }), true);
    inp.name = 'Phone ' + (i + 1);
    row.appendChild(alignWrap(iconBtn('trash', false)));
  });
  const N = card(cols[1], 'Notes', D.notes.action || null);
  if (D.notes.flag) put(N.slot, I('Badge/Flag', { Tone: 'Warning' }, { Label: D.notes.flag }));
  const ta = I('Textarea', { State: 'Filled' }, { Label: 'Notes', Value: D.notes.value, Helper: D.notes.helper, Counter: D.notes.value.length + ' / 2000' }, { 'Show label': false, Required: false, 'Show helper': true });
  ta.name = 'Notes';
  put(N.slot, ta, true);

  // Column C — Social accounts
  const S = card(cols[2], 'Social accounts', 'Add account');
  const cr = put(S.slot, AL('Rule row', 'HORIZONTAL', 8, 'CENTER'), true);
  cr.appendChild(await T('At least one account is required.', 'ds/Body Small', 'text/secondary', null, 'Rule'));
  cr.appendChild(chip('DEC-014/023'));
  D.social.forEach((s, i) => {
    const X = inset(S.slot, 'Account ' + (i + 1) + ' · ' + s.platform);
    const r1 = put(X.slot, AL('Identity row', 'HORIZONTAL', 12, 'MIN'), true);
    put(r1, select('Platform', s.platform), true);
    put(r1, input('Text', 'Filled', { label: 'Handle or link', value: s.handle, required: true }), true);
    r1.appendChild(alignWrap(iconBtn('trash', !s.removable)));
    const r2 = put(X.slot, AL('Metrics row', 'HORIZONTAL', 12, 'MIN'), true);
    put(r2, metric(s.followers), true);
    const dg = put(r2, AL('Last post group', 'HORIZONTAL', 12, 'MIN'), true);
    put(dg, dateIn(s.last), true);
    dg.appendChild(alignWrap(checkbox('Unknown', !!s.last.unknown)));
  });

  // footer action bar
  const ft = put(ct, AL('Footer actions', 'HORIZONTAL', 12, 'CENTER'), true);
  ft.fills = [P('surface/default')]; ft.strokes = [P('border/default')]; ft.strokeWeight = 1; ft.cornerRadius = 12; pad(ft, 12, 16, 12, 16);
  const attr = AL('Attribution', 'VERTICAL', 0, 'MIN');
  ft.appendChild(attr); attr.layoutGrow = 1;
  const lines = Array.isArray(D.footer.attribution) ? D.footer.attribution : [D.footer.attribution];
  for (const l of lines) attr.appendChild(await T(l, lines.length > 1 ? 'ds/Caption' : 'ds/Body Small', 'text/secondary', null, 'Attribution'));
  ft.appendChild(await T(D.footer.status, 'ds/Label', D.footer.tone, null, 'Save status'));
  if (D.footer.ghost) ft.appendChild(btn('Ghost', D.footer.ghost));
  ft.appendChild(btn('Secondary', 'Cancel'));
  ft.appendChild(btn('Primary', D.footer.primary));

  // layout evidence
  R.checks[D.key] = { bodyH: Math.round(body.height), cols: cols.map(c => Math.round(c.height)) };
  cols.forEach((c, i) => { if (c.height > body.height + 1) W.push(D.key + ': column ' + 'ABC'[i] + ' overflows body (' + Math.round(c.height) + ' > ' + Math.round(body.height) + ')'); });
  R.created[D.key + ' · Content'] = ct.id;
  return ct;
}

// ---------- data ----------
const CREATE_ATTR = 'Created by and last updated by are set by the system when you save.';
const F1D = {
  key: 'F1', activeNav: 'Add Business', bc: ['Businesses', null, 'New business'], title: 'New business',
  sub: 'Duplicates are checked across all stored businesses when you save.',
  errors: { title: '3 fields need attention', items: ['Phone 2 — the number is incomplete', 'TikTok followers — enter a count or tick Unknown', 'Website address — required while Has website is ticked'] },
  name: 'Bloom Florist', category: 'Shop',
  website: { checked: true, err: 'Enter the address, or untick Has website.' },
  phones: [{ v: '70 000 131' }, { v: '70 000 1', err: 'Enter the full number, e.g. 70 000 132.' }],
  notes: { value: 'Prefers calls after 11:00. Runs a second stall at the Saturday market.', helper: 'Visible to your team.' },
  social: [
    { platform: 'Instagram', handle: '@bloomflorist.demo', followers: { v: '2,480' }, last: { v: '14 Oct 2026' }, removable: true },
    { platform: 'TikTok', handle: '@bloomflorist.demo', followers: { err: 'Enter a count or tick Unknown.' }, last: { unknown: true }, removable: true },
  ],
  footer: { attribution: CREATE_ATTR, status: 'Not saved — 3 fields need attention', tone: 'status/danger/fg', primary: 'Save business' },
};
const F2D = {
  key: 'F2', activeNav: 'Add Business', bc: ['Businesses', null, 'New business'], title: 'New business',
  sub: 'Duplicates are checked across all stored businesses when you save.',
  name: 'Glow Beauty Salon', category: 'Salon',
  website: { checked: true, value: 'glow.example.com' },
  phones: [{ v: '70 000 101' }, { v: '70 000 133' }],
  notes: { value: 'Owner says a new branch opens in November.', helper: 'Visible to your team.' },
  social: [
    { platform: 'Instagram', handle: '@glowbeauty.demo', followers: { v: '12,350' }, last: { v: '18 Oct 2026' }, removable: true },
    { platform: 'TikTok', handle: '@glowbeauty.demo', followers: { unknown: true }, last: { unknown: true }, removable: true },
  ],
  footer: { attribution: CREATE_ATTR, status: 'Not saved — duplicate found', tone: 'status/danger/fg', primary: 'Save business' },
};
const F3D = {
  key: 'F3', activeNav: 'Businesses', bc: ['Businesses', 'Peak Fitness Gym', 'Edit'], title: 'Edit business',
  sub: 'Name and phone changes are re-checked for duplicates (this record excluded).',
  conflict: { title: 'Rana Haddad saved changes to this business while you were editing', body: 'Nothing was overwritten. The form now shows the latest values. Re-apply your changes and save again.', action: 'Show what changed' },
  name: 'Peak Fitness Gym', category: 'Gym',
  website: { checked: true, value: 'peak.example.com' },
  phones: [{ v: '70 000 111' }, { v: '70 000 112' }],
  notes: { value: 'Closed on Mondays. Ask for the front desk manager.', helper: 'Draft: “Closed on Mondays.”', flag: 'Changed by Rana Haddad · 09:40', action: 'Re-apply mine' },
  social: [{ platform: 'Instagram', handle: '@peakfitness.demo', followers: { v: '8,920' }, last: { v: '19 Oct 2026' }, removable: false }],
  footer: { attribution: ['Created by Karim Saleh · 6 Oct 2026, 10:12', 'Last updated by Rana Haddad · 21 Oct 2026, 09:40'], history: true, status: 'Not saved — review latest values', tone: 'status/warning/fg', ghost: 'Discard my changes', primary: 'Save changes' },
};

// ---------- F1 ----------
const F1 = screen('S4-A Create business — inline validation', 100, 100);
await buildForm(F1, F1D);
R.created.F1 = F1.id;

// ---------- F2 ----------
const F2 = screen('S4-B Create business — duplicate blocked (visible match)', 1640, 100);
await buildForm(F2, F2D);
const scrim = I('Overlay/Scrim', { Size: 'Desktop' }); scrim.name = 'Scrim';
F2.appendChild(scrim); scrim.x = 0; scrim.y = 0;
const dlg = I('Dialog', null, { Title: 'This business already exists', Description: 'Saving is blocked. A stored business has the same phone number. Duplicates cannot be saved or merged.' }, { 'Show description': true, 'Show footer': true, 'Show close': true });
dlg.name = 'Dialog · Duplicate blocked (visible match)';
F2.appendChild(dlg);
{
  const ds = slotOf(dlg);
  const mr = put(ds, AL('Match reason', 'HORIZONTAL', 8, 'CENTER'), true);
  mr.appendChild(I('Badge/Status', { Tone: 'Danger', Size: 'Small' }, { Label: 'Phone match' }, { 'Show dot': false }));
  mr.appendChild(await T('Matched on phone +000 70 000 101', 'ds/Body Small', 'text/secondary', null, 'Matched on'));
  const X = inset(ds, 'Existing business (visible to you)');
  for (const [k, v] of [['Name', 'Glow Beauty Salon (Downtown branch)'], ['Category', 'Salon'], ['Phones', '+000 70 000 101 · +000 70 000 102'], ['Social', '@glowbeauty.demo (Instagram)'], ['Website', 'glow.example.com']]) put(X.slot, kv(k, v), true);
  put(ds, notice('Inline', 'DEC-013', 'Name / branch matching is not decided. This match is by phone.'), true);
  put(ds, await T('No role can bypass a duplicate block, including the Owner.', 'ds/Caption', 'text/muted', 472, 'No bypass'), true);
  props(findI(dlg, 'Secondary action'), { Label: 'Back to form' });
  props(findI(dlg, 'Primary action'), { Label: 'Open existing business' });
}
dlg.x = Math.round((1440 - dlg.width) / 2); dlg.y = Math.max(40, Math.round((900 - dlg.height) / 2));
R.created.F2 = F2.id; R.created['F2 · Dialog'] = dlg.id;

// ---------- F3 ----------
const F3 = screen('S4-C Edit business — save conflict', 3180, 100);
await buildForm(F3, F3D);
R.created.F3 = F3.id;

// ---------- N1 annotation ----------
const N1 = AL('S4-N Hidden-match variant (annotation)', 'HORIZONTAL', 40, 'MIN');
section.appendChild(N1); N1.x = 100; N1.y = 1100;
N1.fills = [P('surface/default')]; N1.strokes = [P('border/default')]; N1.strokeWeight = 1; N1.cornerRadius = 16; pad(N1, 40, 40, 40, 40);
N1.setExplicitVariableModeForCollection(semCol, LIGHT_MODE);
{
  // P3: the dialog's ds/Elevation/3 shadow was cut by this hugging column (clipsContent), leaving grey wedges at the
  // dialog's bottom corners. Columns no longer clip, and the dialog sits on a padded stage with room for the shadow.
  N1.clipsContent = false;
  const c1 = AL('Hidden-match dialog', 'VERTICAL', 16);
  N1.appendChild(c1); c1.clipsContent = false;
  c1.appendChild(await T('Hidden-match variant — existence only', 'ds/H3', 'text/primary', null, 'Heading'));
  c1.appendChild(await T('Shown when the match is a business this user cannot open. Same entry points as F2.', 'ds/Body Small', 'text/secondary', 520, 'Caption'));
  // P2: readable policy-pending copy; no policy selected (existence only, DEC-003 pending).
  const hd = I('Dialog', null, { Title: 'This business already exists', Description: 'A matching business exists, so saving is blocked. What else can be shown is a pending policy decision (DEC-003).' }, { 'Show description': true, 'Show footer': true, 'Show close': true });
  hd.name = 'Dialog · Duplicate blocked (hidden match)';
  const stage = AL('Dialog stage', 'VERTICAL', 0, 'CENTER');
  c1.appendChild(stage); stage.clipsContent = false;
  stage.fills = [P('surface/sunken')]; stage.cornerRadius = 16; pad(stage, 32, 32, 48, 32);
  stage.appendChild(hd);
  R.created['N1 · Dialog stage'] = stage.id;
  const hs = slotOf(hd);
  const ph = I('Placeholder/Box', null, { Label: 'Details are not shown', Hint: 'You cannot open the matching business' });
  put(hs, ph, true);
  put(hs, notice('Inline', 'DEC-003', 'What a blocked user may see about a match they cannot open is not decided. “Request escalation” appears only if DEC-003 adopts it.'), true);
  props(findI(hd, 'Secondary action'), { Label: 'Back to form' });
  const pa = findI(hd, 'Primary action'); if (pa) { props(pa, { Label: 'Open existing business' }); pa.visible = false; }
  R.created['N1 · Hidden dialog'] = hd.id;

  const c2 = AL('Notes', 'VERTICAL', 16);
  N1.appendChild(c2);
  c2.appendChild(await T('Notes and intended interactions', 'ds/H3', 'text/primary', null, 'Heading'));
  const notes = [
    ['Note', 'N1 — Hidden match: existence only', 'The duplicate check covers every stored business, including records hidden from the user (DR-2). This variant only says a match exists (RW-05, AR-12). No “Open existing business”; no “Request escalation” (not adopted).'],
    ['Note', 'N2 — Name-only or similar-name warning', 'DEC-013 Alt NM-C / SN-1 would show a non-blocking warning with “Different business, continue” and “Cancel”. Drawn only as a policy branch in low-fi 21:2056. Not selected.'],
    ['Note', 'N3 — One dialog, four entry points', 'Create, Edit (record excluded from its own check), applying a data correction, and a duplicate saved by someone else first (DR-8). The Owner sees the full match and is still blocked (DR-5).'],
    ['Interaction', 'N4 — Save and validation', 'Save checks every field at once: summary at the top plus inline messages; summary links move focus to the field. Ticking Unknown disables the value; it is never stored as 0. Unticking Has website hides and clears the URL. Then the duplicate check runs.'],
    ['Interaction', 'N5 — Save conflict', 'If someone saved first, nothing is overwritten. The form reloads the latest values, marks changed fields and keeps your text so you can re-apply it. Saving again re-runs validation and the duplicate check.'],
  ];
  for (const [type, t, b] of notes) { const a = I('Annotation', { Type: type }, { Title: t, Body: b }); a.name = t; c2.appendChild(a); }

  const c3 = AL('Pending policies', 'VERTICAL', 12);
  N1.appendChild(c3);
  c3.appendChild(await T('Pending policies on this form', 'ds/H3', 'text/primary', null, 'Heading'));
  const pol = [
    ['DEC-013', 'Name / branch matching: whether a name-only match blocks, warns or is not checked is not decided.'],
    ['B2', 'Whether at least one phone is mandatory is not decided, so no asterisk is shown. Without a phone a business is not eligible for calling.'],
    ['DEC-014/023', 'How “Unknown” metrics are stored and whether follower history is kept are not decided.'],
    ['DEC-015', 'Who may add or suggest categories is not decided.'],
    ['DEC-003', 'What a blocked user may see about a match they cannot open is not decided.'],
  ];
  for (const [d, b] of pol) c3.appendChild(notice('Block', d, b));
}
R.created.N1 = N1.id;

// ---------- section bounds ----------
let maxR = 0, maxB = 0;
for (const c of section.children) { maxR = Math.max(maxR, c.x + c.width); maxB = Math.max(maxB, c.y + c.height); }
section.resizeWithoutConstraints(Math.ceil(maxR + 100), Math.ceil(maxB + 100));
R.checks.section = { x: section.x, y: section.y, w: Math.round(section.width), h: Math.round(section.height) };
R.checks.N1 = { w: Math.round(N1.width), h: Math.round(N1.height) };
{ // P3 evidence: the hidden dialog's shadow must stay inside unclipped ancestors (stage pad 32/48 > Elevation/3 extent)
  const st = section.findOne(n => n.name === 'Dialog stage'), hdn = st && st.findOne(n => n.name === 'Dialog · Duplicate blocked (hidden match)');
  if (st && hdn) {
    const clipped = []; let p = hdn.parent; while (p && p.type !== 'SECTION') { if (p.clipsContent && p !== N1) clipped.push(p.name); p = p.parent; }
    const rb = hdn.absoluteRenderBounds, sb = st.absoluteBoundingBox;
    R.checks.N1dialog = { w: Math.round(hdn.width), h: Math.round(hdn.height), cornerRadius: hdn.cornerRadius, clippingAncestors: clipped, shadowInsideStage: !!rb && rb.y + rb.height <= sb.y + sb.height + 0.5 && rb.x >= sb.x - 0.5 };
    if (clipped.length) W.push('N1: hidden dialog still has clipping ancestors: ' + clipped.join(', '));
    if (rb && !R.checks.N1dialog.shadowInsideStage) W.push('N1: dialog shadow extends past the stage');
  } else W.push('N1: dialog stage not found for the P3 check');
}
R.checks.dialog = { x: dlg.x, y: dlg.y, w: Math.round(dlg.width), h: Math.round(dlg.height) };
return R;
