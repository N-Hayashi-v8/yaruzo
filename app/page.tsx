"use client";

import { useEffect, useState } from "react";
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
import {
  completedLeaves,
  hasStimulating,
  nextTask,
  pickedTask,
  taskQueue,
  withoutPassed,
} from "@/lib/select";
import { DONE_QUOTES, REST_QUOTES, pickQuote } from "@/lib/quotes";
import { pillarLabel, type PillarDef } from "@/lib/pillars";
import type { Pillar, Quote, Store, Task } from "@/lib/types";
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
  /** 経過秒。集中が切れるまでやるので上限なし（DESIGN.md 1章 時間盲） */
  const [elapsed, setElapsed] = useState(0);
  /** 実行中の仮想開始時刻(ms)。null = 停止中。実時刻から引く（タブ非表示で setInterval が絞られてもズレない） */
  const [startedAt, setStartedAt] = useState<number | null>(null);
  /** ponytail: 眠気モードはセッション限り。リロードで戻る。日をまたいで保つなら DayLog に足す */
  const [sleepy, setSleepy] = useState(false);
  /** 抽選で引いた 1 件。null = 引き直す（起動直後・完了直後・R） */
  const [pickedId, setPickedId] = useState<string | null>(null);
  /** 追加オーバーレイで選んでいる柱。既定は「その他」（雑タスクが一番多い） */
  const [addPillar, setAddPillar] = useState<Pillar | null>(null);
  /** 身体タスクは永続化しない。覚醒を戻すためだけの一時タスク */
  const [body, setBody] = useState<BodyTask | null>(null);
  /**
   * P で「いったんやめた」タスク。抽選から外れる。
   * 永続化しない（閉じれば戻る）。残すと「避けている一覧」になって罪悪感を作る
   */
  const [passed, setPassed] = useState<ReadonlySet<string>>(new Set());
  const [cheer, setCheer] = useState<{ word: string; quote: Quote } | null>(null);
  /** からっぽ画面に出す言葉。からっぽに入るたび引き直す（下の shownTaskId のブロック） */
  const [restQuote, setRestQuote] = useState<Quote>(() => pickQuote(REST_QUOTES));
  const running = startedAt !== null;

  // localStorage は client でしか読めない。lazy init だと hydration が食い違うので mount 後に読む
  useEffect(() => {
    const s = load();
    /* eslint-disable react-hooks/set-state-in-effect */
    setStore(s);
    setPickedId(nextTask(s.tasks)?.id ?? null); // 起動時に 1 回引く
    /* eslint-enable react-hooks/set-state-in-effect */

    // Service Worker。サーバを起動しなくてもアプリ窓が開くようにする（public/sw.js）。
    // dev で登録すると古いバンドルがキャッシュから返って開発が壊れるので本番だけ
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  const live = (tasks: Task[]) => withoutPassed(tasks, passed);

  const stored = store ? pickedTask(live(store.tasks), sleepy, pickedId) : null;
  const task = body ?? stored;
  const taskId = task?.id ?? null;
  const estimateMin = task?.estimateMin ?? 0;

  // タスクが変わったらタイマーを積み直す（render 中の state 調整。理由は上と同じ）
  const [shownTaskId, setShownTaskId] = useState(taskId);
  if (shownTaskId !== taskId) {
    setShownTaskId(taskId);
    setElapsed(0);
    setStartedAt(null);
    if (taskId === null) setRestQuote(pickQuote(REST_QUOTES)); // からっぽに入った
  }

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      250,
    );
    return () => clearInterval(id);
  }, [startedAt]);

  // 一言だけなら 1.6 秒で足りたが、名言を添えたので読む時間を足す
  useEffect(() => {
    if (cheer === null) return;
    const id = setTimeout(() => setCheer(null), 3600);
    return () => clearTimeout(id);
  }, [cheer]);

  // 以下のハンドラは useCallback で包まない。React Compiler が自動でメモ化する。
  // 手で包むと「既存のメモ化を保持できない」と判定されてコンパイル自体が飛ぶ
  const toggle = () => {
    if (!taskId) return;
    if (startedAt === null) {
      // 経過分を引いた時刻を開始点にすると、再開しても積み上がりが続く
      setStartedAt(Date.now() - elapsed * 1000);
    } else {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      setStartedAt(null);
    }
  };

  /** 保存して次の store を返す。完了後の抽選が更新後のタスクを要るので戻り値を持つ */
  const update = (fn: (s: Store) => Store) => {
    if (!store) return null;
    const next = fn(store);
    save(next);
    setStore(next);
    return next;
  };

  const complete = () => {
    if (!taskId) return;
    setCheer({
      word: CHEERS[Math.floor(Math.random() * CHEERS.length)],
      quote: pickQuote(DONE_QUOTES),
    });
    if (body) {
      setBody(null); // 身体タスクは記録に残さない
      return;
    }
    const next = update((s) => completeTask(s, taskId));
    if (next) setPickedId(nextTask(live(next.tasks), sleepy)?.id ?? null); // 済んだので次を引く
  };

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    update((s) => ({ ...s, tasks: [...s.tasks, newTask(title, addPillar)] }));
    setDraft("");
    setOverlay(null);
  };

  /** 柱の定番を 1 タップで生やす。preset が title / 目安 / 刺激度を上書きする */
  const addPreset = (key: Pillar | null, preset: PillarDef["presets"][number]) => {
    update((s) => ({ ...s, tasks: [...s.tasks, { ...newTask(preset.title, key), ...preset }] }));
    setOverlay(null);
  };

  /** 引き直し。いま出ている 1 件を外して抽選する（同じものが出たら意味がない） */
  const redraw = () => {
    if (!store || body) return;
    const rest = live(store.tasks).filter((t) => t.id !== pickedId);
    setPickedId(nextTask(rest, sleepy)?.id ?? null);
  };

  /**
   * いったんやめる。R と違って外した分が積み上がるので、押すたびに違うものが出る。
   * 全部やめたら積み上げを捨てて最初から引き直す（詰ませない）。
   */
  const pass = () => {
    if (!store || body || !taskId) return;
    const next = new Set(passed).add(taskId);
    const pick = nextTask(
      store.tasks.filter((t) => !next.has(t.id)),
      sleepy,
    );
    if (pick) {
      setPassed(next);
      setPickedId(pick.id);
    } else {
      setPassed(new Set());
      setPickedId(nextTask(store.tasks, sleepy)?.id ?? null);
    }
  };

  const split = () => {
    if (!taskId || body) return;
    if (steps.every((t) => t.trim() === "")) return;
    update((s) => splitTask(s, taskId, steps));
    setSteps(["", "", ""]);
    setOverlay(null);
  };

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
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        redraw();
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        pass();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // 依存配列なし = 毎 render 貼り替え。ハンドラは素の関数なのでどうせ毎回変わるし、
    // 古い closure を掴むより安い（リスナ 1 個の付け外し）
  });

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
  // 目安を超えたらバーが満ちて止まるだけ。超過を責めない（DESIGN.md 4章）
  const donePct = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;

  return (
    <>
      <header className="flex h-[68px] flex-shrink-0 items-center gap-6 bg-foreground px-6 text-background">
        {/* font-display は 30px 未満だと日本語の画数が潰れる（globals.css）。
            NOW は 26px で足りていたが、アプリ名にしたので下限まで上げる */}
        <span className="font-display text-[30px] tracking-[0.08em]">やるぞ！</span>
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
                <>
                  <span className="border-[3px] border-current bg-foreground px-3 py-1 text-sm font-bold tracking-[0.08em] text-background">
                    {pillarLabel(stored?.pillar ?? null)}
                  </span>
                  <span
                    className={`border-[3px] border-current px-3 py-1 text-sm font-bold tracking-[0.08em] ${
                      stored?.stimulation === 3 ? "bg-accent text-on-accent" : ""
                    }`}
                  >
                    刺激度 {stored?.stimulation}
                  </span>
                </>
              )}
              <span className="border-[3px] border-current px-3 py-1 text-sm font-bold tracking-[0.08em]">
                目安 {task.estimateMin}分
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
                  aria-label={`経過 ${mmss(elapsed)}`}
                >
                  {mmss(elapsed)}
                </div>
              </div>
              <div
                className="pb-4 text-[15px] font-bold tracking-[0.18em]"
                style={{ writingMode: "vertical-rl" }}
              >
                {running ? "実行中" : "停止中"}
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
                {running ? "一時停止" : "開始"}
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
                <span className="flex max-w-xl rotate-2 flex-col gap-1.5 bg-accent px-5 py-3 text-on-accent">
                  <span className="font-display text-2xl leading-none">{cheer.word}</span>
                  <span className="text-[13px] leading-snug font-bold">
                    {cheer.quote.text}
                    <span className="mt-0.5 block font-mono text-[11px] opacity-70">
                      — {cheer.quote.by}
                    </span>
                  </span>
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
            {/* 何もしていない状態を肯定する言葉だけ置く。ここで急かすと罪悪感になる */}
            {/* 1 行に収めるために幅は制限しない（親いっぱい）。訳は削らない方針。
                30px だと最長 46 字で 1380px 要るのでフル HD 未満だと折り返す。24px なら収まる */}
            <blockquote className="border-l-[10px] border-foreground pl-5">
              <p className="text-xl leading-snug font-black text-pretty sm:text-2xl">
                {restQuote.text}
              </p>
              <footer className="mt-2 font-mono text-[13px] font-bold opacity-60">
                — {restQuote.by}
              </footer>
            </blockquote>
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
        <HintButton keyLabel="R" label="引き直し" onClick={redraw} disabled={!stored} />
        <HintButton keyLabel="P" label="やめる" onClick={pass} disabled={!stored} />
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
          pillar={addPillar}
          onPillar={setAddPillar}
          onPreset={addPreset}
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
          onToggle={() => {
            setSleepy((v) => !v);
            setPickedId(null); // 並べ替えの基準が変わるので引き直す
          }}
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
