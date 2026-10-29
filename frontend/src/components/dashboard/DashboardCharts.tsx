'use client';

/**
 * Owner dashboard charts (Recharts). One axis per chart, thin marks (bars <= 24 px with 4 px rounded ends,
 * 2 px lines, 8 px dots), recessive grid, a hover tooltip on every mark, and text in text tokens (never the
 * series colour). Two-series charts use the validated pair --chart-pair-1/2; single-series charts use pair 1;
 * attendance states use the status tokens with labels. Numbers stay visible next to each chart.
 */
import React from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DEAL_STAGE_LABEL } from '@/components/delivery/shared';
import type { DealStage } from '@/lib/api/deals';
import type { DashboardMetrics } from '@/lib/api/reports';

const C1 = 'var(--chart-pair-1)';
const C2 = 'var(--chart-pair-2)';
const GRID = 'var(--chart-grid)';
const AXIS = 'var(--chart-axis)';
const HOVER = 'var(--chart-hover)';
const TICK = { fill: AXIS, fontSize: 12 };
const BAR_END: [number, number, number, number] = [4, 4, 0, 0];
const BAR_END_H: [number, number, number, number] = [0, 4, 4, 0];

const dayLabel = (day: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

interface TipRow {
  label: string;
  value: React.ReactNode;
  swatch?: string;
}

/** Tooltip card: title + rows; swatch carries identity, text stays in text tokens. */
function TipCard({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-raised px-3 py-2 shadow-lg text-xs min-w-[150px]">
      <div className="font-semibold text-text-primary mb-1">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-text-secondary">
            {r.swatch && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.swatch }} aria-hidden />}
            {r.label}
          </span>
          <span className="font-medium text-text-primary tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

type TipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> };

function Legend({ items }: { items: { label: string; color: string; kind?: 'bar' | 'line' }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.kind === 'line' ? (
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: i.color }} aria-hidden />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-text-secondary my-auto">{text}</p>;
}

