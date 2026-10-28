import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool, query } from './pool.js';
import { assertSeedAllowed, seedDatabase } from './seed.js';
import '../app.js'; // registers modules (outbox writer, access engine)
import { runSystemCommand } from '../shared/tx.js';
import { createAcceptedOpportunity } from '../modules/deals/service.js';

/**
 * QA E2E fixture set (fictional data only). Runs ONLY when NODE_ENV is test or development (assertSeedAllowed).
 * Idempotent: rows are keyed by name/code and skipped when present.
 * Usage (shell env only): NODE_ENV=test TEST_DATABASE_URL=... npx tsx src/db/e2e-seed.ts
 */
async function one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const { rows } = await query<T & object>(sql, params);
  return rows[0] as T | undefined;
}

async function emp(email: string): Promise<string> {
  const r = await one<{ id: string }>('SELECT id FROM employees WHERE email = $1', [email]);
  if (!r) throw new Error(`employee ${email} missing`);
  return r.id;
}

async function business(name: string, createdBy: string, phone: string | null, ageDays = 0): Promise<string> {
  const existing = await one<{ id: string }>('SELECT id FROM businesses WHERE name = $1', [name]);
  if (existing) return existing.id;
  const norm = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const b = await one<{ id: string }>(
    `INSERT INTO businesses (name, normalized_name, name_key, created_by, created_at)
     VALUES ($1, $2, $2, $3, now() - ($4 || ' days')::interval) RETURNING id`,
    [name, norm, createdBy, String(ageDays)]
  );
  if (phone) {
    await query(
      `INSERT INTO business_phones (business_id, country_code, number, normalized_phone) VALUES ($1, '+961', $2, $3)`,
      [b!.id, phone, '+961' + phone.replace(/\D/g, '')]
    );
  }
  return b!.id;
}

async function assign(businessId: string, assignee: string, by: string) {
  const ex = await one('SELECT 1 FROM calling_assignments WHERE business_id = $1 AND ended_at IS NULL', [businessId]);
  if (!ex) await query('INSERT INTO calling_assignments (business_id, assignee_id, assigned_by) VALUES ($1,$2,$3)', [businessId, assignee, by]);
}

