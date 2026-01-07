"use client";

import { useState } from "react";
import { apiFetch } from "../../utils/apiFetch";

export default function LoginPage() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/jwt/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send code");
      }

      // Development mode: log the code to console only
      if (data.devCode) {
        console.log(`🔐 Development OTP Code: ${data.devCode}`);
      }

      setStep("otp");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/jwt/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify code");
      }

      console.log("✅ OTP verified, storing tokens...");

      // Store JWT tokens
      localStorage.setItem("taskdash_access_token", data.accessToken);
      localStorage.setItem("taskdash_refresh_token", data.refreshToken);
      localStorage.setItem("taskdash_refresh_token_id", data.refreshTokenId);
      localStorage.setItem("taskdash_user", JSON.stringify(data.user));

      console.log("✅ Tokens stored successfully");
      console.log(
        "Access token:",
        localStorage.getItem("taskdash_access_token")?.substring(0, 20) + "...",
      );

      // Wait a moment for localStorage to fully persist, then redirect
      setTimeout(() => {
        console.log("✅ Redirecting to home page...");
        window.location.replace("/");
      }, 100);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-inter flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="w-12 h-12 border-4 border-[#2563FF] rounded-full mx-auto mb-4"></div>
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
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-[#FEE] border border-[#FCC] rounded-lg text-[13px] text-[#C33]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-lg disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </button>

              <p className="text-[12px] text-[#9B9B9B] text-center mt-4">
                We'll send a 6-digit code to your email
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP}>
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-[13px] text-[#2563FF] mb-4"
                >
                  ← Change email
                </button>
                <p className="text-[13px] text-[#7A7A7A] mb-4">
                  Code sent to <strong>{email}</strong>
                </p>
                <p className="text-[11px] text-[#9B9B9B] mb-4">
                  Check your inbox and spam folder. If you don't receive the
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
                  className="w-full h-[48px] px-4 border border-[#E5E5E5] rounded-lg text-[14px] text-center font-mono text-[18px] tracking-widest outline-none focus:border-[#2563FF]"
                  maxLength={6}
                  required
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-[#FEE] border border-[#FCC] rounded-lg text-[13px] text-[#C33]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-lg disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </button>

              <p className="text-[12px] text-[#9B9B9B] text-center mt-4">
                Code expires in 10 minutes
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
