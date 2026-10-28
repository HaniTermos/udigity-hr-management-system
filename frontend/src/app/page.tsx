'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { Icon } from '@/components/ui/Icon';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { Skeleton } from '@/components/ui/State';
import { ACTIONS } from '@/lib/actions';
import { useApi } from '@/lib/hooks/useApi';
import { useAuth } from '@/lib/auth';
import { useCapability } from '@/lib/hooks/useCapability';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';
import type { DashboardMetrics } from '@/lib/api/reports';

type Period = 'today' | '7d' | '30d' | 'custom';

const PERIOD_LABEL: Record<Period, string> = { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', custom: 'Custom' };

/** Missing value shows as an em dash, never as a fabricated zero. */
const num = (n: number | null | undefined): string => (typeof n === 'number' && Number.isFinite(n) ? String(n) : '—');

const CARD = 'bg-surface-default border border-border-default rounded-xl p-4 flex flex-col gap-3 min-h-[271px] shadow-xs';
const KPI = 'bg-surface-default border border-border-default rounded-xl p-5 flex flex-col justify-between h-[158px] shadow-xs';

export default function HomePage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const allowed = useCapability(ACTIONS.dashboardOwnerRead);
  // Only the Owner dashboard lives here. Everyone else lands on their own day.
  // Wait for /me first: before it loads nobody looks allowed, and a hard refresh would bounce the Owner.
  useEffect(() => {
    if (!authLoading && !allowed) router.replace('/my-day');
  }, [authLoading, allowed, router]);
  return <AppShell>{allowed ? <Dashboard /> : <PageRedirecting loading={authLoading} />}</AppShell>;
}

function PageRedirecting({ loading }: { loading: boolean }) {
  return (
    <div role="status" aria-live="polite" className="py-16 flex justify-center text-sm text-text-secondary">
      {loading ? 'Loading…' : 'Opening your day…'}
    </div>
  );
}

