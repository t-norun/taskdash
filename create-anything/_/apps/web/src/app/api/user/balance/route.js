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

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function computeFromWallets(payload) {
  // v2が { wallets: [...] } か { userWallet, escrowWallet, ... } かを吸収
  const wallets = Array.isArray(payload?.wallets)
    ? payload.wallets
    : Array.isArray(payload)
      ? payload
      : null;

  // 直接 balance/reserved があるなら最優先で使う
  const directBalance =
    num(payload?.balance) ??
    num(payload?.available) ??
    num(payload?.userWallet?.balance) ??
    null;

  const directReserved =
    num(payload?.reserved) ??
    num(payload?.reservedBalance) ??
    null;

  if (directBalance !== null) {
    const reserved = directReserved ?? 0;
    return {
      balance: directBalance + reserved, // balance=total の定義が違う場合に備えて一応整える
      reserved,
      available: directBalance,
    };
  }

  if (!wallets) return null;

  // wallet.type 例: USER / ESCROW / PLATFORM
  const user = wallets.find((w) => String(w.type).toUpperCase() === "USER");
  const escrow = wallets.find((w) => String(w.type).toUpperCase() === "ESCROW");

  const userBal = num(user?.balance) ?? 0;

  // create-anythingの reserved は「自分の拘束分」の概念。
  // v2のESCROWは“全体”で持ってる可能性があるので、ここで reserved に入れるのは危険。
  // 最短は reserved=0 にして、available=userBal に寄せる。
  const reserved = 0;

  return {
    balance: userBal + reserved,
    reserved,
    available: userBal,
  };
}

export async function GET(request) {
  try {
    // create-anything側の認証は維持（JWT/OTPのまま）
    const user = await authenticateUser(request);

    // v2で userId を要求するAPIがある場合に備えて渡せるようにする
    const userId = String(user.id);

    // v2残高API候補（404なら次へ）
    const candidates = [
      // もし v2 が「自分の残高」系を持ってる
      `${V2_BASE}/me/balance`,
      `${V2_BASE}/user/balance`,
      `${V2_BASE}/wallet/balance`,
      // wallets 一覧を返す系
      `${V2_BASE}/me/wallets`,
      `${V2_BASE}/wallets/me`,
      // userId クエリで取る系
      `${V2_BASE}/wallets/by-user?userId=${encodeURIComponent(userId)}`,
      `${V2_BASE}/dev/wallets/by-user?userId=${encodeURIComponent(userId)}`, // dev しか無い場合の逃げ
    ];

    let lastNon404 = null;

    for (const url of candidates) {
      const res = await fetch(url, {
        method: "GET",
        headers: forwardHeaders(request),
        cache: "no-store",
      });

      if (res.status === 404) continue;

      const data = await res.json().catch(() => ({}));
      lastNon404 = { url, status: res.status, data };

      if (!res.ok || data?.ok === false) {
        break;
      }

      const normalized = computeFromWallets(data);
      if (normalized) {
        return Response.json(normalized);
      }
    }

    // v2から取れない時でも、UIを壊さないために「今の認証情報の残高」を返しておく（ただし将来ズレる）
    // ここは “最短で動かす保険”。v2に残高APIが用意できたら、このフォールバックは消してOK。
    const totalBalance = Number(user.balance) || 0;
    const reservedBalance = Number(user.reserved_balance || 0) || 0;
    const availableBalance = totalBalance - reservedBalance;

    return Response.json({
      balance: totalBalance,
      reserved: reservedBalance,
      available: availableBalance,
      debug: { fallback: true, lastNon404 },
    });
  } catch (error) {
    console.error("Get balance error:", error);
    return Response.json(
      { error: error?.message || "Unauthorized" },
      { status: 401 },
    );
  }
}

