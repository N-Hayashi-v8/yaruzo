import type { Task } from "./types";

/** 未完了で、子タスクを持たない（＝それ自体が着手できる）もの */
function candidates(tasks: Task[]): Task[] {
  const parentIds = new Set(
    tasks.map((t) => t.parentId).filter((id): id is string => id !== null),
  );
  return tasks.filter((t) => t.completedAt === null && !parentIds.has(t.id));
}

/**
 * 着手できるタスクを出す順に並べる。作成が古い順。
 * 重要度／締切ソートは入れない（DESIGN.md 1章: 興味ベース神経系）。
 */
export function taskQueue(tasks: Task[]): Task[] {
  return candidates(tasks).sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * 次にやる 1 件。並びの先頭をそのまま出す。抽選も重み付けもしない。
 * 気が乗らなければ `P` で送る（DESIGN.md 3章）。
 */
export function nextTask(tasks: Task[]): Task | null {
  return taskQueue(tasks)[0] ?? null;
}

/**
 * いま出している 1 件を id で取り戻す。候補から消えていれば先頭を出す。
 * 引き直すのは起動・完了・P のときだけ。表示のたびに引くと
 * 画面が勝手に入れ替わる。
 */
export function pickedTask(tasks: Task[], id: string | null): Task | null {
  const queue = taskQueue(tasks);
  return queue.find((t) => t.id === id) ?? queue[0] ?? null;
}

/**
 * 完了済みのうち、子を持たないもの。
 * 分解の親は子と二重に数えないため、カウントと今日の一覧はこれを使う。
 */
export function completedLeaves(tasks: Task[]): Task[] {
  const parentIds = new Set(
    tasks.map((t) => t.parentId).filter((id): id is string => id !== null),
  );
  return tasks.filter((t) => t.completedAt !== null && !parentIds.has(t.id));
}

/**
 * 「いったんやめた」分を除いた候補。
 * やめた結果 着手できるものが無くなったら元のまま返す。逃げ道を塞いで画面をからっぽにしない。
 * 残数ではなく candidates で見る。完了済みは残り続けるので、
 * 数だけ見ると「未完了はやめた 1 件だけ」でも 0 件と判定できずに からっぽ画面が出る。
 */
export function withoutPassed(tasks: Task[], passed: ReadonlySet<string>): Task[] {
  const rest = tasks.filter((t) => !passed.has(t.id));
  return candidates(rest).length > 0 ? rest : tasks;
}
