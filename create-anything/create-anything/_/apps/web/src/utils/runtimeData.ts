/**
 * apps/web/src/utils/runtimeData.ts
 * UI縺ｯ縺薙・繝輔ぃ繧､繝ｫ邨檎罰縺ｧ縺ｮ縺ｿ繝・・繧ｿ蜿門ｾ励☆繧・
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

  // 笘・TS/繝悶Λ繧ｦ繧ｶ荳｡蟇ｾ蠢懶ｼ喩lobalThis.crypto 邨檎罰縺ｧ getRandomValues
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

/** payout逕ｨ requestId・医ヶ繝ｩ繧ｦ繧ｶ螳牙・迚茨ｼ・*/
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

/** 莠呈鋤・・ask繝壹・繧ｸ縺・import 縺励※繧句錐蜑阪↓蜷医ｏ縺帙ｋ・・*/
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
   - demo_balance_cents 繧呈ｭ｣縺ｨ縺吶ｋ
   - 譌ｧ demo_balance (謨ｴ謨ｰUSD) 縺後≠繧後・遘ｻ陦・
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

/** UI縺九ｉ蜻ｼ縺ｶ繧・▽・・SD縺ｧ謖・ｮ唹K繝ｻ蟆乗焚OK・・*/
export function setDemoBalance(usd: number) {
  const cents = Math.round((Number(usd) || 0) * 100);
  setDemoBalanceCents(cents);
}

/** UI縺九ｉ蜻ｼ縺ｶ繧・▽・・SD縺ｧ蜉邂涌K繝ｻ蟆乗焚OK・・*/
export function addDemoBalance(deltaUsd: number) {
  const deltaCents = Math.round((Number(deltaUsd) || 0) * 100);
  setDemoBalanceCents(getDemoBalanceCents() + deltaCents);
}

/* =====================================================
   DEMO CPU/PLATFORM BALANCE (CENTS)
   - 窶廚PU繧ょ酔鬘榊盾蜉雋ｻ繧呈鴛縺・・繧呈・遶九＆縺帙ｋ縺溘ａ縺ｮ蜀・Κ蜍伜ｮ・
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
 * 笨・邂｡逅・・□縺鷹壹ｋAPI繧貞娼縺・
 * - 403/401 縺ｯ縲碁撼邂｡逅・・阪・豁｣蟶ｸ邉ｻ・亥他縺ｳ蜃ｺ縺怜・縺・isAdmin 蛻､螳壹〒菴ｿ縺・ｼ・
 * - 霑泌唆縺ｮ繧ｭ繝ｼ蜷阪′螟壼ｰ鷹＆縺｣縺ｦ繧・balanceCents/balanceUsd 縺ｫ豁｣隕丞喧縺励※霑斐☆
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
   - acceptJob(demo) 縺ｧ蠑輔＞縺・stake 繧・submitTask(demo) 縺ｧ蜿ら・
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
   - Task繝壹・繧ｸ縺・import 縺励※繧・upsertWaiting 繧呈署萓帙☆繧・
===================================================== */

// 笘・悽逡ｪ莉墓ｧ假ｼ啗aiting 縺ｯ24譎る俣縺ｧ繧ｿ繧､繝繧｢繧ｦ繝郁ｿ秘≡
// real縺ｯ繧ｵ繝ｼ繝舌・縺悟愛螳壹・霑秘≡縺吶ｋ・医％縺薙・UI謨ｴ蠖｢/繝・Δ逕ｨ・・
const REFUND_AFTER_MS = 24 * 60 * 60 * 1000; // 24h

const WAITING_KEY = "taskdash_waiting";

