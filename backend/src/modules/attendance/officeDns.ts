/**
 * MOD-attendance — office dynamic-DNS hostnames (Owner decision 2026-10-29: the office has no static IP).
 * Owner: BE1.
 *
 * The office allowlist is the explicit IP/CIDR list ∪ the addresses the configured hostnames resolve to.
 * Resolution is lazy (on check-in / check-out / test check), cached in memory and refreshed at most every
 * REFRESH_MS. When a refresh fails the last good addresses are kept for up to STALE_MAX_MS; after that the
 * hostname contributes nothing (fail closed: the office check fails). Never allow-all.
 */
import { promises as dns } from 'dns';
import { clock } from '../platform/clock.js';
import { config } from '../../config/index.js';
import { normalizeIp } from './time.js';

export const REFRESH_MS = 5 * 60_000;
export const STALE_MAX_MS = 60 * 60_000;
const TIMEOUT_MS = 2_000;

/** Resolves a hostname to its IPv4/IPv6 addresses; throws when it cannot. */
export type OfficeResolver = (hostname: string) => Promise<string[]>;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('DNS timeout')), TIMEOUT_MS);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

const systemResolver: OfficeResolver = async (hostname) => {
  const [v4, v6] = await Promise.allSettled([withTimeout(dns.resolve4(hostname)), withTimeout(dns.resolve6(hostname))]);
  const ips = [...(v4.status === 'fulfilled' ? v4.value : []), ...(v6.status === 'fulfilled' ? v6.value : [])];
  if (ips.length === 0) throw new Error(`no address for ${hostname}`);
  return ips;
};

let resolver: OfficeResolver = systemResolver;

interface Entry {
  ips: string[];
  /** Last successful resolution (null = never). */
  resolvedAt: number | null;
  /** Last attempt, successful or not (throttles refreshes). */
  checkedAt: number;
}
const cache = new Map<string, Entry>();

/** Test only (NODE_ENV=test): inject a resolver; pass null to restore the system one. Clears the cache. */
export function setOfficeResolverForTests(r: OfficeResolver | null): void {
  if (config.env !== 'test') throw new Error('The office resolver can be replaced only when NODE_ENV=test');
  resolver = r ?? systemResolver;
  cache.clear();
}

/** Hostname syntax (RFC 1123 labels, at least one dot). Lowercase; no scheme, port or path. */
export function isValidHostname(h: string): boolean {
  if (h.length > 253 || !h.includes('.')) return false;
  return h.split('.').every((l) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l));
}

/**
 * The addresses the hostnames stand for right now, plus the hostnames that currently contribute none
 * (resolution failed and no good result within STALE_MAX_MS).
 */
export async function resolveOfficeHostnames(hostnames: readonly string[]): Promise<{ ips: string[]; unresolved: string[] }> {
  const now = clock.now().getTime();
  const ips: string[] = [];
  const unresolved: string[] = [];
  for (const host of hostnames) {
    let e = cache.get(host);
    if (!e || now - e.checkedAt >= REFRESH_MS) {
      const prev: Entry = e ?? { ips: [], resolvedAt: null, checkedAt: now };
      try {
        const got = (await resolver(host)).map((ip) => normalizeIp(ip)).filter((ip): ip is string => ip !== null);
        if (got.length === 0) throw new Error('no address');
        e = { ips: got, resolvedAt: now, checkedAt: now };
      } catch {
        e = { ...prev, checkedAt: now }; // keep the last good addresses; staleness decides below
      }
      cache.set(host, e);
    }
    if (e.resolvedAt !== null && now - e.resolvedAt <= STALE_MAX_MS) ips.push(...e.ips);
    else unresolved.push(host);
  }
  return { ips: [...new Set(ips)], unresolved };
}
