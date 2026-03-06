import sql from "../../utils/sql";

const V2_BASE =
  process.env.V2_API_BASE_URL ||
  process.env.NEXT_PUBLIC_V2_API_BASE_URL ||
  "http://localhost:3000";

function forwardHeaders(request) {
  const h = new Headers();

  // legacy側のBearerは「セッション確認」で使う。v2に渡すかは状況次第だが、渡して害はない
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

// v2のoutcomeを create-anything 期待形に寄せる
function normalizeV2Outcome(data) {
  // ありがちな形を全部吸収する
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

    // 1) legacyセッション確認（create-anythingの前提維持）
    const session = await sql`
      SELECT user_id FROM sessions
      WHERE token = ${token} AND expires_at > NOW()
    `;
    if (session.length === 0) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }

    // 2) v2へ：submissionId = attemptId として outcome を問い合わせる
    const attemptId = String(submissionId);

    // まず REST っぽい /attempts/:id/outcome を試す
    let v2res = await fetch(
      `${V2_BASE}/attempts/${encodeURIComponent(attemptId)}/outcome`,
      { method: "GET", headers: forwardHeaders(request), cache: "no-store" },
    );

    // 無ければ /attempts/outcome?attemptId= を試す
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

    // 3) create-anything 期待形に整形
    // outcomeが取れない or まだ未決なら waiting 扱いに倒す
    const outcome = n.outcome;

    if (!outcome || outcome === "PENDING" || outcome === "WAITING") {
      return Response.json({
        status: "waiting",
        message: "Still waiting for opponent...",
        // waitingTime は v2が持ってないことが多いので出さない（必要ならv2側で出す）
      });
    }

    if (outcome === "NO_PAIR" || outcome === "NO_OPPONENT") {
      // create-anythingの既存仕様に合わせて timeout を返すのが一番無難
      // （実際には v2側で refund 済み、という意味）
      return Response.json({
        status: "timeout",
        message: "Match timeout - refund processed",
      });
    }

    // WIN/LOSE/TIE を result に変換
    const result =
      outcome === "WIN" ? "win" : outcome === "LOSE" ? "lose" : outcome === "TIE" ? "tie" : "tie";

    // payout/newBalance が v2 から取れない場合もあるので null 許容で返す（UIが耐えないなら v2側で必ず出す）
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
