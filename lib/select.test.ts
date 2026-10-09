import assert from "node:assert/strict";
import test from "node:test";
import {
  completedLeaves,
  nextTask,
  taskQueue,
  withoutPassed,
} from "./select.ts";
import type { Task } from "./types.ts";

const task = (over: Partial<Task> & { id: string; createdAt: number }): Task => ({
  title: over.id,
  estimateMin: 15,
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

test("taskQueue は完了済みと親を外して並べる", () => {
  const tasks = [
    task({ id: "done", createdAt: 5, completedAt: 99 }),
    task({ id: "parent", createdAt: 10 }),
    task({ id: "child", createdAt: 20, parentId: "parent" }),
  ];
  assert.deepEqual(taskQueue(tasks).map((t) => t.id), ["child"]);
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

test("やめた 1 件だけが未完了なら元のまま返す（完了済みを数に入れない）", () => {
  const tasks = [
    task({ id: "a", createdAt: 10 }),
    task({ id: "b", createdAt: 20, completedAt: 30 }),
  ];
  // 完了済みの b が残るので「まだ候補がある」と誤判定していた
  assert.deepEqual(
    withoutPassed(tasks, new Set(["a"])).map((t) => t.id),
    ["a", "b"],
  );
});
