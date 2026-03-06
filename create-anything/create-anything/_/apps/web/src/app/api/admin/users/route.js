import sql from "../../utils/sql";

// 邂｡逅・・ｨｩ髯舌メ繧ｧ繝・け
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

    // 繝ｦ繝ｼ繧ｶ繝ｼ邨ｱ險・
    const totalUsers = await sql`
      SELECT COUNT(*) as count FROM users
    `;

    // 豁｣遲皮紫蛻・ｸ・
    const accuracyDistribution = await sql`
      SELECT 
        CASE 
          WHEN accuracy_rate < 50 THEN '0-50%'
          WHEN accuracy_rate < 70 THEN '50-70%'
          WHEN accuracy_rate < 85 THEN '70-85%'
          WHEN accuracy_rate < 95 THEN '85-95%'
          ELSE '95-100%'
        END as range,
        COUNT(*) as count
      FROM users
      WHERE completed_tasks > 0
      GROUP BY range
      ORDER BY range
    `;

    // 繝ｬ繝吶Ν蛻・ｸ・
    const levelDistribution = await sql`
      SELECT level, COUNT(*) as count
      FROM users
      GROUP BY level
      ORDER BY level
    `;

    // 荳肴ｭ｣逍代＞繝ｦ繝ｼ繧ｶ繝ｼ
    const suspiciousUsers = await sql`
      SELECT 
        id, email, display_name, 
        completed_tasks, accuracy_rate, 
        avg_time_ms, suspicious_flag,
        last_ip, device_id
      FROM users
      WHERE suspicious_flag = true
      ORDER BY last_login_at DESC
      LIMIT 50
    `;

    // 繧ｿ繧､繝蛻・ｸ・
    const timeStats = await sql`
      SELECT 
        AVG(avg_time_ms) as mean,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY avg_time_ms) as median,
        MIN(avg_time_ms) as min,
        MAX(avg_time_ms) as max
      FROM users
      WHERE completed_tasks > 0
    `;

    // 繝ｪ繝斐・繝育紫・・蝗樔ｻ･荳雁女豕ｨ縺励◆繝ｦ繝ｼ繧ｶ繝ｼ・・
    const repeatUsers = await sql`
      SELECT COUNT(*) as count
      FROM users
      WHERE completed_tasks >= 2
    `;

    const repeatRate =
      totalUsers[0].count > 0
        ? (repeatUsers[0].count / totalUsers[0].count) * 100
        : 0;

    // 蜿玲ｳｨ邇・ｼ医ち繧ｹ繧ｯ蜿玲ｳｨ/邱上Θ繝ｼ繧ｶ繝ｼ・・
    const taskAcceptance = await sql`
      SELECT COUNT(*) as count
      FROM users
      WHERE completed_tasks > 0
    `;

    const acceptanceRate =
      totalUsers[0].count > 0
        ? (taskAcceptance[0].count / totalUsers[0].count) * 100
        : 0;

    // 譛霑代い繧ｯ繝・ぅ繝悶↑繝ｦ繝ｼ繧ｶ繝ｼ・井ｸ贋ｽ・0蜷搾ｼ・
    const activeUsers = await sql`
      SELECT 
        id, email, display_name,
        level, completed_tasks, correct_tasks,
        accuracy_rate, avg_time_ms,
        last_login_at
      FROM users
      ORDER BY last_login_at DESC
      LIMIT 20
    `;

    return Response.json({
      summary: {
        totalUsers: parseInt(totalUsers[0].count),
        repeatRate: parseFloat(repeatRate.toFixed(2)),
        acceptanceRate: parseFloat(acceptanceRate.toFixed(2)),
      },
      distribution: {
        accuracy: accuracyDistribution.map((d) => ({
          range: d.range,
          count: parseInt(d.count),
        })),
        level: levelDistribution.map((d) => ({
          level: d.level,
          count: parseInt(d.count),
        })),
      },
      timeStats: {
        mean: timeStats[0].mean ? parseFloat(timeStats[0].mean) : 0,
        median: timeStats[0].median ? parseFloat(timeStats[0].median) : 0,
        min: timeStats[0].min ? parseFloat(timeStats[0].min) : 0,
        max: timeStats[0].max ? parseFloat(timeStats[0].max) : 0,
      },
      suspiciousUsers: suspiciousUsers.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        completedTasks: u.completed_tasks,
        accuracyRate: parseFloat(u.accuracy_rate || 0),
        avgTimeMs: u.avg_time_ms,
        lastIp: u.last_ip,
        deviceId: u.device_id,
      })),
      activeUsers: activeUsers.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        level: u.level,
        completedTasks: u.completed_tasks,
        correctTasks: u.correct_tasks,
        accuracyRate: parseFloat(u.accuracy_rate || 0),
        avgTimeMs: u.avg_time_ms,
        lastLoginAt: u.last_login_at,
      })),
    });
  } catch (error) {
    console.error("User analytics error:", error);
    return Response.json(
      { error: "Failed to fetch user analytics" },
      { status: 500 },
    );
  }
}

