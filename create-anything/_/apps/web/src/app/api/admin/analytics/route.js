import sql from "@/app/api/utils/sql";

// 管理者権限チェック
function isAdmin(email) {
  return email === "taskdash.llc@gmail.com";
}

export async function GET(request) {
  try {
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

    if (sessions.length === 0) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }

    const user = sessions[0];
    if (!isAdmin(user.email)) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    // 今日の範囲
    const today = await sql`
      SELECT 
        COUNT(DISTINCT id) as transactions,
        COALESCE(SUM(ABS(amount)), 0) as volume,
        COALESCE(SUM(platform_fee), 0) as platform_revenue
      FROM ledger
      WHERE created_at >= CURRENT_DATE
      AND type = 'task_fee'
    `;

    // 今週の範囲
    const thisWeek = await sql`
      SELECT 
        COUNT(DISTINCT id) as transactions,
        COALESCE(SUM(ABS(amount)), 0) as volume,
        COALESCE(SUM(platform_fee), 0) as platform_revenue
      FROM ledger
      WHERE created_at >= date_trunc('week', CURRENT_DATE)
      AND type = 'task_fee'
    `;

    // 今月の範囲
    const thisMonth = await sql`
      SELECT 
        COUNT(DISTINCT id) as transactions,
        COALESCE(SUM(ABS(amount)), 0) as volume,
        COALESCE(SUM(platform_fee), 0) as platform_revenue
      FROM ledger
      WHERE created_at >= date_trunc('month', CURRENT_DATE)
      AND type = 'task_fee'
    `;

    // 全期間
    const allTime = await sql`
      SELECT 
        COUNT(DISTINCT id) as transactions,
        COALESCE(SUM(ABS(amount)), 0) as volume,
        COALESCE(SUM(platform_fee), 0) as platform_revenue
      FROM ledger
      WHERE type = 'task_fee'
    `;

    // ユーザーへの総支払額（勝利報酬）
    const userPayouts = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) as total_user_payouts
      FROM ledger
      WHERE type = 'win'
    `;

    // アクティブユーザー
    const dau = await sql`
      SELECT COUNT(DISTINCT user_id) as count
      FROM sessions
      WHERE last_login_at >= CURRENT_DATE
    `;

    const wau = await sql`
      SELECT COUNT(DISTINCT user_id) as count
      FROM sessions
      WHERE last_login_at >= CURRENT_DATE - INTERVAL '7 days'
    `;

    const mau = await sql`
      SELECT COUNT(DISTINCT user_id) as count
      FROM sessions
      WHERE last_login_at >= CURRENT_DATE - INTERVAL '30 days'
    `;

    return Response.json({
      kpi: {
        today: {
          transactions: parseInt(today[0].transactions),
          volume: parseFloat(today[0].volume),
          platformRevenue: parseFloat(today[0].platform_revenue),
        },
        thisWeek: {
          transactions: parseInt(thisWeek[0].transactions),
          volume: parseFloat(thisWeek[0].volume),
          platformRevenue: parseFloat(thisWeek[0].platform_revenue),
        },
        thisMonth: {
          transactions: parseInt(thisMonth[0].transactions),
          volume: parseFloat(thisMonth[0].volume),
          platformRevenue: parseFloat(thisMonth[0].platform_revenue),
        },
        allTime: {
          transactions: parseInt(allTime[0].transactions),
          volume: parseFloat(allTime[0].volume),
          platformRevenue: parseFloat(allTime[0].platform_revenue),
          userPayouts: parseFloat(userPayouts[0].total_user_payouts),
        },
      },
      users: {
        dau: parseInt(dau[0].count),
        wau: parseInt(wau[0].count),
        mau: parseInt(mau[0].count),
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return Response.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
