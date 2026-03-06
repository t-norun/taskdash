import sql from "../../utils/sql";
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

export async function POST(request) {
  try {
    const user = await authenticateUser(request);

    const { priceUsd } = await request.json();

    // ---- legacy蛛ｴ縺ｮ繧ｬ繝ｼ繝会ｼ・I/蟆守ｷ壹ｒ螢翫＆縺ｪ縺・怙蟆擾ｼ・---
    const p = Number(priceUsd);
    if (!Number.isFinite(p) || p < 1 || p > 100) {
      return Response.json({ error: "Invalid price" }, { status: 400 });
    }

    const balance = Number(user.balance);
    const userLevel = Number(user.level);

    if (Number.isFinite(userLevel) && p > userLevel) {
      return Response.json(
        { error: `You can only select prices up to $${userLevel}. Current level: ${userLevel}` },
        { status: 403 },
      );
    }

    if (Number.isFinite(balance) && balance < p) {
      return Response.json(
        { error: `Insufficient balance. You need at least $${p.toFixed(2)} to accept this job.` },
        { status: 400 },
      );
    }

    // 騾｣謇馴亟豁｢・亥ｿ・ｦ√↑繧臥ｶｭ謖√ゆｸ崎ｦ√↑繧我ｸｸ縺斐→蜑翫▲縺ｦOK・・
    const recentSubmission = await sql`
      SELECT * FROM submissions
      WHERE user_id = ${user.id}
      AND created_at > NOW() - INTERVAL '30 seconds'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (recentSubmission.length > 0) {
      return Response.json(
        { error: "Please wait before accepting another job" },
        { status: 429 },
      );
    }

    // ---- v2縺ｸ霆｢騾・ｼ壹ご繝ｼ繝髢句ｧ九・ v2 core 縺ｫ莉ｻ縺帙ｋ ----
    // create-anything 縺ｮ user.id 繧・v2 縺ｮ userId 縺ｨ縺励※菴ｿ縺・ｼ亥渕譛ｬ縺薙ｌ縺梧怙遏ｭ・・
    const entryTxId = crypto.randomUUID();

    // v2縺悟女縺大叙繧後ｋ蜿ｯ閭ｽ諤ｧ縺ｮ縺ゅｋ霑ｽ蜉諠・ｱ繧る√ｋ・育┌隕悶＆繧後※繧ょｮｳ縺ｯ縺ｪ縺・ｼ・
    const body = {
      userId: String(user.id),
      entryTxId,
      priceUsd: p,
      entryFeeCents: Math.round(p * 100),
    };

    const v2res = await fetch(`${V2_BASE}/attempts/start`, {
      method: "POST",
      headers: forwardHeaders(request),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await v2res.json().catch(() => ({}));

    if (!v2res.ok || data?.ok === false) {
      // v2縺ｮ繧ｨ繝ｩ繝ｼ繧偵◎縺ｮ縺ｾ縺ｾ霑斐☆・医ョ繝舌ャ繧ｰ縺励ｄ縺吶＞・・
      return Response.json(
        { error: data?.error || "Failed to accept job (v2)" , debug: data?.debug },
        { status: v2res.status || 500 },
      );
    }

    // v2縺ｮ霑泌唆縺九ｉ numbers 繧呈鏡縺・ｼ亥梛縺悟､壼ｰ鷹＆縺｣縺ｦ繧ょ精蜿趣ｼ・
    const attempt = data.attempt || data.data || data;
    const numbers = attempt?.numbers || attempt?.task?.numbers || data?.numbers;

    if (!numbers) {
      // numbers 縺檎┌縺・→UI縺瑚ｩｰ繧縺ｮ縺ｧ縲」2霑泌唆蠖｢縺碁＆縺・ｴ蜷医・縺薙％縺ｧ豌嶺ｻ倥￠繧九ｈ縺・↓縺吶ｋ
      return Response.json(
        { error: "v2 response missing numbers", debug: data },
        { status: 502 },
      );
    }

    // create-anything 譛溷ｾ・ｽ｢縺ｫ蜷医ｏ縺帙※霑斐☆
    // taskSetId 縺ｯ legacy縺ｮ task_sets.id 逶ｸ蠖薙□縺後√％縺薙〒縺ｯ attemptId 繧貞・繧後※UI繧貞虚縺九☆・域怙遏ｭ・・
    return Response.json({
      success: true,
      taskSetId: attempt?.id || data?.attemptId || entryTxId,
      numbers,
      priceUsd: p,
      // 繧ゅ＠繝輔Ο繝ｳ繝医′ attemptId 繧貞挨縺ｧ谺ｲ縺励◎縺・↑繧峨√％縺薙〒譏守､ｺ逧・↓蜃ｺ縺励※縺翫￥縺ｨ蠕後′讌ｽ
      attemptId: attempt?.id || data?.attemptId,
    });
  } catch (error) {
    console.error("Accept task error:", error);
    return Response.json(
      { error: error?.message || "Failed to accept job" },
      { status: error?.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}

