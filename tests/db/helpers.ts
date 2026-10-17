import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

export function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

type Row = Record<string, unknown>;

export type TestDb = Awaited<ReturnType<typeof freshDb>>;

/**
 * Boots an in-memory Postgres (PGlite), loads the Supabase stub, optionally runs
 * `beforeMigrations` (e.g. to create users that existed before the schema), then
 * applies every migration in filename order.
 */
export async function freshDb(opts: { beforeMigrations?: (db: PGlite) => Promise<void> } = {}) {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create extension if not exists pg_trgm with schema extensions;`).catch(async () => {
    await db.exec(`create schema if not exists extensions; create extension if not exists pg_trgm with schema extensions;`);
  });
  await db.exec(readFileSync(join(import.meta.dirname, "supabase-stub.sql"), "utf8"));
  if (opts.beforeMigrations) await opts.beforeMigrations(db);
  for (const file of migrationFiles()) {
    try {
      await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }

  async function createUser(email: string, meta: Row = {}): Promise<string> {
    const r = await db.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
      [email, JSON.stringify(meta)],
    );
    return r.rows[0].id;
  }

  async function setRole(userId: string, role: "member" | "moderator" | "admin") {
    await db.query(`update public.profiles set role = $2 where id = $1`, [userId, role]);
  }

  /** Run `sql` as a signed-in user (or anon when userId is null), like PostgREST does. */
  async function as<T = Row>(userId: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
    return db.transaction(async (tx: Transaction) => {
      if (userId) {
        await tx.exec(`set local role authenticated`);
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify({ sub: userId, role: "authenticated" }),
        ]);
      } else {
        await tx.exec(`set local role anon`);
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: "anon" })]);
      }
      const r = await tx.query<T>(sql, params);
      return r.rows;
    });
  }

  /** Superuser query (bypasses RLS) for arranging and inspecting test state. */
  async function sql<T = Row>(query: string, params: unknown[] = []): Promise<T[]> {
    return (await db.query<T>(query, params)).rows;
  }

  return { db, createUser, setRole, as, sql };
}

/** Deterministic id used by the sample-data migration. */
export function sampleId(key: string): string {
  const h = createHash("md5").update(`sakay-sample:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function rejects(p: Promise<unknown>, pattern: RegExp): Promise<string> {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message;
    if (!pattern.test(msg)) throw new Error(`Expected error matching ${pattern}, got: ${msg}`);
    return msg;
  }
  throw new Error(`Expected rejection matching ${pattern}, but it succeeded`);
}
