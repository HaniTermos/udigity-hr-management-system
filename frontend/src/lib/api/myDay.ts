/**
 * My Day data (SCR-SHR-001): the signed-in employee's work list and today's targets. Owner: FE1.
 *
 * The work list maps the shipped `/api/work-items` rows (`WorkItem`); targets read `/api/targets?scope=self`.
 * Each card on My Day loads on its own, so a failing endpoint never hides the attendance card.
 */
import { api } from './client';
import { workPaths, type TargetItem, type WorkItem } from './work';
import type { Id, IsoDateTime, Page } from './types';

export const myDayPaths = {
  workList: workPaths.myWorkItems,
  targets: '/api/targets',
} as const;

export interface WorkItemDto {
  id: Id;
  /** The task title. */
  title: string;
  /** Extra line: the description, or the due date when there is none. Empty when neither exists. */
  detail: string;
  /** Row chip: Open, In progress. */
  statusLabel: string;
  dueAt: IsoDateTime | null;
  /** Where the row goes: the business workspace when the item came from a business, otherwise the queue. */
  href: string;
}

export interface WorkListDto {
  items: WorkItemDto[];
  /** Total open items for the employee; the list shows the first few. */
  total: number;
}

export interface TargetProgressDto {
  key: string;
  label: string;
  done: number;
  target: number;
}

export interface MyTargetsDto {
  /** "Set by the Owner". Empty when the Owner has set none for today. */
  targets: TargetProgressDto[];
}

const STATUS_LABEL: Record<WorkItem['status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Done',
  cancelled: 'Cancelled',
};

/** `GET /api/work-items?state=open`: the caller's own open items (the server scopes by assignee), mapped for My Day. */
export async function getMyWorkList(): Promise<WorkListDto> {
  const res = await api.get<Page<WorkItem>>(myDayPaths.workList, { query: { state: 'open', pageSize: 5 } });
  return {
    total: res.total,
    items: res.items.map((i) => ({
      id: i.id,
      title: i.title,
      detail: i.description ?? '',
      statusLabel: STATUS_LABEL[i.status] ?? i.status,
      dueAt: i.dueDate,
      href: i.sourceType === 'business' && i.sourceId ? `/queue/${i.sourceId}` : '/queue',
    })),
  };
}

export async function getMyTargets(): Promise<MyTargetsDto> {
  const res = await api.get<Page<TargetItem>>(myDayPaths.targets, { query: { scope: 'self' } });
  return {
    targets: res.items.map((t) => ({
      key: t.id,
      label: t.territory || t.metric.replace(/_/g, ' '),
      done: Number(t.currentValue ?? 0),
      target: Number(t.targetValue ?? 0),
    })),
  };
}
