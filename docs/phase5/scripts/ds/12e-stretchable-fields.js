// 12e-stretchable-fields.js — Design-System Agent — Phase 5 (Udigity Management System)
// MF-18: fields are width-agnostic. Input, Select, Input/Date, Input/Search, Textarea: every variant's root is
//        VERTICAL auto layout (Search: HORIZONTAL control root), fixed default width 320 but minWidth 200 and no
//        maxWidth; Label row / Control / Helper row FILL; inside the Control the Value/Placeholder text FILLs and
//        icons, avatars, prefixes, suffixes and actions keep their own size — so chevrons, calendar/clock icons and
//        clear buttons stay inside the right edge and Textarea text wraps inside the box at any instance width.
// MF-19: Drawer Footer slot FILL width, horizontal, SPACE_BETWEEN, no clipping; default Cancel + Save wrapped in a
//        FILL "Footer actions" row (right-aligned) so a left-aligned destructive/secondary item can sit before it.
//        Content slot FILL width + FILL height (between header and footer), padding 24, children FILL.
// In place, NO rebuild: component/variant IDs unchanged, instances keep working. Idempotent (re-run safe).
// Only main components are edited (never x/y/size on instance children). Page 21 DS — Components (36:3).
const PAGE_ID = '36:3';
const MIN_W = 120; // orchestrator: lowered from 200 so existing 160px filter selects (S2) do not widen
const page = await figma.getNodeByIdAsync(PAGE_ID);
if (!page || page.type !== 'PAGE') throw new Error('Page ' + PAGE_ID + ' not found');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
const _cols = await figma.variables.getLocalVariableCollectionsAsync();
const primCol = _cols.find(c => c.name === 'Primitives');
const V = {};
if (primCol) for (const v of await figma.variables.getLocalVariablesAsync()) if (v.variableCollectionId === primCol.id) V['p/' + v.name] = v;
function bnum(n, field, vname, raw) { const v = V[vname]; if (v) { try { n.setBoundVariable(field, v); return; } catch (e) {} } n[field] = raw; }
function pad(n, t, r) { [['paddingTop', t], ['paddingBottom', t], ['paddingLeft', r], ['paddingRight', r]].forEach(([f, x]) => bnum(n, f, 'p/space/' + x, x)); }
const OUT = { updated: { fields: [], drawer: [] }, skipped: [], notes: [] };

async function byIdOrName(id, name, types) {
  let n = await figma.getNodeByIdAsync(id);
  if (!n || !types.includes(n.type) || n.name !== name) n = page.findOne(x => types.includes(x.type) && x.name === name && !(x.parent && x.parent.type === 'COMPONENT_SET'));
  return n || null;
}
// first descendant by name, without descending into instances
function findLocal(root, name) {
  if (!('children' in root)) return null;
  for (const c of root.children) { if (c.name === name) return c; if (c.type !== 'INSTANCE') { const r = findLocal(c, name); if (r) return r; } }
  return null;
}
async function loadFonts(t) {
  const fonts = t.characters.length ? t.getRangeAllFontNames(0, t.characters.length) : [t.fontName];
  for (const f of fonts) if (f && f !== figma.mixed) await figma.loadFontAsync(f);
}
function noMax(n) { try { if ('maxWidth' in n && n.maxWidth != null) n.maxWidth = null; } catch (e) {} }
function auto(n, log) { if ('layoutPositioning' in n && n.layoutPositioning === 'ABSOLUTE') { n.layoutPositioning = 'AUTO'; log.push(n.name + ': absolute → auto'); } }
const VALUE_NAMES = ['Value', 'Placeholder'];
const HUG_TEXT = ['Prefix', 'Suffix', 'Action', 'Country code', 'Counter'];

