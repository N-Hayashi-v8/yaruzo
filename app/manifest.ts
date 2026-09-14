import type { MetadataRoute } from "next";

// output: "export" ではルートハンドラも静的に吐く指定が要る。
// 付けないと「manifest.webmanifest に force-static が無い」でビルドが落ちる
export const dynamic = "force-static";

/** PWA マニフェスト。ブラウザから「インストール」するとタブのない独立窓で開く */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "やるぞ！",
    short_name: "やるぞ！",
    description: "次の1個だけ",
    start_url: "/",
    display: "standalone",
    background_color: "#f2eee3",
    theme_color: "#d9f026",
    lang: "ja",
    // ?v= はアイコンを差し替えたときに上げる。付けないとブラウザが古い PNG を
    // キャッシュから使い、インストールし直しても前のアイコンのままになる
    icons: [
      { src: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
