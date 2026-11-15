export const CATEGORIES = ["listening", "reading", "writing", "speaking", "vocabulary", "grammar", "general"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;

export type Task = {
  id: number;
  title: string;
  description: string;
  category: (typeof CATEGORIES)[number];
  priority: (typeof PRIORITIES)[number];
  due_date: string | null;
  done: boolean;
  completed_on: string | null;
};

// hex colours are used for the "# project" dots and calendar pills
export const CAT: Record<string, { emoji: string; color: string }> = {
  listening: { emoji: "🎧", color: "#0ea5e9" },
  reading: { emoji: "📖", color: "#10b981" },
  writing: { emoji: "✍️", color: "#8b5cf6" },
  speaking: { emoji: "🎤", color: "#f43f5e" },
  vocabulary: { emoji: "🔤", color: "#f59e0b" },
  grammar: { emoji: "🧩", color: "#14b8a6" },
  general: { emoji: "⭐", color: "#64748b" },
};

// Todoist-style priority colours: P1 red, P2 orange, P3 blue
export const PRIO: Record<string, { label: string; color: string }> = {
  high: { label: "P1", color: "#dc2626" },
  medium: { label: "P2", color: "#f59e0b" },
  low: { label: "P3", color: "#3b82f6" },
};
