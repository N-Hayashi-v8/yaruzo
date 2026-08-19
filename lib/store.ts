import type { DayLog, Store, Task } from "./types";

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

/** ローカル日付の YYYY-MM-DD。UTC 変換を挟むと日付がずれるので getFullYear 系で組む */
export function todayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** その日の記録。無ければ空の記録を返す（作成はしない） */
export function logFor(store: Store, date: string): DayLog {
  return store.logs.find((l) => l.date === date) ?? { date, wakeAt: null, gotLight: false };
}

/** その日の記録を差し替えた新しい Store を返す */
export function putLog(store: Store, log: DayLog): Store {
  const rest = store.logs.filter((l) => l.date !== log.date);
  return { ...store, logs: [...rest, log] };
}
