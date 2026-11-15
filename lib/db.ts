import { Pool } from "pg";

const g = globalThis as unknown as { pgPool?: Pool; pgReady?: Promise<void> };

export const pool = g.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
if (process.env.NODE_ENV !== "production") g.pgPool = pool;

// Creates / upgrades the table on first use, so there is no separate migration step.
export function ready(): Promise<void> {
  g.pgReady ??= (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date DATE,
      done BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`);
  })();
  return g.pgReady;
}

export const SELECT = `id, title, description, category, priority, done, created_at,
  to_char(due_date, 'YYYY-MM-DD') AS due_date,
  to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS completed_on`;
