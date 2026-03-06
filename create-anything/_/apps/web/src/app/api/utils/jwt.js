import crypto from "crypto";

/**
 * JWT鄂ｲ蜷阪・讀懆ｨｼ逕ｨ縺ｮ繧ｷ繝ｼ繧ｯ繝ｬ繝・ヨ繧ｭ繝ｼ
 * 譛ｬ逡ｪ迺ｰ蠅・〒縺ｯ迺ｰ蠅・､画焚縺九ｉ蜿門ｾ・
 */
const JWT_SECRET =
  process.env.JWT_SECRET || "taskdash-secret-key-change-in-production";
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15蛻・ｼ育ｧ貞腰菴搾ｼ・
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30譌･・育ｧ貞腰菴搾ｼ・

/**
 * Base64URL 繧ｨ繝ｳ繧ｳ繝ｼ繝・
 */
function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * HMAC-SHA256鄂ｲ蜷阪ｒ逕滓・
 */
function sign(data, secret) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * JWT繧堤函謌・
 * @param {Object} payload - 繝医・繧ｯ繝ｳ縺ｫ蜷ｫ繧√ｋ繝・・繧ｿ
 * @param {number} expiresIn - 譛牙柑譛滄剞・育ｧ貞腰菴搾ｼ・
 * @returns {string} JWT譁・ｭ怜・
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
 * JWT繧呈､懆ｨｼ縺励※繝壹う繝ｭ繝ｼ繝峨ｒ霑斐☆
 * @param {string} token - JWT譁・ｭ怜・
 * @returns {Object|null} 繝壹う繝ｭ繝ｼ繝・or null・育┌蜉ｹ縺ｪ蝣ｴ蜷茨ｼ・
 */
export function verifyToken(token) {
  try {
    console.log("柏 JWT: Verifying token...");

    const parts = token.split(".");
    if (parts.length !== 3) {
      console.log("笶・JWT: Invalid token format (not 3 parts)");
      return null;
    }

    const [headerEncoded, payloadEncoded, signature] = parts;
    const expectedSignature = sign(
      `${headerEncoded}.${payloadEncoded}`,
      JWT_SECRET,
    );

    // 鄂ｲ蜷肴､懆ｨｼ
    if (signature !== expectedSignature) {
      console.log("笶・JWT: Signature mismatch");
      console.log("Expected:", expectedSignature.substring(0, 20) + "...");
      console.log("Received:", signature.substring(0, 20) + "...");
      return null;
    }

    console.log("笨・JWT: Signature valid");

    // 繝壹う繝ｭ繝ｼ繝峨ｒ繝・さ繝ｼ繝・
    const payload = JSON.parse(
      Buffer.from(payloadEncoded, "base64url").toString("utf-8"),
    );

    console.log("柏 JWT: Payload decoded:", payload);

    // 譛牙柑譛滄剞繝√ぉ繝・け
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.log("笶・JWT: Token expired");
      console.log("Current time:", now);
      console.log("Expiration:", payload.exp);
      console.log("Difference:", now - payload.exp, "seconds ago");
      return null; // 譛滄剞蛻・ｌ
    }

    console.log("笨・JWT: Token is valid and not expired");

    return payload;
  } catch (error) {
    console.error("笶・JWT verification error:", error);
    return null;
  }
}

/**
 * Access Token 繧堤函謌撰ｼ・5蛻・怏蜉ｹ・・
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
 * Refresh Token 繧堤函謌撰ｼ・0譌･譛牙柑・・
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
 * Authorization繝倥ャ繝繝ｼ縺九ｉ繝医・繧ｯ繝ｳ繧呈歓蜃ｺ
 */
export function extractBearerToken(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Access Token 繧呈､懆ｨｼ縺励※繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ繧定ｿ斐☆
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
 * Refresh Token 繧呈､懆ｨｼ縺励※繝ｦ繝ｼ繧ｶ繝ｼID繧定ｿ斐☆
 */
export function verifyRefreshToken(token) {
  const payload = verifyToken(token);
  if (!payload || payload.type !== "refresh") {
    return null;
  }
  return payload.userId;
}

/**
 * 繝ｩ繝ｳ繝繝縺ｪRefresh Token ID繧堤函謌撰ｼ・B菫晏ｭ倡畑・・
 */
export function generateRefreshTokenId() {
  return crypto.randomBytes(32).toString("hex");
}

