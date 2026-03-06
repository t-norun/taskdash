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

  return h;
}

// v2縺ｮ霑泌唆繧・{ waitingCounts: { [priceUsd]: count } } 縺ｫ蟇・○繧・
function normalizeWaitingCounts(data) {
  // 譛溷ｾ・ｾ・: { waitingCounts: { "1": 2, "5": 0 } }
  if (data?.waitingCounts && typeof data.waitingCounts === "object") {
    return data.waitingCounts;
  }

  // 譛溷ｾ・ｾ・: { countsByPrice: {...} }
  if (data?.countsByPrice && typeof data.countsByPrice === "object") {
    return data.countsByPrice;
  }

  // 譛溷ｾ・ｾ・: { items: [{ priceUsd: 1, waitingCount: 2 }, ...] }
  const items = data?.items || data?.data || data;
  if (Array.isArray(items)) {
    const out = {};
    for (const it of items) {
      const price =
        Number(it.priceUsd ?? it.price ?? it.usd ?? it.price_usd);
      const cnt = Number(it.waitingCount ?? it.count ?? it.waiting_count);
      if (Number.isFinite(price) && Number.isFinite(cnt)) out[price] = cnt;
    }
    return out;
  }

  return null;
}

export async function GET(request) {
  try {
    await authenticateUser(request);

    // v2縺ｫ縲詣aiting-count縲咲ｳｻ縺後≠繧区Φ螳壹〒鬆・↓隧ｦ縺呻ｼ育┌縺代ｌ縺ｰ {} 縺ｫ蛟偵☆・・
    const candidates = [
      `${V2_BASE}/tasks/waiting-count`,
      `${V2_BASE}/queue/waiting-count`,
      `${V2_BASE}/analytics/waiting-count`,
      `${V2_BASE}/admin/analytics/waiting-count`,
    ];

    let data = null;

    for (const url of candidates) {
      const res = await fetch(url, {
        method: "GET",
        headers: forwardHeaders(request),
        cache: "no-store",
      });

      if (res.status === 404) continue;

      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        // 404莉･螟悶・螟ｱ謨励・縲√◎縺ｮ蝣ｴ縺ｧ謇薙■蛻・▲縺ｦ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
        break;
      }

      const normalized = normalizeWaitingCounts(j);
      if (normalized) {
        data = normalized;
        break;
      }
    }

    // v2縺ｫ辟｡縺・蠖｢縺瑚ｪｭ繧√↑縺・↑繧峨∵怙遏ｭ縺ｯ遨ｺ縺ｧ霑斐☆・・I繧貞｣翫＆縺ｪ縺・ｼ・
    return Response.json({
      waitingCounts: data ?? {},
    });
  } catch (error) {
    console.error("Waiting count error:", error);
    return Response.json(
      { error: error?.message || "Failed to get waiting count" },
      { status: error?.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}


