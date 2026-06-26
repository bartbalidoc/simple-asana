import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

// Admin-only: list the hidden "Staging" projects (Asana imports) with their
// top-level tasks. Each task carries its subtask count, distribution state
// (distributedAt → drives the "Copied ✓" color) and the original Asana owner.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const projects = await prisma.project.findMany({
      where: { isStaging: true },
      orderBy: { name: "asc" },
      include: {
        tasks: {
          where: { parentTaskId: null },
          orderBy: { order: "asc" },
          include: {
            assignee: { select: { id: true, name: true } },
            _count: { select: { subtasks: true } },
          },
        },
      },
    });

    const result = projects.map((p) => ({
      id: p.id,
      name: p.name,
      taskCount: p.tasks.length,
      tasks: p.tasks.map((t) => ({
        id: t.id,
        title: decrypt(t.titleEnc),
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        assigneeId: t.assigneeId,
        assigneeName: t.assignee?.name || null,
        originalAssignee: t.originalAssignee,
        distributedAt: t.distributedAt,
        subtaskCount: t._count.subtasks,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/admin/staging error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
