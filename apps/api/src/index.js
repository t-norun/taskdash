import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { neon } from "@neondatabase/serverless";

const app = new Hono();

const DATABASE_URL = process.env.DATABASE_URL;
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

app.get("/health", (c) =>
  c.json({
    ok: true,
    port: Number(process.env.PORT || 3000),
    hasDatabaseUrl: Boolean(DATABASE_URL),
  })
);

app.get("/debug/db", async (c) => {
  try {
    if (!sql) return c.json({ ok: false, error: "DATABASE_URL is missing" }, 500);
    const result = await sql`select 1 as ok`;
    return c.json({ ok: true, result: result[0] });
  } catch (err) {
    return c.json({ ok: false, error: String(err?.message || err) }, 500);
  }
});

app.get("/debug/tables", async (c) => {
  try {
    if (!sql) return c.json({ ok: false, error: "DATABASE_URL is missing" }, 500);
    const rows = await sql`
      select tablename
      from pg_tables
      where schemaname = 'public'
      order by tablename
    `;
    return c.json({ ok: true, rows });
  } catch (err) {
    return c.json({ ok: false, error: String(err?.message || err) }, 500);
  }
});

const port = Number(process.env.PORT || 3000);
serve({ fetch: app.fetch, port });
console.log(` API listening on http://localhost:${port}`);
