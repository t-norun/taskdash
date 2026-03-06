// apps/web/src/app/api/[...path]/route.js
// 4000側の /api/* を 3000(API) へ中継するプロキシ
// - CORSを回避するため、ブラウザは常に同一オリジン(4000)の /api を叩く
// - 認証ヘッダー等もそのまま転送

const API_ORIGIN = "http://localhost:3000";

async function proxy(request, params) {
  const path = Array.isArray(params?.path) ? params.path.join("/") : String(params?.path || "");
  const targetUrl = `${API_ORIGIN}/api/${path}${new URL(request.url).search}`;

  // 元リクエストのヘッダーをコピー（host等は除外）
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const init = {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
    redirect: "manual",
  };

  const upstream = await fetch(targetUrl, init);

  // upstreamレスポンスをそのまま返す（content-type等も維持）
  const resHeaders = new Headers(upstream.headers);
  // 4000→ブラウザは同一オリジンなのでCORSヘッダは不要だが、念のため害はない
  resHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function GET({ request, params }) {
  return proxy(request, params);
}
export async function POST({ request, params }) {
  return proxy(request, params);
}
export async function PUT({ request, params }) {
  return proxy(request, params);
}
export async function PATCH({ request, params }) {
  return proxy(request, params);
}
export async function DELETE({ request, params }) {
  return proxy(request, params);
}
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization,Content-Type",
    },
  });
}
