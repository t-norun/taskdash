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

function normalizeOutcome(v2) {
  // v2縺ｮ霑泌唆縺御ｽ輔〒縺ゅｌ縲…reate-anything蛛ｴ縺梧ｬｲ縺励◎縺・↑譛蟆上ｒ菴懊ｋ
  // 繧ゅ＠ v2 縺・outcome 繧定ｿ斐☆縺ｪ繧画鏡縺・
  const outcome = v2?.outcome ?? v2?.result?.outcome ?? v2?.match?.outcome;
  if (!outcome) return null;

  // 諠ｳ螳・ WIN/LOSE/TIE/NO_PAIR 縺ｪ縺ｩ
  const o = String(outcome).toUpperCase();
  const result = o === "WIN" ? "win" : o === "LOSE" ? "lose" : o === "TIE" ? "tie" : "waiting";
  return { outcome: o, result };
}

export async function POST(request) {
  try {
    await authenticateUser(request);

    const { taskSetId, orderedNumbers, timeMs } = await request.json();

    // create-anything縺ｮ taskSetId = v2縺ｮ attemptId 縺ｨ縺励※謇ｱ縺・ｼ域怙遏ｭ・・
    const attemptId = taskSetId;

    if (!attemptId || !Array.isArray(orderedNumbers) || !Number.isFinite(Number(timeMs))) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ---- v2縺ｸ霆｢騾・----
    // v2縺ｮsubmit縺後←繧薙↑蠖｢縺ｧ繧ょ女縺代ｉ繧後ｋ繧医≧縺ｫ縲∝呵｣懊く繝ｼ繧定､・焚騾√ｋ・育┌隕悶＆繧後※繧ょｮｳ縺ｪ縺暦ｼ・
    const body = {
      attemptId: String(attemptId),
      orderedNumbers,
      timeMs: Number(timeMs),

      // 莠呈鋤蛟呵｣懶ｼ・2螳溯｣・↓繧医ｊ縺代ｊ・・
      numbers: orderedNumbers,
      elapsedMs: Number(timeMs),
      durationMs: Number(timeMs),
    };

    // 縺ｾ縺壹・attempts/{id}/submit縲阪ｒ隧ｦ縺呻ｼ・EST縺｣縺ｽ縺・ｽ｢・・
    let v2res = await fetch(`${V2_BASE}/attempts/${encodeURIComponent(String(attemptId))}/submit`, {
      method: "POST",
      headers: forwardHeaders(request),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    // 繧ゅ＠繝ｫ繝ｼ繝医′辟｡縺・↑繧峨・attempts/submit縲阪ｂ隧ｦ縺呻ｼ医≠縺ｪ縺溘・螳溯｣・ｷｮ繧貞精蜿趣ｼ・
    if (v2res.status === 404) {
      v2res = await fetch(`${V2_BASE}/attempts/submit`, {
        method: "POST",
        headers: forwardHeaders(request),
        body: JSON.stringify(body),
        cache: "no-store",
      });
    }

    const data = await v2res.json().catch(() => ({}));

    if (!v2res.ok || data?.ok === false) {
      return Response.json(
        { error: data?.error || "Failed to submit (v2)", debug: data?.debug || data },
        { status: v2res.status || 500 },
      );
    }

    // v2縺悟叉譎ゅ↓ outcome 繧定ｿ斐☆蝣ｴ蜷医・諡ｾ縺｣縺ｦ霑斐☆・亥叉譎ゅ・繝・メ縺ｪ繧蔚I縺碁溘￥縺ｪ繧具ｼ・
    const out = normalizeOutcome(data);

    // create-anything 莠呈鋤・嘖ubmissionId 繧定ｿ斐☆
    // 譛遏ｭ縺ｧ縺ｯ submissionId = attemptId 縺ｧ邨ｱ荳・・heck-match蛛ｴ繧ょ酔讒倥↓縺吶ｋ・・
    if (out) {
      return Response.json({
        submissionId: String(attemptId),
        isCorrect: true, // v2蛛ｴ縺ｧ蛻､螳壹☆繧九′縲…reate-anything縺ｮ繝輔Ο繝ｼ逧・↓縺ｯ縲梧署蜃ｺ螳御ｺ・阪〒繧医＞
        timeMs: Number(timeMs),
        status: out.outcome === "NO_PAIR" ? "waiting" : "matched",
        result: out.result,
        // payout/newBalance 縺ｯ check-match 縺ｧ蜿悶ｋ譁ｹ縺悟ｮ牙・・医％縺薙〒縺ｯ霑斐＆縺ｪ縺上※OK・・
      });
    }

    // 縺ｾ縺 outcome 縺檎┌縺・↑繧峨悟ｾ・ｩ溘阪→縺励※霑斐☆・・reate-anything縺ｯ check-match 繧貞娼縺乗Φ螳夲ｼ・
    return Response.json({
      submissionId: String(attemptId),
      isCorrect: true,
      timeMs: Number(timeMs),
      status: "waiting",
      message: "Submitted. Waiting for opponent...",
    });
  } catch (error) {
    console.error("Submit task error:", error);
    return Response.json(
      { error: error?.message || "Failed to submit task" },
      { status: error?.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}


