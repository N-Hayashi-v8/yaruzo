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
 * 表示するのは **現代語だけ**。読めない文字列は摩擦にしかならない。
 * 漢文の書き下しも古文も出さない。原文は各項の直上にコメントで残してあるので、
 * 訳を直したければそこから。訳はどれも拙訳で、定訳ではない。
 *
 * --- ゲーム・アニメのセリフを足すとき ---
 *
 * 書式は同じ。by に「キャラ名 作品名」を入れる:
 *   { text: "セリフをそのまま", by: "キャラ名 作品名" },
 *
 * 2 つ 守る。
 *
 * 1. 文言は **手元の作品で確認してから** 貼る。記憶と引用サイトは当てにしない。
 *    アニメ・ゲームのセリフは一次資料がネットに無く（円盤とゲーム本体の中にある）、
 *    引用サイトの文言には誤記・意訳・うろ覚えが混ざる。古典と違って確認手段が無い
 * 2. 現代の商業作品のセリフは著作権が生きている。private リポジトリで自分だけが
 *    使う前提なら実務上の問題は無い。**public にするときは、ここを見直す**
 */

/**
 * からっぽ画面（タスク 0 件）に出す。
 *
 * 「働け」と言わない言葉だけ。ここは催促してはいけない場所で、
 * 何もしていない状態を肯定するために出す（DESIGN.md 4章: 催促は罪悪感を生む）。
 */
export const REST_QUOTES: Quote[] = [
  // 知足者富
  { text: "足りていると分かっている人が、本当に豊かだ。", by: "老子 道徳経 33章" },
  // 知足不辱、知止不殆
  {
    text: "足りていると分かれば 恥をかかない。止まるところで止まれば 危ない目に遭わない。",
    by: "老子 道徳経 44章",
  },
  // 大器晩成
  { text: "大きな器ほど、出来上がるのが遅い。", by: "老子 道徳経 41章" },
  // 無為而無不為
  { text: "余計なことをしなければ、できないことは 何もなくなる。", by: "老子 道徳経 48章" },
  // 人皆知有用之用、而莫知無用之用也
  {
    text: "みんな 役に立つものの価値は知っている。役に立たないものの価値を 知らない。",
    by: "荘子 人間世篇",
  },
  // 鷦鷯巣於深林、不過一枝
  {
    text: "ミソサザイは 深い森に巣を作るが、要るのは 枝一本だけ。",
    by: "荘子 逍遥遊篇",
  },
  // 飯疏食飲水、曲肱而枕之、楽亦在其中矣
  {
    text: "粗末な飯を食い、水を飲み、腕を枕にして寝る。それでも 楽しみはその中にある。",
    by: "論語 述而篇",
  },
  {
    text: "人間の不幸はただ一つ、部屋に静かに座っていられないことから来る。",
    by: "パスカル パンセ 断章139",
  },
  // つれづれなるままに、日暮らし、硯にむかひて
  { text: "することもないまま、一日じゅう 机に向かっている。", by: "吉田兼好 徒然草 序段" },
  // ゆく河の流れは絶えずして、しかももとの水にあらず
  {
    text: "川の流れは 絶えることがないが、同じ水が流れているわけではない。",
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

  // --- キャラのセリフ（休息側）はここに貼る ---
  // 条件は上のコメント。「休んでいい」「今のままでいい」側だけ。
  // 「諦めるな」「立ち上がれ」系は、熱くても ここには入れない。それは下の DONE_QUOTES
  // { text: "", by: "キャラ名 作品名" },
];

/**
 * 完了直後に出す。既存の CHEERS（短い一言）に添える。
 *
 * 終えた瞬間なら催促にならない。「積み上がった」側の言葉だけを置く。
 * 「怠けるな」「意志が足りない」系は入れない（DESIGN.md 1章: 意志の問題ではない）。
 */
export const DONE_QUOTES: Quote[] = [
  // 千里之行、始於足下
  { text: "千里の道も、最初の一歩から始まる。", by: "老子 道徳経 64章" },
  // 譬如為山、未成一簣、止、吾止也
  {
    text: "山を作るようなもの。あと一杯の土で完成というところでやめても、やめたのは自分だ。",
    by: "論語 子罕篇",
  },
  // 苟日新、日日新、又日新
  { text: "今日が新しいなら、毎日を新しくし、さらに新しくしていく。", by: "大学 湯之盤銘" },
  // 積土成山、風雨興焉
  { text: "土を積み上げて山になれば、そこに風雨が生まれる。", by: "荀子 勧学篇" },
  // 駑馬十駕、功在不舍
  {
    text: "足の遅い馬でも 十日走れば追いつく。成果は、やめなかったことにある。",
    by: "荀子 勧学篇",
  },
  // 山径之蹊間、介然用之而成路
  {
    text: "山道の細い筋も、歩き続ければ 道になる。",
    by: "孟子 尽心下",
  },

  // "Life is like riding a bicycle. To keep your balance you must keep moving."
  // 息子エドゥアルトへの手紙、1930 年 2 月 5 日
  {
    text: "人生は 自転車に乗るようなものだ。倒れないためには、動き続けるしかない。",
    by: "アインシュタイン 息子への手紙 1930",
  },

  // --- キャラのセリフ（達成側）はここに貼る ---
  // 条件は上のコメント。終えた瞬間に効く言葉。熱いのはここなら歓迎。
  // 「まだ足りない」「そんなものか」系は入れない。完了を否定させない
  // { text: "", by: "キャラ名 作品名" },
];

/** 1 件 引く。同じものが続いても気にしない（履歴を持つほどの話ではない） */
export function pickQuote(list: Quote[]): Quote {
  return list[Math.floor(Math.random() * list.length)];
}
