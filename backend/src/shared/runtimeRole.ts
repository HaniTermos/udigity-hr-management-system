/**
 * Runtime DB role guard (UDI-6, review F-04, DEV-R5 / AT-2).
 *
 * In production the API and the worker must connect as the limited LOGIN role (`udigity_api`, a
 * member of `udigity_app`; devops/postgres/init/10-app-role.sh), never as the owner/superuser that
 * runs migrations. This check reads the connected role's attributes and effective privileges and
 * lists every way it is too strong. An empty list means the role is safe to serve with.
 */
import type { Queryable } from '../db/pool.js';

interface RoleFacts {
  role: string;
  rolsuper: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
  rolbypassrls: boolean;
  rolreplication: boolean;
  server_file_roles: string[];
  public_create: boolean;
  hard_delete_tables: string[];
  owned_tables: number;
  audit_select: boolean;
  audit_insert: boolean;
  audit_update: boolean;
  audit_delete: boolean;
  audit_truncate: boolean;
  migrations_write: boolean;
}

export async function runtimeRoleProblems(db: Queryable): Promise<string[]> {
  const { rows } = await db.query<RoleFacts>(
    `SELECT r.rolname AS role, r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolbypassrls, r.rolreplication,
            ARRAY(SELECT s.x FROM unnest(ARRAY['pg_read_server_files', 'pg_write_server_files', 'pg_execute_server_program']) AS s(x)
                   WHERE pg_has_role(current_user, s.x, 'MEMBER')) AS server_file_roles,
            has_schema_privilege(current_user, 'public', 'CREATE') AS public_create,
            ARRAY(SELECT c.relname::text FROM pg_class c
                   WHERE c.relnamespace = 'public'::regnamespace
                     AND c.relname = ANY (ARRAY['businesses', 'deals', 'employees', 'attendance_sessions', 'deal_changes'])
                     AND has_table_privilege(current_user, c.oid, 'DELETE') ORDER BY 1) AS hard_delete_tables,
            (SELECT count(*)::int FROM pg_tables t
              WHERE t.schemaname = 'public' AND pg_has_role(current_user, t.tableowner, 'USAGE')) AS owned_tables,
            has_table_privilege(current_user, 'public.audit_events', 'SELECT')   AS audit_select,
            has_table_privilege(current_user, 'public.audit_events', 'INSERT')   AS audit_insert,
            has_table_privilege(current_user, 'public.audit_events', 'UPDATE')   AS audit_update,
            has_table_privilege(current_user, 'public.audit_events', 'DELETE')   AS audit_delete,
            has_table_privilege(current_user, 'public.audit_events', 'TRUNCATE') AS audit_truncate,
            has_table_privilege(current_user, 'public.schema_migrations', 'INSERT,UPDATE,DELETE') AS migrations_write
       FROM pg_roles r WHERE r.rolname = current_user`
  );
  const f = rows[0];
  if (!f) return ['the connected database role could not be read'];
  const problems: string[] = [];
  if (f.rolsuper) problems.push(`role ${f.role} is a superuser`);
  if (f.rolcreaterole) problems.push(`role ${f.role} can create roles`);
  if (f.rolcreatedb) problems.push(`role ${f.role} can create databases`);
  if (f.rolbypassrls) problems.push(`role ${f.role} bypasses row-level security`);
  // Review D-12: capabilities an operator mis-grant could add without making the role a superuser.
  if (f.rolreplication) problems.push(`role ${f.role} has REPLICATION (can stream the whole cluster)`);
  if (f.server_file_roles.length > 0) problems.push(`role ${f.role} is a member of ${f.server_file_roles.join(', ')} (server files/programs)`);
  if (f.public_create) problems.push(`role ${f.role} can CREATE objects in schema public`);
  // Review D-01 (D20 archive-only): business, people, deal and attendance records are never hard-deleted.
  if (f.hard_delete_tables.length > 0) problems.push(`role ${f.role} can hard-delete ${f.hard_delete_tables.join(', ')} (grants of migration 998 missing)`);
  // Owning (or inheriting the owner of) a table means ALTER/DROP and disabling the audit trigger.
  if (f.owned_tables > 0) problems.push(`role ${f.role} owns ${f.owned_tables} table(s); use the limited app role, not the owner`);
  if (f.audit_update || f.audit_delete || f.audit_truncate) problems.push(`role ${f.role} can change or remove audit_events rows`);
  if (!f.audit_select || !f.audit_insert) problems.push(`role ${f.role} lacks SELECT/INSERT on audit_events (grants of migration 012 missing)`);
  if (f.migrations_write) problems.push(`role ${f.role} can write schema_migrations`);
  return problems;
}

/** Throws with every problem listed (production startup of the API and the worker). */
export async function assertRuntimeRole(db: Queryable): Promise<void> {
  const problems = await runtimeRoleProblems(db);
  if (problems.length > 0) {
    throw new Error(`Unsafe database role for production: ${problems.join('; ')}. See devops/DEPLOY.md section 8.`);
  }
}
