import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Admin-only "Team Activity / Productivity" data layer. Dashboard-ready JSON.
// Built on the AuditLog (logins, task/comment activity) + Task/Comment tables.
//
// Query params (all optional):
//   days = 7 | 30 | 90 (default 7)   OR   from=ISO & to=ISO (custom range)
//   userId   - focus on one person
//   role     - ADMIN | MEMBER
//   projectId- scope "work" metrics + feed to one project
//   engagement - active | inactive | never
//
// Notes: "active days" are counted in UTC days. Login history only exists from
// when login-capture was deployed (no backfill possible).

const DAY = 86400000;
const VERBS: Record<string, string> = {
  USER_LOGIN: "logged in",
  USER_LOGOUT: "logged out",
  TASK_VIEWED: "opened a task",
  TASK_CREATED: "created a task",
  TASK_UPDATED: "updated a task",
  TASK_DELETED: "deleted a task",
  COMMENT_CREATED: "commented",
  COMMENT_UPDATED: "edited a comment",
  COMMENT_DELETED: "deleted a comment",
  ATTACHMENT_UPLOADED: "uploaded a file",
  ATTACHMENT_DOWNLOADED: "downloaded a file",
  ATTACHMENT_DELETED: "deleted a file",
  PROJECT_CREATED: "created a project",
  PROJECT_ARCHIVED: "removed a project",
  PROJECT_MEMBER_ADDED: "added a project member",
  PROJECT_MEMBER_REMOVED: "removed a project member",
  USER_ROLE_CHANGED: "changed a user role",
  USER_DEACTIVATED: "deactivated a user",
  USER_REACTIVATED: "reactivated a user",
  FEEDBACK_SUBMITTED: "submitted feedback",
  FEEDBACK_STATUS_CHANGED: "triaged feedback",
};

