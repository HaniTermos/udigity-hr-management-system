-- 902_access_facts_v3.sql — MOD-access (BE2). Access-facts view, revision 3 (BE2-R2, calling facts).
-- Change from v2: the calling facts now read BE3's tables (migrations 300/310/340):
--   assignee_id                    ← calling_assignments, the open row (ended_at IS NULL; one per business)
--   last_touchpoint_at             ← business_calling_states.last_touchpoint_at (DEC-001 Alt B input)
--   open_follow_up_responsible_id,
--   open_follow_up_at              ← follow_ups, the scheduled row (state = 'scheduled'; one per business, B3-Q04)
-- Delivery facts (BE4) stay typed placeholders until 400/420 are applied. Column set and order unchanged.

CREATE OR REPLACE VIEW access_facts AS
SELECT
  b.id                                   AS business_id,
  b.created_by                           AS created_by,
  b.created_at                           AS created_at,
  b.archived_at                          AS archived_at,
  bcs.last_touchpoint_at                 AS last_touchpoint_at,
  ca.assignee_id                         AS assignee_id,
  fu.responsible_id                      AS open_follow_up_responsible_id,
  fu.scheduled_for                       AS open_follow_up_at,
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
FROM businesses b
LEFT JOIN business_calling_states bcs ON bcs.business_id = b.id
LEFT JOIN calling_assignments ca ON ca.business_id = b.id AND ca.ended_at IS NULL
LEFT JOIN follow_ups fu ON fu.business_id = b.id AND fu.state = 'scheduled';
