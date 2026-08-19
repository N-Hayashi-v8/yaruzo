"use client";

import type { ReactNode } from "react";
import type { Task } from "@/lib/types";

/** 5 分の身体タスク。覚醒が落ちて刺激度の高いタスクが無いときに出す（DESIGN.md 3章） */
export const BODY_TASKS = [
  { id: "body:walk", title: "歩く", estimateMin: 5 },
  { id: "body:water", title: "水 飲む", estimateMin: 5 },
  { id: "body:face", title: "顔 洗う", estimateMin: 5 },
] as const;

export type BodyTask = (typeof BODY_TASKS)[number];

function Overlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-[rgba(22,19,15,0.74)] p-4 pt-16 sm:p-6 sm:pt-24"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-4xl flex-col gap-5 border-[6px] border-foreground bg-background p-6 shadow-[16px_16px_0_var(--accent)] sm:p-8"
      >
        {children}
      </div>
    </div>
  );
}

function Head({ title, note, hint }: { title: string; note: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-4">
      <span className="font-display text-3xl sm:text-4xl">{title}</span>
      <span className="text-[15px] font-bold opacity-60">{note}</span>
      <span className="flex-1" />
      <span className="border-[3px] border-current px-2 py-1 font-mono text-[13px] font-bold">
        {hint}
      </span>
    </div>
  );
}

export function AddOverlay({
  draft,
  onDraft,
  onAdd,
  onClose,
}: {
  draft: string;
  onDraft: (v: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <Head title="追加" note="1行だけ。それ以上 聞かない。" hint="N" />
      <input
        autoFocus
        value={draft}
        placeholder="やること"
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) onAdd();
          if (e.key === "Escape") onClose();
        }}
        className="w-full border-[5px] border-foreground bg-background px-5 py-4 text-2xl font-bold outline-none placeholder:text-current placeholder:opacity-35 sm:text-4xl"
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="border-[3px] border-current px-3.5 py-1.5 text-[15px] font-bold">
          見積 15分
        </span>
        <span className="border-[3px] border-current px-3.5 py-1.5 text-[15px] font-bold">
          刺激度 2
        </span>
        <span className="text-[15px] font-bold opacity-60">← 初期値。あとで変えられる</span>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t-4 border-foreground pt-5">
        <button
          onClick={onAdd}
          className="flex min-h-14 items-center gap-3 border-4 border-foreground bg-accent px-6 py-3 text-lg font-bold text-on-accent shadow-[8px_8px_0_var(--color-foreground)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12h14M13 6l6 6-6 6" />
          </svg>
          入れる
          <span className="border-2 border-current px-1.5 py-0.5 font-mono text-xs">ENTER</span>
        </button>
        <span className="font-mono text-[13px] font-bold opacity-60">ESC 閉じる</span>
      </div>
    </Overlay>
  );
}

export function SleepyOverlay({
  sleepy,
  onToggle,
  hasStim,
  queue,
  onPickBody,
  onClose,
}: {
  sleepy: boolean;
  onToggle: () => void;
  hasStim: boolean;
  queue: Task[];
  onPickBody: (t: BodyTask) => void;
  onClose: () => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <Head title="眠い" note="眠いんじゃない。退屈だから 眠い" hint="S" />

      {hasStim ? (
        <>
          <button
            onClick={onToggle}
            className="flex items-stretch border-[5px] border-foreground text-left shadow-[10px_10px_0_var(--color-foreground)]"
          >
            <span
              className={`flex w-32 flex-shrink-0 items-center justify-center border-r-[5px] border-foreground text-3xl font-black sm:w-40 ${
                sleepy ? "bg-accent text-on-accent" : ""
              }`}
            >
              {sleepy ? "ON" : "OFF"}
            </span>
            <span className="flex flex-1 flex-col justify-center gap-1 px-5 py-4">
              <span className="text-xl font-black sm:text-2xl">刺激度の高い順に 並べ替える</span>
              <span className="text-[15px] font-bold opacity-60">
                切替は 今日だけ。明日 勝手に戻る
              </span>
            </span>
          </button>

          <div className="flex flex-col gap-3">
            <span className="font-mono text-xs font-bold tracking-[0.12em]">
              {sleepy ? "刺激度 高い順" : "通常 = 古い順"}
            </span>
            {queue.map((t, i) => (
              <div
                key={t.id}
                className={`flex items-stretch border-4 border-foreground shadow-[7px_7px_0_var(--color-foreground)] ${
                  i === 0 ? "bg-accent text-on-accent" : ""
                }`}
              >
                <span className="flex w-16 flex-shrink-0 items-center justify-center border-r-4 border-current font-display text-2xl">
                  {t.stimulation}
                </span>
                <span className="flex flex-1 items-center px-5 py-3.5 text-xl font-black">
                  {t.title}
                </span>
                <span className="flex items-center px-5 font-mono text-lg font-bold">
                  {t.estimateMin}分
                </span>
              </div>
            ))}
            <span className="text-[15px] font-bold opacity-60">
              上の1件が NOW に出る。残りは 見せない
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="font-display text-3xl leading-tight sm:text-4xl">
            面白いタスク なし。
            <br />
            体を 動かす。
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            {BODY_TASKS.map((b, i) => (
              <button
                key={b.id}
                onClick={() => onPickBody(b)}
                className={`flex min-h-[120px] flex-1 flex-col items-start gap-2.5 border-[5px] border-foreground px-5 py-5 shadow-[8px_8px_0_var(--color-foreground)] ${
                  i === 0 ? "bg-accent text-on-accent" : ""
                }`}
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {b.id === "body:walk" && (
                    <path d="M13 4.5a1 1 0 100-.1M11 21l2-6-3-3 1-5 4 3 3 1M10 12l-3 2-2 5" />
                  )}
                  {b.id === "body:water" && <path d="M6 4h12l-1.5 16h-9zM7 10h10" />}
                  {b.id === "body:face" && <path d="M4 13a8 8 0 0116 0M8 17h8M12 3v3" />}
                </svg>
                <span className="text-2xl font-black">{b.title}</span>
                <span className="font-mono text-[17px] font-bold">{b.estimateMin}分</span>
              </button>
            ))}
          </div>
          <span className="text-[15px] font-bold opacity-60">
            選ぶと 5分のカウントダウンが始まる。覚醒が戻ってから タスクに帰る
          </span>
        </>
      )}
    </Overlay>
  );
}

