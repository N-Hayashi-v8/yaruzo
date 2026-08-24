# やるぞ！

原始人口調。リポジトリ名は `yaruzo`。

ADHD 当事者用。目的は **着火**。タスク管理ではない。
名前の由来は起動の合図そのもの。「やるぞ！」と思った瞬間に立ち上げる。

**次の1個だけ見せる。タイマー回す。それだけ。**

リスト管理アプリ ではない。**起動装置**。
全体量を見せると凍る → NOW 画面はタスク1件のみ。画面遷移 なし。

## 動かす

```bash
npm install
npm run dev     # http://localhost:3000
```

Windows で使うだけなら `yaruzo.bat` ダブルクリック（ビルドして本番サーバを立て、アプリ窓で開く）。
PWA としてインストールすれば 2 回目以降はサーバごと不要（→ SETUP.md 3）。

## 中身

- Next.js (App Router) + TypeScript + Tailwind
- 永続化: **localStorage のみ**。サーバ・DB・認証・外部サービス なし
- データは PC のブラウザに閉じる。PC を変えると引き継がれない（→ SETUP.md 4-1）

```text
app/page.tsx        # NOW 画面
app/overlays.tsx    # 追加 / 分解 / 眠い / 今日
lib/types.ts        # 型定義（データ形状の唯一の真実）
lib/store.ts        # localStorage 読み書き 集約
lib/select.ts       # 次タスク選択ロジック（通常 / 眠気）
```

## 状態

P1〜P4 実装済み。

- P1 NOW・追加・完了・カウントダウン・永続化
- P2 分解（手動 3 分割）
- P3 眠い・起床/光ログ
- P4 累積カウンタ・完了時のランダム一言
- 名言 — からっぽ画面と完了直後にランダム表示（`lib/quotes.ts`）

## 読む順番

1. [CLAUDE.md](CLAUDE.md) — 前提と禁止事項。曲げるな
2. [DESIGN.md](DESIGN.md) — 根拠・全画面仕様・作らないものリスト
3. [SETUP.md](SETUP.md) — 環境構築、別 PC への引き継ぎ

`AGENTS.md` は Next.js が自動生成・自動再追記。手で消しても `next dev` が戻す。

## 作らない

優先度ソート / タグ / フィルタ / カレンダー同期 / 連続ストリーク /
達成率グラフ / 通知・催促 / 認証・同期・共有 / 設定画面。

理由は DESIGN.md 7章。要求されても却下。
