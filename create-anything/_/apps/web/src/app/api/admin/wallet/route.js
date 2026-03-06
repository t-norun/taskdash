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

    // 驕句霧繧ｦ繧ｩ繝ｬ繝・ヨ谿矩ｫ假ｼ・縺､縺ｮ繧ｽ繝ｼ繧ｹ縺九ｉ髮・ｨ茨ｼ・
    // 1. platform_fee 繧ｫ繝ｩ繝・亥商縺・お繝ｳ繝医Μ・・
    // 2. user_id IS NULL AND type = 'PLATFORM_FEE'・域眠縺励＞繧ｨ繝ｳ繝医Μ・・
    const platformFees = await sql`
      SELECT 
        COALESCE(SUM(platform_fee), 0) as fees_from_column,
        COALESCE(SUM(CASE WHEN user_id IS NULL AND type = 'PLATFORM_FEE' THEN amount ELSE 0 END), 0) as fees_from_entries
      FROM ledger
    `;

    const totalFees =
      parseFloat(platformFees[0].fees_from_column) +
      parseFloat(platformFees[0].fees_from_entries);

    const withdrawals = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_withdrawn
      FROM platform_withdrawals
      WHERE status = 'completed'
    `;

    const currentBalance =
      totalFees - parseFloat(withdrawals[0].total_withdrawn);

    // 蜃ｺ驥大ｱ･豁ｴ
    const withdrawalHistory = await sql`
      SELECT * FROM platform_withdrawals
      ORDER BY requested_at DESC
      LIMIT 20
    `;

    return Response.json({
      balance: currentBalance,
      totalFees: totalFees,
      totalWithdrawn: parseFloat(withdrawals[0].total_withdrawn),
      withdrawals: withdrawalHistory.map((w) => ({
        id: w.id,
        amount: parseFloat(w.amount),
        status: w.status,
        requestedAt: w.requested_at,
        completedAt: w.completed_at,
        notes: w.notes,
        paypalBatchId: w.paypal_payout_batch_id,
      })),
    });
  } catch (error) {
    console.error("Wallet error:", error);
    return Response.json(
      { error: "Failed to fetch wallet info" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
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

    const { amount, notes } = await request.json();

    if (!amount || amount <= 0) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }

    // 迴ｾ蝨ｨ縺ｮ谿矩ｫ倥ｒ遒ｺ隱搾ｼ・縺､縺ｮ繧ｽ繝ｼ繧ｹ縺九ｉ髮・ｨ茨ｼ・
    const platformFees = await sql`
      SELECT 
        COALESCE(SUM(platform_fee), 0) as fees_from_column,
        COALESCE(SUM(CASE WHEN user_id IS NULL AND type = 'PLATFORM_FEE' THEN amount ELSE 0 END), 0) as fees_from_entries
      FROM ledger
    `;

    const totalFees =
      parseFloat(platformFees[0].fees_from_column) +
      parseFloat(platformFees[0].fees_from_entries);

    const withdrawals = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_withdrawn
      FROM platform_withdrawals
      WHERE status = 'completed'
    `;

    const currentBalance =
      totalFees - parseFloat(withdrawals[0].total_withdrawn);

    if (amount > currentBalance) {
      return Response.json(
        { error: "Insufficient platform balance" },
        { status: 400 },
      );
    }

    // 蜃ｺ驥醍筏隲九ｒ菴懈・
    const result = await sql`
      INSERT INTO platform_withdrawals (amount, notes)
      VALUES (${amount}, ${notes || null})
      RETURNING *
    `;

    return Response.json({
      success: true,
      withdrawal: {
        id: result[0].id,
        amount: parseFloat(result[0].amount),
        status: result[0].status,
        requestedAt: result[0].requested_at,
        notes: result[0].notes,
      },
    });
  } catch (error) {
    console.error("Withdrawal creation error:", error);
    return Response.json(
      { error: "Failed to create withdrawal" },
      { status: 500 },
    );
  }
}

