-- 987_deals_commercial_policy_v1.sql — MOD-deals (BE4). Approved v1 policy (docs/policy-baseline-2026-10-29.md §D16).
-- Forward-only, additive. No row is changed or removed; every replaced CHECK accepts every row the old one did,
-- except the closure-evidence check below, which is added NOT VALID when legacy rows would fail it (no data loss).
--   * stages: + meeting_scheduled, proposal_sent (accepted → meeting scheduled → proposal sent → signed →
--     payment pending verification → verified closed; forward skips allowed). The one-open-deal index already
--     reads `stage NOT IN ('closed','not_proceeding')`, so the new stages are open stages there too.
--   * signed fact = the agreement reference (signature date optional). Closure evidence = agreement reference
--     + payment date (payment reference optional).
--   * contract amount/currency (nullable; currency required when an amount exists). Missing is never zero.
--   * deal_changes: + stage_advanced, contract_updated, financial_corrected (prior values kept in before_value).

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;
ALTER TABLE deals ADD CONSTRAINT deals_stage_check CHECK (stage IN
  ('accepted_opportunity','meeting_scheduled','proposal_sent','signed','paid','signed_and_paid','closed','not_proceeding'));

ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_amount NUMERIC(14,2)
  CONSTRAINT deals_contract_amount_check CHECK (contract_amount IS NULL OR contract_amount >= 0);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_currency VARCHAR(3);
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_contract_amount_needs_currency;
ALTER TABLE deals ADD CONSTRAINT deals_contract_amount_needs_currency
  CHECK (contract_amount IS NULL OR contract_currency IS NOT NULL);

-- Signed stages: the agreement reference is the signature fact (a legacy row with only a date still passes).
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_signed_has_fact;
ALTER TABLE deals ADD CONSTRAINT deals_signed_has_fact
  CHECK (stage NOT IN ('signed','signed_and_paid') OR signature_reference IS NOT NULL OR signature_date IS NOT NULL);

-- Closure evidence (D16): agreement reference + payment date; signature date and payment reference optional.
-- Rows closed before this policy were closed with a signature date; if any lacks a reference the check is
-- added NOT VALID (enforced for every new or updated row, existing rows kept as they are).
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_closed_needs_both;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_closed_evidence;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM deals WHERE stage = 'closed' AND signature_reference IS NULL) THEN
    ALTER TABLE deals ADD CONSTRAINT deals_closed_evidence CHECK (
      stage <> 'closed' OR (signature_reference IS NOT NULL AND payment_date IS NOT NULL AND closed_at IS NOT NULL AND closed_by_id IS NOT NULL)
    ) NOT VALID;
  ELSE
    ALTER TABLE deals ADD CONSTRAINT deals_closed_evidence CHECK (
      stage <> 'closed' OR (signature_reference IS NOT NULL AND payment_date IS NOT NULL AND closed_at IS NOT NULL AND closed_by_id IS NOT NULL)
    );
  END IF;
END $$;

ALTER TABLE deal_changes DROP CONSTRAINT IF EXISTS deal_changes_change_type_check;
ALTER TABLE deal_changes ADD CONSTRAINT deal_changes_change_type_check CHECK (change_type IN
  ('signature_recorded','payment_recorded','fact_removed','handoff_updated','not_proceeding','reopened','closed',
   'stage_advanced','contract_updated','financial_corrected'));
