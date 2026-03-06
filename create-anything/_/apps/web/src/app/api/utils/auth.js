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

  // legacy web ではDBが無いので、payload から擬似ユーザーを組み立てる
  // 期待: payload.userId（なければ payload.sub 等にフォールバック）
  const id = payload.userId ?? payload.sub ?? payload.uid ?? "dev";
  const email = payload.email ?? `${id}@local.dev`;

  const user = {
    id,
    email,
    // 必要なら適宜足す
    // name: payload.name,
    // roles: payload.roles,
  };

  console.log("✅ Server: User authenticated (no DB):", user.email);
  return user;
}
