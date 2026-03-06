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

function normalizeLedgerRows(data) {
  // v2の返却を配列に揃える（{rows:[...]}, {ledgers:[...]}, 直配列 など吸収）
  const rows =
    (Array.isArray(data?.rows) && data.rows) ||
    (Array.isArray(data?.ledgers) && data.ledgers) ||
    (Array.isArray(data?.items) && data.items) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data) ||
    null;

  if (!rows) return [];

  return rows.map((r) => ({
    id: String(r.id ?? r.ledgerId ?? r.txId ?? crypto.randomUUID()),
    type: String(r.type ?? r.ledgerType ?? r.kind ?? "UNKNOWN"),
    amount:
      num(r.amount) ??
      num(r.walletDelta) ??
      num(r.delta) ??
      0,
    note: String(r.note ?? r.memo ?? r.description ?? ""),
    createdAt: r.createdAt ?? r.created_at ?? r.timestamp ?? new Date().toISOString(),
  }));
}

function normalizeAttempts(data) {
  // attempts/list がある場合の吸収
  const rows =
    (Array.isArray(data?.attempts) && data.attempts) ||
    (Array.isArray(data?.items) && data.items) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data) ||
    null;

  if (!rows) return [];

  return rows.slice(0, 10).map((a) => {
    const outcome = String(a.outcome ?? a.result ?? "").toLowerCase();
    const matched =
      outcome === "win" || outcome === "lose" || outcome === "tie" || outcome === "no_pair";
    return {
      id: String(a.id ?? a.attemptId ?? crypto.randomUUID()),
      timeMs: num(a.timeMs ?? a.elapsedMs ?? a.durationMs) ?? null,
      isCorrect: a.isCorrect ?? a.correct ?? true, // v2側で正誤判定してる前提なので true に倒す
      matched,
      result: outcome || null,
      createdAt: a.createdAt ?? a.created_at ?? a.startedAt ?? new Date().toISOString(),
    };
  });
}

export async function GET(request) {
  try {
    const user = await authenticateUser(request);
    const userId = String(user.id);

    // 1) transactions = v2 ledger から
    const ledgerCandidates = [
      // それっぽい候補を順に試す
      `${V2_BASE}/me/ledger?limit=20`,
      `${V2_BASE}/ledger/me?limit=20`,
      `${V2_BASE}/ledger?userId=${encodeURIComponent(userId)}&limit=20`,
      `${V2_BASE}/dev/ledger/by-user?userId=${encodeURIComponent(userId)}&limit=20`, // devしか無い場合の逃げ
    ];

    let ledgerData = null;
    let lastLedgerNon404 = null;

    for (const url of ledgerCandidates) {
      const res = await fetch(url, {
        method: "GET",
        headers: forwardHeaders(request),
        cache: "no-store",
      });
      if (res.status === 404) continue;

      const data = await res.json().catch(() => ({}));
      lastLedgerNon404 = { url, status: res.status, data };

      if (!res.ok || data?.ok === false) break;

      ledgerData = data;
      break;
    }

    const transactions = ledgerData ? normalizeLedgerRows(ledgerData).slice(0, 20) : [];

    // 2) submissions = v2 attempts/list があれば作る（無ければ [] でOK）
    const attemptsCandidates = [
      `${V2_BASE}/me/attempts?limit=10`,
      `${V2_BASE}/attempts/me?limit=10`,
      `${V2_BASE}/attempts?userId=${encodeURIComponent(userId)}&limit=10`,
      `${V2_BASE}/dev/attempts/by-user?userId=${encodeURIComponent(userId)}&limit=10`,
    ];

    let attemptsData = null;
    for (const url of attemptsCandidates) {
      const res = await fetch(url, {
        method: "GET",
        headers: forwardHeaders(request),
        cache: "no-store",
      });
      if (res.status === 404) continue;

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) break;

      attemptsData = data;
      break;
    }

    const submissions = attemptsData ? normalizeAttempts(attemptsData) : [];

    return Response.json({
      submissions,
      transactions,
      debug: {
        // デバッグが要らなくなったら消してOK
        v2LedgerOk: Boolean(ledgerData),
        v2AttemptsOk: Boolean(attemptsData),
        lastLedgerNon404,
      },
    });
  } catch (error) {
    console.error("Get history error:", error);
    return Response.json(
      { error: error?.message || "Unauthorized" },
      { status: 401 },
    );
  }
}
