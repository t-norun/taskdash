import sql from "../../utils/sql";
import {
  generateAccessToken,
  verifyRefreshToken,
  generateRefreshToken,
  generateRefreshTokenId,
} from "../../utils/jwt";

/**
 * Access Token繧偵Μ繝輔Ξ繝・す繝･
 * POST /api/auth/refresh
 * Body: { refreshToken, refreshTokenId }
 */
export async function POST(request) {
  try {
    const { refreshToken, refreshTokenId } = await request.json();

    if (!refreshToken || !refreshTokenId) {
      return Response.json(
        { error: "Refresh token required" },
        { status: 400 },
      );
    }

    // JWT讀懆ｨｼ
    const userId = verifyRefreshToken(refreshToken);
    if (!userId) {
      return Response.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 },
      );
    }

    // DB蜀・・Refresh Token繧堤｢ｺ隱・
    const sessions = await sql`
      SELECT s.*, u.email 
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ${refreshTokenId}
      AND s.user_id = ${userId}
      AND s.expires_at > NOW()
    `;

    if (sessions.length === 0) {
      return Response.json(
        { error: "Refresh token revoked or expired" },
        { status: 401 },
      );
    }

    const session = sessions[0];

    // 譁ｰ縺励＞Access Token繧堤匱陦・
    const newAccessToken = generateAccessToken(userId, session.email);

    // 繧ｪ繝励す繝ｧ繝ｳ: Refresh Token繧ゅΟ繝ｼ繝・・繧ｷ繝ｧ繝ｳ・医そ繧ｭ繝･繝ｪ繝・ぅ蠑ｷ蛹厄ｼ・
    const newRefreshToken = generateRefreshToken(userId);
    const newRefreshTokenId = generateRefreshTokenId();

    // 蜿､縺Сefresh Token繧貞炎髯､縺励∵眠縺励＞繧ゅ・繧剃ｿ晏ｭ・
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await sql.transaction([
      sql`DELETE FROM sessions WHERE token = ${refreshTokenId}`,
      sql`
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (${userId}, ${newRefreshTokenId}, ${expiresAt})
      `,
    ]);

    return Response.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      refreshTokenId: newRefreshTokenId,
      expiresIn: 900, // 15 minutes
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return Response.json({ error: "Failed to refresh token" }, { status: 500 });
  }
}

