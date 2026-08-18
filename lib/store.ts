import type { Store, Task } from "./types";

const KEY = "task-app-v1";
const EMPTY: Store = { tasks: [], logs: [] };

export function load(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { tasks: parsed.tasks ?? [], logs: parsed.logs ?? [] };
  } catch {
    // 壊れた JSON で起動不能にしない
    return EMPTY;
  }
}

export function save(store: Store): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(store));
}

/** 追加時の入力は title だけ。見積・刺激度は既定値（入力項目を増やさない） */
export function newTask(title: string): Task {
  return {
    id: crypto.randomUUID(),
    title,
    estimateMin: 15,
    stimulation: 2,
    parentId: null,
    createdAt: Date.now(),
    completedAt: null,
  };
}
