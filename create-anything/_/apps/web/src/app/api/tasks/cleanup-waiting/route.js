import sql from "@/app/api/utils/sql";

// Cleanup waiting submissions older than 10 minutes and refund users
export async function POST(request) {
  try {
    // Find all unmatched submissions older than 10 minutes
    const oldSubmissions = await sql`
      SELECT s.*, ts.price_usd
      FROM submissions s
      JOIN task_sets ts ON ts.id = s.task_set_id
      WHERE s.matched = false 
      AND s.is_correct = true
      AND s.created_at < NOW() - INTERVAL '10 minutes'
    `;

    if (oldSubmissions.length === 0) {
      return Response.json({
        message: "No submissions to cleanup",
        cleaned: 0,
      });
    }

    // Refund users and mark submissions as matched (to prevent future processing)
    await sql.transaction(async (txn) => {
      for (const submission of oldSubmissions) {
        const priceUsd = parseFloat(submission.price_usd);

        // Refund the user
        await txn`
          UPDATE users 
          SET balance = balance + ${priceUsd}
          WHERE id = ${submission.user_id}
        `;

        // Log refund in ledger
        await txn`
          INSERT INTO ledger (user_id, type, amount, note, related_id)
          VALUES (${submission.user_id}, 'REFUND', ${priceUsd}, 'Timeout refund - no opponent found', ${submission.id})
        `;

        // Mark as matched to prevent future processing
        await txn`
          UPDATE submissions 
          SET matched = true
          WHERE id = ${submission.id}
        `;
      }
    });

    return Response.json({
      message: `Cleaned up ${oldSubmissions.length} waiting submissions`,
      cleaned: oldSubmissions.length,
    });
  } catch (error) {
    console.error("Cleanup waiting error:", error);
    return Response.json(
      { error: "Failed to cleanup waiting submissions" },
      { status: 500 },
    );
  }
}
