/**
 * apps/web/src/utils/runtimeData.ts
 * UIはこのファイル経由でのみデータ取得する
 */

import { authenticatedFetch } from "./auth";

/* =====================================================
   MODE
===================================================== */

const MODE_KEY = "taskdash_mode";
export type Mode = "demo" | "real";

export function getMode(): Mode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return m === "demo" ? "demo" : "real";
  } catch {
    return "real";
  }
}

export function setMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode === "demo" ? "demo" : "real");
  } catch {}
}

export function isDemoMode() {
  return getMode() === "demo";
}

/* =====================================================
   SAFE STORAGE
===================================================== */

function safeGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

function safeDel(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {}
}

/* =====================================================
   UUID (browser-safe)
===================================================== */

function makeUuid(): string {
  try {
    const anyCrypto: any = (globalThis as any).crypto;
    if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  } catch {}

  const bytes = new Uint8Array(16);

  // ★ TS/ブラウザ両対応：globalThis.crypto 経由で getRandomValues
  try {
    const anyCrypto: any = (globalThis as any).crypto;
    if (anyCrypto?.getRandomValues) anyCrypto.getRandomValues(bytes);
    else throw new Error("no getRandomValues");
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

/** payout用 requestId（ブラウザ安全版） */
function makeRequestId(): string {
  return makeUuid();
}

/* =====================================================
   ATTEMPT ID (Home -> Task)
===================================================== */

const ATTEMPT_ID_KEY = "taskdash_attemptId";

export function getAttemptIdStorage(): string | null {
  const v = safeGet(ATTEMPT_ID_KEY);
  const s = (v || "").trim();
  return s ? s : null;
}

export function setAttemptIdStorage(attemptId: string | null) {
  const s = String(attemptId || "").trim();
  if (!s) safeDel(ATTEMPT_ID_KEY);
  else safeSet(ATTEMPT_ID_KEY, s);
}

export function clearAttemptIdStorage() {
  safeDel(ATTEMPT_ID_KEY);
}

/** 互換（Taskページが import してる名前に合わせる） */
export function saveAttemptIdStorage(attemptId: any) {
  const s = String(attemptId || "").trim();
  if (!s) return;
  setAttemptIdStorage(s);
}
export function loadAttemptIdStorage(): string | null {
  return getAttemptIdStorage();
}

/* =====================================================
   DEMO BALANCE (CENTS)
   - demo_balance_cents を正とする
   - 旧 demo_balance (整数USD) があれば移行
===================================================== */

const DEMO_BAL_CENTS_KEY = "demo_balance_cents";
const DEMO_BAL_KEY_LEGACY = "demo_balance"; // legacy: integer USD

function getDemoBalanceCents(): number {
  const raw = safeGet(DEMO_BAL_CENTS_KEY);
  const n = Number(raw);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));

  // migrate legacy integer USD -> cents
  const legacy = safeGet(DEMO_BAL_KEY_LEGACY);
  const usd = Number(legacy);
  if (Number.isFinite(usd)) {
    const cents = Math.max(0, Math.floor(usd * 100));
    safeSet(DEMO_BAL_CENTS_KEY, String(cents));
    return cents;
  }

  // default $100.00
  return 10000;
}

function setDemoBalanceCents(cents: number) {
  const v = Math.max(0, Math.floor(Number(cents) || 0));
  safeSet(DEMO_BAL_CENTS_KEY, String(v));
}

function getDemoBalanceUsd(): number {
  return getDemoBalanceCents() / 100;
}

/** UIから呼ぶやつ（USDで指定OK・小数OK） */
export function setDemoBalance(usd: number) {
  const cents = Math.round((Number(usd) || 0) * 100);
  setDemoBalanceCents(cents);
}

/** UIから呼ぶやつ（USDで加算OK・小数OK） */
export function addDemoBalance(deltaUsd: number) {
  const deltaCents = Math.round((Number(deltaUsd) || 0) * 100);
  setDemoBalanceCents(getDemoBalanceCents() + deltaCents);
}

