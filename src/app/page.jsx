"use client";

import { useState, useEffect } from "react";
import {
  Trophy,
  Clock,
  DollarSign,
  BookOpen,
  LogOut,
  Plus,
} from "lucide-react";
import {
  authenticatedFetch,
  logout,
  getUser,
  isAuthenticated,
} from "@/utils/auth";
import { API_BASE } from "../utils/apiBase";

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [reserved, setReserved] = useState(0);
  const [available, setAvailable] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState(10);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState(null);
  const [waitingCounts, setWaitingCounts] = useState({});
  const [paypalEmail, setPaypalEmail] = useState("");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [processingWithdraw, setProcessingWithdraw] = useState(false);

  useEffect(() => {
    console.log("🔍 HomePage mounted, checking auth...");
    console.log(
      "Access token exists:",
      !!localStorage.getItem("taskdash_access_token"),
    );

    // Test apiFetch
    fetch(`${API_BASE}/api/health`).then(console.log);

    checkAuth();

    // Listen for PayPal success messages from child window
    const handleMessage = (event) => {
      if (event.data.type === "PAYPAL_SUCCESS") {
        console.log(
          "💰 Payment success message received from child window:",
          event.data,
        );
        // Reload balance
        loadData();
      }
    };
    window.addEventListener("message", handleMessage);

    // 🔇 一時的に自動読み込みを全て停止（ログ制御のため）
    // loadData();
    // loadWaitingCounts();

    // 🔇 ポーリングも完全停止
    // const interval = setInterval(() => {
    //   loadWaitingCounts();
    // }, 5000);

    setLoading(false);

    return () => {
      window.removeEventListener("message", handleMessage);
      // clearInterval(interval);
    };
  }, []);

  const checkAuth = () => {
    const hasToken = isAuthenticated();
    console.log("🔍 isAuthenticated():", hasToken);

    if (!hasToken) {
      console.log("❌ No token found, redirecting to /landing");
      window.location.href = "/landing";
      return;
    }

    const userData = getUser();
    console.log("👤 User data:", userData);

    if (userData) {
      setUser(userData);
    }
  };

  const loadData = async () => {
    if (!isAuthenticated()) return;

    try {
      // Try to load balance
      try {
        console.log("📊 Loading balance...");
        const balanceRes = await authenticatedFetch(`${API_BASE}/api/user/balance`);
        console.log("📊 Balance response:", balanceRes.status);
        const balanceData = await balanceRes.json();
        if (balanceRes.ok) {
          setBalance(balanceData.balance || 0);
          setReserved(balanceData.reserved || 0);
          setAvailable(balanceData.available || balanceData.balance || 0);
        } else {
          console.error("❌ Balance API error:", balanceData);
        }
      } catch (error) {
        console.error("❌ Failed to load balance:", error);
      }

      // Try to load history
      try {
        console.log("📜 Loading history...");
        const historyRes = await authenticatedFetch(`${API_BASE}/api/user/history`);
        console.log("📜 History response:", historyRes.status);
        const historyData = await historyRes.json();
        if (historyRes.ok) {
          setHistory(historyData.submissions.slice(0, 5));
        } else {
          console.error("❌ History API error:", historyData);
        }
      } catch (error) {
        console.error("❌ Failed to load history:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadWaitingCounts = async () => {
    if (!isAuthenticated()) return;

    try {
      const response = await authenticatedFetch(`${API_BASE}/api/tasks/waiting-count`);
      const data = await response.json();
      if (response.ok) {
        setWaitingCounts(data.waitingCounts);
      }
    } catch (error) {
      console.error("Failed to load waiting counts:", error);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleAcceptJob = () => {
    if (!selectedPrice) {
      alert("Please select a price first");
      return;
    }
    if (balance < selectedPrice) {
      alert(
        `Insufficient balance. You need at least $${selectedPrice.toFixed(
          2,
        )} to accept this job.`,
      );
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmAcceptJob = async () => {
    setLoading(true);

    try {
      const response = await authenticatedFetch(`${API_BASE}/api/tasks/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceUsd: selectedPrice }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to accept job");
      }

      window.location.href = `/task?id=${data.taskSetId}&price=${data.priceUsd}`;
    } catch (error) {
      alert(error.message);
      setLoading(false);
      setShowConfirmModal(false);
    }
  };

  const handleAddFunds = async () => {
    if (addFundsAmount < 1 || addFundsAmount > 500) {
      alert("Amount must be between $1 and $500");
      return;
    }

    setProcessingPayment(true);

    try {
      console.log("💳 Creating PayPal order for:", addFundsAmount);

      // Create PayPal order
      const orderRes = await authenticatedFetch(`${API_BASE}/api/paypal/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: addFundsAmount }),
      });

      const orderData = await orderRes.json();
      console.log("📦 PayPal order response:", orderData);

      if (!orderRes.ok) {
        throw new Error(orderData.error || "Failed to create order");
      }

      // Redirect to PayPal for approval
      const approveUrl = orderData.links?.find(
        (link) => link.rel === "approve",
      )?.href;

      console.log("🔗 Approve URL:", approveUrl);

      if (!approveUrl) {
        console.error("Full order data:", JSON.stringify(orderData, null, 2));
        throw new Error("PayPal approval URL not found");
      }

      // Open PayPal in a new tab
      console.log("➡️ Opening PayPal in new tab...");
      const paypalWindow = window.open(approveUrl, "_blank");

      if (!paypalWindow) {
        alert(
          "Please allow popups to complete PayPal payment. Then click 'Add Funds' again.",
        );
        setProcessingPayment(false);
        return;
      }

      // Close modal and show instructions
      setShowAddFundsModal(false);
      setProcessingPayment(false);
      alert(
        "✅ PayPal opened in new tab!\n\n1. Complete payment in the PayPal tab\n2. You'll be redirected back automatically",
      );
    } catch (error) {
      console.error("❌ Add funds error:", error);
      alert(`Error: ${error.message}`);
      setProcessingPayment(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);

    if (!amount || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (amount > available) {
      alert(
        `Insufficient available balance. You have $${available.toFixed(2)} available.`,
      );
      return;
    }

    if (!paypalEmail || !paypalEmail.includes("@")) {
      alert("Please enter a valid PayPal email address");
      return;
    }

    setProcessingWithdraw(true);

    try {
      const response = await authenticatedFetch(`${API_BASE}/api/paypal/payout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          paypalEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process withdrawal");
      }

      alert(
        `Withdrawal request submitted! Status: ${data.status}\n\nYour funds have been reserved and will be sent to ${paypalEmail} once PayPal confirms the payout.`,
      );
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setPaypalEmail("");
      loadData(); // Reload balance
    } catch (error) {
      console.error("Withdraw error:", error);
      alert(error.message);
    } finally {
      setProcessingWithdraw(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-white font-inter flex items-center justify-center">
        <div className="text-[14px] text-[#7A7A7A]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="border-b border-[#EDEDED]">
        <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full"></div>
            <span className="text-[16px] font-semibold text-[#2B2B2B]">
              Task Dash
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/admin"
              className="text-[13px] text-[#7A7A7A] hover:text-[#2B2B2B]"
            >
              Admin
            </a>
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

      <div className="max-w-[800px] mx-auto px-6 py-8">
        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              <div className="text-[13px] text-[#7A7A7A] mb-1">
                Current Balance
              </div>
              <div className="text-[32px] font-semibold text-[#2B2B2B]">
                ${available.toFixed(2)}
              </div>
              {reserved > 0 && (
                <div className="text-[12px] text-[#F59E0B] mt-1">
                  ${reserved.toFixed(2)} reserved (withdrawal pending)
                </div>
              )}
              <div className="text-[12px] text-[#7A7A7A] mt-1">
                Level {user?.level || 1} (Max: ${user?.level || 1})
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowAddFundsModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white text-[13px] font-semibold rounded-lg hover:bg-[#059669]"
              >
                <Plus size={16} />
                Add Funds
              </button>
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E5E5] text-[#2B2B2B] text-[13px] font-semibold rounded-lg hover:border-[#2563FF]"
              >
                Withdraw
              </button>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-[14px] font-medium text-[#2B2B2B] mb-3">
              Select Task Price
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from(
                { length: Math.min(user?.level || 1, 20) },
                (_, i) => i + 1,
              ).map((price) => {
                const waiting = waitingCounts[price] || 0;
                return (
                  <button
                    key={price}
                    onClick={() => setSelectedPrice(price)}
                    disabled={balance < price}
                    className={`h-[60px] rounded-lg text-[18px] font-semibold transition-all relative ${
                      selectedPrice === price
                        ? "bg-[#2563FF] text-white border-2 border-[#2563FF]"
                        : balance < price
                          ? "bg-[#F5F5F5] text-[#C3C3C3] border-2 border-[#E5E5E5] cursor-not-allowed"
                          : "bg-white text-[#2B2B2B] border-2 border-[#E5E5E5] hover:border-[#2563FF]"
                    }`}
                  >
                    ${price}
                    {waiting > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#10B981] rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">
                          {waiting}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {user?.level > 20 && (
              <div className="mt-3">
                <input
                  type="number"
                  min="1"
                  max={user.level}
                  value={selectedPrice > 20 ? selectedPrice : ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= user.level) {
                      setSelectedPrice(val);
                    }
                  }}
                  placeholder={`Enter $21 - $${user.level}`}
                  className="w-full h-[48px] px-4 border-2 border-[#E5E5E5] rounded-lg text-[16px] focus:border-[#2563FF] focus:outline-none"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleAcceptJob}
            disabled={!selectedPrice || balance < selectedPrice}
            className="w-full h-[56px] bg-[#2563FF] text-white text-[16px] font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1E40AF]"
          >
            {!selectedPrice
              ? "Select Price First"
              : waitingCounts[selectedPrice] > 0
                ? `Accept Job ($${selectedPrice.toFixed(2)}) - ${waitingCounts[selectedPrice]} waiting`
                : `Accept Job ($${selectedPrice.toFixed(2)})`}
          </button>

          {selectedPrice && balance < selectedPrice && (
            <p className="text-[12px] text-[#C33] text-center mt-3">
              Insufficient balance. Contact admin for more funds.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-[#F1F1F1] rounded-xl p-6 text-center">
            <Trophy size={24} className="text-[#2563FF] mx-auto mb-2" />
            <div className="text-[20px] font-semibold text-[#2B2B2B]">
              {history.filter((h) => h.result === "win").length}
            </div>
            <div className="text-[12px] text-[#7A7A7A]">Wins</div>
          </div>
          <div className="bg-white border border-[#F1F1F1] rounded-xl p-6 text-center">
            <Clock size={24} className="text-[#7A7A7A] mx-auto mb-2" />
            <div className="text-[20px] font-semibold text-[#2B2B2B]">
              {history.length}
            </div>
            <div className="text-[12px] text-[#7A7A7A]">Total Jobs</div>
          </div>
          <div className="bg-white border border-[#F1F1F1] rounded-xl p-6 text-center">
            <DollarSign size={24} className="text-[#10B981] mx-auto mb-2" />
            <div className="text-[20px] font-semibold text-[#2B2B2B]">
              {history.filter((h) => h.result === "win").length > 0
                ? `${(history.filter((h) => h.result === "win").length * 0.8).toFixed(1)}`
                : "0.0"}
            </div>
            <div className="text-[12px] text-[#7A7A7A]">Avg Profit</div>
          </div>
        </div>

        <div className="bg-white border border-[#F1F1F1] rounded-xl p-6 mb-6">
          <h2 className="text-[16px] font-semibold text-[#2B2B2B] mb-4">
            Recent Results
          </h2>

          {history.length === 0 ? (
            <p className="text-[13px] text-[#9B9B9B] text-center py-8">
              No completed jobs yet. Accept your first job to get started!
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-[#F6F6F6] pb-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        item.result === "win"
                          ? "bg-[#10B981]"
                          : item.result === "lose"
                            ? "bg-[#EF4444]"
                            : "bg-[#9B9B9B]"
                      }`}
                    ></div>
                    <div>
                      <div className="text-[13px] font-medium text-[#2B2B2B]">
                        {item.result === "win"
                          ? "Victory"
                          : item.result === "lose"
                            ? "Defeat"
                            : item.matched
                              ? "Tie"
                              : item.isCorrect
                                ? "Waiting..."
                                : "Failed"}
                      </div>
                      <div className="text-[12px] text-[#7A7A7A]">
                        {(item.timeMs / 1000).toFixed(2)}s
                      </div>
                    </div>
                  </div>
                  <div
                    className={`text-[13px] font-semibold ${
                      item.result === "win"
                        ? "text-[#10B981]"
                        : item.result === "lose"
                          ? "text-[#EF4444]"
                          : "text-[#7A7A7A]"
                    }`}
                  >
                    {item.result === "win"
                      ? "+$0.80"
                      : item.result === "lose"
                        ? "-$0.90"
                        : item.matched
                          ? "$0.00"
                          : "-$1.00"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <a
          href="/rules"
          className="w-full h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A] flex items-center justify-center gap-2 hover:border-[#2563FF] hover:text-[#2563FF]"
        >
          <BookOpen size={16} />
          How Task Dash Works
        </a>
      </div>

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 max-w-[400px] w-full">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-4">
              Add Funds via PayPal
            </h3>
            <p className="text-[13px] text-[#7A7A7A] mb-4">
              You'll be redirected to PayPal to complete the payment.
            </p>

            <div className="mb-6">
              <label className="text-[13px] font-medium text-[#2B2B2B] mb-2 block">
                Amount (USD)
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={addFundsAmount}
                onChange={(e) =>
                  setAddFundsAmount(parseFloat(e.target.value) || 1)
                }
                className="w-full h-[48px] px-4 border-2 border-[#E5E5E5] rounded-lg text-[16px] focus:border-[#2563FF] focus:outline-none"
              />
              <p className="text-[11px] text-[#9B9B9B] mt-1">
                Minimum: $1 | Maximum: $500
              </p>
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
                {processingPayment
                  ? "Processing..."
                  : `Add $${addFundsAmount.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 max-w-[400px] w-full">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-4">
              Withdraw to PayPal
            </h3>
            <p className="text-[13px] text-[#7A7A7A] mb-4">
              Available balance: <strong>${available.toFixed(2)}</strong>
            </p>

            <div className="mb-4">
              <label className="text-[13px] font-medium text-[#2B2B2B] mb-2 block">
                Amount (USD)
              </label>
              <input
                type="number"
                min="0.01"
                max={available}
                step="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full h-[48px] px-4 border-2 border-[#E5E5E5] rounded-lg text-[16px] focus:border-[#2563FF] focus:outline-none"
                placeholder="Enter amount"
              />
            </div>

            <div className="mb-6">
              <label className="text-[13px] font-medium text-[#2B2B2B] mb-2 block">
                PayPal Email
              </label>
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
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 max-w-[400px] w-full">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-4">
              Accept Job?
            </h3>
            <p className="text-[14px] text-[#7A7A7A] mb-6">
              Task price: <strong>${selectedPrice.toFixed(2)}</strong>
              <br />
              Your balance after:{" "}
              <strong>${(balance - selectedPrice).toFixed(2)}</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A]"
              >
                Cancel
              </button>
              <button
                onClick={confirmAcceptJob}
                className="flex-1 h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
