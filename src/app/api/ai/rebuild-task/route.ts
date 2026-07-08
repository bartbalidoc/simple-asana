import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { canEditTask } from "@/lib/authz";
import { refineTask, anthropicEnabled } from "@/lib/anthropic";
import { NextRequest, NextResponse } from "next/server";

// "Rebuild with AI" for EXISTING board tasks (Bart's request): many tasks —
// especially old Asana imports — are in progress but poorly written. Claude
// restructures title/description/subtasks; the client shows a preview and
// only applies what the user accepts. This endpoint never writes anything.
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
    const instruction =
      typeof body?.instruction === "string" && body.instruction.trim()
        ? body.instruction.trim().slice(0, 2000)
        : "Rewrite this task into clear, professional, well-structured English. Make the title an outcome-focused imperative, the description 1-3 informative sentences, and break the work into concrete subtask steps where that clearly helps.";

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }
    if (!(await canEditTask(taskId, session.user.id, session.user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { subtasks: { orderBy: { order: "asc" }, select: { titleEnc: true } } },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const safeDecrypt = (v: string | null) => {
      if (!v) return "";
      try {
        return decrypt(v);
      } catch {
        return "";
      }
    };

    const refined = await refineTask(
      {
        title: safeDecrypt(task.titleEnc) || "(untitled)",
        description: safeDecrypt(task.descriptionEnc),
        priority: task.priority as "LOW" | "MEDIUM" | "HIGH",
        subtasks: task.subtasks.map((s) => safeDecrypt(s.titleEnc)).filter(Boolean),
      },
      instruction
    );

    return NextResponse.json({ proposal: refined });
  } catch (error) {
    console.error("POST /api/ai/rebuild-task error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rebuild the task." },
      { status: 500 }
    );
  }
}
