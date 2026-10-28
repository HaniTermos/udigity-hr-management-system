/**
 * MOD-reports — repository. Owner: BE5.
 * Reads metrics across views/tables and records exports into export_records.
 */
import type { Queryable } from '../../db/pool.js';
import { HttpError } from '../../shared/errors.js';

export async function insertExportRecord(
  db: Queryable,
  r: {
    requestedBy: string;
    reportType: string;
    format: string;
    rowCount: number;
    filters?: Record<string, unknown>;
  }
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO export_records (requested_by, report_type, format, row_count, filters)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [r.requestedBy, r.reportType, r.format, r.rowCount, JSON.stringify(r.filters ?? {})]
  );
  return rows[0].id;
}

export async function queryDashboardStats(
  db: Queryable,
  since: Date,
  until?: Date
): Promise<{
  totalBusinesses: number;
  addedInPeriod: number;
  callingStates: Record<string, number>;
  unassignedBusinesses: number;
  needingCorrections: number;
  acceptedOpportunities: number;
  acceptedInPeriod: number;
  closedDeals: number;
  closedInPeriod: number;
  deliveredProjects: number;
  completedProjects: number;
  activeProjects: number;
  openTasks: number;
  callAttemptsInPeriod: number;
  businessesContactedInPeriod: number;
  checkedInToday: number;
  checkedOutToday: number;
  missingCheckouts: number;
  failedDeliveries: number;
  suppressedDeliveries: number;
  failedReminders: number;
}> {
  const endDate = until ?? new Date('9999-12-31T23:59:59Z');

  // 1. Businesses counts
  const bizRes = await db.query<{ total: string; in_period: string }>(
    `SELECT count(*)::text AS total,
            count(*) FILTER (WHERE created_at >= $1 AND created_at <= $2)::text AS in_period
       FROM businesses
      WHERE archived_at IS NULL`,
    [since, endDate]
  );

  // 2. Calling states
  const callStatesRes = await db.query<{ outcome: string; count: string }>(
    `SELECT outcome, count(*)::text AS count
       FROM business_calling_states
      GROUP BY outcome`
  );
  const callingStates: Record<string, number> = {};
  for (const row of callStatesRes.rows) {
    callingStates[row.outcome] = Number(row.count);
  }

  // 3. Unassigned businesses
  const unassignedRes = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM businesses b
      WHERE b.archived_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM calling_assignments a
           WHERE a.business_id = b.id AND a.ended_at IS NULL
        )`
  );

  // 4. Corrections needing attention
  const corrRes = await db.query<{ count: string }>(
    `SELECT count(DISTINCT business_id)::text AS count
       FROM data_correction_requests
      WHERE status IN ('submitted', 'in_review')`
  );

  // 5. Deals
  const dealsRes = await db.query<{
    accepted_ops: string;
    accepted_in_period: string;
    closed_deals: string;
    closed_in_period: string;
  }>(
    `SELECT count(*) FILTER (WHERE stage = 'accepted_opportunity')::text AS accepted_ops,
            count(*) FILTER (WHERE stage = 'accepted_opportunity' AND created_at >= $1 AND created_at <= $2)::text AS accepted_in_period,
            count(*) FILTER (WHERE stage = 'closed')::text AS closed_deals,
            count(*) FILTER (WHERE stage = 'closed' AND updated_at >= $1 AND updated_at <= $2)::text AS closed_in_period
       FROM deals`,
    [since, endDate]
  );

  // 6. Projects & tasks
  const projRes = await db.query<{
    delivered: string;
    completed: string;
    active: string;
  }>(
    `SELECT count(*) FILTER (WHERE status = 'delivered')::text AS delivered,
            count(*) FILTER (WHERE status = 'completed')::text AS completed,
            count(*) FILTER (WHERE status IN ('scheduled', 'in_progress', 'waiting_for_client', 'blocked'))::text AS active
       FROM projects`
  );

  const taskRes = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM tasks WHERE status IN ('todo', 'in_progress')`
  );

  // 7. Calling activity in period
  const callsRes = await db.query<{ attempts: string; distinct_businesses: string }>(
    `SELECT count(*)::text AS attempts,
            count(DISTINCT business_id)::text AS distinct_businesses
       FROM call_attempts
      WHERE created_at >= $1 AND created_at <= $2`,
    [since, endDate]
  );

  // 8. Attendance snapshot (today)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const attRes = await db.query<{ checked_in: string; checked_out: string; missing_checkout: string }>(
    `SELECT count(*) FILTER (WHERE check_in_at >= $1)::text AS checked_in,
            count(*) FILTER (WHERE check_out_at >= $1)::text AS checked_out,
            count(*) FILTER (WHERE check_out_at IS NULL AND check_in_at < CURRENT_TIMESTAMP - interval '12 hours')::text AS missing_checkout
       FROM attendance_sessions`,
    [todayStart]
  );

  // 9. Delivery monitor failures
  const notifFailRes = await db.query<{ failed: string; suppressed: string }>(
    `SELECT count(*) FILTER (WHERE state = 'failed')::text AS failed,
            count(*) FILTER (WHERE state = 'suppressed')::text AS suppressed
       FROM notification_deliveries`
  );

  const remFailRes = await db.query<{ failed: string }>(
    `SELECT count(*)::text AS failed FROM reminders WHERE state = 'failed'`
  );

  return {
    totalBusinesses: Number(bizRes.rows[0]?.total ?? 0),
    addedInPeriod: Number(bizRes.rows[0]?.in_period ?? 0),
    callingStates,
    unassignedBusinesses: Number(unassignedRes.rows[0]?.count ?? 0),
    needingCorrections: Number(corrRes.rows[0]?.count ?? 0),
    acceptedOpportunities: Number(dealsRes.rows[0]?.accepted_ops ?? 0),
    acceptedInPeriod: Number(dealsRes.rows[0]?.accepted_in_period ?? 0),
    closedDeals: Number(dealsRes.rows[0]?.closed_deals ?? 0),
    closedInPeriod: Number(dealsRes.rows[0]?.closed_in_period ?? 0),
    deliveredProjects: Number(projRes.rows[0]?.delivered ?? 0),
    completedProjects: Number(projRes.rows[0]?.completed ?? 0),
    activeProjects: Number(projRes.rows[0]?.active ?? 0),
    openTasks: Number(taskRes.rows[0]?.count ?? 0),
    callAttemptsInPeriod: Number(callsRes.rows[0]?.attempts ?? 0),
    businessesContactedInPeriod: Number(callsRes.rows[0]?.distinct_businesses ?? 0),
    checkedInToday: Number(attRes.rows[0]?.checked_in ?? 0),
    checkedOutToday: Number(attRes.rows[0]?.checked_out ?? 0),
    missingCheckouts: Number(attRes.rows[0]?.missing_checkout ?? 0),
    failedDeliveries: Number(notifFailRes.rows[0]?.failed ?? 0),
    suppressedDeliveries: Number(notifFailRes.rows[0]?.suppressed ?? 0),
    failedReminders: Number(remFailRes.rows[0]?.failed ?? 0),
  };
}

