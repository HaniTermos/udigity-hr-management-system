'use client';

import React from 'react';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { NoticeAccess } from '@/components/ui/NoticeAccess';
import { ApiErrorView, SaveConflict, type ConflictField } from '@/components/states';
import type { ApiError } from '@/lib/api';
import { classifyError, type ErrorRoute } from '@/lib/errorRouting';
import { missingFacts, type DealStage } from '@/lib/api/deals';
import type { ProjectStatus, TaskStatus } from '@/lib/api/projects';
import type { MeetingStatus } from '@/lib/api/meetings';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `YYYY-MM-DD` or ISO instant (company date) -> "16 Oct 2026". */
export function fmtDate(iso: string | null | undefined, withYear = true): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtDayMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Local `YYYY-MM-DDTHH:mm` for a datetime-local input. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Today as `YYYY-MM-DD` (input default). */
export function todayInput(): string {
  return toLocalInput(new Date().toISOString()).slice(0, 10);
}

/* ---------------- labels and badges ---------------- */

/** D16 (approved) stage names. "Payment pending verification" is derived: see `dealStageLabel`. */
export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  accepted_opportunity: 'Accepted',
  meeting_scheduled: 'Meeting scheduled',
  proposal_sent: 'Proposal sent',
  signed: 'Signed',
  paid: 'Paid',
  signed_and_paid: 'Signed and paid',
  closed: 'Verified closed',
  not_proceeding: 'Lost',
};

export const PAYMENT_PENDING_VERIFICATION = 'Payment pending verification';

/** Paid / Signed and paid with an open Owner verification request reads "Payment pending verification". */
export function dealStageLabel(stage: DealStage, pendingVerification = false): string {
  if (pendingVerification && (stage === 'paid' || stage === 'signed_and_paid')) return PAYMENT_PENDING_VERIFICATION;
  return DEAL_STAGE_LABEL[stage];
}

const DEAL_TONE: Record<DealStage, BadgeTone> = {
  accepted_opportunity: 'neutral',
  meeting_scheduled: 'neutral',
  proposal_sent: 'neutral',
  signed: 'warning',
  paid: 'warning',
  signed_and_paid: 'warning',
  closed: 'info',
  not_proceeding: 'danger',
};

/** Deal history event types as readable sentences; unknown types fall back to sentence case (never the raw key). */
export const DEAL_HISTORY_LABEL: Record<string, string> = {
  created: 'Opportunity accepted',
  'deal.developer_assigned': 'Developer assigned',
  'deal.developer_reassigned': 'Developer reassigned',
  'deal.signature_recorded': 'Signature recorded',
  'deal.payment_recorded': 'Payment recorded',
  'deal.fact_removed': 'Fact removed',
  'deal.closure_requested': 'Closure verification requested',
  'deal.closure_rejected': 'Closure rejected',
  'deal.closed': 'Deal closed',
  'deal.not_proceeding': 'Marked not proceeding',
  'deal.marked_not_proceeding': 'Marked not proceeding',
  'deal.reopened': 'Deal reopened',
  stage_advanced: 'Stage moved forward',
  contract_updated: 'Contract amount updated',
  financial_corrected: 'Financial facts corrected by the Owner',
};

