import sql from "../../utils/sql";
import {
  paypalRequest,
  getWebhookId,
  getPayPalMode,
} from "../utils/auth.js";

/**
 * PayPal Webhook署名を検証
 */
async function verifyWebhookSignature(request, event) {
  const webhookId = getWebhookId();
  const mode = getPayPalMode();

  // サンドボックスモードでは検証をスキップ可能（開発環境用）
  if (mode === "sandbox" && !webhookId) {
    console.warn(
      "Sandbox mode - no webhook ID configured, skipping signature verification",
    );
    return true;
  }

  // 本番モードまたはWebhook IDが設定されている場合は検証を実行
  if (!webhookId) {
    console.error(
      `PAYPAL_${mode.toUpperCase()}_WEBHOOK_ID not set - required for webhook verification`,
    );
    return false;
  }

  const transmissionId = request.headers.get("paypal-transmission-id");
  const transmissionTime = request.headers.get("paypal-transmission-time");
  const certUrl = request.headers.get("paypal-cert-url");
  const authAlgo = request.headers.get("paypal-auth-algo");
  const transmissionSig = request.headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !transmissionSig) {
    console.error("Missing webhook headers");
    return false;
  　}

  try {
    const verifyResponse = await paypalRequest(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: transmissionSig,
          webhook_id: webhookId,
          webhook_event: event,
        }),
      },
    );

    return verifyResponse.verification_status === "SUCCESS";
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return false;
  }
}

/**
 * PayPal Webhookイベントを受信
 *
 * 監視イベント：
 * - CHECKOUT.ORDER.APPROVED
 * - PAYMENT.CAPTURE.COMPLETED
 * - PAYMENT.CAPTURE.DENIED
 * - PAYMENT.PAYOUTS-ITEM.SUCCEEDED
 * - PAYMENT.PAYOUTS-ITEM.FAILED
 * - PAYMENT.PAYOUTS-ITEM.RETURNED
 * - PAYMENT.PAYOUTS-ITEM.BLOCKED
 */