export async function queryDeveloperWorkload(
  db: Queryable
): Promise<Array<{
  developerId: string;
  developerName: string;
  activeDealsCount: number;
  activeProjectsCount: number;
  openTasksCount: number;
}>> {
  const { rows } = await db.query<{
    developer_id: string;
    developer_name: string;
    active_deals: string;
    active_projects: string;
    open_tasks: string;
  }>(
    `SELECT e.id AS developer_id,
            e.full_name AS developer_name,
            (SELECT count(*)::text FROM deals d
              WHERE d.assigned_developer_id = e.id AND d.stage NOT IN ('closed', 'not_proceeding')) AS active_deals,
            (SELECT count(*)::text FROM project_developer_assignments pda
               JOIN projects p ON p.id = pda.project_id
              WHERE pda.developer_id = e.id AND pda.unassigned_at IS NULL AND p.status IN ('scheduled', 'in_progress', 'waiting_for_client', 'blocked')) AS active_projects,
            (SELECT count(*)::text FROM tasks t
              WHERE t.owner_id = e.id AND t.status IN ('todo', 'in_progress')) AS open_tasks
       FROM employees e
      WHERE e.role = 'developer' AND e.is_active = true
      ORDER BY e.full_name`
  );

  return rows.map((r) => ({
    developerId: r.developer_id,
    developerName: r.developer_name,
    activeDealsCount: Number(r.active_deals),
    activeProjectsCount: Number(r.active_projects),
    openTasksCount: Number(r.open_tasks),
  }));
}

