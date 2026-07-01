import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { transcriptToTasks, anthropicEnabled } from "@/lib/anthropic";

// Feedback #6: analyze a meeting transcript with Claude and return a DRAFT task
// list. This endpoint only previews tasks — it never creates them. The client
// lets the user review/edit, pick a project, then creates via POST /api/tasks.
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
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";

    if (transcript.length < 20) {
      return NextResponse.json(
        { error: "Please paste a longer transcript (at least a few sentences)." },
        { status: 400 }
      );
    }
    // Guardrail against runaway cost / oversized requests.
    if (transcript.length > 100_000) {
      return NextResponse.json(
        { error: "Transcript is too long (max ~100,000 characters). Split it up." },
        { status: 413 }
      );
    }

    const tasks = await transcriptToTasks(transcript);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("POST /api/ai/transcript-to-tasks error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to analyze the transcript.",
      },
      { status: 500 }
    );
  }
}
