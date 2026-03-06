import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "https://api.taskdash.net";
const DEV_KEY = import.meta.env.VITE_DEV_KEY ?? "dev-local-123";

export function useAdminData(activeTab) {
  const [analytics, setAnalytics] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [paypalMode, setPaypalMode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [openAddFunds, setOpenAddFunds] = useState(false);

  useEffect(() => {
    loadData();
    if (activeTab === "settings") {
      fetchPayPalMode();
    }
  }, [activeTab]);

  const getToken = () =>
    localStorage.getItem("taskdash_access_token") ||
    localStorage.getItem("access_token") ||
    "";

  const loadData = async () => {
    const token = getToken();
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
    const token = getToken();
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

  // DEV deposit・・nits繧偵◎縺ｮ縺ｾ縺ｾ蜈･繧後ｋ・・
  const addDevDeposit = async (amountUnits) => {
    const token = getToken();
    try {
      const r = await fetch(`${API_BASE}/dev/tx/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-key": DEV_KEY,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "x-idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({ amount: amountUnits }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "DEV deposit failed");

      // 蠑ｷ蛻ｶ逧・↓蜀榊酔譛・
      await loadData();

      setHistory((h) => [
        { at: new Date().toISOString(), label: "DEPOSIT", amount: amountUnits },
        ...h,
      ]);
      setOpenAddFunds(false);
    } catch (error) {
      throw error;
    }
  };

  return {
    analytics,
    wallet,
    userAnalytics,
    paypalMode,
    loading,
    loadData,
    addDevDeposit,
    history,
    openAddFunds,
    setOpenAddFunds,
  };
}

