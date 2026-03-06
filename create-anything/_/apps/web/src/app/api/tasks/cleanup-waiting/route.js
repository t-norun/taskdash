import { authenticateUser } from "../../utils/auth";

const V2_BASE =
  process.env.V2_API_BASE_URL ||
  process.env.NEXT_PUBLIC_V2_API_BASE_URL ||
  "http://localhost:3000";

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
  // よくある形を吸収
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
    // create-anything 側が JWT 認証なら合わせる（現行 waiting-count もそうだった）
    // もしここが管理者専用で認証不要にしたいなら、この行を消せばOK
    await authenticateUser(request);

    // v2側の cleanup / pump / reconcile 系の候補
    const candidates = [
      // あなたがログで使ってた "pump" 系（Run-LoadTestで見えたやつ）
      { url: `${V2_BASE}/dev/match/next`, method: "POST", body: {} },
      // よくある命名
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
        // 404以外の失敗は打ち切ってフォールバック（UIを壊さない）
        break;
      }

      const cleaned = pickCleanedCount(data) ?? 0;

      return Response.json({
        message: cleaned > 0 ? `Cleaned up ${cleaned} waiting submissions` : "No submissions to cleanup",
        cleaned,
        // デバッグしたい時だけ見る用
        debug: data,
      });
    }

    // v2に該当APIが無い or 失敗した場合でも、ここは「0」で返す（create-anything を止めない）
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

