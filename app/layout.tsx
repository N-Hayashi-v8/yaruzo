import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "やるぞ！",
  description: "次の1個だけ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* next/font は日本語サブセットを持たない（latin 系のみ）ため <link> で読む。
            Google の unicode-range 分割で必要な字だけ落ちる */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@700;900&family=Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@400;700;900&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
