-- 903_access_facts_v4.sql — MOD-access (BE2). Access-facts view, revision 4 (BL-15, BE4-R4 contract).
-- Change from v3 (902): the delivery facts now read BE4's tables (migrations 400/420) instead of typed
-- placeholders. Calling facts, column set, order and types are unchanged.
--   deal_id, deal_stage, deal_developer_ids  ← deals: the business's open deal, else its latest closed one
--                                              (not_proceeding rows excluded). deal_stage is 'closed' for a
--                                              closed deal and 'accepted_opportunity' for every open stage.
--   project_id, project_status,
--   project_developer_ids, project_completed_at ← projects: the non-completed project, else the latest one;
--                                              developer ids = current project_developer_assignments rows.

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
  dl.id                                  AS deal_id,
  dl.stage_literal::varchar              AS deal_stage,
  COALESCE(dl.developer_ids, ARRAY[]::uuid[]) AS deal_developer_ids,
  pr.id                                  AS project_id,
  pr.status::varchar                     AS project_status,
  COALESCE(pr.developer_ids, ARRAY[]::uuid[]) AS project_developer_ids,
  pr.completed_at                        AS project_completed_at,
  EXISTS (
    SELECT 1 FROM data_correction_requests r
     WHERE r.business_id = b.id AND r.status IN ('submitted', 'in_review')
  )                                      AS has_open_correction
FROM businesses b
LEFT JOIN business_calling_states bcs ON bcs.business_id = b.id
LEFT JOIN calling_assignments ca ON ca.business_id = b.id AND ca.ended_at IS NULL
LEFT JOIN follow_ups fu ON fu.business_id = b.id AND fu.state = 'scheduled'
LEFT JOIN LATERAL (
  SELECT d.id,
         CASE WHEN d.stage = 'closed' THEN 'closed' ELSE 'accepted_opportunity' END AS stage_literal,
         CASE WHEN d.assigned_developer_id IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[d.assigned_developer_id] END AS developer_ids
    FROM deals d
   WHERE d.business_id = b.id AND d.stage <> 'not_proceeding'
   ORDER BY (d.stage = 'closed') ASC, d.closed_at DESC NULLS LAST, d.created_at DESC
   LIMIT 1) dl ON TRUE
LEFT JOIN LATERAL (
  SELECT p.id, p.status, p.completed_at,
         ARRAY(SELECT pda.developer_id FROM project_developer_assignments pda
                WHERE pda.project_id = p.id AND pda.unassigned_at IS NULL ORDER BY pda.developer_id) AS developer_ids
    FROM projects p
   WHERE p.business_id = b.id
   ORDER BY (p.status = 'completed') ASC, p.created_at DESC
   LIMIT 1) pr ON TRUE;
