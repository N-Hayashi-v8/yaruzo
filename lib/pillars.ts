import type { Pillar, Task } from "./types";

/**
 * 柱 1 本の定義。key = null は「その他」（3 本の柱に入らない雑タスク）。
 * weight は抽選の比率。1 日の配分を計画で決めるとズレが未達になるので、
 * 長期の比率だけをここに持つ（DESIGN.md 3章 抽選）。
 */
export type PillarDef = {
  key: Pillar | null;
  label: string;
  weight: number;
  /** 1 タップで生える定番。柱ごとの入力をゼロにするためにある */
  presets: { title: string; estimateMin: number; stimulation: Task["stimulation"] }[];
};

/**
 * 並びが抽選の走査順。数も並びも固定。
 * 歌が厚いのは、一番やることが多くて一番後回しになるから。
 * デュエプレが軽いのは夜の通話ありきで在庫の無い時間帯が長く、
 * 在庫ゼロの柱はそもそも抽選から外れるため。
 */
export const PILLARS: PillarDef[] = [
  {
    key: "sing",
    label: "歌",
    weight: 3,
    presets: [
      { title: "コード 覚える", estimateMin: 15, stimulation: 1 },
      { title: "曲 覚える", estimateMin: 20, stimulation: 2 },
      { title: "歌う 練習", estimateMin: 30, stimulation: 2 },
    ],
  },
  {
    key: "onepiece",
    label: "ワンピ",
    weight: 2,
    presets: [{ title: "対戦 積む", estimateMin: 30, stimulation: 3 }],
  },
  {
    key: "duelplays",
    label: "デュエプレ",
    weight: 1,
    presets: [{ title: "対戦 積む", estimateMin: 30, stimulation: 3 }],
  },
  { key: null, label: "その他", weight: 2, presets: [] },
];

export function pillarLabel(key: Pillar | null): string {
  return PILLARS.find((p) => p.key === key)?.label ?? "その他";
}