function Dashboard() {
  const time = useCompanyTime();
  const [period, setPeriod] = useState<Period>('7d');
  const [pickerOpen, setPickerOpen] = useState(false);
  const shift = (days: number) => time.dayKey(new Date(Date.now() - days * 86_400_000));
  const [customFrom, setCustomFrom] = useState(() => shift(6));
  const [customTo, setCustomTo] = useState(() => shift(0));
  const rangeValid = Boolean(customFrom) && Boolean(customTo) && customFrom <= customTo;

  const key = useMemo(() => {
    if (period === 'custom') return rangeValid ? `/api/dashboard?period=custom&from=${customFrom}&to=${customTo}` : null;
    return `/api/dashboard?period=${period}`;
  }, [period, customFrom, customTo, rangeValid]);

  const { data: m, error, route, isLoading, retry } = useApi<DashboardMetrics>(key, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  });

  const periodSubtitle = period === 'custom' ? `Period · ${customFrom} to ${customTo}` : `Period · ${PERIOD_LABEL[period]}`;
  const updated = m?.companyTime ? time.formatTime(m.companyTime) : null;

  const applyPreset = (from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    setPeriod('custom');
    setPickerOpen(false);
  };

  const periodBtn = (p: Exclude<Period, 'custom'>) => (
    <button
      key={p}
      type="button"
      aria-pressed={period === p}
      onClick={() => {
        setPeriod(p);
        setPickerOpen(false);
      }}
      className={`h-8 px-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${
        period === p ? 'bg-surface-default shadow-xs text-text-primary' : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      {p === 'today' ? 'Today' : p === '7d' ? '7 days' : '30 days'}
    </button>
  );

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto min-w-0">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col shrink-0">
          <h1 className="text-2xl font-semibold leading-8 text-text-primary tracking-tight">Dashboard</h1>
          <p className="text-xs text-text-muted leading-4">
            {updated ? `Updated ${updated} · company time` : 'Company time'}
            {!time.configured && ' · timezone not configured'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="bg-surface-sunken p-1 rounded-lg flex items-center gap-1 shrink-0" role="group" aria-label="Period">
            {periodBtn('today')}
            {periodBtn('7d')}
            {periodBtn('30d')}
            <button
              type="button"
              aria-pressed={period === 'custom'}
              aria-expanded={pickerOpen}
              onClick={() => {
                setPeriod('custom');
                setPickerOpen((v) => !v);
              }}
              className={`h-8 px-3 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                period === 'custom' ? 'bg-brand-primary text-text-on-primary font-semibold shadow-xs' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Custom</span>
              <Icon name="calendar" size={13} />
            </button>
          </div>

          {period === 'custom' && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                aria-expanded={pickerOpen}
                className="h-10 px-3 rounded-md border border-brand-primary bg-surface-default flex items-center gap-2.5 text-sm text-text-primary min-w-[190px] cursor-pointer shadow-xs"
              >
                <Icon name="calendar" size={15} className="text-brand-primary" />
                <span className="font-medium">{customFrom === customTo ? customFrom : `${customFrom} – ${customTo}`}</span>
              </button>
              {pickerOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 bg-surface-default border border-border-default rounded-xl shadow-lg p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <PresetButton onClick={() => applyPreset(shift(1), shift(1))}>Yesterday</PresetButton>
                    <PresetButton onClick={() => applyPreset(shift(6), shift(0))}>Last 7 days</PresetButton>
                    <PresetButton onClick={() => applyPreset(shift(13), shift(0))}>Last 14 days</PresetButton>
                    <PresetButton onClick={() => applyPreset(`${shift(0).slice(0, 8)}01`, shift(0))}>This month</PresetButton>
                  </div>
                  <div className="space-y-3 pt-2 border-t border-border-subtle">
                    <label className="block text-xs font-medium text-text-secondary">
                      From
                      <input
                        type="date"
                        value={customFrom}
                        max={customTo || undefined}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="mt-1 w-full h-9 px-2.5 rounded-md border border-border-input bg-surface-default text-sm text-text-primary focus:outline-hidden focus:border-brand-accent"
                      />
                    </label>
                    <label className="block text-xs font-medium text-text-secondary">
                      To
                      <input
                        type="date"
                        value={customTo}
                        min={customFrom || undefined}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="mt-1 w-full h-9 px-2.5 rounded-md border border-border-input bg-surface-default text-sm text-text-primary focus:outline-hidden focus:border-brand-accent"
                      />
                    </label>
                    {!rangeValid && <p className="text-xs text-status-danger-fg">Choose a start date on or before the end date.</p>}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPeriod('7d');
                        setPickerOpen(false);
                      }}
                      className="text-xs text-text-muted hover:text-text-primary px-2 py-1 cursor-pointer"
                    >
                      Reset to 7 days
                    </button>
                    <button
                      type="button"
                      disabled={!rangeValid}
                      onClick={() => setPickerOpen(false)}
                      className="text-xs px-3 py-1.5 rounded-md bg-brand-primary text-text-on-primary font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <Link
            href="/reports"
            className="h-10 px-4 rounded-md border border-border-strong bg-surface-default text-sm font-medium text-text-primary flex items-center gap-2 hover:bg-surface-hover transition-colors shrink-0"
          >
            <Icon name="download" size={18} className="text-text-muted" />
            <span>Export</span>
          </Link>
        </div>
      </div>

      {error && !m ? (
        <ApiErrorView route={route} error={error} onRetry={() => void retry()} area="Dashboard" what="the dashboard" />
      ) : isLoading && !m ? (
        <DashboardSkeleton />
      ) : !m ? (
        <p className="text-sm text-text-muted">Choose a valid date range to see the dashboard.</p>
      ) : (
        <>
          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-status-warning-border bg-status-warning-bg px-4 py-2 text-sm text-status-warning-fg">
              <span>Could not refresh. Showing the last loaded figures.</span>
              <button type="button" onClick={() => void retry()} className="font-medium underline cursor-pointer">
                Retry
              </button>
            </div>
          )}
          <DashboardBody m={m} periodSubtitle={periodSubtitle} />
        </>
      )}
    </div>
  );
}

function PresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1.5 rounded-md bg-surface-sunken hover:bg-surface-hover text-text-secondary hover:text-text-primary text-left font-medium transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[158px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[271px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function CardHead({ title, href, link }: { title: React.ReactNode; href: string; link: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-text-primary leading-6">{title}</h2>
      <Link href={href} className="text-xs font-medium text-text-link hover:underline shrink-0">
        {link}
      </Link>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <div className="bg-surface-sunken p-2.5 rounded-lg text-center">
      <div className={`text-xl font-semibold leading-7 tracking-tight ${tone === 'warning' ? 'text-status-warning-fg' : 'text-text-primary'}`}>{value}</div>
      <div className="text-[11px] text-text-secondary leading-4 mt-0.5">{label}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function ExceptionRow({ icon, tone, title, detail, href, action }: { icon: 'clock' | 'alert-triangle' | 'bell'; tone: string; title: string; detail: string; href: string; action: string }) {
  return (
    <div className="flex items-center gap-2 justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <Icon name={icon} size={16} className={`${tone} shrink-0`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary leading-5 truncate">{title}</p>
          <p className="text-xs text-text-muted leading-4 truncate">{detail}</p>
        </div>
      </div>
      <Link
        href={href}
        className="h-8 px-3 rounded-md border border-border-strong bg-surface-default text-xs font-medium text-text-primary hover:bg-surface-hover flex items-center justify-center shrink-0"
      >
        {action}
      </Link>
    </div>
  );
}

function TargetBar({ label, p }: { label: string; p?: { current: number; target: number; percentage: number } }) {
  const hasTarget = Boolean(p && p.target > 0);
  const pct = hasTarget && p ? Math.max(0, Math.min(100, p.percentage)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="font-medium text-text-primary">{hasTarget && p ? `${p.current} / ${p.target}` : 'No target set'}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hasTarget ? Math.round(pct) : undefined}
        className="h-2 w-full bg-surface-sunken rounded-full overflow-hidden"
      >
        <div className="h-full bg-brand-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DashboardBody({ m, periodSubtitle }: { m: DashboardMetrics; periodSubtitle: string }) {
  const exceptions =
    m.deliveryMonitor.failedDeliveriesCount + m.deliveryMonitor.suppressedDeliveriesCount + m.deliveryMonitor.failedRemindersCount + m.attendance.missingCheckouts;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className={KPI}>
          <span className="text-[13px] text-text-secondary leading-[18px]">Call attempts</span>
          <span className="text-[28px] font-semibold text-text-primary leading-9 tracking-tight">{num(m.calling.callAttemptsInPeriod)}</span>
          <span className="text-xs text-text-secondary">Calls logged in period</span>
          <span className="text-xs text-text-muted leading-4">{periodSubtitle}</span>
        </div>
        <div className={KPI}>
          <span className="text-[13px] text-text-secondary leading-[18px]">Businesses contacted</span>
          <span className="text-[28px] font-semibold text-text-primary leading-9 tracking-tight">{num(m.calling.businessesContactedInPeriod)}</span>
          <span className="text-xs text-text-secondary">Distinct businesses reached</span>
          <span className="text-xs text-text-muted leading-4">{periodSubtitle}</span>
        </div>
        <div className={KPI}>
          <span className="text-[13px] text-text-secondary leading-[18px]">Accepted opportunities</span>
          <span className="text-[28px] font-semibold text-text-primary leading-9 tracking-tight">{num(m.commercial.acceptedOpportunities)}</span>
          <span className="text-xs text-text-secondary">{num(m.commercial.acceptedInPeriod)} accepted in period</span>
          <span className="text-xs text-text-muted leading-4">Snapshot · current stage</span>
        </div>
        <div className={KPI}>
          <span className="text-[13px] text-text-secondary leading-[18px]">Closed deals in period</span>
          <span className="text-[28px] font-semibold text-text-primary leading-9 tracking-tight">{num(m.commercial.closedInPeriod)}</span>
          <span className="text-xs text-text-secondary">Closed vs completed: {num(m.commercial.closedVsCompletedRatio)}</span>
          <span className="text-xs text-text-muted leading-4">{periodSubtitle}</span>
        </div>
        <div className={KPI}>
          <span className="text-[13px] text-text-secondary leading-[18px]">Development workload</span>
          <span className="text-[28px] font-semibold text-text-primary leading-9 tracking-tight">
            {num(m.commercial.closedDeals)} · {num(m.delivery.activeProjects)} · {num(m.delivery.openTasks)}
          </span>
          <span className="text-xs text-text-secondary">Deals · Projects · Tasks</span>
          <span className="text-xs text-text-muted leading-4">Active engineering queue</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className={CARD} aria-label="Attendance today">
          <CardHead title="Attendance today" href="/attendance/monitor" link="Open attendance" />
          <div className="flex flex-wrap gap-1.5">
            <PolicyPendingChip dec="DEC-007" />
            <PolicyPendingChip dec="DEC-008" />
            <PolicyPendingChip dec="DEC-022" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Checked in" value={num(m.attendance.checkedInToday)} />
            <Stat label="Not checked in" value={num(m.attendance.absentOrMissingCheckin)} />
            <Stat label="Missing checkout" value={num(m.attendance.missingCheckouts)} tone="warning" />
          </div>
          <div className="h-px bg-border-default w-full" />
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Checkouts recorded today</span>
            <span className="font-medium text-text-primary">{num(m.attendance.checkedOutToday)}</span>
          </div>
        </section>

        <section className={CARD} aria-label="Calling activity">
          <CardHead title={`Calling activity · ${m.period === 'custom' ? 'Custom' : PERIOD_LABEL[m.period]}`} href="/reports" link="Open report" />
          <div className="grid grid-cols-2 gap-3 my-auto">
            <Stat label="Call attempts" value={num(m.calling.callAttemptsInPeriod)} />
            <Stat label="Businesses contacted" value={num(m.calling.businessesContactedInPeriod)} />
          </div>
          <p className="text-xs text-text-muted leading-4">
            Totals for the selected period. A per-day breakdown is not available yet.
          </p>
        </section>

        <section className={CARD} aria-label="Exceptions">
          <CardHead title={`Exceptions · ${num(exceptions)}`} href="/delivery-monitor" link="Delivery monitor" />
          <div className="flex flex-wrap gap-1.5">
            <PolicyPendingChip dec="AR-13" />
            <PolicyPendingChip dec="DEC-026" />
          </div>
          <div className="space-y-2.5 my-auto">
            <ExceptionRow icon="clock" tone="text-status-warning-fg" title="Missing checkouts" detail={`${num(m.attendance.missingCheckouts)} employees flagged`} href="/attendance/monitor" action="Review" />
            <ExceptionRow icon="alert-triangle" tone="text-status-danger-fg" title="Failed deliveries" detail={`${num(m.deliveryMonitor.failedDeliveriesCount)} need attention`} href="/delivery-monitor" action="Monitor" />
            <ExceptionRow icon="bell" tone="text-status-warning-fg" title="Failed reminders" detail={`${num(m.deliveryMonitor.failedRemindersCount)} notification failures`} href="/delivery-monitor" action="View" />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className={CARD} aria-label="Businesses by status">
          <CardHead title="Businesses · status" href="/businesses" link="Open list" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 my-auto">
            <Fact label="Total businesses" value={num(m.businesses.total)} />
            <Fact label="Added in period" value={num(m.businesses.addedInPeriod)} />
            <Fact label="Unassigned" value={num(m.businesses.unassigned)} />
            <Fact label="Pending" value={num(m.businesses.pending)} />
            <Fact label="On hold" value={num(m.businesses.onHold)} />
            <Fact label="Callback requests" value={num(m.businesses.callbackRequests)} />
            <Fact label="Rejected" value={num(m.businesses.rejected)} />
            <Fact label="Needing corrections" value={num(m.businesses.needingCorrections)} />
          </div>
        </section>

        <section className={CARD} aria-label="Pipeline">
          <CardHead title="Pipeline" href="/deals" link="Deals & meetings" />
          <div className="flex flex-wrap gap-1.5">
            <PolicyPendingChip dec="DEC-018" />
            <PolicyPendingChip dec="DEC-019" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 my-auto">
            <Fact label="Accepted (now)" value={num(m.commercial.acceptedOpportunities)} />
            <Fact label="Accepted in period" value={num(m.commercial.acceptedInPeriod)} />
            <Fact label="Closed deals (total)" value={num(m.commercial.closedDeals)} />
            <Fact label="Closed in period" value={num(m.commercial.closedInPeriod)} />
            <Fact label="Delivered" value={num(m.delivery.deliveredCount)} />
            <Fact label="Completed" value={num(m.delivery.completedCount)} />
          </div>
        </section>

        <section className={CARD} aria-label="Targets and milestones">
          <CardHead title="Targets & milestones" href="/targets" link="Targets & work lists" />
          <div className="flex flex-wrap gap-1.5">
            <PolicyPendingChip dec="DEC-020" />
            <PolicyPendingChip dec="DEC-025" />
          </div>
          <div className="space-y-3.5 my-auto">
            <TargetBar label="Outreach calls completed" p={m.targets?.outreachProgress} />
            <TargetBar label="Businesses contacted" p={m.targets?.contactedBusinessesProgress} />
            <TargetBar label="Deals closed" p={m.targets?.closedDealsProgress} />
          </div>
        </section>
      </div>
    </>
  );
}