function callingTip({ active, payload }: TipProps) {
  const p = active ? (payload?.[0]?.payload as { label: string; attempts: number; contacted: number } | undefined) : undefined;
  if (!p) return null;
  return (
    <TipCard
      title={p.label}
      rows={[
        { label: 'Calls', value: p.attempts, swatch: C1 },
        { label: 'Businesses contacted', value: p.contacted, swatch: C2 },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Calling activity per day: bars = calls, line = distinct businesses contacted (same unit: count).
// ---------------------------------------------------------------------------

export function CallingDailyChart({ daily }: { daily: DashboardMetrics['calling']['daily'] }) {
  if (daily.length === 0) return <Empty text="Choose a range of up to 92 days to see the per-day breakdown." />;
  const data = daily.map((d) => ({ ...d, label: dayLabel(d.day) }));
  return (
    <div className="flex flex-col gap-2">
      <Legend items={[{ label: 'Calls', color: C1 }, { label: 'Businesses contacted', color: C2, kind: 'line' }]} />
      <div className="h-[190px]" role="img" aria-label={`Calls and businesses contacted per day, ${data.length} days`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={callingTip} cursor={{ fill: HOVER }} />
            <Bar dataKey="attempts" name="Calls" fill={C1} radius={BAR_END} maxBarSize={24} isAnimationActive={false} />
            <Line
              dataKey="contacted"
              name="Businesses contacted"
              type="monotone"
              stroke={C2}
              strokeWidth={2}
              dot={{ r: 4, fill: C2, stroke: 'var(--surface-default)', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: C2, stroke: 'var(--surface-default)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-series horizontal bars (business status, pipeline by stage): value at the bar tip.
// ---------------------------------------------------------------------------

interface CountItem {
  label: string;
  value: number;
}

function countTip({ active, payload }: TipProps, total?: number) {
  const p = active ? (payload?.[0]?.payload as CountItem | undefined) : undefined;
  if (!p) return null;
  const rows: TipRow[] = [{ label: 'Count', value: p.value, swatch: C1 }];
  if (total && total > 0) rows.push({ label: 'Share of total', value: `${Math.round((p.value / total) * 100)}%` });
  return <TipCard title={p.label} rows={rows} />;
}

function HorizontalBars({ items, total, ariaLabel }: { items: CountItem[]; total?: number; ariaLabel: string }) {
  return (
    <div style={{ height: items.length * 30 + 8 }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={132} tick={{ ...TICK, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
          <Tooltip content={(t: TipProps) => countTip(t, total)} cursor={{ fill: HOVER }} />
          <Bar
            dataKey="value"
            fill={C1}
            radius={BAR_END_H}
            maxBarSize={18}
            isAnimationActive={false}
            minPointSize={2}
            label={{ position: 'right', fill: 'var(--text-primary)', fontSize: 12 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BusinessStatusChart({ b }: { b: DashboardMetrics['businesses'] }) {
  const items: CountItem[] = [
    { label: 'Pending', value: b.pending },
    { label: 'Callback requests', value: b.callbackRequests },
    { label: 'On hold', value: b.onHold },
    { label: 'Rejected', value: b.rejected },
    { label: 'Unassigned', value: b.unassigned },
    { label: 'Needing corrections', value: b.needingCorrections },
  ];
  return <HorizontalBars items={items} total={b.total} ariaLabel="Businesses by calling status" />;
}

const STAGE_ORDER: DealStage[] = [
  'accepted_opportunity',
  'meeting_scheduled',
  'proposal_sent',
  'signed',
  'paid',
  'signed_and_paid',
  'closed',
  'not_proceeding',
];

export function PipelineStageChart({ byStage }: { byStage: Record<string, number> }) {
  const items: CountItem[] = STAGE_ORDER.map((s) => ({ label: DEAL_STAGE_LABEL[s], value: byStage[s] ?? 0 }));
  const total = items.reduce((n, i) => n + i.value, 0);
  if (total === 0) return <Empty text="No deals yet." />;
  return <HorizontalBars items={items} total={total} ariaLabel="Deals by stage" />;
}

// ---------------------------------------------------------------------------
// Attendance today: one stacked bar of states (status tokens + labels), 2 px surface gaps.
// ---------------------------------------------------------------------------

export function AttendanceTodayBar({ a }: { a: DashboardMetrics['attendance'] }) {
  const parts = [
    { key: 'in', label: 'Checked in', value: a.checkedInToday, color: 'var(--status-success-fg)' },
    { key: 'not', label: 'Not checked in', value: a.absentOrMissingCheckin, color: 'var(--status-warning-fg)' },
    { key: 'missing', label: 'Missing checkout', value: a.missingCheckouts, color: 'var(--status-danger-fg)' },
  ];
  const total = parts.reduce((n, p) => n + p.value, 0);
  const row = Object.fromEntries(parts.map((p) => [p.key, p.value]));
  return (
    <div className="flex flex-col gap-2">
      <div className="h-7" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {total === 0 ? (
          <div className="h-full rounded-md bg-surface-sunken" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[row]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
              <XAxis type="number" hide domain={[0, total]} />
              <YAxis type="category" hide />
              <Tooltip
                content={({ active }: TipProps) =>
                  active ? <TipCard title="Attendance today" rows={parts.map((p) => ({ label: p.label, value: p.value, swatch: p.color }))} /> : null
                }
                cursor={false}
              />
              {parts.map((p) => (
                <Bar
                  key={p.key}
                  dataKey={p.key}
                  stackId="att"
                  fill={p.color}
                  stroke="var(--surface-default)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <Legend items={parts.map((p) => ({ label: `${p.label} · ${p.value}`, color: p.color }))} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Developer workload: grouped columns per developer (open tasks, active projects).
// ---------------------------------------------------------------------------

function workTip({ active, payload }: TipProps) {
  const p = active ? (payload?.[0]?.payload as { name: string; tasks: number; projects: number; deals: number } | undefined) : undefined;
  if (!p) return null;
  return (
    <TipCard
      title={p.name}
      rows={[
        { label: 'Open tasks', value: p.tasks, swatch: C1 },
        { label: 'Active projects', value: p.projects, swatch: C2 },
        { label: 'Active deals', value: p.deals },
      ]}
    />
  );
}

export function DeveloperWorkloadChart({ items }: { items: DashboardMetrics['workload']['developerWorkload'] }) {
  if (items.length === 0) return <Empty text="No developers with open work." />;
  const data = items.map((d) => ({ name: d.developerName, tasks: d.openTasksCount, projects: d.activeProjectsCount, deals: d.activeDealsCount }));
  return (
    <div className="flex flex-col gap-2">
      <Legend items={[{ label: 'Open tasks', color: C1 }, { label: 'Active projects', color: C2 }]} />
      <div className="h-[190px]" role="img" aria-label="Open tasks and active projects per developer">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
            <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={workTip} cursor={{ fill: HOVER }} />
            <Bar dataKey="tasks" name="Open tasks" fill={C1} radius={BAR_END} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="projects" name="Active projects" fill={C2} radius={BAR_END} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
