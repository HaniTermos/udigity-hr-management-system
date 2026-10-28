-- 901_access_facts_v2.sql — MOD-access (BE2). Access-facts view, revision 2.
-- Change from v1: `has_open_correction` now reads data_correction_requests (migration 202): TRUE while the
-- business has a Submitted or In review request (DEC-002 row 6). Column set and order unchanged (contract).
-- Calling (BE3) and delivery (BE4) facts stay typed placeholders until their tables are applied (BE2-R2).

CREATE OR REPLACE VIEW access_facts AS
SELECT
  b.id                                   AS business_id,
  b.created_by                           AS created_by,
  b.created_at                           AS created_at,
  b.archived_at                          AS archived_at,
  NULL::timestamptz                      AS last_touchpoint_at,
  NULL::uuid                             AS assignee_id,
  NULL::uuid                             AS open_follow_up_responsible_id,
  NULL::timestamptz                      AS open_follow_up_at,
  NULL::uuid                             AS deal_id,
  NULL::varchar                          AS deal_stage,
  ARRAY[]::uuid[]                        AS deal_developer_ids,
  NULL::uuid                             AS project_id,
  NULL::varchar                          AS project_status,
  ARRAY[]::uuid[]                        AS project_developer_ids,
  NULL::timestamptz                      AS project_completed_at,
  EXISTS (
    SELECT 1 FROM data_correction_requests r
     WHERE r.business_id = b.id AND r.status IN ('submitted', 'in_review')
  )                                      AS has_open_correction
FROM businesses b;
