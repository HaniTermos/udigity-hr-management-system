// 02-s6-myday.js — Shared Agent — Phase 5. Section "S6 My Day Mobile" on page 30 HiFi — Visual Sample (36:4).
// Spec: docs/phase5/screens/shared-sample-spec.md §3. Run with use_figma. Idempotent: rebuilds its named frames inside the section.
// Dark frames: setExplicitVariableModeForCollection(Semantic, '40:2'). DS instances only; all visible text set explicitly.
// ---------- Shared screen helper library (inlined in every Shared Agent script) ----------
// Rules: instances of DS components only (page 21); layout frames/text bound to Semantic variables.
const PAGE_ID = '36:4';
const SEM_ID = 'VariableCollectionId:40:3', LIGHT = '40:1', DARK = '40:2';
const CID = {
  'Brand/Logo': '44:342', 'Avatar': '44:358', 'Divider': '44:364', 'Annotation': '44:395',
  'Badge/Status': '44:435', 'Chip/Derived': '44:509', 'Notice/Policy pending': '44:549',
  'Button': '45:305', 'Link': '45:441', 'Input': '45:796', 'Textarea': '45:847',
  'Shell/Mobile/Header': '49:1219', 'Shell/Mobile/TabBar': '49:1588', 'Shell/Mobile': '49:2034',
  'Card/Surface': '51:1772', 'Card/Section': '51:1780', 'Card/Inset': '51:1797',
  'List/Item': '51:1870', 'Progress/Bar': '51:1916', 'Banner': '53:1960',
  'Attendance/Timer': '55:2215', 'Attendance/VerificationStatus': '55:2243', 'Attendance/Panel': '55:2399'
};
const ICONS = {
  mail: '44:218', lock: '44:133', shield: '44:213', clock: '44:23', phone: '44:98', list: '44:118',
  'check-circle': '44:163', 'alert-triangle': '44:148', 'map-pin': '44:193', wifi: '44:198', info: '44:158',
  calendar: '44:18', menu: '44:178', refresh: '44:293', target: '44:298', 'log-out': '44:253', 'file-text': '44:288'
};
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const semCol = await figma.variables.getVariableCollectionByIdAsync(SEM_ID);
if (!semCol) throw new Error('Semantic collection ' + SEM_ID + ' not found');
const V = {};
for (const v of await figma.variables.getLocalVariablesAsync()) if (v.variableCollectionId === SEM_ID) V[v.name] = v;
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const OUT = { created: {}, updated: {}, removed: [], warnings: [] };
const warn = m => OUT.warnings.push(m);

