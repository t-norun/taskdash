export async function GET() {
  return Response.json({
    APP_URL: process.env.APP_URL || "NOT_SET",
    CURRENT_HOST: "Check request headers",
    ENV: process.env.ENV,
  });
}

