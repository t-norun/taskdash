import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { neon } from "@neondatabase/serverless";

const app = new Hono();

// ✅ まず「生きてる」確認用（絶対200にする）
app.get("/", (c) => c.json({ ok: true, service: "taskdash-api" }));
app.get("/healthz", (c) => c.text("ok"));
app.get("/ping", (c) => c.json({ ok: true, message: "pong" }));
app.get("/ver", (c) => c.json({ ver: process.env.VER ?? "dev" }));

// ✅ DB確認（DATABASE_URL が入ってる時だけ動く）
app.get("/debug/db", async (c) => {
  const url = process.env.DATABASE_URL;
  if (!url) return c.json({ ok: false, error: "DATABASE_URL is missing" }, 500);

  const sql = neon(url);
  const r = await sql`select now() as now`;
  return c.json({ ok: true, now: r?.[0]?.now ?? null });
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
