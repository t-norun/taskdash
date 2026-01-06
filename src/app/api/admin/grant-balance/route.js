import sql from "#/app/api/utils/sql";

export async function POST(request) {
  try {
    const { userId, amount } = await request.json();

    if (!userId || !amount) {
      return Response.json(
        { error: "User ID and amount required" },
        { status: 400 },
      );
    }

    // Update user balance
    await sql`UPDATE users SET balance = balance + ${amount} WHERE id = ${userId}`;

    // Record in ledger
    await sql`
      INSERT INTO ledger (user_id, type, amount, note)
      VALUES (${userId}, 'ADMIN_GRANT', ${amount}, 'Admin balance grant')
    `;

    // Get updated balance
    const user = await sql`SELECT balance FROM users WHERE id = ${userId}`;

    return Response.json({
      success: true,
      newBalance: parseFloat(user[0].balance),
    });
  } catch (error) {
    console.error("Grant balance error:", error);
    return Response.json({ error: "Failed to grant balance" }, { status: 500 });
  }
}
