// 13-phase6-prep.js — Design-System Maintainer — Phase 6 prep (Udigity Management System)
// In place, NO rebuild, NO detaching: existing component/variant IDs unchanged. Idempotent (re-run safe).
// Only main components on page 21 DS — Components (36:3) are edited.
// P5  Progress/Bar: new VARIANT axis Percent = 0,5,…,100 (Tone × Percent = 84 variants). The 4 existing variants
//     become "Percent=60" (IDs kept). Each variant: root VERTICAL auto layout, FIXED default 320, minWidth 80, so
//     instances can be FILL/any width. Track = FILL frame (no auto layout, clips) whose "Fill" rectangle is
//     Percent% wide with constraint SCALE: when the instance stretches, Figma scales the Fill with the track, so the
//     ratio is kept without any screen script touching instance children. 0% = Fill hidden. Labels stay optional.
//     Usage: setProperties({ Percent: '45' }) + Label/Value text; set the instance to FILL in an auto-layout parent.
// P2/P3 Dialog / Notice/Duplicate: scan for raw bracket copy ("[DEC-003 …]") and replace with readable policy copy;
//     fix the shadow corner notches: ds/Elevation shadows use a negative spread, which Figma only honours on frames
//     with a visible fill AND clipsContent=true. Dialog (and the other elevated overlays Menu, Toast, Drawer) get
//     clipsContent=true; Dialog also gets a 1px border/subtle stroke so its edge reads on white surfaces.
// P6  Button Size=Large: every state ≥ 44 px tall (minHeight 44; FIXED 48 kept). Heights returned.
const PAGE_ID = '36:3';
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const _cols = await figma.variables.getLocalVariableCollectionsAsync();
const semCol = _cols.find(c => c.name === 'Semantic');
const V = {};
for (const v of await figma.variables.getLocalVariablesAsync()) if (semCol && v.variableCollectionId === semCol.id) V[v.name] = v;
function P(n) { const v = V[n]; if (!v) throw new Error('Missing variable ' + n); return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', v); }
const pv = name => Object.fromEntries(name.split(',').map(s => s.split('=').map(x => x.trim())));
async function byIdOrName(id, name, types) {
  let n = await figma.getNodeByIdAsync(id);
  if (!n || !types.includes(n.type) || n.name !== name) n = page.findOne(x => types.includes(x.type) && x.name === name && !(x.parent && x.parent.type === 'COMPONENT_SET'));
  return n || null;
}
async function loadFonts(t) {
  const segs = t.characters.length ? t.getStyledTextSegments(['fontName']) : [{ fontName: t.fontName }];
  for (const s of segs) if (s.fontName && s.fontName !== figma.mixed) await figma.loadFontAsync(s.fontName);
}
const OUT = { updated: { progress: { set: null, kept: [], created: [], fit: null }, overlays: [], copy: [], button: [] }, skipped: [], warnings: [], notes: [] };

// =====================================================================  P5 Progress/Bar
const TONES = ['Brand', 'Success', 'Warning', 'Danger'];
const PCTS = Array.from({ length: 21 }, (_, i) => String(i * 5));
const LEGACY_PCT = '60'; // legacy Fill was 198/320 ≈ 62 % ("5h 34m of 9h")
const PB = await byIdOrName('51:1916', 'Progress/Bar', ['COMPONENT_SET']);
function shapeVariant(v, pct) {
  const log = [];
  v.layoutMode = 'VERTICAL';
  if (v.width < 80) v.resize(320, v.height); // resize() before sizing modes (it resets them to FIXED)
  v.counterAxisSizingMode = 'FIXED'; v.primaryAxisSizingMode = 'AUTO';
  v.minWidth = 80; try { v.maxWidth = null; } catch (e) {}
  const labels = v.children.find(c => c.name === 'Labels');
  if (labels) {
    labels.layoutSizingHorizontal = 'FILL';
    labels.primaryAxisAlignItems = 'MIN'; labels.counterAxisAlignItems = 'CENTER';
    for (const k of labels.children) {
      if (k.type !== 'TEXT') continue;
      if (k.name === 'Label') { k.textAutoResize = 'HEIGHT'; k.layoutSizingHorizontal = 'FILL'; k.textTruncation = 'ENDING'; k.maxLines = 1; }
      else if (k.name === 'Value') { k.layoutGrow = 0; k.textAutoResize = 'WIDTH_AND_HEIGHT'; }
    }
  } else log.push('no Labels row');
  const track = v.children.find(c => c.name === 'Track');
  if (!track) { log.push('no Track'); return log; }
  if (track.layoutMode && track.layoutMode !== 'NONE') { track.layoutMode = 'NONE'; log.push('Track auto layout removed'); }
  track.layoutSizingHorizontal = 'FILL'; track.layoutSizingVertical = 'FIXED';
  if (Math.round(track.height) !== 8) track.resize(track.width, 8);
  track.clipsContent = true;
  const fill = track.children.find(c => c.name === 'Fill');
  if (!fill) { log.push('no Fill'); return log; }
  const p = Number(pct);
  const w = Math.max(1, Math.round(track.width * p / 100));
  fill.constraints = { horizontal: 'SCALE', vertical: 'STRETCH' };
  fill.resize(w, track.height); fill.x = 0; fill.y = 0;
  fill.constraints = { horizontal: 'SCALE', vertical: 'STRETCH' };
  fill.visible = p > 0;
  return log;
}
if (!PB) OUT.skipped.push('Progress/Bar: component set not found');
else {
  OUT.updated.progress.set = PB.id;
  // 1. legacy variants (no Percent) → Percent=60, IDs unchanged
  for (const v of PB.children.filter(c => c.type === 'COMPONENT' && !('Percent' in pv(c.name)))) {
    const t = pv(v.name).Tone; v.name = `Tone=${t}, Percent=${LEGACY_PCT}`;
    OUT.updated.progress.kept.push({ id: v.id, variant: v.name });
  }
  // 2. ensure every Tone × Percent exists (clone from the tone's legacy/any variant) and shape all
  for (const tone of TONES) {
    const src = PB.children.find(c => c.name === `Tone=${tone}, Percent=${LEGACY_PCT}`) || PB.children.find(c => pv(c.name).Tone === tone);
    if (!src) { OUT.skipped.push('Progress/Bar: no source variant for Tone=' + tone); continue; }
    for (const pct of PCTS) {
      const name = `Tone=${tone}, Percent=${pct}`;
      let v = PB.children.find(c => c.name === name);
      if (!v) { v = src.clone(); PB.appendChild(v); v.name = name; OUT.updated.progress.created.push({ id: v.id, variant: name }); }
      try { const log = shapeVariant(v, pct); if (log.length) OUT.warnings.push(name + ': ' + log.join('; ')); }
      catch (e) { OUT.skipped.push('Progress/Bar › ' + name + ': ' + e.message); }
    }
  }
  // 3. lay out the set: columns = Tone, rows = Percent
  const cw = Math.max(...PB.children.map(c => c.width)) + 24, rh = Math.max(...PB.children.map(c => c.height)) + 20;
  for (const c of PB.children) { const p = pv(c.name); c.x = 24 + Math.max(0, TONES.indexOf(p.Tone)) * cw; c.y = 24 + Math.max(0, PCTS.indexOf(p.Percent)) * rh; }
  let mx = 0, my = 0; for (const c of PB.children) { mx = Math.max(mx, c.x + c.width); my = Math.max(my, c.y + c.height); }
  PB.resizeWithoutConstraints(mx + 24, my + 24);
  PB.description = 'Progress with optional labels (Show labels). Value-driven: pick Percent (0–100 in 5 % steps) — never resize the nested Fill. Width-agnostic: set the instance to FILL (or any width ≥ 80); the Fill scales with the track. Tone Warning/Danger for at-risk; the Value text states the number, so colour is not the only cue. (13-phase6-prep)';
  // doc note next to the set
  const g = PB.parent && PB.parent.name === 'doc · Progress/Bar' ? PB.parent : null;
  if (g) {
    const note = g.children.find(c => c.type === 'TEXT' && /resize the nested|Percent/.test(c.characters));
    if (note) { await loadFonts(note); note.characters = 'Value-driven and width-agnostic (Phase 6, script 13). Choose Percent = 0, 5, …, 100 and set the instance to FILL in an auto-layout parent; never resize the nested "Fill". Labels optional (Show labels). Tone Warning for at-risk; the text states the value, so colour is not the only cue.'; }
  }
  // 4. fit check: a temporary instance at 600 px FILL, Percent=45 → Fill ≈ 270
  try {
    const probe = figma.createAutoLayout('HORIZONTAL'); probe.name = '__pb_probe'; probe.fills = []; page.appendChild(probe); probe.x = -30000; probe.y = -30000;
    probe.resize(600, 40); probe.primaryAxisSizingMode = 'FIXED';
    const src = PB.children.find(c => c.name === 'Tone=Brand, Percent=45');
    const inst = src.createInstance(); probe.appendChild(inst); inst.layoutSizingHorizontal = 'FILL';
    const f = inst.findOne(n => n.name === 'Fill'), tr = inst.findOne(n => n.name === 'Track');
    const r1 = { instW: Math.round(inst.width), trackW: Math.round(tr.width), fillW: Math.round(f.width), ratio: +(f.width / tr.width).toFixed(3) };
    inst.setProperties({ Percent: '80' });
    const f2 = inst.findOne(n => n.name === 'Fill'), tr2 = inst.findOne(n => n.name === 'Track');
    const r2 = { percent: 80, fillW: Math.round(f2.width), ratio: +(f2.width / tr2.width).toFixed(3) };
    OUT.updated.progress.fit = { at600_45: r1, switchedTo80: r2, pass: Math.abs(r1.ratio - 0.45) < 0.02 && Math.abs(r2.ratio - 0.8) < 0.02 };
    if (!OUT.updated.progress.fit.pass) OUT.warnings.push('Progress/Bar fit check FAILED — Fill did not scale with the instance width; report to DS Maintainer.');
    probe.remove();
  } catch (e) { OUT.warnings.push('Progress/Bar fit check error: ' + e.message); for (const n of page.children.filter(c => c.name === '__pb_probe')) n.remove(); }
  OUT.updated.progress.variantCount = PB.children.length;
}

// =====================================================================  P3 overlay shadow artifacts
const OVERLAYS = [['53:1818', 'Dialog', true], ['53:1846', 'Drawer', false], ['51:1988', 'Menu', false], ['53:2032', 'Toast', false]];
for (const [id, name, border] of OVERLAYS) {
  const n = await byIdOrName(id, name, ['COMPONENT', 'COMPONENT_SET']);
  if (!n) { OUT.skipped.push(name + ': not found'); continue; }
  const comps = n.type === 'COMPONENT_SET' ? n.children.filter(c => c.type === 'COMPONENT') : [n];
  for (const c of comps) {
    const before = { clip: c.clipsContent, spread: (c.effects || []).map(e => e.spread || 0), stroke: c.strokes.length };
    const hasFill = Array.isArray(c.fills) && c.fills.some(f => f.visible !== false && (f.opacity == null || f.opacity > 0));
    const neg = (c.effects || []).some(e => e.type === 'DROP_SHADOW' && (e.spread || 0) !== 0);
    if (neg && !hasFill) OUT.warnings.push(name + ' › ' + c.name + ': shadow spread on a node without a visible fill — spread ignored');
    if (neg) c.clipsContent = true;
    if (border && !c.strokes.length) { c.strokes = [P(V['border/subtle'] ? 'border/subtle' : 'border/default')]; c.strokeWeight = 1; c.strokeAlign = 'INSIDE'; }
    OUT.updated.overlays.push({ id: c.id, component: name, variant: n.type === 'COMPONENT_SET' ? c.name : undefined, before, after: { clip: c.clipsContent, stroke: c.strokes.length } });
  }
}

// =====================================================================  P2 raw bracket copy
const COPY_TARGETS = [['55:2439', 'Notice/Duplicate'], ['53:1818', 'Dialog']];
const READABLE = 'What else may be shown is a pending policy decision (DEC-003).';
for (const [id, name] of COPY_TARGETS) {
  const n = await byIdOrName(id, name, ['COMPONENT', 'COMPONENT_SET']);
  if (!n) { OUT.skipped.push(name + ': not found (copy scan)'); continue; }
  const texts = n.findAll(x => x.type === 'TEXT' && /\[[^\]]*\]/.test(x.characters));
  for (const t of texts) {
    const old = t.characters;
    let s = old.replace(/\s*\[[^\]]*DEC-0*3[^\]]*\]/g, ' ' + READABLE).replace(/\s*\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ').trim();
    try { await loadFonts(t); t.characters = s; OUT.updated.copy.push({ id: t.id, in: name, from: old, to: s }); }
    catch (e) { OUT.skipped.push(name + ' text ' + t.id + ': ' + e.message); }
  }
}
if (!OUT.updated.copy.length) OUT.notes.push('P2: no bracket text inside Notice/Duplicate or Dialog components. The "[DEC-003 pending: what may be shown]" copy is SCREEN-LEVEL: dataentry/01-s4-business-form.js sets it as the Dialog Description on S4-N1 (Data Entry Agent must change it; suggested: "A matching business exists. Saving is blocked. What else may be shown is a pending policy decision (DEC-003).").');

