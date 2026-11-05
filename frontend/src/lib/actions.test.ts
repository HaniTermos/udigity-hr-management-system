import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIONS, ROLE_DEFAULTS, roleDefaultAllows } from './actions';
import { NAV_SECTIONS } from './nav';

/** Action names the backend can put in `/me` capabilities: the keys of backend/src/modules/access/matrix.ts. */
function backendActions(): Set<string> {
  const source = readFileSync(resolve(__dirname, '../../../backend/src/modules/access/matrix.ts'), 'utf8');
  const names = new Set<string>();
  for (const m of source.matchAll(/^\s{2}'([a-z_]+(?:\.[a-z_]+)+)':/gm)) names.add(m[1]);
  return names;
}

describe('ACTIONS (CR1-01)', () => {
  const backend = backendActions();

  it('reads a plausible backend catalogue', () => {
    expect(backend.size).toBeGreaterThan(80);
    expect(backend.has('audit.read')).toBe(true);
  });

  it('every UI action exists in the backend authz matrix', () => {
    const missing = Object.values(ACTIONS).filter((a) => !backend.has(a));
    expect(missing).toEqual([]);
  });

  it('every nav item action is an ACTIONS value', () => {
    const known = new Set<string>(Object.values(ACTIONS));
    const unknown = NAV_SECTIONS.flatMap((s) => s.items).filter((i) => i.action && !known.has(i.action)).map((i) => i.action);
    expect(unknown).toEqual([]);
  });

  it('role defaults only mention known actions', () => {
    const known = new Set<string>(Object.values(ACTIONS));
    expect(Object.keys(ROLE_DEFAULTS).filter((a) => !known.has(a))).toEqual([]);
  });

  it('role defaults deny by default', () => {
    expect(roleDefaultAllows(ACTIONS.auditRead, 'owner')).toBe(true);
    expect(roleDefaultAllows(ACTIONS.auditRead, 'developer')).toBe(false);
    expect(roleDefaultAllows('not.an.action', 'owner')).toBe(false);
    expect(roleDefaultAllows(ACTIONS.auditRead, undefined)).toBe(false);
  });
});
