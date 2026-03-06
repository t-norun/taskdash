import sql from "../../utils/sql";
import { sendEmail } from "../../utils/send-email";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return Response.json(
        { error: "Valid email is required" },
        { status: 400 },
      );
    }

    // Check rate limiting - only allow 1 OTP per minute per email
    const recentOTP = await sql`
      SELECT * FROM otps 
      WHERE email = ${email} 
      AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (recentOTP.length > 0) {
      return Response.json(
        { error: "Please wait before requesting another code" },
        { status: 429 },
      );
    }

    // Check if too many attempts (5 in 1 hour = temporary lock)
    const hourlyAttempts = await sql`
      SELECT COUNT(*) as count FROM otps 
      WHERE email = ${email} 
      AND created_at > NOW() - INTERVAL '1 hour'
    `;

    if (hourlyAttempts[0].count >= 5) {
      return Response.json(
        { error: "Too many attempts. Please try again later" },
        { status: 429 },
      );
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete old OTPs for this email
    await sql`DELETE FROM otps WHERE email = ${email}`;

    // Insert new OTP
    await sql`
      INSERT INTO otps (email, code, expires_at)
      VALUES (${email}, ${code}, ${expiresAt})
    `;

    // Send email with OTP
    try {
      await sendEmail({
        to: email,
        from: "Task Dash <onboarding@resend.dev>",
        subject: "Your Task Dash Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2563FF; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Task Dash</h1>
            </div>
            <div style="padding: 40px 20px; background: #f9f9f9;">
              <h2 style="color: #2B2B2B; margin-bottom: 20px;">Your Verification Code</h2>
              <p style="color: #7A7A7A; font-size: 14px; margin-bottom: 20px;">
                Use this code to complete your login:
              </p>
              <div style="background: white; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563FF;">${code}</span>
              </div>
              <p style="color: #9B9B9B; font-size: 12px;">
                This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
              </p>
            </div>
          </div>
        `,
        text: `Your Task Dash verification code is: ${code}\n\nThis code will expire in 10 minutes.`,
      });

      console.log(`笨・OTP sent successfully to ${email}`);

      return Response.json({
        success: true,
        message: "Verification code sent to your email",
      });
    } catch (emailError) {
      console.error("笶・Email send error:", emailError);
      console.log(`柏 DEVELOPMENT OTP for ${email}: ${code}`);
      console.log(
        `笞・・ Email service not configured. Please set RESEND_API_KEY or check Resend domain authentication.`,
      );

      // Return the OTP in development/test mode
      return Response.json({
        success: true,
        message: "Email service unavailable. Check server logs for OTP code.",
        devCode: code, // Always return code when email fails
        needsEmailSetup: true,
      });
    }
  } catch (error) {
    console.error("Send OTP error:", error);
    return Response.json(
      { error: "Failed to send verification code" },
      { status: 500 },
    );
  }
}