// value text FILL (wrap for multi-line, 1-line truncate otherwise); everything else keeps its own width
async function fixControlRow(ctl, multiline, log) {
  noMax(ctl);
  ctl.clipsContent = true;
  if (ctl.layoutMode === 'HORIZONTAL') { ctl.primaryAxisAlignItems = 'MIN'; ctl.counterAxisAlignItems = 'CENTER'; }
  else if (ctl.layoutMode === 'VERTICAL') { ctl.counterAxisAlignItems = 'MIN'; }
  else { log.push(ctl.name + ': not auto layout — skipped'); return; }
  for (const k of ctl.children) {
    auto(k, log);
    if (k.type === 'TEXT' && VALUE_NAMES.includes(k.name)) {
      await loadFonts(k);
      k.textAutoResize = 'HEIGHT';
      k.layoutSizingHorizontal = 'FILL';
      if (!multiline) { k.textTruncation = 'ENDING'; k.maxLines = 1; k.layoutSizingVertical = 'HUG'; }
      else { k.textTruncation = 'DISABLED'; k.maxLines = null; k.layoutSizingVertical = 'HUG'; }
      noMax(k);
    } else if (k.type === 'TEXT') {
      await loadFonts(k);
      k.textAutoResize = 'WIDTH_AND_HEIGHT';
      if (ctl.layoutMode === 'HORIZONTAL') { k.layoutGrow = 0; k.layoutSizingHorizontal = 'HUG'; }
    } else if (ctl.layoutMode === 'HORIZONTAL') {
      k.layoutGrow = 0;
      if (k.type === 'INSTANCE' || k.type === 'RECTANGLE' || k.type === 'ELLIPSE' || k.type === 'VECTOR') k.layoutSizingHorizontal = 'FIXED';
      else if ('layoutMode' in k && k.layoutMode !== 'NONE') k.layoutSizingHorizontal = 'HUG';
      else k.layoutSizingHorizontal = 'FIXED';
    }
  }
}
async function fixHelperRow(hr, log) {
  noMax(hr);
  if (hr.layoutMode !== 'HORIZONTAL') { log.push('Helper row not horizontal — skipped'); return; }
  for (const k of hr.children) {
    auto(k, log);
    if (k.type === 'TEXT' && (k.name === 'Helper' || k.name === 'Error')) { await loadFonts(k); k.textAutoResize = 'HEIGHT'; k.layoutSizingHorizontal = 'FILL'; noMax(k); }
    else if (k.type === 'TEXT') { await loadFonts(k); k.textAutoResize = 'WIDTH_AND_HEIGHT'; k.layoutGrow = 0; }
    else { k.layoutGrow = 0; if (k.type === 'INSTANCE') k.layoutSizingHorizontal = 'FIXED'; }
  }
}
function fixLabelRow(lr) { noMax(lr); if (lr.layoutMode === 'HORIZONTAL') { lr.primaryAxisAlignItems = 'MIN'; lr.counterAxisAlignItems = 'CENTER'; } }

// ---------------- MF-18 fields ----------------
const FIELDS = [['45:796', 'Input', false, false], ['45:847', 'Textarea', false, true], ['46:434', 'Select', false, false], ['46:594', 'Input/Date', false, false], ['46:748', 'Input/Search', true, false]];
for (const [id, name, rootIsControl, multiline] of FIELDS) {
  const set = await byIdOrName(id, name, ['COMPONENT_SET']);
  if (!set) { OUT.skipped.push(name + ': component set not found'); continue; }
  for (const v of set.children) {
    if (v.type !== 'COMPONENT') continue;
    const log = [];
    try {
      noMax(v);
      if (rootIsControl) {
        if (v.layoutMode !== 'HORIZONTAL') { v.layoutMode = 'HORIZONTAL'; log.push('root → HORIZONTAL'); }
        v.primaryAxisSizingMode = 'FIXED'; v.counterAxisSizingMode = 'FIXED';
        if (v.width < MIN_W) v.resize(MIN_W, v.height);
        v.minWidth = MIN_W;
        await fixControlRow(v, false, log);
      } else {
        if (v.layoutMode !== 'VERTICAL') { v.layoutMode = 'VERTICAL'; log.push('root → VERTICAL'); }
        v.primaryAxisSizingMode = 'AUTO'; v.counterAxisSizingMode = 'FIXED';
        v.counterAxisAlignItems = 'MIN';
        if (v.width < MIN_W) v.resize(MIN_W, v.height);
        v.minWidth = MIN_W;
        for (const k of v.children) { auto(k, log); k.layoutSizingHorizontal = 'FILL'; }
        const lr = findLocal(v, 'Label row'), ctl = findLocal(v, 'Control'), hr = findLocal(v, 'Helper row');
        if (lr) fixLabelRow(lr); else log.push('no Label row');
        if (ctl) await fixControlRow(ctl, multiline, log); else log.push('no Control');
        if (hr) await fixHelperRow(hr, log); else log.push('no Helper row');
      }
      OUT.updated.fields.push({ id: v.id, set: name, variant: v.name, w: Math.round(v.width), notes: log.length ? log : undefined });
    } catch (e) { OUT.skipped.push(name + ' › ' + v.name + ': ' + e.message); }
  }
  const tag = ' Width-agnostic (12e): set the instance to FILL or any width ≥ 120; the control, icons and helper follow.';
  set.description = (set.description || '').replace(/\s*Width-agnostic \(12e\).*$/, '') + tag;
}

