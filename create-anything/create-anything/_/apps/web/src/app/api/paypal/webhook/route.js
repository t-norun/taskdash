import sql from "../../utils/sql";
import {
  paypalRequest,
  getWebhookId,
  getPayPalMode,
} from "#/app/api/paypal/utils/auth";

/**
 * PayPal Webhook鄂ｲ蜷阪ｒ讀懆ｨｼ
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
 * 驥崎ｦ・ｼ啗ebhook縺ｯ縲梧ｮ矩ｫ倥・蜿ｰ蟶ｳ繧貞虚縺九＆縺ｪ縺・・
 * - 蜈･驥代・ capture-order 縺ｧ v2縺ｸ蜀ｪ遲牙・驥托ｼ・aptureId=transactionId・・
 * - Webhook縺ｯ繝ｭ繧ｰ/繧ｹ繝・・繧ｿ繧ｹ蜿肴丐縺ｮ縺ｿ
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

    // ---- 蜀ｪ遲会ｼ啼vent.id 繧剃ｸ蠎ｦ縺励°蜃ｦ逅・＠縺ｪ縺・----
    // paypal_webhook_events 縺檎┌縺・ｴ蜷医・蜈医↓CREATE縺励※縺ｭ
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
      // 縺吶〒縺ｫ蜃ｦ逅・ｸ医∩
      return Response.json({ received: true, idempotent: true });
    }

    console.log("PayPal webhook received:", eventType);

    // ---- 繧ｹ繝・・繧ｿ繧ｹ譖ｴ譁ｰ・医Ο繧ｰ逕ｨ騾費ｼ・----
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

        // 縺薙％縺ｧ縺ｯ縲悟・驥代＠縺ｪ縺・阪Ｄapture-order 縺・v2蜈･驥代・蜚ｯ荳縺ｮ邨瑚ｷｯ縲・
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

      // payout 邉ｻ・壽怙遏ｭ縺ｯ縲後Ο繧ｰ縺縺代・
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
        // 譛ｪ蟇ｾ蠢懊う繝吶Φ繝医ｂ raw_response 縺ｫ谿九☆・医≠縺ｨ縺ｧ隱ｿ譟ｻ縺ｧ縺阪ｋ・・
        // 縺溘□縺励←縺ｮ transaction 縺ｫ邏舌▼縺上°荳肴・縺ｪ繧我ｽ輔ｂ縺励↑縺・
        console.log("Unhandled event type:", eventType);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}


