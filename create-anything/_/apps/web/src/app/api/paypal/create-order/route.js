import sql from "../../utils/sql";
import { paypalRequest } from "#/app/api/paypal/utils/auth";
import { authenticateUser } from "../../utils/auth";

/**
 * ユーザー入金用のPayPal決済を作成
 */
export async function POST(request) {
  try {
    const user = await authenticateUser(request);

    const { amount } = await request.json();

    // 1) 金額を「cents」で確定（端数ブレ防止）
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 1 || amountNum > 500) {
      return Response.json(
        { error: "Amount must be between $1 and $500" },
        { status: 400 },
      );
    }

    const amountCents = Math.round(amountNum * 100);
    const amountUsd = amountCents / 100;

    console.log(`💰 Creating PayPal order for user ${user.id}, amount: $${amountUsd.toFixed(2)}`);

    // 2) APP_URL の取得（実際のリクエスト元を優先）
    let appUrl = process.env.APP_URL;

    if (!appUrl) {
      const origin = request.headers.get("origin");
      if (origin) {
        appUrl = origin;
        console.log(`✅ Using origin header as APP_URL: ${appUrl}`);
      } else {
        const host = request.headers.get("host");
        const protocol = request.headers.get("x-forwarded-proto") || "https";
        appUrl = `${protocol}://${host}`;
        console.log(`⚠️  APP_URL not set, using derived URL from host: ${appUrl}`);
      }
    } else {
      console.log(`✅ Using APP_URL from env: ${appUrl}`);
    }

    const returnUrl = `${appUrl}/paypal-success`;
    const cancelUrl = `${appUrl}/?cancelled=true`;

    // 3) PayPal order payload
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          // 追跡の要：後で webhook / 照合 / 二重処理防止に使える
          custom_id: `deposit:user:${user.id}:cents:${amountCents}`,
          amount: {
            currency_code: "USD",
            value: amountUsd.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };

    console.log("📤 PayPal order payload:");
    console.log(JSON.stringify(orderPayload, null, 2));

    // 4) PayPal Orderを作成
    const orderData = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify(orderPayload),
    });

    // 5) legacy DBには「PayPal取引ログ」だけ保存（残高は v2 が正）
    await sql`
      INSERT INTO paypal_transactions (
        user_id, order_id, amount, currency, status, transaction_type, raw_response
      ) VALUES (
        ${user.id},
        ${orderData.id},
        ${amountUsd},          -- 表示用USD
        'USD',
        'CREATED',
        'deposit',
        ${JSON.stringify(orderData)}
      )
    `;

    return Response.json({
      orderId: orderData.id,
      links: orderData.links,
      amount: amountUsd,      // UIが表示する用（任意）
    });
  } catch (error) {
    console.error("❌ Create PayPal order error:", error);
    return Response.json(
      { error: error.message || "Failed to create order" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}
