// 13f-copy-touch-glyph.js — Design-System Maintainer — follow-up to 13e (OP-7 warning)
// Warning fixed: "Row/Phone › Copy touch glyph null ≠ Copy Icon/copy".
// In place, NO rebuild, NO detaching, NO clone/remove of canvas layers; every ID unchanged; idempotent.
// Page 21 DS — Components (36:3). Requires 13b + 13c + 13e (Copy touch 251:2671 in Row/Phone 55:2600).
// Fix = the same mechanism as the 32 px Copy: set the Copy touch instance's "Icon" INSTANCE_SWAP property
// to the component the Copy uses (Icon/copy). If the Touch variant's glyph layer is not bound to that property
// (or is not named "Icon"), the nested glyph instance is swapped directly to Icon/copy (an override; ID kept).
// Only Row/Phone › "Copy touch" is changed. The IconButton set itself is read only (reported, not edited).
// Returns before/after for property value, glyph layer, glyph component, size and visibility.
const page = await figma.getNodeByIdAsync('36:3');
if (!page || page.type !== 'PAGE') throw new Error('Page 36:3 not found');
await figma.setCurrentPageAsync(page);
const OUT = { found: {}, before: {}, after: {}, actions: [], measured: {}, changed: 0, skipped: [], warnings: [] };
const sz = n => `${Math.round(n.width)}×${Math.round(n.height)}`;
const main = async n => (n && n.type === 'INSTANCE' ? (n.getMainComponentAsync ? await n.getMainComponentAsync() : n.mainComponent) : null);
const pkey = (inst, name) => Object.keys(inst.componentProperties).find(k => k.split('#')[0] === name);
// glyph layer: the nested INSTANCE named "Icon" (as 13e/13c), else the first nested instance of an "Icon/…" component
async function glyphLayer(inst) {
  const named = inst.findOne(x => x.type === 'INSTANCE' && x.name === 'Icon');
  if (named) return named;
  for (const x of inst.findAll(x => x.type === 'INSTANCE')) { const m = await main(x); if (m && m.name.startsWith('Icon/')) return x; }
  return null;
}
async function state(inst) {
  const g = await glyphLayer(inst), gm = await main(g), ik = pkey(inst, 'Icon');
  let iconValue = ik ? inst.componentProperties[ik].value : null, iconValueName = null;
  if (iconValue) { const c = await figma.getNodeByIdAsync(iconValue); iconValueName = c ? c.name : null; }
  return { id: inst.id, size: sz(inst), visible: inst.visible, iconProp: ik || null, iconValue, iconValueName,
    glyphLayer: g ? `${g.name} ${g.id}` : null, glyph: gm ? gm.name : null, glyphBound: !!(g && g.componentPropertyReferences && g.componentPropertyReferences.mainComponent) };
}

// ---------------- identify (ID + exact name + type; fallback unique name)
const RP0 = await figma.getNodeByIdAsync('55:2600');
const RP = RP0 && RP0.type === 'COMPONENT' && RP0.name === 'Row/Phone' ? RP0
  : (() => { const a = page.findAll(x => x.type === 'COMPONENT' && x.name === 'Row/Phone'); return a.length === 1 ? a[0] : null; })();
