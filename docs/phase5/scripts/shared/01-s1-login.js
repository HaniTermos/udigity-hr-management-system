// 01-s1-login.js — Shared Agent — Phase 5. Section "S1 Login" on page 30 HiFi — Visual Sample (36:4).
// Spec: docs/phase5/screens/shared-sample-spec.md §2. Run with use_figma. Idempotent: rebuilds its named frames inside the section.
// Uses DS instances only (IDs from docs/phase5/ds-ids/index.md); every visible text property is set explicitly (DS default-text defect).
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
// ================= S1 Login (SCR-AUTH-001 desktop light + states; SCR-AUTH-002 2FA step) =================
const SEC = getSection('S1 Login', 0, 0);
const F_MAIN = 'SCR-AUTH-001 Login — Desktop — Light';
const F_INV = 'SCR-AUTH-001 Login — State — Invalid credentials';
const F_EXP = 'SCR-AUTH-001 Login — State — Session expired';
const F_2FA = 'SCR-AUTH-002 Owner 2FA — State — Step and R-11 readings';
const F_NOTE = 'S1 — Annotations';
clearNamed(SEC, [F_MAIN, F_INV, F_EXP, F_2FA, F_NOTE]);
const M = 80; // section margin

async function emailInput(state, value, layer) {
  return I('Input', { Type: 'Text', State: state }, {
    Label: 'Email', 'Show label': true, Required: false, Value: value || 'name@udigity.example', Placeholder: 'name@udigity.example',
    Helper: 'Use your Udigity work email.', 'Error message': 'Enter a valid email address.', 'Show helper': false,
    'Show icon': true, Icon: 'mail', 'Country code': '+000', Suffix: ' '
  }, layer || 'Email');
}
async function passwordInput(state, value, errorMsg, layer) {
  return I('Input', { Type: 'Password', State: state }, {
    Label: 'Password', 'Show label': true, Required: false, Value: value || '••••••••••', Placeholder: 'Enter your password',
    Helper: 'Passwords are case-sensitive.', 'Error message': errorMsg || 'Enter your password.', 'Show helper': false,
    'Show icon': true, Icon: 'lock', 'Country code': '+000', Suffix: ' '
  }, layer || 'Password');
}
async function primary(label, state, layer) { return I('Button', { Variant: 'Primary', Size: 'Large', State: state || 'Default' }, { Label: label, 'Show icon': false }, layer || 'Primary action'); }
async function stateCaption(text) { return TX(text, 'ds/Overline', 'text/muted', { name: 'Caption' }); }
async function stateFrame(name, x, y) {
  const f = AL(name, 'VERTICAL', { gap: 12, w: 480 }); SEC.appendChild(f); f.x = x; f.y = y; f.layoutSizingVertical = 'HUG';
  f.setExplicitVariableModeForCollection(semCol, LIGHT);
  OUT.created[name] = f.id; return f;
}

