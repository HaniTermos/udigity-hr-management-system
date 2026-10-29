/**
 * Demo data for showing the system on a LOCAL stack (fictional businesses, people and numbers only).
 * Runs ONLY when NODE_ENV is development or test (assertSeedAllowed, same guard as seed.ts).
 *
 * Prerequisites: migrations applied and `seed.ts` run (it owns the six employees and their logins; this
 * script creates no employee, credential, password or token). Usage:
 *   npm run seed:demo                              (local, NODE_ENV from backend/.env)
 *   docker exec udigity-backend node dist/db/seed-demo.js   (dev container, NODE_ENV=development)
 *
 * What it writes, in ONE transaction, into the real tables (so every row is editable from the app):
 *   ~30 businesses with categories, phones and social accounts (Lebanese areas; phones in the fictional
 *   `+961 0X 555 XXX` block), calling assignments, ~45 days of call attempts with reservations, follow-ups
 *   and outcomes, deals in every stage (incl. closed and not proceeding), projects with tasks, meetings,
 *   data-correction requests, attendance (no breaks: v1 scope) for the last ~32 working days, targets for the
 *   current periods and a few work items. Derived rows are written like the services write them:
 *   business edit history, calling state, deal/project/meeting/follow-up change rows and audit events
 *   (audit `source_workflow = 'seed-demo'`, so seeded history is identifiable).
 *
 * Times: company time Asia/Beirut, working days MON–FRI, stored as timestamptz (UTC). Every timestamp is
 * in the past except open follow-ups and scheduled meetings. Outbox events are emitted only for items
 * that are live now (future follow-ups/meetings, open review items, today's assignments), so the worker
 * plans reminders and in-app notifications the normal way; nothing historic is re-notified.
 *
 * Idempotent: when the marker business ("Cedar Crust Bakery", Hamra) exists, the script does nothing.
 */
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type pg from 'pg';
import { pool, getClient } from './pool.js';
import { SeedRefusedError, assertSeedAllowed } from './seed.js';
import { nameKey, normalizeBranch, normalizeHandle, normalizeName, normalizePhone } from '../modules/duplicates/service.js';
import { addDays, localParts, weekdayOf, workDateOf, zonedToUtc } from '../modules/attendance/time.js';
import { parseSettingValue } from '../modules/admin/service.js';
import { readCompanySettings, writeCompanySettings } from '../modules/admin/repo.js';
import { insertOutboxEvent } from '../modules/platform/repo.js';
import type { OutboxEventName } from '../shared/outbox.js';

const TZ = 'Asia/Beirut';
const WORKING_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const COUNTRY_CODE = '+961';
const CURRENCY = 'USD';
const AUDIT_SOURCE = 'seed-demo';
/** Office LAN address recorded on seeded check-ins (inside the office range below). */
const OFFICE_IP = '192.168.10.24';
/** Used only when no attendance settings version exists yet: loopback + private ranges = the local Docker network. */
const DEMO_OFFICE_IPS = ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
const MARKER = { name: 'Cedar Crust Bakery', branch: 'Hamra' };

type Db = pg.PoolClient;
type Role = 'owner' | 'data_entry' | 'call_center' | 'developer';
interface Person {
  id: string;
  role: Role;
}
type PersonKey = 'owner' | 'karim' | 'maya' | 'omar' | 'lina' | 'sami';

const PEOPLE_EMAILS: Record<PersonKey, string> = {
  owner: 'udigity@gmail.com',
  karim: 'karim.saleh@udigity.demo',
  maya: 'maya.khoury@udigity.demo',
  omar: 'omar.nassar@udigity.demo',
  lina: 'lina.aoun@udigity.demo',
  sami: 'sami.fares@udigity.demo',
};

// ---------------------------------------------------------------------------------------------
// Deterministic randomness and company-time helpers
// ---------------------------------------------------------------------------------------------

/** mulberry32: the same sequence on every run, so two runs on the same day produce the same data. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
    chance: (p: number) => next() < p,
  };
}
type Rng = ReturnType<typeof makeRng>;

const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const MIN = 60_000;

/** Company-local wall time on `date` (minute of day + seconds) as a UTC instant. */
function at(date: string, minute: number, seconds = 0): Date {
  return new Date(zonedToUtc(date, hhmm(minute), TZ).getTime() + seconds * 1000);
}

function localMinute(instant: Date): number {
  const [h, m] = localParts(instant, TZ).time.split(':').map(Number);
  return h * 60 + m;
}

const isWorkingDay = (date: string) => WORKING_DAYS.includes(weekdayOf(date));

/**
 * Working-day calendar relative to now. `day(k)`: k working days ago; `day(0)` is today only when today is a
 * working day and it is already past 13:30 (so morning events are in the past), otherwise the last working day.
 */
class Calendar {
  readonly now: Date;
  readonly today: string;
  readonly nowMinute: number;
  readonly todayWorking: boolean;
  readonly todayUsable: boolean;
  private readonly past: string[] = [];
  private readonly ahead: string[] = [];

  constructor(now: Date) {
    this.now = now;
    this.today = workDateOf(now, TZ);
    this.nowMinute = localMinute(now);
    this.todayWorking = isWorkingDay(this.today);
    this.todayUsable = this.todayWorking && this.nowMinute >= 13 * 60 + 30;
    for (let d = this.today; this.past.length < 45; ) {
      d = addDays(d, -1);
      if (isWorkingDay(d)) this.past.push(d);
    }
    for (let d = this.today; this.ahead.length < 10; ) {
      d = addDays(d, 1);
      if (isWorkingDay(d)) this.ahead.push(d);
    }
  }

  day(k: number): string {
    if (this.todayUsable) return k === 0 ? this.today : this.past[k - 1];
    return this.past[k];
  }

  future(k: number): string {
    return this.ahead[k - 1];
  }

  /** Past working days strictly before today, newest first. */
  pastDays(count: number): string[] {
    return this.past.slice(0, count);
  }
}

// ---------------------------------------------------------------------------------------------
// Demo catalogue (fictional). `created`/`end` are working days ago (Calendar.day).
// ---------------------------------------------------------------------------------------------

const CATEGORIES = [
  'Restaurants & Cafés',
  'Beauty & Wellness',
  'Retail & Fashion',
  'Medical & Dental',
  'Hospitality & Tourism',
  'Education & Training',
  'Automotive',
  'Real Estate',
  'Food & Produce',
  'Fitness & Sports',
] as const;
type Category = (typeof CATEGORIES)[number] | 'Other';

type Story =
  | 'closed_completed'
  | 'closed_in_progress'
  | 'closed_waiting'
  | 'signed_paid_review'
  | 'signed'
  | 'paid'
  | 'accepted_dev'
  | 'accepted_open'
  | 'not_proceeding'
  | 'rejected'
  | 'on_hold'
  | 'on_hold_overdue'
  | 'nac_followup'
  | 'nac_marker'
  | 'fresh'
  | 'unassigned'
  | 'no_phone';

interface DealPlan {
  developer?: 'lina' | 'sami';
  needs: string;
  interest: string;
  amount?: number;
  signatureAgo?: number;
  paymentAgo?: number;
  reviewAgo?: number;
  closeAgo?: number;
  notProceedingAgo?: number;
  notProceedingReason?: string;
}

interface BizDef {
  name: string;
  branch: string | null;
  area: string;
  category: Category;
  phones: string[];
  social?: [platform: string, handle: string, followers: number | null][];
  website?: string;
  notes?: string;
  created: number;
  createdBy?: 'karim' | 'owner';
  agent: 'maya' | 'omar' | null;
  story: Story;
  /** Day of the last attempt (accepted stories: the day the call was accepted). */
  end?: number;
  /** Leading "no answer" attempts before the story's own steps. */
  noAnswer?: number;
  rejection?: string;
  deal?: DealPlan;
}