function relTime(d: Date, now: number): string {
  const s = Math.max(1, Math.floor((now - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sp = new URL(req.url).searchParams;
    const now = Date.now();

    // --- resolve time window ---
    const fromParam = sp.get("from");
    const toParam = sp.get("to");
    let days = parseInt(sp.get("days") || "7", 10);
    if (![7, 30, 90].includes(days)) days = 7;
    let windowStart: Date;
    let windowEnd: Date;
    if (fromParam && toParam) {
      windowStart = new Date(fromParam);
      // include the whole "to" day
      windowEnd = new Date(new Date(toParam).getTime() + DAY - 1);
      if (isNaN(windowStart.getTime()) || isNaN(windowEnd.getTime())) {
        windowStart = new Date(now - days * DAY);
        windowEnd = new Date(now);
      }
    } else {
      windowStart = new Date(now - days * DAY);
      windowEnd = new Date(now);
    }
    const sparkStart = new Date(now - 14 * DAY);
    const rawFetchStart = windowStart < sparkStart ? windowStart : sparkStart;

    const projectId = sp.get("projectId") || null;
    const roleFilter = sp.get("role"); // ADMIN | MEMBER
    const userIdFilter = sp.get("userId") || null;
    const engagement = sp.get("engagement"); // active | inactive | never

    // "work" metric scoping: a specific project, or all non-staging projects
    const taskScope: any = projectId
      ? { projectId }
      : { project: { isStaging: false } };
    const commentScope: any = projectId
      ? { task: { projectId } }
      : { task: { project: { isStaging: false } } };

    const inWindow = { gte: windowStart, lte: windowEnd };

    const [users, actionCounts, rawEvents, created, completed, comments] =
      await Promise.all([
        prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, email: true, role: true, lastSeenAt: true },
          orderBy: { name: "asc" },
        }),
        prisma.auditLog.groupBy({
          by: ["actorId", "action"],
          where: { occurredAt: inWindow, actorId: { not: null } },
          _count: { _all: true },
        }),
        prisma.auditLog.findMany({
          where: { occurredAt: { gte: rawFetchStart }, actorId: { not: null } },
          select: { actorId: true, occurredAt: true },
        }),
        prisma.task.groupBy({
          by: ["createdById"],
          where: { createdAt: inWindow, ...taskScope },
          _count: { _all: true },
        }),
        prisma.task.groupBy({
          by: ["assigneeId"],
          where: { completedAt: inWindow, assigneeId: { not: null }, ...taskScope },
          _count: { _all: true },
        }),
        prisma.comment.groupBy({
          by: ["authorId"],
          where: { createdAt: inWindow, ...commentScope },
          _count: { _all: true },
        }),
      ]);

    // fold groupBy results into per-user maps
    const loginsBy = new Map<string, number>();
    const updatedBy = new Map<string, number>();
    for (const r of actionCounts) {
      if (!r.actorId) continue;
      if (r.action === "USER_LOGIN") loginsBy.set(r.actorId, r._count._all);
      if (r.action === "TASK_UPDATED")
        updatedBy.set(r.actorId, (updatedBy.get(r.actorId) || 0) + r._count._all);
    }
    const createdBy = new Map(created.map((r) => [r.createdById, r._count._all]));
    const completedBy = new Map(
      completed.map((r) => [r.assigneeId as string, r._count._all])
    );
    const commentsBy = new Map(comments.map((r) => [r.authorId, r._count._all]));

    // activeDays (window) + 14-day spark + lastActive from raw events
    const last14 = Array.from({ length: 14 }, (_, i) =>
      dayKey(new Date(now - (13 - i) * DAY))
    );
    const activeDaysBy = new Map<string, Set<string>>();
    const sparkBy = new Map<string, Map<string, number>>();
    const lastActiveBy = new Map<string, Date>();
    for (const e of rawEvents) {
      if (!e.actorId) continue;
      const k = dayKey(e.occurredAt);
      if (e.occurredAt >= windowStart && e.occurredAt <= windowEnd) {
        let s = activeDaysBy.get(e.actorId);
        if (!s) activeDaysBy.set(e.actorId, (s = new Set()));
        s.add(k);
      }
      if (e.occurredAt >= sparkStart) {
        let m = sparkBy.get(e.actorId);
        if (!m) sparkBy.set(e.actorId, (m = new Map()));
        m.set(k, (m.get(k) || 0) + 1);
      }
      const prev = lastActiveBy.get(e.actorId);
      if (!prev || e.occurredAt > prev) lastActiveBy.set(e.actorId, e.occurredAt);
    }

    let usersOut = users.map((u) => {
      const spark = sparkBy.get(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        lastLoginAt: u.lastSeenAt,
        lastActiveAt: lastActiveBy.get(u.id) ?? null,
        logins: loginsBy.get(u.id) ?? 0,
        activeDays: activeDaysBy.get(u.id)?.size ?? 0,
        tasksCreated: createdBy.get(u.id) ?? 0,
        tasksCompleted: completedBy.get(u.id) ?? 0,
        commentsWritten: commentsBy.get(u.id) ?? 0,
        tasksUpdated: updatedBy.get(u.id) ?? 0,
        activitySpark: last14.map((k) => spark?.get(k) ?? 0),
      };
    });

    // --- apply user-set filters to the assembled list ---
    if (roleFilter === "ADMIN" || roleFilter === "MEMBER") {
      usersOut = usersOut.filter((u) => u.role === roleFilter);
    }
    if (userIdFilter) usersOut = usersOut.filter((u) => u.id === userIdFilter);
    if (engagement === "active") {
      usersOut = usersOut.filter((u) => u.activeDays > 0 || u.logins > 0);
    } else if (engagement === "inactive") {
      usersOut = usersOut.filter((u) => u.activeDays === 0 && u.logins === 0);
    } else if (engagement === "never") {
      usersOut = usersOut.filter((u) => !u.lastLoginAt);
    }

    const summary = {
      activeUsers: usersOut.filter((u) => u.activeDays > 0).length,
      totalLogins: usersOut.reduce((s, u) => s + u.logins, 0),
      tasksCompleted: usersOut.reduce((s, u) => s + u.tasksCompleted, 0),
      tasksCreated: usersOut.reduce((s, u) => s + u.tasksCreated, 0),
      commentsWritten: usersOut.reduce((s, u) => s + u.commentsWritten, 0),
    };

    // --- recent activity feed (respects window + userId + project filters) ---
    const feedWhere: any = { occurredAt: inWindow, actorId: { not: null } };
    if (userIdFilter) feedWhere.actorId = userIdFilter;
    if (projectId) {
      const projTasks = await prisma.task.findMany({
        where: { projectId },
        select: { id: true },
      });
      const taskIds = projTasks.map((t) => t.id);
      feedWhere.OR = [
        { resource: "task", resourceId: { in: taskIds } },
        { resource: "project", resourceId: projectId },
      ];
    }
    const recent = await prisma.auditLog.findMany({
      where: feedWhere,
      include: { actor: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 30,
    });
    const recentOut = recent.map((r) => ({
      id: r.id,
      actorName: r.actor?.name ?? "Someone",
      action: r.action,
      text: `${r.actor?.name ?? "Someone"} ${
        VERBS[r.action] ?? r.action.toLowerCase().replace(/_/g, " ")
      }`,
      relativeTime: relTime(r.occurredAt, now),
      occurredAt: r.occurredAt,
    }));

    return NextResponse.json({
      window: { from: windowStart, to: windowEnd, days: fromParam && toParam ? null : days },
      summary,
      users: usersOut,
      recent: recentOut,
    });
  } catch (error) {
    console.error("GET /api/admin/activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
