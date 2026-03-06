/**
 * apps/web/src/utils/auth.js
 * create-anything (front)
 *
 * 目的:
 * - API_BASE は VITE_API_BASE_URL（本番）を優先。無ければ localhost:3000
 * - Demo mode のとき authenticatedFetch をブロックして「API直叩き事故」を止める
 * - Cookieセッション認証 / Bearer認証のどちらでも通るようにする
 * - 既存互換: authenticatedFetch / isAuthenticated / getUser / logout / requireAuth は残す
 * - 本番OTP: /api/auth/otp/send , /api/auth/otp/verify を使用（token返却）
 */

const TOKEN_KEY = "taskdash_access_token";

// ✅ 本番は .env の VITE_API_BASE_URL に寄せる（例: https://api.taskdash.net）
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  ""
);

// runtimeData.ts と揃える
const MODE_KEY = "taskdash_mode"; // "demo" | "real"
const DEMO_VALUE = "demo";

// debugログは明示ON時だけ
const DEBUG_KEY = "taskdash_debug_auth"; // "1" で有効

function safeGetLS(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSetLS(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {}
}
function safeRemoveLS(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function getApiBaseUrl() {
  return API_BASE;
}

export function getAccessToken() {
  return safeGetLS(TOKEN_KEY);
}

export function setAccessToken(token) {
  if (!token) safeRemoveLS(TOKEN_KEY);
  else safeSetLS(TOKEN_KEY, String(token));
}

export function isAuthenticated() {
  return !!getAccessToken();
}

export function getMode() {
  const m = safeGetLS(MODE_KEY);
  return m === DEMO_VALUE ? DEMO_VALUE : "real";
}

export function isDemoMode() {
  return getMode() === DEMO_VALUE;
}

function isDebugOn() {
  if (safeGetLS(DEBUG_KEY) === "1") return true;
  try {
    return !!window.__TASKDASH_DEBUG_AUTH__;
  } catch {
    return false;
  }
}

function toApiUrl(path) {
  if (!path) return API_BASE;
  if (typeof path === "string" && /^https?:\/\//i.test(path)) return path;

  const p = String(path);
  return `${API_BASE}${p.startsWith("/") ? "" : "/"}${p}`;
}

/**
 * authenticatedFetch
 * - 通常: token があれば Authorization を付けて API_BASE へ fetch
 * - Cookieセッションでも認証できるよう credentials: "include" を常に付ける
 * - demo: 原則ブロック（UIが直で叩いてもここで止める）
 *
 * options.allowInDemo === true の時だけ demo でも通す（開発/検証用）
 */
export async function authenticatedFetch(path, options = {}) {
  const url = toApiUrl(path);

  // ✅ Demo遮断
  if (isDemoMode()) {
    const allowInDemo = !!options.allowInDemo;
    const isToApiBase = typeof url === "string" && url.startsWith(API_BASE);
    const looksApiPath =
      typeof path === "string" ? path.startsWith("/api/") || path.startsWith("api/") : true;

    if (!allowInDemo && isToApiBase && looksApiPath) {
      const e = new Error("Demo mode: network calls are blocked (use runtimeData wrapper).");
      e.code = "DEMO_MODE_BLOCKED";
      e.url = url;
      throw e;
    }
  }

  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  // tokenがある時だけ Authorization を付ける
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && options.body != null) {
    // 呼び出し側が未指定ならJSONとして扱う（FormData等は呼び出し側で上書きして）
    headers.set("Content-Type", "application/json");
  }

  if (isDebugOn()) {
    // eslint-disable-next-line no-console
    console.log("[AUTH] url=", url, "hasToken=", !!token, "mode=", getMode());
  }

  // options を壊さず、headers/allowInDemo だけ除去
  const { headers: _ignored, allowInDemo: _ignored2, ...rest } = options;

  return fetch(url, {
    ...rest,
    headers,
    credentials: "include",
  });
}

/**
 * OTP (本番仕様)
 * ✅ 送信: POST /api/auth/otp/send { email }
 * ✅ 検証: POST /api/auth/otp/verify { email, code } -> { ok:true, token }
 */
export async function sendOtp(email) {
  if (!email) throw new Error("email is required");

  const r = await authenticatedFetch("/api/auth/otp/send", {
    method: "POST",
    allowInDemo: false,
    body: JSON.stringify({ email }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) {
    throw new Error(data?.error || `send failed (${r.status})`);
  }
  return true;
}

export async function verifyOtp(email, code) {
  if (!email) throw new Error("email is required");
  if (!code) throw new Error("code is required");

  const r = await authenticatedFetch("/api/auth/otp/verify", {
    method: "POST",
    allowInDemo: false,
    body: JSON.stringify({ email, code }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) {
    throw new Error(data?.error || `verify failed (${r.status})`);
  }

  if (!data?.token) {
    throw new Error("verify succeeded but token is missing (API response has no token)");
  }

  setAccessToken(data.token);
  return data.token;
}

/**
 * 互換: getUser
 * - 旧仕様: balance が取れたら「ログインしてる」とみなす
 * - demo: 常に null（UIが “未ログイン” 扱いになるように）
 */
export async function getUser() {
  if (isDemoMode()) return null;

  try {
    const r = await authenticatedFetch("/api/user/balance", { method: "GET" });
    if (!r.ok) return null;

    const data = await r.json().catch(() => null);
    if (!data) return null;

    return {
      id: data.userId ?? data.id ?? null,
      userId: data.userId ?? null,
      level: data.level ?? 1,
      tickets: data.tickets ?? null,
      effectiveTickets: data.effectiveTickets ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * 互換: requireAuth
 * - ログインしてなければ throw
 */
export function requireAuth() {
  if (!isAuthenticated()) {
    throw new Error("Not authenticated");
  }
}

/**
 * logout
 * - 本番側のlogoutが無くても、tokenを消せばフロント的にはログアウト扱いになる
 * - 旧互換の /api/jwt/logout は「存在すれば叩く」でOK
 */
export async function logout() {
  setAccessToken(null);

  if (isDemoMode()) return;

  try {
    // 旧ルート互換：存在すればセッションも切れる
    await authenticatedFetch("/api/jwt/logout", { method: "POST" });
  } catch {
    // ignore
  }
}