export function TodayOverlay({
  done,
  wakeAt,
  onWake,
  gotLight,
  onToggleLight,
  monthCount,
  totalCount,
  onClose,
}: {
  done: Task[];
  wakeAt: string;
  onWake: (v: string) => void;
  gotLight: boolean;
  onToggleLight: () => void;
  monthCount: number;
  totalCount: number;
  onClose: () => void;
}) {
  const hhmm = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <Overlay onClose={onClose}>
      <Head title="今日" note="やったことだけ 並ぶ" hint="T" />

      <div className="grid gap-6 sm:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-end gap-3.5 border-b-[5px] border-foreground pb-1.5">
            <span className="font-display text-6xl leading-none">{done.length}</span>
            <span className="pb-2 text-lg font-black">件 片付いた</span>
          </div>
          {done.length === 0 ? (
            <p className="py-6 text-lg font-bold opacity-60">まだ ゼロ。それだけ。</p>
          ) : (
            done.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 border-[3px] border-foreground px-3 py-2"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center border-[3px] border-foreground bg-accent">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 13l6 6L21 5" />
                  </svg>
                </span>
                <span className="flex-1 text-lg font-black">{t.title}</span>
                <span className="font-mono text-sm font-bold opacity-65">
                  {hhmm(t.completedAt ?? 0)}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2 border-[5px] border-foreground p-4 shadow-[8px_8px_0_var(--color-foreground)]">
            <span className="font-mono text-xs font-bold tracking-[0.12em]">起きた時刻</span>
            <input
              type="time"
              value={wakeAt}
              onChange={(e) => onWake(e.target.value)}
              className="w-full border-4 border-foreground bg-background px-2 py-1.5 font-mono text-2xl font-black outline-none"
            />
            <span className="text-[13px] font-bold opacity-60">固定する。ズレても 責めない</span>
          </div>

          <button
            onClick={onToggleLight}
            className={`flex flex-col items-start gap-2 border-[5px] border-foreground p-4 text-left shadow-[8px_8px_0_var(--color-foreground)] ${
              gotLight ? "bg-accent text-on-accent" : ""
            }`}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="4.5" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
            </svg>
            <span className="text-2xl font-black">光 浴びた</span>
            <span className="font-mono text-sm font-black tracking-[0.1em]">
              {gotLight ? "記録した" : "まだ"}
            </span>
          </button>

          <div className="flex flex-col gap-1.5 border-[5px] border-foreground bg-foreground p-4 text-background">
            <span className="flex items-baseline gap-2.5">
              <span className="font-mono text-[13px] font-bold opacity-70">今月</span>
              <span className="font-display text-2xl">{monthCount}</span>
            </span>
            <span className="flex items-baseline gap-2.5">
              <span className="font-mono text-[13px] font-bold opacity-70">通算</span>
              <span className="font-display text-2xl">{totalCount}</span>
            </span>
          </div>
        </div>
      </div>

      <p className="border-t-4 border-foreground pt-3 text-sm font-bold opacity-60">
        連続日数・達成率・カレンダーの穴 は 出さない
      </p>
    </Overlay>
  );
}