function P(name) { const v = V[name]; if (!v) throw new Error('Missing semantic variable ' + name); return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', v); }
function fill(n, name) { n.fills = name ? [P(name)] : []; return n; }
function strokeOf(n, name, w) { n.strokes = [P(name)]; n.strokeWeight = w || 1; n.strokeAlign = 'INSIDE'; return n; }

// ---- component lookup
const _nodes = {};
async function node(id) { if (!_nodes[id]) { _nodes[id] = await figma.getNodeByIdAsync(id); if (!_nodes[id]) throw new Error('DS node not found ' + id); } return _nodes[id]; }
const pv = nm => Object.fromEntries(nm.split(',').map(s => s.split('=').map(x => x.trim())));
async function variant(name, props) {
  const n = await node(CID[name]);
  if (n.type === 'COMPONENT') return n;
  const want = props || {};
  const hit = n.children.find(ch => { const p = pv(ch.name); return Object.entries(want).every(([k, v]) => p[k] === v); }) || (Object.keys(want).length ? null : n.defaultVariant);
  if (!hit) throw new Error(`No variant ${JSON.stringify(want)} in ${name}`);
  return hit;
}
function setProp(inst, prop, value) {
  const cp = inst.componentProperties;
  const key = Object.keys(cp).find(k => k === prop || k.split('#')[0] === prop);
  if (!key) { warn(`prop ${prop} not on ${inst.name}`); return; }
  let val = value;
  if (cp[key].type === 'INSTANCE_SWAP' && ICONS[value]) val = ICONS[value];
  try { inst.setProperties({ [key]: val }); }
  catch (e) { if (val === '') { try { inst.setProperties({ [key]: ' ' }); } catch (e2) { warn(`set ${prop} on ${inst.name}: ${e2.message}`); } } else warn(`set ${prop} on ${inst.name}: ${e.message}`); }
}
function setProps(inst, o) { if (o) for (const [k, v] of Object.entries(o)) setProp(inst, k, v); return inst; }
// I(name, variantProps, props, layerName): instance + all text/bool/swap properties; warns on any TEXT prop left unset
async function I(name, vprops, props, layerName) {
  const inst = (await variant(name, vprops)).createInstance();
  if (layerName) inst.name = layerName;
  setProps(inst, props);
  const given = Object.keys(props || {});
  for (const [k, d] of Object.entries(inst.componentProperties)) if (d.type === 'TEXT' && !given.includes(k.split('#')[0])) warn(`${inst.name}: TEXT prop ${k.split('#')[0]} left at default`);
  return inst;
}
async function icon(name, size) { const inst = (await node(ICONS[name])).createInstance(); inst.name = 'Icon/' + name; if (size && size !== 20) inst.resize(size, size); return inst; }
function nested(root, layerName) { return root.findOne(n => n.type === 'INSTANCE' && n.name === layerName); }
async function setChars(t, chars) {
  const fonts = t.fontName === figma.mixed ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName];
  for (const f of fonts) await figma.loadFontAsync(f);
  t.characters = String(chars);
}
async function setText(root, layerName, chars, parentName) {
  const t = root.findOne(n => n.type === 'TEXT' && n.name === layerName && (!parentName || (n.parent && n.parent.name === parentName)));
  if (!t) { warn(`text layer ${layerName} not found in ${root.name}`); return; }
  await setChars(t, chars);
}
async function nestedProps(root, layerName, props) { const n = nested(root, layerName); if (!n) { warn(`nested ${layerName} not found in ${root.name}`); return null; } setProps(n, props); return n; }

