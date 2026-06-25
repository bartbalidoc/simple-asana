import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CATEGORIES = ["BUG", "FEATURE_REQUEST", "UI_UX", "PERFORMANCE", "COPY_TEXT", "OTHER"];
const COMPLEXITIES = ["SIMPLE", "COMPLEX", "UNKNOWN"];

// Best-effort: turn the raw feedback (+ any clarification transcript) into a
// structured {title, category, complexity, summary}. Done here on save so the
// result is consistent no matter how the user finished the chat — fixes feedback
// showing as "raw (no AI)" even though the assistant was used. Never throws.
async function structureFeedback(rawText: string, conversation?: string | null) {
  if (!OPENAI_API_KEY) return null;
  try {
    const userContent =
      `Feedback: ${rawText}` + (conversation ? `\n\nClarification transcript:\n${conversation}` : "");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You convert a user\'s feedback about an internal project-management web app into structured JSON. Respond ONLY with JSON: {"title": short headline under 8 words, "category": one of BUG, FEATURE_REQUEST, UI_UX, PERFORMANCE, COPY_TEXT, OTHER, "complexity": SIMPLE (copy/label/typo/tiny UI) or COMPLEX (data/auth/logic/multi-step) or UNKNOWN, "summary": 1-2 sentences stating concretely what to change}.',
          },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    if (!parsed.title) return null;
    return {
      title: String(parsed.title),
      category: CATEGORIES.includes(parsed.category) ? parsed.category : "OTHER",
      complexity: COMPLEXITIES.includes(parsed.complexity) ? parsed.complexity : "UNKNOWN",
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
    };
  } catch (e) {
    console.error("structureFeedback failed:", e);
    return null;
  }
}

// Save app feedback. Plaintext (not PHI) so a future Claude session can read it
// directly via SQL. Always saves, AI or not.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { rawText, conversation, pageContext, url } = body;

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    // Prefer fresh server-side structuring; fall back to anything the client
    // already produced from the chat, so AI-assisted feedback is marked as such.
    const structured = await structureFeedback(rawText.trim(), conversation);
    const clientTitle = typeof body.title === "string" ? body.title : null;
    const title = structured?.title ?? clientTitle;
    const category = structured?.category ?? (CATEGORIES.includes(body.category) ? body.category : null);
    const complexity =
      structured?.complexity ?? (COMPLEXITIES.includes(body.complexity) ? body.complexity : null);
    const summary = structured?.summary ?? (typeof body.summary === "string" ? body.summary : null);

    const feedback = await prisma.feedback.create({
      data: {
        rawText: rawText.trim(),
        conversation: typeof conversation === "string" ? conversation : null,
        pageContext: typeof pageContext === "string" ? pageContext : null,
        url: typeof url === "string" ? url : null,
        title,
        category: (title ? category ?? "OTHER" : null) as any,
        complexity: (title ? complexity ?? "UNKNOWN" : null) as any,
        summary,
        aiProcessed: !!title,
        submittedById: session.user.id,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "FEEDBACK_SUBMITTED",
      resource: "feedback",
      resourceId: feedback.id,
      metadata: { aiProcessed: !!title, category },
      req,
    });

    return NextResponse.json({ id: feedback.id, status: feedback.status }, { status: 201 });
  } catch (error) {
    console.error("POST /api/feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
