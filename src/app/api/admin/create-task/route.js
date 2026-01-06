import sql from "#/app/api/utils/sql";

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

// 制御付きランダム数字生成
function generateControlledNumbers() {
  const numbers = [];
  const maxAttempts = 1000;
  let attempts = 0;

  while (numbers.length < 10 && attempts < maxAttempts) {
    attempts++;
    const num = Math.floor(Math.random() * 100);

    // 重複チェック
    if (numbers.includes(num)) continue;

    // 連番チェック（前後1の数字が既に存在する場合は除外）
    if (isConsecutive(num, numbers)) continue;

    // ゾロ目チェック（11,22,33など最大2個まで）
    if (isDoubleDigit(num) && countDoubleDigits(numbers) >= 2) continue;

    numbers.push(num);
  }

  // 2桁比率チェック（1桁3-4個、2桁6-7個）
  // もし条件を満たさない場合は再生成
  const singleDigitCount = numbers.filter((n) => n < 10).length;
  if (singleDigitCount < 3 || singleDigitCount > 4) {
    return generateControlledNumbers();
  }

  return numbers;
}

// 連番チェック（n-1 or n+1が既に存在するか）
function isConsecutive(num, existingNumbers) {
  return existingNumbers.includes(num - 1) || existingNumbers.includes(num + 1);
}

// ゾロ目判定（11,22,33...）
function isDoubleDigit(num) {
  if (num < 11) return false;
  const str = num.toString();
  return str.length === 2 && str[0] === str[1];
}

// 既存配列内のゾロ目をカウント
function countDoubleDigits(numbers) {
  return numbers.filter(isDoubleDigit).length;
}