const BUSINESSES: BizDef[] = [
  // ----- Maya: Beirut, Metn, South, Aley -----
  {
    name: 'Cedar Crust Bakery', branch: 'Hamra', area: 'Beirut', category: 'Restaurants & Cafés', phones: ['01 555 101'],
    social: [['instagram', 'cedarcrustbakery', 4200], ['facebook', 'cedarcrust.hamra', 2600]], website: 'https://cedarcrust.example',
    notes: 'Family bakery, manoushe and pastries. Best time to call: after 11:00.',
    created: 32, agent: 'maya', story: 'closed_completed', end: 24, noAnswer: 3,
    deal: { developer: 'lina', needs: 'Bilingual (Arabic/English) website with an online menu and WhatsApp ordering button', interest: 'Website + online menu', amount: 2400, signatureAgo: 22, paymentAgo: 21, closeAgo: 20 },
  },
  {
    name: 'Achrafieh Smile Dental Clinic', branch: 'Achrafieh', area: 'Beirut', category: 'Medical & Dental', phones: ['01 555 102', '01 555 112'],
    social: [['instagram', 'achrafiehsmile', 1800]], website: 'https://achrafiehsmile.example',
    created: 30, agent: 'maya', story: 'closed_in_progress', end: 22, noAnswer: 3,
    deal: { developer: 'sami', needs: 'Clinic website with online appointment booking and SMS reminders for patients', interest: 'Booking website', amount: 3800, signatureAgo: 20, paymentAgo: 19, closeAgo: 18 },
  },
  {
    name: 'Gemmayzeh Corner Café', branch: 'Gemmayzeh', area: 'Beirut', category: 'Restaurants & Cafés', phones: ['01 555 103'],
    social: [['instagram', 'gemmayzehcorner', 950]],
    created: 29, agent: 'maya', story: 'not_proceeding', end: 23, noAnswer: 2,
    deal: { developer: 'sami', needs: 'Social media management and a simple landing page for events nights', interest: 'Social media package', notProceedingAgo: 17, notProceedingReason: 'Owner decided to postpone any marketing spend until after the summer season' },
  },
  {
    name: 'Verdun Glow Beauty Lounge', branch: 'Verdun', area: 'Beirut', category: 'Beauty & Wellness', phones: ['01 555 104'],
    social: [['instagram', 'verdunglow', 6100], ['tiktok', 'verdunglow', 3300]], website: 'https://verdunglow.example',
    created: 24, agent: 'maya', story: 'signed_paid_review', end: 14, noAnswer: 3,
    deal: { developer: 'sami', needs: 'Online booking for treatments, gift cards and an Instagram shop integration', interest: 'Booking + e-commerce', amount: 5200, signatureAgo: 11, paymentAgo: 8, reviewAgo: 2 },
  },
  {
    name: 'Badaro Kids Learning Center', branch: 'Badaro', area: 'Beirut', category: 'Education & Training', phones: ['01 555 105'],
    created: 31, agent: 'maya', story: 'rejected', end: 27, noAnswer: 2,
    rejection: 'Already working with another agency on a two-year contract',
  },
  {
    name: 'Mar Mikhael Flower Studio', branch: 'Mar Mikhael', area: 'Beirut', category: 'Retail & Fashion', phones: ['01 555 106'],
    social: [['instagram', 'marmikhaelflowers', 2700]],
    created: 18, agent: 'maya', story: 'signed', end: 10, noAnswer: 3,
    deal: { developer: 'lina', needs: 'Online shop for bouquets with same-day delivery slots across Beirut', interest: 'E-commerce website', signatureAgo: 5 },
  },
  {
    name: 'Saida Castle View Café', branch: 'Old Souk', area: 'Saida', category: 'Restaurants & Cafés', phones: ['07 555 107'],
    social: [['facebook', 'saidacastleviewcafe', 1400]],
    created: 10, agent: 'maya', story: 'accepted_dev', end: 3, noAnswer: 2,
    deal: { developer: 'lina', needs: 'Menu website with table reservations and Google Maps listing clean-up', interest: 'Website + reservations' },
  },
  {
    name: 'Sidon Family Pharmacy', branch: 'Riad El Solh Street', area: 'Saida', category: 'Medical & Dental', phones: ['07 555 108'],
    created: 12, agent: 'maya', story: 'on_hold', end: 4, noAnswer: 3,
  },
  {
    name: 'Tyre Coast Diving Center', branch: 'Sour', area: 'Tyre', category: 'Fitness & Sports', phones: ['07 555 109'],
    social: [['instagram', 'tyrecoastdiving', 5400], ['youtube', 'tyrecoastdiving', 820]], website: 'https://tyrecoastdiving.example',
    created: 6, agent: 'maya', story: 'on_hold_overdue', end: 3, noAnswer: 1,
  },
  {
    name: 'Aley Mountain Spa', branch: null, area: 'Aley', category: 'Beauty & Wellness', phones: ['05 555 110'],
    created: 11, agent: 'maya', story: 'nac_followup', end: 2, noAnswer: 3,
  },
  {
    name: 'Sin El Fil Auto Care', branch: 'Sin El Fil', area: 'Metn', category: 'Automotive', phones: ['01 555 111'],
    created: 13, agent: 'maya', story: 'nac_marker', end: 3, noAnswer: 3,
  },
  {
    name: 'Broummana Heights Realty', branch: 'Broummana', area: 'Metn', category: 'Real Estate', phones: ['04 555 113'],
    website: 'https://broummanaheights.example',
    created: 16, agent: 'maya', story: 'rejected', end: 12, noAnswer: 2,
    rejection: 'Not interested; they rely on agency listing portals only',
  },
  {
    name: 'Raouche Sea View Suites', branch: 'Raouche', area: 'Beirut', category: 'Hospitality & Tourism', phones: ['01 555 114'],
    social: [['instagram', 'raouchesuites', 3900]],
    created: 3, agent: 'maya', story: 'fresh',
  },
  {
    name: 'Hamra Book Corner', branch: 'Hamra', area: 'Beirut', category: 'Retail & Fashion', phones: [],
    notes: 'Phone number still to be collected (shop visit planned).',
    created: 2, agent: null, story: 'no_phone',
  },
  {
    name: 'Dbayeh Marina Fitness Club', branch: 'Dbayeh', area: 'Metn', category: 'Fitness & Sports', phones: ['04 555 115'],
    social: [['instagram', 'dbayehmarinafit', 2100]],
    created: 1, agent: 'maya', story: 'fresh',
  },
  {
    name: 'South Coast Homes', branch: 'Saida', area: 'Saida', category: 'Real Estate', phones: ['07 555 116'],
    created: 0, agent: 'maya', story: 'fresh',
  },
  // ----- Omar: Kesrouan, North, Bekaa -----
  {
    name: 'Jounieh Bay Seafood Grill', branch: 'Maameltein', area: 'Jounieh', category: 'Restaurants & Cafés', phones: ['09 555 201'],
    social: [['instagram', 'jouniehbaygrill', 3100]], website: 'https://jouniehbaygrill.example',
    created: 28, agent: 'omar', story: 'closed_waiting', end: 20, noAnswer: 3,
    deal: { developer: 'lina', needs: 'Restaurant website with photo menu, delivery zones and Instagram feed', interest: 'Website', amount: 1500, signatureAgo: 18, paymentAgo: 17, closeAgo: 16 },
  },
  {
    name: 'Kaslik Fashion House', branch: 'Kaslik', area: 'Jounieh', category: 'Retail & Fashion', phones: ['09 555 202'],
    social: [['instagram', 'kaslikfashionhouse', 8700], ['tiktok', 'kaslikfashion', null]],
    created: 14, agent: 'omar', story: 'paid', end: 8, noAnswer: 2,
    deal: { developer: 'sami', needs: 'Online catalogue with size guide and click-and-collect for the Kaslik shop', interest: 'E-commerce website', amount: 900, paymentAgo: 4 },
  },
  {
    name: 'Harissa View Guesthouse', branch: 'Harissa', area: 'Kesrouan', category: 'Hospitality & Tourism', phones: ['09 555 203'],
    created: 20, agent: 'omar', story: 'not_proceeding', end: 13, noAnswer: 2,
    deal: { needs: 'Booking website with room calendar and multilingual pages (Arabic, English, French)', interest: 'Booking website', notProceedingAgo: 7, notProceedingReason: 'Budget moved to renovating the guest rooms this year' },
  },
  {
    name: 'Zouk Mosbeh Physio Center', branch: 'Zouk Mosbeh', area: 'Kesrouan', category: 'Medical & Dental', phones: ['09 555 204'],
    created: 7, agent: 'omar', story: 'accepted_open', end: 1, noAnswer: 1,
    deal: { needs: 'Patient intake form online and a clean services page with therapist profiles', interest: 'Website' },
  },
  {
    name: 'Byblos Old Souk Crafts', branch: 'Jbeil', area: 'Byblos', category: 'Retail & Fashion', phones: ['09 555 205'],
    created: 25, agent: 'omar', story: 'rejected', end: 21, noAnswer: 2,
    rejection: 'Shop owner asked not to be called again',
  },
  {
    name: 'Tripoli Sweets Palace', branch: 'Al Tal', area: 'Tripoli', category: 'Other', phones: ['06 555 206'],
    social: [['facebook', 'tripolisweetspalace', 12400]],
    created: 9, agent: 'omar', story: 'on_hold', end: 2, noAnswer: 2,
  },
  {
    name: 'Mina Harbour Fish Market', branch: 'El Mina', area: 'Tripoli', category: 'Food & Produce', phones: ['06 555 207'],
    created: 8, agent: 'omar', story: 'rejected', end: 5, noAnswer: 1,
    rejection: 'Closing the shop for renovation; no budget this year',
  },
  {
    name: 'Batroun Sunset Beach Bar', branch: 'Batroun', area: 'Batroun', category: 'Hospitality & Tourism', phones: ['06 555 208'],
    social: [['instagram', 'batrounsunsetbar', 7600]],
    created: 6, agent: 'omar', story: 'on_hold', end: 1, noAnswer: 1,
  },
  {
    name: 'Zahle Berdawni Riverside Restaurant', branch: 'Berdawni', area: 'Zahle', category: 'Restaurants & Cafés', phones: ['08 555 209'],
    created: 5, agent: 'omar', story: 'nac_followup', end: 0, noAnswer: 1,
  },
  {
    name: 'Bekaa Vineyard Cellar', branch: 'Zahle', area: 'Zahle', category: 'Food & Produce', phones: ['08 555 210'],
    website: 'https://bekaavineyardcellar.example',
    created: 4, agent: 'omar', story: 'nac_marker', end: 1, noAnswer: 1,
  },
  {
    name: 'Chtaura Auto Parts', branch: 'Chtaura', area: 'Bekaa', category: 'Automotive', phones: ['08 555 211'],
    created: 2, agent: 'omar', story: 'fresh',
  },
  {
    name: 'Ghazir Olive Oil Press', branch: 'Ghazir', area: 'Kesrouan', category: 'Food & Produce', phones: ['09 555 212'],
    created: 0, agent: 'omar', story: 'fresh',
  },
  {
    name: 'Al Mina Language Institute', branch: 'El Mina', area: 'Tripoli', category: 'Education & Training', phones: ['06 555 213'],
    created: 1, createdBy: 'owner', agent: null, story: 'unassigned',
  },
  {
    name: 'Zahle Bright Minds Bookshop', branch: 'Zahle', area: 'Zahle', category: 'Education & Training', phones: ['08 555 214'],
    created: 0, agent: null, story: 'unassigned',
  },
];

/** Steps per story after the leading no-answer attempts. */
const STORY_STEPS: Record<Story, StepKind[]> = {
  closed_completed: ['hold', 'accepted'],
  closed_in_progress: ['hold', 'accepted'],
  closed_waiting: ['hold', 'accepted'],
  signed_paid_review: ['hold', 'accepted'],
  signed: ['accepted'],
  paid: ['hold', 'accepted'],
  accepted_dev: ['hold', 'accepted'],
  accepted_open: ['nacfu', 'accepted'],
  not_proceeding: ['hold', 'accepted'],
  rejected: ['hold', 'rejected'],
  on_hold: ['hold'],
  on_hold_overdue: ['hold'],
  nac_followup: ['nacfu'],
  nac_marker: ['nac'],
  fresh: [],
  unassigned: [],
  no_phone: [],
};
type StepKind = 'nac' | 'nacfu' | 'hold' | 'accepted' | 'rejected';

const NO_ANSWER_NOTES = [
  'No answer, phone rang out',
  'Line busy, will try again later',
  'Receptionist asked to call back after lunch',
  'Owner was with a customer; asked for a call later in the week',
  'Voicemail full, no message left',
];
const HOLD_NOTES = [
  'Spoke to the manager: interested, wants to discuss with the partner first. Agreed a call-back time.',
  'Owner liked the examples we sent on WhatsApp; asked to call back after checking the budget.',
  'Interested in a website, waiting for the end-of-month figures before deciding.',
];
const NACFU_NOTES = ['Manager travelling; asked us to call back on a set date', 'Owner asked for a call next week, slot agreed'];

// ---------------------------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------------------------

interface CallingState {
  outcome: 'pending' | 'on_hold' | 'needs_another_call' | 'rejected' | 'accepted';
  version: number;
  marker: boolean;
  markerSetAt: Date | null;
  changedAt: Date | null;
  changedBy: string | null;
  rejection: string | null;
  lastTouch: Date | null;
}

