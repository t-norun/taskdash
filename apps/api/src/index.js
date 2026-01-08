import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { neon } from "@neondatabase/serverless";

const app = new Hono();

const sql = neon(process.env.DATABASE_URL);

app.get("/ping", (c) =>
  c.json({
    ok: true,
    ver: "2026-01-08T18:xx db-check expected",
    hasDbCheck: true,
    port: process.env.PORT ?? null,
  })
);

app.get("/db-check", async (c) => {
  if (!process.env.DATABASE_URL) {
    return c.json({ ok: false, error: "DATABASE_URL is not set" }, 500);
  }
  const r = await sql`SELECT 1 AS ok`;
  return c.json({ ok: true, db: r[0].ok === 1 });
});

serve({
  fetch: app.fetch,
  port: Number(process.env.PORT ?? 3000),
});

console.log("API listening on", process.env.PORT ?? 3000);
