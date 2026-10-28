import React from 'react';
import Link from 'next/link';
import type { DuplicateMatch, SimilarName } from '@/lib/api/businesses';
import { Button } from '@/components/ui/Button';
import { CardInset } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { NoticeAccess } from '@/components/ui/NoticeAccess';
import { NoticePolicy } from '@/components/ui/NoticePolicy';

/**
 * SCR-DE-003 Duplicate blocked. One dialog, four entry points (create, edit with the record excluded, applying a
 * correction, a duplicate saved by someone else first). There is NO bypass, merge or "save anyway" control.
 * DEC-003 shaping: a match the viewer cannot open reveals existence only: no name, phone, id or matched field.
 */
export function DuplicateBlockedDialog({
  open,
  match,
  onClose,
}: {
  open: boolean;
  match: DuplicateMatch | null;
  onClose: () => void;
}) {
  if (!match) return null;
  const visible = match.visibility === 'visible';
  return (
    <Dialog
      isOpen={open}
      onClose={onClose}
      title="This business already exists"
      description={
        visible
          ? 'A matching business exists. Saving is blocked.'
          : 'A matching business exists, so saving is blocked. You cannot open it, so no details are shown.'
      }
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Back to form
          </Button>
          {visible && (
            <Link href={`/businesses/${match.id}`} className="inline-flex">
              <Button leadingIcon={<Icon name="arrow-right" size={16} />} tabIndex={-1}>
                Open existing business
              </Button>
            </Link>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {visible ? (
          <CardInset className="flex flex-col gap-1">
            <p className="ds-overline text-text-muted">{match.archived ? 'Existing business (archived)' : 'Existing business'}</p>
            <p className="text-base font-semibold leading-6 text-text-primary">
              {match.name}
              {match.branch ? <span className="font-normal text-text-secondary"> ({match.branch})</span> : null}
            </p>
            <p className="text-[13px] leading-[18px] text-text-secondary">
              Matched on {match.matchedOn === 'phone' ? 'phone' : 'name'}:{' '}
              <span className="font-medium text-text-primary tabular-nums">{match.matchedValue}</span>
            </p>
            {match.archived && <p className="text-[13px] leading-[18px] text-text-secondary">This record is archived. Only the Owner can restore it.</p>}
            {match.phones.length > 0 && (
              <p className="text-[13px] leading-[18px] text-text-muted tabular-nums">Phones on record: {match.phones.join(', ')}</p>
            )}
          </CardInset>
        ) : (
          <NoticeAccess
            type="hidden-by-policy"
            size="inline"
            title="Details are not shown"
            body="You cannot open the matching business."
          />
        )}
        <NoticePolicy
          size="inline"
          dec="DEC-003"
          demo
          body={
            visible
              ? 'What a blocked user may see about a match is not decided. This shows the match only because you can open it.'
              : 'What a blocked user may see about a match they cannot open is not decided. This shows existence only.'
          }
        />
        <p className="text-[13px] leading-[18px] text-text-muted">No role can bypass a duplicate block.</p>
      </div>
    </Dialog>
  );
}

/** SCR-DE-004 "Duplicate blocked (self-excluded)": a banner above the form plus an inline error on the phone. */
export function DuplicateBlockedBanner({
  match,
  excludedSelf,
}: {
  match: DuplicateMatch;
  /** True on Edit: the record is excluded from its own check. */
  excludedSelf?: boolean;
}) {
  const visible = match.visibility === 'visible';
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-status-danger-border bg-status-danger-bg p-3.5 text-status-danger-fg">
      <Icon name="alert-circle" size={20} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-5">This business already exists — saving is blocked</p>
        <p className="text-[13px] leading-[18px] mt-0.5">
          {visible ? (
            <>
              {match.matchedOn === 'phone' ? 'Phone' : 'Name'} <span className="tabular-nums">{match.matchedValue}</span> belongs to {match.name}
              {match.branch ? ` (${match.branch})` : ''}.
            </>
          ) : (
            'A matching business exists. Details are not shown.'
          )}
          {excludedSelf ? ' This record was excluded from its own check.' : ''} No role can bypass the block.
        </p>
      </div>
      {visible && (
        <Link href={`/businesses/${match.id}`} className="shrink-0 text-[13px] leading-[18px] font-medium underline underline-offset-2">
          Open existing business
        </Link>
      )}
    </div>
  );
}

/**
 * DEC-013 SN-1 similar-name warning (409 `CONFLICT_DUPLICATE`, `details.kind = similar_name`). It is a warning, not a
 * block: "Different business, continue" resends the save with `confirmSimilar`. It lists only businesses you can open.
 */
export function SimilarNameDialog({
  similar,
  busy,
  onClose,
  onContinue,
}: {
  similar: SimilarName[] | null;
  busy?: boolean;
  onClose: () => void;
  onContinue: () => void;
}) {
  if (!similar) return null;
  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="A similar business exists"
      description="The name is close to a business already stored. Check it is not the same one before you continue."
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Back to form
          </Button>
          <Button isLoading={busy} onClick={onContinue}>
            Different business, continue
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {similar.map((s) => (
            <li key={s.id}>
              <CardInset className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-sm leading-5 text-text-primary">
                  <span className="font-medium">{s.name}</span>
                  {s.branch ? <span className="text-text-secondary"> ({s.branch})</span> : null}
                </span>
                <Link href={`/businesses/${s.id}`} target="_blank" rel="noreferrer" className="shrink-0 text-[13px] leading-[18px] font-medium text-text-link hover:underline underline-offset-2">
                  Open
                </Link>
              </CardInset>
            </li>
          ))}
        </ul>
        <NoticePolicy size="inline" dec="DEC-013" demo body="Similar names warn; identical name and branch, or the same phone, block." />
      </div>
    </Dialog>
  );
}
