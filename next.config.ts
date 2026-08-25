import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発中の左下バッジを消す。NOW 画面に余計な視覚ノイズを出さない
  devIndicators: false,
  // 説明ページ（public/about.html）を拡張子なしで開けるようにする。
  // 素の HTML のままなのは、React を経由せず直接手で直せるようにするため
  async rewrites() {
    return [{ source: "/about", destination: "/about.html" }];
  },
};

export default nextConfig;
