// create-anything/apps/web/src/utils/auth.js

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

/**
 * Taskdash v2 用：userId直渡し（Bearer/JWTは使わない）
 * - userId: localStorage "taskdash.userId"
 * - devKey: localStorage "x-dev-key"（dev-local-123 を入れてる前提）
 * - /api/* を API_BASE に向ける（既存create-anything互換）
 */

export function getOrCreateUserId() {
  let userId = localStorage.getItem("taskdash.userId");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("taskdash.userId", userId);
  }
  return userId;
}

export function isAuthenticated() {
  // v2では userId があればOK（ログイン概念を捨てる）
  return !!localStorage.getItem("taskdash.userId");
}

function toApiUrl(url) {
  if (!url) return url;

  // すでに絶対URLならそのまま
  if (url.startsWith("http")) return url;

  // create-anything内部のパスはそのまま（必要なら）
  if (url.startsWith("/_create/")) return url;

  // /api/... は API_BASE に向ける
  if (url.startsWith("/api/")) return `${API_BASE}${url}`;

  // それ以外はそのまま（相対を使ってる箇所があっても壊さない）
  return url;
}

function appendUserId(url, userId) {
  // /_create/ は userId を付けない
  if (url.startsWith("/_create/")) return url;

  // 既に userId が付いてたらそのまま
  if (url.includes("userId=")) return url;

  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}userId=${encodeURIComponent(userId)}`;
}

/**
 * 認証付きFetch（v2: userId + x-dev-key）
 */
export async function authenticatedFetch(path, options = {}) {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const token =
    localStorage.getItem("taskdash_access_token") ||
    localStorage.getItem("taskdash_token") ||
    "";

  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const finalOptions = { ...options, headers };

  console.log("AUTH_FETCH url =", url);
  console.log("AUTH_FETCH options =", finalOptions);

  const res = await fetch(url, finalOptions);

  // ↓ デバッグ用（壊れない・二重宣言しない・json()を邪魔しない）
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
 * ユーザー情報（旧UI互換）
 * - v2の /home?userId=... を叩いて、形だけ合わせて返す
 */
export async function getUser() {
  const r = await authenticatedFetch("/api/user/balance", { method: "GET" });
  const j = await r.json();
  if (!j?.ok) throw new Error(j?.error || "getUser failed");

  return {
    id: j.userId,
    userId: j.userId,
    balance: j.balance ?? 0,
    reserved: j.reserved ?? 0,
    available: j.available ?? j.balance ?? 0,
    history: j.history ?? [],
  };
}

/**
 * ログアウト（v2版）
 * - JWTなど無いので userId を消すだけ
 */
export async function logout() {
  localStorage.removeItem("taskdash.userId");
  // create-anything側が/loginに飛ばす設計なら残してもいいが、
  // 今はUIを動かすのが目的なのでリロードにする
  window.location.href = "/";
}
