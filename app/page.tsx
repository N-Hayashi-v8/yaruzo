"use client";

import { useCallback, useEffect, useState } from "react";
import { load, newTask, save } from "@/lib/store";
import { nextTask } from "@/lib/select";
import type { Store } from "@/lib/types";

const mmss = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

const isThisMonth = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export default function Home() {
  const [store, setStore] = useState<Store | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [remaining, setRemaining] = useState(0);
  /** 実行中の終了時刻(ms)。null = 停止中。経過は実時刻から引く（タブ非表示で setInterval が絞られてもズレない） */
  const [endAt, setEndAt] = useState<number | null>(null);
  const running = endAt !== null;

  // localStorage は client でしか読めない。lazy init だと hydration が食い違うので mount 後に読む
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setStore(load()), []);

  const task = store ? nextTask(store.tasks) : null;
  const taskId = task?.id ?? null;
  const estimateMin = task?.estimateMin ?? 0;

  // タスクが変わったらタイマーを積み直す（render 中の state 調整。effect にすると 1 フレーム古い値が出る）
  const [shownTaskId, setShownTaskId] = useState(taskId);
  if (shownTaskId !== taskId) {
    setShownTaskId(taskId);
    setRemaining(estimateMin * 60);
    setEndAt(null);
  }

  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setEndAt(null);
    }, 250);
    return () => clearInterval(id);
  }, [endAt]);

  const toggle = useCallback(() => {
    if (!taskId) return;
    if (endAt === null) {
      // 0 まで落ちた後の再開は見積分から積み直す（行き止まりにしない）
      const from = remaining > 0 ? remaining : estimateMin * 60;
      setRemaining(from);
      setEndAt(Date.now() + from * 1000);
    } else {
      setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
      setEndAt(null);
    }
  }, [taskId, endAt, remaining, estimateMin]);

  const update = useCallback(
    (fn: (s: Store) => Store) => {
      if (!store) return;
      const next = fn(store);
      save(next);
      setStore(next);
    },
    [store],
  );

  const complete = useCallback(() => {
    if (!taskId) return;
    update((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, completedAt: Date.now() } : t,
      ),
    }));
  }, [taskId, update]);

  const add = useCallback(() => {
    const title = draft.trim();
    if (!title) return;
    update((s) => ({ ...s, tasks: [...s.tasks, newTask(title)] }));
    setDraft("");
    setAdding(false);
  }, [draft, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (adding) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // 入力欄で押されたキーは奪わない。
      // 追加確定の Enter は setAdding(false) を挟んでから window まで伝播しきるので、
      // adding フラグだけでは間に合わず「追加した直後に完了」してしまう。
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.isComposing) return; // IME 変換確定の Enter を拾わない
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Enter") {
        e.preventDefault();
        complete();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setAdding(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adding, toggle, complete]);

  if (!store) return null;

  const monthCount = store.tasks.filter(
    (t) => t.completedAt !== null && isThisMonth(t.completedAt),
  ).length;
  const total = estimateMin * 60;
  const donePct = total > 0 ? Math.round((1 - remaining / total) * 100) : 0;

  return (
    <>
      <header className="flex h-[68px] flex-shrink-0 items-center gap-6 bg-foreground px-6 text-background">
        <span className="font-display text-[26px] tracking-[0.14em]">NOW</span>
        <span className="h-5 flex-1 bg-[repeating-linear-gradient(135deg,currentColor_0_6px,transparent_6px_14px)] opacity-55" />
        <span className="font-mono text-[17px] font-bold tracking-[0.06em]">
          今月 {monthCount}
        </span>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-7 px-8 py-8 sm:px-12">
        {task ? (
          <>
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`border-[3px] border-current px-3 py-1 text-sm font-black tracking-[0.08em] ${
                  task.stimulation === 3 ? "bg-accent text-on-accent" : ""
                }`}
              >
                刺激度 {task.stimulation}
              </span>
              <span className="border-[3px] border-current px-3 py-1 text-sm font-bold tracking-[0.08em]">
                見積 {task.estimateMin}分
              </span>
              <span className="flex-1" />
              <span className="font-mono text-[13px] font-bold opacity-50">1件だけ 表示</span>
            </div>

            <h1 className="max-w-3xl font-display text-5xl leading-[1.08] tracking-tight text-pretty sm:text-7xl">
              {task.title}
            </h1>

            <div className="flex items-end gap-7">
              <div
                className={`-rotate-1 border-[5px] border-current px-7 pt-1.5 pb-2.5 shadow-[12px_12px_0_currentColor] ${
                  running ? "bg-accent text-on-accent" : ""
                }`}
              >
                <div
                  className="font-mono text-6xl leading-none font-black tabular-nums sm:text-8xl"
                  aria-label={`残り ${mmss(remaining)}`}
                >
                  {mmss(remaining)}
                </div>
              </div>
              <div
                className="pb-4 text-[15px] font-black tracking-[0.18em]"
                style={{ writingMode: "vertical-rl" }}
              >
                {running ? "実行中" : remaining === 0 ? "時間切れ" : "停止中"}
              </div>
            </div>

            <div className="flex h-7 max-w-3xl border-4 border-current p-[3px]">
              <div className="bg-current" style={{ width: `${donePct}%` }} />
            </div>

            <div className="flex flex-wrap gap-5">
              <button
                onClick={toggle}
                className="flex min-h-14 items-center gap-3 border-4 border-current px-6 py-3 text-lg font-black shadow-[8px_8px_0_currentColor]"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" aria-hidden>
                  {running ? (
                    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                  ) : (
                    <path d="M6 3l14 9-14 9z" />
                  )}
                </svg>
                {running ? "一時停止" : remaining === 0 ? "もう一回" : "開始"}
                <span className="border-2 border-current px-1.5 py-0.5 font-mono text-xs opacity-75">
                  SPACE
                </span>
              </button>
              <button
                onClick={complete}
                className="flex min-h-14 items-center gap-3 border-4 border-foreground bg-foreground px-6 py-3 text-lg font-black text-background shadow-[8px_8px_0_var(--accent)]"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 13l6 6L21 5" />
                </svg>
                完了
                <span className="border-2 border-current px-1.5 py-0.5 font-mono text-xs opacity-75">
                  ENTER
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-6xl leading-none tracking-tight sm:text-[7rem]">
              からっぽ。
            </h1>
            <div className="flex items-center gap-5">
              <span className="h-2.5 w-44 border-[3px] border-current bg-accent" />
              <span className="text-lg font-bold">やること なし。それでいい。</span>
            </div>
            <button
              onClick={() => setAdding(true)}
              className="flex min-h-[68px] items-center gap-3.5 self-start border-[5px] border-foreground bg-accent px-7 py-3.5 font-display text-2xl text-on-accent shadow-[10px_10px_0_var(--color-foreground)] sm:text-3xl"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              追加する
              <span className="border-2 border-current px-2 py-1 font-mono text-[13px]">N</span>
            </button>
          </>
        )}
      </main>

      <footer className="flex h-[54px] flex-shrink-0 items-center gap-6 bg-foreground px-6 font-mono text-[13px] font-bold tracking-[0.06em] text-background">
        <span>SPACE 開始/停止</span>
        <span>ENTER 完了</span>
        <span>N 追加</span>
        <span className="flex-1" />
        <span className="hidden opacity-60 sm:inline">リストは出さない</span>
      </footer>

      {adding && (
        <div
          className="fixed inset-0 flex items-start justify-center bg-[rgba(22,19,15,0.74)] p-6 pt-28"
          onClick={() => setAdding(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-4xl -rotate-[0.7deg] flex-col gap-5 border-[6px] border-foreground bg-background p-8 shadow-[16px_16px_0_var(--accent)]"
          >
            <div className="flex flex-wrap items-baseline gap-4">
              <span className="font-display text-4xl">追加</span>
              <span className="text-[15px] font-bold opacity-60">1行だけ。それ以上 聞かない。</span>
              <span className="flex-1" />
              <span className="border-[3px] border-current px-2 py-1 font-mono text-[13px] font-bold">
                N
              </span>
            </div>

            <input
              autoFocus
              value={draft}
              placeholder="やること"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
                if (e.key === "Escape") setAdding(false);
              }}
              className="w-full border-[5px] border-foreground bg-background px-5 py-4 text-2xl font-black outline-none placeholder:text-current placeholder:opacity-35 sm:text-4xl"
            />

            <div className="flex flex-wrap items-center gap-3">
              <span className="border-[3px] border-current px-3.5 py-1.5 text-[15px] font-black">
                見積 15分
              </span>
              <span className="border-[3px] border-current px-3.5 py-1.5 text-[15px] font-black">
                刺激度 2
              </span>
              <span className="text-[15px] font-bold opacity-60">← 初期値。あとで変えられる</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t-4 border-foreground pt-5">
              <button
                onClick={add}
                className="flex min-h-14 items-center gap-3 border-4 border-foreground bg-accent px-6 py-3 text-lg font-black text-on-accent shadow-[8px_8px_0_var(--color-foreground)]"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 12h14M13 6l6 6-6 6" />
                </svg>
                入れる
                <span className="border-2 border-current px-1.5 py-0.5 font-mono text-xs">ENTER</span>
              </button>
              <span className="font-mono text-[13px] font-bold opacity-60">ESC 閉じる</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
