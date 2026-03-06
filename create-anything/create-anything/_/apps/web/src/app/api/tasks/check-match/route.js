import sql from "../../utils/sql";

const V2_BASE =
  process.env.V2_API_BASE_URL ||
  process.env.NEXT_PUBLIC_V2_API_BASE_URL ||
  "https://api.taskdash.net";

function forwardHeaders(request) {
  const h = new Headers();

  // legacy蛛ｴ縺ｮBearer縺ｯ縲後そ繝・す繝ｧ繝ｳ遒ｺ隱阪阪〒菴ｿ縺・Ｗ2縺ｫ貂｡縺吶°縺ｯ迥ｶ豕∵ｬ｡隨ｬ縺縺後∵ｸ｡縺励※螳ｳ縺ｯ縺ｪ縺・
  const auth = request.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  const cookie = request.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);

  const devKey = request.headers.get("x-dev-key");
  if (devKey) h.set("x-dev-key", devKey);

  return h;
}

function toNumberOrNull(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// v2縺ｮoutcome繧・create-anything 譛溷ｾ・ｽ｢縺ｫ蟇・○繧・
function normalizeV2Outcome(data) {
  // 縺ゅｊ縺後■縺ｪ蠖｢繧貞・驛ｨ蜷ｸ蜿弱☆繧・
  const o = data?.outcome ?? data?.result?.outcome ?? data?.data?.outcome ?? data?.match?.outcome;
  const outcome = o ? String(o).toUpperCase() : null;

  const yourTime =
    toNumberOrNull(data?.yourTime) ??
    toNumberOrNull(data?.attempt?.elapsedMs) ??
    toNumberOrNull(data?.attempt?.timeMs) ??
    toNumberOrNull(data?.elapsedMs) ??
    toNumberOrNull(data?.timeMs);

  const opponentTime =
    toNumberOrNull(data?.opponentTime) ??
    toNumberOrNull(data?.opponent?.elapsedMs) ??
    toNumberOrNull(data?.opponent?.timeMs);

  const payout =
    toNumberOrNull(data?.payout) ??
    toNumberOrNull(data?.payoutDelta) ??
    toNumberOrNull(data?.delta) ??
    toNumberOrNull(data?.result?.payout);

  const newBalance =
    toNumberOrNull(data?.newBalance) ??
    toNumberOrNull(data?.balanceAfter) ??
    toNumberOrNull(data?.wallet?.balance) ??
    toNumberOrNull(data?.userWallet?.balance);

  return { outcome, yourTime, opponentTime, payout, newBalance };
}

export async function GET(request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    const url = new URL(request.url);
    const submissionId = url.searchParams.get("submissionId");

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!submissionId) {
      return Response.json({ error: "Missing submission ID" }, { status: 400 });
    }

    // 1) legacy繧ｻ繝・す繝ｧ繝ｳ遒ｺ隱搾ｼ・reate-anything縺ｮ蜑肴署邯ｭ謖・ｼ・
    const session = await sql`
      SELECT user_id FROM sessions
      WHERE token = ${token} AND expires_at > NOW()
    `;
    if (session.length === 0) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }

    // 2) v2縺ｸ・嘖ubmissionId = attemptId 縺ｨ縺励※ outcome 繧貞撫縺・粋繧上○繧・
    const attemptId = String(submissionId);

    // 縺ｾ縺・REST 縺｣縺ｽ縺・/attempts/:id/outcome 繧定ｩｦ縺・
    let v2res = await fetch(
      `${V2_BASE}/attempts/${encodeURIComponent(attemptId)}/outcome`,
      { method: "GET", headers: forwardHeaders(request), cache: "no-store" },
    );

    // 辟｡縺代ｌ縺ｰ /attempts/outcome?attemptId= 繧定ｩｦ縺・
    if (v2res.status === 404) {
      v2res = await fetch(
        `${V2_BASE}/attempts/outcome?attemptId=${encodeURIComponent(attemptId)}`,
        { method: "GET", headers: forwardHeaders(request), cache: "no-store" },
      );
    }

    const data = await v2res.json().catch(() => ({}));
    if (!v2res.ok || data?.ok === false) {
      return Response.json(
        { error: data?.error || "Failed to check match status (v2)", debug: data?.debug || data },
        { status: v2res.status || 500 },
      );
    }

    const n = normalizeV2Outcome(data);

    // 3) create-anything 譛溷ｾ・ｽ｢縺ｫ謨ｴ蠖｢
    // outcome縺悟叙繧後↑縺・or 縺ｾ縺譛ｪ豎ｺ縺ｪ繧・waiting 謇ｱ縺・↓蛟偵☆
    const outcome = n.outcome;

    if (!outcome || outcome === "PENDING" || outcome === "WAITING") {
      return Response.json({
        status: "waiting",
        message: "Still waiting for opponent...",
        // waitingTime 縺ｯ v2縺梧戟縺｣縺ｦ縺ｪ縺・％縺ｨ縺悟､壹＞縺ｮ縺ｧ蜃ｺ縺輔↑縺・ｼ亥ｿ・ｦ√↑繧益2蛛ｴ縺ｧ蜃ｺ縺呻ｼ・
      });
    }

    if (outcome === "NO_PAIR" || outcome === "NO_OPPONENT") {
      // create-anything縺ｮ譌｢蟄倅ｻ墓ｧ倥↓蜷医ｏ縺帙※ timeout 繧定ｿ斐☆縺ｮ縺御ｸ逡ｪ辟｡髮｣
      // ・亥ｮ滄圀縺ｫ縺ｯ v2蛛ｴ縺ｧ refund 貂医∩縲√→縺・≧諢丞袖・・
      return Response.json({
        status: "timeout",
        message: "Match timeout - refund processed",
      });
    }

    // WIN/LOSE/TIE 繧・result 縺ｫ螟画鋤
    const result =
      outcome === "WIN" ? "win" : outcome === "LOSE" ? "lose" : outcome === "TIE" ? "tie" : "tie";

    // payout/newBalance 縺・v2 縺九ｉ蜿悶ｌ縺ｪ縺・ｴ蜷医ｂ縺ゅｋ縺ｮ縺ｧ null 險ｱ螳ｹ縺ｧ霑斐☆・・I縺瑚舌∴縺ｪ縺・↑繧・v2蛛ｴ縺ｧ蠢・★蜃ｺ縺呻ｼ・
    return Response.json({
      status: "matched",
      result,
      payout: n.payout ?? null,
      opponentTime: n.opponentTime ?? null,
      yourTime: n.yourTime ?? null,
      newBalance: n.newBalance ?? null,
    });
  } catch (error) {
    console.error("Check match error:", error);
    return Response.json(
      { error: "Failed to check match status" },
      { status: 500 },
    );
  }
}

