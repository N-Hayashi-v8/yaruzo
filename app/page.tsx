"use client";

import { useCallback, useEffect, useState } from "react";
import {
  completeTask,
  load,
  logFor,
  newTask,
  putLog,
  save,
  splitTask,
  todayKey,
} from "@/lib/store";
import { completedLeaves, hasStimulating, nextTask, taskQueue } from "@/lib/select";
import type { Store } from "@/lib/types";
import {
  AddOverlay,
  SleepyOverlay,
  SplitOverlay,
  TodayOverlay,
  type BodyTask,
} from "./overlays";

const mmss = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

const isThisMonth = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

/** 完了時の一言。毎回同じだと 2 日で効かなくなる（DESIGN.md 4章: 新規性減衰） */
const CHEERS = ["よし", "済", "片付いた", "いいぞ", "1個 減った", "続けろ"];

type OverlayName = "add" | "split" | "sleepy" | "today";

/** フッターのキーヒント。押せる（タッチだけの端末でも操作できる） */
function HintButton({
  keyLabel,
  label,
  onClick,
  disabled = false,
}: {
  keyLabel: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-keyshortcuts={keyLabel.toLowerCase()}
      className="flex min-h-11 items-center gap-1.5 px-2 whitespace-nowrap hover:bg-background hover:text-foreground active:bg-accent active:text-on-accent disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-current"
    >
      <span className="border-2 border-current px-1.5 py-0.5 text-[11px]">{keyLabel}</span>
      <span>{label}</span>
    </button>
  );
}