/* =====================================================
   DEMO CPU/PLATFORM BALANCE (CENTS)
   - “CPUも同額参加費を払う” を成立させるための内部勘定
===================================================== */

const DEMO_CPU_CENTS_KEY = "demo_cpu_balance_cents";
const DEMO_PLATFORM_CENTS_KEY = "demo_platform_balance_cents";

function getDemoCpuCents(): number {
  const raw = safeGet(DEMO_CPU_CENTS_KEY);
  const n = Number(raw);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));

  const init = 1_000_000_00; // $1,000,000.00
  safeSet(DEMO_CPU_CENTS_KEY, String(init));
  return init;
}
function setDemoCpuCents(cents: number) {
  safeSet(DEMO_CPU_CENTS_KEY, String(Math.max(0, Math.floor(Number(cents) || 0))));
}
function addDemoCpuCents(deltaCents: number) {
  setDemoCpuCents(getDemoCpuCents() + Math.floor(Number(deltaCents) || 0));
}

function getDemoPlatformCents(): number {
  const raw = safeGet(DEMO_PLATFORM_CENTS_KEY);
  const n = Number(raw);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  safeSet(DEMO_PLATFORM_CENTS_KEY, "0");
  return 0;
}
function addDemoPlatformCents(deltaCents: number) {
  const cur = getDemoPlatformCents();
  const next = Math.max(0, cur + Math.floor(Number(deltaCents) || 0));
  safeSet(DEMO_PLATFORM_CENTS_KEY, String(next));
}

/* =====================================================
   ADMIN: PLATFORM BALANCE
   - real: /api/admin/platform/balance
   - demo: local platform cents
===================================================== */

export type PlatformBalanceResult =
  | {
      ok: true;
      balanceCents: number;
      balanceUsd: string;
      [k: string]: any;
    }
  | { ok: false; error: string; status?: number; [k: string]: any };

function toNumberOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function floor0(v: any): number {
  const n = toNumberOrNull(v);
  if (n == null) return 0;
  return Math.max(0, Math.floor(n));
}

/**
 * ✅ 管理者だけ通るAPIを叩く
 * - 403/401 は「非管理者」の正常系（呼び出し側が isAdmin 判定で使う）
 * - 返却のキー名が多少違っても balanceCents/balanceUsd に正規化して返す
 */
export async function getPlatformBalance(): Promise<PlatformBalanceResult> {
  // demo: local
  if (isDemoMode()) {
    const cents = floor0(getDemoPlatformCents());
    return { ok: true, balanceCents: cents, balanceUsd: String(cents / 100) };
  }

  try {
    const r = await authenticatedFetch(`/api/admin/platform/balance`);

    if (!r.ok) {
      let msg = `HTTP_${r.status}`;
      try {
        const j = await r.json();
        if (j?.error) msg = String(j.error);
      } catch {}
      return { ok: false, error: msg, status: r.status };
    }

    const j = await r.json().catch(() => ({}));

    if (j?.ok === true) return j;

    return {
      ok: false,
      error: String(j?.error ?? "UNKNOWN_ERROR"),
      status: r.status,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "NETWORK_ERROR" };
  }
}

/* =====================================================
   DEMO STAKE MAP (attemptId -> stakeCents)
   - acceptJob(demo) で引いた stake を submitTask(demo) で参照
===================================================== */

const DEMO_STAKE_MAP_KEY = "taskdash_demo_stakes_v1";

