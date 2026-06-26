import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

// Returns the signed-in user's dashboard: their assigned tasks (across all
// projects) and the projects they can see (all projects if admin).
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";

    const [projects, tasks] = await Promise.all([
      prisma.project.findMany({
        // Exclude hidden staging (Asana import) projects from everyone's dashboard.
        where: isAdmin
          ? { isStaging: false }
          : { isStaging: false, members: { some: { userId: session.user.id } } },
        include: {
          tasks: {
            where: { parentTaskId: null },
            select: { status: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.task.findMany({
        // Staged tasks keep their original assignee, so exclude them here or they'd
        // surface in a worker's "My Tasks" before being distributed.
        where: {
          assigneeId: session.user.id,
          parentTaskId: null,
          project: { isStaging: false },
        },
        include: {
          project: { select: { id: true, name: true } },
          subtasks: { select: { status: true } },
        },
        orderBy: { dueDate: "asc" },
      }),
    ]);

    const projectSummaries = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      total: p.tasks.length,
      todo: p.tasks.filter((t) => t.status === "TODO").length,
      inProgress: p.tasks.filter((t) => t.status === "IN_PROGRESS").length,
      inReview: p.tasks.filter((t) => t.status === "IN_REVIEW").length,
      done: p.tasks.filter((t) => t.status === "DONE").length,
    }));

    const taskSummaries = tasks.map((t) => ({
      id: t.id,
      title: decrypt(t.titleEnc),
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      projectId: t.project?.id,
      projectName: t.project?.name,
      subtotal: t.subtasks.length,
      subdone: t.subtasks.filter((s) => s.status === "DONE").length,
    }));

    return NextResponse.json({
      isAdmin,
      name: session.user.name,
      projects: projectSummaries,
      tasks: taskSummaries,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
