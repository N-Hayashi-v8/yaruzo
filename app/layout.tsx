import type { Metadata, Viewport } from "next";
import { Azeret_Mono, Dela_Gothic_One, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

/*
  フォントは next/font でビルド時に落として同梱する。<link> で fonts.googleapis.com を
  読むと、起動のたびに外へ取りに行く = ネットが遅い/無いとき 別の字で出る。
  デスクトップアプリ（Tauri）は オフラインでも同じ顔で開く必要がある。

  `preload: false` は 日本語フォントだから。next/font は preload するサブセットを
  `subsets` で指定させるが、日本語は latin のような名前付きサブセットを持たない
  （unicode-range で 100 以上に割れている）。preload を切れば 使う字のぶんだけ落ちる。
*/
const sans = Zen_Kaku_Gothic_New({
  weight: ["400", "700", "900"],
  display: "swap",
  preload: false,
  variable: "--font-zen",
  fallback: ["Hiragino Kaku Gothic ProN", "Yu Gothic", "sans-serif"],
});

const mono = Azeret_Mono({
  weight: ["700", "900"],
  display: "swap",
  preload: false,
  variable: "--font-azeret",
  fallback: ["ui-monospace", "monospace"],
});

const display = Dela_Gothic_One({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-dela",
  fallback: ["Hiragino Kaku Gothic ProN", "sans-serif"],
});

// iOS のキーボード表示時、fixed 要素がレイアウトビューポートに固定されたままで
// URL バーやキーボードと重なる。resizes-content でキーボード分もビューポートを縮める
//
// viewport-fit=cover は ホーム画面から開いたとき（standalone）用。
// これが無いと env(safe-area-inset-*) が全部 0 になり、下端の操作札が
// ホームインジケータのスワイプ領域に食い込む。cover にすると上下左右の余白を
// 自分で持つことになるので、header / footer / オーバーレイの 3 箇所で env() を足している
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "やるぞ！",
  description: "次の1個だけ",
  // iOS Safari は manifest.ts の icons を見ない。ホーム画面追加用に別途必要
  appleWebApp: {
    capable: true,
    title: "やるぞ！",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icon-192.png?v=2",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`h-full antialiased ${sans.variable} ${mono.variable} ${display.variable}`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
