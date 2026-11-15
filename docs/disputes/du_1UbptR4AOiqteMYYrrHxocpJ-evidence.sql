-- Evidence pull for dispute du_1UbptR4AOiqteMYYrrHxocpJ (annhuphamdinh@gmail.com).
-- READ-ONLY. Run on the server from the repo root:
--
--   sqlite3 -readonly /var/lib/zerogex/auth.db < docs/disputes/du_1UbptR4AOiqteMYYrrHxocpJ-evidence.sql > ~/dispute-du_1UbptR4A.txt
--
-- What each section is for is in du_1UbptR4AOiqteMYYrrHxocpJ.md, "Step 3".
-- The access-log section is written to be pasted into Stripe as it stands: one
-- line per action the customer took while signed in, with its IP. Rows written
-- by the system rather than the customer (webhook syncs, emails, manual
-- scripts) carry a label instead of an IP and are left out on purpose.

.timeout 15000
.headers off
.mode list

SELECT '== SUMMARY: annhuphamdinh@gmail.com, all times UTC ==';
SELECT 'Purchase (in-app upgrade to Pro): ' || replace(substr(created_at,1,19),'T',' ') || ' from IP ' || ip
  FROM audit_events
 WHERE user_id = 'user_60079f16044a7a158bd72190' AND type = 'billing_plan_switch_in_app'
 ORDER BY created_at LIMIT 1;
SELECT 'Purchase record as logged (check it says "money-back guarantee"): ' || message
  FROM audit_events
 WHERE user_id = 'user_60079f16044a7a158bd72190' AND type = 'billing_plan_switch_in_app'
 ORDER BY created_at LIMIT 1;
SELECT 'Sign-ins: ' || count(*) || ', first ' || ifnull(substr(min(created_at),1,10),'-') || ', last ' || ifnull(substr(max(created_at),1,10),'-')
  FROM audit_events
 WHERE user_id = 'user_60079f16044a7a158bd72190' AND type IN ('login_success','oauth_login');
SELECT 'API keys generated: ' || count(*) || ', first ' || ifnull(substr(min(created_at),1,10),'-') || ', last ' || ifnull(substr(max(created_at),1,10),'-')
  FROM audit_events
 WHERE user_id = 'user_60079f16044a7a158bd72190' AND type = 'api_key_generated';
SELECT 'Page views after the charge (from 2026-10-15 17:27): ' || count(*) || ' pages on ' || count(DISTINCT substr(created_at,1,10)) || ' different days, about ' || CAST(round(ifnull(sum(duration_ms),0)/60000.0) AS INTEGER) || ' minutes on screen, last ' || ifnull(replace(substr(max(created_at),1,16),'T',' '),'-')
  FROM page_view_events
 WHERE user_id = 'user_60079f16044a7a158bd72190' AND created_at >= '2026-10-15T17:27:25';
SELECT 'Money-back refund requests on file: ' || count(*)
  FROM money_back_refunds
 WHERE user_id = 'user_60079f16044a7a158bd72190' OR lower(email) = 'annhuphamdinh@gmail.com';

SELECT '';
SELECT '== ACCESS ACTIVITY LOG: account annhuphamdinh@gmail.com (user_60079f16044a7a158bd72190), all times UTC ==';
SELECT replace(substr(created_at,1,19),'T',' ') || ' - ' ||
       CASE
         WHEN type = 'register' THEN 'Account created'
         WHEN type = 'terms_accept' THEN 'Accepted the Terms of Service'
         WHEN type = 'email_verify_request' THEN 'Email verification requested'
         WHEN type = 'email_verify_success' THEN 'Email address verified'
         WHEN type = 'email_verify_repeat' THEN 'Email verification link opened again'
         WHEN type = 'login_success' THEN 'Signed in'
         WHEN type = 'oauth_login' THEN 'Signed in with Google'
         WHEN type = 'logout' THEN 'Signed out'
         WHEN type = 'password_set' THEN 'Set a password'
         WHEN type = 'password_reset_request' THEN 'Requested a password reset'
         WHEN type = 'password_reset_success' THEN 'Reset password'
         WHEN type = 'billing_checkout_started' THEN 'Started checkout'
         WHEN type = 'disclaimer_ack' THEN 'Acknowledged the platform disclaimer'
         WHEN type = 'basic_welcome_seen' THEN 'Acknowledged the Basic welcome screen'
         WHEN type = 'pro_welcome_seen' THEN 'Acknowledged the Pro welcome screen'
         WHEN type = 'billing_plan_switch_in_app' AND message LIKE 'Trial ended for paid switch%'
              AND instr(message, '(charged ') > 0 AND instr(message, ' today as quoted') > 0
           THEN 'Upgraded to Pro from inside the account and confirmed the charge of '
                || substr(message, instr(message, '(charged ') + 9,
                          instr(message, ' today as quoted') - instr(message, '(charged ') - 9)
                || ' ("Confirm and pay"). This is the disputed payment.'
         WHEN type = 'billing_plan_switch_in_app' THEN 'Changed plan from inside the account'
         WHEN type = 'api_key_generated' THEN 'Generated a Pro API key on the account page'
         WHEN type = 'billing_retention_offer_accepted' THEN 'Opened the cancellation screen and chose "Keep my access & apply 25% off"'
         WHEN type = 'billing_cancel_flow_submitted' THEN 'Submitted a cancellation'
         WHEN type = 'billing_cancel_reverted_in_app' THEN 'Undid a scheduled cancellation'
         WHEN type = 'payment_method_update' THEN 'Updated payment method'
         WHEN type = 'wall_alert_webhook_saved' THEN 'Set up a wall-alert webhook'
         WHEN type = 'wall_alert_webhook_removed' THEN 'Removed a wall-alert webhook'
         WHEN type = 'x_handle_update' THEN 'Updated profile'
         ELSE replace(type, '_', ' ')
       END
       || ' - ' || CASE WHEN ip = 'unknown' THEN 'IP not recorded' ELSE ip END
  FROM audit_events
 WHERE user_id = 'user_60079f16044a7a158bd72190'
   AND type NOT IN ('login_failure','password_reset_failure','email_verify_failure')
   AND (ip LIKE '%:%' OR ip GLOB '[0-9]*.[0-9]*.[0-9]*.[0-9]*' OR ip = 'unknown')
 ORDER BY created_at;

SELECT '';
SELECT '== PAGES VIEWED PER DAY while signed in to this account, all times UTC ==';
.headers on
.separator ' | '
SELECT substr(created_at,1,10) AS day, count(*) AS pages_viewed,
       CAST(round(sum(duration_ms)/60000.0) AS INTEGER) AS minutes_on_screen
  FROM page_view_events
 WHERE user_id = 'user_60079f16044a7a158bd72190'
 GROUP BY day ORDER BY day;
.headers off
SELECT '';
SELECT '== MOST-VIEWED PAGES ==';
.headers on
SELECT path, count(*) AS views
  FROM page_view_events
 WHERE user_id = 'user_60079f16044a7a158bd72190'
 GROUP BY path ORDER BY views DESC, path LIMIT 15;
