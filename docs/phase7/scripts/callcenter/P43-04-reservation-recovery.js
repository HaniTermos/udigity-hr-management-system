// P43-04-reservation-recovery.js — Call Center role agent — Phase 7 prototype wiring — page 43 (96:5). Version CC-P7-1, 2026-10-23.
// F3 Reservation conflicts and recovery (timer states as separate flows).
// Idempotent: setReactionsAsync replaces each hotspot's reactions; setFlow replaces by node/name. No Figma structure changes, no detach, no x/y/size.
// Frames by full name, ID fallback. Returns {wired, missingTargets, missingHotspots, flows} (+ errors, notes, counts). Flow map: docs/phase7/flows/callcenter.md.
// ---- Page + helpers (inlined from docs/phase7/wiring-helpers.js, validated in [OP-P7-1]) ----
const PAGE_ID = '96:5'; // page 43 — Call Center
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') return { error: 'Page 96:5 not found' };
await figma.setCurrentPageAsync(page);

const FILE_KEY = 'GNrhb3DWa6mIhEX6F4Nmvw';
const DISSOLVE_200 = { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.2 };
const SMART_250 = { type: 'SMART_ANIMATE', easing: { type: 'EASE_OUT' }, duration: 0.25 };
const INSTANT = null;
const D = DISSOLVE_200, SA = SMART_250, I = INSTANT;

let _frames = null;
function frameByName(nameOrRe) {
  if (!_frames) _frames = figma.currentPage.findAllWithCriteria({ types: ['FRAME'] })
    .filter(f => f.parent && (f.parent.type === 'PAGE' || f.parent.type === 'SECTION'));
  const test = nameOrRe instanceof RegExp ? (n) => nameOrRe.test(n) : (n) => n === nameOrRe;
  return _frames.find(f => test(f.name)) || null;
}
const nav = (destId, transition = DISSOLVE_200) =>
  ({ type: 'NODE', destinationId: destId, navigation: 'NAVIGATE', transition, resetScrollPosition: true });
const url = (nodeIdOrUrl) => ({
  type: 'URL', openInNewTab: false,
  url: /^https?:/.test(nodeIdOrUrl) ? nodeIdOrUrl
    : `https://www.figma.com/design/${FILE_KEY}?node-id=${String(nodeIdOrUrl).replace(':', '-')}`,
});
const back = () => ({ type: 'BACK' });
async function onClick(node, action, report) {
  if (!node) return false;
  try { await node.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [action] }]); return true; }
  catch (e) { if (report) report.push({ id: node.id, name: node.name, err: String(e) }); return false; }
}
function setFlow(frame, name) {
  const pg = figma.currentPage;
  const keep = pg.flowStartingPoints.filter(f => f.nodeId !== frame.id && f.name !== name);
  pg.flowStartingPoints = [...keep, { nodeId: frame.id, name }];
  return { nodeId: frame.id, name };
}

