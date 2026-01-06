import sql from "../../utils/sql";
import {
  generateAccessToken,
  generateRefreshToken,
  generateRefreshTokenId,
} from "../../utils/jwt";

export async function POST(request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return Response.json(
        { error: "Email and code are required" },
        { status: 400 },
      );
    }

    // Find valid OTP
    const otpRecord = await sql`
      SELECT * FROM otps 
      WHERE email = ${email} 
      AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (otpRecord.length === 0) {
      return Response.json(
        { error: "Invalid or expired code" },
        { status: 400 },
      );
    }

    const otp = otpRecord[0];

    // Check attempts (max 5 tries)
    if (otp.attempts >= 5) {
      return Response.json(
        { error: "Too many failed attempts. Please request a new code." },
        { status: 429 },
      );
    }

    // Verify code
    if (otp.code !== code) {
      // Increment attempts
      await sql`UPDATE otps SET attempts = attempts + 1 WHERE id = ${otp.id}`;
      return Response.json(
        {
          error: "Invalid code",
          attemptsRemaining: 5 - (otp.attempts + 1),
        },
        { status: 400 },
      );
    }

    // Code is valid - delete OTP
    await sql`DELETE FROM otps WHERE id = ${otp.id}`;

    // Find or create user
    let user = await sql`SELECT * FROM users WHERE email = ${email}`;

    if (user.length === 0) {
      // Create new user with initial balance
      user = await sql`
        INSERT INTO users (email, balance, last_login_at)
        VALUES (${email}, 10.00, NOW())
        RETURNING *
      `;

      // Add initial balance to ledger
      await sql`
        INSERT INTO ledger (user_id, type, amount, note)
        VALUES (${user[0].id}, 'ADMIN_GRANT', 10.00, 'Initial balance')
      `;
    } else {
      // Update last login
      await sql`UPDATE users SET last_login_at = NOW() WHERE id = ${user[0].id}`;
    }

    const userId = user[0].id;

    // Generate JWT tokens
    const accessToken = generateAccessToken(userId, email);
    const refreshToken = generateRefreshToken(userId);
    const refreshTokenId = generateRefreshTokenId();

    // Save refresh token to database (30 days)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await sql`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (${userId}, ${refreshTokenId}, ${expiresAt})
    `;

    return Response.json({
      success: true,
      accessToken,
      refreshToken,
      refreshTokenId,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: userId,
        email: user[0].email,
        displayName: user[0].display_name,
        balance: parseFloat(user[0].balance),
        level: user[0].level,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return Response.json({ error: "Failed to verify code" }, { status: 500 });
  }
}
