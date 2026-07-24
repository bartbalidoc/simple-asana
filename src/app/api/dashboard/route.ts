import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { runDueRecurrences } from "@/lib/recurrence";
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

    // Lazy recurrence spawn: whenever someone opens the app, materialize any due
    // recurring copies. Cheap (one indexed query when nothing's due), best-effort
    // (never blocks the dashboard), and race-safe with the hourly cron backstop.
    runDueRecurrences().catch((e) => console.error("recurrence (dashboard):", e));

    const [projects, tasks, guestRows, mySubtasks] = await Promise.all([
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
          parkedAt: null, // parked tasks (v2.4) drop off the dashboard too
        },
        include: {
          project: { select: { id: true, name: true } },
          subtasks: { select: { status: true } },
        },
        orderBy: { dueDate: "asc" },
      }),
      // Tasks this user was invited to as a GUEST (one task, no project access).
      prisma.taskGuest.findMany({
        where: {
          userId: session.user.id,
          task: { project: { isStaging: false }, parkedAt: null },
        },
        include: {
          task: {
            include: {
              project: { select: { id: true, name: true } },
              subtasks: { select: { status: true } },
            },
          },
        },
      }),
      // Subtasks assigned to this user inside OTHER tasks (Meilinda's feedback:
      // "how can someone see their subtasks in other people's tasks?"). Shown
      // on the dashboard with their parent task for context. Hidden if the
      // subtask or its parent task is parked.
      prisma.task.findMany({
        where: {
          assigneeId: session.user.id,
          parentTaskId: { not: null },
          project: { isStaging: false },
          parkedAt: null,
          parentTask: { parkedAt: null },
        },
        include: {
          project: { select: { id: true, name: true } },
          parentTask: { select: { titleEnc: true } },
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

    const summarize = (t: (typeof tasks)[number], guest: boolean) => ({
      id: t.id,
      title: decrypt(t.titleEnc),
      status: t.status,
      priority: t.priority,
      priorityNumber: t.priorityNumber, // focus rank (v2.4)
      dueDate: t.dueDate,
      projectId: t.project?.id,
      projectName: t.project?.name,
      subtotal: t.subtasks.length,
      subdone: t.subtasks.filter((s) => s.status === "DONE").length,
      guest,
    });
    const assignedIds = new Set(tasks.map((t) => t.id));
    const taskSummaries = [
      ...tasks.map((t) => summarize(t, false)),
      ...guestRows
        .filter((g) => !assignedIds.has(g.task.id))
        .map((g) => summarize(g.task as (typeof tasks)[number], true)),
      // Your pieces of other people's tasks, labeled with the parent title.
      ...mySubtasks.map((st) => ({
        id: st.id,
        title: decrypt(st.titleEnc),
        status: st.status,
        priority: st.priority,
        priorityNumber: st.priorityNumber, // focus rank (v2.4)
        dueDate: st.dueDate,
        projectId: st.project?.id,
        projectName: st.project?.name,
        subtotal: 0,
        subdone: 0,
        guest: false,
        isSubtask: true,
        parentTitle: (() => {
          try {
            return st.parentTask ? decrypt(st.parentTask.titleEnc) : null;
          } catch {
            return null;
          }
        })(),
      })),
    ];

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
