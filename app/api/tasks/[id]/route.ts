import type { NextRequest } from "next/server";
import { pool, ready, SELECT } from "@/lib/db";
import { CATEGORIES, PRIORITIES } from "@/lib/constants";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/tasks/[id]">) {
  await ready();
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const vals: unknown[] = [id];
  const add = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };

  if (typeof b.done === "boolean") {
    add("done", b.done);
    sets.push(`completed_at = ${b.done ? "now()" : "NULL"}`);
  }
  if (typeof b.title === "string" && b.title.trim()) add("title", b.title.trim().slice(0, 300));
  if (typeof b.description === "string") add("description", b.description.slice(0, 2000));
  if ((CATEGORIES as readonly string[]).includes(b.category)) add("category", b.category);
  if ((PRIORITIES as readonly string[]).includes(b.priority)) add("priority", b.priority);
  if ("due_date" in b) add("due_date", /^\d{4}-\d{2}-\d{2}$/.test(b.due_date ?? "") ? b.due_date : null);

  if (!sets.length) return Response.json({ error: "Nothing to update" }, { status: 400 });
  const { rows } = await pool.query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $1 RETURNING ${SELECT}`, vals);
  if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(rows[0]);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/tasks/[id]">) {
  await ready();
  const { id } = await ctx.params;
  await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
  return new Response(null, { status: 204 });
}
