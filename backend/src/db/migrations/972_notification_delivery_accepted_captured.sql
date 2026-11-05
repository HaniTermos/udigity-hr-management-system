-- 972_notification_delivery_accepted_captured.sql — MOD-notifications (FX-MAIL). Forward-only, additive:
-- the delivery state set gains two e-mail outcomes so nothing over-claims delivery.
--   * accepted: the SMTP provider accepted the message (250). Not proof of delivery; no bounce tracking in v1.
--   * captured: a non-network transport (log / test memory sink) took the message. Never delivered to anyone.
-- 'sent' stays for in-app rows (delivered by being written) and for e-mail rows written before this migration.
DO $$
DECLARE
  ck text;
BEGIN
  FOR ck IN
    SELECT c.conname FROM pg_constraint c
     WHERE c.conrelid = 'notification_deliveries'::regclass AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) LIKE '%state%' AND pg_get_constraintdef(c.oid) LIKE '%retry_pending%'
  LOOP
    EXECUTE format('ALTER TABLE notification_deliveries DROP CONSTRAINT %I', ck);
  END LOOP;
  ALTER TABLE notification_deliveries
    ADD CONSTRAINT notification_deliveries_state_check
    CHECK (state IN ('pending', 'retry_pending', 'sent', 'accepted', 'captured', 'failed', 'suppressed', 'skipped'));
END $$;
