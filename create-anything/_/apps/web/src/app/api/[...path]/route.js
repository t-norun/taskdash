// apps/web/src/app/api/[...path]/route.js
// 4000蛛ｴ縺ｮ /api/* 繧・3000(API) 縺ｸ荳ｭ邯吶☆繧九・繝ｭ繧ｭ繧ｷ
// - CORS繧貞屓驕ｿ縺吶ｋ縺溘ａ縲√ヶ繝ｩ繧ｦ繧ｶ縺ｯ蟶ｸ縺ｫ蜷御ｸ繧ｪ繝ｪ繧ｸ繝ｳ(4000)縺ｮ /api 繧貞娼縺・
// - 隱崎ｨｼ繝倥ャ繝繝ｼ遲峨ｂ縺昴・縺ｾ縺ｾ霆｢騾・

const API_ORIGIN = "https://api.taskdash.net";

async function proxy(request, params) {
  const path = Array.isArray(params?.path) ? params.path.join("/") : String(params?.path || "");
  const targetUrl = `${API_ORIGIN}/api/${path}${new URL(request.url).search}`;

  // 蜈・Μ繧ｯ繧ｨ繧ｹ繝医・繝倥ャ繝繝ｼ繧偵さ繝斐・・・ost遲峨・髯､螟厄ｼ・
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

  // upstream繝ｬ繧ｹ繝昴Φ繧ｹ繧偵◎縺ｮ縺ｾ縺ｾ霑斐☆・・ontent-type遲峨ｂ邯ｭ謖・ｼ・
  const resHeaders = new Headers(upstream.headers);
  // 4000竊偵ヶ繝ｩ繧ｦ繧ｶ縺ｯ蜷御ｸ繧ｪ繝ｪ繧ｸ繝ｳ縺ｪ縺ｮ縺ｧCORS繝倥ャ繝縺ｯ荳崎ｦ√□縺後∝ｿｵ縺ｮ縺溘ａ螳ｳ縺ｯ縺ｪ縺・
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

