import type { Task } from "./types";

/**
 * 次にやる 1 件。未完了・子を持たない・作成が古い順。
 * 重要度／締切ソートは入れない（DESIGN.md 1章: 興味ベース神経系）。
 */
export function nextTask(tasks: Task[]): Task | null {
  const parentIds = new Set(
    tasks.map((t) => t.parentId).filter((id): id is string => id !== null),
  );
  return tasks.reduce<Task | null>((best, t) => {
    if (t.completedAt !== null || parentIds.has(t.id)) return best;
    return best === null || t.createdAt < best.createdAt ? t : best;
  }, null);
}