OUT.found['Row/Phone'] = RP ? RP.id : 'not found / ambiguous';
const IB = await figma.getNodeByIdAsync('45:405');
OUT.found.IconButton = IB && IB.type === 'COMPONENT_SET' && IB.name === 'IconButton' ? IB.id : 'not found';
if (!RP || OUT.found.IconButton === 'not found') { OUT.skipped.push('Row/Phone or IconButton set not found; nothing changed'); return OUT; }
const inSet = async n => { const m = await main(n); return !!(m && m.parent && m.parent.id === IB.id); };
const kids = name => RP.children.filter(c => c.type === 'INSTANCE' && c.name === name);
const cps = [], cts = [];
for (const c of kids('Copy')) if (await inSet(c)) cps.push(c);
for (const c of kids('Copy touch')) if (await inSet(c)) cts.push(c);
if (cps.length !== 1 || cts.length !== 1) { OUT.skipped.push(`Row/Phone: expected 1 "Copy" and 1 "Copy touch" IconButton, found ${cps.length}/${cts.length}; run 13e first; unchanged`); return OUT; }
const cp = cps[0], ct = cts[0];
OUT.found.copy = cp.id; OUT.found.copyTouch = ct.id + (ct.id === '251:2671' ? '' : ' (expected 251:2671)');
const cpS = await state(cp);
OUT.found.copyState = cpS;
// target glyph component = what the 32 px Copy shows (property value first, else its glyph's main component)
const cpGlyph = await main(await glyphLayer(cp));
let target = cpS.iconValue ? await figma.getNodeByIdAsync(cpS.iconValue) : null;
if (!target || target.name !== 'Icon/copy') target = cpGlyph && cpGlyph.name === 'Icon/copy' ? cpGlyph : null;
if (!target) { const a = page.findAll(x => x.type === 'COMPONENT' && x.name === 'Icon/copy'); target = a.length === 1 ? a[0] : null; }
if (!target) { OUT.skipped.push('Icon/copy component not found; unchanged'); return OUT; }
OUT.found.target = `${target.name} ${target.id}`;

// read-only diagnostics on the Touch master variant used by Copy touch
{
  const m = await main(ct), mg = m ? await glyphLayer(m) : null;
  OUT.found.touchVariant = m ? { id: m.id, name: m.name, glyphLayer: mg ? `${mg.name} ${mg.id}` : null,
    glyphRefs: mg ? mg.componentPropertyReferences || null : null } : null;
}

// ---------------- fix Copy touch
const wasVisible = ct.visible;
OUT.before = await state(ct);
// 1. same way as Copy: Icon instance-swap property
const ik = pkey(ct, 'Icon');
if (ik && ct.componentProperties[ik].value !== target.id) {
  ct.setProperties({ [ik]: target.id }); OUT.changed++; OUT.actions.push(`set ${ik} = ${target.id} (${target.name})`);
}
if (!ik) OUT.warnings.push('Copy touch has no "Icon" property; using nested swap');
// 2. fallback: glyph layer not following the property → swap the nested glyph instance (override, ID kept)
{
  const g = await glyphLayer(ct), gm = await main(g);
  if (!g) OUT.warnings.push('Copy touch has no nested icon instance; cannot set glyph');
  else if (!gm || gm.id !== target.id) {
    const gid = g.id; g.swapComponent(target); OUT.changed++; OUT.actions.push(`swapComponent ${g.name} ${gid} → ${target.name}`);
    if (g.id !== gid) OUT.warnings.push(`glyph layer id changed ${gid} → ${g.id}`);
  }
}
if (ct.visible !== wasVisible) { ct.visible = wasVisible; OUT.warnings.push('visibility restored'); }
OUT.after = await state(ct);
if (OUT.after.glyph !== 'Icon/copy') OUT.warnings.push(`Row/Phone › Copy touch glyph ${OUT.after.glyph} ≠ Copy Icon/copy`);
if (OUT.after.id !== OUT.before.id) OUT.warnings.push('Copy touch id changed');
if (OUT.after.size !== OUT.before.size) OUT.warnings.push(`Copy touch size changed ${OUT.before.size} → ${OUT.after.size}`);

// ---------------- verify in a temporary instance (touch ON), then remove it
{
  const i = RP.createInstance(); i.x = RP.x; i.y = RP.y + RP.height + 600;
  try {
    const p = {};
    for (const [n, v] of [['Show copy', false], ['Show copy (touch)', true]]) { const k = pkey(i, n); if (k) p[k] = v; }
    i.setProperties(p);
    const l = i.findOne(x => x.name === 'Copy touch');
    const g = l ? await glyphLayer(l) : null, gm = await main(g);
    OUT.measured.instanceTouch = { instance: sz(i), copyTouch: l ? (l.visible ? sz(l) : 'hidden') : 'missing', glyph: gm ? gm.name : null };
    if (!gm || gm.name !== 'Icon/copy') OUT.warnings.push('temporary instance: Copy touch glyph ' + (gm ? gm.name : null));
  } finally { i.remove(); }
}
OUT.measured.component = sz(RP);
return OUT;
