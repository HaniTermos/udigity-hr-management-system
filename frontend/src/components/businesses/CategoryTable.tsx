'use client';

import React, { useState } from 'react';
import type { CategoryRow } from '@/lib/api/businesses';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StateView } from '@/components/ui/State';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { ListSkeleton } from './AsyncState';
import { formatDay } from './format';

function RenameCell({
  row,
  taken,
  saving,
  error,
  onSave,
  onCancel,
}: {
  row: CategoryRow;
  taken: (name: string) => boolean;
  saving: boolean;
  error?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(row.name);
  const trimmed = name.trim();
  const clash = trimmed.toLowerCase() !== row.name.toLowerCase() && taken(trimmed);
  const message = error ?? (clash ? 'A category with this name already exists.' : undefined);
  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && !clash && trimmed !== row.name) onSave(trimmed);
      }}
    >
      <Input
        aria-label={`New name for ${row.name}`}
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={message}
        wrapperClassName="min-w-[160px] flex-1"
      />
      <Button type="submit" size="sm" className="mt-1" isLoading={saving} disabled={!trimmed || clash || trimmed === row.name}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
    </form>
  );
}

/** SCR-DE-007 category table: Category, Businesses, Status, Last changed, Rename / Remove… (Owner). */
export function CategoryTable({
  rows,
  loading,
  error,
  canManage,
  renamingId,
  renameSaving,
  renameError,
  onStartRename,
  onCancelRename,
  onRename,
  onRemove,
}: {
  rows: CategoryRow[];
  loading?: boolean;
  error?: React.ReactNode;
  canManage: boolean;
  renamingId: string | null;
  renameSaving: boolean;
  renameError?: string;
  onStartRename: (id: string) => void;
  onCancelRename: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (row: CategoryRow) => void;
}) {
  const [order, setOrder] = useState<'ascending' | 'descending'>('ascending');
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name) * (order === 'ascending' ? 1 : -1));
  const taken = (name: string) => rows.some((r) => r.name.toLowerCase() === name.toLowerCase());

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border-default bg-surface-default">
      <div className="overflow-x-auto">
        <Table aria-label="Categories">
          <THead>
            <tr>
              <TH sort={order} onSort={() => setOrder((o) => (o === 'ascending' ? 'descending' : 'ascending'))}>
                Category
              </TH>
              <TH align="right">Businesses</TH>
              <TH>Status</TH>
              <TH>Last changed</TH>
              <TH>{canManage ? 'Actions' : <span className="sr-only">Actions</span>}</TH>
            </tr>
          </THead>
          <TBody>
            {sorted.map((c) => (
              <TR key={c.id}>
                <TD className="min-w-[200px]">
                  {renamingId === c.id ? (
                    <RenameCell
                      row={c}
                      taken={taken}
                      saving={renameSaving}
                      error={renameError}
                      onSave={(name) => onRename(c.id, name)}
                      onCancel={onCancelRename}
                    />
                  ) : (
                    c.name
                  )}
                </TD>
                <TD numeric>{c.businessCount}</TD>
                <TD>
                  <Badge tone={c.active ? 'success' : 'neutral'}>{c.active ? 'Active' : 'Inactive'}</Badge>
                </TD>
                <TD meta={formatDay(c.lastChangedAt)}>{c.lastChangedBy ?? '—'}</TD>
                <TD>
                  {canManage && renamingId !== c.id && (
                    <div className="flex items-center gap-3 whitespace-nowrap text-[13px]">
                      {c.system ? (
                        <Badge tone="neutral">Built in</Badge>
                      ) : (
                        <Button variant="link" onClick={() => onStartRename(c.id)} aria-label={`Rename ${c.name}`}>
                          Rename
                        </Button>
                      )}
                      {c.active && !c.system && (
                        <Button variant="link" onClick={() => onRemove(c)} aria-label={`Remove ${c.name}…`}>
                          Remove…
                        </Button>
                      )}
                    </div>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      {loading && rows.length === 0 && <ListSkeleton rows={7} />}
      {error}
      {!loading && !error && rows.length === 0 && (
        <StateView type="empty" title="No categories yet" body="Categories you add appear here, and businesses pick one from this list." />
      )}
    </div>
  );
}