// ---- layout primitives (frames + text bound to semantic tokens)
function AL(name, dir, o) {
  o = o || {};
  const f = figma.createAutoLayout(dir || 'VERTICAL'); f.name = name; f.fills = [];
  if (o.gap != null) f.itemSpacing = o.gap;
  if (o.pad != null) { const [t, r, b, l] = [].concat(o.pad).length === 1 ? [o.pad, o.pad, o.pad, o.pad] : [].concat(o.pad).length === 2 ? [o.pad[0], o.pad[1], o.pad[0], o.pad[1]] : o.pad; f.paddingTop = t; f.paddingRight = r; f.paddingBottom = b; f.paddingLeft = l; }
  if (o.fill) fill(f, o.fill);
  if (o.align) f.counterAxisAlignItems = o.align;
  if (o.justify) f.primaryAxisAlignItems = o.justify;
  if (o.w != null || o.h != null) { f.resize(o.w || Math.max(1, f.width), o.h || Math.max(1, f.height)); if (o.w != null) f.layoutSizingHorizontal = 'FIXED'; if (o.h != null) f.layoutSizingVertical = 'FIXED'; }
  if (o.clip != null) f.clipsContent = o.clip;
  return f;
}
async function TX(chars, style, color, o) {
  o = o || {};
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Regular' };
  t.characters = String(chars);
  const st = TS[style]; if (!st) throw new Error('Missing text style ' + style);
  await t.setTextStyleIdAsync(st.id);
  fill(t, color || 'text/primary');
  t.name = o.name || String(chars).slice(0, 40);
  if (o.align) t.textAlignHorizontal = o.align;
  return t;
}
// append children; fill: true => FILL width (text gets auto height)
function add(parent, kids, fillW) {
  for (const k of [].concat(kids)) {
    if (!k) continue;
    parent.appendChild(k);
    if (fillW) { try { if (k.type === 'TEXT') k.textAutoResize = 'HEIGHT'; k.layoutSizingHorizontal = 'FILL'; } catch (e) { warn('fill width ' + k.name + ': ' + e.message); } }
  }
  return parent;
}
function grow(n) { try { n.layoutGrow = 1; } catch (e) {} return n; }
// Card from DS (Card/Surface | Card/Inset | Card/Section): returns { node, body } where body is the native SLOT
async function card(kind, layerName, props, gap) {
  const inst = await I(kind, null, props || {}, layerName);
  const slot = inst.findOne(n => n.type === 'SLOT');
  if (!slot) { warn(`${kind}: no SLOT found in instance ${layerName}`); return { node: inst, body: null }; }
  for (const ch of [...slot.children]) ch.remove();
  if (gap != null) { try { slot.itemSpacing = gap; } catch (e) {} }
  return { node: inst, body: slot };
}
function fillBody(c, kids) { if (c.body) add(c.body, kids, true); else warn('card body missing; children dropped for ' + c.node.name); return c; }
async function policy(size, dec, body, layerName, tone) {
  return I('Notice/Policy pending', { Size: size, Tone: tone || 'Policy pending' }, { DEC: dec, Body: body }, layerName || ('Policy ' + dec));
}
function setProgress(bar, ratio) {
  const f = bar.findOne(n => n.name === 'Fill');
  if (!f || !f.parent) { warn('Progress Fill not found in ' + bar.name); return; }
  // Repair round 2: a complete bar (ratio >= 1) is shown by painting the Track with the Fill paint (fill override only).
  if (ratio >= 1) { f.parent.fills = [...f.fills]; return; }
  f.resize(Math.max(1, f.parent.width * ratio), f.height);
}
async function findByMain(root, setName) {
  for (const n of root.findAllWithCriteria({ types: ['INSTANCE'] })) {
    const m = await n.getMainComponentAsync(); if (!m) continue;
    const nm = m.parent && m.parent.type === 'COMPONENT_SET' ? m.parent.name : m.name;
    if (nm === setName) return n;
  }
  return null;
}
// ---- section + frame management (idempotent)
function getSection(name, x, y) {
  let s = page.children.find(n => n.type === 'SECTION' && n.name === name);
  if (!s) { s = figma.createSection(); s.name = name; s.x = x; s.y = y; OUT.created[name] = s.id; }
  else OUT.updated[name] = s.id;
  return s;
}
function clearNamed(sec, names) { for (const ch of [...sec.children]) if (names.includes(ch.name)) { OUT.removed.push(ch.name + ' ' + ch.id); ch.remove(); } }
function screenFrame(sec, name, w, h, x, y, dark) {
  const f = figma.createFrame(); f.name = name; sec.appendChild(f);
  f.resize(w, h); f.x = x; f.y = y; f.clipsContent = true; fill(f, 'surface/page');
  f.setExplicitVariableModeForCollection(semCol, dark ? DARK : LIGHT);
  OUT.created[name] = f.id;
  return f;
}
function fitSection(sec, padding) {
  let mx = 0, my = 0;
  for (const c of sec.children) { mx = Math.max(mx, c.x + c.width); my = Math.max(my, c.y + c.height); }
  sec.resizeWithoutConstraints(mx + padding, my + padding);
}
const reg = (k, n) => { if (n) OUT.created[k] = n.id; return n; };
// ---------- end helper library ----------
// ================= S6 My Day Mobile (SCR-SHR-001 light/dark + SCR-SHR-003 checkout verification failure light/dark) =================
// Representative user: Maya Khoury (Call Center). Tue 20 Oct 2026, now 14:32, checked in 08:58 (aligned with S3 top bar).
const SEC = getSection('S6 My Day Mobile', 0, 6000);
const NAMES = {
  dayL: 'SCR-SHR-001 My Day — Mobile — Light', dayD: 'SCR-SHR-001 My Day — Mobile — Dark',
  outL: 'SCR-SHR-003 Checkout — Mobile — Light — Verification failure', outD: 'SCR-SHR-003 Checkout — Mobile — Dark — Verification failure',
  notes: 'S6 — Annotations'
};
clearNamed(SEC, Object.values(NAMES));
const M = 80, GAPX = 80;
const TAB_SET = [['My Day', 'clock'], ['Queue', 'phone'], ['Follow-ups', 'calendar'], ['More', 'menu']];

