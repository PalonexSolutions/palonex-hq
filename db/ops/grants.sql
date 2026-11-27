-- Run as the production database/schema owner after migrations.
-- Create the two login roles separately without elevated memberships.
BEGIN;
REVOKE ALL ON SCHEMA palonex_private FROM PUBLIC;
GRANT USAGE ON SCHEMA palonex_private TO palonex_runtime, palonex_maintenance;

GRANT SELECT, INSERT ON palonex_private.enquiries TO palonex_runtime;
GRANT UPDATE (status, updated_at, status_changed_at) ON palonex_private.enquiries TO palonex_runtime;
GRANT SELECT, INSERT, UPDATE ON palonex_private.enquiry_rate_limits, palonex_private.enquiry_notifications TO palonex_runtime;
GRANT SELECT ON palonex_private.admin_user, palonex_private.admin_account, palonex_private.admin_staff TO palonex_runtime;
GRANT SELECT, INSERT, DELETE ON palonex_private.admin_session TO palonex_runtime;
GRANT SELECT, INSERT, UPDATE ON palonex_private.admin_login_limits TO palonex_runtime;
GRANT SELECT, INSERT ON palonex_private.enquiry_notes, palonex_private.enquiry_audit TO palonex_runtime;
GRANT USAGE ON SEQUENCE palonex_private.enquiry_audit_id_seq TO palonex_runtime;

GRANT SELECT, INSERT ON palonex_private.identity_user, palonex_private.identity_account TO palonex_runtime;
GRANT UPDATE (name, "updatedAt", "emailVerified", status) ON palonex_private.identity_user TO palonex_runtime;
GRANT UPDATE (password, "updatedAt") ON palonex_private.identity_account TO palonex_runtime;
GRANT SELECT, INSERT, DELETE ON palonex_private.identity_session, palonex_private.identity_verification TO palonex_runtime;
GRANT SELECT ON palonex_private.identity_role TO palonex_runtime;
GRANT SELECT, INSERT, UPDATE ON palonex_private.identity_rate, palonex_private.identity_mail TO palonex_runtime;
GRANT SELECT, INSERT ON palonex_private.identity_audit TO palonex_runtime;
GRANT USAGE ON SEQUENCE palonex_private.identity_audit_id_seq TO palonex_runtime;

GRANT DELETE ON palonex_private.enquiries, palonex_private.enquiry_rate_limits, palonex_private.admin_login_limits,
  palonex_private.admin_session, palonex_private.identity_rate, palonex_private.identity_session,
  palonex_private.identity_verification, palonex_private.identity_mail TO palonex_maintenance;
GRANT SELECT (created_at) ON palonex_private.enquiries TO palonex_maintenance;
GRANT SELECT (window_start) ON palonex_private.enquiry_rate_limits, palonex_private.admin_login_limits,
  palonex_private.identity_rate TO palonex_maintenance;
GRANT SELECT ("expiresAt") ON palonex_private.admin_session, palonex_private.identity_session,
  palonex_private.identity_verification TO palonex_maintenance;
GRANT SELECT (expires_at) ON palonex_private.identity_mail TO palonex_maintenance;

ALTER ROLE palonex_runtime SET statement_timeout = '5s';
ALTER ROLE palonex_maintenance SET statement_timeout = '60s';
COMMIT;
