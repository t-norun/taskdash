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

function normalizeOutcome(v2) {
  // v2の返却が何であれ、create-anything側が欲しそうな最小を作る
  // もし v2 が outcome を返すなら拾う
  const outcome = v2?.outcome ?? v2?.result?.outcome ?? v2?.match?.outcome;
  if (!outcome) return null;

  // 想定: WIN/LOSE/TIE/NO_PAIR など
  const o = String(outcome).toUpperCase();
  const result = o === "WIN" ? "win" : o === "LOSE" ? "lose" : o === "TIE" ? "tie" : "waiting";
  return { outcome: o, result };
}

export async function POST(request) {
  try {
    await authenticateUser(request);

    const { taskSetId, orderedNumbers, timeMs } = await request.json();

    // create-anythingの taskSetId = v2の attemptId として扱う（最短）
    const attemptId = taskSetId;

    if (!attemptId || !Array.isArray(orderedNumbers) || !Number.isFinite(Number(timeMs))) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ---- v2へ転送 ----
    // v2のsubmitがどんな形でも受けられるように、候補キーを複数送る（無視されても害なし）
    const body = {
      attemptId: String(attemptId),
      orderedNumbers,
      timeMs: Number(timeMs),

      // 互換候補（v2実装によりけり）
      numbers: orderedNumbers,
      elapsedMs: Number(timeMs),
      durationMs: Number(timeMs),
    };

    // まず「/attempts/{id}/submit」を試す（RESTっぽい形）
    let v2res = await fetch(`${V2_BASE}/attempts/${encodeURIComponent(String(attemptId))}/submit`, {
      method: "POST",
      headers: forwardHeaders(request),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    // もしルートが無いなら「/attempts/submit」も試す（あなたの実装差を吸収）
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

    // v2が即時に outcome を返す場合は拾って返す（即時マッチならUIが速くなる）
    const out = normalizeOutcome(data);

    // create-anything 互換：submissionId を返す
    // 最短では submissionId = attemptId で統一（check-match側も同様にする）
    if (out) {
      return Response.json({
        submissionId: String(attemptId),
        isCorrect: true, // v2側で判定するが、create-anythingのフロー的には「提出完了」でよい
        timeMs: Number(timeMs),
        status: out.outcome === "NO_PAIR" ? "waiting" : "matched",
        result: out.result,
        // payout/newBalance は check-match で取る方が安全（ここでは返さなくてOK）
      });
    }

    // まだ outcome が無いなら「待機」として返す（create-anythingは check-match を叩く想定）
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

