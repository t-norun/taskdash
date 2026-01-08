/**
 * PayPal API認証 & リクエスト共通処理
 * Sandbox/Live切り替え対応
 */

let accessTokenCache = null;
let tokenExpiresAt = 0;

/**
 * 環境に応じたPayPal認証情報を取得
 */
function getPayPalCredentials() {
  const mode = process.env.PAYPAL_MODE || "sandbox";
  const isLive = mode === "live" || mode === "production";

  // 環境別の認証情報を優先（新形式）、なければ共通設定を使用
  const clientId = isLive
    ? process.env.PAYPAL_LIVE_CLIENT_ID || process.env.PAYPAL_CLIENT_ID
    : process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;

  const clientSecret = isLive
    ? process.env.PAYPAL_LIVE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET
    : process.env.PAYPAL_SANDBOX_CLIENT_SECRET ||
      process.env.PAYPAL_CLIENT_SECRET;

  const webhookId = isLive
    ? process.env.PAYPAL_LIVE_WEBHOOK_ID || process.env._PAYPAL_WEBHOOK_ID
    : process.env.PAYPAL_SANDBOX_WEBHOOK_ID || process.env._PAYPAL_WEBHOOK_ID;

  return {
    clientId,
    clientSecret,
    webhookId,
    mode: isLive ? "live" : "sandbox",
  };
}

/**
 * PayPal APIのベースURL取得
 */
function getPayPalBaseUrl() {
  const { mode } = getPayPalCredentials();
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

/**
 * PayPal OAuth2アクセストークンを取得
 */
export async function getPayPalAccessToken() {
  // キャッシュが有効ならそれを返す
  if (accessTokenCache && Date.now() < tokenExpiresAt) {
    return accessTokenCache;
  }

  const { clientId, clientSecret, mode } = getPayPalCredentials();

  // 🔍 診断ログ（本番環境での環境変数確認用）
  console.log("═══════════════════════════════════════════════════");
  console.log("🔍 PayPal 認証診断:");
  console.log("  Mode:", mode);
  console.log("  Environment variables checked:");
  console.log(`    - PAYPAL_MODE: ${process.env.PAYPAL_MODE || "(not set)"}`);
  if (mode === "sandbox") {
    console.log(
      `    - PAYPAL_SANDBOX_CLIENT_ID: ${process.env.PAYPAL_SANDBOX_CLIENT_ID ? "✅ SET" : "❌ NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_SANDBOX_CLIENT_SECRET: ${process.env.PAYPAL_SANDBOX_CLIENT_SECRET ? "✅ SET" : "❌ NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_CLIENT_ID (fallback): ${process.env.PAYPAL_CLIENT_ID ? "✅ SET" : "❌ NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_CLIENT_SECRET (fallback): ${process.env.PAYPAL_CLIENT_SECRET ? "✅ SET" : "❌ NOT SET"}`,
    );
  } else {
    console.log(
      `    - PAYPAL_LIVE_CLIENT_ID: ${process.env.PAYPAL_LIVE_CLIENT_ID ? "✅ SET" : "❌ NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_LIVE_CLIENT_SECRET: ${process.env.PAYPAL_LIVE_CLIENT_SECRET ? "✅ SET" : "❌ NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_CLIENT_ID (fallback): ${process.env.PAYPAL_CLIENT_ID ? "✅ SET" : "❌ NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_CLIENT_SECRET (fallback): ${process.env.PAYPAL_CLIENT_SECRET ? "✅ SET" : "❌ NOT SET"}`,
    );
  }
  console.log("  Final credentials:");
  console.log(
    `    - Client ID: ${clientId ? `***${clientId.slice(-4)}` : "❌ MISSING"}`,
  );
  console.log(
    `    - Client Secret: ${clientSecret ? "✅ SET (hidden)" : "❌ MISSING"}`,
  );
  console.log(`  Target URL: ${getPayPalBaseUrl()}/v1/oauth2/token`);
  console.log("═══════════════════════════════════════════════════");

  if (!clientId || !clientSecret) {
    throw new Error(
      `PayPal credentials not configured for ${mode} mode. Please set PAYPAL_${mode.toUpperCase()}_CLIENT_ID and PAYPAL_${mode.toUpperCase()}_CLIENT_SECRET`,
    );
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const baseUrl = getPayPalBaseUrl();

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ PayPal auth error (${mode}):`, error);
    console.error(`   URL was: ${baseUrl}/v1/oauth2/token`);
    console.error(`   Client ID used: ***${clientId.slice(-4)}`);
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();

  // アクセストークンをキャッシュ（有効期限の90%で更新）
  accessTokenCache = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 * 0.9;

  return accessTokenCache;
}

/**
 * PayPal APIリクエストを送信
 */
export async function paypalRequest(endpoint, options = {}) {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  console.log(`🔵 PayPal request to: ${baseUrl}${endpoint}`);
  if (options.body) {
    console.log("📤 Request body:", options.body);
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // レスポンスの内容を取得（JSONまたはテキスト）
  const contentType = response.headers.get("content-type");
  let data;

  try {
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log("📥 PayPal text response:", text);
      data = { error: text };
    }
  } catch (parseError) {
    console.error("❌ Failed to parse PayPal response:", parseError);
    data = { error: "Failed to parse response" };
  }

  if (!response.ok) {
    console.error("❌ PayPal API error details:", {
      status: response.status,
      statusText: response.statusText,
      endpoint,
      error: data,
      requestBody: options.body ? JSON.parse(options.body) : null,
    });
    throw new Error(
      data.message ||
        data.error_description ||
        data.error ||
        JSON.stringify(data),
    );
  }

  console.log(`✅ PayPal response (${response.status}):`, data);
  return data;
}

/**
 * Webhook ID取得（署名検証用）
 */
export function getWebhookId() {
  const { webhookId } = getPayPalCredentials();
  return webhookId;
}

/**
 * 現在のモード取得
 */
export function getPayPalMode() {
  return getPayPalCredentials().mode;
}
