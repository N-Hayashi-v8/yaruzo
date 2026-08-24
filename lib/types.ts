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
};

/** 名言 1 件。永続化しない定数（lib/quotes.ts） */
export type Quote = {
  text: string;
  /** 誰の言葉か。出典が特定できないものは入れない */
  by: string;
};
