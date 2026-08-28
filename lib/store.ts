import type { DayLog, Preset, Store, Task } from "./types";

/*
  保存先は IndexedDB。localStorage は容量が 5MB 前後で頭打ちになるうえ、
  完了タスクは履歴として残し続ける（消さない）ので、増える一方のデータを置く場所ではない。

  持ち方は 1 レコードに Store 全体。読むときは全部読み、書くときは全部書く。
  タスクの件数で分ける形にしても、この規模だと引き当てが速くなるより
  更新の手数が増えるほうが効く。分けるのは絞り込みが要るようになってから
*/
const DB_NAME = "yaruzo";
const TABLE = "store";
const KEY = "task-app-v1"; // localStorage 時代と同じキー。引き継ぎで参照する
const EMPTY: Store = { tasks: [], logs: [], presets: [] };

/** 接続は開きっぱなしで使い回す。読み書きのたびに開くと待ちが増える */
let conn: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  conn ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TABLE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return conn;
}

function request<T>(mode: IDBTransactionMode, run: (t: IDBObjectStore) => IDBRequest<T>) {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = run(d.transaction(TABLE, mode).objectStore(TABLE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** 無い配列を空で埋める。定番を持たない頃のデータでも起動できるように */
const fill = (s: Partial<Store>): Store => ({
  tasks: s.tasks ?? [],
  logs: s.logs ?? [],
  presets: s.presets ?? [],
});

export async function load(): Promise<Store> {
  if (typeof window === "undefined") return EMPTY;
  try {
    const found = await request<Partial<Store> | undefined>("readonly", (t) => t.get(KEY));
    if (found) return fill(found);

    // localStorage に貯めていた頃のデータを 1 回だけ引き取る
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const moved = fill(JSON.parse(raw) as Partial<Store>);
    await request("readwrite", (t) => t.put(moved, KEY));
    localStorage.removeItem(KEY); // 移し終えてから消す。put が転けたらここへ来ない
    return moved;
  } catch {
    // IndexedDB を開けない/壊れている。空を返すと、そのまま何か足して保存した時点で
    // 移し損ねた履歴が読めなくなる。引き取り前の localStorage が残っていればそれで動かす
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? fill(JSON.parse(raw) as Partial<Store>) : EMPTY;
    } catch {
      return EMPTY; // 壊れた JSON。ここまで来たら起動を止めないことだけ優先する
    }
  }
}

/**
 * 投げっぱなしで書く。待たないので呼び出し側は同期のまま。
 * 画面はすでに新しい Store で描けていて、書き込みの完了を待つ理由がない
 */
export function save(store: Store): void {
  if (typeof window === "undefined") return;
  void request("readwrite", (t) => t.put(store, KEY)).catch(() => {});
}

/** 目安分の丸め。5 分刻み・5〜180 分。画面のドラッグと store の両方で使う */
export const clampMin = (min: number) => Math.min(180, Math.max(5, Math.round(min / 5) * 5));

/**
 * 追加時の入力は title だけ。刺激度は既定値（入力項目を増やさない）。
 * 目安分は既定 15 分。追加画面でドラッグして変えたときだけ渡ってくる。
 */
export function newTask(title: string, estimateMin = 15): Task {
  return {
    id: crypto.randomUUID(),
    title,
    estimateMin: clampMin(estimateMin),
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

/**
 * 目安分を付け替える。NOW 画面のドラッグ用。
 * 5 分刻み・5〜180 分に丸める。同じ値なら Store をそのまま返す（無駄な保存を挟まない）。
 */
export function setEstimate(store: Store, id: string, min: number): Store {
  const clamped = clampMin(min);
  const task = store.tasks.find((t) => t.id === id);
  if (!task || task.estimateMin === clamped) return store;
  return {
    ...store,
    tasks: store.tasks.map((t) => (t.id === id ? { ...t, estimateMin: clamped } : t)),
  };
}