export async function queryExportRows(
  db: Queryable,
  reportType: string,
  filters: Record<string, unknown> = {},
  /** R2-02 row cap: callers pass cap + 1 to detect truncation. */
  limit = 1000
): Promise<Record<string, unknown>[]> {
  const max = Math.max(1, Math.min(Math.trunc(limit), 100_000));
  // A-18 / R2-05 residual: the requested date range is applied (inclusive days), not only recorded.
  const from = typeof filters.from === 'string' ? filters.from : null;
  const to = typeof filters.to === 'string' ? filters.to : null;
  const range = (col: string) => `($2::date IS NULL OR ${col} >= $2::date) AND ($3::date IS NULL OR ${col} < $3::date + 1)`;
  switch (reportType) {
    case 'rep-1':
    case 'timesheet': {
      const { rows } = await db.query(
        `SELECT s.id, e.full_name AS employee_name,
                s.check_in_at, s.check_out_at, s.state,
                -- BE-LEAD: no duration column; derived from the effective times (corrections included).
                ROUND(EXTRACT(EPOCH FROM (s.effective_check_out_at - s.effective_check_in_at)) / 60)::int AS duration_minutes
           FROM attendance_sessions s
           JOIN employees e ON e.id = s.employee_id
          WHERE ${range('s.check_in_at')}
          ORDER BY s.check_in_at DESC
          LIMIT $1`,
        [max, from, to]
      );
      return rows;
    }
    case 'rep-2':
    case 'calling': {
      const { rows } = await db.query(
        `SELECT ca.id, b.name AS business_name, ca.outcome,
                e.full_name AS agent_name, ca.attempted_at
           FROM call_attempts ca
           JOIN businesses b ON b.id = ca.business_id
           JOIN employees e ON e.id = ca.agent_id
          WHERE ${range('ca.attempted_at')}
          ORDER BY ca.attempted_at DESC
          LIMIT $1`,
        [max, from, to]
      );
      return rows;
    }
    case 'rep-3':
    case 'deals': {
      const { rows } = await db.query(
        `SELECT d.id, b.name AS business_name, d.stage, d.signature_date, d.payment_date,
                d.payment_amount, d.payment_currency, p.status AS project_status, d.created_at, d.updated_at
           FROM deals d
           JOIN businesses b ON b.id = d.business_id
           LEFT JOIN projects p ON p.deal_id = d.id
          WHERE ${range('d.created_at')}
          ORDER BY d.created_at DESC
          LIMIT $1`,
        [max, from, to]
      );
      return rows;
    }
    case 'rep-4':
    case 'businesses': {
      const { rows } = await db.query(
        `SELECT b.id, b.name, b.branch, c.name AS category, b.created_at
           FROM businesses b
           JOIN categories c ON c.id = b.category_id
          WHERE b.archived_at IS NULL AND ${range('b.created_at')}
          ORDER BY b.created_at DESC
          LIMIT $1`,
        [max, from, to]
      );
      return rows;
    }
    default: {
      throw new HttpError(400, 'BAD_REQUEST', `Unknown report type: ${reportType}`);
    }
  }
}
