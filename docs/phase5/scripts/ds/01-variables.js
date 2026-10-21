// 01-variables.js — Design-System Agent — Phase 5
// Creates/updates variable collections "Primitives" (mode Value) and "Semantic" (modes Light, Dark).
// Semantic variables alias primitives. Scopes are explicit on every variable. Idempotent (upsert by name).
// Page: 20 DS — Foundations (36:2). No canvas nodes are created by this script.
await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('36:2'));
const PRIMS = [["navy/50","EEF2F8"],["navy/100","D9E1EE"],["navy/200","B3C2DB"],["navy/300","8399BF"],["navy/400","5571A0"],["navy/500","2F4F82"],["navy/600","1F3D6E"],["navy/700","17305A"],["navy/800","112447"],["navy/900","0B1A35"],["navy/950","071226"],["teal/50","E6F7F7"],["teal/100","C2EDED"],["teal/200","8EDDDE"],["teal/300","52C9CB"],["teal/400","22B3B6"],["teal/500","0E9CA0"],["teal/600","0B8084"],["teal/700","0A6669"],["teal/800","0A5052"],["teal/900","083E40"],["teal/950","052A2B"],["grey/50","F5F7FA"],["grey/100","EDF0F4"],["grey/200","DFE4EA"],["grey/300","C9D1DA"],["grey/400","A1ACB9"],["grey/500","778395"],["grey/600","586476"],["grey/700","414B5A"],["grey/800","2A323E"],["grey/850","222932"],["grey/900","1A2029"],["grey/950","11151B"],["success/50","E7F6ED"],["success/100","C4E8D2"],["success/300","69C493"],["success/400","3DAF73"],["success/500","1E9A58"],["success/600","167E47"],["success/700","116338"],["success/800","0D4C2B"],["success/900","0A3A21"],["warning/50","FFF5E1"],["warning/100","FFE6B3"],["warning/300","F5BF55"],["warning/400","EBA82B"],["warning/500","D48A06"],["warning/600","AD6F00"],["warning/700","855500"],["warning/800","664100"],["warning/900","4A2F00"],["danger/50","FDECEC"],["danger/100","F8CDCD"],["danger/300","EC8888"],["danger/400","E36060"],["danger/500","D63A3A"],["danger/600","B52A2A"],["danger/700","8F2020"],["danger/800","6E1919"],["danger/900","4F1212"],["info/50","E8F1FC"],["info/100","C6DBF8"],["info/300","79A9EC"],["info/400","5390E0"],["info/500","2F72CF"],["info/600","245EAF"],["info/700","1C4A8B"],["info/800","16396B"],["info/900","0F2A50"],["violet/50","F1EDFB"],["violet/100","DED5F5"],["violet/300","A994E3"],["violet/500","7357C2"],["violet/700","523C93"],["violet/900","2C2052"],["orange/300","F2AE7E"],["orange/500","DB6E2C"],["orange/700","A24E1A"],["magenta/300","E58DB8"],["magenta/500","C23F7E"],["magenta/700","8F2B5B"],["base/white","FFFFFF"],["base/black","000000"],["alpha/navy-56","071226",0.56],["alpha/black-64","000000",0.64],["alpha/black-8","000000",0.08],["alpha/white-8","FFFFFF",0.08]];
const FLOATS = [["space/0",0,"GAP"],["space/2",2,"GAP"],["space/4",4,"GAP"],["space/6",6,"GAP"],["space/8",8,"GAP"],["space/10",10,"GAP"],["space/12",12,"GAP"],["space/16",16,"GAP"],["space/20",20,"GAP"],["space/24",24,"GAP"],["space/32",32,"GAP"],["space/40",40,"GAP"],["space/48",48,"GAP"],["space/56",56,"GAP"],["space/64",64,"GAP"],["radius/none",0,"CORNER_RADIUS"],["radius/xs",2,"CORNER_RADIUS"],["radius/sm",4,"CORNER_RADIUS"],["radius/md",6,"CORNER_RADIUS"],["radius/lg",8,"CORNER_RADIUS"],["radius/xl",12,"CORNER_RADIUS"],["radius/2xl",16,"CORNER_RADIUS"],["radius/full",999,"CORNER_RADIUS"],["border-width/1",1,"STROKE_FLOAT"],["border-width/2",2,"STROKE_FLOAT"]];
const SEM = [["surface/page","grey/50","grey/950","bg"],["surface/default","base/white","grey/900","bgfx"],["surface/raised","base/white","grey/850","bg"],["surface/subtle","grey/50","grey/850","bg"],["surface/sunken","grey/100","grey/950","bg"],["surface/hover","grey/100","grey/800","bg"],["surface/pressed","grey/200","grey/700","bg"],["surface/selected","teal/50","teal/950","bg"],["surface/disabled","grey/100","grey/800","bg"],["surface/inverse","navy/900","grey/100","bg"],["surface/brand","navy/900","navy/950","bg"],["surface/brand-hover","navy/800","navy/900","bg"],["surface/brand-active","navy/700","navy/800","bg"],["surface/skeleton","grey/200","grey/800","bg"],["border/default","grey/200","grey/700","border"],["border/subtle","grey/100","grey/800","border"],["border/strong","grey/300","grey/600","border"],["border/input","grey/500","grey/500","border"],["border/brand","navy/700","navy/800","border"],["border/selected","teal/600","teal/400","border"],["text/primary","grey/900","grey/50","text"],["text/secondary","grey/700","grey/300","text"],["text/muted","grey/600","grey/400","text"],["text/placeholder","grey/600","grey/400","text"],["text/disabled","grey/400","grey/600","text"],["text/inverse","base/white","grey/950","text"],["text/on-brand","base/white","base/white","text"],["text/on-brand-muted","navy/200","navy/200","text"],["text/on-primary","base/white","grey/950","text"],["text/on-danger","base/white","grey/950","text"],["text/link","teal/700","teal/300","text"],["icon/default","grey/700","grey/300","icon"],["icon/muted","grey/500","grey/500","icon"],["icon/on-brand","navy/200","navy/200","icon"],["icon/on-brand-active","base/white","base/white","icon"],["icon/accent","teal/600","teal/400","icon"],["icon/strong","grey/900","grey/50","icon"],["icon/on-primary","base/white","grey/950","icon"],["icon/disabled","grey/400","grey/600","icon"],["brand/primary","navy/700","teal/400","bg"],["brand/primary-hover","navy/800","teal/300","bg"],["brand/primary-pressed","navy/900","teal/200","bg"],["brand/accent","teal/600","teal/400","any"],["brand/accent-strong","teal/700","teal/300","any"],["brand/accent-subtle","teal/50","teal/950","bg"],["focus-ring","teal/500","teal/300","focus"],["overlay/scrim","alpha/navy-56","alpha/black-64","bg"],["status/success/fg","success/700","success/300","statusfg"],["status/success/bg","success/50","success/900","bg"],["status/success/border","success/300","success/700","border"],["status/success/solid","success/600","success/400","any"],["status/warning/fg","warning/700","warning/300","statusfg"],["status/warning/bg","warning/50","warning/900","bg"],["status/warning/border","warning/300","warning/700","border"],["status/warning/solid","warning/600","warning/400","any"],["status/danger/fg","danger/700","danger/300","statusfg"],["status/danger/bg","danger/50","danger/900","bg"],["status/danger/border","danger/300","danger/700","border"],["status/danger/solid","danger/600","danger/400","any"],["status/info/fg","info/700","info/300","statusfg"],["status/info/bg","info/50","info/900","bg"],["status/info/border","info/300","info/700","border"],["status/info/solid","info/600","info/400","any"],["status/neutral/fg","grey/700","grey/300","statusfg"],["status/neutral/bg","grey/100","grey/800","bg"],["status/neutral/border","grey/300","grey/600","border"],["status/neutral/solid","grey/600","grey/400","any"],["status/brand/fg","teal/700","teal/300","statusfg"],["status/brand/bg","teal/50","teal/950","bg"],["status/brand/border","teal/300","teal/700","border"],["status/brand/solid","teal/600","teal/400","any"],["status/policy/fg","violet/700","violet/300","statusfg"],["status/policy/bg","violet/50","violet/900","bg"],["status/policy/border","violet/300","violet/700","border"],["status/policy/solid","violet/500","violet/300","any"],["status/decision/fg","navy/600","navy/200","statusfg"],["status/decision/bg","navy/50","navy/900","bg"],["status/decision/border","navy/300","navy/700","border"],["status/decision/solid","navy/500","navy/300","any"],["chart/series-1","teal/500","teal/300","chart"],["chart/series-2","navy/500","navy/300","chart"],["chart/series-3","violet/500","violet/300","chart"],["chart/series-4","orange/500","orange/300","chart"],["chart/series-5","magenta/500","magenta/300","chart"],["chart/series-6","grey/500","grey/400","chart"],["chart/grid","grey/200","grey/700","chart"],["chart/axis","grey/600","grey/400","chart"],["chart/target","warning/600","warning/300","chart"]];
const SCOPES = {
  bg: ['FRAME_FILL', 'SHAPE_FILL'],
  border: ['STROKE_COLOR', 'FRAME_FILL', 'SHAPE_FILL'],
  text: ['TEXT_FILL'],
  icon: ['STROKE_COLOR', 'SHAPE_FILL'],
  statusfg: ['TEXT_FILL', 'STROKE_COLOR', 'SHAPE_FILL'],
  any: ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR', 'TEXT_FILL', 'EFFECT_COLOR'],
  bgfx: ['FRAME_FILL', 'SHAPE_FILL', 'EFFECT_COLOR'],
  focus: ['STROKE_COLOR', 'EFFECT_COLOR'],
  chart: ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'],
};
const rgba = (h, a) => ({ r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: a == null ? 1 : a });
const css = n => 'var(--' + n.replace(/[\s\/]+/g, '-').toLowerCase() + ')';
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const created = [], updated = [];
function coll(name) {
  let c = cols.find(x => x.name === name);
  if (!c) { c = figma.variables.createVariableCollection(name); created.push('collection:' + name); }
  return c;
}
const prim = coll('Primitives');
if (prim.modes[0].name !== 'Value') prim.renameMode(prim.modes[0].modeId, 'Value');
const PV = prim.modes[0].modeId;
const sem = coll('Semantic');
if (sem.modes[0].name !== 'Light') sem.renameMode(sem.modes[0].modeId, 'Light');
const LIGHT = sem.modes[0].modeId;
let darkMode = sem.modes.find(m => m.name === 'Dark');
const DARK = darkMode ? darkMode.modeId : sem.addMode('Dark');
const existing = await figma.variables.getLocalVariablesAsync();
const byKey = {};
for (const v of existing) byKey[v.variableCollectionId + '|' + v.name] = v;
function upsert(c, name, type, prefix) {
  let v = byKey[c.id + '|' + name];
  if (v && v.resolvedType !== type) throw new Error('Variable ' + name + ' exists with type ' + v.resolvedType);
  if (!v) { v = figma.variables.createVariable(name, c, type); byKey[c.id + '|' + name] = v; created.push(name); } else updated.push(name);
  v.setVariableCodeSyntax('WEB', css((prefix || '') + name));
  return v;
}
const ids = { Primitives: {}, Semantic: {} };
const P = {};
for (const [name, hex, a] of PRIMS) {
  const v = upsert(prim, name, 'COLOR', 'color-');
  v.setValueForMode(PV, rgba(hex, a));
  v.scopes = []; // primitives are hidden from pickers; use Semantic tokens
  v.description = '#' + hex + (a != null ? ' @ ' + Math.round(a * 100) + '%' : '');
  P[name] = v; ids.Primitives[name] = v.id;
}
for (const [name, val, scope] of FLOATS) {
  const v = upsert(prim, name, 'FLOAT', '');
  v.setValueForMode(PV, val);
  v.scopes = [scope];
  ids.Primitives[name] = v.id;
}
for (const [name, l, d, sk] of SEM) {
  if (!P[l] || !P[d]) throw new Error('Alias target missing for ' + name + ': ' + l + ' / ' + d);
  const v = upsert(sem, name, 'COLOR', 'color-');
  v.setValueForMode(LIGHT, { type: 'VARIABLE_ALIAS', id: P[l].id });
  v.setValueForMode(DARK, { type: 'VARIABLE_ALIAS', id: P[d].id });
  v.scopes = SCOPES[sk];
  v.description = 'Light: ' + l + ' · Dark: ' + d;
  ids.Semantic[name] = v.id;
}
return {
  collections: { Primitives: prim.id, Semantic: sem.id },
  modes: { 'Primitives/Value': PV, 'Semantic/Light': LIGHT, 'Semantic/Dark': DARK },
  counts: { primitives: Object.keys(ids.Primitives).length, semantic: Object.keys(ids.Semantic).length, created: created.length, updated: updated.length },
  variables: ids,
};