export async function seedE2e() {
  assertSeedAllowed(process.env.NODE_ENV);
  await seedDatabase();
  const owner = await emp('udigity@gmail.com');
  const de = await emp('karim.saleh@udigity.demo');
  const maya = await emp('maya.khoury@udigity.demo');
  const omar = await emp('omar.nassar@udigity.demo');
  const lina = await emp('lina.aoun@udigity.demo');

  const cafe = await business('Olive & Thyme Cafe', de, '70100001', 1);
  const dental = await business('Nova Dental Clinic', de, '70100002', 2);
  const yoga = await business('Lumen Yoga Studio', de, '70100003', 0);
  const cuts = await business('Urban Cuts Barbershop', de, '70100004', 0);
  const harbor = await business('Harbor Auto Care', de, '70100005', 20);
  const glow = await business('Glow Beauty Salon', de, '70100006', 30);
  const deal2 = await business('Cedar Print House', de, '70100007', 10);
  for (const b of [cafe, yoga, cuts]) await assign(b, maya, owner);
  await assign(dental, omar, owner);
  await assign(deal2, maya, owner);

  // Open deal assigned to Lina (accepted opportunity) for the Developer journey.
  if (!(await one('SELECT 1 FROM deals WHERE business_id = $1', [dental]))) {
    const a = await one<{ id: string }>(
      `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key) VALUES ($1,$2,'accepted',$3) RETURNING id`,
      [dental, omar, crypto.randomUUID()]
    );
    await runSystemCommand('e2e.seed.accept', (ctx) =>
      createAcceptedOpportunity(ctx, {
        businessId: dental,
        callAttemptId: a!.id,
        acceptingAgentId: omar,
        clientNeedsNote: 'Online booking page and reminders for patients',
        developerId: lina,
      })
    );
  }

  // Closed deal + project PRJ with 3 open tasks (Glow Beauty Salon), developer Lina.
  if (!(await one('SELECT 1 FROM deals WHERE business_id = $1', [glow]))) {
    await assign(glow, maya, owner);
    const a = await one<{ id: string }>(
      `INSERT INTO call_attempts (business_id, agent_id, outcome, idempotency_key) VALUES ($1,$2,'accepted',$3) RETURNING id`,
      [glow, maya, crypto.randomUUID()]
    );
    const r = await runSystemCommand('e2e.seed.accept', (ctx) =>
      createAcceptedOpportunity(ctx, {
        businessId: glow, callAttemptId: a!.id, acceptingAgentId: maya,
        clientNeedsNote: 'Booking and payment website', developerId: lina,
      })
    );
    await query(
      `UPDATE deals SET stage='closed', signature_date=current_date-5, signature_reference='AGR-E2E', signature_recorded_by_id=$2, signature_recorded_at=now(),
         payment_date=current_date-4, payment_reference='PAY-E2E', payment_recorded_by_id=$2, payment_recorded_at=now(),
         closed_at=now(), closed_by_id=$2, closure_mode='direct' WHERE id=$1`,
      [r.dealId, lina]
    );
    const p = await one<{ id: string }>(
      `INSERT INTO projects (deal_id, business_id, name, status, start_date, target_date, provisioned_by_id)
       VALUES ($1,$2,'Glow Beauty Salon website','in_progress', current_date-3, current_date+30, $3) RETURNING id`,
      [r.dealId, glow, owner]
    );
    await query('INSERT INTO project_developer_assignments (project_id, developer_id, assigned_by_id) VALUES ($1,$2,$3)', [p!.id, lina, owner]);
    for (const [i, t] of ['Content upload', 'Payment page', 'Booking flow'].entries()) {
      await query(`INSERT INTO tasks (project_id, title, status, owner_id, sort_order, created_by_id) VALUES ($1,$2,'todo',$3,$4,$3)`, [p!.id, t, lina, i]);
    }
  }
  // Kick-off meeting that already started today (outcome due) on the closed Glow deal (Developers only see closed deals).
  const novaDeal = await one<{ id: string }>('SELECT id FROM deals WHERE business_id = $1', [glow]);
  if (novaDeal && !(await one('SELECT 1 FROM meetings WHERE deal_id = $1', [novaDeal.id]))) {
    const m = await one<{ id: string }>(
      `INSERT INTO meetings (deal_id, business_id, title, starts_at, ends_at, location, created_by_id)
       VALUES ($1,$2,'Glow Beauty Salon kick-off', now() - interval '2 hours', now() - interval '1 hour', 'Video call', $3) RETURNING id`,
      [novaDeal.id, glow, lina]
    );
    await query('INSERT INTO meeting_attendees (meeting_id, employee_id) VALUES ($1,$2)', [m!.id, lina]);
  }
  void harbor; void yoga; void cuts;

  // Attendance: yesterday's closed session for Maya (history on the monitor).
  if (!(await one(`SELECT 1 FROM attendance_sessions WHERE employee_id = $1`, [maya]))) {
    await query(
      `INSERT INTO attendance_sessions (employee_id, state, origin, work_date, check_in_at, check_out_at, effective_check_in_at, effective_check_out_at)
       VALUES ($1,'closed','check_in', current_date-1, (current_date-1) + time '09:02', (current_date-1) + time '17:45', (current_date-1) + time '09:02', (current_date-1) + time '17:45')`,
      [maya]
    );
  }
  console.log('e2e seed completed (fictional data; 6 employees, 7 businesses, 2 deals, 1 project with 3 open tasks, 1 attendance session)');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedE2e()
    .then(async () => { await pool.end(); process.exit(0); })
    .catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
}
