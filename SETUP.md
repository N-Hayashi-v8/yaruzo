# SETUP.md

別 PC への引き継ぎ手順。原始人口調。

## 1. 必要な環境

- **Node 26 以上**（開発時: v26.5.0 / npm 11.17.0）
  - Node 22 未満だと `npm test` が落ちる。テストは追加依存なしで動かすため
    **Node の TypeScript 直接実行**（型ストリップ）に乗っている。`node --test lib/*.test.ts`
  - `tsconfig.json` の `allowImportingTsExtensions: true` も同じ理由。テストが `./select.ts` と
    拡張子付きで import するため。消すな
- git
- ブラウザ（Chrome / Edge。localhost で動けば何でも可）

Windows / macOS / Linux どれでも可。OS 依存コードなし。

## 2. セットアップ

リポジトリ: <https://github.com/N-Hayashi-v8/tsugi>（private）

```
gh repo clone N-Hayashi-v8/tsugi
cd tsugi
npm install
npm run dev
```

→ `http://localhost:3000`

`gh` が無い環境なら:

```
git clone https://github.com/N-Hayashi-v8/tsugi.git
```

private のため認証が要る。`gh auth login`（HTTPS / Authenticate Git with your GitHub credentials は Yes）を
先に通しておくのが早い。Windows で `gh` が PATH に出てこない場合はフルパスで叩く:
`& "C:\Program Files\GitHub CLI\gh.exe" auth login`

## 3. 動作確認

```
npm test        # 5 件通ればロジック健全
npm run lint
npx tsc --noEmit
npm run build
```

## 4. git 管理外で、手で運ぶ必要があるもの

`.gitignore` は create-next-app 既定のまま。中身の大半は **再生成できる** ので運ばなくていい。

再生成でいいもの（無視してよい）:

- `node_modules/` → `npm install`
- `.next/`, `out/`, `build/` → `npm run build`
- `next-env.d.ts` → `npm run dev` / `build` が自動生成
- `*.tsbuildinfo`, `coverage/`, `.vercel`

**手で運ぶ必要があるもの（重要）:**

### 4-1. タスクデータ（最重要）

データは **ブラウザの localStorage**。git にもファイルにも存在しない。
PC を変えると **タスクは 1 件も引き継がれない**。

移行するなら、旧 PC のブラウザで `http://localhost:3000` を開き、DevTools コンソール（F12）で:

```js
copy(localStorage.getItem('task-app-v1'))   // クリップボードにコピー
```

新 PC のブラウザで `http://localhost:3000` を開き、コンソールで:

```js
localStorage.setItem('task-app-v1', `ここに貼る`); location.reload();
```

キー名は `task-app-v1`（`lib/store.ts` で定義）。

要らないなら移行しなくていい。空で始まる。

### 4-2. `.env*`

`.gitignore` 対象。**現時点では存在しない**（P1 は外部サービスを一切使わない）。
P2（タスク分解 = LLM 呼び出し）に入ったら API キーを置く。その時点でここに変数名を追記する。

## 5. リポジトリの現状

- リモート: `origin` = <https://github.com/N-Hayashi-v8/tsugi>（private）
- 既定ブランチ: `main`
- P1 までコミット済み・push 済み

旧リポジトリ名 `ter` からリネーム済み。旧 URL は GitHub がリダイレクトするが、
新しく書くときは `tsugi` を使う。

## 6. 読む順番

1. `CLAUDE.md` — 前提と禁止事項。曲げるな
2. `DESIGN.md` — 全画面仕様、フェーズ、作らないものリスト
3. `lib/types.ts` — データ形状
4. `app/page.tsx` — UI 全部

`AGENTS.md` は Next.js が自動生成・自動再追記するファイル。手で消しても `next dev` が戻す。
