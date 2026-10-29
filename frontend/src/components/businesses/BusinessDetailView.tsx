'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { archiveBusiness, restoreBusiness, type BusinessDetail, type BusinessHistoryEntry } from '@/lib/api/businesses';
import { getCorrection, withdrawCorrection } from '@/lib/api/corrections';
import { ACTIONS } from '@/lib/actions';
import type { Role } from '@/lib/api/types';
import { Alert } from '@/components/ui/Alert';
import { Badge, Tag } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { CardSection } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { NoticeAccess } from '@/components/ui/NoticeAccess';
import { StateView } from '@/components/ui/State';
import { Tabs } from '@/components/ui/Tabs';
import { PageHeader, type Crumb } from './PageHeader';
import { useBusinessAccess, useBusinessHistory, useCategories } from './hooks';
import { ErrorState, ListSkeleton } from './AsyncState';
import { formatDateTime, formatDay, formatDayShort, formatFollowers, formatPhone } from './format';

/** Label / value rows (Figma `KeyValue`). */
export function KeyValueList({ rows }: { rows: { label: string; value: React.ReactNode; muted?: boolean }[] }) {
  return (
    <dl className="flex flex-col gap-4">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[124px_minmax(0,1fr)] gap-3 items-baseline">
          <dt className="text-[13px] leading-[18px] text-text-secondary">{r.label}</dt>
          <dd className={r.muted ? 'text-sm leading-5 text-text-secondary' : 'text-sm leading-5 text-text-primary break-words'}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function crumbsFor(role: Role, b: BusinessDetail): Crumb[] {
  if (role === 'call_center') return [{ label: 'Calling Queue', href: '/queue' }, { label: b.name }];
  if (role === 'developer') {
    const deal = b.dealContext;
    return [
      { label: 'Deals', href: '/deals' },
      ...(deal ? [{ label: `${b.name} — ${deal.deal}`, href: `/deals/${deal.dealId}` }] : []),
      { label: 'Business' },
    ];
  }
  return [{ label: 'Businesses', href: '/businesses' }, { label: b.name }];
}

const FIELD_LABEL: Record<string, string> = {
  name: 'Name',
  branch: 'Branch',
  category: 'Category',
  categoryId: 'Category',
  phones: 'Phone numbers',
  social: 'Social accounts',
  website: 'Website',
  notes: 'Notes',
};

function valueText(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.length === 0 ? '—' : v.map(valueText).join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('number' in o) return `${o.countryCode ?? ''} ${o.number}`.trim();
    if ('handle' in o) return `${o.platform ?? ''} ${o.handle}`.trim();
    return Object.values(o).map(valueText).join(' ');
  }
  return String(v);
}

function entryText(h: BusinessHistoryEntry): { title: string; detail: string } {
  if (h.kind === 'created') return { title: 'Business created', detail: h.by ? `By ${h.by}` : '' };
  if (h.kind === 'archived') return { title: 'Archived', detail: [h.by ? `By ${h.by}` : '', typeof h.after === 'string' ? h.after : ''].filter(Boolean).join(' · ') };
  if (h.kind === 'restored') return { title: 'Restored', detail: h.by ? `By ${h.by}` : '' };
  const label = h.field ? FIELD_LABEL[h.field] ?? h.field : 'Details';
  return {
    title: `${label} changed${h.correctionId ? ' (correction request)' : ''}`,
    detail: `${valueText(h.before)} → ${valueText(h.after)}${h.by ? ` · ${h.by}` : ''}`,
  };
}

function HistoryTimeline({ entries }: { entries: BusinessHistoryEntry[] }) {
  if (entries.length === 0) return <StateView type="empty" size="inline" title="No edits yet" body="Changes to this business will be listed here." />;
  return (
    <ol className="flex flex-col">
      {entries.map((h, i) => {
        const t = entryText(h);
        return (
          <li key={h.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < entries.length - 1 && <span aria-hidden className="absolute left-4 top-9 bottom-1 w-px bg-border-default" />}
            <span className="w-8 h-8 shrink-0 rounded-full bg-surface-sunken border border-border-subtle inline-flex items-center justify-center text-icon-default">
              <Icon name="note" size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-5 text-text-primary">{t.title}</p>
              {t.detail && <p className="text-[13px] leading-[18px] text-text-secondary break-words">{t.detail}</p>}
              <p className="text-xs leading-4 text-text-muted mt-0.5 tabular-nums">{formatDateTime(h.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function HistoryPanel({ id, active }: { id: string; active: boolean }) {
  const { data, error, isLoading, mutate } = useBusinessHistory(id, active);
  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading || !data) return <ListSkeleton rows={4} />;
  return <HistoryTimeline entries={data.items} />;
}

function CorrectionsCard({ business, canOpenQueue, onChanged }: { business: BusinessDetail; canOpenQueue: boolean; onChanged: () => void }) {
  const toast = useToast();
  const { allowed } = useBusinessAccess();
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      // The list row carries no version, so read the request first.
      const current = await getCorrection(id);
      await withdrawCorrection(id, current.version);
      toast.show({ tone: 'success', title: 'Request withdrawn' });
      setWithdrawing(null);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not go through. Nothing was changed; try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardSection
      title="Correction requests"
      action={
        canOpenQueue && (
          <Link href="/corrections" className="text-text-link hover:underline underline-offset-2">
            Open queue
          </Link>
        )
      }
    >
      {business.corrections.length === 0 ? (
        <p className="text-[13px] leading-[18px] text-text-muted">No open requests.</p>
      ) : (
        <dl className="flex flex-col gap-3">
          {business.corrections.map((c) => (
            <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 items-baseline">
              <dt className="text-[13px] leading-[18px] text-text-secondary">{c.issueType}</dt>
              <dd className="text-sm leading-5 text-text-primary">
                {c.status === 'in_review' ? 'In review' : 'Submitted'}
                {c.mine ? ' · from you' : c.reviewer ? ` · ${c.reviewer}` : ''}
                {c.mine && allowed(ACTIONS.correctionWithdraw) && (
                  <Button variant="link" className="ml-2" onClick={() => { setError(null); setWithdrawing(c.id); }} aria-label={`Withdraw request: ${c.issueType}`}>
                    Withdraw
                  </Button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <Dialog
        isOpen={withdrawing !== null}
        onClose={() => setWithdrawing(null)}
        title="Withdraw this request?"
        description="Data Entry will no longer review it. A withdrawn request is never reopened; submit a new one if the data is still wrong."
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setWithdrawing(null)} disabled={busy}>
              Keep request
            </Button>
            <Button variant="destructive" isLoading={busy} onClick={() => withdrawing && withdraw(withdrawing)}>
              Withdraw
            </Button>
          </>
        }
      >
        {error && (
          <p role="alert" className="text-[13px] leading-[18px] font-medium text-status-danger-fg">
            {error}
          </p>
        )}
      </Dialog>
    </CardSection>
  );
}

/** Owner-only archive / restore (C-01 demonstration alternative). Needs a fresh 2FA check on the server. */
function ArchivePanel({ business, onChanged }: { business: BusinessDetail; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archived = business.archived;
  // Owner decision 2026-10-29 "Pick a new category": restoring a business whose category was deactivated needs an
  // active replacement. The select shows when the category is known inactive or the server says CATEGORY_INACTIVE.
  const [needsCategory, setNeedsCategory] = useState(archived && !business.categoryActive);
  const [categoryId, setCategoryId] = useState('');
  const categories = useCategories();
  const activeCategories = (categories.data ?? []).filter((c) => c.active);

  const run = async () => {
    if (archived && needsCategory && !categoryId) {
      setError('Choose an active category to restore this business.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (archived) await restoreBusiness(business.id, business.version, needsCategory ? categoryId : undefined);
      else await archiveBusiness(business.id, business.version, reason.trim() || undefined);
      toast.show({ tone: 'success', title: archived ? 'Business restored' : 'Business archived', body: business.name });
      setOpen(false);
      setReason('');
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && (err.details as { reason?: string } | null)?.reason === 'CATEGORY_INACTIVE') setNeedsCategory(true);
      setError(
        err instanceof ApiError
          ? err.isVersionConflict
            ? 'Someone changed this business first. Reload and try again.'
            : err.code === 'OWNER_2FA_REQUIRED'
              ? 'Confirm your identity with two-step verification, then try again.'
              : err.message
          : 'That did not go through. Nothing was changed; try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" leadingIcon={<Icon name="folder" size={16} />} onClick={() => setOpen(true)}>
        {archived ? 'Restore business' : 'Archive business'}
      </Button>
      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title={archived ? 'Restore this business?' : 'Archive this business?'}
        description={
          archived
            ? 'It returns to the directory and can be edited again.'
            : 'It leaves the directory, search and calling for everyone except the Owner. Nothing is deleted; no role can delete a business.'
        }
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={archived ? 'primary' : 'destructive'} isLoading={busy} onClick={run}>
              {archived ? 'Restore' : 'Archive'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {!archived && (
            <Textarea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} counter={`${reason.length} / 500`} />
          )}
          {archived && needsCategory && (
            <Select
              label="New category"
              helperText={`“${business.category}” was deactivated. Choose an active category; the change is recorded in the history.`}
              placeholder="Choose a category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={activeCategories.map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
          {error && (
            <p role="alert" className="text-[13px] leading-[18px] font-medium text-status-danger-fg">
              {error}
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}

/**
 * SCR-SHR-008 Business detail. One component, four viewpoints chosen from the role and `access`:
 * Data Entry / Owner (Edit business), Call Center (read-only + Flag incorrect data), Developer (context-limited).
 * Hidden-by-policy and permission-denied are the shared `NoticeAccess` states drawn by the page.
 */
export function BusinessDetailView({
  business: b,
  role,
  onFlag,
  initialTab = 'overview',
  onChanged,
}: {
  business: BusinessDetail;
  role: Role;
  initialTab?: 'overview' | 'history' | 'related';
  /** Opens the SCR-SHR-009 drawer (Call Center, Developer; Owner may also flag). */
  onFlag: () => void;
  /** Called after a withdraw, archive or restore so the page refetches. */
  onChanged: () => void;
}) {
  const { allowed } = useBusinessAccess();
  const [tab, setTab] = useState<'overview' | 'history' | 'related'>(initialTab);
  const limited = b.access === 'context_limited';
  const canEdit = (role === 'data_entry' || role === 'owner') && !limited && !b.archived;
  const canArchive = (allowed(ACTIONS.businessArchive) && !b.archived) || (allowed(ACTIONS.businessRestore) && b.archived);
  const canFlag = allowed(ACTIONS.correctionSubmit) && !b.archived;
  const openCount = b.corrections.length;

  const tabs = limited
    ? [{ id: 'overview', label: 'Overview' }]
    : [
        { id: 'overview', label: 'Overview' },
        { id: 'history', label: 'Edit history' },
        { id: 'related', label: 'Related' },
      ];

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      <PageHeader
        breadcrumb={crumbsFor(role, b)}
        title={b.name}
        meta={
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-text-secondary">
            <Tag>{b.category}</Tag>
            {limited ? (
              b.branch && <span>{b.branch}</span>
            ) : (
              <span>
                Created by {b.createdBy}, {formatDay(b.createdAt)} · Last updated by {b.updatedBy ?? '—'}, {formatDateTime(b.updatedAt)}
              </span>
            )}
            {!limited && openCount > 0 && (
              <Badge tone="warning" icon="flag">
                Correction requested ({openCount})
              </Badge>
            )}
            {b.archived && (
              <Badge tone="neutral" icon="flag">
                Archived
              </Badge>
            )}
            {!limited && b.flags.includes('hidden_from_others') && (
              <Badge tone="policy" icon="flag">
                Hidden from other roles
              </Badge>
            )}
          </div>
        }
        actions={
          <>
            {canEdit && (
              <Link href={`/businesses/${b.id}/edit`} className="inline-flex">
                <Button leadingIcon={<Icon name="edit" size={16} />} tabIndex={-1}>
                  Edit business
                </Button>
              </Link>
            )}
            {canFlag && (
              <Button variant="secondary" leadingIcon={<Icon name="flag" size={16} />} onClick={onFlag}>
                Flag incorrect data
              </Button>
            )}
            {canArchive && <ArchivePanel business={b} onChanged={onChanged} />}
          </>
        }
      />

      {role === 'call_center' && (
        <Alert
          tone="info"
          title="Read-only for Call Center"
          body="You can see this business because it is assigned to you. To fix wrong data, use Flag incorrect data — Data Entry reviews it."
        />
      )}
      {b.archived && (
        <Alert tone="info" title="Archived business" body="This business is out of the directory, search and calling. Only the Owner can restore it." />
      )}
      {limited && (
        <NoticeAccess
          type="context-limited"
          size="inline"
          title="Limited business context"
          body={
            role === 'developer'
              ? 'You see only the details needed for this closed deal. Other fields are not shown in this context.'
              : 'You see only the details needed to review a correction request. Other fields are not shown in this context.'
          }
        />
      )}

      <Tabs items={tabs} activeId={tab} onChange={(id) => setTab(id as typeof tab)} />

      {tab === 'overview' && !limited && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
          <div className="flex flex-col gap-4">
            <CardSection title="Contact">
              <KeyValueList
                rows={[
                  ...(b.phones.length === 0
                    ? [{ label: 'Phone', value: 'No phone · not callable', muted: true }]
                    : b.phones.map((p, i) => ({ label: `Phone ${i + 1}`, value: <span className="tabular-nums">{formatPhone(p)}</span> }))),
                  { label: 'Website', value: b.website ?? 'No website', muted: !b.website },
                ]}
              />
            </CardSection>

            <CardSection title="Social accounts">
              {b.social.length === 0 ? (
                <p className="text-[13px] leading-[18px] text-text-muted">No social accounts.</p>
              ) : (
                <KeyValueList
                  rows={b.social.map((s) => ({
                    label: s.platform,
                    value: (
                      <span>
                        {s.handle} · {s.followers === null ? 'followers Unknown' : `${formatFollowers(s.followers)} followers`} · last post{' '}
                        {s.lastPost ? formatDay(s.lastPost) : 'Unknown'}
                      </span>
                    ),
                  }))}
                />
              )}
            </CardSection>

            <CardSection title="Notes">
              <p className="text-sm leading-5 text-text-primary whitespace-pre-wrap break-words">{b.notes ?? 'No notes.'}</p>
            </CardSection>
          </div>

          <div className="flex flex-col gap-4">
            <CorrectionsCard business={b} canOpenQueue={role === 'data_entry' || role === 'owner'} onChanged={onChanged} />
            <CardSection title="Record">
              <KeyValueList
                rows={[
                  { label: 'Created', value: `${b.createdBy} · ${formatDayShort(b.createdAt)}` },
                  { label: 'Last updated', value: `${b.updatedBy ?? '—'} · ${formatDayShort(b.updatedAt)}` },
                  ...(b.calling ? [{ label: 'Calling', value: b.calling }] : []),
                ]}
              />
            </CardSection>
          </div>
        </div>
      )}

      {tab === 'overview' && limited && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
          <CardSection title="Business">
            <KeyValueList
              rows={[
                { label: 'Name', value: b.branch ? `${b.name} (${b.branch})` : b.name },
                { label: 'Primary phone', value: b.phones[0] ? <span className="tabular-nums">{formatPhone(b.phones[0])}</span> : 'No phone', muted: !b.phones[0] },
                { label: 'Website', value: b.website ?? 'No website', muted: !b.website },
                { label: 'Social accounts', value: 'Not shown in this context', muted: true },
                { label: 'Notes', value: b.notes ?? 'Not shown in this context', muted: !b.notes },
              ]}
            />
          </CardSection>
          <div className="flex flex-col gap-4">
            {b.dealContext && (
              <CardSection title="Deal context">
                <KeyValueList
                  rows={[
                    { label: 'Deal', value: b.dealContext.deal },
                    { label: 'Stage', value: b.dealContext.stage },
                    { label: 'Project', value: b.dealContext.project ?? '—' },
                  ]}
                />
              </CardSection>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
          <CardSection title="Edit history" subtitle="Field changes on this business. The audit trail is Owner-only.">
            <HistoryPanel id={b.id} active={tab === 'history'} />
          </CardSection>
          <div className="flex flex-col gap-4">
            <CorrectionsCard business={b} canOpenQueue={role === 'data_entry' || role === 'owner'} onChanged={onChanged} />
          </div>
        </div>
      )}

      {tab === 'related' && (
        <CardSection title="Related">
          <StateView
            type="empty"
            size="inline"
            title="Nothing related to show"
            body="Related calls, deals and follow-ups are listed here for roles that may see them."
          />
        </CardSection>
      )}
    </div>
  );
}
