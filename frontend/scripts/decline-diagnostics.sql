-- WHERE recent payment failures died. Read-only; run through
-- `make decline-diagnostics`, which substitutes the window for __DAYS__.
--
-- `stage` is read off the latest charge's outcome.network_status:
--
--   issuer_declined          declined_by_network — the issuer or card network
--                            said no. decline_code / network_decline_code /
--                            network_advice_code say why and whether to retry.
--   blocked_by_stripe_radar  not_sent_to_network + outcome_type 'blocked' —
--                            Radar stopped it; no bank ever saw it. outcome_reason
--                            (highest_risk_level, rule, …), risk_level and
--                            risk_score say why.
--   not_sent_to_network      not sent for another reason (outcome_type 'invalid').
--   reversed_after_approval  the issuer approved it and Stripe blocked it after.
--   approved_then_failed     approved_by_network, yet the invoice still failed.
--   no_charge_attempted      a PaymentIntent but no charge: 3-D Secure not
--                            completed, or no usable payment method. See
--                            payment_intent_status and pi_error_code.
--   lookup_failed            Stripe could not be read at capture time; see
--                            diagnostic_error. Whatever was obtained is on the row.
--   not_captured             recorded before these columns existed.
--
-- Counting: every Smart Retry attempt is its own row, so `attempts` exceeds
-- `invoices`. Judge money by invoice, never by attempt.

SELECT CASE
         WHEN network_status = 'declined_by_network' THEN 'issuer_declined'
         WHEN network_status = 'not_sent_to_network' AND outcome_type = 'blocked' THEN 'blocked_by_stripe_radar'
         WHEN network_status = 'not_sent_to_network' THEN 'not_sent_to_network'
         WHEN network_status = 'reversed_after_approval' THEN 'reversed_after_approval'
         WHEN network_status = 'approved_by_network' THEN 'approved_then_failed'
         WHEN network_status IS NOT NULL THEN network_status
         WHEN payment_intent_id IS NOT NULL AND diagnostic_error IS NULL THEN 'no_charge_attempted'
         WHEN diagnostic_error IS NOT NULL THEN 'lookup_failed'
         ELSE 'not_captured'
       END AS stage,
       COALESCE(outcome_type, '-') AS outcome_type,
       COALESCE(outcome_reason, '-') AS outcome_reason,
       COUNT(*) AS attempts,
       COUNT(DISTINCT invoice_id) AS invoices
  FROM payment_declines
 WHERE failed_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-__DAYS__ days')
 GROUP BY 1, 2, 3
 ORDER BY attempts DESC;

SELECT substr(failed_at, 1, 16) AS failed_at,
       email,
       tier,
       cadence,
       kind,
       printf('%.2f', amount_due / 100.0) AS amount,
       attempt_count AS att,
       outcome,
       CASE
         WHEN network_status = 'declined_by_network' THEN 'issuer_declined'
         WHEN network_status = 'not_sent_to_network' AND outcome_type = 'blocked' THEN 'blocked_by_stripe_radar'
         WHEN network_status = 'not_sent_to_network' THEN 'not_sent_to_network'
         WHEN network_status = 'reversed_after_approval' THEN 'reversed_after_approval'
         WHEN network_status = 'approved_by_network' THEN 'approved_then_failed'
         WHEN network_status IS NOT NULL THEN network_status
         WHEN payment_intent_id IS NOT NULL AND diagnostic_error IS NULL THEN 'no_charge_attempted'
         WHEN diagnostic_error IS NOT NULL THEN 'lookup_failed'
         ELSE 'not_captured'
       END AS stage,
       network_status,
       outcome_type,
       outcome_reason,
       risk_level,
       risk_score,
       outcome_rule,
       category,
       failure_code,
       decline_code,
       network_decline_code,
       network_advice_code,
       advice_code,
       pi_error_type,
       pi_error_code,
       pi_error_decline_code,
       payment_intent_status,
       method_type,
       card_brand,
       card_network,
       card_last4,
       card_country,
       card_funding,
       card_cvc_check,
       card_postal_check,
       card_3ds_result,
       failure_message,
       pi_error_message,
       payment_intent_id,
       charge_id,
       invoice_id,
       source,
       diagnostic_error
  FROM payment_declines
 WHERE failed_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-__DAYS__ days')
 ORDER BY failed_at DESC, attempt_count DESC;
