import sql from "../../utils/sql";
import { paypalRequest } from "#/app/api/paypal/utils/auth";
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

  // v2 dev endpoint 繧貞娼縺上↑繧牙ｿ・ｦ・ｼ医≠縺ｪ縺溘・迺ｰ蠅・□縺ｨ x-dev-key 縺ゅｋ縺ｯ縺夲ｼ・
  const devKey =
    request.headers.get("x-dev-key") ||
    process.env.V2_DEV_KEY ||
    process.env.NEXT_PUBLIC_V2_DEV_KEY;
  if (devKey) h.set("x-dev-key", devKey);

  h.set("content-type", "application/json");
  return h;
}

async function creditToV2({ request, userId, captureId, amountUsd }) {
  const amountCents = Math.round(Number(amountUsd) * 100);

  // v2 蜈･驥大呵｣懶ｼ育腸蠅・ｷｮ蜷ｸ蜿趣ｼ・
  const candidates = [
    // 譛ｬ蜻ｽ・壹≠縺ｪ縺溘′縺吶〒縺ｫ菴ｿ縺｣縺ｦ縺・dev 蜈･驥・
    {
      url: `${V2_BASE}/dev/tx/entry`,
      body: { userId, transactionId: captureId, amount: amountCents },
    },
    // 繧ゅ＠蟆・擂縲∵ｭ｣蠑上↑蜈･驥羨PI縺後〒縺阪◆蝣ｴ蜷・
    {
      url: `${V2_BASE}/tx/deposit`,
      body: { userId, transactionId: captureId, amountCents },
    },
    {
      url: `${V2_BASE}/wallet/deposit`,
      body: { userId, transactionId: captureId, amountCents },
    },
  ];

  let last = null;

  for (const c of candidates) {
    const res = await fetch(c.url, {
      method: "POST",
      headers: forwardHeaders(request),
      body: JSON.stringify(c.body),
      cache: "no-store",
    });

    if (res.status === 404) continue;

    const data = await res.json().catch(() => ({}));
    last = { url: c.url, status: res.status, data };

    if (!res.ok || data?.ok === false) {
      // 404莉･螟悶・螟ｱ謨励・謇薙■蛻・ｊ
      break;
    }

    return { ok: true, data, amountCents };
  }

  return { ok: false, last, amountCents };
}

async function fetchV2UserBalanceUsd({ request, userId }) {
  // v2 wallet 蜿門ｾ怜呵｣・
  const candidates = [
    `${V2_BASE}/wallets/by-user?userId=${encodeURIComponent(userId)}`,
    `${V2_BASE}/dev/wallets/by-user?userId=${encodeURIComponent(userId)}`,
    `${V2_BASE}/me/wallets`,
  ];

  for (const url of candidates) {
    const res = await fetch(url, {
      method: "GET",
      headers: forwardHeaders(request),
      cache: "no-store",
    });
    if (res.status === 404) continue;

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) break;

    const wallets = Array.isArray(data?.wallets) ? data.wallets : Array.isArray(data) ? data : null;
    if (!wallets) break;

    const userWallet = wallets.find((w) => String(w.type).toUpperCase() === "USER");
    const balCents = Number(userWallet?.balance);
    if (Number.isFinite(balCents)) return balCents / 100;
    break;
  }

  return null;
}

/**
 * PayPal豎ｺ貂医ｒ遒ｺ螳壹＠縲」2 wallet 縺ｫ蜈･驥・
 */
export async function POST(request) {
  try {
    const user = await authenticateUser(request);
    const { orderId } = await request.json();

    console.log(`跳 Capturing PayPal order for user ${user.id}, orderId: ${orderId}`);

    if (!orderId) {
      return Response.json({ error: "Order ID required" }, { status: 400 });
    }

    // 1) PayPal縺ｧ豎ｺ貂医ｒ遒ｺ螳・
    const captureData = await paypalRequest(`/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
    });

    const captureAmount = parseFloat(
      captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value,
    );
    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    if (!Number.isFinite(captureAmount) || !captureId) {
      return Response.json(
        { error: "Invalid PayPal capture response", debug: captureData },
        { status: 502 },
      );
    }

    console.log(`腸 Capture amount: $${captureAmount}, captureId: ${captureId}`);

    // 2) v2 縺ｫ蜈･驥托ｼ・aptureId 繧・transactionId 縺ｫ縺励※莠碁㍾險井ｸ翫ｒ髦ｲ縺撰ｼ・
    const credit = await creditToV2({
      request,
      userId: String(user.id),
      captureId: String(captureId),
      amountUsd: captureAmount,
    });

    if (!credit.ok) {
      return Response.json(
        {
          error: "Failed to credit v2 wallet",
          debug: credit.last,
        },
        { status: 502 },
      );
    }

    // 3) legacy 蛛ｴ縺ｯ縲訓ayPal蜿門ｼ輔Ο繧ｰ縲阪□縺第峩譁ｰ・域ｮ九＠縺ｦ繧０K繝ｻ豸医＠縺ｦ繧０K・・
    // 窶ｻ縺薙％縺ｧ users.balance / ledger 縺ｯ譖ｴ譁ｰ縺励↑縺・ｼ・2繧呈ｭ｣縺ｫ縺吶ｋ・・
    await sql.transaction([
      sql`
        UPDATE paypal_transactions
        SET
          status = 'COMPLETED',
          capture_id = ${String(captureId)},
          raw_response = ${JSON.stringify(captureData)}
        WHERE order_id = ${orderId}
      `,
    ]);

    // 4) v2縺ｮ谿矩ｫ倥ｒ霑斐☆・亥叙繧後↑縺代ｌ縺ｰ null・・
    const newBalanceUsd = await fetchV2UserBalanceUsd({
      request,
      userId: String(user.id),
    });

    return Response.json({
      success: true,
      captureId,
      amount: captureAmount,
      newBalance: newBalanceUsd, // v2縺九ｉ蜿悶ｌ縺溘ｉ謨ｰ蛟､縲∝叙繧後↑縺代ｌ縺ｰ null
      // 繝・ヰ繝・げ逕ｨ縺ｫ谿九＠縺ｦ縺翫￥・井ｸ崎ｦ√↑繧画ｶ医＠縺ｦOK・・
      v2: credit.data,
    });
  } catch (error) {
    console.error("笶・Capture PayPal order error:", error);
    return Response.json(
      { error: error?.message || "Failed to capture order" },
      { status: error?.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}

