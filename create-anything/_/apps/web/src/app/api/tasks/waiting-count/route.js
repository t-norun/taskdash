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

  return h;
}

// v2の返却を { waitingCounts: { [priceUsd]: count } } に寄せる
function normalizeWaitingCounts(data) {
  // 期待例1: { waitingCounts: { "1": 2, "5": 0 } }
  if (data?.waitingCounts && typeof data.waitingCounts === "object") {
    return data.waitingCounts;
  }

  // 期待例2: { countsByPrice: {...} }
  if (data?.countsByPrice && typeof data.countsByPrice === "object") {
    return data.countsByPrice;
  }

  // 期待例3: { items: [{ priceUsd: 1, waitingCount: 2 }, ...] }
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

    // v2に「waiting-count」系がある想定で順に試す（無ければ {} に倒す）
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
        // 404以外の失敗は、その場で打ち切ってフォールバック
        break;
      }

      const normalized = normalizeWaitingCounts(j);
      if (normalized) {
        data = normalized;
        break;
      }
    }

    // v2に無い/形が読めないなら、最短は空で返す（UIを壊さない）
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

