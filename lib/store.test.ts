import assert from "node:assert/strict";
import test from "node:test";
import {
  addPreset,
  completeTask,
  logFor,
  presetsByRecent,
  putLog,
  removePreset,
  spawnFromPreset,
  splitTask,
  todayKey,
} from "./store.ts";
import type { Store, Task } from "./types.ts";

const empty: Store = { tasks: [], logs: [], presets: [] };

test("todayKey はローカル日付を YYYY-MM-DD で返す", () => {
  assert.equal(todayKey(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
});

test("記録が無ければ空の記録を返す（追加はしない）", () => {
  const log = logFor(empty, "2026-01-05");
  assert.deepEqual(log, { date: "2026-01-05", wakeAt: null, gotLight: false });
  assert.equal(empty.logs.length, 0);
});

test("putLog は同じ日付を差し替える", () => {
  const a = putLog(empty, { date: "2026-01-05", wakeAt: "07:20", gotLight: false });
  const b = putLog(a, { date: "2026-01-05", wakeAt: "07:20", gotLight: true });
  assert.equal(b.logs.length, 1);
  assert.equal(logFor(b, "2026-01-05").gotLight, true);
  assert.equal(logFor(a, "2026-01-05").gotLight, false); // 元は書き換えない
});

test("別の日付は足される", () => {
  const a = putLog(empty, { date: "2026-01-05", wakeAt: null, gotLight: true });
  const b = putLog(a, { date: "2026-01-06", wakeAt: null, gotLight: false });
  assert.equal(b.logs.length, 2);
});

const task = (over: Partial<Task> & { id: string }): Task => ({
  title: over.id,
  estimateMin: 45,
  stimulation: 2,
  parentId: null,
  createdAt: 10,
  completedAt: null,
  ...over,
});

test("splitTask は埋めた数だけ子を生やす", () => {
  const s: Store = { tasks: [task({ id: "p" })], logs: [], presets: [] };
  const out = splitTask(s, "p", ["A", "", "  ", "B"]);
  const children = out.tasks.filter((t) => t.parentId === "p");
  assert.deepEqual(children.map((c) => c.title), ["A", "B"]);
  assert.deepEqual(children.map((c) => c.estimateMin), [23, 23]); // 45/2 を四捨五入
  assert.equal(out.tasks.length, 3);
});

test("splitTask の見積は最低 5 分、刺激度は親を継ぐ", () => {
  const s: Store = { tasks: [task({ id: "p", estimateMin: 6, stimulation: 3 })], logs: [], presets: [] };
  const c = splitTask(s, "p", ["a", "b", "c"]).tasks.filter((t) => t.parentId === "p");
  assert.deepEqual(c.map((t) => t.estimateMin), [5, 5, 5]);
  assert.deepEqual(c.map((t) => t.stimulation), [3, 3, 3]);
});

test("splitTask は空入力や未知の親では何もしない", () => {
  const s: Store = { tasks: [task({ id: "p" })], logs: [], presets: [] };
  assert.equal(splitTask(s, "p", ["", " "]), s);
  assert.equal(splitTask(s, "nope", ["A"]), s);
});

test("子が全部済むと親も自動で完了", () => {
  const s: Store = {
    tasks: [
      task({ id: "p" }),
      task({ id: "c1", parentId: "p" }),
      task({ id: "c2", parentId: "p" }),
    ],
    logs: [],
    presets: [],
  };
  const one = completeTask(s, "c1", 100);
  assert.equal(one.tasks.find((t) => t.id === "p")?.completedAt, null);
  const both = completeTask(one, "c2", 200);
  assert.equal(both.tasks.find((t) => t.id === "p")?.completedAt, 200);
});

test("入れ子の分解でも祖父まで畳む", () => {
  const s: Store = {
    tasks: [
      task({ id: "g" }),
      task({ id: "p", parentId: "g" }),
      task({ id: "c", parentId: "p" }),
    ],
    logs: [],
    presets: [],
  };
  const out = completeTask(s, "c", 300);
  assert.equal(out.tasks.find((t) => t.id === "g")?.completedAt, 300);
});

test("addPreset は同じタイトルを重ねない", () => {
  const one = addPreset(empty, "皿洗い");
  assert.deepEqual(one.presets.map((p) => p.title), ["皿洗い"]);
  // 前後の空白だけ違うものも同じ扱い
  assert.equal(addPreset(one, "  皿洗い  ").presets.length, 1);
  assert.equal(addPreset(one, "   ").presets.length, 1);
});

test("spawnFromPreset はタスクを生やして最近使った順を前へ出す", () => {
  const two = addPreset(addPreset(empty, "古い"), "新しい");
  // 登録時刻を揃えてから片方を使う。使ったほうが先頭に来る
  const flat = { ...two, presets: two.presets.map((p) => ({ ...p, lastUsedAt: 0 })) };
  const target = flat.presets[0];
  const used = spawnFromPreset(flat, target.id);
  assert.deepEqual(used.tasks.map((t) => t.title), [target.title]);
  assert.equal(presetsByRecent(used)[0].title, target.title);
  assert.equal(used.presets.length, 2); // 使っても定番は減らない
});

test("removePreset は定番だけ消してタスクは残す", () => {
  const s = addPreset(empty, "皿洗い");
  const spawned = spawnFromPreset(s, s.presets[0].id);
  const out = removePreset(spawned, s.presets[0].id);
  assert.equal(out.presets.length, 0);
  assert.deepEqual(out.tasks.map((t) => t.title), ["皿洗い"]);
});
