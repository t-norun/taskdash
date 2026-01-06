import sql from "#/app/api/utils/sql";
import { authenticateUser } from "#/app/api/utils/auth";

export async function GET(request) {
  try {
    const user = await authenticateUser(request);

    const totalBalance = parseFloat(user.balance);
    const reservedBalance = parseFloat(user.reserved_balance || 0);
    const availableBalance = totalBalance - reservedBalance;

    return Response.json({
      balance: totalBalance,
      reserved: reservedBalance,
      available: availableBalance,
    });
  } catch (error) {
    console.error("Get balance error:", error);
    return Response.json(
      { error: error.message || "Unauthorized" },
      { status: 401 },
    );
  }
}
