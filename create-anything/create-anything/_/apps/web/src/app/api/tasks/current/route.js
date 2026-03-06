import sql from "../../utils/sql";
import { authenticateUser } from "../../utils/auth";

const V2_BASE =
  process.env.V2_API_BASE_URL ||
  process.env.NEXT_PUBLIC_V2_API_BASE_URL ||
  "https://api.taskdash.net";

// v2 -> create-anything 譛溷ｾ・ｽ｢縺ｫ豁｣隕丞喧
function normalizeTaskPayload(data) {
  // 譛溷ｾ・ { id, name, numbers }
  if (data && typeof data === "object") {
    // v2縺・{ ok:true, task:{...} } 縺ｨ縺・{ ok:true, taskSet:{...} } 縺ｧ霑斐☆蝣ｴ蜷医ｂ蜷ｸ蜿・
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
    // 1) 隱崎ｨｼ・・reate-anything蛛ｴ縺ｮ蜑肴署縺ｯ蟠ｩ縺輔↑縺・ｼ・
    await authenticateUser(request);

    // 2) v2縺ｸ霆｢騾・ｼ郁ｪ崎ｨｼ繝倥ャ繝鬘槭・縲後≠繧九ｂ縺ｮ縺縺代咲ｴ騾壹＠・・
    const headers = new Headers();
    const auth = request.headers.get("authorization");
    if (auth) headers.set("authorization", auth);

    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);

    const devKey = request.headers.get("x-dev-key");
    if (devKey) headers.set("x-dev-key", devKey);

    // v2縺ｫ tasks/current 縺後≠繧句燕謠舌〒蜿ｩ縺擾ｼ育┌縺代ｌ縺ｰ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・・
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
      // numbers縺檎┌縺・ｽ｢縺ｧ霑斐▲縺ｦ縺阪◆繧峨…reate-anything蛛ｴ縺ｮUI縺梧ｭｻ縺ｬ蜿ｯ閭ｽ諤ｧ縺ゅｋ縺ｮ縺ｧ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ縺輔○繧・
    }

    // 3) 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・壻ｻ翫∪縺ｧ騾壹ｊ legacy DB 縺九ｉ蜿悶ｋ・育判髱｢繧貞｣翫＆縺ｪ縺・ｼ・
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


