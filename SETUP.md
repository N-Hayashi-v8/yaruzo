# SETUP.md

別 PC への引き継ぎ手順。原始人口調。

## 1. 必要な環境

- **Node**（動作確認済み: v26.5.0 / npm 11.17.0、v24.18.0 / npm 11.16.0）
  - 条件は「**フラグなしで `.ts` を直接実行できる Node**」。古い Node だと `npm test` が落ちる。
    テストは追加依存なしで動かすため **Node の TypeScript 直接実行**（型ストリップ）に
    乗っている。`node --test lib/*.test.ts`（`package.json` の `test`）
  - `tsconfig.json` の `allowImportingTsExtensions: true` も同じ理由。テストが `./select.ts` と
    拡張子付きで import するため。消すな
- git
- ブラウザ（Chrome / Edge。localhost で動けば何でも可）

Windows / macOS / Linux どれでも可。OS 依存コードなし。

## 2. セットアップ

リポジトリ: <https://github.com/N-Hayashi-v8/yaruzo>（private）

```
gh repo clone N-Hayashi-v8/yaruzo
cd yaruzo
npm install
npm run dev
```

→ `http://localhost:3000`

Windows なら 2 回目以降は **`dev.bat` をダブルクリック**でいい。
`node_modules` が無ければ `npm install` を先に流し、開発サーバを起動して
数秒後に**アプリ窓**（タブもアドレスバーも無い独立ウィンドウ）で `http://localhost:3000` を開く。
止めるのはその窓で `Ctrl+C`。

### アプリとしてインストールする（任意）

`dev.bat` のアプリ窓は毎回 `dev.bat` から開く前提。スタートメニューやタスクバーから
直接起動したいなら PWA としてインストールする:

1. `dev.bat` を起動する（サーバが動いていないとインストールできない）
2. **通常のブラウザタブ**で `http://localhost:3000` を開く。
   `dev.bat` が開くアプリ窓にはアドレスバーが無く、インストールボタンも出ない
3. アドレスバー右端のインストールアイコン（Edge なら「…」→ アプリ → このサイトをアプリとしてインストール）
4. スタートメニューに「やるぞ！」が入る。タスクバーにピン留めもできる

インストール後もサーバは要る。先に `dev.bat` を起動しておく（黒い窓は開いたままにする）。

アイコンを差し替えたときは、一度アンインストールしてから入れ直す。
`chrome://apps`（Edge は `edge://apps`）で「やるぞ！」を右クリック → 削除。
**削除ダイアログの「データも消去する」は必ずチェックを外す**。入れるとタスク履歴が消える。

`gh` が無い環境なら:

```
git clone https://github.com/N-Hayashi-v8/yaruzo.git
```

private のため認証が要る。`gh auth login`（HTTPS / Authenticate Git with your GitHub credentials は Yes）を
先に通しておくのが早い。Windows で `gh` が PATH に出てこない場合はフルパスで叩く:
`& "C:\Program Files\GitHub CLI\gh.exe" auth login`

## 3. 動作確認

```bash
npm test        # 通ればロジック健全
npm run lint
npm run build
npx tsc --noEmit
```

`npx tsc --noEmit` は **`npm run build` の後に叩く**。`app/layout.tsx` が使う `LayoutProps` は
Next.js が `.next/types/` に自動生成する型で、clone 直後（`.next/` が無い状態）だと
`error TS2304: Cannot find name 'LayoutProps'` で落ちる。ビルドが通っていれば型も揃う。

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

`.gitignore` 対象。**存在しないし、今後も要らない**。
外部サービスを一切使わない設計に決まった（LLM 分解は不採用。DESIGN.md 3章 分解）。

## 5. リポジトリの現状

- リモート: `origin` = <https://github.com/N-Hayashi-v8/yaruzo>（private）
- 既定ブランチ: `main`
- P1〜P4 + UI（ブルータリスト方向）までコミット済み・push 済み

リポジトリ名は `ter` → `tsugi` → `yaruzo` と 2 回リネームしている。
旧 URL は GitHub がリダイレクトするが、新しく書くときは `yaruzo` を使う。

**ローカルのフォルダ名は git 管理外。** クローン先が `tsugi` のままでも動く。
揃えたいなら開発サーバを止めてから手で `yaruzo` にリネームし、`.next/` を消す
（絶対パスがキャッシュに残る）。`npm run dev` が作り直す。

## 6. 読む順番

1. `CLAUDE.md` — 前提と禁止事項。曲げるな
2. `DESIGN.md` — 全画面仕様、フェーズ、作らないものリスト
3. `lib/types.ts` — データ形状
4. `app/page.tsx` — UI 全部（配色・フォントのトークンは `app/globals.css`）

`AGENTS.md` は Next.js が自動生成・自動再追記するファイル。手で消しても `next dev` が戻す。
