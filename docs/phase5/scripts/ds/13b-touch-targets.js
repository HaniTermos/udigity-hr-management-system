// 13b-touch-targets.js — Design-System Maintainer — Phase 6, Component request CR-DE-1
// Mobile touch targets ≥ 44×44. In place, NO rebuild, NO detaching; existing IDs unchanged. Idempotent.
// 1. IconButton `45:405` gains Size=Touch (44×44 frame, 20 px glyph) — 12 new variants cloned from Size=Medium
//    (Ghost/Secondary/Primary × Default/Hover/Focus/Disabled). Small (32) and Medium (40) are unchanged.
// 2. Nested IconButtons inside main components switched to Size=Touch (Icon override kept):
//    Shell/Mobile/Header › Back (and any other IconButton in the header), Drawer › Close, Dialog › Close.
// 3. Shell/Mobile/TabBar + Shell/Mobile/Tab: audit only (tabs are not IconButtons); heights returned, warns < 44.
// Page 21 DS — Components (36:3).
const PAGE_ID = '36:3';
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const pv = name => Object.fromEntries(name.split(',').map(s => s.split('=').map(x => x.trim())));
async function byIdOrName(id, name, types) {
  let n = await figma.getNodeByIdAsync(id);
  if (!n || !types.includes(n.type) || n.name !== name) n = page.findOne(x => types.includes(x.type) && x.name === name && !(x.parent && x.parent.type === 'COMPONENT_SET'));
  return n || null;
}
const OUT = { updated: { iconButtonTouch: [], nested: [] }, audit: { tabBar: [], tab: [] }, skipped: [], warnings: [], notes: [] };
const T = 44;

// ---------------- 1. IconButton Size=Touch
const IB = await byIdOrName('45:405', 'IconButton', ['COMPONENT_SET']);
if (!IB) throw new Error('IconButton set not found');
for (const src of IB.children.filter(c => c.type === 'COMPONENT' && pv(c.name).Size === 'Medium')) {
  const p = pv(src.name);
  const name = `Variant=${p.Variant}, Size=Touch, State=${p.State}`;
  let v = IB.children.find(c => c.name === name);
  if (!v) { v = src.clone(); IB.appendChild(v); v.name = name; }
  v.resize(T, T); v.primaryAxisSizingMode = 'FIXED'; v.counterAxisSizingMode = 'FIXED';
  v.minWidth = T; v.minHeight = T;
  const dot = v.findOne(n => n.name === 'Dot');
  if (dot && dot.layoutPositioning === 'ABSOLUTE') { dot.x = T - 12; dot.y = 4; }
  OUT.updated.iconButtonTouch.push({ id: v.id, variant: name, w: Math.round(v.width), h: Math.round(v.height) });
}
// set layout: columns = State, rows = Variant × Size
{
  const states = ['Default', 'Hover', 'Focus', 'Disabled'], sizes = ['Small', 'Medium', 'Touch'], vars = ['Ghost', 'Secondary', 'Primary'];
  for (const c of IB.children) { const p = pv(c.name); const r = vars.indexOf(p.Variant) * sizes.length + sizes.indexOf(p.Size); c.x = 24 + states.indexOf(p.State) * 68; c.y = 24 + Math.max(0, r) * 68; }
  let mx = 0, my = 0; for (const c of IB.children) { mx = Math.max(mx, c.x + c.width); my = Math.max(my, c.y + c.height); }
  IB.resizeWithoutConstraints(mx + 24, my + 24);
  IB.description = (IB.description || '').replace(/\s*Size=Touch \(13b\).*$/, '') + ' Size=Touch (13b): 44×44 hit area, 20 px glyph — use for every mobile icon button (back, close, header actions).';
}

// ---------------- 2. nested IconButtons → Size=Touch
function isIB(n) { return n.type === 'INSTANCE' && n.mainComponent && n.mainComponent.parent && n.mainComponent.parent.id === IB.id; }
function sizeKey(inst) { return Object.keys(inst.componentProperties).find(k => k === 'Size' || k.split('#')[0] === 'Size'); }
async function toTouch(owner, label, filter) {
  const comps = owner.type === 'COMPONENT_SET' ? owner.children.filter(c => c.type === 'COMPONENT') : [owner];
  for (const c of comps) {
    const hits = c.findAll(n => isIB(n) && (!filter || filter(n)));
    if (!hits.length) { OUT.notes.push(`${label} › ${c.name}: no IconButton`); continue; }
    for (const b of hits) {
      const before = Math.round(b.height);
      try {
        const k = sizeKey(b);
        if (k && b.componentProperties[k].value !== 'Touch') b.setProperties({ [k]: 'Touch' });
        OUT.updated.nested.push({ component: label, variant: owner.type === 'COMPONENT_SET' ? c.name : undefined, id: b.id, name: b.name, before, w: Math.round(b.width), h: Math.round(b.height), parentH: Math.round(c.height) });
        if (b.height < T || b.width < T) OUT.warnings.push(`${label} › ${b.name} still ${Math.round(b.width)}×${Math.round(b.height)}`);
      } catch (e) { OUT.skipped.push(`${label} › ${b.name}: ${e.message}`); }
    }
  }
}
const HDR = await byIdOrName('49:1219', 'Shell/Mobile/Header', ['COMPONENT_SET']);
if (HDR) await toTouch(HDR, 'Shell/Mobile/Header'); else OUT.skipped.push('Shell/Mobile/Header not found');
const DRW = await byIdOrName('53:1846', 'Drawer', ['COMPONENT', 'COMPONENT_SET']);
if (DRW) await toTouch(DRW, 'Drawer', n => n.name === 'Close'); else OUT.skipped.push('Drawer not found');
const DLG = await byIdOrName('53:1818', 'Dialog', ['COMPONENT', 'COMPONENT_SET']);
if (DLG) await toTouch(DLG, 'Dialog', n => n.name === 'Close'); else OUT.skipped.push('Dialog not found');

// ---------------- 3. TabBar audit (no change unless < 44)
const TBR = await byIdOrName('49:1588', 'Shell/Mobile/TabBar', ['COMPONENT_SET']);
if (TBR) {
  const v = TBR.children[0];
  const ibs = TBR.findAll(n => isIB(n)).length;
  const tabs = v.findAll(n => n.type === 'INSTANCE' && /^Tab \d/.test(n.name)).map(t => ({ name: t.name, w: Math.round(t.width), h: Math.round(t.height) }));
  OUT.audit.tabBar.push({ id: TBR.id, sampleVariant: v.name, barH: Math.round(v.height), tabs, iconButtonsInTabBar: ibs });
  for (const t of tabs) if (t.w < T || t.h < T) OUT.warnings.push(`TabBar ${t.name} ${t.w}×${t.h} < 44`);
}
const TAB = await byIdOrName('49:1232', 'Shell/Mobile/Tab', ['COMPONENT_SET']);
if (TAB) for (const c of TAB.children) OUT.audit.tab.push({ id: c.id, variant: c.name, w: Math.round(c.width), h: Math.round(c.height) });
OUT.notes.push('Desktop Dialog close also becomes 44 (one shared component); Banner/Toast close stay Small (desktop). Screen agents: use IconButton Size=Touch for any mobile icon button; re-lay-out placed headers/drawers after the run.');
return OUT;
