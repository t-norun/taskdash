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

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function computeFromWallets(payload) {
  // v2縺・{ wallets: [...] } 縺・{ userWallet, escrowWallet, ... } 縺九ｒ蜷ｸ蜿・
  const wallets = Array.isArray(payload?.wallets)
    ? payload.wallets
    : Array.isArray(payload)
      ? payload
      : null;

  // 逶ｴ謗･ balance/reserved 縺後≠繧九↑繧画怙蜆ｪ蜈医〒菴ｿ縺・
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
      balance: directBalance + reserved, // balance=total 縺ｮ螳夂ｾｩ縺碁＆縺・ｴ蜷医↓蛯吶∴縺ｦ荳蠢懈紛縺医ｋ
      reserved,
      available: directBalance,
    };
  }

  if (!wallets) return null;

  // wallet.type 萓・ USER / ESCROW / PLATFORM
  const user = wallets.find((w) => String(w.type).toUpperCase() === "USER");
  const escrow = wallets.find((w) => String(w.type).toUpperCase() === "ESCROW");

  const userBal = num(user?.balance) ?? 0;

  // create-anything縺ｮ reserved 縺ｯ縲瑚・蛻・・諡俶據蛻・阪・讎ょｿｵ縲・
  // v2縺ｮESCROW縺ｯ窶懷・菴凪昴〒謖√▲縺ｦ繧句庄閭ｽ諤ｧ縺後≠繧九・縺ｧ縲√％縺薙〒 reserved 縺ｫ蜈･繧後ｋ縺ｮ縺ｯ蜊ｱ髯ｺ縲・
  // 譛遏ｭ縺ｯ reserved=0 縺ｫ縺励※縲∥vailable=userBal 縺ｫ蟇・○繧九・
  const reserved = 0;

  return {
    balance: userBal + reserved,
    reserved,
    available: userBal,
  };
}

export async function GET(request) {
  try {
    // create-anything蛛ｴ縺ｮ隱崎ｨｼ縺ｯ邯ｭ謖・ｼ・WT/OTP縺ｮ縺ｾ縺ｾ・・
    const user = await authenticateUser(request);

    // v2縺ｧ userId 繧定ｦ∵ｱゅ☆繧帰PI縺後≠繧句ｴ蜷医↓蛯吶∴縺ｦ貂｡縺帙ｋ繧医≧縺ｫ縺吶ｋ
    const userId = String(user.id);

    // v2谿矩ｫ連PI蛟呵｣懶ｼ・04縺ｪ繧画ｬ｡縺ｸ・・
    const candidates = [
      // 繧ゅ＠ v2 縺後瑚・蛻・・谿矩ｫ倥咲ｳｻ繧呈戟縺｣縺ｦ繧・
      `${V2_BASE}/me/balance`,
      `${V2_BASE}/user/balance`,
      `${V2_BASE}/wallet/balance`,
      // wallets 荳隕ｧ繧定ｿ斐☆邉ｻ
      `${V2_BASE}/me/wallets`,
      `${V2_BASE}/wallets/me`,
      // userId 繧ｯ繧ｨ繝ｪ縺ｧ蜿悶ｋ邉ｻ
      `${V2_BASE}/wallets/by-user?userId=${encodeURIComponent(userId)}`,
      `${V2_BASE}/dev/wallets/by-user?userId=${encodeURIComponent(userId)}`, // dev 縺励°辟｡縺・ｴ蜷医・騾・￡
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

    // v2縺九ｉ蜿悶ｌ縺ｪ縺・凾縺ｧ繧ゅゞI繧貞｣翫＆縺ｪ縺・◆繧√↓縲御ｻ翫・隱崎ｨｼ諠・ｱ縺ｮ谿矩ｫ倥阪ｒ霑斐＠縺ｦ縺翫￥・医◆縺縺怜ｰ・擂繧ｺ繝ｬ繧具ｼ・
    // 縺薙％縺ｯ 窶懈怙遏ｭ縺ｧ蜍輔°縺吩ｿ晞匱窶昴Ｗ2縺ｫ谿矩ｫ連PI縺檎畑諢上〒縺阪◆繧峨√％縺ｮ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ縺ｯ豸医＠縺ｦOK縲・
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