export type WaitingItem = {
  submissionId: string;
  status?: string;
  statusCompat?: string;
  priceUsd?: number | null;

  // 譌｢蟄・
  updatedAt?: string | null;

  // 笘・ｿｽ蜉・・I逕ｨ・・
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
   DEMO CPU MATCH (local 窶徇ini DB窶・
   - submitTask() 縺ｧ CPU逶ｸ謇九・邨先棡繧剃ｽ懊▲縺ｦ菫晏ｭ・
   - checkMatch() 縺ｧ revealAt 縺ｾ縺ｧ縺ｯ waiting縲・℃縺弱◆繧・matched 繧定ｿ斐☆
   - 邨梧ｸ医Ν繝ｼ繝ｫ・嗔ot=2*stake, 90/5/5
===================================================== */

const DEMO_MATCH_KEY = "taskdash_demo_matches_v1";
const DEMO_CPU_LEVEL_KEY = "taskdash_demo_cpu_level"; // 0.0-1.0 (莉ｻ諢・

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
    score: number; // 蟆上＆縺・⊇縺ｩ蠑ｷ縺・Φ螳・
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
  deltaUsd: number; // 繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ邏泌｢玲ｸ幢ｼ・ayout - stake・・
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

// 繝励Ξ繧､繝､繝ｼ蠑ｷ縺墓耳螳・
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
    const s = Math.max(1, Math.floor(timeMs / 100)); // 10遘・100
    return { score: s, timeMs };
  }

  return { score: 100, timeMs: null };
}

