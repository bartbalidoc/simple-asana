import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

// Manager cockpit (Phase 2, v2.8): one admin-only call returns a single
// person's work picture — open tasks, productivity metrics, and today's daily
// plan. The planner is otherwise strictly private (src/app/api/planner), so
// this admin-scoped read lives here rather than loosening that route.

const DAY = 86_400_000;

// "Today" in Bali time (WITA, UTC+8) — the whole team is in Bali, and it
// matches how the recurrence engine reasons about dates.
function todayWITA(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// The Bali calendar day of a timestamp (YYYY-MM-DD). dueDate is stored as
// midnight UTC of its calendar day, so its day is just its own date part.
const baliDay = (d: Date) => new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);

const safeDecrypt = (enc?: string | null) => {
  if (!enc) return "";
  try {
    return decrypt(enc);
  } catch {
    return "";
  }
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admins only" }, { status: 403 });
    }
    const userId = req.nextUrl.searchParams.get("userId") || "";
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastSeenAt: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = Date.now();
    const windowStart = new Date(now - 90 * DAY); // metrics window (90 days)
    const today = todayWITA();
    const nowDate = new Date();

    const [openTasks, completedForOnTime, completedCount, commentsCount, lastEvent, planItems] =
      await Promise.all([
        // Open (not done, not parked) top-level tasks assigned to this person.
        prisma.task.findMany({
          where: {
            assigneeId: userId,
            parentTaskId: null,
            status: { not: "DONE" },
            parkedAt: null,
            project: { isStaging: false },
          },
          include: {
            project: { select: { id: true, name: true } },
            subtasks: { select: { status: true } },
          },
          orderBy: [{ priorityNumber: "asc" }, { dueDate: "asc" }],
        }),
        // Completed-with-due-date in the window → on-time %.
        prisma.task.findMany({
          where: {
            assigneeId: userId,
            completedAt: { gte: windowStart },
            dueDate: { not: null },
            project: { isStaging: false },
          },
          select: { completedAt: true, dueDate: true },
        }),
        prisma.task.count({
          where: {
            assigneeId: userId,
            completedAt: { gte: windowStart },
            project: { isStaging: false },
          },
        }),
        prisma.comment.count({
          where: {
            authorId: userId,
            createdAt: { gte: windowStart },
            task: { project: { isStaging: false } }, // match the task queries
          },
        }),
        prisma.auditLog.findFirst({
          where: { actorId: userId },
          orderBy: { occurredAt: "desc" },
          select: { occurredAt: true },
        }),
        // Today's plan (admin-scoped read of an otherwise-private planner).
        // Read-only equivalent of the planner's lazy rollover: today's items
        // PLUS undone items from earlier days (which would roll to today). We
        // never write to another user's planner from here.
        prisma.plannerItem.findMany({
          where: {
            userId,
            archivedAt: null,
            OR: [{ date: today }, { date: { lt: today }, done: false }],
          },
          orderBy: { order: "asc" },
        }),
      ]);

    // On-time %: of window-completed tasks that had a due date, how many landed
    // on or before it — compared on Bali CALENDAR DAYS (dueDate is midnight UTC;
    // completedAt is a real timestamp), so a same-day completion counts on time.
    const withDue = completedForOnTime.length;
    const onTime = completedForOnTime.filter(
      (t) => t.completedAt && t.dueDate && baliDay(t.completedAt) <= t.dueDate.toISOString().slice(0, 10)
    ).length;
    const onTimePct = withDue > 0 ? Math.round((onTime / withDue) * 100) : null;

    const tasks = openTasks.map((t) => {
      const overdue = !!t.dueDate && new Date(t.dueDate) < nowDate;
      return {
        id: t.id,
        title: safeDecrypt(t.titleEnc),
        status: t.status,
        priorityNumber: t.priorityNumber,
        dueDate: t.dueDate,
        overdue,
        projectId: t.project?.id,
        projectName: t.project?.name,
        subtotal: t.subtasks.length,
        subdone: t.subtasks.filter((s) => s.status === "DONE").length,
      };
    });
    const overdueCount = tasks.filter((t) => t.overdue).length;

    // Group today's plan by quadrant.
    const plan: Record<string, { title: string; done: boolean }[]> = {
      PRIORITY: [],
      TODO: [],
      CALL: [],
    };
    for (const it of planItems) {
      (plan[it.quadrant] ||= []).push({ title: safeDecrypt(it.titleEnc), done: it.done });
    }
    const planFilled = planItems.length > 0;

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      metrics: {
        openCount: tasks.length,
        overdueCount,
        onTimePct,
        completedInWindow: completedCount,
        commentsInWindow: commentsCount,
        lastLoginAt: user.lastSeenAt,
        lastActiveAt: lastEvent?.occurredAt ?? null,
        planFilled,
        windowDays: 90,
      },
      tasks,
      plan,
    });
  } catch (error) {
    console.error("GET /api/admin/team error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
