import { pool, ready, SELECT } from "@/lib/db";
import { CATEGORIES, PRIORITIES } from "@/lib/constants";

export async function GET() {
  await ready();
  const { rows } = await pool.query(
    `SELECT ${SELECT} FROM tasks ORDER BY done ASC, due_date ASC NULLS LAST, created_at DESC`
  );
  return Response.json(rows);
}

export async function POST(req: Request) {
  await ready();
  const b = await req.json().catch(() => ({}));
  const title = String(b.title ?? "").trim();
  if (!title) return Response.json({ error: "Title is required" }, { status: 400 });
  const category = (CATEGORIES as readonly string[]).includes(b.category) ? b.category : "general";
  const priority = (PRIORITIES as readonly string[]).includes(b.priority) ? b.priority : "low";
  const due = /^\d{4}-\d{2}-\d{2}$/.test(b.due_date ?? "") ? b.due_date : null;
  const description = String(b.description ?? "").slice(0, 2000);
  const { rows } = await pool.query(
    `INSERT INTO tasks (title, category, priority, due_date, description) VALUES ($1,$2,$3,$4,$5) RETURNING ${SELECT}`,
    [title.slice(0, 300), category, priority, due, description]
  );
  return Response.json(rows[0], { status: 201 });
}