// ---------- Main frame 1440x900
const main = screenFrame(SEC, F_MAIN, 1440, 900, M, M, false);
main.layoutMode = 'HORIZONTAL'; main.primaryAxisSizingMode = 'FIXED'; main.counterAxisSizingMode = 'FIXED';
main.itemSpacing = 0;
// Left brand panel (navy in both modes via surface/brand)
const brand = AL('Brand panel', 'VERTICAL', { pad: 64, gap: 24, fill: 'surface/brand', justify: 'SPACE_BETWEEN' });
main.appendChild(brand); brand.layoutSizingHorizontal = 'FIXED'; brand.resize(600, 900); brand.layoutSizingVertical = 'FILL';
const logo = await I('Brand/Logo', { Size: 'Medium', Surface: 'On brand' }, {}, 'Logo placeholder');
const mid = AL('Brand message', 'VERTICAL', { gap: 16 });
add(mid, [
  await TX('Udigity Management System', 'ds/Display', 'text/on-brand', { name: 'Product name' }),
  await TX('Attendance, businesses, calls and projects in one place.', 'ds/Body', 'text/on-brand-muted', { name: 'Product line' })
], true);
const foot = AL('Brand footer', 'VERTICAL', { gap: 12 });
const rule = figma.createRectangle(); rule.name = 'Accent rule'; rule.resize(48, 3); fill(rule, 'brand/accent');
add(foot, [rule, await TX('Internal system · authorised Udigity staff only', 'ds/Caption', 'text/on-brand-muted', { name: 'Staff only' })]);
add(brand, [logo]); add(brand, [mid, foot], true);
reg('Logo placeholder (S1 main)', logo);
// Right panel
const right = AL('Sign-in panel', 'VERTICAL', { gap: 16, align: 'CENTER', justify: 'CENTER' });
main.appendChild(right); right.layoutSizingHorizontal = 'FILL'; right.layoutSizingVertical = 'FILL';
const lc = await card('Card/Surface', 'Login card', {}, 20);
right.appendChild(lc.node); lc.node.resize(440, lc.node.height); lc.node.layoutSizingHorizontal = 'FIXED'; try { lc.node.layoutSizingVertical = 'HUG'; } catch (e) {}
const forgotRow = AL('Forgot row', 'HORIZONTAL', { justify: 'MAX', align: 'CENTER' });
add(forgotRow, [await I('Link', { Size: 'Small', State: 'Default' }, { Label: 'Forgot password?', 'Show icon': false }, 'Forgot password')]);
const twofa = AL('Owner 2FA note', 'HORIZONTAL', { gap: 8, align: 'MIN' });
add(twofa, [await icon('shield', 20)]);
add(twofa, [await TX('Owner accounts confirm a second step (2FA) after signing in.', 'ds/Body Small', 'text/secondary', { name: '2FA note' })], true);
fillBody(lc, [
  await TX('Sign in', 'ds/H2', 'text/primary', { name: 'Title' }),
  await TX('Use your Udigity work email and password.', 'ds/Body', 'text/secondary', { name: 'Subtitle' }),
  await emailInput('Default'),
  await passwordInput('Focus'),
  forgotRow,
  await primary('Sign in'),
  await I('Divider', { Orientation: 'Horizontal' }, {}, 'Divider'),
  twofa,
  await policy('Inline', 'R-11', 'What an Owner may do before 2FA is complete is undecided.', 'Policy R-11')
]);
add(right, [await TX('© 2026 Udigity · Need access? Ask the Owner/Admin.', 'ds/Caption', 'text/muted', { name: 'Footer' })]);
reg('Login card', lc.node);

// ---------- State: invalid credentials + field validation
const sx = M + 1440 + 80;
const fInv = await stateFrame(F_INV, sx, M);
// Final pass MF-18: bad credentials leave BOTH fields neutral (no red border); only the generic banner signals the error.
add(fInv, [await stateCaption('STATE · Invalid credentials')], true);
const c1 = await card('Card/Surface', 'Login card — invalid', {}, 16);
add(fInv, [c1.node], true);
fillBody(c1, [
  await TX('Sign in', 'ds/H2', 'text/primary', { name: 'Title' }),
  await I('Banner', { Tone: 'Error', Size: 'Inline' }, { Title: 'Email or password is incorrect.', Body: 'Check both and try again.', 'Show title': true, 'Show action': false, 'Show close': false }, 'Error banner'),
  await emailInput('Filled', 'maya.khoury@udigity.example'),
  await passwordInput('Default'),
  await primary('Sign in')
]);
add(fInv, [await policy('Inline', 'Impl. decision', 'Lockout and throttle wording (no DEC ID). Both fields stay neutral and the message never says which field is wrong; the password is cleared.', 'Implementation note', 'Implementation decision')], true);

// ---------- State: session expired + deactivated
const fExp = await stateFrame(F_EXP, sx, fInv.y + fInv.height + 48);
add(fExp, [await stateCaption('STATE · Session expired (return notice from SCR-SHR-013)')], true);
const c2 = await card('Card/Surface', 'Login card — session expired', {}, 16);
add(fExp, [c2.node], true);
fillBody(c2, [
  await TX('Sign in', 'ds/H2', 'text/primary', { name: 'Title' }),
  await I('Banner', { Tone: 'Info', Size: 'Inline' }, { Title: 'Your session has ended.', Body: 'Sign in again to continue. Unsaved changes on the previous page may not have been kept.', 'Show title': true, 'Show action': false, 'Show close': false }, 'Session banner'),
  await emailInput('Filled', 'maya.khoury@udigity.example'),
  await passwordInput('Default'),
  await primary('Sign in')
]);
add(fExp, [await stateCaption('STATE · Deactivated account')], true);
add(fExp, [await I('Banner', { Tone: 'Error', Size: 'Inline' }, { Title: 'This account is not active.', Body: 'Contact the Owner/Admin to restore access.', 'Show title': true, 'Show action': false, 'Show close': false }, 'Deactivated banner')], true);
add(fExp, [await policy('Inline', 'Impl. decision', 'Session lifetime is an implementation decision (no DEC ID).', 'Implementation note', 'Implementation decision')], true);

