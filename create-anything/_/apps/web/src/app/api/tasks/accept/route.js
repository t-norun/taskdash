import sql from "../../utils/sql";
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

export async function POST(request) {
  try {
    const user = await authenticateUser(request);

    const { priceUsd } = await request.json();

    // ---- legacy側のガード（UI/導線を壊さない最小）----
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

    // 連打防止（必要なら維持。不要なら丸ごと削ってOK）
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

    // ---- v2へ転送：ゲーム開始は v2 core に任せる ----
    // create-anything の user.id を v2 の userId として使う（基本これが最短）
    const entryTxId = crypto.randomUUID();

    // v2が受け取れる可能性のある追加情報も送る（無視されても害はない）
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
      // v2のエラーをそのまま返す（デバッグしやすい）
      return Response.json(
        { error: data?.error || "Failed to accept job (v2)" , debug: data?.debug },
        { status: v2res.status || 500 },
      );
    }

    // v2の返却から numbers を拾う（型が多少違っても吸収）
    const attempt = data.attempt || data.data || data;
    const numbers = attempt?.numbers || attempt?.task?.numbers || data?.numbers;

    if (!numbers) {
      // numbers が無いとUIが詰むので、v2返却形が違う場合はここで気付けるようにする
      return Response.json(
        { error: "v2 response missing numbers", debug: data },
        { status: 502 },
      );
    }

    // create-anything 期待形に合わせて返す
    // taskSetId は legacyの task_sets.id 相当だが、ここでは attemptId を入れてUIを動かす（最短）
    return Response.json({
      success: true,
      taskSetId: attempt?.id || data?.attemptId || entryTxId,
      numbers,
      priceUsd: p,
      // もしフロントが attemptId を別で欲しそうなら、ここで明示的に出しておくと後が楽
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
