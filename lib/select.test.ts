import assert from "node:assert/strict";
import test from "node:test";
import { completedLeaves, hasStimulating, nextTask, taskQueue } from "./select.ts";
import type { Task } from "./types.ts";

const task = (over: Partial<Task> & { id: string; createdAt: number }): Task => ({
  title: over.id,
  estimateMin: 15,
  stimulation: 2,
  pillar: null,
  parentId: null,
  completedAt: null,
  ...over,
});

test("空なら null", () => {
  assert.equal(nextTask([]), null);
});

test("古い順に 1 件返す", () => {
  const tasks = [task({ id: "b", createdAt: 20 }), task({ id: "a", createdAt: 10 })];
  assert.equal(nextTask(tasks)?.id, "a");
});

test("完了済みは飛ばす", () => {
  const tasks = [
    task({ id: "a", createdAt: 10, completedAt: 99 }),
    task({ id: "b", createdAt: 20 }),
  ];
  assert.equal(nextTask(tasks)?.id, "b");
});

test("子を持つ親は返さず子を返す", () => {
  const tasks = [
    task({ id: "parent", createdAt: 10 }),
    task({ id: "child", createdAt: 20, parentId: "parent" }),
  ];
  assert.equal(nextTask(tasks)?.id, "child");
});

test("入力配列を破壊しない", () => {
  const tasks = [task({ id: "b", createdAt: 20 }), task({ id: "a", createdAt: 10 })];
  nextTask(tasks);
  assert.deepEqual(tasks.map((t) => t.id), ["b", "a"]);
});

test("眠気モードは刺激度の高い順", () => {
  const tasks = [
    task({ id: "boring", createdAt: 10, stimulation: 1 }),
    task({ id: "fun", createdAt: 30, stimulation: 3 }),
    task({ id: "mid", createdAt: 20, stimulation: 2 }),
  ];
  assert.equal(nextTask(tasks, true)?.id, "fun");
  assert.equal(nextTask(tasks)?.id, "boring"); // 通常は古い順のまま
});

test("眠気モードでも同じ刺激度なら古い順", () => {
  const tasks = [
    task({ id: "new", createdAt: 30, stimulation: 3 }),
    task({ id: "old", createdAt: 10, stimulation: 3 }),
  ];
  assert.equal(nextTask(tasks, true)?.id, "old");
});

test("眠気モードでも入力配列を破壊しない", () => {
  const tasks = [
    task({ id: "boring", createdAt: 10, stimulation: 1 }),
    task({ id: "fun", createdAt: 30, stimulation: 3 }),
  ];
  nextTask(tasks, true);
  assert.deepEqual(tasks.map((t) => t.id), ["boring", "fun"]);
});

test("taskQueue は完了済みと親を外して並べる", () => {
  const tasks = [
    task({ id: "done", createdAt: 5, completedAt: 99 }),
    task({ id: "parent", createdAt: 10 }),
    task({ id: "child", createdAt: 20, parentId: "parent" }),
  ];
  assert.deepEqual(taskQueue(tasks).map((t) => t.id), ["child"]);
});

test("刺激度 3 の在庫判定", () => {
  assert.equal(hasStimulating([task({ id: "a", createdAt: 10, stimulation: 2 })]), false);
  assert.equal(hasStimulating([task({ id: "a", createdAt: 10, stimulation: 3 })]), true);
  // 完了済みの刺激度 3 は在庫に数えない
  assert.equal(
    hasStimulating([task({ id: "a", createdAt: 10, stimulation: 3, completedAt: 1 })]),
    false,
  );
});

test("completedLeaves は分解の親を数えない", () => {
  const tasks = [
    task({ id: "p", createdAt: 10, completedAt: 200 }),
    task({ id: "c1", createdAt: 20, parentId: "p", completedAt: 100 }),
    task({ id: "c2", createdAt: 30, parentId: "p", completedAt: 200 }),
    task({ id: "solo", createdAt: 40, completedAt: 300 }),
  ];
  assert.deepEqual(completedLeaves(tasks).map((t) => t.id), ["c1", "c2", "solo"]);
});

// 柱の重み: 歌 3 / ワンピ 2 / デュエプレ 1 / その他 2（lib/pillars.ts）。
// rand は [0,1) を返す関数として注入する
test("柱を重み付きで引く（全柱に在庫あり、合計 8）", () => {
  const tasks = [
    task({ id: "sing", createdAt: 10, pillar: "sing" }),
    task({ id: "op", createdAt: 20, pillar: "onepiece" }),
    task({ id: "dp", createdAt: 30, pillar: "duelplays" }),
    task({ id: "etc", createdAt: 40, pillar: null }),
  ];
  assert.equal(nextTask(tasks, false, () => 0)?.id, "sing"); // 0〜3
  assert.equal(nextTask(tasks, false, () => 0.5)?.id, "op"); // 3〜5
  assert.equal(nextTask(tasks, false, () => 0.7)?.id, "dp"); // 5〜6
  assert.equal(nextTask(tasks, false, () => 0.9)?.id, "etc"); // 6〜8
});

test("在庫の無い柱は抽選に入らない", () => {
  // 歌 3 とその他 2 だけ。合計 5
  const tasks = [
    task({ id: "sing", createdAt: 10, pillar: "sing" }),
    task({ id: "etc", createdAt: 20, pillar: null }),
  ];
  assert.equal(nextTask(tasks, false, () => 0)?.id, "sing");
  assert.equal(nextTask(tasks, false, () => 0.9)?.id, "etc"); // 4.5 → その他
  // 端（rand が 1 に限りなく近い）でも null を返さない
  assert.equal(nextTask(tasks, false, () => 0.999999)?.id, "etc");
});

test("柱の中は古い順", () => {
  const tasks = [
    task({ id: "new", createdAt: 30, pillar: "sing" }),
    task({ id: "old", createdAt: 10, pillar: "sing" }),
  ];
  assert.equal(nextTask(tasks, false, () => 0)?.id, "old");
});

test("完了済みしか無い柱は在庫ゼロ扱い", () => {
  const tasks = [
    task({ id: "sing", createdAt: 10, pillar: "sing", completedAt: 1 }),
    task({ id: "etc", createdAt: 20, pillar: null }),
  ];
  // 歌が候補から外れるので、どこを引いてもその他しか出ない
  assert.equal(nextTask(tasks, false, () => 0)?.id, "etc");
  assert.equal(nextTask(tasks, false, () => 0.99)?.id, "etc");
});

test("眠気モードは柱を無視して刺激度の高い順", () => {
  const tasks = [
    task({ id: "sing", createdAt: 10, pillar: "sing", stimulation: 1 }),
    task({ id: "op", createdAt: 20, pillar: "onepiece", stimulation: 3 }),
  ];
  assert.equal(nextTask(tasks, true, () => 0)?.id, "op");
});
