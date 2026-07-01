import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Persist the sidebar drag-to-reorder (feedback #5). Body: { orderedIds: string[] }
// in the desired top→bottom order. We renumber (order = index) in one transaction
// so there are never colliding/duplicate order values. A user may only reorder the
// projects they can access (admins: any); unknown/forbidden ids are ignored.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const orderedIds: unknown = body?.orderedIds;
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "orderedIds must be a string[]" }, { status: 400 });
    }

    // Restrict to projects the user is actually a member of (admins: all).
    let allowedIds = orderedIds as string[];
    if (session.user.role !== "ADMIN") {
      const memberships = await prisma.projectMember.findMany({
        where: { userId: session.user.id, projectId: { in: allowedIds } },
        select: { projectId: true },
      });
      const memberSet = new Set(memberships.map((m) => m.projectId));
      allowedIds = allowedIds.filter((id) => memberSet.has(id));
    }

    await prisma.$transaction(
      allowedIds.map((id, index) =>
        prisma.project.update({ where: { id }, data: { order: index } })
      )
    );

    return NextResponse.json({ ok: true, count: allowedIds.length });
  } catch (error) {
    console.error("POST /api/projects/reorder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
