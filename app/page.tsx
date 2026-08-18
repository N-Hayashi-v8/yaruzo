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
      setEndAt(Date.now() + remaining * 1000);
    } else {
      setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
      setEndAt(null);
    }
  }, [taskId, endAt, remaining]);

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

  return (
    <>
      <main className="flex-1 flex flex-col items-center justify-center gap-10 p-8">
        {task ? (
          <>
            <h1 className="max-w-3xl text-center text-4xl font-bold leading-snug sm:text-6xl">
              {task.title}
            </h1>
            <div
              className={`font-mono text-7xl tabular-nums transition-opacity ${
                running ? "opacity-100" : "opacity-40"
              }`}
              aria-label={`残り ${mmss(remaining)}`}
            >
              {mmss(remaining)}
            </div>
            <div className="flex gap-3">
              <button
                onClick={toggle}
                className="rounded-full border border-current/30 px-6 py-2 text-sm"
              >
                {running ? "一時停止" : "開始"}
              </button>
              <button
                onClick={complete}
                className="rounded-full bg-foreground px-6 py-2 text-sm text-background"
              >
                完了
              </button>
            </div>
          </>
        ) : (
          <p className="text-2xl opacity-60">やること なし</p>
        )}

        <button
          onClick={() => setAdding(true)}
          className="text-sm opacity-50 underline underline-offset-4"
        >
          ＋ 追加
        </button>
        <p className="text-xs opacity-40">Space 開始／停止・Enter 完了・N 追加</p>
      </main>

      <footer className="p-4 text-center text-sm opacity-40">今月 {monthCount}</footer>

      {adding && (
        <div
          className="fixed inset-0 flex items-start justify-center bg-black/60 p-8 pt-32"
          onClick={() => setAdding(false)}
        >
          <input
            autoFocus
            value={draft}
            placeholder="やること"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") setAdding(false);
            }}
            className="w-full max-w-xl rounded-lg bg-background px-5 py-4 text-xl outline-none"
          />
        </div>
      )}
    </>
  );
}
