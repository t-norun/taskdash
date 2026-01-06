import sql from "@/app/api/utils/sql";
import { authenticateUser } from "@/app/api/utils/auth";

export async function GET(request) {
  try {
    const user = await authenticateUser(request);

    // Get recent submissions with match results
    const submissions = await sql`
      SELECT 
        s.id,
        s.time_ms,
        s.is_correct,
        s.matched,
        s.created_at,
        m.id as match_id,
        m.winner_submission_id,
        CASE 
          WHEN m.winner_submission_id = s.id THEN 'win'
          WHEN m.winner_submission_id IS NULL AND m.id IS NOT NULL THEN 'tie'
          WHEN m.id IS NOT NULL THEN 'lose'
          ELSE NULL
        END as result
      FROM submissions s
      LEFT JOIN matches m ON (m.submission_a_id = s.id OR m.submission_b_id = s.id)
      WHERE s.user_id = ${user.id}
      ORDER BY s.created_at DESC
      LIMIT 10
    `;

    // Get transaction history
    const transactions = await sql`
      SELECT * FROM ledger 
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return Response.json({
      submissions: submissions.map((s) => ({
        id: s.id,
        timeMs: s.time_ms,
        isCorrect: s.is_correct,
        matched: s.matched,
        result: s.result,
        createdAt: s.created_at,
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        note: t.note,
        createdAt: t.created_at,
      })),
    });
  } catch (error) {
    console.error("Get history error:", error);
    return Response.json(
      { error: error.message || "Unauthorized" },
      { status: 401 },
    );
  }
}