function loadDemoStakeMap(): Record<string, number> {
  try {
    const raw = safeGet(DEMO_STAKE_MAP_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function saveDemoStakeMap(map: Record<string, number>) {
  try {
    safeSet(DEMO_STAKE_MAP_KEY, JSON.stringify(map || {}));
  } catch {}
}

function setDemoStakeCents(attemptId: string, stakeCents: number) {
  const aid = String(attemptId || "").trim();
  if (!aid) return;
  const m = loadDemoStakeMap();
  m[aid] = Math.max(0, Math.floor(Number(stakeCents) || 0));
  saveDemoStakeMap(m);
}

function popDemoStakeCents(attemptId: string): number {
  const aid = String(attemptId || "").trim();
  if (!aid) return 0;
  const m = loadDemoStakeMap();
  const v = Math.max(0, Math.floor(Number(m[aid]) || 0));
  delete m[aid];
  saveDemoStakeMap(m);
  return v;
}

/* =====================================================
   WAITING (local cache helper)
   - Taskページが import してる upsertWaiting を提供する
===================================================== */

// ★本番仕様：Waiting は24時間でタイムアウト返金
// realはサーバーが判定・返金する（ここはUI整形/デモ用）
const REFUND_AFTER_MS = 24 * 60 * 60 * 1000; // 24h

const WAITING_KEY = "taskdash_waiting";

export type WaitingItem = {
  submissionId: string;
  status?: string;
  statusCompat?: string;
  priceUsd?: number | null;

  // 既存
  updatedAt?: string | null;

  // ★追加（UI用）
  createdAt?: string | null;
  expiresAt?: string | null;
  remainingMs?: number | null;

  [k: string]: any;
};

function loadWaitingCache(): WaitingItem[] {
  try {
    const raw = safeGet(WAITING_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveWaitingCache(items: WaitingItem[]) {
  try {
    safeSet(WAITING_KEY, JSON.stringify(items || []));
  } catch {}
}

export function upsertWaiting(item: WaitingItem) {
  try {
    const it = item || ({} as any);
    const sid = String(it.submissionId || "").trim();
    if (!sid) return;

    const cur = loadWaitingCache();
    const next: WaitingItem[] = [];
    let done = false;

    const nowIso = new Date().toISOString();

    for (const x of cur) {
      if (String(x?.submissionId || "") === sid) {
        const createdAt =
          (it.createdAt as any) ?? (x?.createdAt as any) ?? (x?.updatedAt as any) ?? nowIso;

        const expiresAt =
          (it.expiresAt as any) ??
          (x?.expiresAt as any) ??
          new Date(Date.parse(createdAt) + REFUND_AFTER_MS).toISOString();

        next.push({
          ...x,
          ...it,
          submissionId: sid,
          updatedAt: nowIso,
          createdAt,
          expiresAt,
        });
        done = true;
      } else {
        next.push(x);
      }
    }

    if (!done) {
      const createdAt = (it.createdAt as any) ?? nowIso;
      const expiresAt =
        (it.expiresAt as any) ?? new Date(Date.parse(createdAt) + REFUND_AFTER_MS).toISOString();

      next.unshift({
        ...it,
        submissionId: sid,
        updatedAt: nowIso,
        createdAt,
        expiresAt,
      });
    }

    saveWaitingCache(next.slice(0, 50));
  } catch {}
}

function removeWaiting(submissionId: string) {
  const sid = String(submissionId || "").trim();
  if (!sid) return;
  const cur = loadWaitingCache();
  const next = cur.filter((x) => String(x?.submissionId || "") !== sid);
  saveWaitingCache(next);
}

/* =====================================================
   DEMO CPU MATCH (local “mini DB”)
   - submitTask() で CPU相手の結果を作って保存
   - checkMatch() で revealAt までは waiting、過ぎたら matched を返す
   - 経済ルール：固定配分テーブル（1.94固定, 運営3%）
===================================================== */

const DEMO_MATCH_KEY = "taskdash_demo_matches_v1";
const DEMO_CPU_LEVEL_KEY = "taskdash_demo_cpu_level"; // 0.0-1.0 (任意)

type DemoMatch = {
  submissionId: string;
  matchId: string;

  createdAt: string;
  revealAt: string;

  priceUsd: number;
  stakeCents: number;

  platformFeeCents: number;
  userPayoutCents: number;
  cpuPayoutCents: number;

  player: {
    id: "demo_user";
    score: number; // 小さいほど強い想定
    timeMs?: number | null;
  };
  cpu: {
    id: "cpu";
    name: string;
    score: number;
    timeMs?: number | null;
    level: number;
  };

  outcome: "win" | "lose" | "draw";
  deltaUsd: number; // ユーザーの純増減（payout - stake）
};

function clamp01(x: any) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0.6;
  return Math.max(0, Math.min(1, n));
}

export function getDemoCpuLevel(): number {
  const raw = safeGet(DEMO_CPU_LEVEL_KEY);
  return clamp01(raw ?? 0.6);
}

export function setDemoCpuLevel(level01: number) {
  safeSet(DEMO_CPU_LEVEL_KEY, String(clamp01(level01)));
}

function loadDemoMatches(): DemoMatch[] {
  try {
    const raw = safeGet(DEMO_MATCH_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as DemoMatch[]) : [];
  } catch {
    return [];
  }
}

function saveDemoMatches(items: DemoMatch[]) {
  try {
    safeSet(DEMO_MATCH_KEY, JSON.stringify(items || []));
  } catch {}
}

function upsertDemoMatch(m: DemoMatch) {
  const cur = loadDemoMatches();
  const next: DemoMatch[] = [];
  let done = false;

  for (const x of cur) {
    if (x?.submissionId === m.submissionId) {
      next.push(m);
      done = true;
    } else {
      next.push(x);
    }
  }
  if (!done) next.unshift(m);

  saveDemoMatches(next.slice(0, 100));
}

function getDemoMatchBySubmissionId(submissionId: string): DemoMatch | null {
  const sid = String(submissionId || "").trim();
  if (!sid) return null;
  const cur = loadDemoMatches();
  for (const x of cur) {
    if (x?.submissionId === sid) return x;
  }
  return null;
}

// 固定配分テーブル（本番と同ルール、合計常に 1.94x fee, 運営3%）
// demo スコアは「小さい=良い」スケール → HIGH_THRESHOLD以下が高成績
// - 両方 HIGH 以下        → 0.97 + 0.97
// - 片方のみ HIGH 以下    → 1.64 + 0.30
// - 両方 HIGH 以下 diff0-4 → 1.20 + 0.74
// - 両方 HIGH 以下 diff5-9 → 1.32 + 0.62
// - 両方 HIGH 以下 diff10+ → 1.44 + 0.50
const DEMO_HIGH_THRESHOLD = 50; // demo: score<=50（≒5秒以内）が本番70以上相当
function calcDemoPayouts(
  playerScore: number,
  cpuScore: number,
  outcome: "win" | "lose" | "draw",
  stakeCents: number
): { userPayoutCents: number; cpuPayoutCents: number; platformFeeCents: number } {
  const fee = Math.max(100, Math.trunc(Number(stakeCents) || 0));
  const totalPool = fee * 2;
  const platformFeeCents = Math.floor(totalPool * 0.03);

  const playerHigh = playerScore <= DEMO_HIGH_THRESHOLD;
  const cpuHigh = cpuScore <= DEMO_HIGH_THRESHOLD;
  const diff = Math.abs(playerScore - cpuScore);
  const isTie = outcome === "draw";

  let winnerRate: number;
  let loserRate: number;

  if (isTie || (!playerHigh && !cpuHigh)) {
    winnerRate = 0.97;
    loserRate = 0.97;
  } else if (playerHigh !== cpuHigh) {
    winnerRate = 1.64;
    loserRate = 0.30;
  } else if (diff <= 4) {
    winnerRate = 1.20;
    loserRate = 0.74;
  } else if (diff <= 9) {
    winnerRate = 1.32;
    loserRate = 0.62;
  } else {
    winnerRate = 1.44;
    loserRate = 0.50;
  }

  const payoutWinner = Math.floor(fee * winnerRate);
  const payoutLoser = Math.max(0, totalPool - platformFeeCents - payoutWinner);

  const userPayoutCents = outcome === "win" ? payoutWinner : outcome === "lose" ? payoutLoser : payoutWinner;
  const cpuPayoutCents  = outcome === "win" ? payoutLoser  : outcome === "lose" ? payoutWinner : payoutLoser;

  return { userPayoutCents, cpuPayoutCents, platformFeeCents };
}

// プレイヤー強さ推定
function inferPlayerScore(payload: any): { score: number; timeMs?: number | null } {
  const timeMs = Number(payload?.timeMs ?? payload?.elapsedMs ?? payload?.elapsed ?? null);
  const scoreRaw = payload?.score ?? payload?.resultScore ?? payload?.diffScore ?? null;

  if (scoreRaw != null) {
    const s = Number(scoreRaw);
    if (Number.isFinite(s)) {
      return {
        score: Math.max(1, Math.floor(s)),
        timeMs: Number.isFinite(timeMs) ? timeMs : null,
      };
    }
  }

  if (Number.isFinite(timeMs) && timeMs > 0) {
    const s = Math.max(1, Math.floor(timeMs / 100)); // 10秒=100
    return { score: s, timeMs };
  }

  return { score: 100, timeMs: null };
}

// CPUスコア生成（小さいほど強い）
function generateCpuScore(playerScore: number, cpuLevel01: number) {
  const baseSpread = 30 - Math.floor(cpuLevel01 * 18); // level高いほどブレ小
  const bias = Math.floor((cpuLevel01 - 0.5) * 20); // level高いほどCPUが少し強い

  const rand = Math.floor(Math.random() * (baseSpread * 2 + 1)) - baseSpread;
  const cpuScore = Math.max(1, Math.floor(playerScore + rand - bias));
  return cpuScore;
}

function decideOutcome(playerScore: number, cpuScore: number): "win" | "lose" | "draw" {
  if (playerScore < cpuScore) return "win";
  if (playerScore > cpuScore) return "lose";
  return "draw";
}

/* =====================================================
   AUTH GUARD (Task導線用)
===================================================== */

export type AssertRealAuthedResult = { ok: true } | { ok: false; error: string };

export async function assertRealAuthed(): Promise<AssertRealAuthedResult> {
  if (isDemoMode()) return { ok: true };

  try {
    const r = await authenticatedFetch("/api/user/me", { method: "GET" });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) return { ok: false, error: j?.error || `HTTP ${r.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/* =====================================================
   BALANCE
===================================================== */

export type BalanceResult =
  | { ok: true; availableUsd: number; reservedUsd: number }
  | { ok: false; error: string };

export async function getBalance(): Promise<BalanceResult> {
  if (isDemoMode()) {
    return {
      ok: true,
      availableUsd: getDemoBalanceUsd(),
      reservedUsd: 0,
    };
  }

  try {
    const r = await authenticatedFetch("/api/user/balance", { method: "GET" });
    const j: any = await r.json().catch(() => ({}));

    if (!r.ok || !j?.ok) {
      return { ok: false, error: j?.error || `HTTP ${r.status}` };
    }

    return {
      ok: true,
      availableUsd: Number(j.available ?? 0) / 100,
      reservedUsd: Number(j.reserved ?? 0) / 100,
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/* =====================================================
   WAITING (server)
===================================================== */

export async function listWaiting(limit = 20) {
  if (isDemoMode()) {
    // Demo: waitingキャッシュの “まだ reveal 前” ＋ “24h期限内” を返す
    const now = Date.now();
    const max = Math.max(1, Math.min(50, Number(limit) || 20));

    const items = loadWaitingCache()
      .map((x) => {
        // expiresAt が無い古いキャッシュは createdAt/updatedAt から補完
        const baseIso = (x?.createdAt as any) ?? (x?.updatedAt as any) ?? new Date().toISOString();

        const expiresAt =
          (x?.expiresAt as any) ?? new Date(Date.parse(baseIso) + REFUND_AFTER_MS).toISOString();

        const remainingMs = Math.max(0, Date.parse(expiresAt) - now);

        return {
          ...x,
          expiresAt,
          remainingMs,
        };
      })
      .filter((x) => {
        // 24h超えは waiting に残さない（demoでは返金済み扱い）
        const exp = Date.parse(String(x?.expiresAt || ""));
        if (Number.isFinite(exp) && now >= exp) return false;

        // CPU match の reveal 前だけ waiting
        const sid = String(x?.submissionId || "");
        const m = getDemoMatchBySubmissionId(sid);
        if (!m) return true;
        return now < Date.parse(m.revealAt);
      })
      .slice(0, max);

    return { ok: true, items };
  }

  const r = await authenticatedFetch(`/api/tasks/my-waiting?limit=${limit}`, {
    method: "GET",
  });

  return await r.json().catch(() => ({}));
}

/* =====================================================
   ACCEPT JOB
===================================================== */

export async function acceptJob(priceUsd: number) {
  const p = Math.max(1, Math.trunc(Number(priceUsd) || 1));
  const stakeCents = p * 100;

  if (isDemoMode()) {
    const bal = getDemoBalanceCents();
    if (bal < stakeCents) return { ok: false, error: "insufficient demo balance" };

    const attemptId = makeUuid();

    // ★参加費を払う（デモでも必須）
    setDemoBalanceCents(bal - stakeCents);

    // submitで決済に使う
    setDemoStakeCents(attemptId, stakeCents);

    setAttemptIdStorage(attemptId);

    return {
      ok: true,
      attemptId,
      stakeCents,
      priceUsd: p,
      status: "armed",
      statusCompat: "armed",
    };
  }

  const r = await authenticatedFetch("/api/tasks/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceUsd: p }),
  });

  const j: any = await r.json().catch(() => ({}));
  if (j?.ok && j?.attemptId) setAttemptIdStorage(String(j.attemptId));
  return j;
}

/* =====================================================
   CURRENT (Task boot)
===================================================== */

export type CurrentResult =
  | {
      ok: true;
      attemptId: string;
      status: string;
      startedAt?: string | null;
      expiresAt?: string | null;
      seed?: string | null;
      task?: any;
      hasTask?: boolean; // Taskページ互換（あると嬉しい）
    }
  | { ok: false; error: string };

export async function getCurrent(attemptId: string): Promise<CurrentResult> {
  const aid = String(attemptId || "").trim();
  if (!aid) return { ok: false, error: "missing attemptId" };

  if (isDemoMode()) {
    return {
      ok: true,
      attemptId: aid,
      status: "in_progress",
      startedAt: new Date().toISOString(),
      expiresAt: null,
      seed: "demo",
      task: null,
      hasTask: true,
    };
  }

  try {
    const r = await authenticatedFetch(`/api/tasks/current?attemptId=${encodeURIComponent(aid)}`, {
      method: "GET",
    });

    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) return { ok: false, error: j?.error || `HTTP ${r.status}` };
    return j as CurrentResult;
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/* =====================================================
   SUBMIT TASK
===================================================== */

export async function submitTask(payload: any) {
  if (isDemoMode()) {
    const submissionId = makeUuid();
    const matchId = makeUuid();

    const attemptId = String(payload?.attemptId || "").trim() || getAttemptIdStorage() || "demo";
    const priceUsd = Math.max(
      1,
      Math.trunc(Number(payload?.priceUsd ?? payload?.price ?? payload?.tier ?? 1) || 1)
    );

    // acceptで引いた stake を使う（無ければ price から）
    const stakeCents = popDemoStakeCents(attemptId) || priceUsd * 100;

    // Demo: waitingに載せる（UI用）
    // ※ expiresAt/createdAt は upsertWaiting 側が確実に埋める
    upsertWaiting({
      submissionId,
      attemptId,
      status: "submitted",
      statusCompat: "waiting",
      priceUsd,
    });

    // CPUも同額参加費を払う（内部勘定）
    setDemoCpuCents(getDemoCpuCents() - stakeCents);

    // 強さ推定＆CPU生成
    const player = inferPlayerScore(payload);
    const cpuLevel = getDemoCpuLevel();
    const cpuScore = generateCpuScore(player.score, cpuLevel);
    const outcome = decideOutcome(player.score, cpuScore);

    // 固定配分テーブルで payout を決定（本番と同ルール）
    const { userPayoutCents, cpuPayoutCents, platformFeeCents } =
      calcDemoPayouts(player.score, cpuScore, outcome, stakeCents);

    // “演出” 用に少し待たせる（0.7〜1.4秒）
    const now = Date.now();
    const delayMs = 700 + Math.floor(Math.random() * 700);
    const revealAt = new Date(now + delayMs).toISOString();

    // ★ユーザー残高：acceptで -stake 済みなので、ここでは payout を足すだけ
    setDemoBalanceCents(getDemoBalanceCents() + userPayoutCents);

    // CPU/Platform 内部勘定
    addDemoCpuCents(cpuPayoutCents);
    addDemoPlatformCents(platformFeeCents);

    const deltaUsd = (userPayoutCents - stakeCents) / 100;

    const m: DemoMatch = {
      submissionId,
      matchId,
      createdAt: new Date(now).toISOString(),
      revealAt,
      priceUsd,
      stakeCents,
      platformFeeCents,
      userPayoutCents,
      cpuPayoutCents,
      player: {
        id: "demo_user",
        score: player.score,
        timeMs: player.timeMs ?? null,
      },
      cpu: {
        id: "cpu",
        name: cpuLevel >= 0.8 ? "CPU (Hard)" : cpuLevel >= 0.55 ? "CPU (Normal)" : "CPU (Easy)",
        score: cpuScore,
        timeMs: null,
        level: cpuLevel,
      },
      outcome,
      deltaUsd,
    };

    upsertDemoMatch(m);

    // submit返却は waiting のままでOK（Task側はcheckMatchをpollする前提）
    return {
      ok: true,
      submissionId,
      status: "submitted",
      statusCompat: "waiting",
      matchId: null,
    };
  }

  const r = await authenticatedFetch("/api/tasks/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });

  return await r.json().catch(() => ({}));
}

/* =====================================================
   CHECK MATCH
===================================================== */

export async function checkMatch(submissionId: string) {
  const sid = String(submissionId || "").trim();
  if (!sid) return { ok: false, error: "missing submissionId" };

  if (isDemoMode()) {
    const m = getDemoMatchBySubmissionId(sid);
    if (!m) {
      return { ok: true, submissionId: sid, statusCompat: "waiting", matchId: null };
    }

    const now = Date.now();
    const reveal = Date.parse(m.revealAt);

    if (Number.isFinite(reveal) && now < reveal) {
      return { ok: true, submissionId: sid, statusCompat: "waiting", matchId: null };
    }

    removeWaiting(sid);

    return {
      ok: true,
      submissionId: sid,
      statusCompat: "matched",
      matchId: m.matchId,
      demoMatch: {
        matchId: m.matchId,
        priceUsd: m.priceUsd,
        stakeCents: m.stakeCents,
        platformFeeCents: m.platformFeeCents,
        userPayoutCents: m.userPayoutCents,
        outcome: m.outcome,
        deltaUsd: m.deltaUsd,
        player: m.player,
        cpu: m.cpu,
        createdAt: m.createdAt,
      },
    };
  }

  const r = await authenticatedFetch(
    `/api/tasks/check-match?submissionId=${encodeURIComponent(sid)}`,
    { method: "GET" }
  );

  return await r.json().catch(() => ({}));
}

/* =====================================================
   RECENT RESULTS
===================================================== */

export async function recentResults(limit = 5) {
  if (isDemoMode()) {
    const n = Math.max(1, Math.min(20, Number(limit) || 5));

    const results = loadDemoMatches()
      .filter((m) => Date.now() >= Date.parse(m.revealAt))
      .slice(0, n)
      .map((m) => ({
        ok: true,
        matchId: m.matchId,
        submissionId: m.submissionId,
        priceUsd: m.priceUsd,
        outcome: m.outcome,
        deltaUsd: m.deltaUsd,

        stakeCents: m.stakeCents,
        platformFeeCents: m.platformFeeCents,
        userPayoutCents: m.userPayoutCents,

        // NEW: my/opponent with display scores ("big = good") and timeMs
        // Internal score is "small = strong", so invert for display: 100 - internal
        my: {
          score: Math.max(0, 100 - m.player.score),
          timeMs: m.player.timeMs ?? null,
        },
        opponent: {
          score: Math.max(0, 100 - m.cpu.score),
          timeMs: m.cpu.timeMs ?? null, // CPU timeMs is null in demo; shows "—"
        },

        createdAt: m.createdAt,
      }));

    return { ok: true, results };
  }

  const r = await authenticatedFetch(`/api/tasks/recent-results?limit=${limit}`, {
    method: "GET",
  });

  return await r.json().catch(() => ({}));
}

/* =====================================================
   FORFEITED
===================================================== */

export async function listForfeited(limit = 20) {
  if (isDemoMode()) return { ok: true, items: [] as any[] };

  const r = await authenticatedFetch(`/api/tasks/my-forfeited?limit=${limit}`, {
    method: "GET",
  });

  return await r.json().catch(() => ({}));
}

/* =====================================================
   PAYPAL
===================================================== */

/**
 * create order（入金側）
 * UIの import が createPaypalOrder なので、その名前で提供する
 */
export async function createPaypalOrder(priceUsd: number) {
  if (isDemoMode()) return { ok: false, error: "paypal disabled in demo" };

  const amtUsd = Number(priceUsd);
  if (!Number.isFinite(amtUsd) || amtUsd <= 0) {
    return { ok: false, error: "invalid priceUsd" };
  }

  // 念のため（小数/誤差対策）
  const normalizedUsd = Math.round(amtUsd * 100) / 100;

  const r = await authenticatedFetch("/api/paypal/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceUsd: normalizedUsd }),
  });

  return await r.json().catch(() => ({}));
}

export async function adminPaypalPayout(amountCents: number, paypalEmail: string) {
  if (isDemoMode()) return { ok: false, error: "payout disabled in demo" };

  const r = await authenticatedFetch("/api/admin/paypal/payout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountCents, paypalEmail }),
  });

  return await r.json().catch(() => ({}));
}

/**
 * payout（出金側）
 */
export async function paypalPayout(amountUsd: number, paypalEmail: string) {
  if (isDemoMode()) return { ok: false, error: "payout disabled in demo" };

  const amtUsd = Number(amountUsd);
  if (!Number.isFinite(amtUsd) || amtUsd <= 0) {
    return { ok: false, error: "invalid amountUsd" };
  }

  // USD -> cents（浮動小数誤差対策で round）
  const amountCents = Math.round(amtUsd * 100);

  // 念のため（NaN/0防止）
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "invalid amountCents" };
  }

  // requestId（ブラウザ安全）
  const requestId = makeRequestId();

  const r = await authenticatedFetch("/api/paypal/payout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountCents, paypalEmail, requestId }),
  });

  return await r.json().catch(() => ({}));
}