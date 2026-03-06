/**
 * PayPal API隱崎ｨｼ & 繝ｪ繧ｯ繧ｨ繧ｹ繝亥・騾壼・逅・
 * Sandbox/Live蛻・ｊ譖ｿ縺亥ｯｾ蠢・
 */

let accessTokenCache = null;
let tokenExpiresAt = 0;

/**
 * 迺ｰ蠅・↓蠢懊§縺蘖ayPal隱崎ｨｼ諠・ｱ繧貞叙蠕・
 */
function getPayPalCredentials() {
  const mode = process.env.PAYPAL_MODE || "sandbox";
  const isLive = mode === "live" || mode === "production";

  // 迺ｰ蠅・挨縺ｮ隱崎ｨｼ諠・ｱ繧貞━蜈茨ｼ域眠蠖｢蠑擾ｼ峨√↑縺代ｌ縺ｰ蜈ｱ騾夊ｨｭ螳壹ｒ菴ｿ逕ｨ
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
 * PayPal API縺ｮ繝吶・繧ｹURL蜿門ｾ・
 */
function getPayPalBaseUrl() {
  const { mode } = getPayPalCredentials();
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

/**
 * PayPal OAuth2繧｢繧ｯ繧ｻ繧ｹ繝医・繧ｯ繝ｳ繧貞叙蠕・
 */
export async function getPayPalAccessToken() {
  // 繧ｭ繝｣繝・す繝･縺梧怏蜉ｹ縺ｪ繧峨◎繧後ｒ霑斐☆
  if (accessTokenCache && Date.now() < tokenExpiresAt) {
    return accessTokenCache;
  }

  const { clientId, clientSecret, mode } = getPayPalCredentials();

  // 剥 險ｺ譁ｭ繝ｭ繧ｰ・域悽逡ｪ迺ｰ蠅・〒縺ｮ迺ｰ蠅・､画焚遒ｺ隱咲畑・・
  console.log("笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊・);
  console.log("剥 PayPal 隱崎ｨｼ險ｺ譁ｭ:");
  console.log("  Mode:", mode);
  console.log("  Environment variables checked:");
  console.log(`    - PAYPAL_MODE: ${process.env.PAYPAL_MODE || "(not set)"}`);
  if (mode === "sandbox") {
    console.log(
      `    - PAYPAL_SANDBOX_CLIENT_ID: ${process.env.PAYPAL_SANDBOX_CLIENT_ID ? "笨・SET" : "笶・NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_SANDBOX_CLIENT_SECRET: ${process.env.PAYPAL_SANDBOX_CLIENT_SECRET ? "笨・SET" : "笶・NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_CLIENT_ID (fallback): ${process.env.PAYPAL_CLIENT_ID ? "笨・SET" : "笶・NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_CLIENT_SECRET (fallback): ${process.env.PAYPAL_CLIENT_SECRET ? "笨・SET" : "笶・NOT SET"}`,
    );
  } else {
    console.log(
      `    - PAYPAL_LIVE_CLIENT_ID: ${process.env.PAYPAL_LIVE_CLIENT_ID ? "笨・SET" : "笶・NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_LIVE_CLIENT_SECRET: ${process.env.PAYPAL_LIVE_CLIENT_SECRET ? "笨・SET" : "笶・NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_CLIENT_ID (fallback): ${process.env.PAYPAL_CLIENT_ID ? "笨・SET" : "笶・NOT SET"}`,
    );
    console.log(
      `    - PAYPAL_CLIENT_SECRET (fallback): ${process.env.PAYPAL_CLIENT_SECRET ? "笨・SET" : "笶・NOT SET"}`,
    );
  }
  console.log("  Final credentials:");
  console.log(
    `    - Client ID: ${clientId ? `***${clientId.slice(-4)}` : "笶・MISSING"}`,
  );
  console.log(
    `    - Client Secret: ${clientSecret ? "笨・SET (hidden)" : "笶・MISSING"}`,
  );
  console.log(`  Target URL: ${getPayPalBaseUrl()}/v1/oauth2/token`);
  console.log("笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊・);

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
    console.error(`笶・PayPal auth error (${mode}):`, error);
    console.error(`   URL was: ${baseUrl}/v1/oauth2/token`);
    console.error(`   Client ID used: ***${clientId.slice(-4)}`);
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();

  // 繧｢繧ｯ繧ｻ繧ｹ繝医・繧ｯ繝ｳ繧偵く繝｣繝・す繝･・域怏蜉ｹ譛滄剞縺ｮ90%縺ｧ譖ｴ譁ｰ・・
  accessTokenCache = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 * 0.9;

  return accessTokenCache;
}

/**
 * PayPal API繝ｪ繧ｯ繧ｨ繧ｹ繝医ｒ騾∽ｿ｡
 */
export async function paypalRequest(endpoint, options = {}) {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  console.log(`鳩 PayPal request to: ${baseUrl}${endpoint}`);
  if (options.body) {
    console.log("豆 Request body:", options.body);
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // 繝ｬ繧ｹ繝昴Φ繧ｹ縺ｮ蜀・ｮｹ繧貞叙蠕暦ｼ・SON縺ｾ縺溘・繝・く繧ｹ繝茨ｼ・
  const contentType = response.headers.get("content-type");
  let data;

  try {
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log("踏 PayPal text response:", text);
      data = { error: text };
    }
  } catch (parseError) {
    console.error("笶・Failed to parse PayPal response:", parseError);
    data = { error: "Failed to parse response" };
  }

  if (!response.ok) {
    console.error("笶・PayPal API error details:", {
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

  console.log(`笨・PayPal response (${response.status}):`, data);
  return data;
}

/**
 * Webhook ID蜿門ｾ暦ｼ育ｽｲ蜷肴､懆ｨｼ逕ｨ・・
 */
export function getWebhookId() {
  const { webhookId } = getPayPalCredentials();
  return webhookId;
}

/**
 * 迴ｾ蝨ｨ縺ｮ繝｢繝ｼ繝牙叙蠕・
 */
export function getPayPalMode() {
  return getPayPalCredentials().mode;
}