// ---- Frame table: lookup by full name, ID fallback (phase6/previews/43/index.md, OP-14) ----
const S = {
  q: 'SCR-CC-001 — Calling queue', ws: 'SCR-CC-002 — Contact workspace', ac: 'SCR-CC-003 — Active contact — log attempt & outcome',
  fu: 'SCR-CC-004 — Follow-ups & calendar', rs: 'SCR-CC-005 — Contact reservation & concurrency block',
  dr: 'SCR-CC-006 — Follow-up create / reschedule (drawer)', op: 'SCR-CC-007 — Opportunities & developer handoff', dnc: 'SCR-CC-008 — Do-not-call list & reopening',
};
const FT = {
  q: [S.q, 'Desktop — Light', '311:13767'], qML: [S.q, 'Mobile — Light', '311:15277'], qMD: [S.q, 'Mobile — Dark', '311:15490'],
  ws: [S.ws, 'Desktop — Light', '312:13759'], wsRej: [S.ws, 'Desktop — Light — Start Contact disabled (Rejected)', '312:14821'],
  wsML: [S.ws, 'Mobile — Light', '312:15793'], wsMD: [S.ws, 'Mobile — Dark', '312:15962'], wsMRej: [S.ws, 'Mobile — Light — Rejected', '312:16130'],
  ac: [S.ac, 'Desktop — Light', '283:13815'], acHold: [S.ac, 'Desktop — Light — On hold', '313:13735'], acRej: [S.ac, 'Desktop — Light — Rejected', '313:14327'],
  acAcc: [S.ac, 'Desktop — Light — Accepted (developer deferred)', '313:14927'], acFail: [S.ac, 'Desktop — Light — Save failed', '313:15568'],
  acConf: [S.ac, 'Desktop — Light — Save conflict', '313:16173'], acML: [S.ac, 'Mobile — Light', '283:15034'], acMD: [S.ac, 'Mobile — Dark', '283:15220'],
  acMS: [S.ac, 'Mobile — Light — Success', '283:15404'],
  fu: [S.fu, 'Desktop — Light', '285:13809'], fuWeek: [S.fu, 'Desktop — Light — Week calendar', '285:14637'],
  fuCancel: [S.fu, 'Desktop — Light — Cancel with reason (D2 guard)', '285:15019'], fuML: [S.fu, 'Mobile — Light', '285:15486'], fuMD: [S.fu, 'Mobile — Dark', '285:15628'],
  rsReserved: [S.rs, 'Desktop — Light — Reserved by another agent', '314:13735'], rsOverride: [S.rs, 'Desktop — Light — Owner force override', '314:14787'],
  rsOverridden: [S.rs, 'Desktop — Light — Overridden by Owner (notice to holder)', '314:15266'], rsExpiring: [S.rs, 'Desktop — Light — Expiring', '261:13797'],
  rsExpired: [S.rs, 'Desktop — Light — Reservation expired', '261:14421'], rsNet: [S.rs, 'Desktop — Light — Network loss', '261:15023'],
  rsStale: [S.rs, 'Desktop — Light — Stale client', '261:15620'], rsMReserved: [S.rs, 'Mobile — Light — Reserved by another agent', '261:16192'],
  rsMExpired: [S.rs, 'Mobile — Light — Reservation expired', '261:16322'],
  drCreate: [S.dr, 'Desktop — Light — Create', '315:13720'], drResched: [S.dr, 'Desktop — Light — Reschedule', '315:14328'],
  drPast: [S.dr, 'Desktop — Light — Past time rejected', '315:14610'], drConf: [S.dr, 'Desktop — Light — Save conflict', '315:14902'],
  drOK: [S.dr, 'Desktop — Light — Success', '315:15170'], drMCreate: [S.dr, 'Mobile — Light — Create', '315:15364'], drMPast: [S.dr, 'Mobile — Light — Past time rejected', '315:15441'],
  op: [S.op, 'Desktop — Light', '316:13709'], opDev: [S.op, 'Desktop — Light — Developer assigned', '316:14338'],
  dnc: [S.dnc, 'Desktop — Light', '316:15211'], dncReopen: [S.dnc, 'Desktop — Light — Owner reopen (reason)', '316:15724'], dncReopened: [S.dnc, 'Desktop — Light — Reopened', '316:16113'],
};
// Cross-page OPEN_URL targets (current IDs; stale 175:* spec IDs replaced)
const XU = {
  SHR009D: '310:13530', // SCR-SHR-009 — Submit data correction (drawer) — Desktop — Light — Open request warning (p42)
  SHR009M: '310:14186', // SCR-SHR-009 — … — Mobile — Light — Sheet (p42)
  SHR008M: '310:13164', // SCR-SHR-008 — Business detail — Mobile — Light (p42)
  SHR001D: '303:10513', // SCR-SHR-001 — My Day — Desktop — Light (p40)
  SHR001M: '303:11195', // SCR-SHR-001 — My Day — Mobile — Light (p40)
  SHR001MD: '303:11447', // SCR-SHR-001 — My Day — Mobile — Dark (p40)
  DEV004: '304:13135',  // SCR-DEV-004 — Meeting schedule / record — Desktop — Light — Reschedule (p44)
};
const OUT = { wired: [], missingTargets: [], missingHotspots: [], flows: [], errors: [], skipped: [] };
const FR = {};
for (const k of Object.keys(FT)) {
  const [scr, suf, id] = FT[k]; const full = scr + ' — ' + suf;
  let f = frameByName(full), via = 'name';
  if (!f) { const n = await figma.getNodeByIdAsync(id); if (n && n.type === 'FRAME') { f = n; via = 'id'; } }
  FR[k] = f; if (f && via === 'id') OUT.skipped.push(`${k}: found by ID fallback ${id} (name "${f.name}")`);
}
const fr = (k) => FR[k] || null;

