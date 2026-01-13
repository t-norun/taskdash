// JWT認証用のuseAuthフック
import { API_BASE } from "./apiBase";
export default function useAuth() {
  const signInWithCredentials = async ({ email, redirect = true }) => {
    // JWTログインは /login ページで直接処理される
    if (redirect) {
      window.location.href = `/login?email=${encodeURIComponent(email)}`;
    }
  };

  const signOut = async () => {
    try {
      await fetch(`${API_BASE}/api/jwt/logout`, { method: "POST" });
      localStorage.removeItem("taskdash_access_token");
      localStorage.removeItem("taskdash_refresh_token");
      window.location.href = "/landing";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return {
    signInWithCredentials,
    signOut,
  };
}
