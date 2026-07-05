// TKP会場ファインダー Cloudflare Worker
// - 通常パス（/ , /onestop.jpg 等）は静的アセットを配信
// - /proxy?url=<kashikaigishitsu.netのURL> は同一オリジンのCORSプロキシとして中継
//   （公開プロキシのレート制限/停止に依存しない、確実なデータ取得経路）

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/proxy") {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" };
      if (request.method === "OPTIONS") return new Response(null, { headers: cors });

      const target = url.searchParams.get("url");
      let host;
      try { host = new URL(target).hostname; } catch (e) { return new Response("bad url", { status: 400, headers: cors }); }
      if (!/^https?:$/.test(new URL(target).protocol)) return new Response("bad scheme", { status: 400, headers: cors });
      // 中継先はkashikaigishitsu.netのみ許可（オープンプロキシ化を防止）
      if (!/(^|\.)kashikaigishitsu\.net$/i.test(host)) return new Response("forbidden host", { status: 403, headers: cors });

      try {
        const upstream = await fetch(target, {
          headers: { "User-Agent": UA, "Accept": "text/html,image/webp,image/*,*/*" },
          redirect: "follow",
          cf: { cacheTtl: 300, cacheEverything: true },
        });
        const headers = new Headers(cors);
        headers.set("content-type", upstream.headers.get("content-type") || "application/octet-stream");
        headers.set("cache-control", "public, max-age=300");
        return new Response(upstream.body, { status: upstream.status, headers });
      } catch (e) {
        return new Response("proxy error: " + e, { status: 502, headers: cors });
      }
    }

    // 静的アセット
    if (env && env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("not found", { status: 404 });
  },
};
