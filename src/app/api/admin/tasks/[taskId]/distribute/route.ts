import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

// Admin-only: copy a staged task (or subtask) into a real project — an existing
// one or a brand-new one created on the spot — and assign it to a person. A
// distributed subtask becomes a NEW TOP-LEVEL task in the destination.
//
// The staged original stays in place and gets `distributedAt` set, which the
// Staging view renders in a "Copied ✓" color. Copying clones the encrypted
// ciphertext directly (one key) — no decrypt/re-encrypt.

interface RouteParams {
  params: { taskId: string };
}

const STATUS_TO_COLUMN: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

async function upsertMembership(projectId: string, userId: string | null) {
  if (!userId) return;
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: {},
    create: { projectId, userId },
  });
}

async function copyTaskTree(
  sourceId: string,
  opts: {
    destProjectId: string;
    columnsByName: Map<string, string>;
    fallbackColumnId: string | null;
    parentTaskId: string | null;
    adminId: string;
    assigneeOverride?: string | null; // applies to the root only
  }
): Promise<string | null> {
  const src = await prisma.task.findUnique({
    where: { id: sourceId },
    include: { comments: true, subtasks: { orderBy: { order: "asc" } } },
  });
  if (!src) return null;

  const columnId =
    opts.columnsByName.get(STATUS_TO_COLUMN[src.status]) ?? opts.fallbackColumnId;

  // The root copy gets Sidney's chosen assignee (if she picked one); descendants
  // keep their own original assignee.
  const assigneeId =
    opts.parentTaskId === null && opts.assigneeOverride !== undefined
      ? opts.assigneeOverride
      : src.assigneeId;

  const copy = await prisma.task.create({
    data: {
      // Clone the encrypted ciphertext as-is (same key) — no decrypt needed.
      titleEnc: src.titleEnc,
      descriptionEnc: src.descriptionEnc,
      goalEnc: src.goalEnc,
      expectedOutputEnc: src.expectedOutputEnc,
      qualityRequirementsEnc: src.qualityRequirementsEnc,
      problemEnc: src.problemEnc,
      currentWorkflowEnc: src.currentWorkflowEnc,
      desiredImprovementEnc: src.desiredImprovementEnc,
      automationOpportunityEnc: src.automationOpportunityEnc,
      status: src.status,
      priority: src.priority,
      dueDate: src.dueDate,
      completedAt: src.completedAt,
      order: src.order,
      template: src.template,
      projectId: opts.destProjectId,
      columnId,
      assigneeId,
      createdById: opts.adminId,
      parentTaskId: opts.parentTaskId,
      // Keep "who originally owned this" visible on the copy.
      originalAssignee: src.originalAssignee,
      comments: {
        create: src.comments.map((c) => ({
          bodyEnc: c.bodyEnc,
          authorId: c.authorId,
          createdAt: c.createdAt,
        })),
      },
    },
  });

  await upsertMembership(opts.destProjectId, assigneeId);

  for (const sub of src.subtasks) {
    await copyTaskTree(sub.id, {
      ...opts,
      parentTaskId: copy.id,
      assigneeOverride: undefined,
    });
  }

  return copy.id;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { taskId } = params;
    const body = await req.json();
    const newProjectName: string | undefined = body?.newProjectName?.trim() || undefined;
    let destProjectId: string | undefined = body?.destProjectId || undefined;
    const assigneeOverride =
      "assigneeId" in (body || {}) ? (body.assigneeId || null) : undefined;

    // The source must be a staged task.
    const source = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { isStaging: true } } },
    });
    if (!source) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (!source.project.isStaging) {
      return NextResponse.json(
        { error: "Only staged tasks can be distributed" },
        { status: 400 }
      );
    }

    // Resolve / create the destination project.
    if (newProjectName) {
      const created = await prisma.project.create({
        data: {
          name: newProjectName,
          isStaging: false,
          members: { create: { userId: session.user.id } },
          columns: {
            createMany: {
              data: [
                { name: "To Do", order: 0 },
                { name: "In Progress", order: 1 },
                { name: "In Review", order: 2 },
                { name: "Done", order: 3 },
              ],
            },
          },
        },
      });
      destProjectId = created.id;
    }

    if (!destProjectId) {
      return NextResponse.json(
        { error: "Pick a destination project or provide newProjectName" },
        { status: 400 }
      );
    }

    const destProject = await prisma.project.findUnique({
      where: { id: destProjectId },
      include: { columns: { orderBy: { order: "asc" } } },
    });
    if (!destProject) {
      return NextResponse.json(
        { error: "Destination project not found" },
        { status: 400 }
      );
    }
    if (destProject.isStaging) {
      return NextResponse.json(
        { error: "Cannot distribute into a staging project" },
        { status: 400 }
      );
    }

    const columnsByName = new Map(destProject.columns.map((c) => [c.name, c.id]));
    const fallbackColumnId = destProject.columns[0]?.id ?? null;

    const newRootId = await copyTaskTree(taskId, {
      destProjectId,
      columnsByName,
      fallbackColumnId,
      parentTaskId: null, // a distributed subtask becomes a top-level task
      adminId: session.user.id,
      assigneeOverride,
    });

    // Mark the staged original as distributed (keeps it, recolors it).
    await prisma.task.update({
      where: { id: taskId },
      data: { distributedAt: new Date() },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "TASK_CREATED",
      resource: "task",
      resourceId: newRootId || taskId,
      metadata: { distributedFrom: taskId, destProjectId },
      req,
    });

    return NextResponse.json({
      ok: true,
      newTaskId: newRootId,
      destProjectId,
      destProjectName: destProject.name,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("POST /api/admin/tasks/[taskId]/distribute error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
