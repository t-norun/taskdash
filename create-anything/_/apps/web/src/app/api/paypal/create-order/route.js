import sql from "../../utils/sql";
import { paypalRequest } from "#/app/api/paypal/utils/auth";
import { authenticateUser } from "../../utils/auth";

/**
 * 繝ｦ繝ｼ繧ｶ繝ｼ蜈･驥醍畑縺ｮPayPal豎ｺ貂医ｒ菴懈・
 */
export async function POST(request) {
  try {
    const user = await authenticateUser(request);

    const { amount } = await request.json();

    // 1) 驥鷹｡阪ｒ縲慶ents縲阪〒遒ｺ螳夲ｼ育ｫｯ謨ｰ繝悶Ξ髦ｲ豁｢・・
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 1 || amountNum > 500) {
      return Response.json(
        { error: "Amount must be between $1 and $500" },
        { status: 400 },
      );
    }

    const amountCents = Math.round(amountNum * 100);
    const amountUsd = amountCents / 100;

    console.log(`腸 Creating PayPal order for user ${user.id}, amount: $${amountUsd.toFixed(2)}`);

    // 2) APP_URL 縺ｮ蜿門ｾ暦ｼ亥ｮ滄圀縺ｮ繝ｪ繧ｯ繧ｨ繧ｹ繝亥・繧貞━蜈茨ｼ・
    let appUrl = process.env.APP_URL;

    if (!appUrl) {
      const origin = request.headers.get("origin");
      if (origin) {
        appUrl = origin;
        console.log(`笨・Using origin header as APP_URL: ${appUrl}`);
      } else {
        const host = request.headers.get("host");
        const protocol = request.headers.get("x-forwarded-proto") || "https";
        appUrl = `${protocol}://${host}`;
        console.log(`笞・・ APP_URL not set, using derived URL from host: ${appUrl}`);
      }
    } else {
      console.log(`笨・Using APP_URL from env: ${appUrl}`);
    }

    const returnUrl = `${appUrl}/paypal-success`;
    const cancelUrl = `${appUrl}/?cancelled=true`;

    // 3) PayPal order payload
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          // 霑ｽ霍｡縺ｮ隕・ｼ壼ｾ後〒 webhook / 辣ｧ蜷・/ 莠碁㍾蜃ｦ逅・亟豁｢縺ｫ菴ｿ縺医ｋ
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

    console.log("豆 PayPal order payload:");
    console.log(JSON.stringify(orderPayload, null, 2));

    // 4) PayPal Order繧剃ｽ懈・
    const orderData = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify(orderPayload),
    });

    // 5) legacy DB縺ｫ縺ｯ縲訓ayPal蜿門ｼ輔Ο繧ｰ縲阪□縺台ｿ晏ｭ假ｼ域ｮ矩ｫ倥・ v2 縺梧ｭ｣・・
    await sql`
      INSERT INTO paypal_transactions (
        user_id, order_id, amount, currency, status, transaction_type, raw_response
      ) VALUES (
        ${user.id},
        ${orderData.id},
        ${amountUsd},          -- 陦ｨ遉ｺ逕ｨUSD
        'USD',
        'CREATED',
        'deposit',
        ${JSON.stringify(orderData)}
      )
    `;

    return Response.json({
      orderId: orderData.id,
      links: orderData.links,
      amount: amountUsd,      // UI縺瑚｡ｨ遉ｺ縺吶ｋ逕ｨ・井ｻｻ諢擾ｼ・
    });
  } catch (error) {
    console.error("笶・Create PayPal order error:", error);
    return Response.json(
      { error: error.message || "Failed to create order" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}

