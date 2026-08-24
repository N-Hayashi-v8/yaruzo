import type { Pillar, Task } from "./types";

/** 柱 1 本の定義。key = null は「その他」（3 本の柱に入らない雑タスク） */
export type PillarDef = {
  key: Pillar | null;
  label: string;
  /** 1 タップで生える定番。柱ごとの入力をゼロにするためにある */
  presets: { title: string; estimateMin: number; stimulation: Task["stimulation"] }[];
};

/**
 * 数も並びも固定。画面から増やせない（DESIGN.md 7章）。
 * どの柱がどれだけ出るかは在庫がそのまま決める。比率をここに持たない
 * （持っても、出る順を決めているのは createdAt なので効かない）。
 */
export const PILLARS: PillarDef[] = [
  {
    key: "sing",
    label: "歌",
    presets: [
      { title: "コード 覚える", estimateMin: 15, stimulation: 1 },
      { title: "曲 覚える", estimateMin: 20, stimulation: 2 },
      { title: "歌う 練習", estimateMin: 30, stimulation: 2 },
    ],
  },
  {
    key: "onepiece",
    label: "ワンピ",
    presets: [{ title: "対戦 積む", estimateMin: 30, stimulation: 3 }],
  },
  {
    key: "duelplays",
    label: "デュエプレ",
    presets: [{ title: "対戦 積む", estimateMin: 30, stimulation: 3 }],
  },
  { key: null, label: "その他", presets: [] },
];

export function pillarLabel(key: Pillar | null): string {
  return PILLARS.find((p) => p.key === key)?.label ?? "その他";
}
