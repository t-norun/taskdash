import sql from "../../utils/sql";

export async function POST(request) {
  try {
    const { name, durationHours } = await request.json();

    // Generate 10 controlled random numbers (0-99)
    const numbers = generateControlledNumbers();

    const activeFrom = new Date();
    const activeTo = new Date(
      Date.now() + (durationHours || 24) * 60 * 60 * 1000,
    );

    const taskSet = await sql`
      INSERT INTO task_sets (name, numbers, active_from, active_to)
      VALUES (${name || "Daily Task"}, ${numbers}, ${activeFrom}, ${activeTo})
      RETURNING *
    `;

    return Response.json({
      success: true,
      taskSet: {
        id: taskSet[0].id,
        name: taskSet[0].name,
        numbers: taskSet[0].numbers,
        activeFrom: taskSet[0].active_from,
        activeTo: taskSet[0].active_to,
      },
    });
  } catch (error) {
    console.error("Create task error:", error);
    return Response.json({ error: "Failed to create task" }, { status: 500 });
  }
}

// 蛻ｶ蠕｡莉倥″繝ｩ繝ｳ繝繝謨ｰ蟄礼函謌・
function generateControlledNumbers() {
  const numbers = [];
  const maxAttempts = 1000;
  let attempts = 0;

  while (numbers.length < 10 && attempts < maxAttempts) {
    attempts++;
    const num = Math.floor(Math.random() * 100);

    // 驥崎､・メ繧ｧ繝・け
    if (numbers.includes(num)) continue;

    // 騾｣逡ｪ繝√ぉ繝・け・亥燕蠕・縺ｮ謨ｰ蟄励′譌｢縺ｫ蟄伜惠縺吶ｋ蝣ｴ蜷医・髯､螟厄ｼ・
    if (isConsecutive(num, numbers)) continue;

    // 繧ｾ繝ｭ逶ｮ繝√ぉ繝・け・・1,22,33縺ｪ縺ｩ譛螟ｧ2蛟九∪縺ｧ・・
    if (isDoubleDigit(num) && countDoubleDigits(numbers) >= 2) continue;

    numbers.push(num);
  }

  // 2譯∵ｯ皮紫繝√ぉ繝・け・・譯・-4蛟九・譯・-7蛟具ｼ・
  // 繧ゅ＠譚｡莉ｶ繧呈ｺ縺溘＆縺ｪ縺・ｴ蜷医・蜀咲函謌・
  const singleDigitCount = numbers.filter((n) => n < 10).length;
  if (singleDigitCount < 3 || singleDigitCount > 4) {
    return generateControlledNumbers();
  }

  return numbers;
}

// 騾｣逡ｪ繝√ぉ繝・け・・-1 or n+1縺梧里縺ｫ蟄伜惠縺吶ｋ縺具ｼ・
function isConsecutive(num, existingNumbers) {
  return existingNumbers.includes(num - 1) || existingNumbers.includes(num + 1);
}

// 繧ｾ繝ｭ逶ｮ蛻､螳夲ｼ・1,22,33...・・
function isDoubleDigit(num) {
  if (num < 11) return false;
  const str = num.toString();
  return str.length === 2 && str[0] === str[1];
}

// 譌｢蟄倬・蛻怜・縺ｮ繧ｾ繝ｭ逶ｮ繧偵き繧ｦ繝ｳ繝・
function countDoubleDigits(numbers) {
  return numbers.filter(isDoubleDigit).length;
}

