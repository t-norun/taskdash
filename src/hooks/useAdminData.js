import { useState, useEffect } from "react";
import { API_BASE } from "../utils/apiBase";

export function useAdminData(activeTab) {
  const [analytics, setAnalytics] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [paypalMode, setPaypalMode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    if (activeTab === "settings") {
      fetchPayPalMode();
    }
  }, [activeTab]);

  const loadData = async () => {
    const token = localStorage.getItem("taskdash_token");
    if (!token) return;

    try {
      const [analyticsRes, walletRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/admin/wallet`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }

      if (walletRes.ok) {
        const data = await walletRes.json();
        setWallet(data);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUserAnalytics(data);
      }
    } catch (error) {
      console.error("Failed to load admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayPalMode = async () => {
    const token = localStorage.getItem("taskdash_token");
    try {
      const res = await fetch(`${API_BASE}/api/admin/paypal-mode`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPaypalMode(data);
      }
    } catch (error) {
      console.error("Failed to fetch PayPal mode:", error);
    }
  };

  return {
    analytics,
    wallet,
    userAnalytics,
    paypalMode,
    loading,
    loadData,
  };
}
