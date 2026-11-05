'use client';

import React, { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import { normalizeSessions, sessionsPaths } from '@/lib/api/sessions';
import { useApi } from '@/lib/hooks/useApi';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';

/**
 * "Your sessions": every device that is signed in, with sign-out for one of them. Hidden when the server has no
 * sessions list (older backend) so the profile never shows a broken block.
 */
export function SessionsList() {
  const toast = useToast();
  const time = useCompanyTime();
  const { data, error, mutate } = useApi<unknown>(sessionsPaths.list, { refreshInterval: 0 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  if (error || !data) return null;
  const sessions = normalizeSessions(data);
  if (sessions.length === 0) return null;

  async function signOutOne(id: string) {
    setBusyId(id);
    setFailure(null);
    try {
      await api.del(sessionsPaths.one(id));
      await mutate();
      toast.show({ tone: 'success', title: 'Signed out of that session' });
    } catch (e) {
      setFailure(e instanceof ApiError && e.status < 500 ? e.message : 'That session was not ended. Nothing was changed. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2" aria-label="Your sessions" role="group">
      <h3 className="text-sm font-semibold text-text-primary">Your sessions</h3>
      {failure && <Alert tone="danger" title="Not signed out" body={failure} />}
      <ul className="divide-y divide-border-subtle rounded-lg border border-border-default">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
                <span className="[overflow-wrap:anywhere]">{s.device}</span>
                {s.current && <Badge tone="success">This device</Badge>}
              </div>
              <div className="text-xs text-text-muted tabular-nums">
                {s.lastSeenAt ? `Last active ${time.format(s.lastSeenAt)}` : s.createdAt ? `Signed in ${time.format(s.createdAt)}` : ''}
                {s.ip ? ` · ${s.ip}` : ''}
              </div>
            </div>
            {!s.current && (
              <Button
                size="sm"
                variant="ghost"
                isLoading={busyId === s.id}
                disabled={busyId !== null}
                aria-label={`Sign out session: ${s.device}`}
                onClick={() => void signOutOne(s.id)}
              >
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
