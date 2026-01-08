import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.get("/ping", (c) => c.json({ ok: true }));

serve({
  fetch: app.fetch,
  port: Number(process.env.PORT ?? 3000),
});

console.log("API listening on", process.env.PORT ?? 3000);