interface DealFacts {
  stage: string;
  signatureDate: string | null;
  signatureReference: string | null;
  paymentDate: string | null;
  paymentReference: string | null;
  paymentAmount: string | null;
  paymentCurrency: string | null;
}

interface Counts {
  [table: string]: number;
}

class DemoSeeder {
  private readonly rng: Rng = makeRng(20261028);
  private readonly cal: Calendar;
  private people!: Record<PersonKey, Person>;
  private categoryIds = new Map<string, string>();
  private settingsVersionId: string | null = null;
  /** employeeId → company date → instants of work done that day (attendance must cover them). */
  private readonly activity = new Map<string, Map<string, number[]>>();
  /** Items that are live now and get an outbox event at the end. */
  private readonly live: { name: OutboxEventName; aggregateType: string; aggregateId: string; payload: Record<string, string | number | boolean | null> }[] = [];
  private readonly counts: Counts = {};
  private refSeq = 0;

  constructor(private readonly db: Db, now: Date) {
    this.cal = new Calendar(now);
  }

  private count(table: string, n = 1) {
    this.counts[table] = (this.counts[table] ?? 0) + n;
  }

  private mark(person: Person, instant: Date) {
    if (person.role === 'owner') return; // the Owner does not track attendance in the demo
    const date = workDateOf(instant, TZ);
    let days = this.activity.get(person.id);
    if (!days) this.activity.set(person.id, (days = new Map()));
    const list = days.get(date) ?? [];
    list.push(instant.getTime());
    days.set(date, list);
  }

  /** A random working-hours instant on `date` in [from, to] minutes, avoiding the lunch window. */
  private slot(date: string, from: number, to: number): Date {
    let minute = this.rng.int(from, Math.max(from, to));
    if (minute >= 12 * 60 + 40 && minute < 14 * 60 + 5) minute = this.rng.chance(0.5) ? 12 * 60 + this.rng.int(10, 35) : 14 * 60 + this.rng.int(10, 40);
    return at(date, Math.min(Math.max(minute, from), Math.max(from, to)), this.rng.int(0, 59));
  }

