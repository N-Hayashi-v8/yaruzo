export type Task = {
  id: string;
  title: string;
  /** 見積分。カウントダウンの初期値 */
  estimateMin: number;
  /** 刺激度。1=退屈 3=面白い。眠気モードの並べ替えキー（P3） */
  stimulation: 1 | 2 | 3;
  /** 分解で生えた子タスクの親 ID */
  parentId: string | null;
  createdAt: number;
  /** null = 未完了 */
  completedAt: number | null;
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
};

/** 名言 1 件。永続化しない定数（lib/quotes.ts） */
export type Quote = {
  text: string;
  /** 誰の言葉か。出典が特定できないものは入れない */
  by: string;
};
