import { extractBearerToken, verifyAccessToken } from "@/app/api/utils/jwt";

export async function GET(request) {
  // クエリパラメータからトークンを取得（Expo WebViewからの場合）
  const url = new URL(request.url);
  const tokenFromQuery = url.searchParams.get("token");

  // Bearerトークンまたはクエリパラメータから取得
  const token = tokenFromQuery || extractBearerToken(request);

  if (!token) {
    return new Response(
      `
      <html>
        <body>
          <script>
            window.parent.postMessage({ type: 'AUTH_ERROR', error: 'No token provided' }, '*');
          </script>
        </body>
      </html>
      `,
      {
        status: 401,
        headers: {
          "Content-Type": "text/html",
        },
      },
    );
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    return new Response(
      `
      <html>
        <body>
          <script>
            window.parent.postMessage({ type: 'AUTH_ERROR', error: 'Invalid or expired token' }, '*');
          </script>
        </body>
      </html>
      `,
      {
        status: 401,
        headers: {
          "Content-Type": "text/html",
        },
      },
    );
  }

  const message = {
    type: "AUTH_SUCCESS",
    jwt: token,
    user: {
      id: payload.userId,
      email: payload.email,
    },
  };

  return new Response(
    `
    <html>
      <body>
        <script>
          window.parent.postMessage(${JSON.stringify(message)}, '*');
        </script>
      </body>
    </html>
    `,
    {
      headers: {
        "Content-Type": "text/html",
      },
    },
  );
}
