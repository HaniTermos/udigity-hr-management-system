// 12d-logo-focus.js — Design-System Agent — Phase 5 (Udigity Management System)
// MF-16: Brand/Logo placeholder box hugs its caption (all Size × Surface variants).
// MF-17: field focus ring made even on all sides (Input, Textarea, Select, Input/Date, Input/Search).
// In place, NO rebuild: component/variant IDs unchanged, instances keep working. Idempotent (re-run safe).
// Page 21 DS — Components (36:3). Run with use_figma.
const PAGE_ID = '36:3';
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const _cols = await figma.variables.getLocalVariableCollectionsAsync();
const semCol = _cols.find(c => c.name === 'Semantic'), primCol = _cols.find(c => c.name === 'Primitives');
if (!semCol || !primCol) throw new Error('Run 01-variables.js first');
const V = {};
for (const v of await figma.variables.getLocalVariablesAsync()) {
  if (v.variableCollectionId === semCol.id) V[v.name] = v;
  else if (v.variableCollectionId === primCol.id) V['p/' + v.name] = v;
}
function vv(n) { const v = V[n]; if (!v) throw new Error('Missing variable ' + n); return v; }
function P(n) { return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', vv(n)); }
function bnum(n, field, vname, raw) { const v = V[vname]; if (v) n.setBoundVariable(field, v); else n[field] = raw; }
function pad(n, t, r) { [['paddingTop', t], ['paddingBottom', t], ['paddingLeft', r], ['paddingRight', r]].forEach(([f, x]) => bnum(n, f, 'p/space/' + x, x)); }
const pv = name => Object.fromEntries(name.split(',').map(s => s.split('=').map(x => x.trim())));
async function byIdOrName(id, name) {
  let n = await figma.getNodeByIdAsync(id);
  if (!n || n.type !== 'COMPONENT_SET' || n.name !== name) n = page.findOne(x => x.type === 'COMPONENT_SET' && x.name === name);
  if (!n) throw new Error('Component not found: ' + name + ' (run earlier DS scripts first)');
  return n;
}
// first descendant by name, without descending into instances
function findLocal(root, name) {
  if (!('children' in root)) return null;
  for (const c of root.children) { if (c.name === name) return c; if (c.type !== 'INSTANCE') { const r = findLocal(c, name); if (r) return r; } }
  return null;
}
function insideInstance(n) { for (let p = n.parent; p; p = p.parent) if (p.type === 'INSTANCE') return true; return false; }
const OUT = { updated: { logo: [], logoInstances: [], focus: [] }, notes: [] };

// ---------------- MF-16 Brand/Logo: hug the caption ----------------
const LOGO_NAME = 'Brand/Logo (placeholder — awaiting supplied file)';
const LOGO = await byIdOrName('44:342', LOGO_NAME);
const MIN = { Small: [132, 32], Medium: [168, 40], Large: [220, 56] };   // original box sizes = minimums
const PADS = { Small: [6, 12], Medium: [6, 12], Large: [8, 16] };
for (const v of LOGO.children) {
  if (v.type !== 'COMPONENT') continue;
  const p = pv(v.name), sz = p.Size || 'Medium';
  v.layoutMode = 'VERTICAL';
  v.primaryAxisAlignItems = 'CENTER'; v.counterAxisAlignItems = 'CENTER';
  v.primaryAxisSizingMode = 'AUTO'; v.counterAxisSizingMode = 'AUTO';   // hug width + height
  pad(v, PADS[sz][0], PADS[sz][1]);
  v.minWidth = MIN[sz][0]; v.minHeight = MIN[sz][1];
  v.clipsContent = false;
  for (const t of v.children.filter(c => c.type === 'TEXT')) {
    t.textAutoResize = 'WIDTH_AND_HEIGHT'; t.textAlignHorizontal = 'CENTER';
    t.layoutSizingHorizontal = 'HUG';
  }
  OUT.updated.logo.push({ id: v.id, variant: v.name, w: Math.round(v.width), h: Math.round(v.height) });
}
// tidy the set grid (rows = Size, cols = Surface), sizes changed
{
  const rows = ['Small', 'Medium', 'Large'], cols = ['Default', 'On brand'];
  const colW = Math.max(...LOGO.children.map(c => c.width)) + 24;
  let y = 24;
  for (const r of rows) {
    const inRow = LOGO.children.filter(c => pv(c.name).Size === r); if (!inRow.length) continue;
    for (const c of inRow) { c.x = 24 + Math.max(0, cols.indexOf(pv(c.name).Surface)) * colW; c.y = y; }
    y += Math.max(...inRow.map(c => c.height)) + 24;
  }
  let mx = 0, my = 0; for (const c of LOGO.children) { mx = Math.max(mx, c.x + c.width); my = Math.max(my, c.y + c.height); }
  LOGO.resizeWithoutConstraints(mx + 24, my + 24);
}
LOGO.description = 'Placeholder for the Udigity logo — awaiting supplied file. Do not draw a logo. Box hugs its text (min sizes Small 132×32, Medium 168×40, Large 220×56) so the caption never overflows (12d).';
// instances that were resized to a FIXED size would still clip/overflow: set them back to hug.
// Only instances that are NOT inside another instance (never touch instance children).
// operator fix (run 30): removed `await figma.loadAllPagesAsync();` — "not a supported API" in use_figma; getInstancesAsync works without it
for (const v of LOGO.children) {
  if (v.type !== 'COMPONENT') continue;
  for (const inst of await v.getInstancesAsync()) {
    if (insideInstance(inst)) continue;
    try {
      const before = [inst.layoutSizingHorizontal, inst.layoutSizingVertical];
      if (before[0] === 'FIXED') inst.layoutSizingHorizontal = 'HUG';
      if (before[1] === 'FIXED') inst.layoutSizingVertical = 'HUG';
      if (before[0] === 'FIXED' || before[1] === 'FIXED') OUT.updated.logoInstances.push({ id: inst.id, before, w: Math.round(inst.width) });
    } catch (e) { OUT.notes.push('logo instance ' + inst.id + ': ' + e.message); }
  }
}

// ---------------- MF-17 field focus ring: even on all sides ----------------
// Cause: the outer ds/Focus ring shadow (spread 2+4) on the full-width "Control" is clipped left/right by the
// field root / layout parents, while top/bottom show → thick top/bottom, 1 px sides.
// Fix: fields draw focus INSIDE their own bounds — 2 px focus-ring stroke (Semantic `focus-ring`), INSIDE,
// on all four sides, no outer shadow. Size/layout unchanged (strokes are not in layout).
const FIELDS = [['45:796', 'Input', false], ['45:847', 'Textarea', false], ['46:434', 'Select', false], ['46:594', 'Input/Date', false], ['46:748', 'Input/Search', true]];
for (const [id, name, rootIsControl] of FIELDS) {
  let set; try { set = await byIdOrName(id, name); } catch (e) { OUT.notes.push(e.message); continue; }
  for (const v of set.children) {
    if (v.type !== 'COMPONENT') continue;
    const st = pv(v.name).State;
    if (st !== 'Focus' && st !== 'Open') continue;
    const ctl = rootIsControl ? v : findLocal(v, 'Control');
    if (!ctl) { OUT.notes.push(name + ' › ' + v.name + ': no "Control" layer'); continue; }
    await ctl.setEffectStyleIdAsync('');
    ctl.effects = [];
    ctl.strokes = [P('focus-ring')];
    ctl.strokeAlign = 'INSIDE';
    ctl.strokeWeight = 2;
    if ('strokeTopWeight' in ctl) { ctl.strokeTopWeight = 2; ctl.strokeBottomWeight = 2; ctl.strokeLeftWeight = 2; ctl.strokeRightWeight = 2; }
    v.clipsContent = false;
    OUT.updated.focus.push({ id: v.id, set: name, variant: v.name, control: ctl.id });
  }
  set.description = (set.description || '').replace(/\s*Focus: .*$/, '') + ' Focus: 2 px inside focus-ring stroke on all sides (no outer shadow; 12d).';
}
return OUT;