async function header(h, title, subtitle) {
  setProps(h, { Title: title, Subtitle: subtitle, 'Show subtitle': true });
  const av = nested(h, 'Avatar'); if (av) setProps(av, { Initials: 'MK' });
}
async function tabBar(tb) {
  if (!tb) { warn('TabBar not found'); return; }
  try { tb.setProperties({ Role: 'Call Center', Active: '1' }); } catch (e) { warn('TabBar variant: ' + e.message); }
  for (let i = 0; i < 4; i++) { const t = nested(tb, 'Tab ' + (i + 1)); if (t) setProps(t, { Label: TAB_SET[i][0], Icon: TAB_SET[i][1] }); else warn('Tab ' + (i + 1) + ' not found'); }
}
function content(frame, y, h) {
  const c = AL('Content', 'VERTICAL', { pad: 16, gap: 12, clip: true });
  frame.appendChild(c); c.x = 0; c.y = y; c.resize(390, h); c.layoutSizingHorizontal = 'FIXED'; c.layoutSizingVertical = 'FIXED';
  return c;
}
function row(name, gap) { return AL(name, 'HORIZONTAL', { gap: gap == null ? 8 : gap, align: 'CENTER' }); }

// ---------- SCR-SHR-001 My Day
async function myDay(name, x, dark) {
  const f = screenFrame(SEC, name, 390, 844, x, M, dark);
  const shell = await I('Shell/Mobile', { Role: 'Call Center' }, {}, 'Shell');
  f.appendChild(shell); shell.x = 0; shell.y = 0;
  const h = nested(shell, 'Header'); if (h) await header(h, 'My Day', 'Tue 20 Oct 2026'); else warn('Shell header not found');
  await tabBar(nested(shell, 'TabBar'));
  const c = content(f, 56, 724);

  // A. Attendance panel (DS Attendance/Panel, Checked in) — every visible text overridden
  const panel = await I('Attendance/Panel', { State: 'Checked in' }, {}, 'Attendance panel');
  add(c, [panel], true);
  await setText(panel, 'Title', 'Attendance', 'Header');
  await nestedProps(panel, 'Status', { Label: 'Checked in', 'Show dot': true });
  const tm = nested(panel, 'Timer');
  if (tm) { await setText(tm, 'Label', 'Elapsed today'); await setText(tm, 'Elapsed', '05:34:14'); await setText(tm, 'Caption', 'Since 08:58 · today'); } else warn('Timer not found');
  const pb = await nestedProps(panel, 'Progress', { Label: 'Toward 9 h workday', Value: '5h 34m of 9h', 'Show labels': true });
  const ver = nested(panel, 'Verification');
  if (ver) { await setText(ver, 'Title', 'Office check passed'); await setText(ver, 'Meta', '08:58 · at check-in'); } else warn('Verification not found');
  await nestedProps(panel, 'Action', { Label: 'Check out', 'Show icon': false });
  await nestedProps(panel, 'Policy', { DEC: 'DEC-009', Body: 'Office check mode' });

  // B. Day rules inset — directly under the attendance panel, above the fold (Final pass MF-13):
  // punctuality row (derived classification) + required DEC-007/008 label + DEC-012 summary rule.
  const rules = await card('Card/Inset', 'Day rules', {}, 8);
  add(c, [rules.node], true);
  const r1 = row('Punctuality row');
  add(r1, [await icon('clock', 16), await TX('Check-in 08:58 · On time', 'ds/Label', 'text/primary', { name: 'Punctuality value' })]);
  add(r1, [await I('Chip/Derived', { Tone: 'Neutral' }, { Label: 'Derived' }, 'Punctuality chip')]);
  const r3 = row('Summary row');
  add(r3, [await policy('Chip', 'DEC-012', 'Summary required?', 'Policy DEC-012')]);
  fillBody(rules, [r1,
    await policy('Inline', 'DEC-007/008', 'Pending: schedule & grace. The 9 h workday is confirmed; “On time” is derived and illustrative.', 'Policy DEC-007/008'),
    await TX('At checkout you will add a work summary.', 'ds/Caption', 'text/muted', { name: 'Summary note' }), r3]);

  // C. Work list (Card/Section) — usable without check-in (A1)
  const wl = await card('Card/Section', 'My work list', { Title: 'My work list', Subtitle: '6 items · no check-in needed', 'Show subtitle': true, 'Show action': true }, 0);
  add(c, [wl.node], true);
  { const act = wl.node.findOne(n => n.type === 'INSTANCE' && n.name === 'Action') || await findByMain(wl.node, 'Link'); if (act) setProps(act, { Label: 'See all', 'Show icon': false }); else warn('Work list action link not found'); }
  const items = [
    ['Peak Fitness Gym', 'Follow-up · 15:00', 'phone', 'Warning', 'Due'],
    ['Bloom Florist', 'New call · Shop', 'phone', 'Neutral', 'To call'],
    ['Olive & Thyme Café', 'New call · Café', 'phone', 'Neutral', 'To call'],
    ['Nova Dental Clinic', 'Follow-up · Wed 21 Oct', 'calendar', 'Info', 'Next']
  ];
  const listNodes = [];
  for (const [t, m, ic, tone, lab] of items) {
    const li = await I('List/Item', { State: 'Default' }, { Title: t, Meta: m, Icon: ic, 'Show leading': true, 'Show badge': true, 'Show chevron': false }, 'Work item · ' + t);
    const b = nested(li, 'Badge'); if (b) setProps(b, { Tone: tone, Label: lab, 'Show dot': false }); else warn('List badge not found');
    listNodes.push(li);
  }
  fillBody(wl, listNodes);

  // D. Targets (below the fold — scroll intended)
  const tg = await card('Card/Section', 'Today’s targets', { Title: 'Today’s targets', Subtitle: 'Set by the Owner', 'Show subtitle': true, 'Show action': false }, 12);
  add(c, [tg.node], true);
  const tRow = row('Target policy row'); add(tRow, [await policy('Chip', 'DEC-020', 'Target metrics', 'Policy DEC-020')]);
  const t1 = await I('Progress/Bar', { Tone: 'Brand' }, { Label: 'Calls completed', Value: '7 of 20', 'Show labels': true }, 'Target calls');
  const t2 = await I('Progress/Bar', { Tone: 'Brand' }, { Label: 'Follow-ups done', Value: '2 of 5', 'Show labels': true }, 'Target follow-ups');
  fillBody(tg, [tRow, t1, t2]);

  // progress values after layout widths settle
  if (pb) setProgress(pb, 0.62);
  setProgress(t1, 0.35); setProgress(t2, 0.40);
  reg(name + ' › Attendance panel', panel); reg(name + ' › Work list', wl.node); reg(name + ' › Shell', shell);
  return f;
}

