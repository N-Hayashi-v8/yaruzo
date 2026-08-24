// サーバが落ちていてもアプリが起動するようにする。
// 一度オンラインで開いたリソースをキャッシュし、次からは fetch 失敗時にそこから返す。
// プリキャッシュしないのは、Next.js のビルド出力がハッシュ付きで一覧を書けないため。
const CACHE = "yaruzo-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  e.respondWith(
    // ネットワーク優先。サーバが動いていれば常に最新が出る。
    // localhost は落ちていれば即 ECONNREFUSED が返るので待たされない
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        // ページ遷移だけは / のキャッシュで代替する（オフライン起動の入口）
        if (req.mode === "navigate") {
          const root = await caches.match("/");
          if (root) return root;
        }
        return Response.error();
      }),
  );
});
