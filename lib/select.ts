import type { Task } from "./types";

/** 未完了で、子タスクを持たない（＝それ自体が着手できる）もの */
function candidates(tasks: Task[]): Task[] {
  const parentIds = new Set(
    tasks.map((t) => t.parentId).filter((id): id is string => id !== null),
  );
  return tasks.filter((t) => t.completedAt === null && !parentIds.has(t.id));
}

/**
 * 着手できるタスクを出す順に並べる。通常は作成が古い順。
 * sleepy = true なら刺激度の高い順、同じ刺激度なら古い順（DESIGN.md 3章 眠い）。
 * 重要度／締切ソートは入れない（DESIGN.md 1章: 興味ベース神経系）。
 */
export function taskQueue(tasks: Task[], sleepy = false): Task[] {
  return candidates(tasks).sort(
    (a, b) => (sleepy ? b.stimulation - a.stimulation : 0) || a.createdAt - b.createdAt,
  );
}

/** 次にやる 1 件 */
export function nextTask(tasks: Task[], sleepy = false): Task | null {
  return taskQueue(tasks, sleepy)[0] ?? null;
}

/**
 * 眠気モードで出せる刺激（刺激度 3）が在庫にあるか。
 * なければ身体タスクを出す（DESIGN.md 3章: 該当タスクなし → 5分の身体タスク）。
 */
export function hasStimulating(tasks: Task[]): boolean {
  return candidates(tasks).some((t) => t.stimulation === 3);
}
