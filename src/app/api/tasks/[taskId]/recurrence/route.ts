import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTask } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import {
  nextOccurrence,
  describeRecurrence,
  LAST_DAY_SENTINEL,
} from "@/lib/recurrence";
import { RepeatEvery } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: { taskId: string };
}

// PUT /api/tasks/[taskId]/recurrence — set/replace a task's repeat rule.
// Body: { repeatEvery: "NONE"|"WEEKLY"|"MONTHLY", repeatOnDay: number }.
// MONTHLY repeatOnDay = 1..31 or 0 (= last day of month); WEEKLY = 0..6 (Sun..Sat).
// Only top-level tasks recur. Setting NONE (or DELETE) stops the series.
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canEditTask(taskId, session.user.id, session.user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, parentTaskId: true, seriesId: true },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (task.parentTaskId) {
      return NextResponse.json(
        { error: "Only a main task can repeat, not a subtask." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const repeatEvery = body?.repeatEvery as RepeatEvery;
    if (!["NONE", "WEEKLY", "MONTHLY"].includes(repeatEvery)) {
      return NextResponse.json({ error: "Invalid repeatEvery." }, { status: 400 });
    }

    if (repeatEvery === "NONE") {
      await prisma.task.update({
        where: { id: taskId },
        data: { repeatEvery: "NONE", repeatOnDay: null, nextRunAt: null },
      });
      await writeAuditLog({
        actorId: session.user.id,
        action: "TASK_UPDATED",
        resource: "task",
        resourceId: taskId,
        req,
        metadata: { recurrence: "stopped" },
      });
      return NextResponse.json({ repeatEvery: "NONE", nextRunAt: null });
    }

    // Validate + normalize repeatOnDay for the chosen cadence.
    let repeatOnDay = Number(body?.repeatOnDay);
    if (repeatEvery === "MONTHLY") {
      if (!Number.isInteger(repeatOnDay) || repeatOnDay < LAST_DAY_SENTINEL || repeatOnDay > 31) {
        return NextResponse.json(
          { error: "For monthly, pick a day 1–31 or 0 for the last day." },
          { status: 400 }
        );
      }
    } else {
      // WEEKLY
      if (!Number.isInteger(repeatOnDay) || repeatOnDay < 0 || repeatOnDay > 6) {
        return NextResponse.json(
          { error: "For weekly, pick a weekday 0 (Sun) – 6 (Sat)." },
          { status: 400 }
        );
      }
    }

    const next = nextOccurrence(repeatEvery, repeatOnDay, new Date());
    const seriesId = task.seriesId || task.id;

    await prisma.task.update({
      where: { id: taskId },
      data: { repeatEvery, repeatOnDay, nextRunAt: next, seriesId },
    });
    await writeAuditLog({
      actorId: session.user.id,
      action: "TASK_UPDATED",
      resource: "task",
      resourceId: taskId,
      req,
      metadata: { recurrence: describeRecurrence(repeatEvery, repeatOnDay) },
    });

    return NextResponse.json({
      repeatEvery,
      repeatOnDay,
      nextRunAt: next,
      description: describeRecurrence(repeatEvery, repeatOnDay),
    });
  } catch (error) {
    console.error("PUT /api/tasks/[taskId]/recurrence error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — convenience alias for "stop repeating".
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canEditTask(taskId, session.user.id, session.user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.task.update({
      where: { id: taskId },
      data: { repeatEvery: "NONE", repeatOnDay: null, nextRunAt: null },
    });
    return NextResponse.json({ repeatEvery: "NONE", nextRunAt: null });
  } catch (error) {
    console.error("DELETE /api/tasks/[taskId]/recurrence error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
