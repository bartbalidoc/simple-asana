import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

const CATEGORIES = ["BUG", "FEATURE_REQUEST", "UI_UX", "PERFORMANCE", "COPY_TEXT", "OTHER"];
const COMPLEXITIES = ["SIMPLE", "COMPLEX", "UNKNOWN"];

// Save app feedback. Plaintext (not PHI) so a future Claude session can read it
// directly via SQL. AI fields are optional — feedback is never lost if AI failed.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { rawText, conversation, pageContext, url, title, category, complexity, summary } = body;

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    const safeCategory = CATEGORIES.includes(category) ? category : title ? "OTHER" : null;
    const safeComplexity = COMPLEXITIES.includes(complexity) ? complexity : title ? "UNKNOWN" : null;

    const feedback = await prisma.feedback.create({
      data: {
        rawText: rawText.trim(),
        conversation: typeof conversation === "string" ? conversation : null,
        pageContext: typeof pageContext === "string" ? pageContext : null,
        url: typeof url === "string" ? url : null,
        title: typeof title === "string" ? title : null,
        category: safeCategory as any,
        complexity: safeComplexity as any,
        summary: typeof summary === "string" ? summary : null,
        aiProcessed: !!title,
        submittedById: session.user.id,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "FEEDBACK_SUBMITTED",
      resource: "feedback",
      resourceId: feedback.id,
      metadata: { aiProcessed: !!title, category: safeCategory },
      req,
    });

    return NextResponse.json({ id: feedback.id, status: feedback.status }, { status: 201 });
  } catch (error) {
    console.error("POST /api/feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
