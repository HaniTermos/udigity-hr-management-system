// 13d-notice-fill.js — Design-System Maintainer — Phase 6 board item D-1
// In place, NO rebuild, NO detaching; IDs, variants, properties unchanged; idempotent. Page 21 DS — Components (36:3).
// Problem: in every Notice/Access variant (set 53:2240) the Title and Body text layers were FIXED width
// (Inline 420, Page 416), so FILL instances narrower than the default (e.g. 294 px rails on page 44) overflowed
// the clipped "Text" frame. Page variants also had the "Text" frame on HUG.
// Fix: "Text" frame → layoutSizingHorizontal FILL (Inline already FILL; Page HUG→FILL, still 416 at default 480);
//      Title/Body → layoutSizingHorizontal FILL + textAutoResize HEIGHT. Default widths unchanged
//      (Page 416; Inline 420→422 = the Text frame width, +2 px, no visual change).
// Run 1 result: 15 changes; 0 overflow at 294 for all 6 variants; at 200 only Context-limited/Inline overflows +36,
// because the single-line DEC-005 Policy chip (178 hug, Notice/Policy pending Size=Chip) sits in the Text frame.
// So Context-limited/Inline min width = 234 (12+20+12+178+12); all other variants wrap at ≥ 200.
// Verification: temporary instances of every variant at 294 and 200 px, measured, then removed.
const page = await figma.getNodeByIdAsync('36:3');
if (!page || page.type !== 'PAGE') throw new Error('Page 36:3 not found');
await figma.setCurrentPageAsync(page);
const SET = await figma.getNodeByIdAsync('53:2240');
if (!SET || SET.type !== 'COMPONENT_SET' || SET.name !== 'Notice/Access') throw new Error('Notice/Access set 53:2240 not found');
const OUT = { before: {}, after: {}, changed: 0, test: {}, warnings: [] };
const m = n => Math.round(n.width);
for (const v of SET.children) {
  const text = v.children.find(c => c.name === 'Text' && c.type === 'FRAME');
  if (!text) { OUT.warnings.push('No Text frame in ' + v.name); continue; }
  const tl = text.children.filter(c => c.type === 'TEXT' && (c.name === 'Title' || c.name === 'Body'));
  OUT.before[v.name] = { variant: m(v), text: `${text.layoutSizingHorizontal} ${m(text)}`, ...Object.fromEntries(tl.map(t => [t.name, `${t.layoutSizingHorizontal} ${m(t)}`])) };
  for (const t of tl) for (const s of t.getStyledTextSegments(['fontName'])) await figma.loadFontAsync(s.fontName);
  if (text.layoutSizingHorizontal !== 'FILL') { text.layoutSizingHorizontal = 'FILL'; OUT.changed++; }
  for (const t of tl) {
    if (t.textAutoResize !== 'HEIGHT') { t.textAutoResize = 'HEIGHT'; OUT.changed++; }
    if (t.layoutSizingHorizontal !== 'FILL') { t.layoutSizingHorizontal = 'FILL'; OUT.changed++; }
    if (t.layoutSizingVertical !== 'HUG') { t.layoutSizingVertical = 'HUG'; OUT.changed++; }
  }
  OUT.after[v.name] = { variant: m(v), text: `${text.layoutSizingHorizontal} ${m(text)}`, ...Object.fromEntries(tl.map(t => [t.name, `${t.layoutSizingHorizontal} ${m(t)} ar=${t.textAutoResize}`])) };
}
// ---- verification: temporary instances at narrow widths
const tmp = figma.createAutoLayout('VERTICAL', { name: '__13d test', itemSpacing: 8 });
tmp.x = SET.x; tmp.y = SET.y + SET.height + 400;
try {
  for (const v of SET.children) for (const W of [294, 200]) {
    const i = v.createInstance(); tmp.appendChild(i); i.resize(W, i.height); i.layoutSizingVertical = 'HUG';
    const text = i.children.find(c => c.name === 'Text');
    const over = text.children.filter(c => c.visible).map(c => Math.round(c.x + c.width - text.width)).filter(d => d > 0);
    const t = text.children.filter(c => c.type === 'TEXT').map(c => `${c.name} ${m(c)}x${Math.round(c.height)}`).join(', ');
    OUT.test[`${v.name} @${W}`] = `Text ${m(text)}; ${t}; overflow ${over.length ? '+' + Math.max(...over) : 0}`;
    if (over.length) OUT.warnings.push(`${v.name} @${W} overflows +${Math.max(...over)}`);
  }
} finally { tmp.remove(); }
return OUT;
