"use client";

import { useMemo, useState } from "react";
import { saveAuthSession } from "@/utils/auth";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "https://api.taskdash.net"
).replace(/\/+$/, "");

export default function LoginPage() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return "/";
    const sp = new URLSearchParams(window.location.search);
    return sp.get("redirect") || "/";
  }, []);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/jwt/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(email || "").trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to send code");
      }

      if (data?.devCode) {
        console.log("Development OTP Code:", data.devCode);
      }

      setStep("otp");
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/jwt/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(email || "").trim(),
          code: String(otp || "").trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to verify code");
      }

      if (!data?.accessToken) {
        throw new Error("verify-otp succeeded but accessToken is missing");
      }

      saveAuthSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        refreshTokenId: data.refreshTokenId,
        user: data.user,
      });

      console.log("LOGIN OK");
      console.log(
        "taskdash_access_token exists =",
        !!localStorage.getItem("taskdash_access_token")
      );
      console.log(
        "stored access token preview =",
        (localStorage.getItem("taskdash_access_token") || "").slice(0, 20) + "..."
      );

      window.location.replace(redirectTo);
    } catch (err) {
      setError(err?.message || String(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-inter flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="w-12 h-12 border-4 border-[#2563FF] rounded-full mx-auto mb-4" />
          <h1 className="text-[24px] font-semibold text-[#2B2B2B] mb-2">
            Task Dash
          </h1>
          <p className="text-[14px] text-[#7A7A7A]">
            Competitive task completion platform
          </p>
        </div>

        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8">
          {step === "email" ? (
            <form onSubmit={handleSendOTP}>
              <div className="mb-6">
                <label className="block text-[13px] font-medium text-[#2B2B2B] mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full h-[48px] px-4 border border-[#E5E5E5] rounded-lg text-[14px] outline-none focus:border-[#2563FF]"
                  required
                  autoComplete="email"
                />
              </div>

              {error ? (
                <div className="mb-4 p-3 bg-[#FEE] border border-[#FCC] rounded-lg text-[13px] text-[#C33]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-lg disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </button>

              <p className="text-[12px] text-[#9B9B9B] text-center mt-4">
                We&apos;ll send a 6-digit code to your email.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP}>
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => {
                    if (loading) return;
                    setStep("email");
                    setOtp("");
                    setError("");
                  }}
                  className="text-[13px] text-[#2563FF] mb-4"
                >
                  ← Change email
                </button>

                <p className="text-[13px] text-[#7A7A7A] mb-4">
                  Code sent to <strong>{email}</strong>
                </p>

                <p className="text-[11px] text-[#9B9B9B] mb-4">
                  Check your inbox and spam folder. If you don&apos;t receive the
                  code, please contact support.
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-[13px] font-medium text-[#2B2B2B] mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter 6-digit code"
                  className="w-full h-[48px] px-4 border border-[#E5E5E5] rounded-lg text-center font-mono text-[18px] tracking-widest outline-none focus:border-[#2563FF]"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                />
              </div>

              {error ? (
                <div className="mb-4 p-3 bg-[#FEE] border border-[#FCC] rounded-lg text-[13px] text-[#C33]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-lg disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </button>

              <p className="text-[12px] text-[#9B9B9B] text-center mt-4">
                Code expires in 10 minutes.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
