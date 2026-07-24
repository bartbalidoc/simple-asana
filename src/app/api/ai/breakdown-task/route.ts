import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { canEditTask } from "@/lib/authz";
import { breakdownTaskToSmartSteps, anthropicEnabled } from "@/lib/anthropic";
import { NextRequest, NextResponse } from "next/server";

// SMART breakdown with AI (Phase 3, v2.9): turn a task OR subtask into concrete,
// doable steps — with live web research, tips & tricks, and an emailable plan of
// approach. Mirrors /api/ai/rebuild-task: propose-only, this route NEVER writes.
// The user applies whichever steps they want from My Day.

const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!anthropicEnabled()) {
      return NextResponse.json(
        { error: "Claude is not configured (missing ANTHROPIC_API_KEY)." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const taskId = typeof body?.taskId === "string" ? body.taskId : "";
    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }
    if (!(await canEditTask(taskId, session.user.id, session.user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { name: true } },
        assignee: { select: { name: true } },
        parentTask: { select: { titleEnc: true, descriptionEnc: true } },
        subtasks: { orderBy: { order: "asc" }, select: { titleEnc: true, status: true } },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const safe = (v: string | null | undefined) => {
      if (!v) return "";
      try {
        return decrypt(v);
      } catch {
        return "";
      }
    };

    const title = safe(task.titleEnc) || "(untitled)";
    // A subtask alone is usually terse — give the model its parent's context too.
    const parentBlock = task.parentTaskId
      ? [
          `THIS IS A SUBTASK OF: ${safe(task.parentTask?.titleEnc) || "(untitled)"}`,
          safe(task.parentTask?.descriptionEnc) &&
            `PARENT CONTEXT:\n${safe(task.parentTask?.descriptionEnc)}`,
        ]
      : [];

    const dump = [
      `TASK: ${title}`,
      `PROJECT: ${task.project?.name || ""}`,
      `ASSIGNEE: ${task.assignee?.name || "Unassigned"}`,
      task.dueDate && `DUE: ${fmtDate(task.dueDate)}`,
      `PRIORITY: ${task.priority}`,
      ...parentBlock,
      safe(task.descriptionEnc) && `DESCRIPTION:\n${safe(task.descriptionEnc)}`,
      // Structured "template" fields, when the task was created from a template.
      safe(task.goalEnc) && `GOAL:\n${safe(task.goalEnc)}`,
      safe(task.expectedOutputEnc) && `EXPECTED OUTPUT:\n${safe(task.expectedOutputEnc)}`,
      safe(task.qualityRequirementsEnc) && `QUALITY REQUIREMENTS:\n${safe(task.qualityRequirementsEnc)}`,
      safe(task.problemEnc) && `PROBLEM:\n${safe(task.problemEnc)}`,
      safe(task.currentWorkflowEnc) && `CURRENT WORKFLOW:\n${safe(task.currentWorkflowEnc)}`,
      safe(task.desiredImprovementEnc) && `DESIRED IMPROVEMENT:\n${safe(task.desiredImprovementEnc)}`,
      safe(task.automationOpportunityEnc) &&
        `AUTOMATION OPPORTUNITY:\n${safe(task.automationOpportunityEnc)}`,
      task.subtasks.length &&
        `EXISTING SUBTASKS:\n${task.subtasks
          .map((s) => `- [${s.status === "DONE" ? "x" : " "}] ${safe(s.titleEnc)}`)
          .join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const proposal = await breakdownTaskToSmartSteps(dump);

    return NextResponse.json({ proposal, taskTitle: title });
  } catch (error) {
    console.error("POST /api/ai/breakdown-task error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to break down the task." },
      { status: 500 }
    );
  }
}
