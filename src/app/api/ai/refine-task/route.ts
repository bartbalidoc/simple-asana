import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { refineTask, anthropicEnabled, RefinableTask } from "@/lib/anthropic";

// "Fix with AI": take one draft task + a free-text correction instruction and
// return the fully rewritten task. Used from the transcript review UI so users
// working with non-native-English drafts can make big corrections in one step.
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
    const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
    const t = body?.task;

    if (!t || typeof t.title !== "string") {
      return NextResponse.json({ error: "A task is required." }, { status: 400 });
    }
    if (instruction.length < 2) {
      return NextResponse.json(
        { error: "Tell Claude what to change (a few words is enough)." },
        { status: 400 }
      );
    }
    if (instruction.length > 2000) {
      return NextResponse.json({ error: "Instruction is too long." }, { status: 413 });
    }

    const task: RefinableTask = {
      title: String(t.title),
      description: typeof t.description === "string" ? t.description : "",
      priority: ["LOW", "MEDIUM", "HIGH"].includes(t.priority) ? t.priority : "MEDIUM",
      subtasks: Array.isArray(t.subtasks)
        ? t.subtasks.filter((s: any) => typeof s === "string")
        : [],
    };

    const refined = await refineTask(task, instruction);
    return NextResponse.json({ task: refined });
  } catch (error) {
    console.error("POST /api/ai/refine-task error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refine the task." },
      { status: 500 }
    );
  }
}