// =====================================================================  P6 Button Large ≥ 44
const BTN = await byIdOrName('45:305', 'Button', ['COMPONENT_SET']);
if (!BTN) OUT.skipped.push('Button: not found');
else {
  for (const v of BTN.children.filter(c => c.type === 'COMPONENT')) {
    const p = pv(v.name); if (p.Size !== 'Large') continue;
    const h0 = Math.round(v.height);
    if (v.height < 44) { v.resize(v.width, 48); v.counterAxisSizingMode = 'FIXED'; }
    v.minHeight = 44;
    OUT.updated.button.push({ id: v.id, variant: v.name, before: h0, after: Math.round(v.height) });
  }
  const hs = OUT.updated.button.map(b => b.after);
  OUT.notes.push(`P6: Button Size=Large ${OUT.updated.button.length} variants, heights ${Math.min(...hs)}–${Math.max(...hs)} px (minHeight 44). Medium is 40 and Small 32 — use Large for mobile full-width actions; a screen instance can still be shrunk below 44 only by an explicit resize, which the operator should check on frames.`);
}
OUT.notes.push('Re-lay-out: Progress/Bar instances keep their variant (now Percent=60); set Percent and toggle FIXED→FILL on placed instances. Dialog instances now clip — check slot content is inside the 24 px padding.');
return OUT;
