export type Task = {
  id: string;
  title: string;
  /** 目安の分数。カウントアップのバーが満ちる位置。超えても止まらない */
  estimateMin: number;
  /** 刺激度。1=退屈 3=面白い。眠気モードの並べ替えキー（P3） */
  stimulation: 1 | 2 | 3;
  /** 分解で生えた子タスクの親 ID */
  parentId: string | null;
  createdAt: number;
  /** null = 未完了 */
  completedAt: number | null;
};

/**
 * 何度もやることの雛形。追加画面で 1 タップすると Task が生える。
 * 持つのはタイトルだけ。見積・刺激度を登録時に決めさせると入力項目が増える。
 */
export type Preset = {
  id: string;
  title: string;
  /** 最後に使った時刻。新しく使ったものほど前に並べる */
  lastUsedAt: number;
};

/**
 * 今日の約束。会議・通院・締切のような **外から来て動かせない** 予定。
 *
 * タスクではない。時間割でもない（DESIGN.md 1章・7章）。
 * 自分で時間を割り振ったものは未達を生むが、これは「来る」もので達成対象ではない。
 * 残り時間が見えると発火する側に効く（INCUP の U = 緊急）。
 *
 * 越えると時間割になる境界が 3 つある。どれも作らない:
 *   - タスクと紐付ける（「14:00 からタスク A」= 時間割そのもの）
 *   - 守れたかのチェックを付ける（未達が生まれる）
 *   - 明日以降を持つ（予定管理アプリになる）
 */
export type Plan = {
  id: string;
  /** YYYY-MM-DD。今日の分しか持たない */
  date: string;
  /** HH:mm */
  at: string;
  title: string;
};

export type DayLog = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  wakeAt: string | null;
  gotLight: boolean;
};

export type Store = {
  tasks: Task[];
  logs: DayLog[];
  presets: Preset[];
  plans: Plan[];
};

/** 名言 1 件。永続化しない定数（lib/quotes.ts） */
export type Quote = {
  text: string;
  /** 誰の言葉か。出典が特定できないものは入れない */
  by: string;
};
