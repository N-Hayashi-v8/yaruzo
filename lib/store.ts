import type { DayLog, Preset, Store, Task } from "./types";

const KEY = "task-app-v1";
const EMPTY: Store = { tasks: [], logs: [], presets: [] };

export function load(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Store>;
    // 定番を持たない旧データでも起動できるように、無い配列は空で埋める
    return { tasks: parsed.tasks ?? [], logs: parsed.logs ?? [], presets: parsed.presets ?? [] };
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

/** 定番に足す。同じタイトルが既にあれば足さない（並びが増えるだけで探しにくくなる） */
export function addPreset(store: Store, title: string): Store {
  const clean = title.trim();
  if (clean === "" || store.presets.some((p) => p.title === clean)) return store;
  const preset: Preset = { id: crypto.randomUUID(), title: clean, lastUsedAt: Date.now() };
  return { ...store, presets: [...store.presets, preset] };
}

export function removePreset(store: Store, id: string): Store {
  return { ...store, presets: store.presets.filter((p) => p.id !== id) };
}

/** 定番からタスクを生やす。使った順に前へ出したいので lastUsedAt を更新する */
export function spawnFromPreset(store: Store, id: string): Store {
  const preset = store.presets.find((p) => p.id === id);
  if (!preset) return store;
  return {
    ...store,
    tasks: [...store.tasks, newTask(preset.title)],
    presets: store.presets.map((p) => (p.id === id ? { ...p, lastUsedAt: Date.now() } : p)),
  };
}

/** 追加画面に出す順。最近使ったものが先頭 */
export function presetsByRecent(store: Store): Preset[] {
  return [...store.presets].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
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

/**
 * タスクを 3 ステップに割る。子は parentId 付きで生えて、親は選択対象から外れる。
 * 見積は親の 1/3（最低 5 分）、刺激度は親を継ぐ。入力はタイトルだけ（入力項目を増やさない）。
 */
export function splitTask(store: Store, parentId: string, titles: string[]): Store {
  const parent = store.tasks.find((t) => t.id === parentId);
  const clean = titles.map((t) => t.trim()).filter((t) => t !== "");
  if (!parent || clean.length === 0) return store;
  const each = Math.max(5, Math.round(parent.estimateMin / clean.length));
  const children = clean.map((title) => ({
    ...newTask(title),
    parentId,
    estimateMin: each,
    stimulation: parent.stimulation,
  }));
  return { ...store, tasks: [...store.tasks, ...children] };
}

/**
 * 完了にする。子が全部済んだ親は自動で完了（DESIGN.md 3章 分解）。
 * 親の親も同じ規則で畳む。
 */
export function completeTask(store: Store, id: string, at: number = Date.now()): Store {
  let tasks = store.tasks.map((t) => (t.id === id ? { ...t, completedAt: at } : t));
  let parentId = tasks.find((t) => t.id === id)?.parentId ?? null;
  while (parentId !== null) {
    const pid = parentId;
    const children = tasks.filter((t) => t.parentId === pid);
    if (!children.every((c) => c.completedAt !== null)) break;
    tasks = tasks.map((t) => (t.id === pid ? { ...t, completedAt: at } : t));
    parentId = tasks.find((t) => t.id === pid)?.parentId ?? null;
  }
  return { ...store, tasks };
}
