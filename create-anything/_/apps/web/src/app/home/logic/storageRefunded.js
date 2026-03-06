// apps/web/src/app/home/logic/storageRefunded.js

export const REFUNDED_KEY = "taskdash_refunded";

function toNumOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeRefundedItem(x) {
  if (!x) return null;

  if (typeof x === "string") {
    return {
      submissionId: x,
      attemptId: x,
      savedAt: Date.now(),
      createdAt: null,
      priceUsd: null,
      stakeCents: null,
      reason: "no match in time",
      status: "REFUNDED",
    };
  }

  if (typeof x === "object") {
    const sid = x.submissionId || x.attemptId || x.id || null;
    if (!sid) return null;

    const savedAt = Number.isFinite(Number(x.savedAt)) ? Number(x.savedAt) : Date.now();

    const stakeCents =
      toNumOrNull(x.stakeCents) ??
      toNumOrNull(x.stake) ??
      (toNumOrNull(x.priceUsd) != null ? Math.round(Number(x.priceUsd) * 100) : null) ??
      (toNumOrNull(x.price) != null ? Math.round(Number(x.price) * 100) : null) ??
      null;

    const priceUsd = toNumOrNull(x.priceUsd) ?? (stakeCents != null ? stakeCents / 100 : null);

    return {
      submissionId: String(sid),
      attemptId: x.attemptId != null ? String(x.attemptId) : String(sid),
      createdAt: x.createdAt ?? x.submittedAt ?? null,
      savedAt,
      priceUsd,
      stakeCents,
      reason: String(x.reason || "no match in time"),
      status: "REFUNDED",
    };
  }

  return null;
}

export function dedupeRefundedList(list) {
  const map = new Map();
  for (const it of list || []) {
    const n = normalizeRefundedItem(it);
    if (!n || !n.submissionId) continue;
    const prev = map.get(n.submissionId);
    if (!prev || (Number(n.savedAt) || 0) >= (Number(prev.savedAt) || 0)) {
      map.set(n.submissionId, n);
    }
  }
  return Array.from(map.values()).sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
}

export function readRefundedList() {
  try {
    const raw = localStorage.getItem(REFUNDED_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);

    if (Array.isArray(v)) return dedupeRefundedList(v);
    if (v && typeof v === "object") return dedupeRefundedList([v]);
    if (typeof v === "string") return dedupeRefundedList([v]);

    return [];
  } catch {
    return [];
  }
}

export function writeRefundedList(list) {
  try {
    const safe = dedupeRefundedList(Array.isArray(list) ? list : []);
    localStorage.setItem(REFUNDED_KEY, JSON.stringify(safe));
  } catch {}
}