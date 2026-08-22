import { PILLARS } from "./pillars.ts";
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
 * 並んだ候補から柱を重み付きで引き、その柱の先頭を返す。
 * 在庫の無い柱は候補に入らない（デュエプレのタスクが無い昼は自動で 2 択になる）。
 */
function pickByPillar(queue: Task[], rand: () => number): Task {
  const live = PILLARS.filter((p) => queue.some((t) => t.pillar === p.key));
  const total = live.reduce((sum, p) => sum + p.weight, 0);
  let r = rand() * total;
  for (const p of live) {
    r -= p.weight;
    if (r < 0) return queue.find((t) => t.pillar === p.key) ?? queue[0];
  }
  return queue[0]; // 浮動小数の端で回りきったとき
}

/**
 * 次にやる 1 件。通常は柱の重み付き抽選。
 * 眠気モードだけは柱を無視する（覚醒を戻すのが先。刺激度が全て）。
 */
export function nextTask(
  tasks: Task[],
  sleepy = false,
  rand: () => number = Math.random,
): Task | null {
  const queue = taskQueue(tasks, sleepy);
  if (queue.length === 0) return null;
  return sleepy ? queue[0] : pickByPillar(queue, rand);
}

/**
 * 抽選で引いた 1 件を id で取り戻す。候補から消えていれば先頭を出す。
 * 引き直すのは起動・完了・R・眠気切替のときだけ。表示のたびに引くと
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
