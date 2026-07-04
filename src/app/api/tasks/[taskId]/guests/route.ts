import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { safeUserSelect } from "@/lib/safeUser";
import { canViewTask, canEditTask } from "@/lib/authz";
import { createNotifications } from "@/lib/notifications";
import { decrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: {
    taskId: string;
  };
}

// Task guests: people invited to ONE task without project membership.

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canViewTask(taskId, session.user.id, session.user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const guests = await prisma.taskGuest.findMany({
      where: { taskId },
      include: { user: { select: safeUserSelect } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(guests);
  } catch (error) {
    console.error("GET /api/tasks/[taskId]/guests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Only project members/admins can pull outsiders into a task.
    if (!(await canEditTask(taskId, session.user.id, session.user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const userId = typeof body?.userId === "string" ? body.userId : "";
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true, titleEnc: true, parentTaskId: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Members don't need guest access — they already see the whole board.
    const isMember = await prisma.projectMember.findFirst({
      where: { projectId: task.projectId, userId },
      select: { id: true },
    });
    if (isMember) {
      return NextResponse.json(
        { error: `${user.name} is already a member of this project.` },
        { status: 409 }
      );
    }

    const guest = await prisma.taskGuest.upsert({
      where: { taskId_userId: { taskId, userId } },
      update: {},
      create: { taskId, userId, addedById: session.user.id },
      include: { user: { select: safeUserSelect } },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "TASK_UPDATED",
      resource: "task",
      resourceId: taskId,
      metadata: { guestAdded: userId },
      req,
    });

    const title = (() => {
      try {
        return decrypt(task.titleEnc);
      } catch {
        return "a task";
      }
    })();
    await createNotifications({
      recipientIds: userId === session.user.id ? [] : [userId],
      actorName: session.user.name || "Someone",
      type: "ASSIGNED",
      message: `${session.user.name || "Someone"} added you as a guest on "${title}"`,
      taskId: task.parentTaskId || taskId,
      projectId: task.projectId,
    });

    return NextResponse.json(guest, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks/[taskId]/guests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "";
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (!(await canEditTask(taskId, session.user.id, session.user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.taskGuest.deleteMany({ where: { taskId, userId } });

    await writeAuditLog({
      actorId: session.user.id,
      action: "TASK_UPDATED",
      resource: "task",
      resourceId: taskId,
      metadata: { guestRemoved: userId },
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/tasks/[taskId]/guests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
