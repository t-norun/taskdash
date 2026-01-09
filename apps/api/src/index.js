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
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`select now() as server_time`;
    return c.json({ ok: true, tasks: [], meta: rows[0] });
  } catch (e) {
    return c.json({ ok: false, error: String(e) }, 500);
  }
});
app.get("/ver", (c) => c.json({ ver: process.env.VER ?? "dev" }));

// ✅ DB確認（DATABASE_URL が入ってる時だけ動く）
app.get("/debug/db", async (c) => {
  const url = process.env.DATABASE_URL;
  if (!url) return c.json({ ok: false, error: "DATABASE_URL is missing" }, 500);

  const sql = neon(url);
  const r = await sql`select now() as now`;
  return c.json({ ok: true, now: r?.[0]?.now ?? null });
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
