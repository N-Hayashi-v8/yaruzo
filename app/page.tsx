"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  addPlan,
  addPreset,
  completeTask,
  hhmm,
  load,
  logFor,
  newTask,
  plansFor,
  presetsByRecent,
  putLog,
  removePlan,
  removePreset,
  save,
  setEstimate,
  spawnFromPreset,
  splitTask,
  todayKey,
  updatePlan,
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
  Glyph,
  PATHS,
  SleepyOverlay,
  SplitOverlay,
  TodayOverlay,
  type BodyTask,
} from "./overlays";

const mmss = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/** 約束までの残り。1 時間を超えたら分だけの数字は量として掴みにくいので時間を出す */
const until = (min: number) => {
  if (min <= 0) return "いま";
  if (min < 60) return `あと ${min}分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `あと ${h}時間` : `あと ${h}時間${m}分`;
};

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
  // 動いている最中に次を始めると、前の動きが打ち切られて瞬間的に飛ぶ。
  // P の連打はふつうの使い方なので、そのときは動きを諦めてそのまま差し替える
  if (typeof document === "undefined" || !document.startViewTransition || vtRunning) {
    fn();
    return;
  }
  vtRunning = true;
  const root = document.documentElement;
  root.dataset.vt = kind; // CSS 側の分岐。globals.css の html[data-vt=...]
  const done = () => {
    delete root.dataset.vt;
    vtRunning = false;
  };
  // finished は途中で打ち切られると reject する。成功も失敗も同じ後始末
  document.startViewTransition(() => flushSync(fn)).finished.then(done, done);
};

let vtRunning = false;

/**
 * 完了したときの札の飛び方。毎回引く。
 * 1 種だと 2 日で見飽きる（DESIGN.md 4章 新規性減衰）。言葉だけ変えても動きが同じなら同じこと
 */
const DONE_MOTIONS = ["crumple", "toss", "flip"] as const;
type DoneMotion = (typeof DONE_MOTIONS)[number];

type OverlayName = "add" | "split" | "sleepy" | "today";

/** 下端の操作札 1 つ分。d = アイコンの形（PATHS）、w = 線の太さ、off = 押せない */
type Hint = {
  d: string;
  w?: number;
  label: string;
  keyLabel: string;
  on: () => void;
  off?: boolean;
};

/**
 * フッターのボタン。アイコン + ラベルは常に出す（タッチ操作が主）。
 * キー表示は PC 幅（lg 以上）でだけ添える
 */
function HintButton({ d, w, label, keyLabel, on, off }: Hint) {
  return (
    <button
      onClick={on}
      disabled={off}
      // aria-keyshortcuts の綴りは `Space` `Enter`（頭だけ大文字）。画面の表示は SPACE のまま
      aria-keyshortcuts={keyLabel[0] + keyLabel.slice(1).toLowerCase()}
      className="flex min-h-11 items-center gap-1.5 px-2 whitespace-nowrap hover:bg-background hover:text-foreground active:bg-accent active:text-on-accent disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-current"
    >
      <Glyph d={d} width={w} />
      <span>{label}</span>
      <span className="hidden border-2 border-current px-1.5 py-0.5 text-[11px] lg:inline">
        {keyLabel}
      </span>
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
  /** 右の柱から押された約束。「今日」画面をその編集で開く。閉じれば戻す */
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  /** からっぽ画面に出す言葉。からっぽに入るたび引き直す（下の shownTaskId のブロック） */
  const [restQuote, setRestQuote] = useState<Quote>(() => pickQuote(REST_QUOTES));
  /**
   * 次に出る札を 実行中で始めるときの開始時刻(ms)。null = 止まった状態で出す。
   * 追加系が からっぽに 1枚目を入れたときだけ入る。
   * 札が既に出ているなら NOW は変わらない = 開始する対象が無いので入れない。
   * 真偽値でなく時刻を持つのは、render 中に Date.now() を呼べないから（lint: purity）。
   * 押した瞬間を持つので、描画までの分がズレない
   */
  const [autoStart, setAutoStart] = useState<number | null>(null);
  const running = startedAt !== null;

  // 保存先は client でしか読めない。lazy init だと hydration が食い違うので mount 後に読む。
  // IndexedDB は非同期なので、読めるまで store は null（画面はまだ何も出さない）
  useEffect(() => {
    let alive = true;
    void load().then((s) => {
      if (!alive) return; // 読んでいる途中で外れた
      setStore(s);
      setPickedId(nextTask(s.tasks)?.id ?? null); // 起動時に 1 回引く
    });

    return () => {
      alive = false;
    };
  }, []);

  const live = (tasks: Task[]) => withoutPassed(tasks, passed);

  const stored = store ? pickedTask(live(store.tasks), sleepy, pickedId) : null;
  const task = body ?? stored;
  const taskId = task?.id ?? null;
  const estimateMin = task?.estimateMin ?? 0;

  // タスクが変わったらタイマーを積み直す（effect を挟まず render 中に直す）
  const [shownTaskId, setShownTaskId] = useState(taskId);
  if (shownTaskId !== taskId) {
    setShownTaskId(taskId);
    setElapsed(0);
    // 入れた札が そのまま NOW になったときは 止まった状態から始めない。
    // 入れる = やる気になった瞬間なので、そこで もう一度「開始」を押させるのは摩擦
    setStartedAt(autoStart);
    setAutoStart(null);
    if (taskId === null) setRestQuote(pickQuote(REST_QUOTES)); // からっぽに入った
  }

  /**
   * いまの時刻。分単位の epoch で持つ。
   * 1 秒ごとに叩いても値が変わるのは分が変わったときだけなので、再描画も毎分で済む
   */
  const [minute, setMinute] = useState(0);
  useEffect(() => {
    const tick = () => setMinute(Math.floor(Date.now() / 60000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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

  // 以下のハンドラは useCallback で包まない。lint（react-hooks の compiler 由来のルール）が
  // 「既存のメモ化を保持できない」で落ちる。子は誰もメモ化していないので、
  // 毎 render 作り直しても実害は無い
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
  const addSwap = (fn: () => void) => {
    if (task) return fn(); // 既に札が出ている。NOW は変わらないので 動かさないし 開始もしない
    setAutoStart(Date.now()); // 入れた 1枚目が NOW になる。押した時刻から実行中で出す
    swap("add", fn);
  };

  /** 「今日」画面を開く。約束の id を渡すとその編集から始まる（右の柱を押したとき） */
  const openToday = (planId: string | null = null) => {
    setEditPlanId(planId);
    setOverlay("today");
  };

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
    const next = update((s) => splitTask(s, taskId, steps));
    // 親は子ができた時点で候補から外れる。引き直さないと pickedTask が
    // 先頭（= 一番古い別のタスク）を返して、いま割ったステップ 1 に入れない
    const first = next?.tasks.find((t) => t.parentId === taskId);
    if (first) setPickedId(first.id);
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
        // 身体タスクは分解しない。からっぽでも開かない
        // （札が無いと中身が描かれず、キーだけ overlay に吸われて操作不能になる）
        if (!body && stored) setOverlay("split");
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        setOverlay("sleepy");
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        openToday();
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

  // いまの時刻と、今日の約束。分が変わったときだけ計算し直る（minute が変わらないと再描画されない）
  const clock = new Date(minute * 60000);
  const nowHm = hhmm(clock);
  const plans = plansFor(store, today);
  const nextPlan = plans.find((p) => p.at > nowHm) ?? null;
  const minsToNext = nextPlan
    ? (Number(nextPlan.at.slice(0, 2)) - clock.getHours()) * 60 +
      (Number(nextPlan.at.slice(3, 5)) - clock.getMinutes())
    : 0;

  const noCard = !stored || body !== null; // 身体タスク中と からっぽ では 送れない・割れない
  // 開始/停止 と 完了 は置かない。NOW に大きいボタンが常に出ていて、そちらしか押さない
  const hints: Hint[] = [
    { d: PATHS.plus, w: 3.5, label: "追加", keyLabel: "N", on: () => setOverlay("add") },
    { d: PATHS.pass, label: "やめる", keyLabel: "P", on: pass, off: noCard },
    { d: PATHS.split, label: "分解", keyLabel: "D", on: () => setOverlay("split"), off: noCard },
    { d: PATHS.sleepy, w: 2.5, label: "眠い", keyLabel: "S", on: () => setOverlay("sleepy") },
    { d: PATHS.today, w: 2.5, label: "今日", keyLabel: "T", on: () => openToday() },
  ];

  return (
    <>
      {/* 高さは 68px + ノッチ/ステータスバーぶん。padding だけだと中身が潰れる（border-box） */}
      <header className="flex h-[calc(68px_+_env(safe-area-inset-top))] flex-shrink-0 items-center gap-6 bg-foreground px-6 pt-[env(safe-area-inset-top)] text-background">
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
        <main className="flex min-w-0 flex-1 flex-col justify-center gap-7 px-8 py-8 sm:px-12">
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

              {/*
                動かすのは札 = このタイトルだけ。main ごと名前を付けると画面の 8 割を占める
                ビットマップを毎フレーム変形することになって描画が追いつかない。
                タイマーやボタンは常設の道具なので、飛ばさず即差し替える
              */}
              <h1
                style={{ viewTransitionName: "now" }}
                className="max-w-3xl font-display text-5xl leading-[1.08] tracking-tight text-pretty sm:text-7xl"
              >
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
                  <Glyph d={running ? PATHS.pause : PATHS.play} size={22} />
                  {running ? "一時停止" : "開始"}
                  <span className="hidden border-2 border-current px-1.5 py-0.5 font-mono text-xs opacity-75 lg:inline">
                    SPACE
                  </span>
                </button>
                <button
                  onClick={complete}
                  className="flex min-h-14 items-center gap-3 border-4 border-foreground bg-foreground px-6 py-3 text-lg font-bold text-background shadow-[8px_8px_0_var(--accent)]"
                >
                  <Glyph d={PATHS.check} size={22} width={3.5} />
                  完了
                  <span className="hidden border-2 border-current px-1.5 py-0.5 font-mono text-xs opacity-75 lg:inline">
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
              {/* タスク側の h1 と同じ名前。最後の 1 枚が飛んだ先がここに繋がる */}
              <h1
                style={{ viewTransitionName: "now" }}
                className="font-display text-6xl leading-none tracking-tight sm:text-[7rem]"
              >
                からっぽ。
              </h1>
              <div className="flex items-center gap-5">
                <span className="h-2.5 w-10 flex-shrink-0 border-[3px] border-current bg-accent sm:w-44" />
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
                <Glyph d={PATHS.plus} size={28} width={3.5} />
                追加する
                <span className="hidden border-2 border-current px-2 py-1 font-mono text-[13px] lg:inline">
                  N
                </span>
              </button>
            </>
          )}
        </main>

        {/*
          右の柱。常に出しておく（出たり消えたりすると NOW の幅が動く）。
          狭い画面では出さない。NOW を細くするほうが害が大きい
        */}
        <aside className="hidden w-64 flex-shrink-0 flex-col gap-7 overflow-y-auto border-l-4 border-foreground px-5 py-7 lg:flex">
          {/* いま何時か。時間が見えないと「まだある」と思ったまま溶ける（DESIGN.md 1章 時間盲） */}
          <div className="flex flex-col gap-1">
            <span className="font-mono text-5xl leading-none font-black tabular-nums">{nowHm}</span>
            <span className="font-mono text-xs font-bold opacity-50">{today}</span>
          </div>

          {/*
            今日の約束。外から来て動かせないものだけ（DESIGN.md 1章・7章）。
            タスクは紐付けない = 時間割にしない。次の 1 件だけ残り時間を出す
          */}
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-xs font-bold tracking-[0.12em] opacity-55">約束</span>
            {plans.length === 0 ? (
              <button
                onClick={() => openToday()}
                className="border-[3px] border-dashed border-current px-3 py-2 text-left text-[13px] font-bold opacity-45"
              >
                なし（T で入れる）
              </button>
            ) : (
              plans.map((p) => {
                const next = p.id === nextPlan?.id;
                return (
                  // 押すと「今日」画面がこの約束の編集で開く。柱は狭いので入力欄は置かない
                  <button
                    key={p.id}
                    onClick={() => openToday(p.id)}
                    className={`flex flex-col gap-0.5 border-[3px] px-3 py-2 text-left ${
                      next
                        ? "border-foreground bg-accent text-on-accent shadow-[5px_5px_0_var(--color-foreground)]"
                        : `border-current ${p.at < nowHm ? "opacity-40" : "opacity-75"}`
                    }`}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-lg font-black tabular-nums">{p.at}</span>
                      {next && (
                        <span className="font-mono text-[11px] font-bold">
                          {until(minsToNext)}
                        </span>
                      )}
                    </span>
                    <span className="text-[15px] leading-snug font-bold">{p.title}</span>
                  </button>
                );
              })
            )}
          </div>

          {/*
            P で送った札だけ出す。未着手の一覧でも残数でもない = 全体量は見せない（DESIGN.md 3章）。
            「消えてはいない」ことだけ渡す。押せないのは、選んで戻せると優先度を付ける操作になるから。
            永続化しないので閉じれば消える（残すと「避けている一覧」になる。4章）
          */}
          {passedTasks.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="font-mono text-xs font-bold tracking-[0.12em] opacity-55">
                あとで
              </span>
              {passedTasks.map((t) => (
                <span
                  key={t.id}
                  className="border-[3px] border-current px-3 py-2 text-[15px] leading-snug font-bold opacity-70"
                >
                  {t.title}
                </span>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* キーが押せない環境（スマホ）でも同じ操作ができるよう、ヒントはそのままボタン。
          常にアイコンで示し、キー表示は PC 幅（lg 以上）でだけ添える。
          下の余白は ホームインジケータのぶん。帯の黒は画面の下端まで伸ばしたまま、
          札だけ インジケータの上へ逃がす（スワイプ領域と当たり判定が重なる）。

          揃えは safe center（justify-center-safe）。収まるときは中央、
          はみ出したら左揃えに落ちる。ただの center だと はみ出したとき
          左端の札が画面の外へ出て、スクロールしても戻れない */}
      <footer className="flex min-h-[calc(54px_+_env(safe-area-inset-bottom))] flex-shrink-0 items-center justify-center-safe gap-1 overflow-x-auto bg-foreground px-3 pb-[env(safe-area-inset-bottom)] font-mono text-[13px] font-bold tracking-[0.06em] text-background sm:gap-2 sm:px-5">
        {hints.map((b) => (
          <HintButton key={b.keyLabel} {...b} />
        ))}
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
          plans={plans}
          nowHm={nowHm}
          editPlanId={editPlanId}
          onAddPlan={(at, title) => update((s) => addPlan(s, today, at, title))}
          onUpdatePlan={(id, at, title) => update((s) => updatePlan(s, id, at, title))}
          onRemovePlan={(id) => update((s) => removePlan(s, id))}
          onClose={() => setOverlay(null)}
        />
      )}
    </>
  );
}
