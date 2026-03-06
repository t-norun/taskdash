// create-anything/_/apps/web/src/utils/auth.js

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "https://api.taskdash.net").replace(/\/+$/, "");

/**
 * userId を localStorage に保持
 */
export function getOrCreateUserId() {
  let userId = localStorage.getItem("taskdash.userId");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("taskdash.userId", userId);
  }
  return userId;
}

/**
 * v2 では userId があればログイン済み扱い
 */
export function isAuthenticated() {
  return !!localStorage.getItem("taskdash.userId");
}

/**
 * API 用 URL に正規化
 */
function toApiUrl(path) {
  if (!path) return path;

  // すでに絶対URLならそのまま
  if (/^https?:\/\//i.test(path)) return path;

  // React Router / create-anything 系内部パスはそのまま
  if (path.startsWith("/_create/")) return path;

  // /api/... は API_BASE に向ける
  if (path.startsWith("/api/")) {
    return `${API_BASE}${path}`;
  }

  // 先頭スラッシュなしでも API パスとして扱えるよう保険
  if (path.startsWith("api/")) {
    return `${API_BASE}/${path}`;
  }

  // それ以外の相対パスはそのまま
  return path;
}

/**
 * 必要なら userId をクエリに付ける
 * ただし create 画面や、すでに userId があるURLには付けない
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
 * - Bearer token があれば付ける
 * - token がなくても userId をクエリに付けて通せるようにする
 * - /api/... は必ず API_BASE に向ける
 */
export async function authenticatedFetch(path, options = {}) {
  const rawUrl = toApiUrl(path);
  const token =
    localStorage.getItem("taskdash_access_token") ||
    localStorage.getItem("taskdash_token") ||
    "";

  const userId =
    localStorage.getItem("taskdash.userId") || getOrCreateUserId();

  const url = token ? rawUrl : appendUserId(rawUrl, userId);

  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const finalOptions = {
    ...options,
    headers,
  };

  console.log("AUTH_FETCH base =", API_BASE);
  console.log("AUTH_FETCH path =", path);
  console.log("AUTH_FETCH url =", url);
  console.log("AUTH_FETCH options =", finalOptions);

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
 * 旧UI互換の user 情報取得
 */
export async function getUser() {
  const r = await authenticatedFetch("/api/user/balance", { method: "GET" });
  const j = await r.json();

  if (!j?.ok) {
    throw new Error(j?.error || "getUser failed");
  }

  return {
    id: j.userId,
    userId: j.userId,
    email: j.email || "",
    balance: j.balance ?? 0,
    reserved: j.reserved ?? 0,
    available: j.available ?? j.balance ?? 0,
    history: j.history ?? [],
  };
}

/**
 * ログアウト
 */
export async function logout() {
  localStorage.removeItem("taskdash.userId");
  localStorage.removeItem("taskdash_access_token");
  localStorage.removeItem("taskdash_token");
  window.location.href = "/";
}