// ---------- SCR-SHR-003 Checkout — verification failure (focused flow: no tab bar)
async function checkout(name, x, dark) {
  const f = screenFrame(SEC, name, 390, 844, x, M, dark);
  const h = await I('Shell/Mobile/Header', { Back: 'True' }, { Title: 'Check out', Subtitle: 'Tue 20 Oct 2026', 'Show subtitle': true }, 'Header');
  f.appendChild(h); h.x = 0; h.y = 0;
  const av = nested(h, 'Avatar'); if (av) setProps(av, { Initials: 'MK' });
  const c = content(f, 56, 624);

  // 1. Today summary
  const sum = await card('Card/Inset', 'Today summary', {}, 6);
  add(c, [sum.node], true);
  // Repair round 2: the bar's built-in labels row clipped the value at the inset's right edge, so its labels are hidden
  // and a local row is used instead: label fills (wraps if needed), value hugs. No instance child is moved or resized.
  const pbar = await I('Progress/Bar', { Tone: 'Brand' }, { Label: 'Toward 9 h workday', Value: '9h 08m of 9h', 'Show labels': false }, 'Workday progress');
  const pRow = row('Workday progress labels', 8);
  fillBody(sum, [await TX('Checked in 08:58 · now 18:06', 'ds/Body Small', 'text/secondary', { name: 'Times' }), pRow, pbar]);
  add(pRow, [await TX('Toward 9 h workday', 'ds/Body Small', 'text/secondary', { name: 'Progress label' })], true);
  add(pRow, [await TX('9h 08m of 9h', 'ds/Label Small', 'text/primary', { name: 'Progress value' })]);

  // 2. Work summary + DEC-012
  const ta = await I('Textarea', { State: 'Filled' }, {
    Label: 'Work summary', 'Show label': true, Required: false,
    Value: 'Called 18 businesses; booked 2 meetings for Lina Aoun (Peak Fitness Gym, Lumen Yoga Studio); 3 follow-ups rescheduled.',
    Placeholder: 'What did you work on today?', Helper: 'Shown to the Owner in reports.', 'Error message': 'Add a work summary to check out.',
    'Show helper': true, Counter: '118 / 1000'
  }, 'Work summary');
  const r12 = row('Summary policy row'); add(r12, [await policy('Chip', 'DEC-012', 'Required or optional', 'Policy DEC-012')]);
  add(c, [ta, r12], true);

  // 3. Verification failure + retry + DEC-009
  const vs = await I('Attendance/VerificationStatus', { State: 'Failed' }, {}, 'Verification');
  add(c, [vs], true);
  await setText(vs, 'Title', 'Office check failed');
  await setText(vs, 'Meta', 'Connect to the office network or allow location.');
  // Final pass MF-15: Retry check is a full-width Large (>= 44 px) secondary button; DEC-009 chip on its own row.
  add(c, [await I('Button', { Variant: 'Secondary', Size: 'Large', State: 'Default' }, { Label: 'Retry check', 'Show icon': true, Icon: 'refresh' }, 'Retry check')], true);
  const r9 = row('Retry policy row');
  add(r9, [await policy('Chip', 'DEC-009', 'Which check applies', 'Policy DEC-009')]);
  add(c, [r9], true);

  // 4. DEC-026 alternatives — none selected. Final pass MF-14: each Alt states its own outcome of pressing Check out;
  // the footer button is not shown disabled (that would present Alt A as decided).
  add(c, [await policy('Inline', 'DEC-026', 'What Check out does after a failed check: none selected.', 'Policy DEC-026')], true);
  const alts = await card('Card/Inset', 'DEC-026 alternatives', {}, 6);
  add(c, [alts.node], true);
  const altKids = [];
  for (const [tag, body] of [
    ['Alt A · Blocked · not selected', 'If chosen, Check out: not recorded; session stays open.'],
    ['Alt B · Provisional · not selected', 'If chosen, Check out: recorded as provisional; Owner reviews.'],
    ['Alt C · Pending review · not selected', 'If chosen, Check out: held for Owner review; next check-in effect open.']]) {
    const a = AL(tag.slice(0, 5), 'VERTICAL', { gap: 2 });
    const br = row('Badge row'); add(br, [await I('Badge/Status', { Tone: 'Neutral', Size: 'Small' }, { Label: tag, 'Show dot': false }, 'Alt badge')]);
    add(a, [br, await TX(body, 'ds/Caption', 'text/secondary', { name: 'Alt body' })], true);
    altKids.push(a);
  }
  fillBody(alts, altKids);

  // 5. Sticky footer
  const ft = AL('Footer', 'VERTICAL', { pad: [12, 16], gap: 6, fill: 'surface/default', align: 'CENTER' });
  // Final pass: footer 164 high (button 48 + 2-line note + 48 Cancel); content area shortened to match.
  f.appendChild(ft); ft.x = 0; ft.y = 680; ft.resize(390, 164); ft.layoutSizingHorizontal = 'FIXED'; ft.layoutSizingVertical = 'FIXED';
  strokeOf(ft, 'border/default'); ft.strokeTopWeight = 1; ft.strokeBottomWeight = 0; ft.strokeLeftWeight = 0; ft.strokeRightWeight = 0;
  // MF-14: neutral, enabled-looking primary whose label names the pending policy; the result is per Alt card above.
  add(ft, [await I('Button', { Variant: 'Primary', Size: 'Large', State: 'Default' }, { Label: 'Check out · outcome per DEC-026', 'Show icon': false }, 'Check out')], true);
  add(ft, [await TX('Result depends on DEC-026 (none selected). Your session is never closed or blocked silently.', 'ds/Caption', 'text/muted', { name: 'Footer note', align: 'CENTER' })], true);
  // MF-15: Cancel is a full-width Ghost Large button (>= 44 px tap target).
  add(ft, [await I('Button', { Variant: 'Ghost', Size: 'Large', State: 'Default' }, { Label: 'Cancel', 'Show icon': false }, 'Cancel')], true);

  setProgress(pbar, 1);
  reg(name + ' › Verification', vs); reg(name + ' › Work summary', ta);
  return f;
}

