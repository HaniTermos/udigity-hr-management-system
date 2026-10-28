-- 900_access_facts_v1.sql — MOD-access (BE2). Access-facts view, revision 1 (plan.md §5, arch-b AR-06).
-- Read-only. One row per business with every fact the engine's steps 5–8 read. Nothing writes
-- through it. This is the single documented cross-module read (ADR-006 amendment).
--
-- Revision 1 joins only the tables that exist in Increment 2 (employees, businesses). The columns
-- fed by calling (BE3: calling_assignments, business_calling_states, follow_ups), delivery
-- (BE4: deals, deal_developer_assignments, projects, project_developer_assignments) and
-- corrections (BE2, Inc 3: data_correction_requests) are typed NULL / FALSE placeholders here.
-- Each later revision (901, 902, …) replaces the view with the real joins when those tables land.
-- The COLUMN SET below is the contract: the engine and its tests depend on exactly these names
-- and types. Do not rename a column; add new ones at the end.

CREATE OR REPLACE VIEW access_facts AS
SELECT
  b.id                                   AS business_id,
  b.created_by                           AS created_by,
  b.created_at                           AS created_at,
  b.archived_at                          AS archived_at,
  -- DEC-001 Alt B basis input: max(created_at, business_calling_states.last_touchpoint_at) (BE3)
  NULL::timestamptz                      AS last_touchpoint_at,
  -- current calling assignee (BE3 calling_assignments, active row)
  NULL::uuid                             AS assignee_id,
  -- open follow-up (BE3 follow_ups, at most one open per business, B3-Q04)
  NULL::uuid                             AS open_follow_up_responsible_id,
  NULL::timestamptz                      AS open_follow_up_at,
  -- open deal (BE4 deals; stage values: 'accepted_opportunity' … 'closed', 'not_proceeding')
  NULL::uuid                             AS deal_id,
  NULL::varchar                          AS deal_stage,
  ARRAY[]::uuid[]                        AS deal_developer_ids,
  -- project of the closed deal (BE4 projects; status 'completed' is terminal)
  NULL::uuid                             AS project_id,
  NULL::varchar                          AS project_status,
  ARRAY[]::uuid[]                        AS project_developer_ids,
  NULL::timestamptz                      AS project_completed_at,
  -- open data-correction request flag (BE2 data_correction_requests, Inc 3)
  FALSE                                  AS has_open_correction
FROM businesses b;
