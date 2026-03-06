import sql from "../../utils/sql";
import { authenticateUser } from "../../utils/auth";

const V2_BASE =
  process.env.V2_API_BASE_URL ||
  process.env.NEXT_PUBLIC_V2_API_BASE_URL ||
  "http://localhost:3000";

// v2 -> create-anything 期待形に正規化
function normalizeTaskPayload(data) {
  // 期待: { id, name, numbers }
  if (data && typeof data === "object") {
    // v2が { ok:true, task:{...} } とか { ok:true, taskSet:{...} } で返す場合も吸収
    const t = data.task || data.taskSet || data.data || data;
    if (t && (t.id || t.name || t.numbers)) {
      return {
        id: t.id ?? "v2",
        name: t.name ?? "Task",
        numbers: t.numbers ?? t.nums ?? t.payload?.numbers,
      };
    }
  }
  return null;
}

export async function GET(request) {
  try {
    // 1) 認証（create-anything側の前提は崩さない）
    await authenticateUser(request);

    // 2) v2へ転送（認証ヘッダ類は「あるものだけ」素通し）
    const headers = new Headers();
    const auth = request.headers.get("authorization");
    if (auth) headers.set("authorization", auth);

    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);

    const devKey = request.headers.get("x-dev-key");
    if (devKey) headers.set("x-dev-key", devKey);

    // v2に tasks/current がある前提で叩く（無ければフォールバック）
    const v2res = await fetch(`${V2_BASE}/tasks/current`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (v2res.ok) {
      const data = await v2res.json();
      const normalized = normalizeTaskPayload(data);
      if (normalized && normalized.numbers) {
        return Response.json(normalized);
      }
      // numbersが無い形で返ってきたら、create-anything側のUIが死ぬ可能性あるのでフォールバックさせる
    }

    // 3) フォールバック：今まで通り legacy DB から取る（画面を壊さない）
    const taskSet = await sql`
      SELECT * FROM task_sets 
      WHERE active_from <= NOW() AND active_to > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (taskSet.length === 0) {
      return Response.json({ error: "No active task available" }, { status: 404 });
    }

    return Response.json({
      id: taskSet[0].id,
      name: taskSet[0].name,
      numbers: taskSet[0].numbers,
    });
  } catch (error) {
    console.error("Get current task error:", error);
    return Response.json(
      { error: error?.message || "Unauthorized" },
      { status: 401 },
    );
  }
}