// CPU繧ｹ繧ｳ繧｢逕滓・・亥ｰ上＆縺・⊇縺ｩ蠑ｷ縺・ｼ・
function generateCpuScore(playerScore: number, cpuLevel01: number) {
  const baseSpread = 30 - Math.floor(cpuLevel01 * 18); // level鬮倥＞縺ｻ縺ｩ繝悶Ξ蟆・
  const bias = Math.floor((cpuLevel01 - 0.5) * 20); // level鬮倥＞縺ｻ縺ｩCPU縺悟ｰ代＠蠑ｷ縺・

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
   AUTH GUARD (Task蟆守ｷ夂畑)
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
    // Demo: waiting繧ｭ繝｣繝・す繝･縺ｮ 窶懊∪縺 reveal 蜑坂・・・窶・4h譛滄剞蜀・・繧定ｿ斐☆
    const now = Date.now();
    const max = Math.max(1, Math.min(50, Number(limit) || 20));

    const items = loadWaitingCache()
      .map((x) => {
        // expiresAt 縺檎┌縺・商縺・く繝｣繝・す繝･縺ｯ createdAt/updatedAt 縺九ｉ陬懷ｮ・
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
        // 24h雜・∴縺ｯ waiting 縺ｫ谿九＆縺ｪ縺・ｼ・emo縺ｧ縺ｯ霑秘≡貂医∩謇ｱ縺・ｼ・
        const exp = Date.parse(String(x?.expiresAt || ""));
        if (Number.isFinite(exp) && now >= exp) return false;

        // CPU match 縺ｮ reveal 蜑阪□縺・waiting
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

    // 笘・盾蜉雋ｻ繧呈鴛縺・ｼ医ョ繝｢縺ｧ繧ょｿ・茨ｼ・
    setDemoBalanceCents(bal - stakeCents);

    // submit縺ｧ豎ｺ貂医↓菴ｿ縺・
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
      hasTask?: boolean; // Task繝壹・繧ｸ莠呈鋤・医≠繧九→螫峨＠縺・ｼ・
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

    // accept縺ｧ蠑輔＞縺・stake 繧剃ｽｿ縺・ｼ育┌縺代ｌ縺ｰ price 縺九ｉ・・
    const stakeCents = popDemoStakeCents(attemptId) || priceUsd * 100;

    // Demo: waiting縺ｫ霈峨○繧具ｼ・I逕ｨ・・
    // 窶ｻ expiresAt/createdAt 縺ｯ upsertWaiting 蛛ｴ縺檎｢ｺ螳溘↓蝓九ａ繧・
    upsertWaiting({
      submissionId,
      attemptId,
      status: "submitted",
      statusCompat: "waiting",
      priceUsd,
    });

    // CPU繧ょ酔鬘榊盾蜉雋ｻ繧呈鴛縺・ｼ亥・驛ｨ蜍伜ｮ夲ｼ・
    setDemoCpuCents(getDemoCpuCents() - stakeCents);

    // 蠑ｷ縺墓耳螳夲ｼ・PU逕滓・
    const player = inferPlayerScore(payload);
    const cpuLevel = getDemoCpuLevel();
    const cpuScore = generateCpuScore(player.score, cpuLevel);
    const outcome = decideOutcome(player.score, cpuScore);

    // pot=2*stake, 90/5/5・・raw縺ｯ荳｡閠・ｿ秘≡・・焔謨ｰ譁・縺ｫ縺吶ｋ・・
    const potCents = stakeCents * 2;
    const winnerPayoutCents = Math.round(potCents * 0.9);
    const loserPayoutCents = Math.round(potCents * 0.05);
    const feeCents = potCents - winnerPayoutCents - loserPayoutCents; // 隱､蟾ｮ蜷ｸ蜿・

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

    // 窶懈ｼ泌・窶・逕ｨ縺ｫ蟆代＠蠕・◆縺帙ｋ・・.7縲・.4遘抵ｼ・
    const now = Date.now();
    const delayMs = 700 + Math.floor(Math.random() * 700);
    const revealAt = new Date(now + delayMs).toISOString();

    // 笘・Θ繝ｼ繧ｶ繝ｼ谿矩ｫ假ｼ啾ccept縺ｧ -stake 貂医∩縺ｪ縺ｮ縺ｧ縲√％縺薙〒縺ｯ payout 繧定ｶｳ縺吶□縺・
    setDemoBalanceCents(getDemoBalanceCents() + userPayoutCents);

    // CPU/Platform 蜀・Κ蜍伜ｮ夲ｼ亥ｮ悟・荳閾ｴ・・
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

    // submit霑泌唆縺ｯ waiting 縺ｮ縺ｾ縺ｾ縺ｧOK・・ask蛛ｴ縺ｯcheckMatch繧恥oll縺吶ｋ蜑肴署・・
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

        // 90/5/5縺ｮ蜀・ｨｳ・・I縺梧鏡縺医ｋ・・
        stakeCents: m.stakeCents,
        potCents: m.potCents,
        platformFeeCents: m.platformFeeCents,
        userPayoutCents: m.userPayoutCents,

        playerScore: m.player.score,
        cpuScore: m.cpu.score,
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
 * create order・亥・驥大・・・
 * UI縺ｮ import 縺・createPaypalOrder 縺ｪ縺ｮ縺ｧ縲√◎縺ｮ蜷榊燕縺ｧ謠蝉ｾ帙☆繧・
 */
export async function createPaypalOrder(priceUsd: number) {
  if (isDemoMode()) return { ok: false, error: "paypal disabled in demo" };

  const amtUsd = Number(priceUsd);
  if (!Number.isFinite(amtUsd) || amtUsd <= 0) {
    return { ok: false, error: "invalid priceUsd" };
  }

  // 蠢ｵ縺ｮ縺溘ａ・亥ｰ乗焚/隱､蟾ｮ蟇ｾ遲厄ｼ・
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
 * payout・亥・驥大・・・
 */
export async function paypalPayout(amountUsd: number, paypalEmail: string) {
  if (isDemoMode()) return { ok: false, error: "payout disabled in demo" };

  const amtUsd = Number(amountUsd);
  if (!Number.isFinite(amtUsd) || amtUsd <= 0) {
    return { ok: false, error: "invalid amountUsd" };
  }

  // USD -> cents・域ｵｮ蜍募ｰ乗焚隱､蟾ｮ蟇ｾ遲悶〒 round・・
  const amountCents = Math.round(amtUsd * 100);

  // 蠢ｵ縺ｮ縺溘ａ・・aN/0髦ｲ豁｢・・
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "invalid amountCents" };
  }

  // requestId・医ヶ繝ｩ繧ｦ繧ｶ螳牙・・・
  const requestId = makeRequestId();

  const r = await authenticatedFetch("/api/paypal/payout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountCents, paypalEmail, requestId }),
  });

  return await r.json().catch(() => ({}));
}