  private async audit(
    at: Date,
    actor: Person | null,
    e: { eventName: string; entityType: string; entityId: string; payload?: Record<string, unknown>; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null; reason?: string | null }
  ) {
    await this.db.query(
      `INSERT INTO audit_events (event_name, actor_id, actor_role, entity_type, entity_id, payload, before_state, after_state, reason, source_workflow, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        e.eventName, actor?.id ?? null, actor?.role ?? null, e.entityType, e.entityId, JSON.stringify(e.payload ?? {}),
        e.before ? JSON.stringify(e.before) : null, e.after ? JSON.stringify(e.after) : null, e.reason ?? null, AUDIT_SOURCE, at,
      ]
    );
    this.count('audit_events');
  }

  private async one<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T> {
    const { rows } = await this.db.query<T>(sql, params);
    return rows[0];
  }

  // -------------------------------------------------------------------------------------------
  // Setup: people, settings, categories
  // -------------------------------------------------------------------------------------------

  async alreadySeeded(): Promise<boolean> {
    const key = nameKey(normalizeName(MARKER.name), normalizeBranch(MARKER.branch));
    const { rows } = await this.db.query('SELECT 1 FROM businesses WHERE name_key = $1', [key]);
    return rows.length > 0;
  }

  async loadPeople() {
    const out = {} as Record<PersonKey, Person>;
    for (const [key, email] of Object.entries(PEOPLE_EMAILS) as [PersonKey, string][]) {
      const row = await this.one<{ id: string; role: Role; is_active: boolean }>('SELECT id, role, is_active FROM employees WHERE email = $1', [email]);
      if (!row || !row.is_active) throw new Error(`Employee ${email} is missing or inactive: run \`npm run seed\` (src/db/seed.ts) first.`);
      out[key] = { id: row.id, role: row.role };
    }
    this.people = out;
  }

  /**
   * Company values the demo needs, written only where nothing is saved yet (Owner choices are kept):
   * timezone, default country code (phones without a code) and the deal currency list (payment amounts).
   * Plus the first attendance settings version when none exists, so check-in works on the local network.
   */
  async ensureSettings() {
    const owner = this.people.owner;
    const when = at(this.cal.pastDays(40)[39], 8 * 60);
    const wanted: [string, unknown][] = [
      ['company.timezone', TZ],
      ['business.defaultCountryCode', COUNTRY_CODE],
      ['deals.defaultCurrency', CURRENCY],
      ['deals.currencies', [CURRENCY, 'LBP']],
    ];
    const current = await readCompanySettings(this.db, true);
    const next = { ...current.values };
    const after: Record<string, unknown> = {};
    for (const [key, raw] of wanted) {
      if (Object.prototype.hasOwnProperty.call(current.values, key)) continue;
      next[key] = parseSettingValue(key as Parameters<typeof parseSettingValue>[0], raw);
      after[key] = next[key];
    }
    if (Object.keys(after).length > 0) {
      const written = await writeCompanySettings(this.db, next, current.version, owner.id);
      if (!written) throw new Error('company_settings changed while seeding; run again');
      await this.audit(when, owner, { eventName: 'settings.updated', entityType: 'setting', entityId: 'company', after, payload: { keys: Object.keys(after), version: written.version } });
    }
    const tz = current.values['company.timezone'];
    if (typeof tz === 'string' && tz && tz !== TZ) console.warn(`⚠️  company.timezone is "${tz}"; demo working hours are generated in ${TZ}.`);

    const latest = await this.one<{ id: string; version_no: number; timezone: string; reason: string | null; holidays_confirmed: boolean }>(
      'SELECT id, version_no, timezone, reason, holidays_confirmed FROM attendance_settings_versions ORDER BY version_no DESC LIMIT 1'
    );
    // D1: attendance is configured only by a version with every company value and the holiday
    // confirmation. A demo version written before migration 980 is re-saved once as confirmed; an
    // Owner-saved version is never touched.
    const demoReason = 'Demo: the local Docker network is treated as the office network';
    if (latest && (latest.holidays_confirmed || latest.reason !== demoReason)) {
      this.settingsVersionId = latest.id;
      if (latest.timezone !== TZ) console.warn(`⚠️  Attendance settings use ${latest.timezone}; demo sessions are generated in ${TZ}.`);
      if (!latest.holidays_confirmed) console.warn('⚠️  Attendance settings are not configured (holidays not confirmed): save them in Settings.');
      return;
    }
    const v = await this.one<{ id: string }>(
      `INSERT INTO attendance_settings_versions (version_no, timezone, working_days, shift_start, shift_end, grace_minutes, verification_mode,
         office_ips, holidays, holidays_confirmed, summary_required, summary_min_length, missing_checkout_flag_hours, reason, created_by, created_at)
       VALUES ($7, $1, $2, '09:00', '18:00', 10, 'ip', $3, '{}'::date[], true, true, 10, 6, $4, $5, $6) RETURNING id`,
      [TZ, WORKING_DAYS, DEMO_OFFICE_IPS, demoReason, owner.id, when, (latest?.version_no ?? 0) + 1]
    );
    this.settingsVersionId = v.id;
    this.count('attendance_settings_versions');
    await this.audit(when, owner, {
      eventName: 'settings.updated',
      entityType: 'attendance_settings',
      entityId: v.id,
      after: { versionNo: (latest?.version_no ?? 0) + 1, timezone: TZ, workingDays: WORKING_DAYS, shiftStart: '09:00', graceMinutes: 10, verificationMode: 'ip', holidaysConfirmed: true },
    });
  }

  async ensureCategories() {
    const when = at(this.cal.pastDays(40)[38], 9 * 60 + 30);
    for (const name of CATEGORIES) {
      const normalized = normalizeName(name);
      const { rows } = await this.db.query<{ id: string }>(
        `INSERT INTO categories (name, normalized_name, created_by, updated_by, created_at, updated_at)
         VALUES ($1, $2, $3, $3, $4, $4) ON CONFLICT (normalized_name) DO NOTHING RETURNING id`,
        [name, normalized, this.people.owner.id, when]
      );
      if (rows[0]) {
        this.count('categories');
        await this.audit(when, this.people.owner, { eventName: 'category.created', entityType: 'category', entityId: rows[0].id, after: { name } });
      }
    }
    const { rows } = await this.db.query<{ id: string; name: string }>('SELECT id, name FROM categories');
    for (const r of rows) this.categoryIds.set(normalizeName(r.name), r.id);
  }

  private categoryId(name: Category): string {
    const id = this.categoryIds.get(normalizeName(name));
    if (!id) throw new Error(`category ${name} missing`);
    return id;
  }

  // -------------------------------------------------------------------------------------------
  // Businesses, assignments, calls
  // -------------------------------------------------------------------------------------------

  private snapshot(b: BizDef, category: Category, phones: string[]) {
    return {
      name: b.name,
      branch: b.branch,
      category,
      phones,
      social: (b.social ?? []).map(([platform, handle, followers]) => ({ platform, handle, followers, lastPost: null })),
      website: b.website ?? null,
      notes: b.notes ?? null,
    };
  }

  async seedBusinesses() {
    // Data Entry adds the day's businesses one after another in the morning.
    const nextCreation = new Map<string, number>();
    const createdAt = (b: BizDef): Date => {
      const date = this.cal.day(b.created);
      const minute = (nextCreation.get(date) ?? 9 * 60 + 35) + this.rng.int(4, 18);
      nextCreation.set(date, minute);
      return at(date, minute, this.rng.int(0, 59));
    };
    for (const b of BUSINESSES) await this.seedBusiness(b, createdAt(b));
  }

  private async seedBusiness(b: BizDef, createdAt: Date) {
    const creator = this.people[b.createdBy ?? 'karim'];
    const owner = this.people.owner;
    const normalizedName = normalizeName(b.name);
    const normalizedBranch = normalizeBranch(b.branch ?? '');
    const phones = b.phones.map((n) => {
      const r = normalizePhone(COUNTRY_CODE, n, COUNTRY_CODE);
      if (!r.ok) throw new Error(`invalid demo phone ${n}`);
      return r.phone;
    });
    const biz = await this.one<{ id: string }>(
      `INSERT INTO businesses (name, branch, normalized_name, normalized_branch, name_key, category_id, website, notes,
                               created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $10) RETURNING id`,
      [b.name, b.branch, normalizedName, normalizedBranch, nameKey(normalizedName, normalizedBranch), this.categoryId(b.category),
        b.website ?? null, b.notes ?? null, creator.id, createdAt]
    );
    this.count('businesses');
    for (const [i, p] of phones.entries()) {
      await this.db.query(
        `INSERT INTO business_phones (business_id, country_code, number, normalized_phone, position, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [biz.id, p.countryCode, p.number, p.normalized, i, createdAt]
      );
      this.count('business_phones');
    }
    for (const [i, [platform, handle, followers]] of (b.social ?? []).entries()) {
      await this.db.query(
        `INSERT INTO social_accounts (business_id, platform, handle, normalized_handle, followers, metrics_recorded_at, position, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [biz.id, platform, handle, normalizeHandle(handle), followers, followers === null ? null : createdAt, i, createdAt]
      );
      this.count('social_accounts');
    }
    // C-02: every business starts Pending and Unassigned (calls.initCallingState).
    await this.db.query('INSERT INTO business_calling_states (business_id, created_at, updated_at) VALUES ($1, $2, $2)', [biz.id, createdAt]);
    this.count('business_calling_states');
    await this.db.query(
      `INSERT INTO business_edit_history (business_id, change_kind, after_value, changed_by, changed_at) VALUES ($1, 'created', $2, $3, $4)`,
      [biz.id, JSON.stringify(this.snapshot(b, b.category, phones.map((p) => p.normalized))), creator.id, createdAt]
    );
    this.count('business_edit_history');
    await this.audit(createdAt, creator, { eventName: 'business.created', entityType: 'business', entityId: biz.id, after: { name: b.name, categoryId: this.categoryId(b.category) } });
    this.mark(creator, createdAt);

    if (!b.agent) return;
    const agent = this.people[b.agent];
    const assignedAt = new Date(createdAt.getTime() + this.rng.int(20, 70) * MIN);
    const source = this.rng.chance(0.3) ? 'work_list' : 'manual';
    const asg = await this.one<{ id: string }>(
      `INSERT INTO calling_assignments (business_id, assignee_id, assigned_by, source, started_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5, $5) RETURNING id`,
      [biz.id, agent.id, owner.id, source, assignedAt]
    );
    this.count('calling_assignments');
    await this.audit(assignedAt, owner, {
      eventName: 'calling_assignment.assigned',
      entityType: 'calling_assignment',
      entityId: asg.id,
      payload: { businessId: biz.id, assigneeId: agent.id, source },
      after: { assigneeId: agent.id, endedAt: null },
    });
    if (this.cal.now.getTime() - assignedAt.getTime() < 26 * 3600_000) {
      this.live.push({ name: 'calling_assignment.assigned', aggregateType: 'calling_assignment', aggregateId: asg.id, payload: { businessId: biz.id, assigneeId: agent.id } });
    }

    if (b.story === 'on_hold' && b.category === 'Other') await this.categoryCorrection(biz.id, b);
    await this.seedCalls(biz.id, b, agent, assignedAt);
    if (b.story === 'nac_marker' && b.agent === 'maya') await this.openPhoneCorrection(biz.id, agent);
  }

  /** Plan the attempt instants: from the first working day after assignment to the story's end day. */
  private attemptTimes(b: BizDef, assignedAt: Date, n: number): Date[] {
    const start = b.created;
    const end = b.end ?? b.created;
    const days: number[] = [];
    for (let i = 0; i < n; i++) days.push(n === 1 ? end : Math.round(start - ((start - end) * i) / (n - 1)));
    const out: Date[] = [];
    let previous = assignedAt.getTime();
    for (const k of days) {
      const date = this.cal.day(k);
      const sameDay = workDateOf(new Date(previous), TZ) === date;
      const from = sameDay ? Math.max(localMinute(new Date(previous)) + 25, 9 * 60 + 35) : 9 * 60 + 35;
      const to = date === this.cal.today ? 12 * 60 + 50 : 17 * 60 + 20;
      let t = this.slot(date, Math.min(from, to), to);
      if (t.getTime() <= previous) t = new Date(previous + this.rng.int(25, 50) * MIN);
      out.push(t);
      previous = t.getTime();
    }
    return out;
  }

  private async seedCalls(businessId: string, b: BizDef, agent: Person, assignedAt: Date) {
    const steps: StepKind[] = [...Array<StepKind>(b.noAnswer ?? 0).fill('nac'), ...STORY_STEPS[b.story]];
    if (steps.length === 0) return;
    const times = this.attemptTimes(b, assignedAt, steps.length);
    const s: CallingState = { outcome: 'pending', version: 1, marker: false, markerSetAt: null, changedAt: null, changedBy: null, rejection: null, lastTouch: null };
    let open: { id: string; scheduledFor: Date } | null = null;

    for (const [i, kind] of steps.entries()) {
      const t = times[i];
      const isLast = i === steps.length - 1;
      // The reservation the agent held while on the call (released with reason call_saved).
      const acquired = new Date(t.getTime() - this.rng.int(2, 7) * MIN);
      const res = await this.one<{ id: string }>(
        `INSERT INTO contact_reservations (business_id, holder_id, state, acquired_at, last_renewed_at, lease_expires_at, last_activity_at,
                                           max_window_started_at, ended_at, end_reason, ended_by, created_at, updated_at, version)
         VALUES ($1, $2, 'released', $3, $4, $5, $6, $3, $7, 'call_saved', $2, $3, $7, 2) RETURNING id`,
        [businessId, agent.id, acquired, new Date(t.getTime() - 40_000), new Date(t.getTime() + 260_000), t, new Date(t.getTime() + 2000)]
      );
      this.count('contact_reservations');

      const outcome = kind === 'nac' || kind === 'nacfu' ? 'needs_another_call' : kind === 'hold' ? 'on_hold' : kind;
      const fulfils: string | null = open && kind !== 'rejected' ? open.id : null;
      const notes =
        kind === 'nac' ? this.rng.pick(NO_ANSWER_NOTES)
          : kind === 'nacfu' ? this.rng.pick(NACFU_NOTES)
            : kind === 'hold' ? this.rng.pick(HOLD_NOTES)
              : kind === 'rejected' ? 'Decision maker declined.'
                : 'Call accepted: client agreed to a proposal and a discovery meeting.';
      const attempt: { id: string } = await this.one<{ id: string }>(
        `INSERT INTO call_attempts (business_id, agent_id, reservation_id, attempted_at, channel, outcome, outcome_applied, reservation_held,
                                    notes, rejection_reason, client_needs_note, service_interest, fulfils_follow_up_id, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, 'outbound_call', $5, true, true, $6, $7, $8, $9, $10, $11, $4) RETURNING id`,
        [businessId, agent.id, res.id, t, outcome, notes, kind === 'rejected' ? b.rejection ?? 'Not interested' : null,
          kind === 'accepted' ? b.deal?.needs ?? null : null, kind === 'accepted' ? b.deal?.interest ?? null : null, fulfils, crypto.randomUUID()]
      );
      this.count('call_attempts');
      this.mark(agent, t);
      await this.audit(acquired, agent, { eventName: 'contact_reservation.acquired', entityType: 'contact_reservation', entityId: res.id, payload: { businessId } });

      if (open) {
        if (fulfils) {
          await this.db.query(
            `UPDATE follow_ups SET state = 'completed', completed_at = $2, completed_by_attempt_id = $3, version = version + 1, updated_at = $2 WHERE id = $1`,
            [open.id, t, attempt.id]
          );
          await this.followUpChange(open.id, 'completed', agent, t);
          await this.audit(t, agent, { eventName: 'follow_up.completed', entityType: 'follow_up', entityId: open.id, payload: { businessId, responsibleId: agent.id }, before: { state: 'scheduled' }, after: { state: 'completed' } });
        } else {
          // D4: Rejected cancels the open follow-up in the same save.
          await this.db.query(
            `UPDATE follow_ups SET state = 'cancelled', cancelled_at = $2, cancel_reason = $3, cancel_source = 'outcome_rejected', version = version + 1, updated_at = $2 WHERE id = $1`,
            [open.id, t, b.rejection ?? null]
          );
          await this.followUpChange(open.id, 'cancelled', agent, t, b.rejection ?? null);
          await this.audit(t, agent, { eventName: 'follow_up.cancelled', entityType: 'follow_up', entityId: open.id, payload: { businessId, responsibleId: agent.id }, before: { state: 'scheduled' }, after: { state: 'cancelled' }, reason: b.rejection ?? null });
        }
        open = null;
      }

      let marker = false;
      if (kind === 'nac') marker = true; // D2: "callback to be scheduled", no follow-up yet
      if (kind === 'nacfu' || kind === 'hold') {
        const scheduledFor = isLast ? this.futureFollowUp(b, t) : new Date(times[i + 1].getTime() - this.rng.int(0, 4) * 5 * MIN);
        const fu: { id: string } = await this.one<{ id: string }>(
          `INSERT INTO follow_ups (business_id, responsible_id, scheduled_for, purpose, created_by, created_by_attempt_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $2, $5, $6, $6) RETURNING id`,
          [businessId, agent.id, scheduledFor, kind === 'hold' ? 'Call back for the decision after the partner discussion' : 'Try the manager again at the agreed time', attempt.id, t]
        );
        this.count('follow_ups');
        await this.db.query(
          `INSERT INTO follow_up_changes (follow_up_id, kind, new_scheduled_for, new_responsible_id, changed_by, changed_at) VALUES ($1, 'scheduled', $2, $3, $3, $4)`,
          [fu.id, scheduledFor, agent.id, t]
        );
        this.count('follow_up_changes');
        await this.audit(t, agent, { eventName: 'follow_up.scheduled', entityType: 'follow_up', entityId: fu.id, payload: { businessId, responsibleId: agent.id }, after: { state: 'scheduled', scheduledFor: scheduledFor.toISOString(), responsibleId: agent.id } });
        open = { id: fu.id, scheduledFor };
        if (isLast && scheduledFor.getTime() > this.cal.now.getTime()) {
          this.live.push({ name: 'follow_up.scheduled', aggregateType: 'follow_up', aggregateId: fu.id, payload: { businessId } });
        }
      }

      const from = s.outcome;
      const changed = from !== outcome;
      await this.audit(t, agent, { eventName: 'call_attempt.logged', entityType: 'call_attempt', entityId: attempt.id, payload: { businessId, outcome, channel: 'outbound_call', outcomeApplied: true } });
      let dealId: string | null = null;
      if (kind === 'accepted' && changed && b.deal) dealId = await this.seedDeal(businessId, b, agent, attempt.id, t);
      if (changed) {
        await this.audit(t, agent, {
          eventName: 'call_outcome.changed',
          entityType: 'business',
          entityId: businessId,
          payload: { attemptId: attempt.id, ...(dealId ? { dealId } : {}) },
          before: { outcome: from },
          after: { outcome },
          reason: kind === 'rejected' ? b.rejection ?? null : null,
        });
        s.changedAt = t;
        s.changedBy = agent.id;
      }
      if (s.marker !== marker) {
        await this.audit(t, agent, { eventName: marker ? 'callback_marker.set' : 'callback_marker.cleared', entityType: 'business', entityId: businessId });
        s.markerSetAt = marker ? t : null;
      }
      s.marker = marker;
      s.outcome = outcome;
      s.rejection = kind === 'rejected' ? b.rejection ?? 'Not interested' : null;
      s.lastTouch = t;
      s.version += 1;
      await this.audit(new Date(t.getTime() + 2000), agent, { eventName: 'contact_reservation.released', entityType: 'contact_reservation', entityId: res.id, payload: { businessId, endReason: 'call_saved' }, before: { state: 'active' }, after: { state: 'released', endReason: 'call_saved' } });
    }

    await this.db.query(
      `UPDATE business_calling_states
          SET outcome = $2, outcome_changed_at = $3, outcome_changed_by = $4, rejection_reason = $5, callback_marker = $6,
              callback_marker_set_at = $7, last_touchpoint_at = $8, version = $9, updated_at = $8
        WHERE business_id = $1`,
      [businessId, s.outcome, s.changedAt, s.changedBy, s.rejection, s.marker, s.markerSetAt, s.lastTouch, s.version]
    );
  }

  /** The open follow-up at the end of a story: overdue for one business, otherwise on a coming working day. */
  private futureFollowUp(b: BizDef, createdAt: Date): Date {
    if (b.story === 'on_hold_overdue') {
      const overdue = at(this.cal.day(1), 15 * 60);
      return overdue.getTime() > createdAt.getTime() ? overdue : new Date(createdAt.getTime() + 24 * 3600_000);
    }
    return at(this.cal.future(this.rng.int(1, 3)), this.rng.pick([10 * 60 + 30, 11 * 60 + 15, 14 * 60 + 30, 15 * 60 + 30]));
  }

  private async followUpChange(id: string, kind: 'completed' | 'cancelled', by: Person, t: Date, reason: string | null = null) {
    await this.db.query(`INSERT INTO follow_up_changes (follow_up_id, kind, reason, changed_by, changed_at) VALUES ($1, $2, $3, $4, $5)`, [id, kind, reason, by.id, t]);
    this.count('follow_up_changes');
  }

  // -------------------------------------------------------------------------------------------
  // Deals, projects, meetings
  // -------------------------------------------------------------------------------------------

  private ref(prefix: string): string {
    this.refSeq += 1;
    return `${prefix}-${this.cal.today.slice(0, 4)}-${String(100 + this.refSeq).padStart(4, '0')}`;
  }

  /** A developer/Owner action on day k (10:00–16:30), never before `after`. */
  private actionAt(k: number, after: Date): Date {
    const date = this.cal.day(k);
    let t = this.slot(date, 10 * 60, date === this.cal.today ? 12 * 60 + 50 : 16 * 60 + 30);
    if (t.getTime() <= after.getTime()) t = new Date(after.getTime() + this.rng.int(20, 45) * MIN);
    return t;
  }

  private async dealChange(dealId: string, type: string, by: Person | null, t: Date, before: unknown, after: unknown, reason: string | null = null) {
    await this.db.query(
      `INSERT INTO deal_changes (deal_id, change_type, before_value, after_value, reason, actor_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [dealId, type, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after), reason, by?.id ?? null, t]
    );
    this.count('deal_changes');
  }

  private async seedDeal(businessId: string, b: BizDef, agent: Person, attemptId: string, acceptedAt: Date): Promise<string> {
    const plan = b.deal!;
    const owner = this.people.owner;
    const dev = plan.developer ? this.people[plan.developer] : null;
    const facts: DealFacts = { stage: 'accepted_opportunity', signatureDate: null, signatureReference: null, paymentDate: null, paymentReference: null, paymentAmount: null, paymentCurrency: null };
    const extra: Record<string, unknown> = {};
    let version = 1;
    const deal = await this.one<{ id: string; code: string }>(
      `INSERT INTO deals (business_id, accepted_attempt_id, accepted_by_id, client_needs_note, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING id, code`,
      [businessId, attemptId, agent.id, plan.needs, acceptedAt]
    );
    this.count('deals');
    await this.audit(acceptedAt, agent, { eventName: 'accepted_opportunity.created', entityType: 'deal', entityId: deal.id, after: { stage: 'accepted_opportunity', businessId, callAttemptId: attemptId, assignedDeveloperId: null } });

    let last = acceptedAt;
    const acceptedDay = b.end ?? 0;
    // Owner hands the opportunity to a Developer the next working day (same day for a same-day acceptance).
    if (dev) {
      const t = acceptedDay > 0 ? this.actionAt(acceptedDay - 1, acceptedAt) : new Date(acceptedAt.getTime() + 40 * MIN);
      await this.db.query('INSERT INTO deal_developer_assignments (deal_id, developer_id, assigned_by_id, assigned_at, created_at) VALUES ($1, $2, $3, $4, $4)', [deal.id, dev.id, owner.id, t]);
      this.count('deal_developer_assignments');
      extra.assigned_developer_id = dev.id;
      version += 1;
      await this.dealChange(deal.id, 'handoff_updated', owner, t, { assignedDeveloperId: null }, { assignedDeveloperId: dev.id });
      await this.audit(t, owner, { eventName: 'deal.developer_assigned', entityType: 'deal', entityId: deal.id, before: { assignedDeveloperId: null }, after: { assignedDeveloperId: dev.id } });
      if (this.cal.now.getTime() - t.getTime() < 4 * 24 * 3600_000 && !plan.signatureAgo && !plan.paymentAgo && !plan.notProceedingAgo) {
        this.live.push({ name: 'opportunity.developer_assigned', aggregateType: 'deal', aggregateId: deal.id, payload: { dealId: deal.id, developerId: dev.id, previousDeveloperId: null } });
      }
      last = t;
    }
    const recorder = dev ?? owner;

    if (plan.signatureAgo !== undefined) {
      const t = this.actionAt(plan.signatureAgo, last);
      const before = { ...facts };
      facts.signatureDate = workDateOf(t, TZ);
      facts.signatureReference = this.ref('AGR');
      facts.stage = facts.paymentDate ? 'signed_and_paid' : 'signed';
      Object.assign(extra, { signature_recorded_by_id: recorder.id, signature_recorded_at: t });
      version += 1;
      await this.dealChange(deal.id, 'signature_recorded', recorder, t, before, facts);
      await this.audit(t, recorder, { eventName: 'deal.signature_recorded', entityType: 'deal', entityId: deal.id, before, after: { ...facts } });
      this.mark(recorder, t);
      last = t;
    }
    if (plan.paymentAgo !== undefined) {
      const t = this.actionAt(plan.paymentAgo, last);
      const before = { ...facts };
      facts.paymentDate = workDateOf(t, TZ);
      facts.paymentReference = this.ref('INV');
      facts.paymentAmount = plan.amount !== undefined ? plan.amount.toFixed(2) : null;
      facts.paymentCurrency = plan.amount !== undefined ? CURRENCY : null;
      facts.stage = facts.signatureDate ? 'signed_and_paid' : 'paid';
      Object.assign(extra, { payment_recorded_by_id: recorder.id, payment_recorded_at: t });
      version += 1;
      await this.dealChange(deal.id, 'payment_recorded', recorder, t, before, facts);
      await this.audit(t, recorder, { eventName: 'deal.payment_recorded', entityType: 'deal', entityId: deal.id, before, after: { ...facts } });
      this.mark(recorder, t);
      last = t;
    }

    // DEC-006 ownerVerify (flag default): the Developer asks, the Owner verifies and closes in one step.
    const reviewAgo = plan.reviewAgo ?? plan.closeAgo;
    let closedAt: Date | null = null;
    if (reviewAgo !== undefined && dev) {
      const requestedAt = this.actionAt(reviewAgo, last);
      const verify = plan.closeAgo !== undefined;
      const decidedAt = verify ? new Date(requestedAt.getTime() + this.rng.int(60, 150) * MIN) : null;
      const review = await this.one<{ id: string }>(
        `INSERT INTO closure_reviews (deal_id, status, requested_by_id, requested_at, request_note, decided_by_id, decided_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $4) RETURNING id`,
        [deal.id, verify ? 'verified' : 'requested', dev.id, requestedAt, 'Signed agreement and payment received; please verify.', verify ? owner.id : null, decidedAt]
      );
      this.count('closure_reviews');
      version += 1;
      await this.audit(requestedAt, dev, { eventName: 'deal.closure_requested', entityType: 'deal', entityId: deal.id, payload: { reviewId: review.id } });
      this.mark(dev, requestedAt);
      if (!verify) {
        this.live.push({ name: 'deal.closure_requested', aggregateType: 'deal', aggregateId: deal.id, payload: { dealId: deal.id, reviewId: review.id } });
      } else {
        closedAt = decidedAt!;
        const before = { ...facts };
        facts.stage = 'closed';
        Object.assign(extra, { closed_at: closedAt, closed_by_id: owner.id, closure_mode: 'ownerVerify' });
        version += 1;
        await this.dealChange(deal.id, 'closed', owner, closedAt, before, { ...facts, closureMode: 'ownerVerify' });
        await this.audit(closedAt, owner, { eventName: 'deal.closed', entityType: 'deal', entityId: deal.id, before: { stage: before.stage }, after: { stage: 'closed', closureMode: 'ownerVerify' }, payload: { reviewId: review.id } });
      }
      last = decidedAt ?? requestedAt;
    }

    if (plan.notProceedingAgo !== undefined) {
      const actor = dev ?? owner;
      const t = this.actionAt(plan.notProceedingAgo, last);
      const before = { ...facts };
      facts.stage = 'not_proceeding';
      Object.assign(extra, { not_proceeding_reason: plan.notProceedingReason, not_proceeding_at: t, not_proceeding_by_id: actor.id });
      version += 1;
      // Meetings first: a discovery meeting before the decision (held or cancelled by the decision).
      await this.seedNotProceedingMeeting(deal.id, businessId, b, agent, dev, acceptedAt, t);
      await this.dealChange(deal.id, 'not_proceeding', actor, t, before, facts, plan.notProceedingReason ?? null);
      await this.audit(t, actor, { eventName: 'deal.marked_not_proceeding', entityType: 'deal', entityId: deal.id, before: { stage: before.stage }, after: { stage: 'not_proceeding' }, reason: plan.notProceedingReason ?? null });
      this.mark(actor, t);
      last = t;
    }

    await this.db.query(
      `UPDATE deals SET stage = $2, assigned_developer_id = $3, signature_date = $4, signature_reference = $5, signature_recorded_by_id = $6,
              signature_recorded_at = $7, payment_date = $8, payment_reference = $9, payment_amount = $10, payment_currency = $11,
              payment_recorded_by_id = $12, payment_recorded_at = $13, closed_at = $14, closed_by_id = $15, closure_mode = $16,
              not_proceeding_reason = $17, not_proceeding_at = $18, not_proceeding_by_id = $19, version = $20, updated_at = $21
        WHERE id = $1`,
      [deal.id, facts.stage, extra.assigned_developer_id ?? null, facts.signatureDate, facts.signatureReference, extra.signature_recorded_by_id ?? null,
        extra.signature_recorded_at ?? null, facts.paymentDate, facts.paymentReference, facts.paymentAmount, facts.paymentCurrency,
        extra.payment_recorded_by_id ?? null, extra.payment_recorded_at ?? null, extra.closed_at ?? null, extra.closed_by_id ?? null,
        extra.closure_mode ?? null, extra.not_proceeding_reason ?? null, extra.not_proceeding_at ?? null, extra.not_proceeding_by_id ?? null,
        version, last]
    );

    if (closedAt && dev) await this.seedProject(deal.id, deal.code, businessId, b, dev, agent, closedAt);
    if (b.story === 'signed_paid_review' && dev) await this.seedMeeting(deal.id, businessId, 'Requirements walkthrough', dev, [dev, agent], this.actionAt((b.end ?? 2) - 1, acceptedAt), 'held');
    if (b.story === 'accepted_dev' && dev) {
      const startsAt = at(this.cal.future(2), 11 * 60);
      await this.seedMeeting(deal.id, businessId, `${b.name} discovery meeting`, agent, [dev, agent], startsAt, 'scheduled', acceptedAt);
    }
    return deal.id;
  }

  private async seedMeeting(
    dealId: string,
    businessId: string,
    title: string,
    createdBy: Person,
    attendees: Person[],
    startsAt: Date,
    status: 'scheduled' | 'held' | 'cancelled',
    createdAt?: Date,
    cancelledAt?: Date
  ): Promise<string> {
    const created = createdAt ?? new Date(startsAt.getTime() - 2 * 24 * 3600_000);
    const endsAt = new Date(startsAt.getTime() + 45 * MIN);
    const heldNotes = status === 'held' ? 'Walked through goals, pages and content owners. Client sends logo, photos and price list this week.' : null;
    const outcomeAt = status === 'held' ? new Date(endsAt.getTime() + 15 * MIN) : status === 'cancelled' ? cancelledAt ?? endsAt : null;
    const m = await this.one<{ id: string }>(
      `INSERT INTO meetings (deal_id, business_id, status, title, starts_at, ends_at, location, agenda, discovery_notes, cancel_reason,
                             outcome_recorded_at, outcome_recorded_by_id, created_by_id, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
      [dealId, businessId, status, title, startsAt, endsAt, this.rng.pick(['Client premises', 'Video call', 'Udigity office, Beirut']),
        'Scope, timeline, content and next steps', heldNotes, status === 'cancelled' ? 'Deal not proceeding' : null,
        status === 'held' ? outcomeAt : null, status === 'held' ? createdBy.id : null, createdBy.id, status === 'scheduled' ? 1 : 2, created, outcomeAt ?? created]
    );
    this.count('meetings');
    for (const p of attendees) {
      await this.db.query('INSERT INTO meeting_attendees (meeting_id, employee_id, added_at) VALUES ($1, $2, $3)', [m.id, p.id, created]);
      this.count('meeting_attendees');
    }
    const schedule = { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), attendeeIds: attendees.map((p) => p.id) };
    await this.db.query(`INSERT INTO meeting_changes (meeting_id, change_type, after_value, actor_id, created_at) VALUES ($1, 'scheduled', $2, $3, $4)`, [m.id, JSON.stringify(schedule), createdBy.id, created]);
    this.count('meeting_changes');
    await this.audit(created, createdBy, { eventName: 'meeting.scheduled', entityType: 'meeting', entityId: m.id, after: { dealId, ...schedule } });
    if (status !== 'scheduled') {
      await this.db.query(
        `INSERT INTO meeting_changes (meeting_id, change_type, before_value, after_value, reason, actor_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [m.id, status, JSON.stringify({ status: 'scheduled' }), JSON.stringify({ status }), status === 'cancelled' ? 'Deal not proceeding' : null, createdBy.id, outcomeAt]
      );
      this.count('meeting_changes');
      await this.audit(outcomeAt!, createdBy, { eventName: `meeting.${status}`, entityType: 'meeting', entityId: m.id, before: { status: 'scheduled' }, after: { status }, reason: status === 'cancelled' ? 'Deal not proceeding' : null });
    }
    if (status === 'held') {
      for (const p of attendees) {
        this.mark(p, startsAt);
        this.mark(p, endsAt);
      }
    }
    if (status === 'scheduled' && startsAt.getTime() > this.cal.now.getTime()) {
      this.live.push({ name: 'meeting.scheduled', aggregateType: 'meeting', aggregateId: m.id, payload: { meetingId: m.id, dealId, startsAt: startsAt.toISOString() } });
    }
    return m.id;
  }

  /** One held meeting before the decision; for a deal without Developer the planned meeting is cancelled by it. */
  private async seedNotProceedingMeeting(dealId: string, businessId: string, b: BizDef, agent: Person, dev: Person | null, acceptedAt: Date, decidedAt: Date) {
    const acceptedDay = b.end ?? 1;
    if (dev) {
      await this.seedMeeting(dealId, businessId, `${b.name} discovery meeting`, agent, [dev, agent], this.actionAt(acceptedDay - 2, acceptedAt), 'held', acceptedAt);
    } else {
      const startsAt = at(this.cal.day(Math.max(0, (b.deal?.notProceedingAgo ?? 1) - 2)), 11 * 60);
      await this.seedMeeting(dealId, businessId, `${b.name} proposal meeting`, agent, [agent, this.people.owner], startsAt, 'cancelled', acceptedAt, decidedAt);
    }
  }

  private async projectChange(projectId: string, type: string, by: Person | null, t: Date, before: unknown, after: unknown, note: string | null = null) {
    await this.db.query(
      `INSERT INTO project_changes (project_id, change_type, before_value, after_value, note, actor_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [projectId, type, before === null ? null : JSON.stringify(before), JSON.stringify(after), note, by?.id ?? null, t]
    );
    this.count('project_changes');
  }

  private async seedProject(dealId: string, code: string, businessId: string, b: BizDef, dev: Person, agent: Person, closedAt: Date) {
    const owner = this.people.owner;
    const closeDay = b.deal!.closeAgo!;
    const provisionedAt = new Date(closedAt.getTime() + 5000);
    const startDate = workDateOf(closedAt, TZ);
    const targetDate = addDays(startDate, 28);
    const p = await this.one<{ id: string }>(
      `INSERT INTO projects (deal_id, business_id, name, status, start_date, target_date, provisioned_by, created_at, updated_at)
       VALUES ($1, $2, $3, 'scheduled', $4, $5, 'auto', $6, $6) RETURNING id`,
      [dealId, businessId, `${b.name} (${code})`.slice(0, 200), startDate, targetDate, provisionedAt]
    );
    this.count('projects');
    await this.projectChange(p.id, 'provisioned', null, provisionedAt, null, { status: 'scheduled', provisionedBy: 'auto' });
    await this.audit(provisionedAt, null, { eventName: 'project.provisioned', entityType: 'project', entityId: p.id, after: { dealId, status: 'scheduled', provisionedBy: 'auto' } });
    const assignedAt = new Date(closedAt.getTime() + 25 * MIN);
    await this.db.query('INSERT INTO project_developer_assignments (project_id, developer_id, assigned_by_id, assigned_at, created_at) VALUES ($1, $2, $3, $4, $4)', [p.id, dev.id, owner.id, assignedAt]);
    this.count('project_developer_assignments');
    await this.projectChange(p.id, 'developer_assigned', owner, assignedAt, null, { developerId: dev.id });
    await this.audit(assignedAt, owner, { eventName: 'project.developers_changed', entityType: 'project', entityId: p.id, before: { developerIds: [] }, after: { developerIds: [dev.id] } });

    // Kick-off meeting the day after closure.
    await this.seedMeeting(dealId, businessId, `${b.name} kick-off`, dev, [dev, agent], this.actionAt(closeDay - 1, closedAt), 'held', closedAt);

    let status = 'scheduled';
    let version = 2;
    let last = assignedAt;
    let statusNote: string | null = null;
    let deliveredAt: Date | null = null;
    let completedAt: Date | null = null;
    const move = async (to: string, t: Date, by: Person, note: string | null = null) => {
      await this.projectChange(p.id, 'status_changed', by, t, { status, note: statusNote }, { status: to, note }, note);
      await this.audit(t, by, { eventName: 'project.status_changed', entityType: 'project', entityId: p.id, before: { status }, after: { status: to }, reason: note });
      this.mark(by, t);
      status = to;
      statusNote = note;
      version += 1;
      last = t;
    };
    await move('in_progress', this.actionAt(closeDay - 1, closedAt), dev);

    const taskPlan: { title: string; state: 'done' | 'in_progress' | 'todo'; milestone?: boolean; clientDep?: string }[] =
      b.story === 'closed_completed'
        ? [{ title: 'Collect logo, photos and menu', state: 'done' }, { title: 'Design home and menu pages', state: 'done' }, { title: 'WhatsApp ordering button', state: 'done' }, { title: 'Go live', state: 'done', milestone: true }]
        : b.story === 'closed_waiting'
          ? [{ title: 'Site map and page list', state: 'done' }, { title: 'Photo menu content', state: 'todo', clientDep: 'Waiting for dish photos and the new price list' }, { title: 'Delivery zones page', state: 'todo' }, { title: 'Launch', state: 'todo', milestone: true }]
          : [{ title: 'Clinic content and doctor profiles', state: 'done' }, { title: 'Booking calendar integration', state: 'in_progress' }, { title: 'SMS reminder setup', state: 'todo' }, { title: 'Patient intake form', state: 'todo' }, { title: 'Go live', state: 'todo', milestone: true }];
    const sortIndex = { done: 0, in_progress: 0, todo: 0 };
    for (const [i, task] of taskPlan.entries()) {
      const createdAt = new Date(closedAt.getTime() + (40 + i) * MIN);
      const start = addDays(startDate, i * 4);
      const due = addDays(start, task.milestone ? 2 : 5);
      const doneAt = task.state === 'done' ? this.actionAt(Math.max(1, closeDay - 2 - i * 3), last) : null;
      const row = await this.one<{ id: string }>(
        `INSERT INTO tasks (project_id, title, status, owner_id, start_date, due_date, is_milestone, client_dependency, client_dependency_note, sort_order,
                            completed_at, completed_by_id, created_by_id, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $4, $13, $14, $15) RETURNING id`,
        [p.id, task.title, task.state, dev.id, start, due, Boolean(task.milestone), Boolean(task.clientDep), task.clientDep ?? null,
          sortIndex[task.state]++, doneAt, doneAt ? dev.id : null, task.state === 'todo' ? 1 : 2, createdAt, doneAt ?? createdAt]
      );
      this.count('tasks');
      await this.audit(createdAt, dev, { eventName: 'task.created', entityType: 'task', entityId: row.id, after: { projectId: p.id, status: 'todo', isMilestone: Boolean(task.milestone) } });
      if (doneAt) this.mark(dev, doneAt);
    }

    if (b.story === 'closed_completed') {
      deliveredAt = this.actionAt(8, last);
      await move('delivered', deliveredAt, dev);
      completedAt = this.actionAt(5, deliveredAt);
      await move('completed', completedAt, owner);
    } else if (b.story === 'closed_waiting') {
      await move('waiting_for_client', this.actionAt(Math.max(1, closeDay - 6), last), dev, 'Waiting for the client to send dish photos and the new price list');
    } else {
      // Progress review with the Owner on a coming day.
      await this.seedMeeting(dealId, businessId, `${b.name} progress review`, owner, [dev, owner], at(this.cal.future(3), 14 * 60), 'scheduled', new Date(last.getTime() + 30 * MIN));
    }
    await this.db.query(
      `UPDATE projects SET status = $2, status_note = $3, delivered_at = $4, completed_at = $5, version = $6, updated_at = $7 WHERE id = $1`,
      [p.id, status, statusNote, deliveredAt, completedAt, version, last]
    );
  }

  // -------------------------------------------------------------------------------------------
  // Data corrections (arise from calls)
  // -------------------------------------------------------------------------------------------

  /** Omar flags the wrong category the day after creation; Karim applies it (resolved, field history kept). */
  private async categoryCorrection(businessId: string, b: BizDef) {
    const omar = this.people.omar;
    const karim = this.people.karim;
    const submittedAt = this.slot(this.cal.day(b.created - 1), 10 * 60, 11 * 60 + 30);
    const resolvedAt = new Date(submittedAt.getTime() + this.rng.int(50, 110) * MIN);
    const fixed: Category = 'Restaurants & Cafés';
    const r = await this.one<{ id: string }>(
      `INSERT INTO data_correction_requests (business_id, requested_by, issue_type, field, description, suggested_value, status, reviewer_id,
                                             review_started_at, resolution_note, resolved_by, resolved_at, version, created_at, updated_at)
       VALUES ($1, $2, 'Wrong category', 'category', $3, $4, 'resolved', $5, $6, $7, $5, $8, 3, $9, $8) RETURNING id`,
      [businessId, omar.id, 'It is a sweets shop and café, not "Other".', fixed, karim.id, new Date(resolvedAt.getTime() - 10 * MIN), 'Category updated.', resolvedAt, submittedAt]
    );
    this.count('data_correction_requests');
    await this.audit(submittedAt, omar, { eventName: 'data_correction_request.submitted', entityType: 'data_correction_request', entityId: r.id, payload: { businessId, issueType: 'Wrong category' } });
    await this.db.query(`UPDATE businesses SET category_id = $2, updated_by = $3, updated_at = $4, version = version + 1 WHERE id = $1`, [businessId, this.categoryId(fixed), karim.id, resolvedAt]);
    await this.db.query(
      `INSERT INTO business_edit_history (business_id, change_kind, field, before_value, after_value, changed_by, changed_at, correction_request_id)
       VALUES ($1, 'updated', 'category', $2, $3, $4, $5, $6)`,
      [businessId, JSON.stringify(b.category), JSON.stringify(fixed), karim.id, resolvedAt, r.id]
    );
    this.count('business_edit_history');
    await this.audit(resolvedAt, karim, { eventName: 'business.updated', entityType: 'business', entityId: businessId, before: { category: b.category }, after: { category: fixed }, payload: { correctionId: r.id } });
    await this.audit(resolvedAt, karim, { eventName: 'data_correction_request.resolved', entityType: 'data_correction_request', entityId: r.id, payload: { businessId } });
    this.mark(omar, submittedAt);
    this.mark(karim, resolvedAt);
  }

  /** Maya reports a wrong number after her last call; it waits in the Data Entry queue (open = R6). */
  private async openPhoneCorrection(businessId: string, maya: Person) {
    const { rows } = await this.db.query<{ last: Date }>('SELECT max(attempted_at) AS last FROM call_attempts WHERE business_id = $1', [businessId]);
    const submittedAt = new Date(rows[0].last.getTime() + 6 * MIN);
    const r = await this.one<{ id: string }>(
      `INSERT INTO data_correction_requests (business_id, requested_by, issue_type, field, description, suggested_value, created_at, updated_at)
       VALUES ($1, $2, 'Incorrect phone', 'phones', $3, $4, $5, $5) RETURNING id`,
      [businessId, maya.id, 'The number rings at a private home; the garage moved to a new line according to a neighbour.', '+961 01 555 121', submittedAt]
    );
    this.count('data_correction_requests');
    await this.audit(submittedAt, maya, { eventName: 'data_correction_request.submitted', entityType: 'data_correction_request', entityId: r.id, payload: { businessId, issueType: 'Incorrect phone' } });
    this.mark(maya, submittedAt);
    this.live.push({ name: 'data_correction_request.submitted', aggregateType: 'data_correction_request', aggregateId: r.id, payload: { businessId } });
  }

  // -------------------------------------------------------------------------------------------
  // Attendance (after every other activity, so sessions cover the work of the day)
  // -------------------------------------------------------------------------------------------

  async seedAttendance() {
    const staff: [PersonKey, string][] = [
      ['karim', 'data_entry'],
      ['maya', 'call_center'],
      ['omar', 'call_center'],
      ['lina', 'developer'],
      ['sami', 'developer'],
    ];
    const days = this.cal.pastDays(33);
    const special = { correction: days[2], provisional: days[4], remote: days[6] };
    const owner = this.people.owner;

    // Remote day for Lina (granted by the Owner the day before).
    const lina = this.people.lina;
    const grantedAt = at(addDays(special.remote, -1), 16 * 60 + 10);
    const remote = await this.one<{ id: string }>(
      `INSERT INTO remote_exceptions (employee_id, start_date, end_date, status, reason, requested_by, decided_by, decided_at, created_at, updated_at)
       VALUES ($1, $2, $2, 'granted', 'Working from home: internet installation visit', $3, $3, $4, $4, $4) RETURNING id`,
      [lina.id, special.remote, owner.id, grantedAt]
    );
    this.count('remote_exceptions');
    await this.audit(grantedAt, owner, { eventName: 'attendance.remote_exception_granted', entityType: 'remote_exception', entityId: remote.id, payload: { employeeId: lina.id, startDate: special.remote, endDate: special.remote } });

    for (const [key] of staff) {
      const person = this.people[key];
      const worked = this.activity.get(person.id) ?? new Map<string, number[]>();
      const free = days.filter((d, i) => i >= 8 && !worked.has(d));
      const absent = new Set<string>();
      for (let n = key === 'sami' ? 2 : 1; n > 0 && free.length; n--) absent.add(free.splice(this.rng.int(0, free.length - 1), 1)[0]);

      for (const date of days) {
        if (absent.has(date)) continue;
        const kind =
          key === 'maya' && date === special.correction ? 'late_correction'
            : key === 'omar' && date === special.provisional ? 'provisional'
              : key === 'lina' && date === special.remote ? 'remote'
                : 'normal';
        await this.seedSession(person, key, date, worked.get(date) ?? [], kind, kind === 'remote' ? remote.id : null);
      }
      // Today: everyone but Sami is in (Sami is the "not checked in yet" example).
      if (this.cal.todayWorking && this.cal.nowMinute >= 9 * 60 + 30 && key !== 'sami') {
        await this.seedSession(person, key, this.cal.today, worked.get(this.cal.today) ?? [], 'today', null);
      }
    }
  }

  private summaryFor(key: PersonKey, work: number): string {
    if (key === 'maya' || key === 'omar') {
      return work > 0 ? `Called ${work} business${work === 1 ? '' : 'es'} from my queue; logged outcomes and scheduled follow-ups.` : 'Prepared call lists and reviewed follow-ups for the coming days.';
    }
    if (key === 'karim') return work > 0 ? `Added ${work} new business record${work === 1 ? '' : 's'} and checked phone numbers.` : 'Verified directory entries and cleaned up categories.';
    return work > 0 ? 'Worked on client project tasks and recorded deal updates.' : 'Worked on client project tasks and internal tooling.';
  }

  private async seedSession(person: Person, key: PersonKey, date: string, work: number[], kind: 'normal' | 'late_correction' | 'provisional' | 'remote' | 'today', remoteId: string | null) {
    const first = work.length ? Math.min(...work) : null;
    const lastWork = work.length ? Math.max(...work) : null;
    const late = kind === 'late_correction' || (kind === 'normal' && this.rng.chance(0.12));
    let checkIn = at(date, late ? this.rng.int(9 * 60 + 12, 9 * 60 + 33) : this.rng.int(8 * 60 + 38, 9 * 60 + 8), this.rng.int(0, 59));
    if (first !== null && checkIn.getTime() >= first) checkIn = new Date(first - this.rng.int(6, 20) * MIN);
    if (kind === 'today') {
      const latest = this.cal.now.getTime() - 5 * MIN;
      if (checkIn.getTime() > latest) checkIn = new Date(latest);
    }
    const open = kind === 'today' && this.cal.nowMinute < 18 * 60 + 30;
    let checkOut: Date | null = open ? null : at(date, this.rng.int(17 * 60 + 35, 18 * 60 + 20), this.rng.int(0, 59));
    if (checkOut && lastWork !== null && checkOut.getTime() <= lastWork) checkOut = new Date(lastWork + this.rng.int(8, 25) * MIN);

    const verification = kind === 'remote' ? { result: 'remote', mode: 'ip', ip: '198.51.100.23' } : { result: 'passed', mode: 'ip', ip: OFFICE_IP };
    const failedOut = { result: 'failed', mode: 'ip', ip: '203.0.113.45' };
    const state = open ? 'open' : kind === 'provisional' ? 'closed_provisional' : 'closed';
    const s = await this.one<{ id: string }>(
      `INSERT INTO attendance_sessions (employee_id, state, origin, work_date, check_in_at, check_out_at, checkout_attempted_at, effective_check_in_at,
                                        effective_check_out_at, remote, remote_exception_id, check_in_verification, check_out_verification,
                                        checkout_failure_reason, summary_work_completed, summary_outstanding, settings_version_id, version, created_at, updated_at)
       VALUES ($1, $2, 'check_in', $3, $4, $5, $6, $4, $5, $7, $8, $9, $10, $11, $12, $13, $14, $15, $4, $16)
       RETURNING id`,
      [person.id, state, date, checkIn, checkOut, kind === 'provisional' ? checkOut : null, kind === 'remote', remoteId,
        JSON.stringify(verification), checkOut ? JSON.stringify(kind === 'provisional' ? failedOut : verification) : null,
        kind === 'provisional' ? 'office_check_failed' : null, checkOut ? this.summaryFor(key, work.length) : null,
        checkOut && this.rng.chance(0.3) ? 'Two follow-ups to prepare for tomorrow' : null, this.settingsVersionId, checkOut ? 2 : 1, checkOut ?? checkIn]
    );
    this.count('attendance_sessions');
    await this.audit(checkIn, person, { eventName: 'attendance.checked_in', entityType: 'attendance_session', entityId: s.id, after: { state: 'open', checkInAt: checkIn.toISOString(), workDate: date, verification: verification.result, mode: 'ip', remote: kind === 'remote' } });

    // No break rows (policy baseline 2026-10-29, fixed v1 scope "no break tracking"; the tables stay).

    if (checkOut) {
      const event = kind === 'provisional' ? 'attendance.checkout_provisional' : 'attendance.checked_out';
      await this.audit(checkOut, person, {
        eventName: event,
        entityType: 'attendance_session',
        entityId: s.id,
        before: { state: 'open', effectiveCheckInAt: checkIn.toISOString(), effectiveCheckOutAt: null, checkOutUnknown: false, version: 1 },
        after: { state, checkOutAt: checkOut.toISOString(), verification: kind === 'provisional' ? 'failed' : verification.result, mode: 'ip' },
      });
    }
    if (kind === 'provisional') {
      // DEC-026 default `provisional`: closed at the attempted time, waiting in the Owner review queue.
      this.live.push({ name: 'attendance.checkout_provisional', aggregateType: 'attendance_session', aggregateId: s.id, payload: { sessionId: s.id, employeeId: person.id } });
    }
    if (kind === 'late_correction') {
      const proposed = at(date, 8 * 60 + 52);
      const submittedAt = new Date(checkOut!.getTime() + 3 * MIN);
      const c = await this.one<{ id: string }>(
        `INSERT INTO attendance_corrections (session_id, employee_id, kind, status, proposed_check_in_at, previous_check_in_at, previous_check_out_at,
                                             reason, created_by, created_at, updated_at)
         VALUES ($1, $2, 'request', 'submitted', $3, $4, $5, $6, $2, $7, $7) RETURNING id`,
        [s.id, person.id, proposed, checkIn, checkOut, 'Arrived at 08:52 but the office Wi-Fi was down, so the check-in only went through later.', submittedAt]
      );
      this.count('attendance_corrections');
      await this.audit(submittedAt, person, { eventName: 'attendance_correction.submitted', entityType: 'attendance_correction', entityId: c.id, after: { status: 'submitted', sessionId: s.id, proposedCheckInAt: proposed.toISOString() } });
      this.live.push({ name: 'attendance_correction.submitted', aggregateType: 'attendance_correction', aggregateId: c.id, payload: { correctionId: c.id, employeeId: person.id } });
    }
  }

  // -------------------------------------------------------------------------------------------
  // Targets, work items, outbox
  // -------------------------------------------------------------------------------------------

  async seedTargets() {
    const owner = this.people.owner;
    const today = this.cal.today;
    const [y, m] = today.split('-').map(Number);
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthEnd = addDays(`${new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)}-01`, -1);
    const weekday = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].indexOf(weekdayOf(today));
    const weekStart = addDays(today, -weekday);
    const weekEnd = addDays(weekStart, 6);
    const q = Math.floor((m - 1) / 3);
    const quarterStart = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
    const quarterEnd = addDays(q === 3 ? `${y + 1}-01-01` : `${y}-${String(q * 3 + 4).padStart(2, '0')}-01`, -1);
    const range = (from: string, to: string) => [at(from, 0), at(addDays(to, 1), 0)];

    const calls = async (who: Person, from: string, to: string) =>
      Number((await this.one<{ n: string }>('SELECT count(*) AS n FROM call_attempts WHERE agent_id = $1 AND attempted_at >= $2 AND attempted_at < $3', [who.id, ...range(from, to)])).n);
    const contacted = async (who: Person, from: string, to: string) =>
      Number((await this.one<{ n: string }>('SELECT count(DISTINCT business_id) AS n FROM call_attempts WHERE agent_id = $1 AND attempted_at >= $2 AND attempted_at < $3', [who.id, ...range(from, to)])).n);
    const entries = async (who: Person, from: string, to: string) =>
      Number((await this.one<{ n: string }>('SELECT count(*) AS n FROM businesses WHERE created_by = $1 AND created_at >= $2 AND created_at < $3', [who.id, ...range(from, to)])).n);
    const closed = async (who: Person, from: string, to: string) =>
      Number((await this.one<{ n: string }>(`SELECT count(*) AS n FROM deals WHERE assigned_developer_id = $1 AND stage = 'closed' AND closed_at >= $2 AND closed_at < $3`, [who.id, ...range(from, to)])).n);

    const p = this.people;
    const targets: [Person, string, string, number, number, string, string, string | null][] = [
      [p.maya, 'outreach_calls', 'monthly', 60, await calls(p.maya, monthStart, monthEnd), monthStart, monthEnd, 'Beirut, Metn & South'],
      [p.omar, 'outreach_calls', 'monthly', 60, await calls(p.omar, monthStart, monthEnd), monthStart, monthEnd, 'Kesrouan, North & Bekaa'],
      [p.maya, 'businesses_contacted', 'weekly', 10, await contacted(p.maya, weekStart, weekEnd), weekStart, weekEnd, 'Beirut, Metn & South'],
      [p.omar, 'businesses_contacted', 'weekly', 10, await contacted(p.omar, weekStart, weekEnd), weekStart, weekEnd, 'Kesrouan, North & Bekaa'],
      [p.karim, 'data_entries', 'monthly', 30, await entries(p.karim, monthStart, monthEnd), monthStart, monthEnd, null],
      [p.lina, 'closed_deals', 'quarterly', 3, await closed(p.lina, quarterStart, quarterEnd), quarterStart, quarterEnd, null],
      [p.sami, 'closed_deals', 'quarterly', 3, await closed(p.sami, quarterStart, quarterEnd), quarterStart, quarterEnd, null],
    ];
    for (const [who, metric, period, target, current, start, end, territory] of targets) {
      const createdAt = new Date(Math.min(at(start, 8 * 60 + 30).getTime(), this.cal.now.getTime() - 3600_000));
      const t = await this.one<{ id: string }>(
        `INSERT INTO targets (employee_id, metric, period, target_value, current_value, start_date, end_date, territory, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING id`,
        [who.id, metric, period, target, current, start, end, territory, createdAt]
      );
      this.count('targets');
      await this.audit(createdAt, owner, { eventName: 'target.assigned', entityType: 'target', entityId: t.id, after: { employeeId: who.id, metric, period, targetValue: target, territory } });
    }
  }

  async seedWorkItems() {
    const p = this.people;
    const items: [Person, string, string | null, 'open' | 'in_progress' | 'completed', Date | null][] = [
      [p.karim, 'Verify phone numbers for Bekaa businesses', 'Call or visit to confirm the landlines added this month.', 'in_progress', at(this.cal.future(2), 17 * 60)],
      [p.karim, 'Add Batroun beach venues from the summer list', 'Twelve venues from the Owner\'s list; check for duplicates first.', 'open', at(this.cal.future(5), 17 * 60)],
      [p.maya, 'Prepare notes for the Saida Castle View Café discovery meeting', 'Menu, reservations and Google Maps listing questions.', 'open', at(this.cal.future(2), 10 * 60)],
      [p.sami, 'Collect logo and brand colours from Kaslik Fashion House', null, 'completed', at(this.cal.day(2), 16 * 60)],
    ];
    for (const [who, title, description, status, due] of items) {
      const createdAt = at(this.cal.day(4), 9 * 60 + 15);
      const w = await this.one<{ id: string }>(
        `INSERT INTO work_items (assignee_id, title, description, status, due_date, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [who.id, title, description, status, due, status === 'open' ? 1 : 2, createdAt, status === 'completed' ? due : createdAt]
      );
      this.count('work_items');
      await this.audit(createdAt, p.owner, { eventName: 'work_item.created', entityType: 'work_item', entityId: w.id, after: { assigneeId: who.id, title, status: 'open' } });
    }
  }

  async emitLive() {
    for (const e of this.live) {
      await insertOutboxEvent(this.db, e, this.cal.now);
      this.count('outbox_events');
    }
  }

  report(): Counts {
    return this.counts;
  }
}

export async function seedDemo(): Promise<void> {
  assertSeedAllowed(process.env.NODE_ENV);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const seeder = new DemoSeeder(client, new Date());
    if (await seeder.alreadySeeded()) {
      await client.query('ROLLBACK');
      console.log(`ℹ️  Demo data already present (found "${MARKER.name}, ${MARKER.branch}"); nothing to do.`);
      return;
    }
    console.log('🌱 Seeding demo data (fictional businesses, Asia/Beirut company time)...');
    await seeder.loadPeople();
    await seeder.ensureSettings();
    await seeder.ensureCategories();
    await seeder.seedBusinesses();
    await seeder.seedAttendance();
    await seeder.seedTargets();
    await seeder.seedWorkItems();
    await seeder.emitLive();
    await client.query('COMMIT');
    const counts = seeder.report();
    console.log('✅ Demo data committed. Rows written per table:');
    for (const [table, n] of Object.entries(counts).sort()) console.log(`   ${table.padEnd(32)} ${n}`);
    console.log('   Logins are unchanged (src/db/seed.ts accounts).');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('❌ Demo seed failed; nothing was written:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDemo()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      // Transaction failures are logged inside seedDemo; the production refusal happens before it.
      if (err instanceof SeedRefusedError) console.error(`❌ ${err.message.replace('seed.ts', 'seed-demo.ts')}`);
      await pool.end();
      process.exit(1);
    });
}
