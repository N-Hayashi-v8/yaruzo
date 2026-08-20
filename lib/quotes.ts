import type { Quote } from "./types";

/*
 * 出典が章・ページ・日付まで特定できるものだけを入れる。
 * ネットの名言集は誤帰属が多い（「エジソンの 99%」「アインシュタインの〜」の類）。
 * 帰属が確認できない言葉は、どれだけ気の利いた文でも入れない。
 * 足すときは原典に当たってから。孫引きの引用サイトは出典にしない。
 *
 * 落とした例: キング牧師「飛べなければ走れ、走れなければ歩け」。
 * 1960 年スペルマン大学での演説とされるが、引用サイト以外に届かなかった。
 *
 * 近代の人物は原文が英語なので、日本語は拙訳。定訳ではない。
 * 原文と出典は下のコメントに残してあるので、訳を直したければそこから。
 */

/**
 * からっぽ画面（タスク 0 件）に出す。
 *
 * 「働け」と言わない言葉だけ。ここは催促してはいけない場所で、
 * 何もしていない状態を肯定するために出す（DESIGN.md 4章: 催促は罪悪感を生む）。
 */
export const REST_QUOTES: Quote[] = [
  { text: "足るを知る者は富む。", by: "老子 道徳経 33章" },
  { text: "足るを知れば辱められず、止まるを知れば殆うからず。", by: "老子 道徳経 44章" },
  { text: "大器は晩成す。", by: "老子 道徳経 41章" },
  { text: "無為にして、為さざるは無し。", by: "老子 道徳経 48章" },
  { text: "人は皆 有用の用を知りて、無用の用を知る莫し。", by: "荘子 人間世篇" },
  { text: "鷦鷯 深林に巣くうも、一枝に過ぎず。", by: "荘子 逍遥遊篇" },
  {
    text: "疏食を飯い水を飲み、肱を曲げて之を枕とす。楽しみ亦た其の中に在り。",
    by: "論語 述而篇",
  },
  {
    text: "人間の不幸はただ一つ、部屋に静かに座っていられないことから来る。",
    by: "パスカル パンセ 断章139",
  },
  { text: "つれづれなるままに、日暮らし、硯にむかひて。", by: "吉田兼好 徒然草 序段" },
  {
    text: "ゆく河の流れは絶えずして、しかももとの水にあらず。",
    by: "鴨長明 方丈記 冒頭",
  },

  // ここから近代。原文は英語、訳は拙訳。原文を各項に付ける

  // "I wish to suggest that a man may be very industrious, and yet not spend his time well."
  {
    text: "人は とても勤勉でありながら、時間をうまく使っていないことがある。",
    by: "ソロー 原則なき生活 1863",
  },
  // "If a man walk in the woods for love of them half of each day, he is in danger of
  //  being regarded as a loafer; but if he spends his whole day as a speculator, ...
  //  he is esteemed an industrious and enterprising citizen."
  {
    text: "一日の半分を、森が好きだからと森を歩けば、怠け者と見なされかねない。",
    by: "ソロー 原則なき生活 1863",
  },
  // "It would be glorious to see mankind at leisure for once."
  {
    text: "人類が 一度くらい 暇でいるところを 見てみたい。",
    by: "ソロー 原則なき生活 1863",
  },
  // "I think that there is far too much work done in the world, that immense harm is
  //  caused by the belief that work is virtuous"
  {
    text: "世の中では 働きすぎだ。労働は美徳だという信念が、計り知れない害をもたらしている。",
    by: "ラッセル 怠惰への讃歌 1932",
  },
  // "The morality of work is the morality of slaves, and the modern world has no need of slavery."
  {
    text: "労働の道徳は 奴隷の道徳だ。現代の世界に 奴隷は要らない。",
    by: "ラッセル 怠惰への讃歌 1932",
  },
  // "If you can spend a perfectly useless afternoon in a perfectly useless manner,
  //  you have learned how to live."（p.153）
  {
    text: "まったく無用な午後を、まったく無用に過ごせるなら、生き方を身につけたということだ。",
    by: "林語堂 生活の発見 1937",
  },
  // "Those who are wise won't be busy, and those who are too busy can't be wise."（p.150）
  {
    text: "賢い者は 忙しくしない。忙しすぎる者は 賢くなれない。",
    by: "林語堂 生活の発見 1937",
  },
  // "A man who has to be punctually at a certain place at five o'clock has the whole
  //  afternoon from one to five ruined for him already."（p.163）
  {
    text: "五時にどこかへ 必ず行かねばならない者は、一時から五時までを すでに台無しにされている。",
    by: "林語堂 生活の発見 1937",
  },
  // "I lie on the beach like a crocodile and let myself be roasted by the sun.
  //  I never see a newspaper and don't give a damn for what is called the world."
  {
    text: "ワニのように浜辺に寝そべり、日に焼かれるままにしている。新聞も見ない。世間などどうでもいい。",
    by: "アインシュタイン ボルンへの手紙 1918",
  },
  // "I never think of the future. It comes soon enough."
  {
    text: "未来のことは考えない。どうせ すぐ来る。",
    by: "アインシュタイン 会見 1930",
  },
];

/**
 * 完了直後に出す。既存の CHEERS（短い一言）に添える。
 *
 * 終えた瞬間なら催促にならない。「積み上がった」側の言葉だけを置く。
 * 「怠けるな」「意志が足りない」系は入れない（DESIGN.md 1章: 意志の問題ではない）。
 */
export const DONE_QUOTES: Quote[] = [
  { text: "千里の道も一歩から。", by: "老子 道徳経 64章" },
  {
    text: "譬えば山を為るが如し。未だ成らざること一簣なるも、止むは吾が止むなり。",
    by: "論語 子罕篇",
  },
  { text: "苟に日に新たに、日日に新たに、又日に新たなり。", by: "大学 湯之盤銘" },
  { text: "土を積みて山と成せば、風雨 焉に興る。", by: "荀子 勧学篇" },
  {
    text: "駑馬も十駕すれば、功は舍めざるに在り。",
    by: "荀子 勧学篇",
  },
  {
    text: "山径の蹊間も、介然として之を用うれば、路と成る。",
    by: "孟子 尽心下",
  },

  // "Life is like riding a bicycle. To keep your balance you must keep moving."
  // 息子エドゥアルトへの手紙、1930 年 2 月 5 日
  {
    text: "人生は 自転車に乗るようなものだ。倒れないためには、動き続けるしかない。",
    by: "アインシュタイン 息子への手紙 1930",
  },
];

/** 1 件 引く。同じものが続いても気にしない（履歴を持つほどの話ではない） */
export function pickQuote(list: Quote[]): Quote {
  return list[Math.floor(Math.random() * list.length)];
}
