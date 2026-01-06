import sql from "@/app/api/utils/sql";
import { authenticateUser } from "@/app/api/utils/auth";

function generateRandomNumbers() {
  const numbers = [];
  const used = new Set();

  while (numbers.length < 10) {
    const num = Math.floor(Math.random() * 100);

    if (used.has(num)) continue;

    const hasSequence = numbers.some(
      (n) => Math.abs(n - num) === 1 || Math.abs(n - num) === 10,
    );
    if (hasSequence) continue;

    const duplicateDigits = numbers.filter(
      (n) => Math.floor(n / 10) === Math.floor(num / 10) || n % 10 === num % 10,
    );
    if (duplicateDigits.length >= 2) continue;

    const oneDigitCount = numbers.filter((n) => n < 10).length;
    if (num < 10 && oneDigitCount >= 3) continue;

    numbers.push(num);
    used.add(num);
  }

  return numbers;
}

async function getOrCreateTaskSet(priceUsd) {
  const now = new Date();

  const existingSets = await sql(
    `SELECT * FROM task_sets 
     WHERE price_usd = $1 
     AND active_from <= $2 
     AND active_to >= $2
     ORDER BY created_at DESC 
     LIMIT 1`,
    [priceUsd, now],
  );

  if (existingSets.length > 0) {
    return existingSets[0];
  }

  const numbers = generateRandomNumbers();
  const activeFrom = now;
  const activeTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [newSet] = await sql(
    `INSERT INTO task_sets (name, numbers, price_usd, active_from, active_to)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      `Task $${priceUsd} - ${now.toISOString()}`,
      numbers,
      priceUsd,
      activeFrom,
      activeTo,
    ],
  );

  return newSet;
}

export async function POST(request) {
  try {
    const user = await authenticateUser(request);

    const balance = parseFloat(user.balance);
    const userLevel = user.level;

    const { priceUsd } = await request.json();

    if (!priceUsd || priceUsd < 1 || priceUsd > 100) {
      return Response.json({ error: "Invalid price" }, { status: 400 });
    }

    if (priceUsd > userLevel) {
      return Response.json(
        {
          error: `You can only select prices up to $${userLevel}. Current level: ${userLevel}`,
        },
        { status: 403 },
      );
    }

    if (balance < priceUsd) {
      return Response.json(
        {
          error: `Insufficient balance. You need at least $${priceUsd.toFixed(2)} to accept this job.`,
        },
        { status: 400 },
      );
    }

    const recentSubmission = await sql`
      SELECT * FROM submissions 
      WHERE user_id = ${user.id} 
      AND created_at > NOW() - INTERVAL '30 seconds'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (recentSubmission.length > 0) {
      return Response.json(
        { error: "Please wait before accepting another job" },
        { status: 429 },
      );
    }

    await sql(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [
      priceUsd,
      user.id,
    ]);

    await sql(
      `INSERT INTO ledger (user_id, type, amount, note)
       VALUES ($1, 'FEE', $2, $3)`,
      [user.id, -priceUsd, `Job acceptance fee - $${priceUsd}`],
    );

    const taskSet = await getOrCreateTaskSet(priceUsd);

    return Response.json({
      success: true,
      taskSetId: taskSet.id,
      numbers: taskSet.numbers,
      priceUsd: parseFloat(taskSet.price_usd),
    });
  } catch (error) {
    console.error("Accept task error:", error);
    return Response.json(
      { error: error.message || "Failed to accept job" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 },
    );
  }
}
