"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, LogOut, Plus } from "lucide-react";

import { getQueryParam, navigate } from "../utils/navigation";
import { isAuthenticated, getUser, logout } from "../utils/auth";

import {
  getMode as rtGetMode,
  isDemoMode as rtIsDemoMode,
  getBalance,
  getPlatformBalance,
  listWaiting,
  checkMatch,
  recentResults,
  listForfeited,
  createPaypalOrder,
  paypalPayout,
  setMode as rtSetMode,
  addDemoBalance,
  adminPaypalPayout,
} from "../utils/runtimeData";

import { fmtElapsed, fmtWhenShort, fmtRemainingHm, centsToUsd, fmtUsd } from "./home/logic/format";
import { readWaitingList, writeWaitingList, dedupeWaitingList } from "./home/logic/storageWaiting";
import { readRefundedList, writeRefundedList, dedupeRefundedList } from "./home/logic/storageRefunded";
import AdminPlatformBalance from "./home/ui/AdminPlatformBalance";

import RecentResultsPanel from "./home/ui/RecentResultsPanel";
import WaitingPanel from "./home/ui/WaitingPanel";
import NotCompletedPanel from "./home/ui/NotCompletedPanel";
import RefundedPanel from "./home/ui/RefundedPanel";

/* =====================================================
   HARD STOP: prevent /undefined navigation
===================================================== */

const safeNavigate = (to) => {
  try {
    if (typeof to !== "string") return navigate("/");
    const s = to.trim();
    if (!s || s === "undefined" || s === "null") return navigate("/");
    if (!s.startsWith("/")) return navigate("/");
    if (s === "/undefined" || s.startsWith("/undefined?")) return navigate("/");
    return navigate(s);
  } catch {
    try {
      window.location.href = "/";
    } catch {}
  }
};

/* =====================================================
   constants
===================================================== */

const MODE_KEY = "taskdash_mode";
const PRICE_OPTIONS = [1, 5, 10, 20, 50];

/* =====================================================
   mode helpers (URL > localStorage > runtimeData)
===================================================== */

function normalizeMode(v) {
  const s = String(v || "").toLowerCase().trim();
  if (s === "demo" || s === "d") return "demo";
  if (s === "real" || s === "prod" || s === "production" || s === "r") return "real";
  return "";
}

function getModeFromUrl() {
  const m = normalizeMode(getQueryParam("mode"));
  if (m) return m;
  const demo = getQueryParam("demo");
  if (demo === "1" || demo === "true" || demo === "yes") return "demo";
  return "";
}

function getModeFromStorage() {
  try {
    return normalizeMode(localStorage.getItem(MODE_KEY));
  } catch {
    return "";
  }
}

function getModeSafe() {
  const urlM = getModeFromUrl();
  if (urlM) return urlM;

  const lsM = getModeFromStorage();
  if (lsM) return lsM;

  try {
    const gm = typeof rtGetMode === "function" ? normalizeMode(rtGetMode()) : "";
    if (gm) return gm;
  } catch {}

  try {
    if (typeof rtIsDemoMode === "function" && rtIsDemoMode()) return "demo";
  } catch {}

  return "real";
}

function isDemoModeSafe() {
  return getModeSafe() === "demo";
}

function setModeSafe(nextMode) {
  const m = normalizeMode(nextMode) || "real";
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {}
  try {
    if (typeof rtSetMode === "function") rtSetMode(m);
  } catch {}
}

function getDemoBalanceKey() {
  return "taskdash_demo_balance_usd";
}

/* =====================================================
   time helpers
===================================================== */

function computeBackoffMs(elapsedMs) {
  const e = Math.max(0, Number(elapsedMs) || 0);
  if (e < 20_000) return 1200;
  if (e < 120_000) return 2000;
  if (e < 600_000) return 5000;
  if (e < 1_800_000) return 10_000;
  return 15_000;
}

/* =====================================================
   UI helpers
===================================================== */

function shortId(id) {
  const s = String(id || "");
  if (!s) return "";
  return s.length <= 12 ? s : `${s.slice(0, 4)}窶ｦ${s.slice(-4)}`;
}

function statusUpper(it) {
  return String((it && (it.status || it.state)) || "").toUpperCase();
}

function labelOfNotCompleted(it) {
  const st = statusUpper(it);
  if (st.includes("FORFEIT")) return "Not Completed";
  if (st.includes("EXPIRED")) return "Not Completed";
  return "Not Completed";
}

function reasonOfNotCompleted(it) {
  const st = statusUpper(it);
  if (st.includes("FORFEIT")) return "Reason: left before submitting";
  if (st.includes("EXPIRED")) return "Reason: not submitted";
  return "Reason: not submitted";
}

function whenOfItem(it) {
  const cand = (it && (it.forfeitedAt || it.expiredAt || it.updatedAt || it.submittedAt || it.createdAt)) || null;
  if (!cand) return null;
  try {
    return new Date(cand).toLocaleString();
  } catch {
    return null;
  }
}

function normalizePriceFromWaitingItem(it) {
  const stakeCents =
    it && it.stakeCents != null && Number.isFinite(Number(it.stakeCents)) ? Number(it.stakeCents) : null;

  const priceUsd =
    it && it.priceUsd != null && Number.isFinite(Number(it.priceUsd))
      ? Number(it.priceUsd)
      : stakeCents != null
      ? stakeCents / 100
      : null;

  return priceUsd;
}

/* =====================================================
   runtime call adapters (signature drift safe)
===================================================== */

