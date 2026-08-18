import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発中の左下バッジを消す。NOW 画面に余計な視覚ノイズを出さない
  devIndicators: false,
  /* config options here */
};

export default nextConfig;
