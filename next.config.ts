import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発中の左下バッジを消す。NOW 画面に余計な視覚ノイズを出さない
  devIndicators: false,
  // Tauri はサーバを持たない。out/ に静的出力して WebView に載せる。
  // Vercel 側も同じ出力をそのまま静的配信できるので、web 版と共通で使える。
  // この設定を入れると rewrites() は使えなくなる。/about は public/about/index.html に置いて、
  // どこに載せてもパスだけで解決できるようにした
  output: "export",
  // dev のときだけアセットの参照先を開発サーバに向ける。
  // Tauri の dev（WebView が別オリジンから読む）で相対解決が壊れるのを防ぐ
  assetPrefix: process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000",
};

export default nextConfig;
