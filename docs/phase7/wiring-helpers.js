// Phase 7 wiring helpers — validated by the operator pilot [OP-P7-1], 2026-10-23, page 44 (96:6).
// Paste this block at the top of each role wiring script, after the single setCurrentPageAsync call.
//
// Pilot findings:
// - setReactionsAsync works on: plain FRAME (row 171:11748), INSTANCE itself (TD "Open" 171:11776),
//   and a NESTED INSTANCE CHILD (I263:13425;51:1773;263:13441 "Link · Request correction") — saved as an override.
//   No detach, no x/y/size changes needed.
// - Working action shapes (type is 'NODE', not 'NAVIGATE'; navigation goes in `navigation`):
//     { type:'NODE', destinationId, navigation:'NAVIGATE', transition:{type:'DISSOLVE', easing:{type:'EASE_OUT'}, duration:0.2}, resetScrollPosition:true }
//     { type:'URL', url, openInNewTab:false }
//     { type:'BACK' }
//   duration is in SECONDS (0.2 = 200 ms). Reaction = { trigger:{type:'ON_CLICK'}, actions:[action] }.
//   Read-back also contains a legacy `action` field mirroring actions[0]; ignore it.
// - page.flowStartingPoints IS settable (whole array). Gotcha: adding the first reaction inside a top-level
//   frame auto-creates a flow "Flow 1" on that frame; setting a second entry with the same nodeId throws
//   "Found duplicate input nodeIds". setFlow() below therefore replaces by nodeId.
// - setReactionsAsync REPLACES the node's reactions, so re-running is idempotent per hotspot.

const FILE_KEY = 'GNrhb3DWa6mIhEX6F4Nmvw';
const DISSOLVE_200 = { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.2 };

// Frame lookup by exact name or RegExp on the current page (top-level frames, including inside sections).
let _frames = null;
function frameByName(nameOrRe) {
  if (!_frames) _frames = figma.currentPage.findAllWithCriteria({ types: ['FRAME'] })
    .filter(f => f.parent && (f.parent.type === 'PAGE' || f.parent.type === 'SECTION'));
  const test = nameOrRe instanceof RegExp ? (n) => nameOrRe.test(n) : (n) => n === nameOrRe;
  return _frames.find(f => test(f.name)) || null;
}

// Hotspot lookup inside a frame: matches layer name (exact, then contains), then TEXT characters.
// For a TEXT match, returns the nearest INSTANCE/FRAME ancestor (the clickable control), not the text itself.
function findHotspot(frame, textOrName) {
  if (!frame) return null;
  const re = textOrName instanceof RegExp ? textOrName : null;
  const eq = (s) => re ? re.test(s) : s === textOrName;
  const has = (s) => re ? re.test(s) : s.toLowerCase().includes(String(textOrName).toLowerCase());
  let hit = frame.findOne(n => n.type !== 'TEXT' && eq(n.name))
         || frame.findOne(n => n.type !== 'TEXT' && has(n.name));
  if (hit) return hit;
  const t = frame.findOne(n => n.type === 'TEXT' && has(n.characters));
  if (!t) return null;
  let p = t.parent;
  while (p && p !== frame && p.type !== 'INSTANCE' && p.type !== 'FRAME') p = p.parent;
  return p && p !== frame ? p : t;
}

const nav = (destId, transition = DISSOLVE_200) =>
  ({ type: 'NODE', destinationId: destId, navigation: 'NAVIGATE', transition, resetScrollPosition: true });
const url = (nodeIdOrUrl) => ({
  type: 'URL', openInNewTab: false,
  url: /^https?:/.test(nodeIdOrUrl) ? nodeIdOrUrl
    : `https://www.figma.com/design/${FILE_KEY}?node-id=${String(nodeIdOrUrl).replace(':', '-')}`,
});
const back = () => ({ type: 'BACK' });

// Apply ON_CLICK action to a hotspot; replaces that node's reactions (idempotent). Returns true/false.
async function onClick(node, action, report) {
  if (!node) return false;
  try { await node.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [action] }]); return true; }
  catch (e) { if (report) report.push({ id: node.id, name: node.name, err: String(e) }); return false; }
}

// Add/rename a flow starting point; replaces any existing entry for the same frame (incl. auto "Flow 1").
function setFlow(frame, name) {
  const page = figma.currentPage;
  const keep = page.flowStartingPoints.filter(f => f.nodeId !== frame.id && f.name !== name);
  page.flowStartingPoints = [...keep, { nodeId: frame.id, name }];
  return { nodeId: frame.id, name };
}

// Example (pilot):
// const d1 = frameByName('SCR-DEV-001 — Deals — Desktop — Light');
// const d2 = frameByName(/^SCR-DEV-002 — .* — Desktop — Light$/);
// await onClick(findHotspot(d1, /^Row · Nova Dental/), nav(d2.id));
// await onClick(findHotspot(d2, 'Link · Request correction'), url('175:10802'));
// setFlow(d1, 'P7 — Developer — Deal to project');
