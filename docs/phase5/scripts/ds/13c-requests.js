// 13c-requests.js — Design-System Maintainer — Phase 6 component requests O-1, DE-3, DE-4
// In place, NO rebuild, NO detaching; IDs unchanged; idempotent. Page 21 DS — Components (36:3).
// Root cause of O-1 and DE-4: variants cloned in 13 (Progress/Bar Percent) and 13b (IconButton Size=Touch) lost
// their componentPropertyReferences. So Progress/Bar labels ignored Show labels/Label/Value, and the Touch
// IconButton's Icon swap property did nothing (glyph fell back to the cloned default "more" = "…").
// O-1  Progress/Bar: copy the references from the legacy Percent=60 variant to every variant (Labels.visible,
//      Label.characters, Value.characters).
// DE-4 IconButton: copy references from the Size=Medium variant to every Touch variant (Icon.mainComponent,
//      Dot.visible); then set the Icon property explicitly: Dialog/Drawer Close = Icon/x, mobile header Back = Icon/chevron-left.
// X-1  = DE-4 root cause (Touch variants now linked to Icon#45:183 / Show dot#45:208).
// X-2  Input/Textarea/Select/Input/Date/Field/Metric Error variants: Helper row no longer bound to Show helper.
// DE-3 Table/Pagination: new properties — Show page controls (Previous/Pages/Next), Show page 2, Show page 3,
//      Show gap (…), Show last page (BOOLEAN); Page 2, Page 3, Last page, Per page (TEXT).
//      1 page: Show page controls=false (or hide 2/3/gap/last). 2 pages: hide 3/gap/last. 3: hide gap/last. 5: last=5.
const page = await figma.getNodeByIdAsync('36:3');
if (!page || page.type !== 'PAGE') throw new Error('Page 36:3 not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const OUT = { updated: { progress: 0, iconButton: 0, icons: [], pagination: {} }, warnings: [] };
const pv = name => Object.fromEntries(name.split(',').map(s => s.split('=').map(x => x.trim())));
// name → references map from a reference variant (not descending into instances)
function refMap(root) { const m = {}; const w = n => { if (!('children' in n)) return; for (const c of n.children) { const r = c.componentPropertyReferences; if (r && Object.keys(r).length) m[c.name] = r; if (c.type !== 'INSTANCE') w(c); } }; w(root); return m; }
function applyRefs(root, m) { let k = 0; const w = n => { if (!('children' in n)) return; for (const c of n.children) { const want = m[c.name]; if (want) { const cur = c.componentPropertyReferences || {}; if (Object.entries(want).some(([f, v]) => cur[f] !== v)) { c.componentPropertyReferences = Object.assign({}, cur, want); k++; } } if (c.type !== 'INSTANCE') w(c); } }; w(root); return k; }
async function loadT(t) { for (const s of t.getStyledTextSegments(['fontName'])) await figma.loadFontAsync(s.fontName); }

// ---- O-1 Progress/Bar
const PB = await figma.getNodeByIdAsync('51:1916');
{
  const ref = PB.children.find(c => pv(c.name).Percent === '60' && pv(c.name).Tone === 'Brand') || PB.children[0];
  const m = refMap(ref);
  for (const v of PB.children) OUT.updated.progress += applyRefs(v, m);
  const bad = PB.children.filter(v => Object.keys(refMap(v)).length < Object.keys(m).length).map(v => v.name);
  if (bad.length) OUT.warnings.push('Progress/Bar still unbound: ' + bad.join('; '));
}
// ---- DE-4 IconButton Touch references
const IB = await figma.getNodeByIdAsync('45:405');
{
  for (const v of IB.children) {
    const p = pv(v.name); if (p.Size !== 'Touch') continue;
    const ref = IB.children.find(c => c.name === `Variant=${p.Variant}, Size=Medium, State=${p.State}`);
    if (ref) OUT.updated.iconButton += applyRefs(v, refMap(ref));
  }
}
const icon = n => page.findOne(x => x.type === 'COMPONENT' && x.name === n);
const X = icon('Icon/x'), CHEV = icon('Icon/chevron-left');
function setIcon(inst, comp) {
  const k = Object.keys(inst.componentProperties).find(k => k.split('#')[0] === 'Icon');
  if (k && comp) { inst.setProperties({ [k]: comp.id }); }
  const g = inst.findOne(n => n.name === 'Icon' && n.type === 'INSTANCE');
  return g && g.mainComponent ? g.mainComponent.name : null;
}
for (const [id, label, filter, comp] of [['53:1818', 'Dialog', 'Close', X], ['53:1846', 'Drawer', 'Close', X], ['49:1219', 'Shell/Mobile/Header', 'Back', CHEV]]) {
  const own = await figma.getNodeByIdAsync(id);
  const comps = own.type === 'COMPONENT_SET' ? own.children : [own];
  for (const c of comps) for (const b of c.findAll(n => n.type === 'INSTANCE' && n.name === filter && n.mainComponent && n.mainComponent.parent && n.mainComponent.parent.id === IB.id)) {
    const glyph = setIcon(b, comp);
    OUT.updated.icons.push({ component: label, variant: own.type === 'COMPONENT_SET' ? c.name : undefined, id: b.id, glyph, w: Math.round(b.width), h: Math.round(b.height) });
    if (glyph !== comp.name) OUT.warnings.push(`${label} ${b.id} glyph ${glyph}`);
  }
}
// ---- DE-3 Table/Pagination
const PG = await figma.getNodeByIdAsync('51:1744');
{
  const defs = () => PG.componentPropertyDefinitions;
  const has = n => Object.keys(defs()).find(k => k.split('#')[0] === n);
  function prop(name, type, def, layers, field) {
    const key = has(name) || PG.addComponentProperty(name, type, def);
    for (const l of [].concat(layers)) { if (!l) { OUT.warnings.push('Pagination: missing layer for ' + name); continue; } l.componentPropertyReferences = Object.assign({}, l.componentPropertyReferences || {}, { [field]: key }); }
    return key;
  }
  const pages = PG.findOne(n => n.name === 'Pages');
  const btn = n => pages.children.find(c => c.name === 'Page ' + n) || pages.children.find(c => c.name === n);
  // rename page buttons/labels to stable names (idempotent)
  const b2 = btn('2'), b3 = btn('3'), gap = btn('…') || btn('Gap'), last = btn('25') || btn('Last');
  if (gap) gap.name = 'Page Gap'; if (last) last.name = 'Page Last';
  const lbl = b => b && b.findOne(n => n.type === 'TEXT');
  for (const [b, n] of [[b2, 'Page 2 label'], [b3, 'Page 3 label'], [last, 'Last page label']]) { const t = lbl(b); if (t) t.name = n; }
  const prev = PG.findOne(n => n.name === 'Previous'), next = PG.findOne(n => n.name === 'Next');
  const per = PG.findOne(n => n.type === 'TEXT' && n.name === 'Per page');
  const R = OUT.updated.pagination;
  R['Show page controls'] = prop('Show page controls', 'BOOLEAN', true, [prev, pages, next], 'visible');
  R['Show page 2'] = prop('Show page 2', 'BOOLEAN', true, b2, 'visible');
  R['Show page 3'] = prop('Show page 3', 'BOOLEAN', true, b3, 'visible');
  R['Show gap'] = prop('Show gap', 'BOOLEAN', true, gap, 'visible');
  R['Show last page'] = prop('Show last page', 'BOOLEAN', true, last, 'visible');
  R['Page 2'] = prop('Page 2', 'TEXT', '2', lbl(b2), 'characters');
  R['Page 3'] = prop('Page 3', 'TEXT', '3', lbl(b3), 'characters');
  R['Last page'] = prop('Last page', 'TEXT', '25', lbl(last), 'characters');
  R['Per page'] = prop('Per page', 'TEXT', '10 per page', per, 'characters');
  R.range = has('Range');
  PG.description = 'Table footer. Range text; page controls via properties (13c): 1 page → Show page controls=false (or hide page 2/3/gap/last); 2 pages → hide page 3, gap, last; 3 → hide gap, last; 5 → Last page "5"; many → defaults (1 2 3 … N). Per page text.';
}
// ---- X-2 field Error variants: the error row is always visible (no longer tied to Show helper); text stays on Error message
for (const [id, name] of [['45:796','Input'],['45:847','Textarea'],['46:434','Select'],['46:594','Input/Date'],['45:891','Field/Metric']]) {
  const s = await figma.getNodeByIdAsync(id); if (!s) continue;
  for (const v of s.children) {
    if (!/State=(Error|Empty error)/.test(v.name)) continue;
    const hr = v.findOne(n => n.name === 'Helper row'); if (!hr) continue;
    const r = Object.assign({}, hr.componentPropertyReferences || {}); delete r.visible; hr.componentPropertyReferences = r; hr.visible = true;
    const ic = v.findOne(n => n.name === 'Error icon'); if (ic) ic.visible = true;
  }
}
// ---- Field/Metric Type=Date variants (12c clones) lost references: copy from Type=Number counterparts
{
  const FM = await figma.getNodeByIdAsync('45:891');
  for (const v of FM.children.filter(c => c.name.startsWith('Type=Date'))) {
    const src = FM.children.find(c => c.name === v.name.replace('Type=Date', 'Type=Number')); if (!src) continue;
    const m = refMap(src);
    if (/Empty error/.test(v.name) && m['Helper row']) { const r = Object.assign({}, m['Helper row']); delete r.visible; m['Helper row'] = r; }
    applyRefs(v, m);
  }
}
return OUT;
