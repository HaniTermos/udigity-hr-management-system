/**
 * MOD-access — repository. Owner: BE2.
 * Reads ONLY the access_facts view (migrations 900–949). No writes.
 */
import type { Queryable } from '../../db/pool.js';
import type { ExceptionRow } from '../../shared/access.js';
import type { SqlParams } from '../../shared/sql.js';
import { EXCEPTION_ROWS, type RuleFragments } from './rules.js';

export interface DecisionRow {
  business_id: string;
  /** False when the business is archived and the principal is not the Owner (D9/D20). */
  live: boolean;
  in_scope: boolean;
  related: boolean;
  in_window: boolean;
  rows: Record<ExceptionRow, boolean>;
}

interface RawRow {
  business_id: string;
  live: boolean | null;
  in_scope: boolean;
  related: boolean;
  in_window: boolean;
  r1: boolean;
  r2: boolean;
  r3: boolean;
  r4: boolean;
  r5: boolean;
  r6: boolean;
}

/**
 * Evaluate the rule fragments for a set of businesses in one round trip. The fragments are the
 * same text `scopeFilter` emits, selected as columns so `check` can name the failing step.
 */
export async function fetchDecisionRows(
  db: Queryable,
  businessIds: readonly string[],
  fr: RuleFragments,
  params: SqlParams
): Promise<Map<string, DecisionRow>> {
  const ids = params.add(businessIds);
  const cols = EXCEPTION_ROWS.map((r, i) => `COALESCE(${fr.rows[r]}, FALSE) AS r${i + 1}`).join(', ');
  const { rows } = await db.query<RawRow>(
    `SELECT af.business_id,
            COALESCE(${fr.live}, FALSE) AS live,
            COALESCE(${fr.scope}, FALSE) AS in_scope,
            COALESCE(${fr.relation}, FALSE) AS related,
            COALESCE(${fr.window}, FALSE) AS in_window,
            ${cols}
       FROM access_facts af
      WHERE af.business_id = ANY(${ids}::uuid[])`,
    params.values
  );
  const out = new Map<string, DecisionRow>();
  for (const r of rows) {
    out.set(r.business_id, {
      business_id: r.business_id,
      // Scripted fact rows in unit tests may omit the column: absent = live.
      live: r.live !== false,
      in_scope: r.in_scope,
      related: r.related,
      in_window: r.in_window,
      rows: {
        R1_ACCEPTED_OPPORTUNITY: r.r1,
        R2_CLOSED_DEAL: r.r2,
        R3_ACTIVE_PROJECT: r.r3,
        R4_COMPLETED_PROJECT: r.r4,
        R5_SCHEDULED_CALLBACK: r.r5,
        R6_OPEN_CORRECTION: r.r6,
      },
    });
  }
  return out;
}