// ---- Hotspot lookup ----
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function vis(n, root) { for (let p = n; p && p !== root; p = p.parent) if (p.visible === false) return false; return true; }
function scopeIn(frame, scope) {
  if (!scope) return frame;
  return frame.findOne(n => n.type !== 'TEXT' && scope.test(n.name) && vis(n, frame)) || null;
}
function clickableOf(t, root) {
  let p = t.parent;
  while (p && p !== root && p.type !== 'INSTANCE' && p.type !== 'FRAME') p = p.parent;
  return p && p !== root ? p : t;
}
const PFX = '(?:Button|Link|Nav/Item|Row|Item|Outcome|Chip|Event|Toast|Tab) · ';
// spec: 'Label' | RegExp (on label) | { name: RegExp, text: RegExp|string, scope: RegExp, filter: fn }
function hs(frame, spec) {
  if (!frame) return null;
  const o = (typeof spec === 'string' || spec instanceof RegExp) ? { label: spec } : spec;
  const root = scopeIn(frame, o.scope); if (!root) return null;
  const ok = (n) => vis(n, frame) && (!o.filter || o.filter(n));
  let nameRe = o.name, textRe = o.text;
  if (o.label != null) {
    const lab = o.label instanceof RegExp ? o.label.source : '^' + esc(o.label) + '$';
    const body = lab.replace(/^\^/, '').replace(/\$$/, '');
    nameRe = nameRe || new RegExp('^(?:' + PFX + ')?' + body + '$', 'i');
    textRe = textRe || new RegExp('^\\s*' + body + '\\s*$', 'i');
  }
  if (typeof textRe === 'string') textRe = new RegExp('^\\s*' + esc(textRe) + '\\s*$', 'i');
  if (nameRe) { const h = root.findOne(n => n.type !== 'TEXT' && nameRe.test(n.name) && ok(n)); if (h) return h; }
  if (textRe) {
    const t = root.findOne(n => n.type === 'TEXT' && textRe.test(n.characters) && vis(n, frame));
    if (t) { const c = clickableOf(t, frame); if (!o.filter || o.filter(c)) return c; }
  }
  return null;
}
// Control matching `spec` nearest to an anchor text (e.g. the "Reschedule" button on the Olive row).
function near(frame, anchor, spec) {
  if (!frame) return null;
  const are = anchor instanceof RegExp ? anchor : new RegExp(esc(anchor), 'i');
  const a = frame.findOne(n => n.type === 'TEXT' && are.test(n.characters) && vis(n, frame)); if (!a) return null;
  for (let p = a.parent; p && p !== frame; p = p.parent) { const h = hs(p, spec); if (h && h !== p) return h; }
  return null;
}
// Mobile header back control (Shell/Mobile/Header, Back=True)
const BACKSPEC = { scope: /^Header$/, name: /back|chevron-left|arrow-left/i };
// Outcome RadioCards (not the small Badge/Outcome)
const CARD = (t) => ({ name: new RegExp('^Outcome · ' + esc(t), 'i'), filter: n => n.type === 'INSTANCE' && n.width >= 120 });

// ---- Wiring ----
// to: frame key | 'url:<id>' | 'BACK'
async function wire(fk, spec, to, tr = D, note) {
  const f = fr(fk); if (!f) { OUT.missingTargets.push(`source ${fk} (${FT[fk] ? FT[fk][2] : '?'})`); return false; }
  let action, toLabel = to;
  if (to === 'BACK') action = back();
  else if (String(to).startsWith('url:')) { action = url(to.slice(4)); }
  else { const t = fr(to); if (!t) { OUT.missingTargets.push(`${to} (${FT[to] ? FT[to][2] : '?'}) for ${fk}`); return false; } if (t === f) { OUT.skipped.push(`${fk}: self-target skipped`); return false; } action = nav(t.id, tr); }
  const n = typeof spec === 'function' ? spec(f) : hs(f, spec);
  const sLabel = typeof spec === 'function' ? 'custom' : (spec instanceof RegExp ? String(spec) : (typeof spec === 'string' ? spec : String(spec.label || spec.name || spec.text)));
  if (!n || n === f) { OUT.missingHotspots.push(`${fk} | ${sLabel}${note ? ' (' + note + ')' : ''}`); return false; }
  const ok = await onClick(n, action, OUT.errors);
  if (ok) OUT.wired.push(`${fk} | ${n.name} (${n.id}) → ${toLabel}`);
  return ok;
}
function flow(fk, name) {
  const f = fr(fk); if (!f) { OUT.missingTargets.push(`flow start ${fk} for "${name}"`); return; }
  OUT.flows.push(setFlow(f, name));
}
// Drop auto-created "Flow N" entries on Call Center frames (pilot gotcha); named P7 flows are kept.
function cleanAutoFlows() {
  const ids = new Set(Object.values(FR).filter(Boolean).map(f => f.id));
  const pg = figma.currentPage;
  pg.flowStartingPoints = pg.flowStartingPoints.filter(f => !(ids.has(f.nodeId) && /^Flow \d+$/.test(f.name)));
}
function done() {
  cleanAutoFlows();
  return { wired: OUT.wired, missingTargets: OUT.missingTargets, missingHotspots: OUT.missingHotspots, flows: OUT.flows, errors: OUT.errors, notes: OUT.skipped, counts: { wired: OUT.wired.length, missingTargets: OUT.missingTargets.length, missingHotspots: OUT.missingHotspots.length } };
}
// ---- end helpers ----

