import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { proofreadText, anthropicEnabled } from "@/lib/anthropic";

// Proofread a comment with Claude (feedback: fix hard-to-read English before
// posting). Returns the corrected text; the client shows it for the user to
// accept or discard. Never stores anything.
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
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (text.length < 2) {
      return NextResponse.json({ error: "Nothing to proofread." }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json(
        { error: "That's a bit long to proofread — keep it under 5,000 characters." },
        { status: 413 }
      );
    }

    const corrected = await proofreadText(text);
    return NextResponse.json({ corrected });
  } catch (error) {
    console.error("POST /api/ai/proofread error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to proofread." },
      { status: 500 }
    );
  }
}
