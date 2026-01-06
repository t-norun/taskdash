import sql from "@/app/api/utils/sql";
import { authenticateUser } from "@/app/api/utils/auth";

export async function GET(request) {
  try {
    await authenticateUser(request);

    // Get current active task set
    const taskSet = await sql`
      SELECT * FROM task_sets 
      WHERE active_from <= NOW() AND active_to > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (taskSet.length === 0) {
      return Response.json(
        { error: "No active task available" },
        { status: 404 },
      );
    }

    return Response.json({
      id: taskSet[0].id,
      name: taskSet[0].name,
      numbers: taskSet[0].numbers,
    });
  } catch (error) {
    console.error("Get current task error:", error);
    return Response.json(
      { error: error.message || "Unauthorized" },
      { status: 401 },
    );
  }
}
