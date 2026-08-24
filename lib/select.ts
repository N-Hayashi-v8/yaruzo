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

/**
 * 次にやる 1 件。並びの先頭をそのまま出す。抽選も重み付けもしない。
 * 気が乗らなければ `P` で送る（DESIGN.md 3章）。
 */
export function nextTask(tasks: Task[], sleepy = false): Task | null {
  return taskQueue(tasks, sleepy)[0] ?? null;
}

/**
 * いま出している 1 件を id で取り戻す。候補から消えていれば先頭を出す。
 * 引き直すのは起動・完了・P・眠気切替のときだけ。表示のたびに引くと
 * 画面が勝手に入れ替わる。
 */
export function pickedTask(tasks: Task[], sleepy: boolean, id: string | null): Task | null {
  const queue = taskQueue(tasks, sleepy);
  return queue.find((t) => t.id === id) ?? queue[0] ?? null;
}

/**
 * 眠気モードで出せる刺激（刺激度 3）が在庫にあるか。
 * なければ身体タスクを出す（DESIGN.md 3章: 該当タスクなし → 5分の身体タスク）。
 */
export function hasStimulating(tasks: Task[]): boolean {
  return candidates(tasks).some((t) => t.stimulation === 3);
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
 * 全部やめていたら元のまま返す。逃げ道を塞いで画面をからっぽにしない。
 */
export function withoutPassed(tasks: Task[], passed: ReadonlySet<string>): Task[] {
  const rest = tasks.filter((t) => !passed.has(t.id));
  return rest.length > 0 ? rest : tasks;
}
