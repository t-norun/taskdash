// src/utils/useUser.js
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/utils/auth"; // もしパス違うなら元のままでOK

const API_BASE =
  (import.meta.env?.VITE_API_BASE_URL?.trim?.() ||
    import.meta.env?.VITE_API_BASE?.trim?.() ||
    "http://localhost:3000");

export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 既存の authenticatedFetch を使えるならそれが一番安全
        // ただし authenticatedFetch が「API_BASEを内部で持ってる」設計ならこのままでOK
        const res = await authenticatedFetch("/api/jwt/session", {});

        // authenticatedFetch が使えない/壊れてる場合のフォールバック：
        // const token =
        //   localStorage.getItem("taskdash_access_token") ||
        //   localStorage.getItem("accessToken") ||
        //   localStorage.getItem("token") || "";
        // const res = await fetch(`${API_BASE}/api/jwt/session`, {
        //   headers: { Authorization: `Bearer ${token}` },
        // });

        const data = await res.json().catch(() => null);
        if (!cancelled) setUser(data?.user ?? data ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading, apiBase: API_BASE };
}
import { authenticatedFetch } from "@/utils/auth";
import { useState, useEffect, useCallback } from "react";

export const useUser = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("taskdash_access_token");

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
<<<<<<< HEAD
      const response = await authenticatedFetch("/api/jwt/session", {
=======
      const API_BASE = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${API_BASE}/api/jwt/session`, {
>>>>>>> split-api
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Session invalid");
      }

      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      localStorage.removeItem("taskdash_access_token");
      localStorage.removeItem("taskdash_refresh_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    data: user,
    loading,
    refetch: fetchUser,
  };
};

export default useUser;
