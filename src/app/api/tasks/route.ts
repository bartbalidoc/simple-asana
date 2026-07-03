import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { encrypt, decrypt } from "@/lib/encryption";
import { safeUserSelect } from "@/lib/safeUser";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      projectId,
      title,
      description,
      columnId,
      assigneeId,
      dueDate,
      priority,
      template = "general",
      parentTaskId,
      goal,
      expectedOutput,
      qualityRequirements,
      problem,
      currentWorkflow,
      desiredImprovement,
      automationOpportunity,
    } = body;

    if (!projectId || !title) {
      return NextResponse.json(
        { error: "projectId and title are required" },
        { status: 400 }
      );
    }

    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const titleEnc = encrypt(title);
    const descriptionEnc = description ? encrypt(description) : null;
    const goalEnc = goal ? encrypt(goal) : null;
    const expectedOutputEnc = expectedOutput ? encrypt(expectedOutput) : null;
    const qualityRequirementsEnc = qualityRequirements ? encrypt(qualityRequirements) : null;
    const problemEnc = problem ? encrypt(problem) : null;
    const currentWorkflowEnc = currentWorkflow ? encrypt(currentWorkflow) : null;
    const desiredImprovementEnc = desiredImprovement ? encrypt(desiredImprovement) : null;
    const automationOpportunityEnc = automationOpportunity
      ? encrypt(automationOpportunity)
      : null;

    const task = await prisma.task.create({
      data: {
        titleEnc,
        descriptionEnc,
        goalEnc,
        expectedOutputEnc,
        qualityRequirementsEnc,
        problemEnc,
        currentWorkflowEnc,
        desiredImprovementEnc,
        automationOpportunityEnc,
        template,
        projectId,
        columnId: columnId || null,
        parentTaskId: parentTaskId || null,
        createdById: session.user.id,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || "MEDIUM",
        order: typeof body.order === "number" ? body.order : 0,
      },
      include: {
        assignee: { select: safeUserSelect },
        createdBy: { select: safeUserSelect },
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "TASK_CREATED",
      resource: "task",
      resourceId: task.id,
      metadata: { projectId, assigneeId },
      req,
    });

    // If the task is created already assigned, grant the assignee access to the
    // project so they can see and work on it (mirrors the PATCH path).
    if (task.assigneeId) {
      await prisma.projectMember.upsert({
        where: {
          projectId_userId: { projectId: task.projectId, userId: task.assigneeId },
        },
        update: {},
        create: { projectId: task.projectId, userId: task.assigneeId },
      });
    }

    const decryptedTask = {
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
    };

    return NextResponse.json(decryptedTask, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
