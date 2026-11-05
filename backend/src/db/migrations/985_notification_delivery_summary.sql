-- 985_notification_delivery_summary.sql — MOD-notifications (D18 v1 policy). Forward-only, additive.
-- In-app digests and the grouped delivery-failure alert carry a small counts-only summary, e.g.
-- {"date":"2026-10-29","dueToday":3} or {"group":"delivery:security.password_reset","count":4}.
-- Ids and counts only: no names, phones or notes (content is still built when the inbox is read).
ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS summary JSONB;

-- D18 "deduplicate repeated alerts": the open (unread) failure alert of an Owner is looked up per group.
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_open_failure
  ON notification_deliveries (recipient_id, created_at)
  WHERE template = 'business.delivery_failure' AND channel = 'in_app' AND read_at IS NULL;
