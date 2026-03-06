import crypto from "crypto";

/**
 * JWT署名・検証用のシークレットキー
 * 本番環境では環境変数から取得
 */
const JWT_SECRET =
  process.env.JWT_SECRET || "taskdash-secret-key-change-in-production";
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15分（秒単位）
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30日（秒単位）

/**
 * Base64URL エンコード
 */
function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * HMAC-SHA256署名を生成
 */
function sign(data, secret) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * JWTを生成
 * @param {Object} payload - トークンに含めるデータ
 * @param {number} expiresIn - 有効期限（秒単位）
 * @returns {string} JWT文字列
 */
export function generateToken(payload, expiresIn = ACCESS_TOKEN_EXPIRY) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const claims = {
    ...payload,
    iat: now, // issued at
    exp: now + expiresIn, // expiration
  };

  const headerEncoded = base64url(JSON.stringify(header));
  const payloadEncoded = base64url(JSON.stringify(claims));
  const signature = sign(`${headerEncoded}.${payloadEncoded}`, JWT_SECRET);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * JWTを検証してペイロードを返す
 * @param {string} token - JWT文字列
 * @returns {Object|null} ペイロード or null（無効な場合）
 */
export function verifyToken(token) {
  try {
    console.log("🔐 JWT: Verifying token...");

    const parts = token.split(".");
    if (parts.length !== 3) {
      console.log("❌ JWT: Invalid token format (not 3 parts)");
      return null;
    }

    const [headerEncoded, payloadEncoded, signature] = parts;
    const expectedSignature = sign(
      `${headerEncoded}.${payloadEncoded}`,
      JWT_SECRET,
    );

    // 署名検証
    if (signature !== expectedSignature) {
      console.log("❌ JWT: Signature mismatch");
      console.log("Expected:", expectedSignature.substring(0, 20) + "...");
      console.log("Received:", signature.substring(0, 20) + "...");
      return null;
    }

    console.log("✅ JWT: Signature valid");

    // ペイロードをデコード
    const payload = JSON.parse(
      Buffer.from(payloadEncoded, "base64url").toString("utf-8"),
    );

    console.log("🔐 JWT: Payload decoded:", payload);

    // 有効期限チェック
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.log("❌ JWT: Token expired");
      console.log("Current time:", now);
      console.log("Expiration:", payload.exp);
      console.log("Difference:", now - payload.exp, "seconds ago");
      return null; // 期限切れ
    }

    console.log("✅ JWT: Token is valid and not expired");

    return payload;
  } catch (error) {
    console.error("❌ JWT verification error:", error);
    return null;
  }
}

/**
 * Access Token を生成（15分有効）
 */
export function generateAccessToken(userId, email) {
  return generateToken(
    {
      userId,
      email,
      type: "access",
    },
    ACCESS_TOKEN_EXPIRY,
  );
}

/**
 * Refresh Token を生成（30日有効）
 */
export function generateRefreshToken(userId) {
  return generateToken(
    {
      userId,
      type: "refresh",
    },
    REFRESH_TOKEN_EXPIRY,
  );
}

/**
 * Authorizationヘッダーからトークンを抽出
 */
export function extractBearerToken(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Access Token を検証してユーザー情報を返す
 * @returns {Object|null} { userId, email } or null
 */
export function verifyAccessToken(token) {
  const payload = verifyToken(token);
  if (!payload || payload.type !== "access") {
    return null;
  }
  return {
    userId: payload.userId,
    email: payload.email,
  };
}

/**
 * Refresh Token を検証してユーザーIDを返す
 */
export function verifyRefreshToken(token) {
  const payload = verifyToken(token);
  if (!payload || payload.type !== "refresh") {
    return null;
  }
  return payload.userId;
}

/**
 * ランダムなRefresh Token IDを生成（DB保存用）
 */
export function generateRefreshTokenId() {
  return crypto.randomBytes(32).toString("hex");
}
