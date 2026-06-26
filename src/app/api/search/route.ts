import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

// Global search across projects + tasks the signed-in user can see.
// Task titles are encrypted, so they're decrypted server-side and matched in JS.
// Hidden "Staging" projects are excluded (they have their own admin view).
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = (new URL(req.url).searchParams.get("q") || "").trim();
    if (q.length < 2) {
      return NextResponse.json({ projects: [], tasks: [] });
    }
    const ql = q.toLowerCase();

    const isAdmin = session.user.role === "ADMIN";
    const projectScope = isAdmin
      ? { isStaging: false }
      : { isStaging: false, members: { some: { userId: session.user.id } } };

    const [projects, candidateTasks] = await Promise.all([
      prisma.project.findMany({
        where: { ...projectScope, name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true },
        take: 6,
        orderBy: { updatedAt: "desc" },
      }),
      // Pull a bounded set of accessible tasks, then decrypt + match titles.
      prisma.task.findMany({
        where: { project: projectScope },
        select: {
          id: true,
          titleEnc: true,
          projectId: true,
          parentTaskId: true,
          project: { select: { name: true } },
        },
        take: 800,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const tasks = candidateTasks
      .map((t) => {
        let title = "";
        try {
          title = decrypt(t.titleEnc);
        } catch {
          title = "";
        }
        return {
          id: t.id,
          title,
          projectId: t.projectId,
          projectName: t.project?.name || "",
          isSubtask: !!t.parentTaskId,
        };
      })
      .filter((t) => t.title.toLowerCase().includes(ql))
      .slice(0, 8);

    return NextResponse.json({ projects, tasks });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