// ---------------- MF-19 Drawer ----------------
const drawer = await byIdOrName('53:1846', 'Drawer', ['COMPONENT', 'COMPONENT_SET']);
if (!drawer) OUT.skipped.push('Drawer: not found');
else {
  const variants = drawer.type === 'COMPONENT_SET' ? drawer.children.filter(c => c.type === 'COMPONENT') : [drawer];
  for (const d of variants) {
    const log = [];
    try {
      const slots = d.findAll(n => n.type === 'SLOT' && n.parent === d);
      const pick = nm => slots.find(s => s.name === nm) || d.children.find(c => c.name === nm && 'layoutMode' in c);
      const head = d.children.find(c => c.name === 'Header');
      if (head) { head.layoutSizingHorizontal = 'FILL'; head.layoutSizingVertical = 'HUG'; }
      // Content slot
      const content = pick('Content');
      if (!content) log.push('no Content slot');
      else {
        if (content.layoutMode === 'NONE') content.layoutMode = 'VERTICAL';
        content.layoutSizingHorizontal = 'FILL';
        content.layoutSizingVertical = 'FILL';
        pad(content, 24, 24);
        content.counterAxisAlignItems = 'MIN';
        content.clipsContent = true;
        noMax(content);
        for (const k of content.children) { try { if (k.layoutPositioning !== 'ABSOLUTE') k.layoutSizingHorizontal = 'FILL'; } catch (e) { log.push('content child ' + k.name + ': ' + e.message); } }
      }
      // Footer slot
      const foot = pick('Footer');
      if (!foot) log.push('no Footer slot');
      else {
        foot.layoutMode = 'HORIZONTAL';
        foot.layoutWrap = 'NO_WRAP';
        foot.layoutSizingHorizontal = 'FILL';
        foot.layoutSizingVertical = 'HUG';
        foot.primaryAxisAlignItems = 'SPACE_BETWEEN';
        foot.counterAxisAlignItems = 'CENTER';
        bnum(foot, 'itemSpacing', 'p/space/8', 8);
        pad(foot, 16, 24);
        foot.clipsContent = false;
        noMax(foot);
        // default content: Cancel + Save in a FILL, right-aligned "Footer actions" row
        let acts = foot.children.find(c => c.name === 'Footer actions');
        if (!acts) {
          const loose = foot.children.filter(c => c.type === 'INSTANCE' && !/placeholder/i.test(c.name));
          if (loose.length) {
            acts = figma.createAutoLayout('HORIZONTAL'); acts.name = 'Footer actions'; acts.fills = [];
            foot.appendChild(acts);
            for (const b of loose) acts.appendChild(b);
            log.push('wrapped ' + loose.length + ' default buttons in Footer actions');
          }
        }
        if (acts) {
          acts.layoutSizingHorizontal = 'FILL'; acts.layoutSizingVertical = 'HUG';
          acts.primaryAxisAlignItems = 'MAX'; acts.counterAxisAlignItems = 'CENTER';
          bnum(acts, 'itemSpacing', 'p/space/8', 8);
          acts.clipsContent = false;
          for (const b of acts.children) { b.layoutGrow = 0; }
        }
      }
      OUT.updated.drawer.push({ id: d.id, variant: d.name, content: content && content.id, footer: foot && foot.id, footerActions: foot && (foot.children.find(c => c.name === 'Footer actions') || {}).id, notes: log.length ? log : undefined });
    } catch (e) { OUT.skipped.push('Drawer › ' + d.name + ': ' + e.message); }
  }
  drawer.description = (drawer.description || '').replace(/\s*Footer \(12e\).*$/, '') + ' Footer (12e): FILL, SPACE_BETWEEN — put a destructive/secondary action first (left); the right group (FILL row, right-aligned) holds Close/Save. Content slot FILL with 24 padding; children should FILL.';
}
OUT.notes.push('Instances placed before 12e follow automatically unless a screen script overrode a child size; re-check S5 drawer B (fit check in developer/01-s5-board.js) after running.');
OUT.notes.push('minWidth 120 on all field variants: a screen instance set narrower than 120 now renders at 120.');
return OUT;
