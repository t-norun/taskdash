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
