// 13e-touch-links.js — Design-System Maintainer — Phase 6 request CC-1 / review R43-03
// In place, NO rebuild, NO detaching; existing IDs, variants and properties unchanged; idempotent.
// Page 21 DS — Components (36:3). Requires 13b + 13c (IconButton Size=Touch with working Icon swap).
// Problem (SCR-CC-002 mobile): Row/Phone 55:2600 › Copy is IconButton Size=Small (32×32) and
// Card/Section 51:1780 › Header › Action is Link Size=Small (~16 px tall). Both < 44 and both are instance internals.
// Fix = opt-in touch option, default OFF, so desktop instances and default visuals do not change:
//  Row/Phone   + BOOLEAN "Show copy (touch)" (default false) → new hidden sibling "Copy touch" = clone of Copy
//               with Size=Touch (44×44, same Icon/copy glyph, Ghost). Mobile: Show copy=false, Show copy (touch)=true.
//  Card/Section + BOOLEAN "Show action (touch)" (default false) → new hidden sibling "Action touch" = clone of Action
//               (Link Small, exposed) with fixed height 44, min width 44, label centred.
//               Mobile: Show action=false, Show action (touch)=true, then set Label/Show icon/Icon on nested "Action touch".
// Hidden children take no auto-layout space, so default sizes stay the same (checked below: before = after).
// Identification: by ID + exact name + type; fallback = unique top-level COMPONENT with that exact name on page 36:3.
// The nested layers must be an INSTANCE named "Copy" of the IconButton set / "Action" of the Link set.
// Anything not positively identified is skipped and reported in OUT.skipped; nothing else is touched.
// Verification: temporary instances (default and touch ON) are measured, then removed.
const page = await figma.getNodeByIdAsync('36:3');
if (!page || page.type !== 'PAGE') throw new Error('Page 36:3 not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const OUT = { found: {}, properties: {}, layers: {}, measured: {}, changed: 0, skipped: [], warnings: [] };
const T = 44;
const pv = name => Object.fromEntries(name.split(',').map(s => s.split('=').map(x => x.trim())));
const sz = n => `${Math.round(n.width)}×${Math.round(n.height)}`;
async function find(id, name, types) {
  const n = await figma.getNodeByIdAsync(id);
  if (n && types.includes(n.type) && n.name === name) return { node: n, how: 'id' };
  const all = page.findAll(x => types.includes(x.type) && x.name === name && !(x.parent && x.parent.type === 'COMPONENT_SET'));
  if (all.length === 1) return { node: all[0], how: 'name (id ' + id + ' did not match)' };
  return { node: null, how: all.length ? `ambiguous: ${all.length} matches (${all.map(x => x.id).join(', ')})` : 'not found' };
}
const ofSet = (n, set) => n && n.type === 'INSTANCE' && n.mainComponent && n.mainComponent.parent && n.mainComponent.parent.id === set.id;
const key = (owner, name) => Object.keys(owner.componentPropertyDefinitions).find(k => k.split('#')[0] === name);
function boolProp(comp, name) {
  let k = key(comp, name);
  if (k) { if (comp.componentPropertyDefinitions[k].type !== 'BOOLEAN') return { k: null, err: `${name} exists but is not BOOLEAN` }; return { k, created: false }; }
  k = comp.addComponentProperty(name, 'BOOLEAN', false); OUT.changed++;
  return { k, created: true };
}
// clone the source layer once (idempotent by name), place it right after the source, bind visibility to the new property
function touchClone(src, name, propKey) {
  const parent = src.parent;
  let n = parent.children.find(c => c.name === name);
  if (n && n.type !== 'INSTANCE') return { n: null, err: `${name} exists but is ${n.type}` };
  if (!n) { n = src.clone(); n.name = name; parent.insertChild(parent.children.indexOf(src) + 1, n); OUT.changed++; }
  else if (parent.children.indexOf(n) !== parent.children.indexOf(src) + 1) parent.insertChild(parent.children.indexOf(src) + 1, n);
  if (n.visible) n.visible = false; // default OFF (set before binding)
  const r = Object.assign({}, n.componentPropertyReferences || {});
  if (r.visible !== propKey) { r.visible = propKey; n.componentPropertyReferences = r; OUT.changed++; }
  return { n };
}
function glyph(inst) { const g = inst.findOne(x => x.name === 'Icon' && x.type === 'INSTANCE'); return g && g.mainComponent ? g.mainComponent.name : null; }
// measure a node inside a temporary instance by layer name
function measureIn(comp, props, layer) {
  const i = comp.createInstance(); i.x = comp.x; i.y = comp.y + comp.height + 600;
  try {
    if (props) { const p = {}; for (const [n, v] of Object.entries(props)) { const k = Object.keys(i.componentProperties).find(x => x.split('#')[0] === n); if (k) p[k] = v; } i.setProperties(p); }
    const l = i.findOne(x => x.name === layer);
    return { instance: sz(i), layer: l ? (l.visible ? sz(l) : 'hidden') : 'missing' };
  } finally { i.remove(); }
}

// ---------------- sets used by the nested layers
const IBf = await find('45:405', 'IconButton', ['COMPONENT_SET']);
const LKf = await find('45:441', 'Link', ['COMPONENT_SET']);
OUT.found.IconButton = IBf.node ? IBf.node.id + ' by ' + IBf.how : IBf.how;
OUT.found.Link = LKf.node ? LKf.node.id + ' by ' + LKf.how : LKf.how;
const IB = IBf.node, LK = LKf.node;
const hasTouch = IB && IB.children.some(c => pv(c.name).Size === 'Touch');
if (IB && !hasTouch) OUT.skipped.push('IconButton has no Size=Touch variant — run 13b and 13c first; Row/Phone skipped');

// ---------------- 1. Row/Phone › Copy touch
const RPf = await find('55:2600', 'Row/Phone', ['COMPONENT']);
OUT.found['Row/Phone'] = RPf.node ? RPf.node.id + ' by ' + RPf.how : RPf.how;
if (!RPf.node) OUT.skipped.push('Row/Phone: ' + RPf.how);
else if (!IB || !hasTouch) OUT.skipped.push('Row/Phone: IconButton Size=Touch unavailable');
else {
  const RP = RPf.node;
  const copies = RP.children.filter(c => c.name === 'Copy' && ofSet(c, IB));
  if (copies.length !== 1) OUT.skipped.push(`Row/Phone: expected 1 IconButton "Copy", found ${copies.length}; unchanged`);
  else {
    const cp = copies[0];
    const before = { component: sz(RP), copy: sz(cp), copySize: pv(cp.mainComponent.name).Size };
    const pr = boolProp(RP, 'Show copy (touch)');
    if (!pr.k) OUT.skipped.push('Row/Phone: ' + pr.err);
    else {
      const t = touchClone(cp, 'Copy touch', pr.k);
      if (!t.n) OUT.skipped.push('Row/Phone: ' + t.err);
      else {
        const n = t.n;
        const sk = Object.keys(n.componentProperties).find(k => k.split('#')[0] === 'Size');
        if (sk && n.componentProperties[sk].value !== 'Touch') { n.setProperties({ [sk]: 'Touch' }); OUT.changed++; }
        // keep the same glyph as Copy (explicit, in case the clone lost the swap)
        const ik = Object.keys(n.componentProperties).find(k => k.split('#')[0] === 'Icon');
        const ck = Object.keys(cp.componentProperties).find(k => k.split('#')[0] === 'Icon');
        if (ik && ck && n.componentProperties[ik].value !== cp.componentProperties[ck].value) { n.setProperties({ [ik]: cp.componentProperties[ck].value }); OUT.changed++; }
        if (n.width < T || n.height < T) OUT.warnings.push(`Row/Phone › Copy touch is ${sz(n)} (< 44)`);
        if (glyph(n) !== glyph(cp)) OUT.warnings.push(`Row/Phone › Copy touch glyph ${glyph(n)} ≠ Copy ${glyph(cp)}`);
        RP.description = (RP.description || '').replace(/\s*Touch \(13e\).*$/, '') + ' Touch (13e): on mobile set Show copy=false and Show copy (touch)=true → 44×44 Copy (IconButton Size=Touch). Row height then hugs to 56; do not fix it to 44.';
        OUT.properties['Row/Phone'] = { 'Show copy (touch)': pr.k, created: pr.created };
        OUT.layers['Row/Phone'] = { copy: cp.id, copyTouch: n.id, copyTouchVariant: n.mainComponent.name, glyph: glyph(n) };
        OUT.measured['Row/Phone'] = {
          before, after: { component: sz(RP), copy: sz(cp), copyTouch: 'hidden ' + sz(n) },
          instanceDefault: measureIn(RP, null, 'Copy'),
          instanceTouch: measureIn(RP, { 'Show copy': false, 'Show copy (touch)': true }, 'Copy touch')
        };
        if (before.component !== sz(RP)) OUT.warnings.push(`Row/Phone default size changed ${before.component} → ${sz(RP)}`);
      }
    }
  }
}

// ---------------- 2. Card/Section › Header › Action touch
const CSf = await find('51:1780', 'Card/Section', ['COMPONENT']);
OUT.found['Card/Section'] = CSf.node ? CSf.node.id + ' by ' + CSf.how : CSf.how;
if (!CSf.node) OUT.skipped.push('Card/Section: ' + CSf.how);
else if (!LK) OUT.skipped.push('Card/Section: Link set ' + LKf.how);
else {
  const CS = CSf.node;
  const head = CS.children.find(c => c.name === 'Header' && c.type === 'FRAME');
  const acts = head ? head.children.filter(c => c.name === 'Action' && ofSet(c, LK)) : [];
  if (!head) OUT.skipped.push('Card/Section: no "Header" frame; unchanged');
  else if (acts.length !== 1) OUT.skipped.push(`Card/Section: expected 1 Link "Action" in Header, found ${acts.length}; unchanged`);
  else {
    const act = acts[0];
    const before = { component: sz(CS), header: sz(head), action: sz(act) };
    const pr = boolProp(CS, 'Show action (touch)');
    if (!pr.k) OUT.skipped.push('Card/Section: ' + pr.err);
    else {
      const t = touchClone(act, 'Action touch', pr.k);
      if (!t.n) OUT.skipped.push('Card/Section: ' + t.err);
      else {
        const n = t.n;
        // 44 px tall hit area; Link is horizontal auto layout with counter-axis CENTER, so the label stays centred
        if (n.layoutSizingVertical !== 'FIXED' || Math.round(n.height) !== T) { n.layoutSizingVertical = 'FIXED'; n.resize(n.width, T); OUT.changed++; }
        if (n.layoutSizingHorizontal !== 'HUG') { try { n.layoutSizingHorizontal = 'HUG'; } catch (e) { OUT.warnings.push('Action touch HUG: ' + e.message); } }
        if (n.minWidth !== T) { n.minWidth = T; OUT.changed++; }
        if (n.counterAxisAlignItems !== 'CENTER') OUT.warnings.push('Action touch counterAxisAlignItems = ' + n.counterAxisAlignItems);
        n.isExposedInstance = true;
        if (head.counterAxisAlignItems === 'MIN') OUT.notes = ['Header aligns top; with touch ON the header is max(titles, 44) tall.'];
        CS.description = (CS.description || '').replace(/\s*Touch \(13e\).*$/, '') + ' Touch (13e): on mobile set Show action=false and Show action (touch)=true, then set Label / Show icon / Icon on the nested "Action touch" (44 px tall, min 44 wide).';
        OUT.properties['Card/Section'] = { 'Show action (touch)': pr.k, created: pr.created };
        OUT.layers['Card/Section'] = { action: act.id, actionTouch: n.id, actionTouchVariant: n.mainComponent.name };
        OUT.measured['Card/Section'] = {
          before, after: { component: sz(CS), header: sz(head), action: sz(act), actionTouch: 'hidden ' + sz(n) },
          instanceDefault: measureIn(CS, null, 'Action'),
          instanceTouch: measureIn(CS, { 'Show action': false, 'Show action (touch)': true }, 'Action touch')
        };
        if (before.component !== sz(CS)) OUT.warnings.push(`Card/Section default size changed ${before.component} → ${sz(CS)}`);
        const m = OUT.measured['Card/Section'].instanceTouch.layer.split('×').map(Number);
        if (m.length === 2 && (m[0] < T || m[1] < T)) OUT.warnings.push('Card/Section › Action touch measured ' + OUT.measured['Card/Section'].instanceTouch.layer);
      }
    }
  }
}
{
  const m = OUT.measured['Row/Phone'] && OUT.measured['Row/Phone'].instanceTouch.layer.split('×').map(Number);
  if (m && m.length === 2 && (m[0] < T || m[1] < T)) OUT.warnings.push('Row/Phone › Copy touch measured ' + OUT.measured['Row/Phone'].instanceTouch.layer);
}
return OUT;
