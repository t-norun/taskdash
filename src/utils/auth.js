/**
 * JWT認証用のFetch wrapper
 * 自動的にBearer tokenをヘッダーに追加し、401エラー時にリフレッシュを試みる
 */

// Refresh token mutex - prevents parallel refresh attempts

import { API_BASE } from "./apiBase";
let refreshPromise = null;
let refreshAttemptCounter = 0;

async function refreshAccessToken() {
  const attemptId = ++refreshAttemptCounter;
  console.log(`🔄 [${attemptId}] Attempting to refresh access token...`);

  // If already refreshing, wait for that promise
  if (refreshPromise) {
    console.log(`⏳ [${attemptId}] Refresh already in progress, waiting...`);
    return await refreshPromise;
  }

  const refreshToken = localStorage.getItem("taskdash_refresh_token");
  const refreshTokenId = localStorage.getItem("taskdash_refresh_token_id");

  console.log(`🔑 [${attemptId}] Refresh token exists:`, !!refreshToken);
  console.log(`🔑 [${attemptId}] Refresh token ID exists:`, !!refreshTokenId);

  if (!refreshToken || !refreshTokenId) {
    console.log(`❌ [${attemptId}] No refresh token available`);
    throw new Error("No refresh token available");
  }

  // Create the refresh promise
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/jwt/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken, refreshTokenId }),
      });

      console.log(
        `📡 [${attemptId}] Refresh response status:`,
        response.status,
      );

      if (!response.ok) {
        console.log(
          `❌ [${attemptId}] Refresh failed, clearing storage and redirecting to /login`,
        );
        // Refresh failed - redirect to login
        localStorage.clear();
        window.location.href = "/login";
        throw new Error("Session expired. Please login again.");
      }

      const data = await response.json();

      console.log(`✅ [${attemptId}] Token refreshed successfully`);

      // Update tokens
      localStorage.setItem("taskdash_access_token", data.accessToken);
      localStorage.setItem("taskdash_refresh_token", data.refreshToken);
      localStorage.setItem("taskdash_refresh_token_id", data.refreshTokenId);

      return data.accessToken;
    } finally {
      // Clear the promise after completion (success or failure)
      refreshPromise = null;
    }
  })();

  return await refreshPromise;
}

/**
 * 認証付きFetch
 * @param {string} url - リクエストURL
 * @param {RequestInit} options - Fetchオプション
 * @param {boolean} retry - 401エラー時にリトライするか（デフォルト: true）
 */
export async function authenticatedFetch(url, options = {}, retry = true) {
  const accessToken = localStorage.getItem("taskdash_access_token");

  console.log(`🔐 authenticatedFetch: ${url}`);
  console.log("Token exists:", !!accessToken);
  console.log("Token preview:", accessToken?.substring(0, 30) + "...");

  if (!accessToken) {
    console.log("❌ No access token, redirecting to /login");
    window.location.href = "/login";
    throw new Error("Not authenticated");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  console.log(`Response status for ${url}:`, response.status);

  // 401 Unauthorized - Access Token expired
  if (response.status === 401 && retry) {
    console.log("🔄 Got 401, attempting token refresh...");
    try {
      // Refresh token and retry
      const newAccessToken = await refreshAccessToken();

      // Retry with new token (retry=false to prevent infinite loop)
      return await authenticatedFetch(url, options, false);
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      throw error;
    }
  }

  // If retry=false and still 401, or any other error status
  if (response.status === 401 && !retry) {
    console.log("❌ Still 401 after refresh, session expired");
    localStorage.clear();
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  return response;
}

/**
 * ログアウト
 */
export async function logout() {
  try {
    const refreshTokenId = localStorage.getItem("taskdash_refresh_token_id");

    // サーバー側でRefresh Tokenを失効
    await authenticatedFetch(
      "/api/jwt/logout",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshTokenId }),
      },
      false,
    ); // Don't retry on 401
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    // Clear local storage and redirect
    localStorage.clear();
    window.location.href = "/login";
  }
}

/**
 * ユーザー情報を取得
 */
export function getUser() {
  const userStr = localStorage.getItem("taskdash_user");
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * 認証状態を確認
 */
export function isAuthenticated() {
  return !!localStorage.getItem("taskdash_access_token");
}
