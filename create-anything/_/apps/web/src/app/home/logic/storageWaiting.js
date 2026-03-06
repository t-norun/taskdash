// apps/web/src/app/home/logic/storageWaiting.js

export const WAITING_KEY = "taskdash_waiting";

export function toNumOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeWaitingItem(x) {
  if (!x) return null;

  if (typeof x === "string") {
    return {
      submissionId: x,
      savedAt: Date.now(),
      status: "WAITING",
      priceUsd: null,
      stakeCents: null,
      expiresAt: null,
      remainingMs: null,
      attemptId: null,
    };
  }

  if (typeof x === "object") {
    const sid = x.submissionId || x.attemptId || x.id || null;
    if (!sid) return null;

    const savedAt = Number.isFinite(Number(x.savedAt))
      ? Number(x.savedAt)
      : x.createdAt
      ? new Date(x.createdAt).getTime()
      : Date.now();

    const stakeCents =
      toNumOrNull(x.stakeCents) ??
      toNumOrNull(x.stake) ??
      (toNumOrNull(x.priceUsd) != null ? Math.round(Number(x.priceUsd) * 100) : null) ??
      (toNumOrNull(x.price) != null ? Math.round(Number(x.price) * 100) : null) ??
      null;

    const priceUsd =
      toNumOrNull(x.priceUsd) ??
      toNumOrNull(x.price) ??
      (stakeCents != null ? stakeCents / 100 : null);

    const expiresAt = x.expiresAt ?? null;
    const remainingMs = toNumOrNull(x.remainingMs);

    return {
      submissionId: String(sid),
      attemptId: x.attemptId != null ? String(x.attemptId) : null,
      priceUsd,
      stakeCents,
      savedAt,
      status: x.status ?? "WAITING",
      expiresAt,
      remainingMs,
    };
  }

  return null;
}

export function dedupeWaitingList(list) {
  const map = new Map();
  for (const it of list || []) {
    const n = normalizeWaitingItem(it);
    if (!n || !n.submissionId) continue;
    const prev = map.get(n.submissionId);
    if (!prev || (Number(n.savedAt) || 0) >= (Number(prev.savedAt) || 0)) {
      map.set(n.submissionId, n);
    }
  }
  return Array.from(map.values()).sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
}

export function readWaitingList() {
  try {
    const raw = localStorage.getItem(WAITING_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);

    if (Array.isArray(v)) return dedupeWaitingList(v);
    if (v && typeof v === "object") return dedupeWaitingList([v]);
    if (typeof v === "string") return dedupeWaitingList([v]);

    return [];
  } catch {
    return [];
  }
}

export function writeWaitingList(list) {
  try {
    const safe = dedupeWaitingList(Array.isArray(list) ? list : []);
    localStorage.setItem(WAITING_KEY, JSON.stringify(safe));
  } catch {}
}