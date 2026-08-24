import assert from "node:assert/strict";
import test from "node:test";
import {
  completedLeaves,
  hasStimulating,
  nextTask,
  taskQueue,
  withoutPassed,
} from "./select.ts";
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

test("柱に関係なく古い順（抽選しない）", () => {
  const tasks = [
    task({ id: "dp", createdAt: 30, pillar: "duelplays" }),
    task({ id: "sing", createdAt: 10, pillar: "sing" }),
    task({ id: "etc", createdAt: 20, pillar: null }),
  ];
  assert.equal(nextTask(tasks)?.id, "sing");
});

test("眠気モードは刺激度の高い順", () => {
  const tasks = [
    task({ id: "sing", createdAt: 10, pillar: "sing", stimulation: 1 }),
    task({ id: "op", createdAt: 20, pillar: "onepiece", stimulation: 3 }),
  ];
  assert.equal(nextTask(tasks, true)?.id, "op");
});

test("やめた分は候補から外れる", () => {
  const tasks = [task({ id: "a", createdAt: 10 }), task({ id: "b", createdAt: 20 })];
  assert.deepEqual(
    withoutPassed(tasks, new Set(["a"])).map((t) => t.id),
    ["b"],
  );
});

test("全部やめたら元のまま返す（詰ませない）", () => {
  const tasks = [task({ id: "a", createdAt: 10 }), task({ id: "b", createdAt: 20 })];
  assert.deepEqual(
    withoutPassed(tasks, new Set(["a", "b"])).map((t) => t.id),
    ["a", "b"],
  );
});
