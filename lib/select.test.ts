import assert from "node:assert/strict";
import test from "node:test";
import { nextTask } from "./select.ts";
import type { Task } from "./types.ts";

const task = (over: Partial<Task> & { id: string; createdAt: number }): Task => ({
  title: over.id,
  estimateMin: 15,
  stimulation: 2,
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
