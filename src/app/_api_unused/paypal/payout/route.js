import sql from "../../utils/sql";
import { paypalRequest } from "../utils/auth.js";
import { authenticateUser } from "../../utils/auth";

/**
 * ユーザーへのPayPal送金（報酬支払い）
 * 保留システム：Payout作成時はPENDINGでreserved_balanceに引き当て
 * Webhook受信時にCOMPLETED/FAILEDに更新して確定・解除
 */
export async function POST(request) {
  try {
    const user = await authenticateUser(request);

    const { amount, paypalEmail } = await request.json();

    if (!amount || amount <= 0) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!paypalEmail) {
      return Response.json({ error: "PayPal email required" }, { status: 400 });
    }

    // 利用可能残高を確認（balance - reserved_balance）
    const availableBalance =
      parseFloat(user.balance) - parseFloat(user.reserved_balance || 0);
    if (availableBalance < amount) {
      return Response.json(
        {
          error: "Insufficient balance",
          available: availableBalance.toFixed(2),
          requested: amount.toFixed(2),
        },
        { status: 400 },
      );
    }

    // PayPal Payoutsで送金
    const payoutData = await paypalRequest("/v1/payments/payouts", {
      method: "POST",
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: `payout_${user.id}_${Date.now()}`,
          email_subject: "Task Dash - Reward Payment",
          email_message: "You have received a payment from Task Dash!",
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: {
              value: amount.toFixed(2),
              currency: "USD",
            },
            receiver: paypalEmail,
            note: "Task Dash reward payout",
            sender_item_id: `user_${user.id}`,
          },
        ],
      }),
    });

    const payoutBatchId = payoutData.batch_header.payout_batch_id;

    // 保留残高を増やす（実際の残高はまだ減らさない）
    await sql`
      UPDATE users
      SET reserved_balance = reserved_balance + ${amount}
      WHERE id = ${user.id}
    `;

    // Ledgerに保留記録（Webhook確定待ち）
    await sql`
      INSERT INTO ledger (
        user_id, type, amount, 
        paypal_payout_id, note
      ) VALUES (
        ${user.id},
        'payout_reserved',
        ${-amount},
        ${payoutBatchId},
        ${"PayPal payout PENDING to " + paypalEmail}
      )
    `;

    // PayPal取引を保存（PENDING状態、payout_item_idはWebhookで更新）
    await sql`
      INSERT INTO paypal_transactions (
        user_id, payout_batch_id, amount, currency, 
        status, transaction_type, raw_response
      ) VALUES (
        ${user.id},
        ${payoutBatchId},
        ${amount},
        'USD',
        'PENDING',
        'payout',
        ${JSON.stringify(payoutData)}
      )
    `;

    return Response.json({
      success: true,
      payoutBatchId,
      amount,
      status: "PENDING",
      message:
        "Payout request submitted. Funds reserved pending PayPal confirmation.",
    });
  } catch (error) {
    console.error("PayPal payout error:", error);
    return Response.json(
      { error: error.message || "Failed to process payout" },
      { status: 500 },
    );
  }
}
