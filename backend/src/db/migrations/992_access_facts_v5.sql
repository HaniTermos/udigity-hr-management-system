-- 992_access_facts_v5.sql — MOD-access (BE2). Access-facts view, revision 5.
-- Approved v1 policy (docs/policy-baseline-2026-10-29.md §D9, §D15, §D17). Additive only: the 16 columns of
-- revision 4 (903) keep their names, order and types; two columns are appended at the end.
--   assignment_started_at          ← calling_assignments.started_at of the CURRENT assignment (ended_at IS NULL).
--                                    D9: the Call Center window is 15 elapsed days from assignment, and a
--                                    reassignment starts the new agent's window (the old row is ended).
--   open_correction_requester_ids  ← requesters of the business's open correction requests (submitted / in_review).
--                                    D9: the requester keeps context access while the request is open.
-- Body change: the project lateral now prefers a project that is neither completed nor cancelled (988 adds
-- 'cancelled'); a cancelled project is never "active" for the rule table.

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
  )                                      AS has_open_correction,
  ca.started_at                          AS assignment_started_at,
  ARRAY(
    SELECT DISTINCT r.requested_by FROM data_correction_requests r
     WHERE r.business_id = b.id AND r.status IN ('submitted', 'in_review')
     ORDER BY r.requested_by
  )                                      AS open_correction_requester_ids
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
   ORDER BY (p.status IN ('completed', 'cancelled')) ASC, (p.status = 'cancelled') ASC, p.created_at DESC
   LIMIT 1) pr ON TRUE;
