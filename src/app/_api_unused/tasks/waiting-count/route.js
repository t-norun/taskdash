import sql from "../../utils/sql";
import { authenticateUser } from "../../utils/auth";

export async function GET(request) {
  try {
    // JWT Bearer認証に統一
    await authenticateUser(request);

    // Get waiting count by price
    const waitingCounts = await sql`
      SELECT 
        ts.price_usd,
        COUNT(s.id) as waiting_count
      FROM task_sets ts
      LEFT JOIN submissions s ON s.task_set_id = ts.id
        AND s.is_correct = true
        AND s.matched = false
        AND s.created_at > NOW() - INTERVAL '10 minutes'
      WHERE ts.active_to > NOW()
      GROUP BY ts.price_usd
      ORDER BY ts.price_usd ASC
    `;

    // Convert to object for easy lookup
    const countsByPrice = {};
    waitingCounts.forEach((row) => {
      countsByPrice[parseFloat(row.price_usd)] = parseInt(row.waiting_count);
    });

    return Response.json({
      waitingCounts: countsByPrice,
    });
  } catch (error) {
    console.error("Waiting count error:", error);
    return Response.json(
      { error: error.message || "Failed to get waiting count" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}