export default function Home() {
  const [store, setStore] = useState<Store | null>(null);
  const [overlay, setOverlay] = useState<OverlayName | null>(null);
  const [draft, setDraft] = useState("");
  const [steps, setSteps] = useState(["", "", ""]);
  const [remaining, setRemaining] = useState(0);
  /** 実行中の終了時刻(ms)。null = 停止中。経過は実時刻から引く（タブ非表示で setInterval が絞られてもズレない） */
  const [endAt, setEndAt] = useState<number | null>(null);
  /** ponytail: 眠気モードはセッション限り。リロードで戻る。日をまたいで保つなら DayLog に足す */
  const [sleepy, setSleepy] = useState(false);
  /** 身体タスクは永続化しない。覚醒を戻すためだけの一時タスク */
  const [body, setBody] = useState<BodyTask | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const running = endAt !== null;

  // localStorage は client でしか読めない。lazy init だと hydration が食い違うので mount 後に読む
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setStore(load()), []);

  const stored = store ? nextTask(store.tasks, sleepy) : null;
  const task = body ?? stored;
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

  useEffect(() => {
    if (cheer === null) return;
    const id = setTimeout(() => setCheer(null), 1600);
    return () => clearTimeout(id);
  }, [cheer]);

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
    setCheer(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
    if (body) {
      setBody(null); // 身体タスクは記録に残さない
      return;
    }
    update((s) => completeTask(s, taskId));
  }, [taskId, body, update]);

  const add = useCallback(() => {
    const title = draft.trim();
    if (!title) return;
    update((s) => ({ ...s, tasks: [...s.tasks, newTask(title)] }));
    setDraft("");
    setOverlay(null);
  }, [draft, update]);

  const split = useCallback(() => {
    if (!taskId || body) return;
    if (steps.every((t) => t.trim() === "")) return;
    update((s) => splitTask(s, taskId, steps));
    setSteps(["", "", ""]);
    setOverlay(null);
  }, [taskId, body, steps, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (overlay !== null) {
        if (e.key === "Escape") setOverlay(null);
        return;
      }
      // 入力欄で押されたキーは奪わない。
      // 追加確定の Enter は setOverlay(null) を挟んでから window まで伝播しきるので、
      // overlay フラグだけでは間に合わず「追加した直後に完了」してしまう。
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
        setOverlay("add");
      } else if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (!body) setOverlay("split"); // 身体タスクは分解しない
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        setOverlay("sleepy");
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setOverlay("today");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, body, toggle, complete]);

  if (!store) return null;

  // 分解の親は子と二重に数えない
  const completed = completedLeaves(store.tasks);
  const monthCount = completed.filter((t) => isThisMonth(t.completedAt ?? 0)).length;
  const today = todayKey();
  const doneToday = completed
    .filter((t) => todayKey(new Date(t.completedAt ?? 0)) === today)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
  const log = logFor(store, today);
  const total = estimateMin * 60;
  const donePct = total > 0 ? Math.round((1 - remaining / total) * 100) : 0;

  return (
    <>
      <header className="flex h-[68px] flex-shrink-0 items-center gap-6 bg-foreground px-6 text-background">
        <span className="font-display text-[26px] tracking-[0.14em]">NOW</span>
        <span className="h-5 flex-1 bg-[repeating-linear-gradient(135deg,currentColor_0_6px,transparent_6px_14px)] opacity-55" />
        {sleepy && (
          <span className="border-2 border-current px-2 py-0.5 font-mono text-xs font-bold tracking-[0.1em]">
            眠気モード
          </span>
        )}
        <span className="font-mono text-[17px] font-bold tracking-[0.06em]">
          今月 {monthCount}
        </span>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-7 px-8 py-8 sm:px-12">
        {task ? (
          <>
            <div className="flex flex-wrap items-center gap-2.5">
              {body ? (
                <span className="border-[3px] border-current bg-accent px-3 py-1 text-sm font-bold tracking-[0.08em] text-on-accent">
                  身体タスク
                </span>
              ) : (
                <span
                  className={`border-[3px] border-current px-3 py-1 text-sm font-bold tracking-[0.08em] ${
                    stored?.stimulation === 3 ? "bg-accent text-on-accent" : ""
                  }`}
                >
                  刺激度 {stored?.stimulation}
                </span>
              )}
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
                className="pb-4 text-[15px] font-bold tracking-[0.18em]"
                style={{ writingMode: "vertical-rl" }}
              >
                {running ? "実行中" : remaining === 0 ? "時間切れ" : "停止中"}
              </div>
            </div>

            <div className="flex h-7 max-w-3xl border-4 border-current p-[3px]">
              <div className="bg-current" style={{ width: `${donePct}%` }} />
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <button
                onClick={toggle}
                className="flex min-h-14 items-center gap-3 border-4 border-current px-6 py-3 text-lg font-bold shadow-[8px_8px_0_currentColor]"
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
                className="flex min-h-14 items-center gap-3 border-4 border-foreground bg-foreground px-6 py-3 text-lg font-bold text-background shadow-[8px_8px_0_var(--accent)]"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 13l6 6L21 5" />
                </svg>
                完了
                <span className="border-2 border-current px-1.5 py-0.5 font-mono text-xs opacity-75">
                  ENTER
                </span>
              </button>
              {cheer && (
                <span className="rotate-3 bg-accent px-5 py-2.5 font-display text-2xl text-on-accent">
                  {cheer}
                </span>
              )}
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
              onClick={() => setOverlay("add")}
              className="flex min-h-[68px] items-center gap-3.5 self-start border-[5px] border-foreground bg-accent px-7 py-3.5 text-2xl font-black text-on-accent shadow-[10px_10px_0_var(--color-foreground)] sm:text-3xl"
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

      {/* キーが押せない環境（スマホ）でも同じ操作ができるよう、ヒントはそのままボタン */}
      <footer className="flex min-h-[54px] flex-shrink-0 items-center gap-1 overflow-x-auto bg-foreground px-3 font-mono text-[13px] font-bold tracking-[0.06em] text-background sm:gap-2 sm:px-5">
        <HintButton keyLabel="SPACE" label="開始/停止" onClick={toggle} disabled={!task} />
        <HintButton keyLabel="ENTER" label="完了" onClick={complete} disabled={!task} />
        <HintButton keyLabel="N" label="追加" onClick={() => setOverlay("add")} />
        <HintButton
          keyLabel="D"
          label="分解"
          onClick={() => setOverlay("split")}
          disabled={!stored || body !== null}
        />
        <HintButton keyLabel="S" label="眠い" onClick={() => setOverlay("sleepy")} />
        <HintButton keyLabel="T" label="今日" onClick={() => setOverlay("today")} />
        <span className="flex-1" />
        <span className="hidden opacity-60 lg:inline">リストは出さない</span>
      </footer>

      {overlay === "add" && (
        <AddOverlay
          draft={draft}
          onDraft={setDraft}
          onAdd={add}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay === "split" && stored && (
        <SplitOverlay
          title={stored.title}
          steps={steps}
          onStep={(i, v) => setSteps((prev) => prev.map((s, j) => (j === i ? v : s)))}
          onSplit={split}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay === "sleepy" && (
        <SleepyOverlay
          sleepy={sleepy}
          onToggle={() => setSleepy((v) => !v)}
          hasStim={hasStimulating(store.tasks)}
          queue={taskQueue(store.tasks, sleepy).slice(0, 3)}
          onPickBody={(b) => {
            setBody(b);
            setOverlay(null);
          }}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay === "today" && (
        <TodayOverlay
          done={doneToday}
          wakeAt={log.wakeAt ?? ""}
          onWake={(v) => update((s) => putLog(s, { ...log, wakeAt: v || null }))}
          gotLight={log.gotLight}
          onToggleLight={() => update((s) => putLog(s, { ...log, gotLight: !log.gotLight }))}
          monthCount={monthCount}
          totalCount={completed.length}
          onClose={() => setOverlay(null)}
        />
      )}
    </>
  );
}
