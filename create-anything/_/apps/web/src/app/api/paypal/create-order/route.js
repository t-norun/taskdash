import sql from "#/app/api/utils/sql";
import { paypalRequest } from "#/app/api/paypal/utils/auth";
import { authenticateUser } from "#/app/api/utils/auth";

/**
 * ユーザー入金用のPayPal決済を作成
 */
export async function POST(request) {
  try {
    const user = await authenticateUser(request);

    const { amount } = await request.json();

    console.log(
      `💰 Creating PayPal order for user ${user.id}, amount: $${amount}`,
    );

    if (!amount || amount < 1 || amount > 500) {
      return Response.json(
        { error: "Amount must be between $1 and $500" },
        { status: 400 },
      );
    }

    // APP_URL の取得（実際のリクエスト元を優先）
    let appUrl = process.env.APP_URL;

    if (!appUrl) {
      // origin ヘッダー（実際のUIドメイン）を最優先
      const origin = request.headers.get("origin");
      if (origin) {
        appUrl = origin;
        console.log(`✅ Using origin header as APP_URL: ${appUrl}`);
      } else {
        // fallback: host から構築
        const host = request.headers.get("host");
        const protocol = request.headers.get("x-forwarded-proto") || "https";
        appUrl = `${protocol}://${host}`;
        console.log(
          `⚠️  APP_URL not set, using derived URL from host: ${appUrl}`,
        );
      }
    } else {
      console.log(`✅ Using APP_URL from env: ${appUrl}`);
    }

    // 確実に return/cancel URL を構築
    const returnUrl = `${appUrl}/paypal-success`;
    const cancelUrl = `${appUrl}/?cancelled=true`;

    console.log(`🔗 Return URL: ${returnUrl}`);
    console.log(`🔗 Cancel URL: ${cancelUrl}`);

    // PayPal v2 Orders API に従った最小構成
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: String(amount.toFixed(2)),
          },
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };

    console.log("📤 PayPal order payload (stringified):");
    console.log(JSON.stringify(orderPayload, null, 2));

    // PayPal Orderを作成
    const orderData = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify(orderPayload),
    });

    console.log(
      "📥 PayPal order response:",
      JSON.stringify(orderData, null, 2),
    );

    // PayPal取引をDBに保存（pending状態）
    await sql`
      INSERT INTO paypal_transactions (
        user_id, order_id, amount, currency, status, transaction_type, raw_response
      ) VALUES (
        ${user.id},
        ${orderData.id},
        ${amount},
        'USD',
        'CREATED',
        'deposit',
        ${JSON.stringify(orderData)}
      )
    `;

    console.log(`✅ PayPal order created successfully: ${orderData.id}`);

    return Response.json({
      orderId: orderData.id,
      links: orderData.links,
    });
  } catch (error) {
    console.error("❌ Create PayPal order error:", error);
    console.error("Error details:", error.message, error.stack);
    return Response.json(
      { error: error.message || "Failed to create order" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}
