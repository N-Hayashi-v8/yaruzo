# SETUP.md

別 PC への引き継ぎ手順。

## 1. 必要な環境

デスクトップアプリ（Tauri）としてビルドするので、Web だけの頃より前提が増えている。

- **Node**（動作確認済み: v26.5.0 / npm 11.17.0、v24.18.0 / npm 11.16.0）
  - 条件は「**フラグなしで `.ts` を直接実行できる Node**」。古い Node だと `npm test` が落ちる。
    テストは追加依存なしで動かすため **Node の TypeScript 直接実行**（型ストリップ）に
    乗っている。`node --test lib/*.test.ts`（`package.json` の `test`）
  - `tsconfig.json` の `allowImportingTsExtensions: true` も同じ理由。テストが `./select.ts` と
    拡張子付きで import するため。消すな
- git
- **Rust**（動作確認済み: rustc / cargo 1.98.1）

  ```
  winget install --id Rustlang.Rustup -e
  ```

  入れた直後、**開いたままのターミナルには PATH が反映されない**。新しいターミナルを開く。
  それでも `cargo` が見つからないときは `%USERPROFILE%\.cargo\bin` を PATH に足す
- **Microsoft C++ Build Tools**（Rust の Windows リンカ。MSVC）

  ```
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  ```

  ディスク **~5GB**、インストールに十数分かかる。`--add Microsoft.VisualStudio.Workload.VCTools`
  （= 「C++ によるデスクトップ開発」）が本体。これが無いと `cargo build` がリンクで落ちる
- **WebView2** — Windows 11 はプリインストール済み。何もしなくていい。
  Windows 10 以前なら Tauri の生成するインストーラが面倒を見る
- ブラウザ（開発時のみ。Chrome / Edge）
- **ビルド時のネット接続** — `next/font` が Google Fonts の実体をビルド時に落として
  `out/` に同梱する（`app/layout.tsx`）。落とした後は アプリ側がネットを使うことはない。
  フォントだけで `out/` が 7MB 前後になる。これは想定どおり

macOS / Linux でもビルドできる構成だが、確認していない。

## 2. セットアップ

リポジトリ: <https://github.com/N-Hayashi-v8/yaruzo>（private）

```
gh repo clone N-Hayashi-v8/yaruzo
cd yaruzo
npm install
```

### 2-1. アプリとして入れる（普段使う形）

```
npm run tauri build
```

`src-tauri/target/release/bundle/nsis/やるぞ！_0.1.0_x64-setup.exe` が出る。
これを実行するとスタートメニューに「やるぞ！」が入る。**普段の起動はここから**。

初回ビルドは Rust の依存を全部コンパイルするので数分かかる。2 回目以降はキャッシュが効く。

インストーラを通さず素の実行ファイルを直接叩いてもいい:
`src-tauri/target/release/yaruzo.exe`（8MB 台）。スタートメニューには入らない。

### 2-2. 開発する

```
npm run dev
```

→ `http://localhost:3000` をブラウザで開く。保存で即反映。**画面を作るときはこれが速い**。

アプリの窓ごと動かして確かめたいときは:

```
npm run tauri dev
```

Next の開発サーバを立てて、その中身を Tauri の窓に出す。保存で反映されるのは同じ。
ただし Rust 側のビルドを挟むぶん起動が重い。

### 2-3. アイコンを差し替えたとき

元データは `public/icon-512.png`。ここを差し替えたら:

```
npx tauri icon public/icon-512.png
```

`src-tauri/icons/` の各サイズが作り直される。モバイル用（`android/` `ios/`）も生成されるが
このアプリでは使わないので消していい。あとは `npm run tauri build` で入れ直す。

`app/manifest.ts` の `?v=` は **Vercel に載せた web 版の PWA 用**。
デスクトップ版のアイコンには関係しない。

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

`.gitignore` は create-next-app 既定 + `src-tauri/.gitignore`。中身の大半は **再生成できる**。

再生成でいいもの（無視してよい）:

- `node_modules/` → `npm install`
- `.next/`, `out/` → `npm run build`
- `src-tauri/target/` → `npm run tauri build`（初回は数分かかる）
- `next-env.d.ts` → `npm run dev` / `build` が自動生成
- `*.tsbuildinfo`, `coverage/`, `.vercel`

**手で運ぶ必要があるもの（重要）:**

### 4-1. タスクデータ（最重要）

データは **WebView の IndexedDB**（`lib/store.ts`。DB 名 `yaruzo` / キー `task-app-v1`）。
git にもプロジェクトのファイルにも存在しない。**PC を変えるとタスクは 1 件も引き継がれない。**

デスクトップ版の実体はここ:

```
%LOCALAPPDATA%\app.yaruzo.desktop\EBWebView\Default\IndexedDB\
```

**オリジンごとに別の入れ物になる。** デスクトップ版は `http://tauri.localhost`、
web 版（Vercel / `localhost:3000`）はそれぞれ別。**web 版で溜めたタスクは自動では移らない。**

移すなら、移行元で DevTools のコンソール（F12）から:

```js
copy(JSON.stringify(await new Promise((ok) => {
  const r = indexedDB.open('yaruzo', 1);
  r.onsuccess = () => r.result.transaction('store').objectStore('store').get('task-app-v1').onsuccess = (e) => ok(e.target.result);
})))
```

移行先のコンソールで:

```js
const data = ここに貼る;
const r = indexedDB.open('yaruzo', 1);
r.onsuccess = () => r.result.transaction('store', 'readwrite').objectStore('store').put(data, 'task-app-v1').onsuccess = () => location.reload();
```

デスクトップ版で DevTools を開くには **debug ビルドが要る**（`npm run tauri dev` の窓なら
右クリック → 検証、または F12）。リリースビルドの窓では開かない。

要らないなら移行しなくていい。空で始まる。

### 4-2. `.env*`

`.gitignore` 対象。**存在しないし、今後も要らない**。
外部サービスを一切使わない設計に決まった（LLM 分解は不採用。DESIGN.md 3章 分解）。

## 5. リポジトリの現状

- リモート: `origin` = <https://github.com/N-Hayashi-v8/yaruzo>（private）
- 既定ブランチ: `main`
- P1〜P6（デスクトップアプリ化・今日の約束 まで）コミット済み・push 済み

Vercel への web 版デプロイは残している。`public/about/index.html` を `/about` で人に見せるため。
`output: "export"` にしたので Vercel も静的サイトとして配信する。

リポジトリ名は `ter` → `tsugi` → `yaruzo` と 2 回リネームしている。
旧 URL は GitHub がリダイレクトするが、新しく書くときは `yaruzo` を使う。

**ローカルのフォルダ名は git 管理外。** クローン先が `tsugi` のままでも動く。
揃えたいなら開発サーバを止めてから手で `yaruzo` にリネームし、`.next/` と
`src-tauri/target/` を消す（絶対パスがキャッシュに残る）。次のビルドが作り直す。

## 6. 読む順番

1. `CLAUDE.md` — 前提と禁止事項。曲げるな
2. `DESIGN.md` — 全画面仕様、フェーズ、作らないものリスト
3. `lib/types.ts` — データ形状
4. `app/page.tsx` — NOW 画面 / `app/overlays.tsx` — オーバーレイ 4 つ
   （配色・フォントのトークンは `app/globals.css`）

`AGENTS.md` は Next.js が自動生成・自動再追記するファイル。手で消しても `next dev` が戻す。
