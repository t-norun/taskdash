import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { neon } from "@neondatabase/serverless";

const app = new Hono();

// CORS設定（本番 + ローカル）
app.use(
  "*",
  cors({
    origin: [
      "https://taskdash-1.onrender.com",
      "http://localhost:5173",
    ],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// POST /api/tasks 新規作成
app.post("/api/tasks", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid json" }, 400);
  }

  const titleRaw = body?.title;
  const rewardRaw = body?.reward_yen;

  const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
  if (!title) return c.json({ ok: false, error: "title is required" }, 400);
  if (title.length > 200) return c.json({ ok: false, error: "title is too long (max 200)" }, 400);

  let reward_yen = 0;
  if (rewardRaw !== undefined) {
    const n = Number(rewardRaw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return c.json({ ok: false, error: "reward_yen must be a non-negative integer" }, 400);
    }
    reward_yen = n;
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const rows = await sql`
      INSERT INTO tasks (title, status, reward_yen)
      VALUES (${title}, 'open', ${reward_yen})
      RETURNING id, title, status, reward_yen, created_at;
    `;
    const created = Array.isArray(rows) ? rows[0] : rows?.[0];
    return c.json({ ok: true, task: created }, 201);
  } catch (err) {
    console.error("POST /api/tasks failed:", err);
    return c.json({ ok: false, error: "db error" }, 500);
  }
});

// GET /api/tasks
app.get("/api/tasks", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 20), 1), 100);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

  const sql = neon(process.env.DATABASE_URL);

  try {
    const tasks = await sql`
      SELECT id, title, status, reward_yen, created_at
      FROM tasks
      ORDER BY id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return c.json({ ok: true, tasks });
  } catch (err) {
    console.error("GET /api/tasks failed:", err);
    return c.json({ ok: false, error: "internal error" }, 500);
  }
});

// PATCH /api/tasks/:id ステータス更新
// PUT /api/tasks/:id タイトル・報酬の編集
app.put("/api/tasks/:id", async (c) => {
  const id = c.req.param("id");

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid json" }, 400);
  }

  const titleRaw = body?.title;
  const rewardRaw = body?.reward_yen;

  const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
  if (!title) return c.json({ ok: false, error: "title is required" }, 400);
  if (title.length > 200) return c.json({ ok: false, error: "title is too long (max 200)" }, 400);

  const reward_yen = Number(rewardRaw);
  if (!Number.isFinite(reward_yen) || reward_yen < 0 || !Number.isInteger(reward_yen)) {
    return c.json({ ok: false, error: "reward_yen must be a non-negative integer" }, 400);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const rows = await sql`
      UPDATE tasks
      SET title = ${title},
          reward_yen = ${reward_yen}
      WHERE id = ${id}
      RETURNING id, title, status, reward_yen, created_at;
    `;

    const updated = Array.isArray(rows) ? rows[0] : rows?.[0];
    if (!updated) return c.json({ ok: false, error: "task not found", id }, 404);

    return c.json({ ok: true, task: updated });
  } catch (err) {
    console.error("PUT /api/tasks/:id failed:", err);
    return c.json({ ok: false, error: "db error" }, 500);
  }
});

// PATCH /api/tasks/:id ステータス更新
app.patch("/api/tasks/:id", async (c) => {
  const id = c.req.param("id");

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid json" }, 400);
  }

  const status = body?.status;
  if (status !== "open" && status !== "closed") {
    return c.json({ ok: false, error: "status must be 'open' or 'closed'" }, 400);
  }

  const sql = neon(process.env.DATABASE_URL);
  try {
    const rows = await sql`
      UPDATE tasks
      SET status = ${status}
      WHERE id = ${id}
      RETURNING id, title, status, reward_yen, created_at;
    `;

    // neon の返り値が配列/オブジェクトどっちでも拾う
    const updated = Array.isArray(rows) ? rows[0] : rows?.[0];

    if (!updated) {
      return c.json({ ok: false, error: "task not found", id }, 404);
    }

    return c.json({ ok: true, task: updated });
  } catch (e) {
    console.error(e);
    return c.json({ ok: false, error: "db error" }, 500);
  }
});

app.get("/api/tasks/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ ok: false, error: "invalid id" }, 400);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const rows = await sql`
      SELECT id, title, status, reward_yen, created_at
      FROM tasks
      WHERE id = ${id}
      LIMIT 1
    `;

    const task = rows?.[0];
    if (!task) {
      return c.json({ ok: false, error: "not found" }, 404);
    }

    return c.json({ ok: true, task });
  } catch (err) {
    console.error("GET /api/tasks/:id failed:", err);
    return c.json({ ok: false, error: "internal error" }, 500);
  }
});

    // ...existing code...
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


// ステータス更新API
app.put("/api/tasks/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ ok: false, error: "invalid id" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const status = body?.status;

  if (status !== "open" && status !== "closed") {
    return c.json({ ok: false, error: "status must be 'open' or 'closed'" }, 400);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const rows = await sql`
      UPDATE tasks
      SET status = ${status}
      WHERE id = ${id}
      RETURNING id, title, status, reward_yen, created_at
    `;

    const task = rows?.[0];
    if (!task) return c.json({ ok: false, error: "not found" }, 404);

    return c.json({ ok: true, task });
  } catch (err) {
    console.error("PUT /api/tasks/:id/status failed:", err);
    return c.json({ ok: false, error: "internal error" }, 500);
  }
});
// DELETE /api/tasks/:id 削除
app.delete("/api/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const sql = neon(process.env.DATABASE_URL);

  try {
    const rows = await sql`
      DELETE FROM tasks
      WHERE id = ${id}
      RETURNING id, title, status, reward_yen, created_at;
    `;

    const deleted = Array.isArray(rows) ? rows[0] : rows?.[0];
    if (!deleted) return c.json({ ok: false, error: "task not found", id }, 404);

    return c.json({ ok: true, task: deleted });
  } catch (err) {
    console.error("DELETE /api/tasks/:id failed:", err);
    return c.json({ ok: false, error: "db error" }, 500);
  }
});

app.get("/ping", (c) => c.json({ ok: true, message: "pong" }));
// ✅ それでも迷子にならないための最終手段
app.notFound((c) => c.json({ ok: false, error: "not found", path: c.req.path }, 404));

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT ?? 3000),
  },
  () => console.log("API listening on", process.env.PORT ?? 3000)
);
