// 12b-owner-icon.js — Design-System Agent — Phase 5
// Recolours the icon of the Owner sidebar's active nav item (and the Nav/Item Active variants) to icon/on-brand-active.
// Robust lookup: every VECTOR inside the item's icon slot = the first INSTANCE/VECTOR child before the Label text.
// Idempotent; no rebuild; page 21 DS — Components (36:3).
await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('36:3'));
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const sem = cols.find(c => c.name === 'Semantic');
const v = (await figma.variables.getLocalVariablesAsync()).find(x => x.name === 'icon/on-brand-active' && x.variableCollectionId === sem.id);
if (!v) throw new Error('icon/on-brand-active missing');
const paint = () => figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }, 'color', v);
const pv = n => Object.fromEntries(n.split(', ').map(s => s.split('=').map(x => x.trim())));
const out = { items: [], vectors: [], notes: [] };
function iconNodeOf(item) {
  // first child (in layout order) that is an INSTANCE or VECTOR and is not the badge or indicator
  const kids = 'children' in item ? item.children : [];
  return kids.find(k => (k.type === 'INSTANCE' || k.type === 'VECTOR') && !/badge|indicator/i.test(k.name)) || null;
}
function recolor(iconNode) {
  const vecs = iconNode.type === 'VECTOR' ? [iconNode] : iconNode.findAllWithCriteria({ types: ['VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'RECTANGLE', 'LINE'] });
  for (const n of vecs) {
    if (n.strokes && n.strokes.length) n.strokes = [paint()];
    if (n.fills && n.fills.length) n.fills = [paint()];
    out.vectors.push(n.id);
  }
}
async function byIdOrName(id, name) { let n = await figma.getNodeByIdAsync(id); if (!n || n.name !== name) n = figma.currentPage.findAllWithCriteria({ types: ['COMPONENT_SET'] }).find(x => x.name === name) || null; return n; }
const isActive = async inst => { const mc = await inst.getMainComponentAsync(); return !!(mc && mc.parent && mc.parent.type === 'COMPONENT_SET' && mc.parent.name === 'Nav/Item' && pv(mc.name).State === 'Active'); };
// 1. Owner sidebar active item(s)
const sidebar = await byIdOrName('49:976', 'Nav/Sidebar');
if (!sidebar || sidebar.type !== 'COMPONENT_SET') throw new Error('Nav/Sidebar 49:976 not found');
const owner = sidebar.children.find(c => pv(c.name).Role === 'Owner');
for (const inst of owner.findAllWithCriteria({ types: ['INSTANCE'] })) {
  if (!(await isActive(inst))) continue;
  const ic = iconNodeOf(inst);
  if (!ic) { out.notes.push('no icon child in ' + inst.name); continue; }
  recolor(ic); out.items.push({ item: inst.id, name: inst.name, icon: ic.id, iconName: ic.name });
}
// 2. Nav/Item Active variants (source of truth for all sidebars)
const nav = await byIdOrName('49:652', 'Nav/Item');
if (nav && nav.type === 'COMPONENT_SET') for (const vr of nav.children.filter(c => pv(c.name).State === 'Active')) {
  const ic = iconNodeOf(vr); if (ic) { recolor(ic); out.items.push({ item: vr.id, name: vr.name, icon: ic.id, iconName: ic.name }); }
}
return out;
