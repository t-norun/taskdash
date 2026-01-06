import sql from "#/app/api/utils/sql";

export async function GET(request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return Response.json({ error: "No token provided" }, { status: 401 });
    }

    const session = await sql`
      SELECT s.*, u.* FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ${token} AND s.expires_at > NOW()
    `;

    if (session.length === 0) {
      return Response.json(
        { error: "Invalid or expired session" },
        { status: 401 },
      );
    }

    return Response.json({
      user: {
        id: session[0].user_id,
        email: session[0].email,
        displayName: session[0].display_name,
        balance: parseFloat(session[0].balance),
      },
    });
  } catch (error) {
    console.error("Session error:", error);
    return Response.json(
      { error: "Failed to validate session" },
      { status: 500 },
    );
  }
}
