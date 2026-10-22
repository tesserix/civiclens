SET lock_timeout = '5s';
SET statement_timeout = '30s';
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'civiclens_runtime') THEN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO civiclens_runtime', current_database());
  EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', current_schema());
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO civiclens_runtime', current_schema());
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO civiclens_runtime', current_schema());
  GRANT SELECT, INSERT ON users TO civiclens_runtime;
  GRANT UPDATE (identity_subject) ON users TO civiclens_runtime;
  GRANT SELECT ON user_roles TO civiclens_runtime;
  GRANT SELECT, INSERT, DELETE ON sessions, auth_challenges TO civiclens_runtime;
  GRANT SELECT, INSERT, UPDATE ON reports, publications TO civiclens_runtime;
  GRANT SELECT, INSERT ON audit_events TO civiclens_runtime;
  GRANT SELECT ON account_deletion_requests TO civiclens_runtime;
  GRANT INSERT (id, user_id) ON account_deletion_requests TO civiclens_runtime;
END IF;
END $$;