// ==== P43-04 body: F3 — Reservation conflicts and recovery (desktop + mobile Expired) ====
// Timer states: wiring-helpers.js only supports ON_CLICK, so there is no AFTER_TIMEOUT. Expired, Network loss
// and Stale client are therefore their own flow starting points; the banners are NOT wired as fake hotspots.
// B3-Q05 default (policy-defaults): Alt B — the attempt row and notes are kept, the outcome is not applied, and the
// agent reopens the contact → Stale client "Start contact again" goes to CC-003. The drawn Alt A/Alt B labels stay as they are (rule 6).
// Not here: chrome (P43-01), Request correction (P43-06), CC-005 mobile Reserved (P43-03).

// Expiring (main)
await wire('rsExpiring', { name: /^Link · Keep reservation$/, text: 'Keep reservation' }, 'ac', D, 'header link');
await wire('rsExpiring', { name: /^Button · Save, keep reservation$/, text: 'Save, keep reservation' }, 'ac', D);
await wire('rsExpiring', { name: /^Button · Save attempt$/, text: 'Save attempt' }, 'fu', D, 'no success frame; closest existing');
// Expired
await wire('rsExpired', 'Start contact again', 'ac', D);
await wire('rsExpired', 'Discard draft', 'ws', D);
// Network loss
await wire('rsNet', 'Retry now', 'ac', D, 'reconnected');
// Stale client (B3-Q05 Alt B)
await wire('rsStale', 'Start contact again', 'ac', D);
// "Copy notes": no feedback frame → not wired.
// Reserved by another agent
await wire('rsReserved', 'Back to queue', 'q', D);
await wire('rsReserved', { name: /^Row · Olive & Thyme Café$/ }, 'ws', D, 'left queue row');
// "Retry" (still held) would land on the same frame → no reaction.

// Owner override (Owner's view → holder Omar's view)
await wire('rsOverride', { scope: /^Dialog/, name: /^Button · Override reservation$/, text: 'Override reservation' }, 'rsOverridden', D, 'dialog confirm');
// "Wait instead": no Owner non-dialog frame on p43 → not wired (U-11). "Copy notes" on Overridden: no feedback frame.
await wire('rsOverridden', { scope: /^Breadcrumb$/, text: 'Calling Queue' }, 'q', D, 'breadcrumb (lands on Maya’s queue; D3 mismatch)');

// Mobile Expired (Light)
await wire('rsMExpired', 'Start contact again', 'acML', D);
await wire('rsMExpired', 'Discard draft', 'wsML', D);
await wire('rsMExpired', BACKSPEC, 'wsML', D, 'header back');

flow('rsExpiring', 'P7 — Call Center — Reservation recovery');
flow('rsExpired', 'P7 — Call Center — Reservation recovery (Expired)');
flow('rsNet', 'P7 — Call Center — Reservation recovery (Network loss)');
flow('rsStale', 'P7 — Call Center — Reservation recovery (Stale client)');
flow('rsReserved', 'P7 — Call Center — Reservation recovery (Reserved by another agent)');
flow('rsOverride', 'P7 — Call Center — Reservation recovery (Owner override)');
flow('rsMExpired', 'P7 — Call Center — Reservation recovery (mobile Expired)');
return done();
