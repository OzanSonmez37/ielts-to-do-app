import { CATEGORIES, type Task } from "./constants";

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayISO = () => iso(new Date());
export const addDays = (s: string, n: number) => {
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
};

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Todoist-like quick add: "Cambridge 18 test 2 tomorrow p1 #reading" */
export function parseQuick(input: string): Partial<Task> & { title: string } {
  let t = " " + input + " ";
  const out: Partial<Task> & { title: string } = { title: "" };

  t = t.replace(/\s#(\w+)/i, (m, c: string) => {
    const cat = CATEGORIES.find((x) => x === c.toLowerCase());
    if (cat) out.category = cat;
    return cat ? " " : m;
  });
  t = t.replace(/\sp([123])\b/i, (_m, n: string) => {
    out.priority = n === "1" ? "high" : n === "2" ? "medium" : "low";
    return " ";
  });

  const today = todayISO();
  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/\s(today)\b/i, () => today],
    [/\s(tomorrow)\b/i, () => addDays(today, 1)],
    [/\sin (\d+) days?\b/i, (m) => addDays(today, +m[1])],
    [/\snext week\b/i, () => addDays(today, 7)],
    [
      new RegExp(`\\s(?:on |next )?(${DAYS.join("|")})\\b`, "i"),
      (m) => {
        const want = DAYS.indexOf(m[1].toLowerCase());
        const cur = new Date().getDay();
        return addDays(today, (want - cur + 7) % 7 || 7);
      },
    ],
  ];
  for (const [re, fn] of rules) {
    const m = t.match(re);
    if (m) {
      out.due_date = fn(m);
      t = t.replace(re, " ");
      break;
    }
  }
  out.title = t.replace(/\s+/g, " ").trim() || input.trim();
  return out;
}
