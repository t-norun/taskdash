import sql from "../../utils/sql";
import { paypalRequest } from "#/app/api/paypal/utils/auth";
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

  // v2 dev endpoint を叩くなら必要（あなたの環境だと x-dev-key あるはず）
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

  // v2 入金候補（環境差吸収）
  const candidates = [
    // 本命：あなたがすでに使ってた dev 入金
    {
      url: `${V2_BASE}/dev/tx/entry`,
      body: { userId, transactionId: captureId, amount: amountCents },
    },
    // もし将来、正式な入金APIができた場合
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
      // 404以外の失敗は打ち切り
      break;
    }

    return { ok: true, data, amountCents };
  }

  return { ok: false, last, amountCents };
}

async function fetchV2UserBalanceUsd({ request, userId }) {
  // v2 wallet 取得候補
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
 * PayPal決済を確定し、v2 wallet に入金
 */
export async function POST(request) {
  try {
    const user = await authenticateUser(request);
    const { orderId } = await request.json();

    console.log(`💵 Capturing PayPal order for user ${user.id}, orderId: ${orderId}`);

    if (!orderId) {
      return Response.json({ error: "Order ID required" }, { status: 400 });
    }

    // 1) PayPalで決済を確定
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

    console.log(`💰 Capture amount: $${captureAmount}, captureId: ${captureId}`);

    // 2) v2 に入金（captureId を transactionId にして二重計上を防ぐ）
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

    // 3) legacy 側は「PayPal取引ログ」だけ更新（残してもOK・消してもOK）
    // ※ここで users.balance / ledger は更新しない（v2を正にする）
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

    // 4) v2の残高を返す（取れなければ null）
    const newBalanceUsd = await fetchV2UserBalanceUsd({
      request,
      userId: String(user.id),
    });

    return Response.json({
      success: true,
      captureId,
      amount: captureAmount,
      newBalance: newBalanceUsd, // v2から取れたら数値、取れなければ null
      // デバッグ用に残しておく（不要なら消してOK）
      v2: credit.data,
    });
  } catch (error) {
    console.error("❌ Capture PayPal order error:", error);
    return Response.json(
      { error: error?.message || "Failed to capture order" },
      { status: error?.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}
