import type { MetadataRoute } from "next";

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
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