export function dealHistoryLabel(type: string): string {
  if (DEAL_HISTORY_LABEL[type]) return DEAL_HISTORY_LABEL[type];
  const t = type.replace(/^deals?[._]/, '').replace(/[._]/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Updated';
}

export function DealStageBadge({ stage, size, pendingVerification }: { stage: DealStage; size?: 'sm' | 'md'; pendingVerification?: boolean }) {
  return (
    <Badge tone={DEAL_TONE[stage]} size={size} hasDot>
      {dealStageLabel(stage, pendingVerification)}
    </Badge>
  );
}

/**
 * D17 (approved) labels. Waiting for client and Blocked both read "On hold" (the reason stays shown next to
 * it); Delivered is a sub-step of In progress. Stored values are unchanged.
 */
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  scheduled: 'Not started',
  in_progress: 'In progress',
  waiting_for_client: 'On hold',
  blocked: 'On hold',
  delivered: 'In progress · Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Distinct option text where both On hold values appear side by side (filters, move menus). */
export const PROJECT_STATUS_OPTION_LABEL: Record<ProjectStatus, string> = {
  ...PROJECT_STATUS_LABEL,
  waiting_for_client: 'On hold · Waiting for client',
  blocked: 'On hold · Blocked',
};

const PROJECT_TONE: Record<ProjectStatus, BadgeTone> = {
  scheduled: 'neutral',
  in_progress: 'info',
  waiting_for_client: 'warning',
  blocked: 'danger',
  delivered: 'brand',
  completed: 'success',
  cancelled: 'danger',
};

export function isProjectStatus(v: string | null | undefined): v is ProjectStatus {
  return Boolean(v && v in PROJECT_STATUS_LABEL);
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={PROJECT_TONE[status]} hasDot>
      {PROJECT_STATUS_LABEL[status]}
    </Badge>
  );
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const tone: BadgeTone = status === 'done' ? 'success' : status === 'in_progress' ? 'info' : status === 'cancelled' ? 'danger' : 'neutral';
  return (
    <Badge tone={tone} hasDot>
      {TASK_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Task-level waiting: a chip next to the normal status, never a status or a column. */
export function ClientDependencyChip() {
  return (
    <Badge tone="warning" derived>
      Client dependency
    </Badge>
  );
}

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  held: 'Held',
  missed: 'Missed',
  cancelled: 'Cancelled',
};

export const MEETING_TONE: Record<MeetingStatus, BadgeTone> = {
  scheduled: 'info',
  held: 'success',
  missed: 'warning',
  cancelled: 'neutral',
};

/** Derived chip: dashed border = derived, not stored. */
export function AssignedChip() {
  return (
    <Badge tone="neutral" derived>
      Assigned to me
    </Badge>
  );
}

export function OverdueChip() {
  return (
    <Badge tone="warning" derived>
      Delivery overdue
    </Badge>
  );
}

export function PersonCell({ name }: { name: string | null }) {
  if (!name) return <span className="text-text-muted">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar name={name} size="sm" tone="neutral" />
      <span>{name}</span>
    </span>
  );
}

/* ---------------- errors (all routed through FE1's components) ---------------- */

/** A failed page or list load: 401/403/hidden/404/offline/5xx via FE1's `ApiErrorView`. */
export function LoadError({
  error,
  onRetry,
  backHref = '/deals',
  backLabel = 'Back to Deals',
  what,
}: {
  error: unknown;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
  what?: string;
}) {
  return <ApiErrorView error={error} onRetry={onRetry} backHref={backHref} backLabel={backLabel} area="Delivery" what={what} />;
}

/** A failed widget inside a page (deal context, meetings card, history). */
export function InlineError({ error, onRetry, what }: { error: unknown; onRetry?: () => void; what?: string }) {
  const r = classifyError(error);
  if (r.kind === 'permission-denied' || r.kind === 'owner-2fa-required') return <NoticeAccess type="permission-denied" size="inline" />;
  if (r.kind === 'hidden-by-policy' || r.kind === 'not-found') return <NoticeAccess type="hidden-by-policy" size="inline" />;
  return <ApiErrorView route={r} onRetry={onRetry} size="inline" what={what} />;
}

/**
 * The failure of a command inside a dialog or drawer. 403 and hidden records use FE1's access notices; 409/422
 * business rules show the server's message (and, for a closure, the facts that are still missing).
 * Field validation and 409 VERSION_CONFLICT are rendered by the caller (inline errors, `DeliveryConflict`).
 */
export function ActionError({ route, error, onRetry }: { route: ErrorRoute | null; error: ApiError | null; onRetry?: () => void }) {
  if (!route || route.kind === 'conflict') return null;
  if (route.kind === 'permission-denied') return <NoticeAccess type="permission-denied" size="inline" />;
  if (route.kind === 'owner-2fa-required') {
    return <NoticeAccess type="permission-denied" size="inline" title="Two-step verification required" body="Complete two-step verification, then try again." />;
  }
  if (route.kind === 'hidden-by-policy' || route.kind === 'not-found') return <NoticeAccess type="hidden-by-policy" size="inline" />;
  const retry = onRetry ? (
    <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
      Try again
    </Button>
  ) : null;
  if (route.kind === 'offline') {
    return (
      <div className="space-y-1">
        <Alert tone="warning" title="You’re offline" body="Nothing was saved. Your entries are kept; try again when your connection returns." />
        {retry}
      </div>
    );
  }
  if (route.kind === 'session-ended') return <Alert tone="danger" title="Your session ended" body="Sign in again; your entries on this page are not saved." />;
  if (route.kind === 'validation') {
    return Object.keys(route.fieldErrors).length === 0 ? <Alert tone="danger" title={error?.message ?? 'Check the highlighted fields.'} /> : null;
  }
  const missing = missingFacts(error?.details);
  if (missing.length > 0) {
    return (
      <Alert
        tone="warning"
        title="Closure needs more facts"
        body={`Still missing: ${missing.map((m) => (m === 'signature' ? 'Agreement reference' : 'Payment date')).join(' and ')}. Record them, then verify.`}
      />
    );
  }
  return (
    <div className="space-y-1">
      <Alert
        tone="danger"
        title={error?.message ?? 'Could not save'}
        body={route.kind === 'rate-limited' ? 'Too many requests. Wait a moment, then try again.' : 'Nothing was changed.'}
      />
      {route.kind === 'error' || route.kind === 'rate-limited' ? retry : null}
    </div>
  );
}

/** Field-level message from a 400 VALIDATION_ERROR (first message of the first matching key). */
export function fieldMessage(fieldErrors: Record<string, string[]>, ...keys: string[]): string | undefined {
  for (const k of keys) if (fieldErrors[k]?.[0]) return fieldErrors[k][0];
  return undefined;
}

export interface ConflictSnapshot {
  entity: string;
  labels: { key: string; label: string }[];
  /** Values when the user opened the record. */
  base: Record<string, string>;
  /** The user's unsaved edit (merged over `base`). */
  mine: Record<string, string>;
  baseUpdatedAt: string;
}

/**
 * SCR-SHR-014 for a delivery record (409 VERSION_CONFLICT). The API body does not carry the conflicting record
 * (BL-09), so "their" side is the freshly re-fetched record, passed as `latest`. Nothing is overwritten.
 */
export function DeliveryConflict({
  snapshot,
  latest,
  latestUpdatedAt,
  onReapply,
  onReload,
  onCancel,
}: {
  snapshot: ConflictSnapshot;
  latest: Record<string, string>;
  latestUpdatedAt: string;
  onReapply: () => void;
  onReload: () => void;
  onCancel: () => void;
}) {
  const fields: ConflictField[] = snapshot.labels.map((l) => ({
    key: l.key,
    label: l.label,
    base: snapshot.base[l.key] ?? '',
    theirs: latest[l.key] ?? '',
    mine: snapshot.mine[l.key] ?? snapshot.base[l.key] ?? '',
  }));
  return (
    <SaveConflict
      entity={snapshot.entity}
      savedBy="another user"
      savedAt={fmtTime(latestUpdatedAt)}
      openedAt={fmtTime(snapshot.baseUpdatedAt)}
      fields={fields}
      onReapply={onReapply}
      onReload={onReload}
      onCancel={onCancel}
    />
  );
}

export function PageTitle({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl leading-8 font-semibold tracking-tight text-text-primary">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {aside && <div className="shrink-0 flex flex-wrap items-center gap-2">{aside}</div>}
    </div>
  );
}
