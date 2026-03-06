import { authenticateUser } from "../../utils/auth";

const V2_BASE =
  process.env.V2_API_BASE_URL ||
  process.env.NEXT_PUBLIC_V2_API_BASE_URL ||
  "https://api.taskdash.net";

function forwardHeaders(request) {
  const h = new Headers();

  const auth = request.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  const cookie = request.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);

  const devKey = request.headers.get("x-dev-key");
  if (devKey) h.set("x-dev-key", devKey);

  h.set("content-type", "application/json");
  return h;
}

function pickCleanedCount(data) {
  // 繧医￥縺ゅｋ蠖｢繧貞精蜿・
  const candidates = [
    data?.cleaned,
    data?.count,
    data?.processed,
    data?.pumped,
    data?.settled,
    data?.refunded,
    data?.result?.cleaned,
    data?.result?.count,
  ];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export async function POST(request) {
  try {
    // create-anything 蛛ｴ縺・JWT 隱崎ｨｼ縺ｪ繧牙粋繧上○繧具ｼ育樟陦・waiting-count 繧ゅ◎縺・□縺｣縺滂ｼ・
    // 繧ゅ＠縺薙％縺檎ｮ｡逅・・ｰら畑縺ｧ隱崎ｨｼ荳崎ｦ√↓縺励◆縺・↑繧峨√％縺ｮ陦後ｒ豸医○縺ｰOK
    await authenticateUser(request);

    // v2蛛ｴ縺ｮ cleanup / pump / reconcile 邉ｻ縺ｮ蛟呵｣・
    const candidates = [
      // 縺ゅ↑縺溘′繝ｭ繧ｰ縺ｧ菴ｿ縺｣縺ｦ縺・"pump" 邉ｻ・・un-LoadTest縺ｧ隕九∴縺溘ｄ縺､・・
      { url: `${V2_BASE}/dev/match/next`, method: "POST", body: {} },
      // 繧医￥縺ゅｋ蜻ｽ蜷・
      { url: `${V2_BASE}/tasks/cleanup-waiting`, method: "POST", body: {} },
      { url: `${V2_BASE}/attempts/cleanup-waiting`, method: "POST", body: {} },
      { url: `${V2_BASE}/queue/cleanup`, method: "POST", body: {} },
      { url: `${V2_BASE}/attempts/pump`, method: "POST", body: {} },
    ];

    let lastNon404 = null;

    for (const c of candidates) {
      const res = await fetch(c.url, {
        method: c.method,
        headers: forwardHeaders(request),
        body: JSON.stringify(c.body ?? {}),
        cache: "no-store",
      });

      if (res.status === 404) continue;

      const data = await res.json().catch(() => ({}));
      lastNon404 = { status: res.status, data };

      if (!res.ok || data?.ok === false) {
        // 404莉･螟悶・螟ｱ謨励・謇薙■蛻・▲縺ｦ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・・I繧貞｣翫＆縺ｪ縺・ｼ・
        break;
      }

      const cleaned = pickCleanedCount(data) ?? 0;

      return Response.json({
        message: cleaned > 0 ? `Cleaned up ${cleaned} waiting submissions` : "No submissions to cleanup",
        cleaned,
        // 繝・ヰ繝・げ縺励◆縺・凾縺縺題ｦ九ｋ逕ｨ
        debug: data,
      });
    }

    // v2縺ｫ隧ｲ蠖鄭PI縺檎┌縺・or 螟ｱ謨励＠縺溷ｴ蜷医〒繧ゅ√％縺薙・縲・縲阪〒霑斐☆・・reate-anything 繧呈ｭ｢繧√↑縺・ｼ・
    return Response.json({
      message: "No submissions to cleanup",
      cleaned: 0,
      ...(lastNon404 ? { debug: lastNon404 } : {}),
    });
  } catch (error) {
    console.error("Cleanup waiting error:", error);
    return Response.json(
      { error: error?.message || "Failed to cleanup waiting submissions" },
      { status: error?.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}


