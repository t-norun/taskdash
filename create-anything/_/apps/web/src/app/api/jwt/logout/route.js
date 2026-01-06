import sql from "@/app/api/utils/sql";
import { extractBearerToken, verifyAccessToken } from "@/app/api/utils/jwt";

/**
 * ログアウト（Refresh Tokenを失効）
 * POST /api/auth/logout
 * Body: { refreshTokenId } (optional - 指定されたトークンのみ削除)
 * または全セッション削除
 */
export async function POST(request) {
  try {
    // Access Tokenからユーザー情報を取得
    const token = extractBearerToken(request);
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }

    const { refreshTokenId } = await request.json().catch(() => ({}));

    if (refreshTokenId) {
      // 特定のRefresh Tokenのみ削除（デバイス単位のログアウト）
      await sql`
        DELETE FROM sessions 
        WHERE token = ${refreshTokenId}
        AND user_id = ${payload.userId}
      `;
    } else {
      // 全セッションを削除（全デバイスからログアウト）
      await sql`
        DELETE FROM sessions 
        WHERE user_id = ${payload.userId}
      `;
    }

    return Response.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json({ error: "Failed to logout" }, { status: 500 });
  }
}
