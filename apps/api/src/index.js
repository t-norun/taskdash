import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { neon } from "@neondatabase/serverless";

const app = new Hono();

app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "https://taskdash-1.onrender.com");
  c.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (c.req.method === "OPTIONS") return c.text("", 204);
  await next();
});

app.use(
  "/*",
  cors({
    origin: "*",
  })
);

// ✅ まず「生きてる」確認用（絶対200にする）
app.get("/", (c) => c.json({ ok: true, service: "taskdash-api" }));
app.get("/healthz", (c) => c.text("ok"));
app.get("/ping", (c) => c.json({ ok: true, message: "pong" }));
app.get("/api/tasks/health", (c) => {
  return c.json({ ok: true, service: "tasks", ts: Date.now() });
});
app.get("/api/tasks", async (c) => {
  const limitRaw = c.req.query("limit");
  const offsetRaw = c.req.query("offset");

  const limit = limitRaw == null ? 20 : Number(limitRaw);
  const offset = offsetRaw == null ? 0 : Number(offsetRaw);

  // バリデーション
  if (!Number.isInteger(limit) || !Number.isInteger(offset) || limit < 1 || offset < 0) {
    return c.json(
      { ok: false, error: "limit/offset must be integers (limit>=1, offset>=0)" },
      400
    );
  }

  const safeLimit = Math.min(limit, 100);

  try {
    const sql = neon(process.env.DATABASE_URL);

    const tasks = await sql`
      SELECT id, title, status, reward_yen, created_at
      FROM tasks
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit}
      OFFSET ${offset}
    `;

    return c.json({ ok: true, tasks, limit: safeLimit, offset }, 200);
  } catch (e) {
    console.error("GET /api/tasks failed:", e);
    return c.json({ ok: false, error: "internal_error" }, 500);
  }
});
app.get("/ver", (c) => c.json({ ver: "deded1c-dbinfo" }));

// ✅ DB確認（DATABASE_URL が入ってる時だけ動く）
app.get("/debug/db", async (c) => {
  const url = process.env.DATABASE_URL;
  if (!url) return c.json({ ok: false, error: "DATABASE_URL is missing" }, 500);

  const sql = neon(url);
  const r = await sql`select now() as now`;
  return c.json({ ok: true, now: r?.[0]?.now ?? null });
});

app.get("/debug/dbinfo", async (c) => {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) return c.json({ ok: false, error: "DATABASE_URL is missing" }, 500);

    const sql = neon(url);

    // DB/スキーマ/接続先確認
    const info = await sql`
      SELECT
        current_database() AS db,
        current_schema() AS schema,
        current_user AS user,
        inet_server_addr()::text AS server_ip
    `;

    // publicのテーブル一覧
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    return c.json({
      ok: true,
      info: info[0],
      tables: tables.map((t) => t.table_name),
    });
  } catch (e) {
    console.error(e);
    return c.json({ ok: false, error: String(e) }, 500);
  }
});

app.get("/db-check", async (c) => {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`select 1 as ok`;
    return c.json({ ok: true, result });
  } catch (e) {
    return c.json({ ok: false, error: String(e) }, 500);
  }
});

// ✅ それでも迷子にならないための最終手段
app.notFound((c) => c.json({ ok: false, error: "not found", path: c.req.path }, 404));

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT ?? 3000),
  },
  () => console.log("API listening on", process.env.PORT ?? 3000)
);
