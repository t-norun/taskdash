import sql from "../../utils/sql";
import { extractBearerToken, verifyAccessToken } from "../../utils/jwt";

/**
 * Bearer認証ミドルウェア
 * すべての認証が必要なAPIで使用
 */
export async function authenticateUser(request) {
  console.log("🔒 Server: authenticateUser called");

  const token = extractBearerToken(request);
  console.log("🔒 Server: Token extracted:", !!token);
  console.log("🔒 Server: Token preview:", token?.substring(0, 30) + "...");

  if (!token) {
    console.log("❌ Server: No token provided");
    throw new Error("Unauthorized - No token provided");
  }

  const payload = verifyAccessToken(token);
  console.log("🔒 Server: Token verification result:", !!payload);
  console.log("🔒 Server: Payload:", payload);

  if (!payload) {
    console.log("❌ Server: Invalid or expired token");
    throw new Error("Unauthorized - Invalid or expired token");
  }

  // DBからユーザー情報を取得
  const users = await sql`
    SELECT * FROM users WHERE id = ${payload.userId}
  `;

  console.log("🔒 Server: User found in DB:", users.length > 0);

  if (users.length === 0) {
    console.log("❌ Server: User not found in DB");
    throw new Error("User not found");
  }

  console.log("✅ Server: User authenticated successfully:", users[0].email);

  return users[0];
}
