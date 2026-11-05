-- 012 Admin: restricted application role (DEV-R5, threat model AT-2). Owner: BE1. Forward-only.
--
-- Model: migrations run as the table-owner role (MIGRATION_DATABASE_URL). The API and worker run as
-- a LOGIN role that is a member of the group role `udigity_app` (DATABASE_URL), created by DevOps:
--     CREATE ROLE <app_login> LOGIN PASSWORD '…' IN ROLE udigity_app;
-- `udigity_app` gets DML on every table, EXCEPT `audit_events`: SELECT + INSERT only (no UPDATE,
-- DELETE, TRUNCATE). It owns nothing, so it cannot ALTER or DISABLE the append-only trigger.
-- Default privileges cover tables later migrations create (they run as the same owner role).
--
-- When the migrating role may not create roles (no CREATEROLE), this migration only raises a NOTICE
-- and changes nothing; DevOps then creates `udigity_app` and re-runs the GRANT block below by hand.

DO $$
DECLARE
  can_create boolean;
BEGIN
  SELECT rolsuper OR rolcreaterole INTO can_create FROM pg_roles WHERE rolname = current_user;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'udigity_app') THEN
    IF NOT can_create THEN
      RAISE NOTICE 'udigity_app role missing and % cannot create roles: grants skipped (DEV-R5)', current_user;
      RETURN;
    END IF;
    BEGIN
      -- Roles are cluster-wide; several databases may migrate at once.
      CREATE ROLE udigity_app NOLOGIN NOINHERIT;
    EXCEPTION WHEN duplicate_object OR unique_violation THEN
      NULL;
    END;
  END IF;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO udigity_app', current_database());
  GRANT USAGE ON SCHEMA public TO udigity_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO udigity_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO udigity_app;
  -- AT-2: audit is append-only for the app.
  REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM udigity_app;
  GRANT SELECT, INSERT ON audit_events TO udigity_app;
  -- The migration bookkeeping table is not the app's business.
  REVOKE INSERT, UPDATE, DELETE ON schema_migrations FROM udigity_app;

  -- Tables/sequences created later by this owner role (later migrations).
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO udigity_app', current_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO udigity_app', current_user);
END
$$;
