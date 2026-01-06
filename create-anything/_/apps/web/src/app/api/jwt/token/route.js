import { extractBearerToken, verifyAccessToken } from "#/app/api/utils/jwt";

export async function GET(request) {
  const token = extractBearerToken(request);

  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  return Response.json({
    jwt: token,
    user: {
      id: payload.userId,
      email: payload.email,
    },
  });
}
