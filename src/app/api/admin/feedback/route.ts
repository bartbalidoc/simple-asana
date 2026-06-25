import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

const STATUSES = ["NEW", "TRIAGED", "FIXED", "NEEDS_OWNER", "WONT_FIX"];

// List feedback for the admin triage view.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)));

    const where: any = {};
    if (status && STATUSES.includes(status)) where.status = status;

    const [feedback, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: { submittedBy: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.feedback.count({ where }),
    ]);

    return NextResponse.json({ feedback, pagination: { page, limit, total } });
  } catch (error) {
    console.error("GET /api/admin/feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Update a feedback item's triage status / notes (admin, or Claude via session).
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, triageNotes, resolvedCommit } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (status && !STATUSES.includes(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }

    const data: any = {};
    if (status) data.status = status;
    if (typeof triageNotes === "string") data.triageNotes = triageNotes;
    if (typeof resolvedCommit === "string") data.resolvedCommit = resolvedCommit;
    if (status === "FIXED" || status === "WONT_FIX") data.resolvedAt = new Date();

    const feedback = await prisma.feedback.update({ where: { id }, data });

    await writeAuditLog({
      actorId: session.user.id,
      action: "FEEDBACK_STATUS_CHANGED",
      resource: "feedback",
      resourceId: id,
      metadata: { status },
      req,
    });

    return NextResponse.json(feedback);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }
    console.error("PATCH /api/admin/feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Delete a feedback item (admin). Use ?id=<feedbackId>.
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.feedback.delete({ where: { id } });

    await writeAuditLog({
      actorId: session.user.id,
      action: "FEEDBACK_STATUS_CHANGED",
      resource: "feedback",
      resourceId: id,
      metadata: { deleted: true },
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }
    console.error("DELETE /api/admin/feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
