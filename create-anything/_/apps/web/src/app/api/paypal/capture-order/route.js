import sql from "@/app/api/utils/sql";
import { paypalRequest } from "@/app/api/paypal/utils/auth";
import { authenticateUser } from "@/app/api/utils/auth";

/**
 * PayPal決済を確定し、ユーザー残高に追加
 */
export async function POST(request) {
  try {
    const user = await authenticateUser(request);

    const { orderId } = await request.json();

    console.log(
      `💵 Capturing PayPal order for user ${user.id}, orderId: ${orderId}`,
    );

    if (!orderId) {
      return Response.json({ error: "Order ID required" }, { status: 400 });
    }

    console.log(`📤 Sending capture request to PayPal for order ${orderId}`);

    // PayPalで決済を確定
    const captureData = await paypalRequest(
      `/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
      },
    );

    console.log(
      "📥 PayPal capture response:",
      JSON.stringify(captureData, null, 2),
    );

    // 決済金額を取得
    const captureAmount = parseFloat(
      captureData.purchase_units[0].payments.captures[0].amount.value,
    );
    const captureId = captureData.purchase_units[0].payments.captures[0].id;

    console.log(
      `💰 Capture amount: $${captureAmount}, captureId: ${captureId}`,
    );

    // トランザクション内で処理
    await sql.transaction([
      // ユーザー残高に追加
      sql`
        UPDATE users
        SET balance = balance + ${captureAmount}
        WHERE id = ${user.id}
      `,

      // Ledgerに入金記録
      sql`
        INSERT INTO ledger (
          user_id, type, amount, 
          paypal_order_id, paypal_capture_id, note
        ) VALUES (
          ${user.id},
          'deposit',
          ${captureAmount},
          ${orderId},
          ${captureId},
          'PayPal deposit - Balance added'
        )
      `,

      // PayPal取引を更新
      sql`
        UPDATE paypal_transactions
        SET 
          status = 'COMPLETED',
          capture_id = ${captureId},
          raw_response = ${JSON.stringify(captureData)}
        WHERE order_id = ${orderId}
      `,
    ]);

    console.log(
      `📊 Transaction completed, fetching updated balance for user ${user.id}`,
    );

    // 更新された残高を取得
    const [updatedUser] = await sql`
      SELECT balance, reserved_balance
      FROM users
      WHERE id = ${user.id}
    `;

    console.log(`✅ Capture successful! New balance: $${updatedUser.balance}`);

    return Response.json({
      success: true,
      captureId,
      amount: captureAmount,
      newBalance: parseFloat(updatedUser.balance),
    });
  } catch (error) {
    console.error("❌ Capture PayPal order error:", error);
    console.error("Error details:", error.message, error.stack);
    return Response.json(
      { error: error.message || "Failed to capture order" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}
