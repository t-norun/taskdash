// create-anything/_/apps/web/src/utils/auth.js

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "https://api.taskdash.net").replace(/\/+$/, "");

/**
 * localStorage safe helpers
 */
function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * token helpers
 */
export function getAccessToken() {
  return safeGet("taskdash_access_token") || safeGet("taskdash_token") || "";
}

export function getRefreshToken() {
  return safeGet("taskdash_refresh_token") || "";
}

export function getStoredUser() {
  try {
    const raw = safeGet("taskdash_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 旧互換用 userId
 * ※ これは「ログイン判定」には使わない
 */
export function getOrCreateUserId() {
  let userId = safeGet("taskdash.userId");
  if (!userId) {
    userId = crypto.randomUUID();
    safeSet("taskdash.userId", userId);
  }
  return userId;
}

/**
 * JWTがあるときだけログイン済み扱い
 */
export function isAuthenticated() {
  return !!getAccessToken();
}

/**
 * API 用 URL に正規化
 */
function toApiUrl(path) {
  if (!path) return path;

  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/_create/")) return path;

  if (path.startsWith("/api/")) {
    return `${API_BASE}${path}`;
  }

  if (path.startsWith("api/")) {
    return `${API_BASE}/${path}`;
  }

  return path;
}

/**
 * 旧互換用:
 * token がない時だけ userId をクエリに付与
 * ただし JWT 必須APIでは通らないので、主に旧画面/互換用途
 */
function appendUserId(url, userId) {
  if (!url || !userId) return url;
  if (url.startsWith("/_create/")) return url;
  if (url.includes("userId=")) return url;

  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}userId=${encodeURIComponent(userId)}`;
}

/**
 * 認証付き fetch
 * - Bearer token があれば必ず付ける
 * - token がない場合のみ旧互換で userId を付ける
 * - /api/... は必ず API_BASE に向ける
 */
export async function authenticatedFetch(path, options = {}) {
  const rawUrl = toApiUrl(path);
  const token = getAccessToken();
  const userId = safeGet("taskdash.userId") || getOrCreateUserId();
  const url = token ? rawUrl : appendUserId(rawUrl, userId);

  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization") && !headers.has("authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const finalOptions = {
    ...options,
    headers,
  };

  console.log("AUTH_FETCH base =", API_BASE);
  console.log("AUTH_FETCH path =", path);
  console.log("AUTH_FETCH url =", url);
  console.log("AUTH_FETCH hasToken =", !!token);
  console.log("AUTH_FETCH authHeader =", headers.get("Authorization") || headers.get("authorization") || "(none)");

  const res = await fetch(url, finalOptions);

  try {
    console.log("AUTH_FETCH status =", res.status);
    const bodyPreview = await res.clone().text();
    console.log("AUTH_FETCH body =", bodyPreview.slice(0, 300));
  } catch (e) {
    console.log("AUTH_FETCH preview failed:", String(e));
  }

  return res;
}

/**
 * 認証必須APIを叩く前の簡易チェック
 */
export function requireAccessToken() {
  const token = getAccessToken();
  if (!token) {
    throw new Error("missing taskdash_access_token");
  }
  return token;
}

/**
 * 現在ユーザー取得
 */
export async function getUser() {
  requireAccessToken();

  const r = await authenticatedFetch("/api/user/balance", { method: "GET" });
  const j = await r.json().catch(() => ({}));

  if (!r.ok || !j?.ok) {
    throw new Error(j?.error || "getUser failed");
  }

  return {
    id: j.userId,
    userId: j.userId,
    email: j.email || getStoredUser()?.email || "",
    balance: j.balance ?? 0,
    reserved: j.reserved ?? 0,
    available: j.available ?? j.balance ?? 0,
    history: j.history ?? [],
  };
}

/**
 * token保存ヘルパー
 * login page から使ってもいい
 */
export function saveAuthSession(data = {}) {
  if (data.accessToken) safeSet("taskdash_access_token", data.accessToken);
  if (data.refreshToken) safeSet("taskdash_refresh_token", data.refreshToken);
  if (data.refreshTokenId) safeSet("taskdash_refresh_token_id", data.refreshTokenId);
  if (data.user) safeSet("taskdash_user", JSON.stringify(data.user));
}

/**
 * ログアウト
 */
export async function logout() {
  safeRemove("taskdash_access_token");
  safeRemove("taskdash_token");
  safeRemove("taskdash_refresh_token");
  safeRemove("taskdash_refresh_token_id");
  safeRemove("taskdash_user");
  safeRemove("taskdash.userId");
  window.location.href = "/";
}

