'use client';

import React from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Table, TableContainer, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { cn } from '@/lib/utils';

/*
 * SCR-SHR-014 Save conflict (409 VERSION_CONFLICT), field-level diff. Nothing was overwritten and the
 * user's edits stay on the page. Result per field (three-way compare of base / saved-by-other / mine):
 *   only they changed -> "Their change", only I changed -> "Your change", both -> "Both changed".
 * Fields where nobody changed are not listed. Desktop: table; mobile: stacked cards.
 */

export interface ConflictField {
  key: string;
  label: string;
  /** Value when the user opened the record. */
  base: string;
  /** Value saved by the other person. */
  theirs: string;
  /** The user's unsaved edit. */
  mine: string;
}

export type ConflictResult = 'theirs' | 'mine' | 'both' | 'none';

export function conflictResult(f: Pick<ConflictField, 'base' | 'theirs' | 'mine'>): ConflictResult {
  const theirsChanged = f.theirs !== f.base;
  const mineChanged = f.mine !== f.base;
  if (theirsChanged && mineChanged) return f.theirs === f.mine ? 'none' : 'both';
  if (theirsChanged) return 'theirs';
  if (mineChanged) return 'mine';
  return 'none';
}

const RESULT_BADGE: Record<Exclude<ConflictResult, 'none'>, { label: string; tone: 'neutral' | 'info' | 'warning' }> = {
  theirs: { label: 'Their change', tone: 'neutral' },
  mine: { label: 'Your change', tone: 'info' },
  both: { label: 'Both changed', tone: 'warning' },
};

export interface SaveConflictProps {
  /** e.g. "business". */
  entity: string;
  /** Who saved the newer version and when, already formatted in company time (e.g. "Rana Haddad", "10:42"). */
  savedBy: string;
  savedAt: string;
  openedAt: string;
  fields: ConflictField[];
  /** Put my edits on top of the latest version; the user reviews again before saving. */
  onReapply: () => void;
  onReload: () => void;
  onCancel: () => void;
  isBusy?: boolean;
  className?: string;
}

export function SaveConflict({ entity, savedBy, savedAt, openedAt, fields, onReapply, onReload, onCancel, isBusy, className }: SaveConflictProps) {
  const rows = fields.map((f) => ({ ...f, result: conflictResult(f) })).filter((f) => f.result !== 'none');
  return (
    <section aria-labelledby="save-conflict-title" className={cn('flex flex-col gap-4', className)}>
      <Alert
        tone="warning"
        role="alert"
        title={`Someone else changed this ${entity} while you were editing`}
        body={`${savedBy} saved changes at ${savedAt}. Nothing was overwritten. Review the differences, then re-apply your edits or reload the latest version.`}
      />

      <div className="rounded-xl border border-border-default bg-surface-default p-5 flex flex-col gap-3">
        <div>
          <h2 id="save-conflict-title" className="text-base font-semibold leading-6 text-text-primary">
            Changes since you opened this record
          </h2>
          <p className="text-[13px] leading-[18px] text-text-secondary">
            {rows.length} {rows.length === 1 ? 'field differs' : 'fields differ'} · your edits are kept on this page until you choose
          </p>
        </div>

        <TableContainer className="hidden md:block">
          <Table>
            <THead>
              <tr>
                <TH>Field</TH>
                <TH>When you opened ({openedAt})</TH>
                <TH>Saved by {savedBy} ({savedAt})</TH>
                <TH>Your edit (not saved)</TH>
                <TH>Result</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const badge = RESULT_BADGE[r.result as Exclude<ConflictResult, 'none'>];
                return (
                  <TR key={r.key} interactive={false}>
                    <TD>{r.label}</TD>
                    <TD>{r.base || '—'}</TD>
                    <TD>{r.theirs === r.base ? `${r.theirs || '—'} (unchanged)` : r.theirs || '—'}</TD>
                    <TD>{r.mine === r.base ? `${r.mine || '—'} (unchanged)` : r.mine || '—'}</TD>
                    <TD>
                      <Badge tone={badge.tone} size="sm">
                        {badge.label}
                      </Badge>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>

        <ul className="md:hidden flex flex-col gap-3">
          {rows.map((r) => {
            const badge = RESULT_BADGE[r.result as Exclude<ConflictResult, 'none'>];
            return (
              <li key={r.key} className="rounded-lg border border-border-default p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text-primary">{r.label}</span>
                  <Badge tone={badge.tone} size="sm">
                    {badge.label}
                  </Badge>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px] leading-[18px]">
                  <dt className="text-text-muted">Opened</dt>
                  <dd className="text-text-primary break-words">{r.base || '—'}</dd>
                  <dt className="text-text-muted">Saved</dt>
                  <dd className="text-text-primary break-words">{r.theirs || '—'}</dd>
                  <dt className="text-text-muted">Yours</dt>
                  <dd className="text-text-primary break-words">{r.mine || '—'}</dd>
                </dl>
              </li>
            );
          })}
        </ul>

        <p className="text-[13px] leading-[18px] text-text-muted">
          Re-applying puts your edits on top of the latest saved version; you review them again before saving. “Both changed” fields show both values side by side.
        </p>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={isBusy}>
          Cancel editing
        </Button>
        <Button variant="secondary" leadingIcon={<Icon name="refresh" size={16} />} onClick={onReload} disabled={isBusy}>
          Reload latest
        </Button>
        <Button onClick={onReapply} isLoading={isBusy}>
          Re-apply my edits
        </Button>
      </div>
    </section>
  );
}