// ---------- State: Owner 2FA step with both R-11 readings
const fTwo = await stateFrame(F_2FA, sx + 560, M);
add(fTwo, [await stateCaption('STATE · Owner 2FA step (SCR-AUTH-002) — both R-11 readings shown')], true);
const c3 = await card('Card/Surface', '2FA card', {}, 16);
add(fTwo, [c3.node], true);
const logoRow = AL('Logo row', 'HORIZONTAL', {});
add(logoRow, [await I('Brand/Logo', { Size: 'Small', Surface: 'Default' }, {}, 'Logo placeholder')]);
fillBody(c3, [
  logoRow,
  await TX('Confirm it’s you', 'ds/H2', 'text/primary', { name: 'Title' }),
  await TX('Enter the 6-digit code from your authenticator for rana.haddad@udigity.example.', 'ds/Body', 'text/secondary', { name: 'Body' }),
  await I('Input', { Type: 'Number', State: 'Default' }, {
    Label: 'Verification code', 'Show label': true, Required: false, Value: '000 000', Placeholder: '000 000',
    Helper: 'The code changes every 30 seconds.', 'Error message': 'This code is wrong or has expired.', 'Show helper': true,
    'Show icon': false, Icon: 'lock', 'Country code': '+000', Suffix: ' '
  }, 'Verification code'),
  await primary('Verify'),
  await I('Link', { Size: 'Small', State: 'Default' }, { Label: 'Use a recovery code', 'Show icon': false }, 'Recovery link'),
  await I('Button', { Variant: 'Ghost', Size: 'Medium', State: 'Default' }, { Label: 'Sign out', 'Show icon': true, Icon: 'log-out' }, 'Sign out'),
  await policy('Block', 'R-11', 'Not selected. R11-a: nothing is available until 2FA is complete. R11-b: only admin actions wait; Check in is allowed.', 'Policy R-11')
]);
const readings = AL('R-11 readings', 'HORIZONTAL', { gap: 12 });
add(fTwo, [readings], true);
for (const [tag, body] of [['R11-a · not selected', 'Pending-2FA session: all business screens locked.'], ['R11-b · not selected', 'Pending-2FA session: My Day check-in available; Owner admin screens locked.']]) {
  const ci = await card('Card/Inset', 'Reading ' + tag.slice(0, 5), {}, 8);
  readings.appendChild(ci.node); ci.node.layoutSizingHorizontal = 'FILL'; grow(ci.node);
  const b = await I('Badge/Status', { Tone: 'Neutral', Size: 'Small' }, { Label: tag, 'Show dot': false }, 'Reading badge');
  const row = AL('Badge row', 'HORIZONTAL', {}); add(row, [b]);
  fillBody(ci, [row, await TX(body, 'ds/Body Small', 'text/secondary', { name: 'Reading body' })]);
}
add(fTwo, [await policy('Inline', 'Impl. decision', '2FA method is an implementation decision; the code entry is illustrative.', 'Implementation note', 'Implementation decision')], true);

// ---------- Annotations (designer notes, not product UI)
const notes = AL(F_NOTE, 'HORIZONTAL', { gap: 24 }); SEC.appendChild(notes); notes.x = M; notes.y = M + 900 + 48;
OUT.created[F_NOTE] = notes.id;
add(notes, [
  await I('Annotation', { Type: 'Interaction' }, { Title: 'Intended interactions', Body: 'Sign in → button Loading ("Signing in…") → role home. Owner → SCR-AUTH-002 2FA. "Show" toggles password masking. Enter submits. Forgot password? → SCR-AUTH-004.' }, 'Interaction note'),
  await I('Annotation', { Type: 'Note' }, { Title: 'Logo', Body: 'Brand/Logo is a placeholder: the Udigity logo file has not been supplied yet. No "Keep me signed in" option (would imply a session-lifetime decision).' }, 'Logo note')
]);

fitSection(SEC, M);
return OUT;
