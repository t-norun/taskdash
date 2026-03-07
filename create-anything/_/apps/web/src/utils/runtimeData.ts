/**
 * apps/web/src/utils/runtimeData.ts
 * UIはこ�Eファイル経由でのみチE�Eタ取得すめE
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

  // ☁ETS/ブラウザ両対応：globalThis.crypto 経由で getRandomValues
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

/** payout用 requestId�E�ブラウザ安�E版！E*/
function makeRequestId(): string {
  try {
    const anyCrypto: any = (globalThis as any).crypto;
    if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
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

/** 互換�E�Easkペ�EジぁEimport してる名前に合わせる�E�E*/
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
   - 旧 demo_balance (整数USD) があれ�E移衁E
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

/** UIから呼ぶめE���E�ESDで持E��OK・小数OK�E�E*/
export function setDemoBalance(usd: number) {
  const cents = Math.round((Number(usd) || 0) * 100);
  setDemoBalanceCents(cents);
}

/** UIから呼ぶめE���E�ESDで加算OK・小数OK�E�E*/
export function addDemoBalance(deltaUsd: number) {
  const deltaCents = Math.round((Number(deltaUsd) || 0) * 100);
  setDemoBalanceCents(getDemoBalanceCents() + deltaCents);
}

/* =====================================================
   DEMO CPU/PLATFORM BALANCE (CENTS)
   - “CPUも同額参加費を払ぁE��Eを�E立させるための冁E��勘宁E
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
 * ✁E管琁E��E��け通るAPIを叩ぁE
 * - 403/401 は「非管琁E��E���E正常系�E�呼び出し�EぁEisAdmin 判定で使ぁE��E
 * - 返却のキー名が多少違ってめEbalanceCents/balanceUsd に正規化して返す
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
   - acceptJob(demo) で引いぁEstake めEsubmitTask(demo) で参�E
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
   - Taskペ�EジぁEimport してめEupsertWaiting を提供すめE
===================================================== */

// ☁E��番仕様：Waiting は24時間でタイムアウト返��
// realはサーバ�Eが判定�E返��する�E�ここ�EUI整形/チE��用�E�E
const REFUND_AFTER_MS = 24 * 60 * 60 * 1000; // 24h

const WAITING_KEY = "taskdash_waiting";

export type WaitingItem = {
  submissionId: string;
  status?: string;
  statusCompat?: string;
  priceUsd?: number | null;

  // 既孁E
  updatedAt?: string | null;

  // ☁E��加�E�EI用�E�E
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
   DEMO CPU MATCH (local “mini DB E
   - submitTask() で CPU相手�E結果を作って保孁E
   - checkMatch() で revealAt までは waiting、E��ぎためEmatched を返す
   - 経済ルール�E�pot=2*stake, 90/5/5
===================================================== */

const DEMO_MATCH_KEY = "taskdash_demo_matches_v1";
const DEMO_CPU_LEVEL_KEY = "taskdash_demo_cpu_level"; // 0.0-1.0 (任愁E

type DemoMatch = {
  submissionId: string;
  matchId: string;

  createdAt: string;
  revealAt: string;

  priceUsd: number;
  stakeCents: number;
  potCents: number;

  platformFeeCents: number;
  userPayoutCents: number;
  cpuPayoutCents: number;

  player: {
    id: "demo_user";
    score: number; // 小さぁE��ど強ぁE��宁E
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
  deltaUsd: number; // ユーザーの純増減！Eayout - stake�E�E
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

// プレイヤー強さ推宁E
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
    const s = Math.max(1, Math.floor(timeMs / 100)); // 10私E100
    return { score: s, timeMs };
  }

  return { score: 100, timeMs: null };
}

// CPUスコア生�E�E�小さぁE��ど強ぁE��E
function generateCpuScore(playerScore: number, cpuLevel01: number) {
  const baseSpread = 30 - Math.floor(cpuLevel01 * 18); // level高いほどブレ封E
  const bias = Math.floor((cpuLevel01 - 0.5) * 20); // level高いほどCPUが少し強ぁE

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
    // Demo: waitingキャチE��ュの “まだ reveal 前 E�E�E E4h期限冁E��Eを返す
    const now = Date.now();
    const max = Math.max(1, Math.min(50, Number(limit) || 20));

    const items = loadWaitingCache()
      .map((x) => {
        // expiresAt が無ぁE��ぁE��ャチE��ュは createdAt/updatedAt から補宁E
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
        // 24h趁E��は waiting に残さなぁE��Eemoでは返��済み扱ぁE��E
        const exp = Date.parse(String(x?.expiresAt || ""));
        if (Number.isFinite(exp) && now >= exp) return false;

        // CPU match の reveal 前だぁEwaiting
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

    // ☁E��加費を払ぁE��デモでも忁E��！E
    setDemoBalanceCents(bal - stakeCents);

    // submitで決済に使ぁE
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
      hasTask?: boolean; // Taskペ�Eジ互換�E�あると嬉しぁE��E
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

    // acceptで引いぁEstake を使ぁE��無ければ price から�E�E
    const stakeCents = popDemoStakeCents(attemptId) || priceUsd * 100;

    // Demo: waitingに載せる！EI用�E�E
    // ※ expiresAt/createdAt は upsertWaiting 側が確実に埋めめE
    upsertWaiting({
      submissionId,
      attemptId,
      status: "submitted",
      statusCompat: "waiting",
      priceUsd,
    });

    // CPUも同額参加費を払ぁE���E部勘定！E
    setDemoCpuCents(getDemoCpuCents() - stakeCents);

    // 強さ推定！EPU生�E
    const player = inferPlayerScore(payload);
    const cpuLevel = getDemoCpuLevel();
    const cpuScore = generateCpuScore(player.score, cpuLevel);
    const outcome = decideOutcome(player.score, cpuScore);

    // pot=2*stake, 90/5/5�E�Erawは両老E���߁E�E��数斁Eにする�E�E
    const potCents = stakeCents * 2;
    const winnerPayoutCents = Math.round(potCents * 0.9);
    const loserPayoutCents = Math.round(potCents * 0.05);
    const feeCents = potCents - winnerPayoutCents - loserPayoutCents; // 誤差吸叁E

    let userPayoutCents = 0;
    let cpuPayoutCents = 0;
    let platformFeeCents = 0;

    if (outcome === "win") {
      userPayoutCents = winnerPayoutCents;
      cpuPayoutCents = loserPayoutCents;
      platformFeeCents = feeCents;
    } else if (outcome === "lose") {
      userPayoutCents = loserPayoutCents;
      cpuPayoutCents = winnerPayoutCents;
      platformFeeCents = feeCents;
    } else {
      // draw
      userPayoutCents = stakeCents;
      cpuPayoutCents = stakeCents;
      platformFeeCents = 0;
    }

    // “演�E E用に少し征E��せる�E�E.7、E.4秒！E
    const now = Date.now();
    const delayMs = 700 + Math.floor(Math.random() * 700);
    const revealAt = new Date(now + delayMs).toISOString();

    // ☁E��ーザー残高：acceptで -stake 済みなので、ここでは payout を足すだぁE
    setDemoBalanceCents(getDemoBalanceCents() + userPayoutCents);

    // CPU/Platform 冁E��勘定（完�E一致�E�E
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
      potCents,
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

    // submit返却は waiting のままでOK�E�Eask側はcheckMatchをpollする前提�E�E
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
        potCents: m.potCents,
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

        // 90/5/5の冁E���E�EIが拾える�E�E
        stakeCents: m.stakeCents,
        potCents: m.potCents,
        platformFeeCents: m.platformFeeCents,
        userPayoutCents: m.userPayoutCents,

        playerScore: m.player.score,
        cpuScore: m.cpu.score,
        playerTimeMs: m.player.timeMs,
        cpuTimeMs: m.cpu.timeMs,
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
 * create order�E��E金�E�E�E
 * UIの import ぁEcreatePaypalOrder なので、その名前で提供すめE
 */
export async function createPaypalOrder(priceUsd: number) {
  if (isDemoMode()) return { ok: false, error: "paypal disabled in demo" };

  const amtUsd = Number(priceUsd);
  if (!Number.isFinite(amtUsd) || amtUsd <= 0) {
    return { ok: false, error: "invalid priceUsd" };
  }

  // 念のため�E�小数/誤差対策！E
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
 * payout�E��E金�E�E�E
 */
export async function paypalPayout(amountUsd: number, paypalEmail: string) {
  if (isDemoMode()) return { ok: false, error: "payout disabled in demo" };

  const amtUsd = Number(amountUsd);
  if (!Number.isFinite(amtUsd) || amtUsd <= 0) {
    return { ok: false, error: "invalid amountUsd" };
  }

  // USD -> cents�E�浮動小数誤差対策で round�E�E
  const amountCents = Math.round(amtUsd * 100);

  // 念のため�E�EaN/0防止�E�E
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "invalid amountCents" };
  }

  // requestId�E�ブラウザ安�E�E�E
  const requestId = makeRequestId();

  const r = await authenticatedFetch("/api/paypal/payout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountCents, paypalEmail, requestId }),
  });

  return await r.json().catch(() => ({}));
}

