import sql from "#/app/api/utils/sql";
import {
  generateAccessToken,
  verifyRefreshToken,
  generateRefreshToken,
  generateRefreshTokenId,
} from "#/app/api/utils/jwt";

/**
 * Access Tokenをリフレッシュ
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

    // JWT検証
    const userId = verifyRefreshToken(refreshToken);
    if (!userId) {
      return Response.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 },
      );
    }

    // DB内のRefresh Tokenを確認
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

    // 新しいAccess Tokenを発行
    const newAccessToken = generateAccessToken(userId, session.email);

    // オプション: Refresh Tokenもローテーション（セキュリティ強化）
    const newRefreshToken = generateRefreshToken(userId);
    const newRefreshTokenId = generateRefreshTokenId();

    // 古いRefresh Tokenを削除し、新しいものを保存
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
