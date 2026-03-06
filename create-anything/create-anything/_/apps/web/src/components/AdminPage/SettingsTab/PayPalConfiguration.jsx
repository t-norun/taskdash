export function PayPalConfiguration({ paypalMode }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-6">
      <h3 className="text-[16px] font-semibold text-[#2B2B2B] mb-4">
        💳 PayPal Configuration
      </h3>

      {paypalMode ? (
        <div className="space-y-4">
          {/* Current Mode */}
          <div className="flex items-center justify-between p-4 bg-[#F8F9FA] rounded-lg border border-[#E5E5E5]">
            <div>
              <p className="text-[13px] text-[#7A7A7A]">Current Mode</p>
              <p className="text-[18px] font-bold text-[#2B2B2B] mt-1">
                {paypalMode.mode === "live"
                  ? "🔴 LIVE (Production)"
                  : "🟡 SANDBOX (Test)"}
              </p>
            </div>

            <div
              className={`px-4 py-2 rounded-lg font-bold text-[14px] ${
                paypalMode.mode === "live"
                  ? "bg-red-500/20 text-red-600"
                  : "bg-yellow-500/20 text-yellow-600"
              }`}
            >
              {String(paypalMode.mode || "").toUpperCase()}
            </div>
          </div>

          {/* Credentials Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#F8F9FA] rounded-lg border border-[#E5E5E5]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] font-medium text-[#2B2B2B]">
                  Sandbox Credentials
                </p>
                {paypalMode.sandboxConfigured ? (
                  <span className="text-[#10B981] text-[18px]">✓</span>
                ) : (
                  <span className="text-[#EF4444] text-[18px]">✕</span>
                )}
              </div>
              <p className="text-[12px] text-[#7A7A7A]">
                {paypalMode.sandboxConfigured ? "Configured" : "Not configured"}
              </p>
            </div>

            <div className="p-4 bg-[#F8F9FA] rounded-lg border border-[#E5E5E5]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] font-medium text-[#2B2B2B]">
                  Live Credentials
                </p>
                {paypalMode.liveConfigured ? (
                  <span className="text-[#10B981] text-[18px]">✓</span>
                ) : (
                  <span className="text-[#EF4444] text-[18px]">✕</span>
                )}
              </div>
              <p className="text-[12px] text-[#7A7A7A]">
                {paypalMode.liveConfigured ? "Configured" : "Not configured"}
              </p>
            </div>
          </div>

          {/* Environment Variable */}
          <div className="p-4 bg-[#F8F9FA] rounded-lg border border-[#E5E5E5]">
            <p className="text-[13px] text-[#7A7A7A] mb-2">
              Environment Variable
            </p>
            <code className="text-[14px] text-[#10B981] font-mono">
              PAYPAL_MODE = {paypalMode.currentEnvVar}
            </code>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-[14px] font-semibold text-blue-700 mb-3">
              📝 Environment Variables Setup
            </h4>
            <div className="space-y-2 text-[13px] text-[#2B2B2B]">
              <p className="font-medium">Required Variables:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-[#7A7A7A]">
                <li>
                  <code className="text-[#10B981] bg-white px-2 py-0.5 rounded">
                    PAYPAL_MODE
                  </code>{" "}
                  - &quot;sandbox&quot; or &quot;live&quot;
                </li>
                <li>
                  <code className="text-[#10B981] bg-white px-2 py-0.5 rounded">
                    PAYPAL_SANDBOX_CLIENT_ID
                  </code>{" "}
                  - Sandbox Client ID
                </li>
                <li>
                  <code className="text-[#10B981] bg-white px-2 py-0.5 rounded">
                    PAYPAL_SANDBOX_CLIENT_SECRET
                  </code>{" "}
                  - Sandbox Secret
                </li>
                <li>
                  <code className="text-[#10B981] bg-white px-2 py-0.5 rounded">
                    PAYPAL_LIVE_CLIENT_ID
                  </code>{" "}
                  - Live Client ID
                </li>
                <li>
                  <code className="text-[#10B981] bg-white px-2 py-0.5 rounded">
                    PAYPAL_LIVE_CLIENT_SECRET
                  </code>{" "}
                  - Live Secret
                </li>
              </ul>
            </div>
          </div>

          {/* Webhook Setup */}
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 className="text-[14px] font-semibold text-purple-700 mb-3">
              🔗 Webhook Configuration
            </h4>
            <div className="space-y-3 text-[13px]">
              <div>
                <p className="font-medium text-[#2B2B2B] mb-2">
                  Fixed Webhook URL:
                </p>
                <code className="block bg-white p-3 rounded border border-purple-200 text-[#10B981] break-all font-mono text-[12px]">
                  {(typeof window !== "undefined"
                    ? window.location.origin
                    : "https://your-app.created.app") + "/api/paypal/webhook"}
                </code>
              </div>

              <div>
                <p className="font-medium text-[#2B2B2B] mb-2">Setup Steps:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2 text-[#7A7A7A]">
                  <li>Go to PayPal Developer Dashboard</li>
                  <li>Navigate to &quot;Webhooks&quot; section</li>
                  <li>Create webhook with URL above</li>
                  <li>
                    Subscribe to events:
                    <ul className="list-disc list-inside ml-6 mt-1">
                      <li>CHECKOUT.ORDER.APPROVED</li>
                      <li>PAYMENT.CAPTURE.COMPLETED</li>
                      <li>PAYMENT.CAPTURE.DENIED</li>
                    </ul>
                  </li>
                  <li>Copy the Webhook ID</li>
                  <li>
                    Set environment variables:
                    <ul className="list-disc list-inside ml-6 mt-1">
                      <li>
                        <code className="text-[#10B981] bg-white px-2 py-0.5 rounded">
                          PAYPAL_SANDBOX_WEBHOOK_ID
                        </code>{" "}
                        (for sandbox)
                      </li>
                      <li>
                        <code className="text-[#10B981] bg-white px-2 py-0.5 rounded">
                          PAYPAL_LIVE_WEBHOOK_ID
                        </code>{" "}
                        (for live)
                      </li>
                    </ul>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[#7A7A7A]">Loading PayPal configuration...</p>
      )}
    </div>
  );
}