export async function POST(request) {
  try {
    const event = await request.json();

    // Webhook署名を検証
    const isValid = await verifyWebhookSignature(request, event);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    console.log("PayPal webhook received:", event.event_type);

    // イベントタイプに応じた処理
    switch (event.event_type) {
      case "CHECKOUT.ORDER.APPROVED":
        await handleOrderApproved(event);
        break;

      case "PAYMENT.CAPTURE.COMPLETED":
        await handleCaptureCompleted(event);
        break;

      case "PAYMENT.CAPTURE.DENIED":
        await handleCaptureDenied(event);
        break;

      case "PAYMENT.PAYOUTS-ITEM.SUCCEEDED":
        await handlePayoutSucceeded(event);
        break;

      case "PAYMENT.PAYOUTS-ITEM.FAILED":
      case "PAYMENT.PAYOUTS-ITEM.RETURNED":
      case "PAYMENT.PAYOUTS-ITEM.BLOCKED":
        await handlePayoutFailed(event);
        break;

      default:
        console.log("Unhandled event type:", event.event_type);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

async function handleOrderApproved(event) {
  const orderId = event.resource.id;

  await sql`
    UPDATE paypal_transactions
    SET status = 'APPROVED'
    WHERE order_id = ${orderId}
  `;

  console.log(`Order ${orderId} approved`);
}

async function handleCaptureCompleted(event) {
  const captureId = event.resource.id;

  await sql`
    UPDATE paypal_transactions
    SET status = 'COMPLETED'
    WHERE capture_id = ${captureId}
  `;

  console.log(`Capture ${captureId} completed`);
}

async function handleCaptureDenied(event) {
  const captureId = event.resource.id;

  await sql`
    UPDATE paypal_transactions
    SET status = 'DENIED'
    WHERE capture_id = ${captureId}
  `;

  console.log(`Capture ${captureId} denied`);
}

/**
 * Payout成功時の処理
 * - 冪等性チェック（payout_item_idで重複検出）
 * - reserved_balanceとbalanceを確定減算
 * - ledgerに確定記録
 */
async function handlePayoutSucceeded(event) {
  const payoutItemId = event.resource.payout_item_id;
  const payoutBatchId = event.resource.payout_batch_id;
  const senderItemId = event.resource.sender_item_id;
  const amount = parseFloat(event.resource.payout_item.amount.value);

  // 冪等性チェック：既に処理済みか確認
  const existing = await sql`
    SELECT id FROM paypal_transactions
    WHERE payout_item_id = ${payoutItemId}
  `;

  if (existing.length > 0) {
    console.log(`Payout item ${payoutItemId} already processed (idempotent)`);
    return;
  }

  // sender_item_id から user_id を抽出（user_123 形式）
  const userIdMatch = senderItemId?.match(/^user_(\d+)$/);
  if (!userIdMatch) {
    console.error(`Invalid sender_item_id format: ${senderItemId}`);
    return;
  }
  const userId = parseInt(userIdMatch[1], 10);

  // 既存のPENDING取引を検索
  const transactions = await sql`
    SELECT * FROM paypal_transactions
    WHERE payout_batch_id = ${payoutBatchId}
    AND user_id = ${userId}
    AND status = 'PENDING'
    AND transaction_type = 'payout'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (transactions.length === 0) {
    console.error(
      `No pending payout found for batch ${payoutBatchId} user ${userId}`,
    );
    return;
  }

  const transaction = transactions[0];

  // トランザクションで確定処理
  await sql.transaction([
    // 1. paypal_transactionsを更新（payout_item_idを記録し、COMPLETEDに変更）
    sql`
      UPDATE paypal_transactions
      SET payout_item_id = ${payoutItemId},
          status = 'COMPLETED',
          raw_response = ${JSON.stringify(event.resource)}
      WHERE id = ${transaction.id}
    `,

    // 2. reserved_balanceを減らし、balanceを確定減算
    sql`
      UPDATE users
      SET reserved_balance = reserved_balance - ${amount},
          balance = balance - ${amount}
      WHERE id = ${userId}
    `,

    // 3. ledgerに確定記録
    sql`
      INSERT INTO ledger (
        user_id, type, amount,
        paypal_payout_id, note
      ) VALUES (
        ${userId},
        'payout_completed',
        ${-amount},
        ${payoutItemId},
        ${"PayPal payout COMPLETED - " + payoutBatchId}
      )
    `,
  ]);

  console.log(`Payout ${payoutItemId} succeeded for user ${userId}`);
}

/**
 * Payout失敗時の処理（FAILED/RETURNED/BLOCKED）
 * - reserved_balanceを解放（balanceは変更なし）
 * - ledgerに失敗記録
 */
async function handlePayoutFailed(event) {
  const payoutItemId = event.resource.payout_item_id;
  const payoutBatchId = event.resource.payout_batch_id;
  const senderItemId = event.resource.sender_item_id;
  const amount = parseFloat(event.resource.payout_item.amount.value);
  const failureReason = event.resource.payout_item_fee?.value || "Unknown";

  // 冪等性チェック
  const existing = await sql`
    SELECT id FROM paypal_transactions
    WHERE payout_item_id = ${payoutItemId}
  `;

  if (existing.length > 0) {
    console.log(`Payout item ${payoutItemId} already processed (idempotent)`);
    return;
  }

  // sender_item_id から user_id を抽出
  const userIdMatch = senderItemId?.match(/^user_(\d+)$/);
  if (!userIdMatch) {
    console.error(`Invalid sender_item_id format: ${senderItemId}`);
    return;
  }
  const userId = parseInt(userIdMatch[1], 10);

  // 既存のPENDING取引を検索
  const transactions = await sql`
    SELECT * FROM paypal_transactions
    WHERE payout_batch_id = ${payoutBatchId}
    AND user_id = ${userId}
    AND status = 'PENDING'
    AND transaction_type = 'payout'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (transactions.length === 0) {
    console.error(
      `No pending payout found for batch ${payoutBatchId} user ${userId}`,
    );
    return;
  }

  const transaction = transactions[0];

  // トランザクションで失敗処理
  await sql.transaction([
    // 1. paypal_transactionsを更新（FAILEDに変更）
    sql`
      UPDATE paypal_transactions
      SET payout_item_id = ${payoutItemId},
          status = 'FAILED',
          raw_response = ${JSON.stringify(event.resource)}
      WHERE id = ${transaction.id}
    `,

    // 2. reserved_balanceを解放（balanceは変更なし）
    sql`
      UPDATE users
      SET reserved_balance = reserved_balance - ${amount}
      WHERE id = ${userId}
    `,

    // 3. ledgerに失敗記録
    sql`
      INSERT INTO ledger (
        user_id, type, amount,
        paypal_payout_id, note
      ) VALUES (
        ${userId},
        'payout_failed',
        ${amount},
        ${payoutItemId},
        ${"PayPal payout FAILED - " + failureReason}
      )
    `,
  ]);

  console.log(
    `Payout ${payoutItemId} failed for user ${userId}: ${failureReason}`,
  );
}
