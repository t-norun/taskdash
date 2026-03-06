"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/utils/auth";

export default function PayPalSuccessPage() {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    console.log("識 PayPal Success page loaded");
    console.log("桃 Full URL:", window.location.href);

    // Get token from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    console.log("泊 Token from URL:", token);
    console.log(
      "搭 All query params:",
      Object.fromEntries(urlParams.entries()),
    );

    if (!token) {
      console.error("笶・No token found in URL");
      setStatus("error");
      setMessage("Invalid payment link - no token found");
      return;
    }

    console.log(`笨・Token found: ${token}, starting capture...`);
    capturePayment(token);
  }, []);

  const capturePayment = async (orderId) => {
    try {
      console.log(`跳 Calling capture-order API with orderId: ${orderId}`);

      const response = await authenticatedFetch("/api/paypal/capture-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      console.log(`投 Capture API response status: ${response.status}`);

      const data = await response.json();
      console.log("逃 Capture API response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to capture payment");
      }

      console.log(`笨・Capture successful! Amount: $${data.amount}`);
      setStatus("success");
      setAmount(data.amount);
      setMessage(`$${data.amount.toFixed(2)} has been added to your balance!`);

      // Notify parent window if opened in new tab
      if (window.opener && !window.opener.closed) {
        console.log("討 Notifying parent window of payment success");
        window.opener.postMessage(
          {
            type: "PAYPAL_SUCCESS",
            amount: data.amount,
          },
          "*",
        );
      }

      // Redirect to home after 3 seconds
      setTimeout(() => {
        console.log("筐｡・・Redirecting to dashboard...");
        if (window.opener && !window.opener.closed) {
          // If opened in new tab, close this tab and focus parent
          window.opener.focus();
          window.close();
        } else {
          // Otherwise redirect normally
          window.location.href = "/";
        }
      }, 2000);
    } catch (error) {
      console.error("笶・Capture error:", error);
      setStatus("error");
      setMessage(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-white font-inter flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8 text-center">
          {status === "processing" && (
            <>
              <Loader2
                size={48}
                className="text-[#2563FF] mx-auto mb-4 animate-spin"
              />
              <h2 className="text-[18px] font-semibold text-[#2B2B2B] mb-2">
                Processing Payment...
              </h2>
              <p className="text-[13px] text-[#7A7A7A]">
                Please wait while we confirm your payment
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle size={48} className="text-[#10B981] mx-auto mb-4" />
              <h2 className="text-[18px] font-semibold text-[#2B2B2B] mb-2">
                Payment Successful!
              </h2>
              <p className="text-[13px] text-[#7A7A7A] mb-4">{message}</p>
              <div className="text-[24px] font-bold text-[#10B981] mb-4">
                +${amount.toFixed(2)}
              </div>
              <p className="text-[12px] text-[#9B9B9B]">
                Redirecting to dashboard...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle size={48} className="text-[#EF4444] mx-auto mb-4" />
              <h2 className="text-[18px] font-semibold text-[#2B2B2B] mb-2">
                Payment Failed
              </h2>
              <p className="text-[13px] text-[#7A7A7A] mb-6">{message}</p>
              <a
                href="/"
                className="inline-block w-full h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-lg flex items-center justify-center"
              >
                Return to Dashboard
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

