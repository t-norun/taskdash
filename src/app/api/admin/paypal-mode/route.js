import { getPayPalMode } from "#/app/api/paypal/utils/auth";
import sql from "#/app/api/utils/sql";

/**
 * 現在のPayPalモード取得（Admin用）
 */
export async function GET(request) {
  try {
    // Verify admin
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const sessions = await sql`
      SELECT u.* FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ${token}
      AND s.expires_at > NOW()
    `;

    if (
      sessions.length === 0 ||
      sessions[0].email !== "taskdash.llc@gmail.com"
    ) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const mode = getPayPalMode();

    return Response.json({
      mode,
      sandboxConfigured: !!(
        process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID
      ),
      liveConfigured: !!process.env.PAYPAL_LIVE_CLIENT_ID,
      currentEnvVar: process.env.PAYPAL_MODE || "sandbox (default)",
    });
  } catch (error) {
    console.error("Get PayPal mode error:", error);
    return Response.json({ error: "Failed to get mode" }, { status: 500 });
  }
}
