/**
 * Own sessions (`GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id`, FIX2-BE). The response shape is read
 * defensively: the list may come as `{ items }` or `{ sessions }`, and field names vary (`lastSeenAt`/`lastUsedAt`).
 */
export const sessionsPaths = {
  list: '/api/auth/sessions',
  one: (id: string) => `/api/auth/sessions/${encodeURIComponent(id)}`,
} as const;

export interface OwnSession {
  id: string;
  current: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
  device: string;
  ip: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** A short device label from a User-Agent string ("Chrome on Windows"). */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : 'Browser';
  const os = /Windows/.test(userAgent) ? 'Windows' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad|iOS/.test(userAgent) ? 'iOS' : /Mac OS X|Macintosh/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : null;
  return os ? `${browser} on ${os}` : browser;
}

export function normalizeSessions(raw: unknown): OwnSession[] {
  const body = raw as { items?: unknown; sessions?: unknown } | unknown[] | null;
  const list = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : Array.isArray(body?.sessions) ? body.sessions : [];
  const out: OwnSession[] = [];
  for (const r of list as Record<string, unknown>[]) {
    const id = str(r?.id);
    if (!id) continue;
    out.push({
      id,
      current: r.current === true || r.isCurrent === true,
      createdAt: str(r.createdAt),
      lastSeenAt: str(r.lastSeenAt) ?? str(r.lastUsedAt) ?? str(r.lastActiveAt),
      device: str(r.device) ?? deviceLabel(str(r.userAgent)),
      ip: str(r.ip) ?? str(r.ipAddress),
    });
  }
  return out;
}
