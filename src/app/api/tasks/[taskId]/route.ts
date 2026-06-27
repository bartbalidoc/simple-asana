import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { encrypt, decrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: {
    taskId: string;
  };
}

async function checkTaskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  return !!task?.project.members.length;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess =
      session.user.role === "ADMIN" ||
      (await checkTaskAccess(taskId, session.user.id));

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: true,
        createdBy: true,
        project: { select: { isStaging: true, name: true } },
        comments: {
          include: { author: true },
        },
        attachments: true,
        subtasks: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const decrypted = {
      ...task,
      title: decrypt(task.titleEnc),
      description: task.descriptionEnc ? decrypt(task.descriptionEnc) : null,
      goal: task.goalEnc ? decrypt(task.goalEnc) : null,
      expectedOutput: task.expectedOutputEnc ? decrypt(task.expectedOutputEnc) : null,
      qualityRequirements: task.qualityRequirementsEnc
        ? decrypt(task.qualityRequirementsEnc)
        : null,
      problem: task.problemEnc ? decrypt(task.problemEnc) : null,
      currentWorkflow: task.currentWorkflowEnc ? decrypt(task.currentWorkflowEnc) : null,
      desiredImprovement: task.desiredImprovementEnc
        ? decrypt(task.desiredImprovementEnc)
        : null,
      automationOpportunity: task.automationOpportunityEnc
        ? decrypt(task.automationOpportunityEnc)
        : null,
      subtasks: task.subtasks?.map((st) => ({
        ...st,
        title: decrypt(st.titleEnc),
        description: st.descriptionEnc ? decrypt(st.descriptionEnc) : null,
      })) || [],
      comments: task.comments?.map((c) => ({
        ...c,
        body: c.bodyEnc ? decrypt(c.bodyEnc) : "",
      })) || [],
    };

    await writeAuditLog({
      actorId: session.user.id,
      action: "TASK_VIEWED",
      resource: "task",
      resourceId: taskId,
      req,
    });

    return NextResponse.json(decrypted);
  } catch (error) {
    console.error("GET /api/tasks/[taskId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess =
      session.user.role === "ADMIN" ||
      (await checkTaskAccess(taskId, session.user.id));

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    const updateData: any = {};

    if (body.title !== undefined) updateData.titleEnc = encrypt(body.title);
    if (body.description !== undefined)
      updateData.descriptionEnc = body.description ? encrypt(body.description) : null;
    if (body.goal !== undefined)
      updateData.goalEnc = body.goal ? encrypt(body.goal) : null;
    if (body.expectedOutput !== undefined)
      updateData.expectedOutputEnc = body.expectedOutput
        ? encrypt(body.expectedOutput)
        : null;
    if (body.qualityRequirements !== undefined)
      updateData.qualityRequirementsEnc = body.qualityRequirements
        ? encrypt(body.qualityRequirements)
        : null;
    if (body.problem !== undefined)
      updateData.problemEnc = body.problem ? encrypt(body.problem) : null;
    if (body.currentWorkflow !== undefined)
      updateData.currentWorkflowEnc = body.currentWorkflow
        ? encrypt(body.currentWorkflow)
        : null;
    if (body.desiredImprovement !== undefined)
      updateData.desiredImprovementEnc = body.desiredImprovement
        ? encrypt(body.desiredImprovement)
        : null;
    if (body.automationOpportunity !== undefined)
      updateData.automationOpportunityEnc = body.automationOpportunity
        ? encrypt(body.automationOpportunity)
        : null;
    if (body.status !== undefined) {
      updateData.status = body.status;

      // When status changes, also update columnId to match the column for that status
      const statusToColumnName: Record<string, string> = {
        TODO: "To Do",
        IN_PROGRESS: "In Progress",
        IN_REVIEW: "In Review",
        DONE: "Done",
      };

      const currentTask = await prisma.task.findUnique({
        where: { id: taskId },
        include: { project: { include: { columns: true } } },
      });

      // Maintain completedAt on the normal lifecycle (powers the Activity view's
      // "tasks completed"). Set when entering DONE; clear when leaving it. Don't
      // overwrite the original completion time if it's already DONE.
      if (body.status === "DONE" && currentTask?.status !== "DONE") {
        updateData.completedAt = new Date();
      } else if (body.status !== "DONE") {
        updateData.completedAt = null;
      }

      if (currentTask?.project) {
        const targetColumnName = statusToColumnName[body.status];
        const targetColumn = currentTask.project.columns.find(
          (c) => c.name === targetColumnName
        );
        if (targetColumn) {
          console.log(
            `Status ${taskId}: ${body.status} → columnId ${targetColumn.id} (${targetColumnName})`
          );
          updateData.columnId = targetColumn.id;
        } else {
          console.warn(
            `Status ${taskId}: Could not find column for ${targetColumnName}. Available columns:`,
            currentTask.project.columns.map((c) => c.name)
          );
        }
      }
    }

    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.assigneeId !== undefined) updateData.assigneeId = body.assigneeId;
    if (body.columnId !== undefined) updateData.columnId = body.columnId;
    if (body.order !== undefined) updateData.order = body.order;
    if (body.template !== undefined) updateData.template = body.template;

    // Resolve the task's project so assigning grants the assignee access to it.
    let assigneeProjectId: string | null = null;
    if (body.assigneeId !== undefined) {
      const existingTask = await prisma.task.findUnique({
        where: { id: taskId },
        select: { projectId: true },
      });
      assigneeProjectId = existingTask?.projectId ?? null;

      // Assigning a task to someone grants them access to its project so they
      // can actually see and work on it.
      if (body.assigneeId && assigneeProjectId) {
        await prisma.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: assigneeProjectId,
              userId: body.assigneeId,
            },
          },
          update: {},
          create: { projectId: assigneeProjectId, userId: body.assigneeId },
        });
      }
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: true,
        createdBy: true,
        subtasks: {
          orderBy: { order: "asc" },
        },
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "TASK_UPDATED",
      resource: "task",
      resourceId: taskId,
      metadata: { updated: Object.keys(body) },
      req,
    });

    const decrypted = {
      ...task,
      title: decrypt(task.titleEnc),
      description: task.descriptionEnc ? decrypt(task.descriptionEnc) : null,
      goal: task.goalEnc ? decrypt(task.goalEnc) : null,
      expectedOutput: task.expectedOutputEnc ? decrypt(task.expectedOutputEnc) : null,
      qualityRequirements: task.qualityRequirementsEnc
        ? decrypt(task.qualityRequirementsEnc)
        : null,
      problem: task.problemEnc ? decrypt(task.problemEnc) : null,
      currentWorkflow: task.currentWorkflowEnc ? decrypt(task.currentWorkflowEnc) : null,
      desiredImprovement: task.desiredImprovementEnc
        ? decrypt(task.desiredImprovementEnc)
        : null,
      automationOpportunity: task.automationOpportunityEnc
        ? decrypt(task.automationOpportunityEnc)
        : null,
      subtasks: task.subtasks?.map((st) => ({
        ...st,
        title: decrypt(st.titleEnc),
        description: st.descriptionEnc ? decrypt(st.descriptionEnc) : null,
      })) || [],
    };

    return NextResponse.json(decrypted);
  } catch (error) {
    console.error("PATCH /api/tasks/[taskId] error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess =
      session.user.role === "ADMIN" ||
      (await checkTaskAccess(taskId, session.user.id));

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const task = await prisma.task.delete({
      where: { id: taskId },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "TASK_DELETED",
      resource: "task",
      resourceId: taskId,
      req,
    });

    return NextResponse.json(task);
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    console.error("DELETE /api/tasks/[taskId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
