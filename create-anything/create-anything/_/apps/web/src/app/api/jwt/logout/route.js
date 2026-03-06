import sql from "../../utils/sql";
import { extractBearerToken, verifyAccessToken } from "../../utils/jwt";

/**
 * 繝ｭ繧ｰ繧｢繧ｦ繝茨ｼ・efresh Token繧貞､ｱ蜉ｹ・・
 * POST /api/auth/logout
 * Body: { refreshTokenId } (optional - 謖・ｮ壹＆繧後◆繝医・繧ｯ繝ｳ縺ｮ縺ｿ蜑企勁)
 * 縺ｾ縺溘・蜈ｨ繧ｻ繝・す繝ｧ繝ｳ蜑企勁
 */
export async function POST(request) {
  try {
    // Access Token縺九ｉ繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ繧貞叙蠕・
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
      // 迚ｹ螳壹・Refresh Token縺ｮ縺ｿ蜑企勁・医ョ繝舌う繧ｹ蜊倅ｽ阪・繝ｭ繧ｰ繧｢繧ｦ繝茨ｼ・
      await sql`
        DELETE FROM sessions 
        WHERE token = ${refreshTokenId}
        AND user_id = ${payload.userId}
      `;
    } else {
      // 蜈ｨ繧ｻ繝・す繝ｧ繝ｳ繧貞炎髯､・亥・繝・ヰ繧､繧ｹ縺九ｉ繝ｭ繧ｰ繧｢繧ｦ繝茨ｼ・
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

