import sql from "../../utils/sql";

export async function GET(request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    const url = new URL(request.url);
    const submissionId = url.searchParams.get("submissionId");

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!submissionId) {
      return Response.json({ error: "Missing submission ID" }, { status: 400 });
    }

    // Verify session
    const session = await sql`
      SELECT user_id FROM sessions 
      WHERE token = ${token} AND expires_at > NOW()
    `;

    if (session.length === 0) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = session[0].user_id;

    // Get submission
    const submission = await sql`
      SELECT s.*, ts.price_usd
      FROM submissions s
      JOIN task_sets ts ON ts.id = s.task_set_id
      WHERE s.id = ${submissionId} AND s.user_id = ${userId}
    `;

    if (submission.length === 0) {
      return Response.json({ error: "Submission not found" }, { status: 404 });
    }

    const sub = submission[0];

    // If still waiting
    if (!sub.matched) {
      // Check if timeout (older than 10 minutes)
      const createdAt = new Date(sub.created_at);
      const now = new Date();
      const minutesWaiting = (now - createdAt) / 1000 / 60;

      if (minutesWaiting > 10) {
        return Response.json({
          status: "timeout",
          message: "Match timeout - refund processed",
        });
      }

      return Response.json({
        status: "waiting",
        message: "Still waiting for opponent...",
        waitingTime: Math.floor(minutesWaiting * 60), // seconds
      });
    }

    // If matched, get match details
    const match = await sql`
      SELECT * FROM matches
      WHERE (submission_a_id = ${submissionId} OR submission_b_id = ${submissionId})
    `;

    if (match.length === 0) {
      return Response.json({ error: "Match data not found" }, { status: 404 });
    }

    const matchData = match[0];
    const isSubmissionA = matchData.submission_a_id === parseInt(submissionId);
    const opponentId = isSubmissionA
      ? matchData.submission_b_id
      : matchData.submission_a_id;

    // Get opponent submission
    const opponent = await sql`
      SELECT time_ms FROM submissions WHERE id = ${opponentId}
    `;

    const priceUsd = parseFloat(sub.price_usd);
    const winnerId = matchData.winner_submission_id === parseInt(submissionId);
    const isTie = matchData.winner_submission_id === null;

    const result = isTie ? "tie" : winnerId ? "win" : "lose";
    const payout = isTie
      ? priceUsd * 0.95
      : winnerId
        ? priceUsd * 1.8
        : priceUsd * 0.1;

    // Get updated balance
    const user = await sql`SELECT balance FROM users WHERE id = ${userId}`;

    return Response.json({
      status: "matched",
      result,
      payout,
      opponentTime: opponent[0]?.time_ms,
      yourTime: sub.time_ms,
      newBalance: parseFloat(user[0].balance),
    });
  } catch (error) {
    console.error("Check match error:", error);
    return Response.json(
      { error: "Failed to check match status" },
      { status: 500 },
    );
  }
}
