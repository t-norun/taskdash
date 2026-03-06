import sql from "../../utils/sql";
import {
  paypalRequest,
  getWebhookId,
  getPayPalMode,
} from "#/app/api/paypal/utils/auth";

/**
 * PayPal Webhook署名を検証
 */
async function verifyWebhookSignature(request, event) {
  const webhookId = getWebhookId();
  const mode = getPayPalMode();

  if (mode === "sandbox" && !webhookId) {
    console.warn("Sandbox mode - no webhook ID configured, skipping signature verification");
    return true;
  }

  if (!webhookId) {
    console.error(`PAYPAL_${mode.toUpperCase()}_WEBHOOK_ID not set - required for webhook verification`);
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

function safeJson(x) {
  try {
    return JSON.stringify(x);
  } catch {
    return "{}";
  }
}

/**
 * 重要：Webhookは「残高・台帳を動かさない」
 * - 入金は capture-order で v2へ冪等入金（captureId=transactionId）
 * - Webhookはログ/ステータス反映のみ
 */
export async function POST(request) {
  try {
    const event = await request.json();

    const isValid = await verifyWebhookSignature(request, event);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const eventId = event?.id;
    const eventType = event?.event_type;

    if (!eventId || !eventType) {
      return Response.json({ error: "Invalid event payload" }, { status: 400 });
    }

    // ---- 冪等：event.id を一度しか処理しない ----
    // paypal_webhook_events が無い場合は先にCREATEしてね
    const inserted = await sql`
      INSERT INTO paypal_webhook_events (id, event_type, resource_type, resource_id)
      VALUES (
        ${eventId},
        ${eventType},
        ${event?.resource_type ?? null},
        ${event?.resource?.id ?? null}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;

    if (inserted.length === 0) {
      // すでに処理済み
      return Response.json({ received: true, idempotent: true });
    }

    console.log("PayPal webhook received:", eventType);

    // ---- ステータス更新（ログ用途） ----
    switch (eventType) {
      case "CHECKOUT.ORDER.APPROVED": {
        const orderId = event.resource?.id;
        if (orderId) {
          await sql`
            UPDATE paypal_transactions
            SET status = 'APPROVED',
                raw_response = COALESCE(raw_response, '{}'::jsonb) || ${safeJson(event)}::jsonb
            WHERE order_id = ${orderId}
          `;
        }
        break;
      }

      case "PAYMENT.CAPTURE.COMPLETED": {
        const captureId = event.resource?.id;
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id;

        // ここでは「入金しない」。capture-order が v2入金の唯一の経路。
        if (captureId) {
          await sql`
            UPDATE paypal_transactions
            SET status = 'COMPLETED',
                capture_id = COALESCE(capture_id, ${captureId}),
                raw_response = COALESCE(raw_response, '{}'::jsonb) || ${safeJson(event)}::jsonb
            WHERE (capture_id = ${captureId})
               OR (${orderId ?? null} IS NOT NULL AND order_id = ${orderId ?? null})
          `;
        }
        break;
      }

      case "PAYMENT.CAPTURE.DENIED": {
        const captureId = event.resource?.id;
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
        await sql`
          UPDATE paypal_transactions
          SET status = 'DENIED',
              raw_response = COALESCE(raw_response, '{}'::jsonb) || ${safeJson(event)}::jsonb
          WHERE (${captureId ?? null} IS NOT NULL AND capture_id = ${captureId ?? null})
             OR (${orderId ?? null} IS NOT NULL AND order_id = ${orderId ?? null})
        `;
        break;
      }

      // payout 系：最短は「ログだけ」
      case "PAYMENT.PAYOUTS-ITEM.SUCCEEDED": {
        const payoutItemId = event.resource?.payout_item_id;
        const payoutBatchId = event.resource?.payout_batch_id;
        if (payoutItemId) {
          await sql`
            UPDATE paypal_transactions
            SET status = 'COMPLETED',
                payout_item_id = COALESCE(payout_item_id, ${payoutItemId}),
                raw_response = COALESCE(raw_response, '{}'::jsonb) || ${safeJson(event)}::jsonb
            WHERE payout_batch_id = ${payoutBatchId ?? null}
              AND transaction_type = 'payout'
              AND status IN ('PENDING','CREATED','APPROVED')
          `;
        }
        break;
      }

      case "PAYMENT.PAYOUTS-ITEM.FAILED":
      case "PAYMENT.PAYOUTS-ITEM.RETURNED":
      case "PAYMENT.PAYOUTS-ITEM.BLOCKED": {
        const payoutItemId = event.resource?.payout_item_id;
        const payoutBatchId = event.resource?.payout_batch_id;
        if (payoutItemId) {
          await sql`
            UPDATE paypal_transactions
            SET status = 'FAILED',
                payout_item_id = COALESCE(payout_item_id, ${payoutItemId}),
                raw_response = COALESCE(raw_response, '{}'::jsonb) || ${safeJson(event)}::jsonb
            WHERE payout_batch_id = ${payoutBatchId ?? null}
              AND transaction_type = 'payout'
              AND status IN ('PENDING','CREATED','APPROVED')
          `;
        }
        break;
      }

      default: {
        // 未対応イベントも raw_response に残す（あとで調査できる）
        // ただしどの transaction に紐づくか不明なら何もしない
        console.log("Unhandled event type:", eventType);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

