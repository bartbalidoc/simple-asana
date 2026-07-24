import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

// Park / unpark many tasks at once from the dashboard (v2.5). ADMIN-ONLY —
// parking hides a task from everyone's board, so it stays an admin action
// (mirrors the single-task PATCH guard). Body: { taskIds: string[], parked: boolean }.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admins only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const taskIds: string[] = Array.isArray(body?.taskIds)
      ? body.taskIds.filter((x: any) => typeof x === "string").slice(0, 200)
      : [];
    const parked = body?.parked === true;
    if (taskIds.length === 0) {
      return NextResponse.json({ error: "taskIds is required" }, { status: 400 });
    }

    const result = await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: { parkedAt: parked ? new Date() : null },
    });

    // One audit row per task keeps the trail complete without N round-trips.
    await Promise.allSettled(
      taskIds.map((id) =>
        writeAuditLog({
          actorId: session.user.id,
          action: "TASK_UPDATED",
          resource: "task",
          resourceId: id,
          metadata: { bulkPark: parked },
          req,
        })
      )
    );

    return NextResponse.json({ ok: true, count: result.count, parked });
  } catch (error) {
    console.error("POST /api/tasks/bulk-park error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
