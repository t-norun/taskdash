import sql from "../../utils/sql";
import { authenticateUser } from "../../utils/auth";

export async function POST(request) {
  try {
    const user = await authenticateUser(request);

    const { taskSetId, orderedNumbers, timeMs } = await request.json();

    if (!taskSetId || !orderedNumbers || !timeMs) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Get task set to verify correctness
    const taskSet = await sql`SELECT * FROM task_sets WHERE id = ${taskSetId}`;

    if (taskSet.length === 0) {
      return Response.json({ error: "Invalid task" }, { status: 404 });
    }

    const priceUsd = parseFloat(taskSet[0].price_usd);

    // Check correctness - numbers should be in descending order
    const correctOrder = [...taskSet[0].numbers].sort((a, b) => b - a);
    const isCorrect =
      JSON.stringify(orderedNumbers) === JSON.stringify(correctOrder);

    // Create submission
    const submission = await sql`
      INSERT INTO submissions (user_id, task_set_id, ordered_numbers, time_ms, is_correct)
      VALUES (${user.id}, ${taskSetId}, ${orderedNumbers}, ${timeMs}, ${isCorrect})
      RETURNING *
    `;

    // If incorrect, return immediately (no matching)
    if (!isCorrect) {
      return Response.json({
        submissionId: submission[0].id,
        isCorrect: false,
        timeMs,
        message: "Incorrect order. No payout.",
      });
    }

    // Use transaction with FOR UPDATE SKIP LOCKED to prevent race conditions
    const matchResult = await sql.transaction(async (txn) => {
      // Find an unmatched correct submission to pair with (with row-level lock)
      const unmatchedSubmission = await txn`
        SELECT * FROM submissions 
        WHERE task_set_id = ${taskSetId} 
        AND is_correct = true 
        AND matched = false 
        AND user_id != ${user.id}
        AND id != ${submission[0].id}
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `;

      if (unmatchedSubmission.length === 0) {
        // No match yet - waiting for opponent
        return null;
      }

      // Match found! Process the match
      const opponent = unmatchedSubmission[0];
      const currentSubmissionId = submission[0].id;

      // Determine winner
      let winnerId;
      let winnerSubmissionId;
      let loserId;

      if (timeMs < opponent.time_ms) {
        winnerId = user.id;
        winnerSubmissionId = currentSubmissionId;
        loserId = opponent.user_id;
      } else if (timeMs > opponent.time_ms) {
        winnerId = opponent.user_id;
        winnerSubmissionId = opponent.id;
        loserId = user.id;
      } else {
        // Tie - both get equal payout
        winnerId = null;
        winnerSubmissionId = null;
        loserId = null;
      }

      // Create match record
      const match = await txn`
        INSERT INTO matches (task_set_id, submission_a_id, submission_b_id, winner_submission_id)
        VALUES (${taskSetId}, ${currentSubmissionId}, ${opponent.id}, ${winnerSubmissionId})
        RETURNING *
      `;

      // Mark both submissions as matched
      await txn`
        UPDATE submissions 
        SET matched = true 
        WHERE id IN (${currentSubmissionId}, ${opponent.id})
      `;

      // Process payouts
      const winnerPayout = priceUsd * 1.8;
      const loserPayout = priceUsd * 0.1;
      const tiePayout = priceUsd * 0.95;

      if (winnerId === null) {
        // Tie - both get price * 0.95
        await txn`UPDATE users SET balance = balance + ${tiePayout} WHERE id IN (${user.id}, ${opponent.user_id})`;
        await txn`
          INSERT INTO ledger (user_id, type, amount, note, related_id)
          VALUES 
            (${user.id}, 'WIN', ${tiePayout}, 'Tie payout', ${match[0].id}),
            (${opponent.user_id}, 'WIN', ${tiePayout}, 'Tie payout', ${match[0].id})
        `;
      } else {
        // Winner gets price * 1.8, loser gets price * 0.1
        await txn`UPDATE users SET balance = balance + ${winnerPayout} WHERE id = ${winnerId}`;
        await txn`UPDATE users SET balance = balance + ${loserPayout} WHERE id = ${loserId}`;

        await txn`
          INSERT INTO ledger (user_id, type, amount, note, related_id)
          VALUES 
            (${winnerId}, 'WIN', ${winnerPayout}, 'Match win', ${match[0].id}),
            (${loserId}, 'LOSE', ${loserPayout}, 'Match loss', ${match[0].id})
        `;
      }

      return {
        matchId: match[0].id,
        opponentTime: opponent.time_ms,
        winnerId,
        winnerPayout,
        loserPayout,
        tiePayout,
      };
    });

    // If no match found, return waiting status
    if (matchResult === null) {
      return Response.json({
        submissionId: submission[0].id,
        isCorrect: true,
        timeMs,
        status: "waiting",
        message: "Waiting for opponent...",
      });
    }

    // Get updated user balance
    const updatedUser =
      await sql`SELECT balance FROM users WHERE id = ${user.id}`;

    return Response.json({
      submissionId: submission[0].id,
      isCorrect: true,
      timeMs,
      status: "matched",
      matchId: matchResult.matchId,
      opponentTime: matchResult.opponentTime,
      result:
        matchResult.winnerId === user.id
          ? "win"
          : matchResult.winnerId === null
            ? "tie"
            : "lose",
      payout:
        matchResult.winnerId === user.id
          ? matchResult.winnerPayout
          : matchResult.winnerId === null
            ? matchResult.tiePayout
            : matchResult.loserPayout,
      newBalance: parseFloat(updatedUser[0].balance),
    });
  } catch (error) {
    console.error("Submit task error:", error);
    return Response.json(
      { error: error.message || "Failed to submit task" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}
