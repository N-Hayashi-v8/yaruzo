"use client";

import { useRef, useState, type ReactNode } from "react";

import { clampMin } from "@/lib/store";
import type { Plan, Preset, Task } from "@/lib/types";

/** 5 分の身体タスク。覚醒が落ちて刺激度の高いタスクが無いときに出す（DESIGN.md 3章） */
export const BODY_TASKS = [
  { id: "body:walk", title: "歩く", estimateMin: 5 },
  { id: "body:water", title: "水 飲む", estimateMin: 5 },
  { id: "body:face", title: "顔 洗う", estimateMin: 5 },
] as const;

export type BodyTask = (typeof BODY_TASKS)[number];

/**
 * 目安分のバッジ。つまんで上下に動かすと変わる（上へ 8px で +5 分）。
 * マウスが無い/使えないときは上下キーでも同じ。数字の入力欄は置かない
 * = 入力項目を増やして管理作業にしない（DESIGN.md 7章）。
 * fixed = 変えられない場所（身体タスクは Store に無い固定値）。
 */
export function EstimateGrip({
  min,
  onMin,
  fixed = false,
  className = "",
}: {
  min: number;
  onMin: (min: number) => void;
  fixed?: boolean;
  className?: string;
}) {
  const grip = useRef<{ y: number; base: number } | null>(null);
  const release = () => {
    grip.current = null;
  };

  return (
    <span
      role="spinbutton"
      aria-label="目安の分"
      aria-valuenow={min}
      aria-valuemin={5}
      aria-valuemax={180}
      tabIndex={fixed ? -1 : 0}
      onPointerDown={(e) => {
        if (fixed) return;
        e.currentTarget.setPointerCapture(e.pointerId); // 枠の外まで引いても追える
        grip.current = { y: e.clientY, base: min };
      }}
      onPointerMove={(e) => {
        const g = grip.current;
        if (!g) return;
        onMin(clampMin(g.base + Math.round((g.y - e.clientY) / 8) * 5));
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={(e) => {
        const d = e.key === "ArrowUp" ? 5 : e.key === "ArrowDown" ? -5 : 0;
        if (fixed || d === 0) return;
        e.preventDefault();
        onMin(clampMin(min + d));
      }}
      className={`${className}${fixed ? "" : " cursor-ns-resize touch-none select-none"}`}
    >
      目安 {min}分{fixed ? "" : " ↕"}
    </span>
  );
}

function Overlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="anim-fade fixed inset-0 flex items-start justify-center overflow-y-auto bg-[rgba(22,19,15,0.74)] p-4 pt-16 sm:p-6 sm:pt-24"
      onClick={onClose}
    >
      {/* 出るときだけ動かす。閉じるのは作業に戻る瞬間なので即消す（globals.css） */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-unfold flex w-full max-w-4xl flex-col gap-5 border-[6px] border-foreground bg-background p-6 shadow-[16px_16px_0_var(--accent)] sm:p-8"
      >
        {children}
      </div>
    </div>
  );
}

function Head({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex flex-wrap items-baseline gap-4">
      <span className="font-display text-3xl sm:text-4xl">{title}</span>
      <span className="flex-1" />
      {/* 開いたキー（N/D/S/T）を出していたが、押せない札は閉じ方の案内にならない。
          ESC を知らなくても閉じられるよう、右上は × のボタンにする */}
      <button
        onClick={onClose}
        aria-label="閉じる"
        className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center self-center border-[3px] border-current active:bg-accent active:text-on-accent"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

export function AddOverlay({
  draft,
  onDraft,
  presets,
  onSpawn,
  onRemovePreset,
  onAdd,
  onKeep,
  onClose,
  min,
  onMin,
}: {
  draft: string;
  onDraft: (v: string) => void;
  presets: Preset[];
  onSpawn: (id: string) => void;
  onRemovePreset: (id: string) => void;
  onAdd: () => void;
  onKeep: () => void;
  onClose: () => void;
  min: number;
  onMin: (min: number) => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <Head title="追加" onClose={onClose} />

      {/* 何度もやることは押すだけで生える。毎日おなじ文字を打つのは摩擦でしかない */}
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          {presets.map((p) => (
            <div
              key={p.id}
              className="flex items-stretch border-4 border-foreground shadow-[6px_6px_0_var(--color-foreground)]"
            >
              <button
                onClick={() => onSpawn(p.id)}
                className="min-h-12 px-4 py-2 text-lg font-bold active:bg-accent active:text-on-accent"
              >
                {p.title}
              </button>
              {/* 消すのは押し間違えても痛くない。もう一度打てば戻る */}
              <button
                onClick={() => onRemovePreset(p.id)}
                aria-label={`${p.title} を定番から外す`}
                className="flex w-9 flex-shrink-0 items-center justify-center border-l-4 border-foreground opacity-45 active:bg-accent active:text-on-accent active:opacity-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 定番がまだ無いうちは区切り線だけが浮くので、まとめて出さない */}
      {presets.length > 0 && <div className="border-t-4 border-foreground" />}

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
        {/* 何度もやることだと気づいた時に、その場で定番へ送れる */}
        <button
          onClick={onKeep}
          disabled={draft.trim() === ""}
          className="min-h-12 border-[3px] border-current px-4 py-2 text-[15px] font-bold active:bg-accent active:text-on-accent disabled:opacity-35"
        >
          定番にも入れる
        </button>
        <EstimateGrip
          min={min}
          onMin={onMin}
          className="border-[3px] border-current px-3.5 py-1.5 text-[15px] font-bold"
        />
        <span className="font-mono text-[13px] font-bold opacity-60">ESC 閉じる</span>
      </div>
    </Overlay>
  );
}

/** 埋める順に効く問い。数も順も固定（選ばせない = 摩擦を作らない） */
const SPLIT_PROMPTS = [
  "最初の5分で できることは？",
  "次は？",
  "終わりの目印は？",
];

export function SplitOverlay({
  title,
  steps,
  onStep,
  onSplit,
  onClose,
}: {
  title: string;
  steps: string[];
  onStep: (i: number, v: string) => void;
  onSplit: () => void;
  onClose: () => void;
}) {
  const filled = steps.some((s) => s.trim() !== "");
  return (
    <Overlay onClose={onClose}>
      <Head title="分解" onClose={onClose} />

      <div className="flex flex-wrap items-center gap-4 border-4 border-foreground bg-foreground px-5 py-3.5 text-background">
        <span className="font-mono text-xs font-bold tracking-[0.12em] opacity-70">いま これ</span>
        <span className="font-display text-2xl sm:text-3xl">{title}</span>
      </div>

      <div className="flex flex-col gap-3">
        {SPLIT_PROMPTS.map((prompt, i) => (
          <div
            key={prompt}
            className="flex items-stretch border-4 border-foreground shadow-[7px_7px_0_var(--color-foreground)]"
          >
            <span className="flex w-14 flex-shrink-0 items-center justify-center border-r-4 border-foreground bg-accent font-display text-2xl text-on-accent sm:w-16">
              {i + 1}
            </span>
            <input
              autoFocus={i === 0}
              value={steps[i]}
              placeholder={prompt}
              onChange={(e) => onStep(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) onSplit();
                if (e.key === "Escape") onClose();
              }}
              className="w-full min-w-0 flex-1 bg-background px-4 py-3.5 text-lg font-bold outline-none placeholder:text-current placeholder:opacity-35 sm:text-xl"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t-4 border-foreground pt-5">
        <button
          onClick={onSplit}
          disabled={!filled}
          className="flex min-h-14 items-center gap-3 border-4 border-foreground bg-accent px-6 py-3 text-lg font-bold text-on-accent shadow-[8px_8px_0_var(--color-foreground)] disabled:opacity-40 disabled:shadow-none"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3v6M12 9L5 15v6M12 9l7 6v6" />
          </svg>
          割る
          <span className="border-2 border-current px-1.5 py-0.5 font-mono text-xs">ENTER</span>
        </button>
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
      <Head title="眠い" onClose={onClose} />

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
            <span className="flex flex-1 items-center px-5 py-4">
              <span className="text-xl font-black sm:text-2xl">面白い順に 並べ替える</span>
            </span>
          </button>

          <div className="flex flex-col gap-3">
            <span className="font-mono text-xs font-bold tracking-[0.12em]">
              {sleepy ? "面白い順" : "通常 = 古い順"}
            </span>
            {queue.map((t, i) => (
              <div
                key={t.id}
                className={`flex items-stretch border-4 border-foreground shadow-[7px_7px_0_var(--color-foreground)] ${
                  i === 0 ? "bg-accent text-on-accent" : ""
                }`}
              >
                {/* 刺激度は入力手段が無くて全部おなじ値になるので、出す意味がない。
                    ここは何番目に出るかを見せる */}
                <span className="flex w-16 flex-shrink-0 items-center justify-center border-r-4 border-current font-display text-2xl">
                  {i + 1}
                </span>
                <span className="flex flex-1 items-center px-5 py-3.5 text-xl font-black">
                  {t.title}
                </span>
                <span className="flex items-center px-5 font-mono text-lg font-bold">
                  {t.estimateMin}分
                </span>
              </div>
            ))}
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
  plans,
  nowHm,
  onAddPlan,
  onRemovePlan,
  onClose,
}: {
  done: Task[];
  wakeAt: string;
  onWake: (v: string) => void;
  gotLight: boolean;
  onToggleLight: () => void;
  monthCount: number;
  totalCount: number;
  plans: Plan[];
  /** いまの時刻 HH:mm。過ぎた約束を薄くするのに使う。render 中に時計は読めないので受け取る */
  nowHm: string;
  onAddPlan: (at: string, title: string) => void;
  onRemovePlan: (id: string) => void;
  onClose: () => void;
}) {
  const hhmm = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // 入れたら捨てる一時値なので、ここで持つ（閉じれば消えていい）
  const [at, setAt] = useState("");
  const [what, setWhat] = useState("");
  const put = () => {
    if (at === "" || what.trim() === "") return;
    onAddPlan(at, what);
    setAt("");
    setWhat("");
  };

  return (
    <Overlay onClose={onClose}>
      <Head title="今日" onClose={onClose} />

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
            <span className="text-[13px] font-bold opacity-60">毎日おなじ時刻に寄せる</span>
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

      {/*
        今日の約束。会議・通院・締切みたいに **外から来て動かせない** ものだけ入れる。
        タスクは紐付けない。守れたかのチェックも付けない。付けた時点で時間割になる
        （lib/types.ts の Plan、DESIGN.md 1章・7章）
      */}
      <div className="flex flex-col gap-3 border-t-4 border-foreground pt-5">
        <span className="font-mono text-xs font-bold tracking-[0.12em]">
          今日の約束（動かせない予定だけ）
        </span>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="time"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            aria-label="時刻"
            className="border-4 border-foreground bg-background px-2 py-1.5 font-mono text-xl font-black outline-none"
          />
          <input
            value={what}
            placeholder="通院・会議・締切"
            onChange={(e) => setWhat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) put();
              if (e.key === "Escape") onClose();
            }}
            aria-label="約束の内容"
            className="min-w-0 flex-1 border-4 border-foreground bg-background px-4 py-2 text-xl font-bold outline-none placeholder:text-current placeholder:opacity-35"
          />
          <button
            onClick={put}
            disabled={at === "" || what.trim() === ""}
            className="min-h-12 border-4 border-foreground bg-accent px-5 py-2 font-bold text-on-accent shadow-[6px_6px_0_var(--color-foreground)] disabled:opacity-35 disabled:shadow-none"
          >
            入れる
          </button>
        </div>

        {plans.length === 0 ? (
          <p className="text-[15px] font-bold opacity-55">なし。今日は誰とも約束していない。</p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {plans.map((p) => (
              <div
                key={p.id}
                // 過ぎたものも消さない。消すと「あった」ことまで消える
                className={`flex items-stretch border-[3px] border-foreground ${
                  p.at < nowHm ? "opacity-45" : ""
                }`}
              >
                <span className="flex items-center gap-2.5 px-3 py-1.5">
                  <span className="font-mono text-lg font-black">{p.at}</span>
                  <span className="text-[15px] font-bold">{p.title}</span>
                </span>
                <button
                  onClick={() => onRemovePlan(p.id)}
                  aria-label={`${p.at} ${p.title} を消す`}
                  className="flex w-8 flex-shrink-0 items-center justify-center border-l-[3px] border-foreground opacity-45 active:bg-accent active:text-on-accent active:opacity-100"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  );
}
