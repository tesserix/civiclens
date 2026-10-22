-- Run as the CivicLens schema owner after the reviewed migration.
REVOKE ALL ON DATABASE civiclens_db FROM PUBLIC;
GRANT CONNECT ON DATABASE civiclens_db TO civiclens_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA civiclens FROM PUBLIC;
GRANT USAGE ON SCHEMA civiclens TO civiclens_runtime;
GRANT SELECT, INSERT ON civiclens.users TO civiclens_runtime;
GRANT SELECT ON civiclens.user_roles TO civiclens_runtime;
GRANT SELECT, INSERT, DELETE ON civiclens.sessions, civiclens.auth_challenges TO civiclens_runtime;
GRANT SELECT, INSERT, UPDATE ON civiclens.reports, civiclens.publications TO civiclens_runtime;
GRANT SELECT, INSERT ON civiclens.audit_events TO civiclens_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA civiclens TO civiclens_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON civiclens.audit_events FROM civiclens_runtime;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON civiclens.user_roles FROM civiclens_runtime;