const xs = [M, M + 390 + GAPX, M + 2 * (390 + GAPX), M + 3 * (390 + GAPX)];
await myDay(NAMES.dayL, xs[0], false);
await myDay(NAMES.dayD, xs[1], true);
await checkout(NAMES.outL, xs[2], false);
await checkout(NAMES.outD, xs[3], true);

// ---------- Annotations
const notes = AL(NAMES.notes, 'HORIZONTAL', { gap: 24 }); SEC.appendChild(notes); notes.x = M; notes.y = M + 844 + 48;
OUT.created[NAMES.notes] = notes.id;
add(notes, [
  await I('Annotation', { Type: 'Interaction' }, { Title: 'Intended interactions', Body: 'Check out → SCR-SHR-003. Retry check re-runs the office check. After a failed check, pressing Check out follows whichever DEC-026 alternative is chosen (none selected; the button is not pre-disabled). Cancel returns to My Day. Work items open the business, follow-up or task. All tap targets ≥ 44 px.' }, 'Interaction note'),
  await I('Annotation', { Type: 'Note' }, { Title: 'Fold (scrollable frames)', Body: 'Frames show the first viewport (390×844). My Day: Day rules (punctuality, DEC-007/008, DEC-012) sit under the attendance panel; the work list and Today’s targets (DEC-020) continue below the fold. Checkout: content scrolls above the sticky footer.' }, 'Fold note'),
  await I('Annotation', { Type: 'Note' }, { Title: 'Pending policies', Body: 'DEC-009 office check mode · DEC-012 summary required? · DEC-026 failed checkout (Alt A/B/C, none selected) · DEC-007/008 schedule and grace · DEC-020 targets. Punctuality (“On time”) is derived from DEC-007/008 and illustrative.' }, 'Policy note')
]);

fitSection(SEC, M);
return OUT;