async function callPaypalPayout(amountCents, email) {
  try {
    if (typeof paypalPayout !== "function") return { ok: false, error: "paypalPayout not available" };
    if (paypalPayout.length >= 3) {
      const requestId = `wd_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      return await paypalPayout(amountCents, email, requestId);
    }
    return await paypalPayout(amountCents, email);
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/* =====================================================
   component
===================================================== */

export default function HomePage() {
  const isDemo = isDemoModeSafe();

  const pollTimerRef = useRef(null);
  const cancelledRef = useRef(false);
  const lastSigRef = useRef("");
  const waitingRef = useRef([]);
  const pollOnceRef = useRef(null);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showAdmin, setShowAdmin] = useState(false);

  const [selectedPrice, setSelectedPrice] = useState(() => {
    const v = PRICE_OPTIONS && PRICE_OPTIONS[0];
    return v == null ? null : Number(v);
  });

  const [availableUsd, setAvailableUsd] = useState(0);
  const [reservedUsd, setReservedUsd] = useState(0);

  const [waitingCounts, setWaitingCounts] = useState({});
  const [waitingList, setWaitingList] = useState([]);
  const [waitingLoading, setWaitingLoading] = useState(false);
  const [waitingError, setWaitingError] = useState(null);

  const [refundedList, setRefundedList] = useState([]);

  const [recentMatches, setRecentMatches] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState(null);

  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState(10);
  const [processingPayment, setProcessingPayment] = useState(false);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [processingWithdraw, setProcessingWithdraw] = useState(false);

  const [nowMs, setNowMs] = useState(() => Date.now());

  const [activeTab, setActiveTab] = useState("results");
  const [waitingPriceFilter, setWaitingPriceFilter] = useState("all");

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [platformBalanceUsd, setPlatformBalanceUsd] = useState(null);

  const [forfeitedItems, setForfeitedItems] = useState([]);
  const [forfeitedError, setForfeitedError] = useState(null);
  const [forfeitedLoading, setForfeitedLoading] = useState(false);

  const [adminWithdrawEmail, setAdminWithdrawEmail] = useState("");
  const [adminWithdrawUsd, setAdminWithdrawUsd] = useState("1.00");
  const [adminWithdrawing, setAdminWithdrawing] = useState(false);
  const [adminWithdrawMsg, setAdminWithdrawMsg] = useState("");

  useEffect(() => {
    const urlMode = getModeFromUrl();
    if (urlMode) return;

    const ok = (() => {
      try {
        return Boolean(isAuthenticated());
      } catch {
        return false;
      }
    })();

    if (!ok) {
      setModeSafe("demo");
      try {
        window.history.replaceState(null, "", "/?mode=demo");
      } catch {}
    }
  }, []);

  useEffect(() => {
    waitingRef.current = Array.isArray(waitingList) ? waitingList : [];
  }, [waitingList]);

  useEffect(() => {
    if (isDemo && activeTab !== "results") setActiveTab("results");
  }, [isDemo, activeTab]);

  useEffect(() => {
    if (isDemo) return;
    if (!waitingList || waitingList.length === 0) return;
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [waitingList.length, isDemo]);

  useEffect(() => {
    const urlMode = getModeFromUrl();
    if (urlMode) setModeSafe(urlMode);
    else {
      const lsMode = getModeFromStorage();
      if (!lsMode) setModeSafe(getModeSafe());
    }
  }, []);

  useEffect(() => {
    const token = getQueryParam("token");
    if (token) safeNavigate(`/paypal-success?token=${encodeURIComponent(token)}`);
  }, []);

  useEffect(() => {
    if (selectedPrice != null && !PRICE_OPTIONS.includes(Number(selectedPrice))) setSelectedPrice(null);
  }, [selectedPrice]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setAdminChecked(false);
      setIsAdmin(false);
      setPlatformBalanceUsd(null);

      if (isDemo) {
        if (!mounted) return;
        setAdminChecked(true);
        return;
      }

      let authed = false;
      try {
        authed = Boolean(isAuthenticated());
      } catch {
        authed = false;
      }

      if (!authed) {
        if (!mounted) return;
        setAdminChecked(true);
        return;
      }

      try {
        const r = await getPlatformBalance();
        if (!mounted) return;
        if (r && r.ok === true) {
          setIsAdmin(true);
          setPlatformBalanceUsd(r.balanceUsd != null ? r.balanceUsd : null);
        } else {
          setIsAdmin(false);
        }
      } catch {
        if (!mounted) return;
        setIsAdmin(false);
      } finally {
        if (!mounted) return;
        setAdminChecked(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isDemo]);

  useEffect(() => {
    if (!adminChecked) return;
    if (!isAdmin) setShowAdmin(false);
  }, [adminChecked, isAdmin]);

  useEffect(() => {
    if (!showAdmin) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowAdmin(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAdmin]);

  const handleLogout = useCallback(async () => {
    try {
      try {
        localStorage.removeItem("taskdash_access_token");
      } catch {}
      await Promise.resolve(logout()).catch(() => {});
    } finally {
      window.location.href = "/";
    }
  }, []);

  const checkAuth = useCallback(async () => {
    if (isDemoModeSafe()) {
      setUser({ id: "demo", userId: "demo", level: 1 });
      return true;
    }

    try {
      const ok = await Promise.resolve(isAuthenticated()).catch(() => false);
      if (!ok) return false;

      const u = await Promise.resolve(getUser()).catch(() => null);
      if (u) setUser(u);
      return true;
    } catch (e) {
      console.error("checkAuth error:", e);
      return false;
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const b = await getBalance();
      if (!b || !b.ok) return;

      setAvailableUsd(Number(b.availableUsd || 0));
      setReservedUsd(Number(b.reservedUsd || 0));

      if (isDemoModeSafe()) {
        try {
          localStorage.setItem(getDemoBalanceKey(), String(Number(b.availableUsd || 0)));
        } catch {}
      }
    } catch (e) {
      console.error("loadData error:", e);
    }
  }, []);

  const loadWaitingCounts = useCallback(async (maybeList) => {
    if (isDemoModeSafe()) {
      setWaitingCounts({});
      return;
    }

    try {
      const list = Array.isArray(maybeList) ? maybeList : readWaitingList();
      const counts = {};

      for (const it of list) {
        const priceUsd = normalizePriceFromWaitingItem(it);
        if (priceUsd == null) continue;

        const key = String(Math.round(priceUsd));
        counts[key] = Number(counts[key] || 0) + 1;
      }

      setWaitingCounts(counts);
    } catch (e) {
      console.error("loadWaitingCounts error:", e);
      setWaitingCounts({});
    }
  }, []);

  const loadForfeited = useCallback(async () => {
    if (isDemoModeSafe()) {
      setForfeitedItems([]);
      setForfeitedError(null);
      setForfeitedLoading(false);
      return;
    }

    setForfeitedLoading(true);
    setForfeitedError(null);

    try {
      const r = await listForfeited(50);
      if (!r || !r.ok) {
        setForfeitedItems([]);
        setForfeitedError(String((r && r.error) || "failed"));
        return;
      }
      const items = Array.isArray(r.items) ? r.items : Array.isArray(r.results) ? r.results : [];
      setForfeitedItems(items);
    } catch (e) {
      setForfeitedItems([]);
      setForfeitedError(String((e && e.message) || e));
    } finally {
      setForfeitedLoading(false);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    setRecentError(null);

    const demo = isDemoModeSafe();

    try {
      const rr = await recentResults(5);
      if (!rr || !rr.ok) {
        setRecentError((rr && rr.error) || "failed");
        setRecentMatches([]);
        return;
      }

      const raw = (Array.isArray(rr.items) && rr.items) || (Array.isArray(rr.results) && rr.results) || [];

      if (!demo) {
        setRecentMatches(raw);
        return;
      }

      const items = raw.map((r, idx) => {
        const idBase = r.matchId || r.submissionId || r.attemptId || `demo_${idx}`;
        const outcome = String(r.outcome || "win").toLowerCase();
        const priceUsd =
          typeof r.priceUsd === "number" ? r.priceUsd : typeof r.stakeCents === "number" ? centsToUsd(r.stakeCents) : 1;

        return {
          ...r,
          id: String(idBase),
          outcome,
          priceUsd,
          stakeCents: typeof r.stakeCents === "number" ? r.stakeCents : Math.round(priceUsd * 100),
          createdAt: r.createdAt || null,
        };
      });

      setRecentMatches(items);
    } catch (e) {
      setRecentError(String((e && e.message) || e));
      setRecentMatches([]);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.resolve(loadData()).catch(() => {});
    await Promise.resolve(loadRecent()).catch(() => {});

    if (!isDemoModeSafe()) {
      await Promise.resolve(loadForfeited()).catch(() => {});
      await Promise.resolve(loadWaitingCounts(readWaitingList())).catch(() => {});
    } else {
      setWaitingList([]);
      setRefundedList([]);
      setWaitingCounts({});
      setForfeitedItems([]);
    }
  }, [loadData, loadRecent, loadForfeited, loadWaitingCounts]);

  const handleStartPractice = useCallback(() => {
    if (!selectedPrice) {
      alert("Please select a task tier first.");
      return;
    }

    const selectedUsd = Number(selectedPrice);
    const mode = isDemoModeSafe() ? "demo" : "real";

    // 縺薙％縺ｧ縺ｯ谿矩ｫ倥ｒ蠑輔°縺ｪ縺・
    // Ready for Task 蛛ｴ縺ｧ reserve / debit 縺吶ｋ蜑肴署
    window.location.href = `/task?price=${encodeURIComponent(String(selectedUsd))}&mode=${encodeURIComponent(mode)}`;
  }, [selectedPrice]);

  const handleAddFunds = useCallback(async () => {
    const amt = Number(addFundsAmount);
    if (!Number.isFinite(amt) || amt < 1 || amt > 500) {
      alert("Amount must be between $1 and $500");
      return;
    }

    if (isDemoModeSafe()) {
      try {
        addDemoBalance(amt);
      } catch (e) {
        console.error("addDemoBalance error:", e);
      }
      setShowAddFundsModal(false);
      await loadData();
      return;
    }

    setProcessingPayment(true);
    try {
      const order = await createPaypalOrder(amt);
      if (!order || !order.ok || !order.approveUrl) throw new Error(order.error || "Failed to create order");

      setShowAddFundsModal(false);
      window.location.assign(order.approveUrl);
    } catch (error) {
      console.error("Add funds error:", error);
      alert(`Error: ${(error && error.message) || String(error)}`);
    } finally {
      setProcessingPayment(false);
    }
  }, [addFundsAmount, loadData]);

  const handleWithdraw = useCallback(async () => {
    if (isDemoModeSafe()) {
      alert("Withdraw is disabled in demo mode.");
      return;
    }

    const amountUsd = parseFloat(String(withdrawAmount || "").trim());
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (amountUsd > Number(availableUsd || 0)) {
      alert(`Insufficient funds. You only have $${Number(availableUsd || 0).toFixed(2)} available.`);
      return;
    }

    const email = String(paypalEmail || "").trim();
    if (!email || !email.includes("@")) {
      alert("Please enter a valid PayPal email address");
      return;
    }

    setProcessingWithdraw(true);
    try {
      const amountCents = Math.round(amountUsd * 100);
      const out = await callPaypalPayout(amountCents, email);

      if (!out || !out.ok) throw new Error((out && out.error) || "Failed to process withdrawal");

      alert(`Withdrawal request submitted! Status: ${out.status || "ok"}`);
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setPaypalEmail("");

      await loadData();
    } catch (error) {
      console.error("Withdraw error:", error);
      alert((error && error.message) || String(error));
    } finally {
      setProcessingWithdraw(false);
    }
  }, [withdrawAmount, availableUsd, paypalEmail, loadData]);

  const handleAdminWithdraw = useCallback(async () => {
    setAdminWithdrawMsg("");

    if (isDemoModeSafe()) {
      setAdminWithdrawMsg("Admin withdraw is disabled in demo mode.");
      return;
    }

    const email = String(adminWithdrawEmail || "").trim();
    if (!email || !email.includes("@")) {
      setAdminWithdrawMsg("Enter a valid PayPal email.");
      return;
    }

    const usd = Number(String(adminWithdrawUsd || "").replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(usd) || usd <= 0) {
      setAdminWithdrawMsg("Enter a valid amount in USD.");
      return;
    }

    const amountCents = Math.round(usd * 100);
    if (amountCents < 100) {
      setAdminWithdrawMsg("Minimum withdraw is $1.00");
      return;
    }

    setAdminWithdrawing(true);
    try {
      const r = await adminPaypalPayout(amountCents, email);

      if (!r || !r.ok) {
        if (r && r.error === "INSUFFICIENT_PLATFORM_BALANCE") {
          const cur = Number(r.balanceCents || 0) / 100;
          setAdminWithdrawMsg(`Insufficient platform balance. Current: $${cur.toFixed(2)}`);
        } else if (r && r.error === "FORBIDDEN") {
          setAdminWithdrawMsg("Forbidden (admin only).");
        } else if (r && r.error === "PAYOUT_AMOUNT_TOO_SMALL") {
          const min = Number(r.minCents || 100) / 100;
          setAdminWithdrawMsg(`Amount too small. Min: $${min.toFixed(2)}`);
        } else if (r && r.error) {
          setAdminWithdrawMsg(`Withdraw failed: ${String(r.error)}`);
        } else {
          setAdminWithdrawMsg("Withdraw failed: UNKNOWN_ERROR");
        }
        return;
      }

      setAdminWithdrawMsg(`笨・Payout requested. Batch: ${r.payoutBatchId || "unknown"} (ref: ${r.referenceId || "n/a"})`);

      try {
        const pb = await getPlatformBalance();
        if (pb && pb.ok) setPlatformBalanceUsd(pb.balanceUsd != null ? pb.balanceUsd : null);
      } catch {}
    } catch (e) {
      setAdminWithdrawMsg(`Withdraw error: ${String((e && e.message) || e)}`);
    } finally {
      setAdminWithdrawing(false);
    }
  }, [adminWithdrawEmail, adminWithdrawUsd]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const ok = await checkAuth();
      if (!ok) {
        if (!alive) return;
        setLoading(false);
        const wantsReal = getModeSafe() === "real";
        if (wantsReal) safeNavigate("/login?redirect=/");
        return;
      }
      if (!alive) return;

      if (!isDemoModeSafe()) {
        try {
          const w = readWaitingList();
          setWaitingList(w);
          loadWaitingCounts(w);
        } catch {}

        try {
          setRefundedList(readRefundedList());
        } catch {}
      } else {
        setWaitingList([]);
        setRefundedList([]);
        setWaitingCounts({});
      }

      await refreshAll();
      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [checkAuth, refreshAll, loadWaitingCounts]);

  useEffect(() => {
    const run = () => {
      loadRecent();
      loadData();

      if (!isDemoModeSafe()) {
        loadForfeited();
        try {
          const w = readWaitingList();
          setWaitingList(w);
          loadWaitingCounts(w);
        } catch {}
        try {
          setRefundedList(readRefundedList());
        } catch {}
      }
    };

    run();

    const onFocus = () => run();
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onFocus);
    };
  }, [loadRecent, loadData, loadForfeited, loadWaitingCounts]);

  const filteredWaitingList = useMemo(() => {
    const list = waitingList || [];
    if (waitingPriceFilter === "all") return list;

    const p = Number(waitingPriceFilter);
    if (!Number.isFinite(p) || p <= 0) return list;

    return list.filter((x) => {
      const price = normalizePriceFromWaitingItem(x);
      if (price == null) return true;
      return Math.round(price * 100) === Math.round(p * 100);
    });
  }, [waitingList, waitingPriceFilter]);

  const notCompletedItems = useMemo(() => (Array.isArray(forfeitedItems) ? forfeitedItems : []), [forfeitedItems]);
  const refundedItems = useMemo(() => (Array.isArray(refundedList) ? refundedList : []), [refundedList]);

  const totalWaiting = useMemo(() => {
    return PRICE_OPTIONS.reduce((sum, price) => sum + Number(waitingCounts[String(price)] || 0), 0);
  }, [waitingCounts]);

  const selectedTierWaiting = useMemo(() => {
    if (selectedPrice == null) return 0;
    return Number(waitingCounts[String(selectedPrice)] || 0);
  }, [selectedPrice, waitingCounts]);

  /* =====================================================
     Waiting polling
  ===================================================== */

  const stopPolling = useCallback(() => {
    const t = pollTimerRef.current;
    if (t) clearTimeout(t);
    pollTimerRef.current = null;
  }, []);

  const schedulePolling = useCallback(
    (ms) => {
      stopPolling();
      pollTimerRef.current = setTimeout(() => {
        const fn = pollOnceRef.current;
        if (typeof fn === "function") fn();
      }, Math.max(300, Number(ms) || 1500));
    },
    [stopPolling]
  );

  const sigOf = useCallback((list) => {
    return JSON.stringify(
      (list || []).map((x) => ({
        submissionId: String((x && x.submissionId) || ""),
        status: String((x && x.status) || ""),
        stakeCents: x ? x.stakeCents : null,
        priceUsd: x ? x.priceUsd : null,
        expiresAt: x ? x.expiresAt : null,
        remainingMs: x ? x.remainingMs : null,
      }))
    );
  }, []);

  const moveToRefunded = useCallback(
    (w, checkMatchPayload) => {
      const sid = String((w && w.submissionId) || "");
      if (!sid) return;

      const stakeCents = w && w.stakeCents != null && Number.isFinite(Number(w.stakeCents)) ? Number(w.stakeCents) : null;

      const priceUsd =
        w && w.priceUsd != null && Number.isFinite(Number(w.priceUsd))
          ? Number(w.priceUsd)
          : stakeCents != null
          ? stakeCents / 100
          : null;

      const item = {
        submissionId: sid,
        attemptId: String((checkMatchPayload && checkMatchPayload.attemptId) ?? sid),
        createdAt: (w && w.createdAt) ?? null,
        savedAt: Date.now(),
        stakeCents: stakeCents ?? null,
        priceUsd: priceUsd ?? null,
        reason: String((checkMatchPayload && checkMatchPayload.reason) || "no match in time"),
        status: "REFUNDED",
      };

      setRefundedList((prev) => {
        const next = dedupeRefundedList([item, ...((Array.isArray(prev) && prev) || [])]);
        writeRefundedList(next);
        return next;
      });

      setWaitingList((prev) => {
        const next = ((Array.isArray(prev) && prev) || []).filter((x) => String((x && x.submissionId) || "") !== sid);
        writeWaitingList(next);
        return next;
      });

      try {
        const nextWaiting = readWaitingList().filter((x) => String((x && x.submissionId) || "") !== sid);
        loadWaitingCounts(nextWaiting);
      } catch {}
    },
    [loadWaitingCounts]
  );

  const pollOnce = useCallback(async () => {
    if (cancelledRef.current) return;

    if (isDemoModeSafe()) {
      stopPolling();
      return;
    }

    if (!waitingRef.current || waitingRef.current.length === 0) {
      stopPolling();
      return;
    }

    setWaitingLoading(true);
    setWaitingError(null);

    try {
      const res = await listWaiting(20);
      if (!res || !res.ok) throw new Error((res && res.error) || "failed");

      const rawList = Array.isArray(res.items) ? res.items : [];
      const nowEpochMs = Date.now();

      const normalized = dedupeWaitingList(rawList).map((x) => {
        const stakeCents =
          x && x.stakeCents != null && Number.isFinite(Number(x.stakeCents))
            ? Number(x.stakeCents)
            : x && x.stake != null && Number.isFinite(Number(x.stake))
            ? Number(x.stake)
            : null;

        const priceUsd =
          x && x.priceUsd != null && Number.isFinite(Number(x.priceUsd))
            ? Number(x.priceUsd)
            : x && x.price != null && Number.isFinite(Number(x.price))
            ? Number(x.price)
            : stakeCents != null
            ? stakeCents / 100
            : null;

        const savedAtRaw = x ? x.savedAt ?? x.createdAt ?? null : null;
        const savedAt =
          savedAtRaw != null && Number.isFinite(Number(savedAtRaw))
            ? Number(savedAtRaw)
            : x && x.createdAt
            ? new Date(x.createdAt).getTime()
            : nowEpochMs;

        let expiresAtMs = null;
        if (x && x.expiresAt) {
          const t = new Date(x.expiresAt).getTime();
          if (Number.isFinite(t)) expiresAtMs = t;
        }

        const remainingMsRaw = x && x.remainingMs != null ? Number(x.remainingMs) : null;
        if (expiresAtMs == null && Number.isFinite(remainingMsRaw)) {
          const ms = Number(remainingMsRaw);
          if (Number.isFinite(ms)) expiresAtMs = nowEpochMs + Math.max(0, ms);
        }

        const expiresAt = expiresAtMs != null ? new Date(expiresAtMs).toISOString() : null;
        const remainingMs = expiresAtMs != null ? Math.max(0, expiresAtMs - nowEpochMs) : null;

        const sid = String((x && (x.submissionId || x.id || x.attemptId)) || "");

        return {
          ...x,
          submissionId: sid,
          stakeCents,
          priceUsd,
          savedAt,
          status: (x && x.status) ?? "WAITING",
          expiresAt,
          remainingMs,
          _fetchedAtMs: nowEpochMs,
        };
      });

      const sig = sigOf(normalized);
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        setWaitingList(normalized);
        writeWaitingList(normalized);
        loadWaitingCounts(normalized);
      }

      for (const w of normalized) {
        if (cancelledRef.current) return;
        const sid = String((w && w.submissionId) || "");
        if (!sid) continue;

        const j = await checkMatch(sid);

        if (j && j.matchId) {
          const mid = String(j.matchId);
          try {
            localStorage.setItem("lastMatchId", mid);
          } catch {}

          const next = normalized.filter((x) => String((x && x.submissionId) || "") !== sid);
          setWaitingList(next);
          writeWaitingList(next);
          loadWaitingCounts(next);

          window.location.href = `/match?matchId=${encodeURIComponent(mid)}`;
          return;
        }

        const st = String((j && j.status) || "").toLowerCase();
        const stc = String((j && j.statusCompat) || "").toLowerCase();
        const refunded = !!(j && j.refunded);

        if (refunded || st === "cancelled" || stc === "cancelled") {
          moveToRefunded(w, j);
        }
      }

      const oldest = normalized && normalized.length ? normalized[normalized.length - 1].savedAt : nowEpochMs;
      const elapsed = nowEpochMs - Number(oldest || nowEpochMs);
      schedulePolling(computeBackoffMs(elapsed));
    } catch (e) {
      setWaitingError((e && e.message) || String(e));
      const local = readWaitingList();
      setWaitingList(local);
      loadWaitingCounts(local);
      schedulePolling(2000);
    } finally {
      setWaitingLoading(false);
    }
  }, [schedulePolling, sigOf, stopPolling, moveToRefunded, loadWaitingCounts]);

  useEffect(() => {
    pollOnceRef.current = pollOnce;
  }, [pollOnce]);

  useEffect(() => {
    cancelledRef.current = false;

    if (isDemoModeSafe()) {
      stopPolling();
      setWaitingList([]);
      setWaitingCounts({});
      setRefundedList([]);
      return () => {
        cancelledRef.current = true;
        stopPolling();
      };
    }

    const local = readWaitingList();
    if (local.length > 0) {
      setWaitingList(local);
      loadWaitingCounts(local);
      schedulePolling(800);
    } else {
      stopPolling();
      setWaitingCounts({});
    }

    try {
      setRefundedList(readRefundedList());
    } catch {}

    return () => {
      cancelledRef.current = true;
      stopPolling();
    };
  }, [schedulePolling, stopPolling, loadWaitingCounts]);

  /* =====================================================
     render
  ===================================================== */

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-white font-inter flex items-center justify-center">
        <div className="text-[14px] text-[#7A7A7A]">Loading...</div>
      </div>
    );
  }

  if (!isDemo && !user) {
    return (
      <div className="min-h-screen bg-white font-inter flex items-center justify-center">
        <div className="text-[14px] text-[#7A7A7A]">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="border-b border-[#EDEDED]">
        <div className="max-w-[980px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full" />
            <span className="text-[16px] font-semibold text-[#2B2B2B]">Task Dash{isDemo ? " (Demo)" : ""}</span>
          </div>

          <div className="flex items-center gap-4">
            {isDemo ? (
              <button
                onClick={() => {
                  const ok = (() => {
                    try {
                      return Boolean(isAuthenticated());
                    } catch {
                      return false;
                    }
                  })();

                  if (!ok) {
                    safeNavigate("/login?redirect=/?mode=real");
                    return;
                  }

                  setModeSafe("real");
                  window.location.href = "/?mode=real";
                }}
                className="text-[12px] px-3 py-1 rounded border border-[#2563FF] text-[#2563FF] hover:bg-[#2563FF] hover:text-white transition"
              >
                Switch to Real
              </button>
            ) : (
              <button
                onClick={() => {
                  setModeSafe("demo");
                  window.location.href = "/?mode=demo";
                }}
                className="text-[12px] px-3 py-1 rounded border border-[#2563FF] text-[#2563FF] hover:bg-[#2563FF] hover:text-white transition"
              >
                Demo
              </button>
            )}

            {!isDemo && adminChecked && isAdmin ? (
              <button
                type="button"
                onClick={() => setShowAdmin(true)}
                className="text-[13px] text-[#7A7A7A] hover:text-[#2B2B2B]"
              >
                Admin{platformBalanceUsd != null ? ` ($${Number(platformBalanceUsd).toFixed(2)})` : ""}
              </button>
            ) : null}

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-[13px] text-[#7A7A7A] hover:text-[#2B2B2B]"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[980px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.95fr] gap-6 mb-6">
          <div className="bg-white border border-[#F1F1F1] rounded-2xl p-7">
            <div className="inline-flex items-center rounded-full border border-[#D9E5FF] bg-[#F5F8FF] px-3 py-1 text-[12px] font-semibold text-[#2563FF]">
              Skill-based task platform
            </div>

            <div className="mt-5 text-[18px] sm:text-[20px] font-semibold text-[#2B2B2B] leading-[1.4]">
              Practice first. Funds are reserved only when you press <span className="text-[#2563FF]">Ready for Task</span>.
            </div>

            <div className="mt-3 text-[14px] text-[#6B7280] leading-[1.8]">
              Select a tier, open the practice board, and enter only when you are ready. Starting practice does not reserve your balance.
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[#ECECEC] p-4">
                <div className="text-[12px] font-semibold text-[#7A7A7A]">Step 1</div>
                <div className="mt-2 text-[16px] font-semibold text-[#2B2B2B]">Select a tier</div>
                <div className="mt-2 text-[13px] text-[#7A7A7A]">Choose the price level and check the queue.</div>
              </div>
              <div className="rounded-xl border border-[#ECECEC] p-4">
                <div className="text-[12px] font-semibold text-[#7A7A7A]">Step 2</div>
                <div className="mt-2 text-[16px] font-semibold text-[#2B2B2B]">Practice for free</div>
                <div className="mt-2 text-[13px] text-[#7A7A7A]">Open the task screen and try the practice board first.</div>
              </div>
              <div className="rounded-xl border border-[#ECECEC] p-4">
                <div className="text-[12px] font-semibold text-[#7A7A7A]">Step 3</div>
                <div className="mt-2 text-[16px] font-semibold text-[#2B2B2B]">Ready confirms entry</div>
                <div className="mt-2 text-[13px] text-[#7A7A7A]">The participation amount is reserved only when you press Ready for Task.</div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#F1F1F1] rounded-2xl p-7">
            <div className="text-[14px] font-semibold text-[#2B2B2B]">Wallet</div>

            <div className="mt-4 text-[13px] text-[#7A7A7A]">Available Balance</div>
            <div className="mt-1 text-[42px] leading-none font-semibold text-[#2B2B2B]">{fmtUsd(availableUsd)}</div>

            {reservedUsd > 0 ? (
              <div className="mt-2 text-[12px] text-[#F59E0B]">{fmtUsd(reservedUsd)} reserved</div>
            ) : (
              <div className="mt-2 text-[12px] text-[#7A7A7A]">Available for future task participation.</div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowAddFundsModal(true)}
                className="flex items-center justify-center gap-2 h-[44px] bg-[#10B981] text-white text-[14px] font-semibold rounded-xl hover:bg-[#059669]"
              >
                <Plus size={16} />
                Add Funds
              </button>
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="h-[44px] bg-white border border-[#E5E7EB] text-[#2B2B2B] text-[14px] font-semibold rounded-xl hover:border-[#2563FF]"
              >
                Withdraw
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-[#ECECEC] bg-[#FCFCFC] p-4">
              <div className="text-[13px] font-semibold text-[#2B2B2B]">Important</div>
              <div className="mt-2 text-[13px] leading-[1.7] text-[#7A7A7A]">
                Task Dash is a performance-evaluated platform. Rewards are determined by work quality and timing, not by user-to-user wagering.
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#F1F1F1] rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[28px] font-semibold text-[#2B2B2B]">Choose a Task Tier</div>
              <div className="mt-2 text-[14px] text-[#7A7A7A]">
                Queue activity is separated by price. Practice opens first, and balance is reserved later on Ready for Task.
              </div>
            </div>

            {!isDemo ? (
              <div className="text-[13px] text-[#7A7A7A]">
                Total waiting: <span className="font-semibold text-[#2B2B2B]">{totalWaiting}</span>
              </div>
            ) : (
              <div className="text-[13px] text-[#7A7A7A]">Demo mode</div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {PRICE_OPTIONS.map((price) => {
              const isSelected = Number(selectedPrice) === Number(price);
              const queueCount = Number(waitingCounts[String(price)] || 0);
              const hasEnoughForReady = Number(availableUsd || 0) >= Number(price);

              return (
                <button
                  key={price}
                  type="button"
                  onClick={() => setSelectedPrice(price)}
                  className={[
                    "rounded-2xl border p-4 text-left transition min-h-[138px]",
                    isSelected
                      ? "border-[#2563FF] ring-2 ring-[#DCE7FF] bg-[#FAFCFF]"
                      : "border-[#ECECEC] bg-white hover:border-[#2563FF]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[18px] font-semibold text-[#2B2B2B]">${price}</div>
                    {isSelected ? (
                      <div className="rounded-full bg-[#2563FF] px-3 py-1 text-[11px] font-semibold text-white">Selected</div>
                    ) : null}
                  </div>

                  <div className="mt-5 text-[13px] text-[#7A7A7A]">Queue</div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-[20px] font-semibold text-[#2B2B2B]">{queueCount}</div>
                    <div className="text-[12px] text-[#7A7A7A]">waiting</div>
                  </div>

                  <div className="mt-5 text-[13px] font-medium text-[#2B2B2B]">Open task practice</div>
                  <div className="mt-1 text-[12px] text-[#7A7A7A]">
                    {hasEnoughForReady
                      ? "Ready is available with your current balance."
                      : `Need ${fmtUsd(price)} balance when you press Ready.`}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-[#ECECEC] bg-[#FCFCFC] p-4">
            <div className="text-[13px] font-semibold text-[#2B2B2B]">Selected flow</div>
            <div className="mt-2 text-[15px] text-[#2B2B2B] leading-[1.8]">
              Start Practice 竊・Practice board 竊・Ready for Task 竊・participation amount reserved
            </div>
            {selectedPrice != null ? (
              <div className="mt-2 text-[13px] text-[#7A7A7A]">
                Selected tier: <span className="font-semibold text-[#2B2B2B]">${Number(selectedPrice).toFixed(0)}</span>
                {!isDemo ? (
                  <>
                    {" "}
                    ﾂｷ waiting in this tier: <span className="font-semibold text-[#2B2B2B]">{selectedTierWaiting}</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-5 text-[12px] text-[#7A7A7A]">
            Starting practice does not reserve funds. The amount is reserved only when you press Ready for Task on the task screen.
          </div>

          <button
            onClick={handleStartPractice}
            disabled={selectedPrice == null}
            className="mt-5 w-full h-[56px] bg-[#2563FF] text-white text-[16px] font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1E40AF]"
          >
            {selectedPrice == null
              ? "Select Tier First"
              : `Start Task Practice ($${Number(selectedPrice).toFixed(2)})`}
          </button>
        </div>

        <div className="bg-white border border-[#F1F1F1] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="inline-flex rounded-xl border border-[#E7E7E7] bg-white p-1 shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                onClick={() => setActiveTab("results")}
                className={[
                  "px-5 py-3 rounded-lg text-[14px] font-semibold transition",
                  activeTab === "results"
                    ? "bg-[#2B2B2B] text-white shadow-[0_10px_18px_rgba(0,0,0,0.16)]"
                    : "text-[#7A7A7A] hover:text-[#2B2B2B]",
                ].join(" ")}
              >
                Recent Results
              </button>

              {!isDemo ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab("waiting")}
                    className={[
                      "px-5 py-3 rounded-lg text-[14px] font-semibold transition",
                      activeTab === "waiting"
                        ? "bg-[#2B2B2B] text-white shadow-[0_10px_18px_rgba(0,0,0,0.16)]"
                        : "text-[#7A7A7A] hover:text-[#2B2B2B]",
                    ].join(" ")}
                  >
                    Waiting{waitingList && waitingList.length ? ` (${waitingList.length})` : ""}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("notCompleted")}
                    className={[
                      "px-5 py-3 rounded-lg text-[14px] font-semibold transition",
                      activeTab === "notCompleted"
                        ? "bg-[#2B2B2B] text-white shadow-[0_10px_18px_rgba(0,0,0,0.16)]"
                        : "text-[#7A7A7A] hover:text-[#2B2B2B]",
                    ].join(" ")}
                  >
                    Not Completed
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("refunded")}
                    className={[
                      "px-5 py-3 rounded-lg text-[14px] font-semibold transition",
                      activeTab === "refunded"
                        ? "bg-[#2B2B2B] text-white shadow-[0_10px_18px_rgba(0,0,0,0.16)]"
                        : "text-[#7A7A7A] hover:text-[#2B2B2B]",
                    ].join(" ")}
                  >
                    Refunded{refundedItems && refundedItems.length ? ` (${refundedItems.length})` : ""}
                  </button>
                </>
              ) : null}
            </div>

            {!isDemo ? (
              <div className="text-[12px] text-[#7A7A7A]">
                {activeTab === "waiting"
                  ? waitingLoading
                    ? "Updating..."
                    : "Auto-updating"
                  : activeTab === "notCompleted"
                  ? forfeitedLoading
                    ? "Loading..."
                    : ""
                  : ""}
              </div>
            ) : (
              <div className="text-[12px] text-[#7A7A7A]">Demo mode</div>
            )}
          </div>

          {activeTab === "results" ? (
            <RecentResultsPanel
              recentLoading={recentLoading}
              recentError={recentError}
              recentMatches={recentMatches}
              isDemo={isDemo}
              fmtWhenShort={fmtWhenShort}
              fmtElapsed={fmtElapsed}
              centsToUsd={centsToUsd}
              shortId={shortId}
            />
          ) : null}

          {!isDemo && activeTab === "waiting" ? (
            <WaitingPanel
              waitingError={waitingError}
              filteredWaitingList={filteredWaitingList}
              waitingPriceFilter={waitingPriceFilter}
              setWaitingPriceFilter={setWaitingPriceFilter}
              PRICE_OPTIONS={PRICE_OPTIONS}
              waitingLoading={waitingLoading}
              nowMs={nowMs}
              fmtWhenShort={fmtWhenShort}
              fmtRemainingHm={fmtRemainingHm}
              shortId={shortId}
            />
          ) : null}

          {!isDemo && activeTab === "notCompleted" ? (
            <NotCompletedPanel
              forfeitedLoading={forfeitedLoading}
              forfeitedError={forfeitedError}
              notCompletedItems={notCompletedItems}
              labelOfNotCompleted={labelOfNotCompleted}
              reasonOfNotCompleted={reasonOfNotCompleted}
              whenOfItem={whenOfItem}
              shortId={shortId}
            />
          ) : null}

          {!isDemo && activeTab === "refunded" ? (
            <RefundedPanel refundedItems={refundedItems} fmtWhenShort={fmtWhenShort} shortId={shortId} />
          ) : null}
        </div>

        <a
          href="/rules"
          className="w-full h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A] flex items-center justify-center gap-2 hover:border-[#2563FF] hover:text-[#2563FF]"
        >
          <BookOpen size={16} />
          How Task Dash Works
        </a>
      </div>

      {showAdmin && adminChecked && isAdmin ? (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdmin(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-[560px] bg-white rounded-2xl border border-[#F1F1F1] shadow-[0_20px_60px_rgba(0,0,0,0.20)] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[12px] text-[#7A7A7A] font-semibold">Admin</div>
                  <div className="mt-1 text-[18px] font-bold text-[#2B2B2B]">Platform Wallet</div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdmin(false)}
                  className="shrink-0 text-[12px] px-3 py-1 rounded border border-[#E7E7E7] text-[#2B2B2B] hover:opacity-80"
                >
                  Close
                </button>
              </div>

              <div className="mt-5">
                <AdminPlatformBalance getPlatformBalance={getPlatformBalance} />

                <div className="mt-5 border-t border-[#F1F1F1] pt-5">
                  <div className="text-[12px] text-[#7A7A7A] font-semibold">PayPal Withdraw (Admin)</div>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <div>
                      <div className="text-[12px] text-[#2B2B2B] font-semibold">PayPal Email</div>
                      <input
                        value={adminWithdrawEmail}
                        onChange={(e) => setAdminWithdrawEmail(e.target.value)}
                        placeholder="example@paypal.com"
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-[#E7E7E7] text-[14px] outline-none"
                      />
                    </div>
                    <div>
                      <div className="text-[12px] text-[#2B2B2B] font-semibold">Amount (USD)</div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-10 px-3 rounded-lg border border-[#E7E7E7] bg-[#FAFAFA] flex items-center text-[14px] text-[#2B2B2B]">
                          $
                        </div>
                        <input
                          value={adminWithdrawUsd}
                          onChange={(e) => setAdminWithdrawUsd(e.target.value)}
                          inputMode="decimal"
                          placeholder="1.00"
                          className="w-full h-10 px-3 rounded-lg border border-[#E7E7E7] text-[14px] outline-none"
                        />
                      </div>
                      <div className="mt-1 text-[12px] text-[#7A7A7A]">Min: $1.00</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAdminWithdraw}
                        disabled={adminWithdrawing}
                        className="h-10 px-4 rounded-lg bg-[#2B2B2B] text-white text-[13px] font-semibold disabled:opacity-50"
                      >
                        {adminWithdrawing ? "Withdrawing..." : "Withdraw"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminWithdrawMsg("");
                          setAdminWithdrawEmail("");
                          setAdminWithdrawUsd("1.00");
                        }}
                        disabled={adminWithdrawing}
                        className="h-10 px-4 rounded-lg border border-[#E7E7E7] text-[#2B2B2B] text-[13px] font-semibold disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </div>
                    {adminWithdrawMsg ? (
                      <div className="text-[12px] text-[#2B2B2B] bg-[#FAFAFA] border border-[#E7E7E7] rounded-lg p-3">
                        {adminWithdrawMsg}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showAddFundsModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 max-w-[400px] w-full">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-4">{isDemo ? "Add Demo Credits" : "Add Funds via PayPal"}</h3>
            <p className="text-[13px] text-[#7A7A7A] mb-4">
              {isDemo ? "This adds fake money locally (no payment)." : "You'll be redirected to PayPal to complete the payment."}
            </p>

            <div className="mb-6">
              <label className="text-[13px] font-medium text-[#2B2B2B] mb-2 block">Amount (USD)</label>
              <input
                type="number"
                min="1"
                max="500"
                value={addFundsAmount}
                onChange={(e) => setAddFundsAmount(parseFloat(e.target.value) || 1)}
                className="w-full h-[48px] px-4 border-2 border-[#E5E5E5] rounded-lg text-[16px] focus:border-[#2563FF] focus:outline-none"
              />
              <p className="text-[11px] text-[#9B9B9B] mt-1">Minimum: $1 | Maximum: $500</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddFundsModal(false);
                  setAddFundsAmount(10);
                }}
                disabled={processingPayment}
                className="flex-1 h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFunds}
                disabled={processingPayment}
                className="flex-1 h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-lg disabled:opacity-50"
              >
                {processingPayment ? "Processing..." : `Add $${Number(addFundsAmount).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showWithdrawModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 max-w-[400px] w-full">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-4">Withdraw to PayPal</h3>
            <p className="text-[13px] text-[#7A7A7A] mb-4">
              Available balance: <strong>{fmtUsd(availableUsd)}</strong>
            </p>

            <div className="mb-4">
              <label className="text-[13px] font-medium text-[#2B2B2B] mb-2 block">Amount (USD)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full h-[48px] px-4 border-2 border-[#E5E5E5] rounded-lg text-[16px] focus:border-[#2563FF] focus:outline-none"
                placeholder="Enter amount"
              />
            </div>

            <div className="mb-6">
              <label className="text-[13px] font-medium text-[#2B2B2B] mb-2 block">PayPal Email</label>
              <input
                type="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                className="w-full h-[48px] px-4 border-2 border-[#E5E5E5] rounded-lg text-[16px] focus:border-[#2563FF] focus:outline-none"
                placeholder="your@email.com"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount("");
                  setPaypalEmail("");
                }}
                disabled={processingWithdraw}
                className="flex-1 h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={processingWithdraw}
                className="flex-1 h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-lg disabled:opacity-50"
              >
                {processingWithdraw ? "Processing..." : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
