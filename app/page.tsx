"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  addPreset,
  completeTask,
  load,
  logFor,
  newTask,
  presetsByRecent,
  putLog,
  removePreset,
  save,
  setEstimate,
  spawnFromPreset,
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
import type { Quote, Store, Task } from "@/lib/types";
import {
  AddOverlay,
  EstimateGrip,
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

/**
 * NOW の中身を差し替える。View Transitions で古い札と新しい札を繋ぐ（globals.css の view-transition-old/new）。
 * flushSync が要るのは、React が state 更新を後回しにすると
 * 「差し替え後」のスナップショットが撮れず、何も動かないから。
 * 未対応のブラウザではそのまま差し替える（動かないだけで結果は同じ）
 */
const swap = (kind: "add" | "pass" | DoneMotion, fn: () => void) => {
  if (typeof document === "undefined" || !document.startViewTransition) {
    fn();
    return;
  }
  const root = document.documentElement;
  root.dataset.vt = kind; // CSS 側の分岐。globals.css の html[data-vt=...]
  const clear = () => {
    delete root.dataset.vt;
  };
  probe(kind);
  // finished は途中で打ち切られると reject する。成功も失敗も同じ後始末
  document
    .startViewTransition(() => {
      const t = performance.now();
      flushSync(fn);
      if (probing()) console.log(`[vt:${kind}] 差し替え ${(performance.now() - t).toFixed(1)}ms`);
    })
    .finished.then(clear, clear);
};

/* ------------------------------------------------------------------
   動きのカクつきを切り分けるための一時コード。原因が分かったら消す。
   ?probe=1 を付けて開いたときだけ動く（yaruzo.bat の本番ビルドでも測れる）
   ------------------------------------------------------------------ */

const probing = () =>
  typeof window !== "undefined" && window.location.search.includes("probe");

/** 動いている間のフレーム間隔。fps が出ているのに滑らかでないのか、本当に落ちているのかを分ける */
function probe(kind: string) {
  if (!probing()) return;
  const t0 = performance.now();
  let last = t0;
  let frames = 0;
  let worst = 0;
  let worstAt = 0;
  const tick = (now: number) => {
    const gap = now - last;
    last = now;
    frames += 1;
    if (gap > worst) {
      worst = gap;
      worstAt = now - t0;
    }
    if (now - t0 < 900) {
      requestAnimationFrame(tick);
      return;
    }
    const ms = now - t0;
    console.log(
      `[vt:${kind}] ${frames}フレーム / ${Math.round(ms)}ms → 平均 ${Math.round(frames / (ms / 1000))}fps` +
        ` / 最悪フレーム ${worst.toFixed(1)}ms (開始 ${Math.round(worstAt)}ms 地点)`,
    );
  };
  requestAnimationFrame(tick);
}

/**
 * 完了したときの札の飛び方。毎回引く。
 * 1 種だと 2 日で見飽きる（DESIGN.md 4章 新規性減衰）。言葉だけ変えても動きが同じなら同じこと
 */
const DONE_MOTIONS = ["crumple", "toss", "flip"] as const;
type DoneMotion = (typeof DONE_MOTIONS)[number];

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
  /** いま出している 1 件。null = 引き直す（起動直後・完了直後・眠気切替） */
  const [pickedId, setPickedId] = useState<string | null>(null);
  /** 身体タスクは永続化しない。覚醒を戻すためだけの一時タスク */
  const [body, setBody] = useState<BodyTask | null>(null);
  /**
   * P で「いったんやめた」タスク。候補から外れる。
   * 永続化しない（閉じれば戻る）。残すと「避けている一覧」になって罪悪感を作る
   */
  const [passed, setPassed] = useState<ReadonlySet<string>>(new Set());
  /** 追加画面で決めた目安分。入れたら既定に戻す（前のタスクの値を引きずらせない） */
  const [draftMin, setDraftMin] = useState(15);
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

  /** 保存して次の store を返す。完了後に次を引くのが更新後のタスクを要るので戻り値を持つ */
  const update = (fn: (s: Store) => Store) => {
    if (!store) return null;
    const next = fn(store);
    if (next === store) return store; // 中身が変わっていない（ドラッグ中の据え置き等）。保存を挟まない
    save(next);
    setStore(next);
    return next;
  };

  const complete = () => {
    if (!taskId) return;
    swap(DONE_MOTIONS[Math.floor(Math.random() * DONE_MOTIONS.length)], () => {
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
    });
  };

  /**
   * 追加系の後始末。からっぽに 1 枚目が入るときだけ札が貼り付く動きを出す。
   * 既に札が出ているときは追加しても NOW は変わらない = 動かすと同じ絵が揺れるだけ
   */
  const addSwap = (fn: () => void) => (task ? fn() : swap("add", fn));

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    addSwap(() => {
      update((s) => ({ ...s, tasks: [...s.tasks, newTask(title, draftMin)] }));
      setDraft("");
      setDraftMin(15);
      setOverlay(null);
    });
  };

  /** 入れると同時に定番へ残す。次からは 1 タップで生える */
  const keep = () => {
    const title = draft.trim();
    if (!title) return;
    addSwap(() => {
      update((s) => addPreset({ ...s, tasks: [...s.tasks, newTask(title, draftMin)] }, title));
      setDraft("");
      setDraftMin(15);
      setOverlay(null);
    });
  };

  /** 定番を 1 タップで生やす */
  const spawn = (id: string) => {
    addSwap(() => {
      update((s) => spawnFromPreset(s, id));
      setOverlay(null);
    });
  };

  /**
   * いったんやめる。外した分が積み上がるので、押すたびに違うものが出る。
   * 全部やめたら積み上げを捨てて最初から引き直す（詰ませない）。
   */
  const pass = () => {
    if (!store || body || !taskId) return;
    const next = new Set(passed).add(taskId);
    const pick = nextTask(
      store.tasks.filter((t) => !next.has(t.id)),
      sleepy,
    );
    swap("pass", () => {
      if (pick) {
        setPassed(next);
        setPickedId(pick.id);
      } else {
        setPassed(new Set());
        setPickedId(nextTask(store.tasks, sleepy)?.id ?? null);
      }
    });
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
  // P で送った札。未完了のものだけ。閉じれば消える（passed は永続化しない）
  const passedTasks = store.tasks.filter((t) => passed.has(t.id) && t.completedAt === null);
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
        {/* 完了した札はここへ飛んでくる（globals.css の crumple/toss/flip）。
            受け取った側が跳ねないと、どこへ行ったのか分からない。
            key を数字にしてあるので、増えたときだけ animation が焼き直される */}
        <span className="font-mono text-[17px] font-bold tracking-[0.06em]">
          今月{" "}
          <span key={monthCount} className={cheer ? "anim-catch" : ""}>
            {monthCount}
          </span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* view-transition-name を main だけに付ける。差し替わるのはここの中身だけで、
            ヘッダ・フッタは静止させる（swap() と globals.css） */}
        <main
          style={{ viewTransitionName: "now" }}
          className="flex min-w-0 flex-1 flex-col justify-center gap-7 px-8 py-8 sm:px-12"
        >
          {task ? (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                {/* 刺激度は出さない。入力手段が無くて全部おなじ値になるので、
                    出しても情報が無い。眠気モードの並べ替えには裏で使う */}
                {body && (
                  <span className="border-[3px] border-current bg-accent px-3 py-1 text-sm font-bold tracking-[0.08em] text-on-accent">
                    身体タスク
                  </span>
                )}
                <EstimateGrip
                  min={task.estimateMin}
                  onMin={(min) => taskId && update((s) => setEstimate(s, taskId, min))}
                  fixed={body !== null}
                  className="border-[3px] border-current px-3 py-1 text-sm font-bold tracking-[0.08em]"
                />
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

              <div className="relative flex flex-wrap items-center gap-5">
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
                {/*
                  レイアウトから外して浮かせる。行の中に置くと、出るときと 3.6 秒後に消えるときの
                  2 回、行の高さが変わって画面全体がガクッと動く（main は justify-center）
                */}
                {cheer && (
                  <span className="anim-pop absolute top-full left-0 z-10 mt-4 flex max-w-xl rotate-2 flex-col gap-1.5 bg-accent px-5 py-3 text-on-accent">
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

        {/*
          P で送った札だけ出す。未着手の一覧でも残数でもない = 全体量は見せない（DESIGN.md 3章）。
          「消えてはいない」ことだけ渡す。押せないのは、選んで戻せると優先度を付ける操作になるから。
          永続化しないので閉じれば消える（残すと「避けている一覧」になる。4章）。
          狭い画面では出さない。NOW を細くするほうが害が大きい
        */}
        {passedTasks.length > 0 && (
          <aside className="hidden w-60 flex-shrink-0 flex-col gap-3 overflow-y-auto border-l-4 border-foreground px-5 py-8 lg:flex">
            <span className="font-mono text-xs font-bold tracking-[0.12em] opacity-55">あとで</span>
            {passedTasks.map((t) => (
              <span
                key={t.id}
                className="border-[3px] border-current px-3 py-2 text-[15px] leading-snug font-bold opacity-70"
              >
                {t.title}
              </span>
            ))}
          </aside>
        )}
      </div>

      {/* キーが押せない環境（スマホ）でも同じ操作ができるよう、ヒントはそのままボタン */}
      <footer className="flex min-h-[54px] flex-shrink-0 items-center gap-1 overflow-x-auto bg-foreground px-3 font-mono text-[13px] font-bold tracking-[0.06em] text-background sm:gap-2 sm:px-5">
        <HintButton keyLabel="SPACE" label="開始/停止" onClick={toggle} disabled={!task} />
        <HintButton keyLabel="ENTER" label="完了" onClick={complete} disabled={!task} />
        <HintButton keyLabel="N" label="追加" onClick={() => setOverlay("add")} />
        <HintButton keyLabel="P" label="やめる" onClick={pass} disabled={!stored || body !== null} />
        <HintButton
          keyLabel="D"
          label="分解"
          onClick={() => setOverlay("split")}
          disabled={!stored || body !== null}
        />
        <HintButton keyLabel="S" label="眠い" onClick={() => setOverlay("sleepy")} />
        <HintButton keyLabel="T" label="今日" onClick={() => setOverlay("today")} />
      </footer>

      {overlay === "add" && (
        <AddOverlay
          draft={draft}
          onDraft={setDraft}
          presets={presetsByRecent(store)}
          onSpawn={spawn}
          onRemovePreset={(id) => update((s) => removePreset(s, id))}
          onAdd={add}
          onKeep={keep}
          onClose={() => setOverlay(null)}
          min={draftMin}
          onMin={setDraftMin}
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
