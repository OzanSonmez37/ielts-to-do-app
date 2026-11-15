"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, CAT, PRIO, PRIORITIES, type Task } from "@/lib/constants";
import { addDays, iso, parseQuick, todayISO } from "@/lib/parse";

type View = "inbox" | "today" | "upcoming" | "calendar" | "done";

const api = {
  async patch(id: number, body: object): Promise<Task> {
    const r = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json();
  },
};

function fmtDate(d: string, today: string) {
  if (d === today) return "Today";
  if (d === addDays(today, 1)) return "Tomorrow";
  if (d === addDays(today, -1)) return "Yesterday";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function TodoApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("today");
  const [cat, setCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState<{ due?: string } | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [exam, setExam] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    // client-only values (avoids SSR/timezone hydration mismatch)
    queueMicrotask(() => {
      setToday(todayISO());
      try {
        setExam(localStorage.getItem("ielts-exam") ?? "");
      } catch {}
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/tasks");
      if (!r.ok) throw new Error();
      setTasks(await r.json());
      setError("");
    } catch {
      setError("Could not reach the database. Is Postgres running? (docker compose up -d)");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  // ---------- actions ----------
  const upsert = (t: Task) => setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)));

  async function create(p: Partial<Task> & { title: string }) {
    const r = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    if (r.ok) await load();
  }
  async function toggle(t: Task) {
    upsert({ ...t, done: !t.done, completed_on: !t.done ? today : null });
    upsert(await api.patch(t.id, { done: !t.done }));
  }
  async function update(t: Task, patch: Partial<Task>) {
    upsert({ ...t, ...patch });
    upsert(await api.patch(t.id, patch));
  }
  async function remove(t: Task) {
    setTasks((ts) => ts.filter((x) => x.id !== t.id));
    await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
  }
  function saveExam(v: string) {
    setExam(v);
    try {
      localStorage.setItem("ielts-exam", v);
    } catch {}
  }

  // ---------- derived ----------
  const open = tasks.filter((t) => !t.done);
  const counts = {
    inbox: open.length,
    today: open.filter((t) => t.due_date && t.due_date <= today).length,
    upcoming: open.filter((t) => t.due_date && t.due_date > today).length,
  };
  const catCount = (c: string) => open.filter((t) => t.category === c).length;
  const doneToday = tasks.filter((t) => t.completed_on === today).length;
  const pct = tasks.length ? Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100) : 0;
  const examDays = exam && today ? Math.ceil((new Date(exam + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 864e5) : null;

  const list = useMemo(() => {
    let l = tasks;
    if (cat) l = l.filter((t) => t.category === cat);
    if (query.trim()) l = l.filter((t) => (t.title + " " + t.description).toLowerCase().includes(query.toLowerCase()));
    if (view === "inbox") return l.filter((t) => !t.done);
    if (view === "today") return l.filter((t) => !t.done && t.due_date && t.due_date <= today);
    if (view === "upcoming") return l.filter((t) => !t.done && t.due_date && t.due_date > today);
    if (view === "done") return l.filter((t) => t.done);
    return l;
  }, [tasks, view, cat, query, today]);

  const title =
    cat ? `${CAT[cat].emoji} ${cat[0].toUpperCase() + cat.slice(1)}` : { inbox: "Inbox", today: "Today", upcoming: "Upcoming", calendar: "Calendar", done: "Completed" }[view];

  const nav = (id: View, icon: string, label: string, count?: number) => (
    <button
      key={id}
      onClick={() => {
        setView(id);
        setCat(null);
        setMenu(false);
      }}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${view === id && !cat ? "bg-brand/10 font-semibold text-brand" : "text-ink/70 hover:bg-ink/5"}`}
    >
      <span className="w-5 text-center">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {!!count && <span className="text-xs text-ink/40">{count}</span>}
    </button>
  );

  return (
    <div className="flex min-h-screen">
      {/* ---------- Sidebar ---------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col gap-1 overflow-y-auto border-r border-ink/5 bg-[#f4efe6] p-4 transition-transform md:static md:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-3 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-sm font-black text-white">IE</div>
          <span className="text-lg font-extrabold tracking-tight">IELTS Planner</span>
        </div>

        <button onClick={() => setAdding({})} className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">+</span> Add task
        </button>

        {nav("inbox", "📥", "Inbox", counts.inbox)}
        {nav("today", "☀️", "Today", counts.today)}
        {nav("upcoming", "🗓️", "Upcoming", counts.upcoming)}
        {nav("calendar", "📅", "Calendar")}
        {nav("done", "✅", "Completed")}

        <p className="mb-1 mt-5 px-3 text-xs font-bold uppercase tracking-wider text-ink/40">Skills</p>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => {
              setCat(cat === c ? null : c);
              if (view === "calendar" || view === "done") setView("inbox");
              setMenu(false);
            }}
            className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm capitalize transition ${cat === c ? "bg-ink/10 font-semibold" : "text-ink/70 hover:bg-ink/5"}`}
          >
            <span className="w-5 text-center font-bold" style={{ color: CAT[c].color }}>#</span>
            <span className="flex-1 text-left">{c}</span>
            {!!catCount(c) && <span className="text-xs text-ink/40">{catCount(c)}</span>}
          </button>
        ))}

        {/* Exam countdown */}
        <div className="mt-auto rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-ink/40">Exam countdown</p>
          {examDays !== null && examDays >= 0 ? (
            <p className="mt-1 text-3xl font-black text-brand">
              {examDays} <span className="text-sm font-semibold text-ink/50">days left</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink/50">{exam ? "Exam day has passed 🎉" : "Pick your exam date"}</p>
          )}
          <input type="date" value={exam} onChange={(e) => saveExam(e.target.value)} className="mt-2 w-full rounded-lg bg-cream px-2 py-1 text-xs outline-none" />
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink/50">{pct}% of all tasks done · {doneToday} today</p>
        </div>
      </aside>
      {menu && <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setMenu(false)} />}

      {/* ---------- Main ---------- */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-10 sm:py-10">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => setMenu(true)} className="rounded-lg p-2 text-xl hover:bg-ink/5 md:hidden" aria-label="Open menu">☰</button>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
            {today && (
              <p className="text-sm text-ink/40">
                {new Date(today + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                {view !== "calendar" && ` · ${list.length} task${list.length === 1 ? "" : "s"}`}
              </p>
            )}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Search"
            className="w-32 rounded-full bg-white px-4 py-2 text-sm shadow-sm outline-none ring-1 ring-ink/5 transition-all focus:w-48 focus:ring-brand/40 sm:w-44"
          />
        </div>

        {error && <p className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}

        {view === "calendar" && !cat ? (
          <CalendarView tasks={tasks} today={today} onAdd={(d) => setAdding({ due: d })} onOpen={setEditing} onMove={(t, d) => update(t, { due_date: d })} />
        ) : (
          <>
            <TaskList tasks={list} today={today} onToggle={toggle} onOpen={setEditing} onRemove={remove} />
            {!loading && !error && list.length === 0 && (
              <div className="fade-up mt-16 text-center">
                <p className="text-5xl">{view === "done" ? "🌱" : "📚"}</p>
                <p className="mt-3 font-semibold">{view === "done" ? "Nothing completed yet" : view === "today" ? "You're all caught up for today" : "Nothing here"}</p>
                <p className="text-sm text-ink/40">Add a task to plan your IELTS prep.</p>
              </div>
            )}
            {view !== "done" && (
              <button onClick={() => setAdding({ due: view === "today" ? today : undefined })} className="mt-3 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink/50 transition hover:text-brand">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-brand">＋</span> Add task
              </button>
            )}
          </>
        )}
      </main>

      {adding && (
        <QuickAdd
          initialDue={adding.due}
          defaultCat={cat}
          onClose={() => setAdding(null)}
          onSave={async (p) => {
            await create(p);
            setAdding(null);
          }}
        />
      )}
      {editing && (
        <Detail
          task={tasks.find((t) => t.id === editing.id) ?? editing}
          onClose={() => setEditing(null)}
          onUpdate={update}
          onDelete={(t) => {
            remove(t);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ================= Task list ================= */

function Check({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const c = PRIO[task.priority].color;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={task.done ? "Mark as not done" : "Mark as done"}
      style={{ borderColor: c, backgroundColor: task.done ? c : c + "14" }}
      className="group/c mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition hover:scale-110"
    >
      <svg viewBox="0 0 20 20" className={`h-3 w-3 fill-none ${task.done ? "stroke-white" : "stroke-transparent group-hover/c:stroke-current"}`} style={{ color: c }} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10l4 4 8-8" />
      </svg>
    </button>
  );
}

function TaskList({ tasks, today, onToggle, onOpen, onRemove }: { tasks: Task[]; today: string; onToggle: (t: Task) => void; onOpen: (t: Task) => void; onRemove: (t: Task) => void }) {
  return (
    <ul className="divide-y divide-ink/5 border-t border-ink/5">
      {tasks.map((t) => {
        const overdue = !t.done && t.due_date && t.due_date < today;
        return (
          <li key={t.id} onClick={() => onOpen(t)} className="fade-up group flex cursor-pointer items-start gap-3 px-1 py-3 transition hover:bg-ink/[0.03]">
            <Check task={t} onToggle={() => onToggle(t)} />
            <div className="min-w-0 flex-1">
              <p className={`text-[15px] ${t.done ? "text-ink/30 line-through" : ""}`}>{t.title}</p>
              {t.description && <p className="truncate text-xs text-ink/40">{t.description}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                {t.due_date && <span className={overdue ? "font-semibold text-rose-600" : t.due_date === today ? "font-semibold text-emerald-600" : "text-ink/50"}>📅 {fmtDate(t.due_date, today)}</span>}
              </div>
            </div>
            <span className="mt-0.5 hidden items-center gap-1 text-xs capitalize text-ink/50 sm:flex">
              {t.category} <b style={{ color: CAT[t.category]?.color }}>#</b>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(t);
              }}
              aria-label="Delete task"
              className="text-ink/20 transition hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
            >
              🗑
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ================= Calendar ================= */

function CalendarView({ tasks, today, onAdd, onOpen, onMove }: { tasks: Task[]; today: string; onAdd: (d: string) => void; onOpen: (t: Task) => void; onMove: (t: Task, d: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [over, setOver] = useState<string | null>(null);
  const drag = useRef<Task | null>(null);

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first);
    d.setDate(1 - offset + i);
    return d;
  });
  const byDay = useMemo(() => {
    const m: Record<string, Task[]> = {};
    tasks.forEach((t) => t.due_date && (m[t.due_date] ??= []).push(t));
    return m;
  }, [tasks]);
  const noDate = tasks.filter((t) => !t.due_date && !t.done);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="flex-1 text-lg font-bold">{cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-lg px-3 py-1 text-lg hover:bg-ink/5" aria-label="Previous month">‹</button>
        <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="rounded-lg px-3 py-1 text-sm font-semibold hover:bg-ink/5">Today</button>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-lg px-3 py-1 text-lg hover:bg-ink/5" aria-label="Next month">›</button>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-2xl bg-white text-xs shadow-sm ring-1 ring-ink/5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="border-b border-ink/5 py-2 text-center font-semibold text-ink/40">{d}</div>
        ))}
        {cells.map((d) => {
          const key = iso(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const items = byDay[key] ?? [];
          return (
            <div
              key={key}
              onClick={() => onAdd(key)}
              onDragOver={(e) => { e.preventDefault(); setOver(key); }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={() => { setOver(null); if (drag.current && drag.current.due_date !== key) onMove(drag.current, key); drag.current = null; }}
              className={`group min-h-[84px] cursor-pointer border-b border-r border-ink/5 p-1 transition sm:min-h-[104px] ${inMonth ? "" : "bg-ink/[0.02] text-ink/30"} ${over === key ? "bg-brand/10" : "hover:bg-brand/[0.04]"}`}
            >
              <div className="mb-1 flex justify-end">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${key === today ? "bg-brand font-bold text-white" : ""}`}>{d.getDate()}</span>
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => (drag.current = t)}
                    onClick={(e) => { e.stopPropagation(); onOpen(t); }}
                    title={t.title}
                    style={{ backgroundColor: CAT[t.category].color + "22", borderLeft: `3px solid ${CAT[t.category].color}` }}
                    className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${t.done ? "line-through opacity-50" : ""}`}
                  >
                    {t.title}
                  </div>
                ))}
                {items.length > 3 && <p className="px-1 text-[10px] text-ink/40">+{items.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink/40">Click a day to add a task · drag a task onto another day to reschedule it.</p>

      {noDate.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink/40">No date — drag onto the calendar</p>
          <div className="flex flex-wrap gap-2">
            {noDate.map((t) => (
              <span key={t.id} draggable onDragStart={() => (drag.current = t)} onClick={() => onOpen(t)} style={{ borderColor: CAT[t.category].color }} className="cursor-grab rounded-full border bg-white px-3 py-1 text-xs shadow-sm">
                {t.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Quick add ================= */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/30 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="fade-up w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

const selectCls = "rounded-lg bg-cream px-2 py-1.5 text-sm capitalize outline-none ring-1 ring-ink/10 focus:ring-brand/50";

function QuickAdd({ initialDue, defaultCat, onClose, onSave }: { initialDue?: string; defaultCat: string | null; onClose: () => void; onSave: (p: Partial<Task> & { title: string }) => void }) {
  const [text, setText] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<string>(defaultCat ?? "general");
  const [priority, setPriority] = useState<string>("low");
  const [due, setDue] = useState(initialDue ?? "");
  const parsed = useMemo(() => parseQuick(text), [text]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSave({
      title: parsed.title,
      description: desc,
      category: (parsed.category ?? category) as Task["category"],
      priority: (parsed.priority ?? priority) as Task["priority"],
      due_date: parsed.due_date ?? (due || null),
    });
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit}>
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Cambridge 18 Reading Test 2 tomorrow p1 #reading" className="w-full text-lg font-semibold outline-none placeholder:font-normal placeholder:text-ink/25" />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Notes (optional)" rows={2} className="mt-2 w-full resize-none text-sm outline-none placeholder:text-ink/25" />
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/40">
          Tip: type <b>tomorrow</b>, <b>friday</b>, <b>p1</b> or <b>#writing</b> — it fills the fields for you.
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={parsed.category ?? category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CAT[c].emoji} {c}</option>)}
          </select>
          <select value={parsed.priority ?? priority} onChange={(e) => setPriority(e.target.value)} className={selectCls}>
            {[...PRIORITIES].reverse().map((p) => <option key={p} value={p}>{PRIO[p].label}</option>)}
          </select>
          <input type="date" value={parsed.due_date ?? due} onChange={(e) => setDue(e.target.value)} className={selectCls} />
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t border-ink/5 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-ink/60 hover:bg-ink/5">Cancel</button>
          <button disabled={!text.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">Add task</button>
        </div>
      </form>
    </Modal>
  );
}

/* ================= Detail / edit ================= */

function Detail({ task, onClose, onUpdate, onDelete }: { task: Task; onClose: () => void; onUpdate: (t: Task, p: Partial<Task>) => void; onDelete: (t: Task) => void }) {
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description);
  const save = () => {
    const p: Partial<Task> = {};
    if (title.trim() && title !== task.title) p.title = title.trim();
    if (desc !== task.description) p.description = desc;
    if (Object.keys(p).length) onUpdate(task, p);
  };
  return (
    <Modal onClose={() => { save(); onClose(); }}>
      <div className="flex items-start gap-3">
        <Check task={task} onToggle={() => onUpdate(task, { done: !task.done })} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} className={`flex-1 text-lg font-semibold outline-none ${task.done ? "line-through opacity-40" : ""}`} />
      </div>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={save} placeholder="Add notes…" rows={3} className="mt-2 w-full resize-none rounded-lg bg-cream p-3 text-sm outline-none" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={task.category} onChange={(e) => onUpdate(task, { category: e.target.value as Task["category"] })} className={selectCls}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CAT[c].emoji} {c}</option>)}
        </select>
        <select value={task.priority} onChange={(e) => onUpdate(task, { priority: e.target.value as Task["priority"] })} className={selectCls}>
          {[...PRIORITIES].reverse().map((p) => <option key={p} value={p}>{PRIO[p].label}</option>)}
        </select>
        <input type="date" value={task.due_date ?? ""} onChange={(e) => onUpdate(task, { due_date: e.target.value || null })} className={selectCls} />
      </div>
      <div className="mt-4 flex justify-between border-t border-ink/5 pt-4">
        <button onClick={() => onDelete(task)} className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">Delete</button>
        <button onClick={() => { save(); onClose(); }} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-110">Done</button>
      </div>
    </Modal>
  );
}
