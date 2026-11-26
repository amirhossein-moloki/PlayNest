-- Idempotent provisioning script for least-privilege PostgreSQL database roles.
-- Intended for live cutover on an existing PostgreSQL 15+ cluster running both Sayra and Blog DBs.
-- Required psql variables:
--   sayra_db, sayra_user, sayra_pass, blog_db, blog_user, blog_pass

\set ON_ERROR_STOP on

SELECT format(
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'sayra_user')
    THEN 'ALTER ROLE %I WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN PASSWORD %L'
    ELSE 'CREATE ROLE %I WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN PASSWORD %L'
  END,
  :'sayra_user', :'sayra_pass'
)\gexec

SELECT format(
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'blog_user')
    THEN 'ALTER ROLE %I WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN PASSWORD %L'
    ELSE 'CREATE ROLE %I WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN PASSWORD %L'
  END,
  :'blog_user', :'blog_pass'
)\gexec

REVOKE ALL ON DATABASE :"sayra_db" FROM PUBLIC;
ALTER DATABASE :"sayra_db" OWNER TO :"sayra_user";
GRANT ALL PRIVILEGES ON DATABASE :"sayra_db" TO :"sayra_user";

REVOKE ALL ON DATABASE :"blog_db" FROM PUBLIC;
ALTER DATABASE :"blog_db" OWNER TO :"blog_user";
GRANT ALL PRIVILEGES ON DATABASE :"blog_db" TO :"blog_user";

\connect :"sayra_db"
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO :"sayra_user";
GRANT ALL ON SCHEMA public TO :"sayra_user";
SELECT format('ALTER TABLE %I.%I OWNER TO %I', n.nspname, c.relname, :'sayra_user')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')\gexec
SELECT format('ALTER SEQUENCE %I.%I OWNER TO %I', n.nspname, c.relname, :'sayra_user')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'S'
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d
    WHERE d.objid = c.oid AND d.classid = 'pg_class'::regclass AND d.deptype = 'a'
  )\gexec
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO :"sayra_user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO :"sayra_user";

\connect :"blog_db"
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO :"blog_user";
GRANT ALL ON SCHEMA public TO :"blog_user";
SELECT format('ALTER TABLE %I.%I OWNER TO %I', n.nspname, c.relname, :'blog_user')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')\gexec
SELECT format('ALTER SEQUENCE %I.%I OWNER TO %I', n.nspname, c.relname, :'blog_user')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'S'
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d
    WHERE d.objid = c.oid AND d.classid = 'pg_class'::regclass AND d.deptype = 'a'
  )\gexec
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO :"blog_user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO :"blog_user";
