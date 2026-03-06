import sql from "../../utils/sql";
import { paypalRequest } from "#/app/api/paypal/utils/auth";
import { authenticateUser } from "../../utils/auth";

/**
 * 繝ｦ繝ｼ繧ｶ繝ｼ縺ｸ縺ｮPayPal騾・≡・亥ｱ驟ｬ謾ｯ謇輔＞・・
 * 菫晉蕗繧ｷ繧ｹ繝・Β・啀ayout菴懈・譎ゅ・PENDING縺ｧreserved_balance縺ｫ蠑輔″蠖薙※
 * Webhook蜿嶺ｿ｡譎ゅ↓COMPLETED/FAILED縺ｫ譖ｴ譁ｰ縺励※遒ｺ螳壹・隗｣髯､
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

    // 蛻ｩ逕ｨ蜿ｯ閭ｽ谿矩ｫ倥ｒ遒ｺ隱搾ｼ・alance - reserved_balance・・
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

    // PayPal Payouts縺ｧ騾・≡
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

    // 菫晉蕗谿矩ｫ倥ｒ蠅励ｄ縺呻ｼ亥ｮ滄圀縺ｮ谿矩ｫ倥・縺ｾ縺貂帙ｉ縺輔↑縺・ｼ・
    await sql`
      UPDATE users
      SET reserved_balance = reserved_balance + ${amount}
      WHERE id = ${user.id}
    `;

    // Ledger縺ｫ菫晉蕗險倬鹸・・ebhook遒ｺ螳壼ｾ・■・・
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

    // PayPal蜿門ｼ輔ｒ菫晏ｭ假ｼ・ENDING迥ｶ諷九｝ayout_item_id縺ｯWebhook縺ｧ譖ｴ譁ｰ・・
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

