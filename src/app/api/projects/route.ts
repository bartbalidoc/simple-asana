import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admins see every project; workers see only the projects they belong to.
    // Hidden "Staging" projects (Asana imports) are excluded here for everyone —
    // they appear only in the admin Staging view (GET /api/admin/staging).
    const isAdmin = session.user.role === "ADMIN";

    const projects = await prisma.project.findMany({
      where: isAdmin
        ? { isStaging: false }
        : {
            isStaging: false,
            members: {
              some: {
                userId: session.user.id,
              },
            },
          },
      include: {
        columns: {
          orderBy: { order: "asc" },
        },
        _count: { select: { members: true } },
      },
      // Sidebar order (feedback #5); stable tiebreak by name for equal orders.
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });

    // Per-status task counts in one grouped query instead of shipping every task
    // row (each with encrypted blobs) — that made this endpoint crawl for admins.
    const counts = await prisma.task.groupBy({
      by: ["projectId", "status"],
      _count: { _all: true },
      where: { projectId: { in: projects.map((p) => p.id) } },
    });
    const byProject: Record<string, Record<string, number>> = {};
    for (const c of counts) {
      (byProject[c.projectId] ||= {})[c.status] = c._count._all;
    }

    return NextResponse.json(
      projects.map((p) => {
        const c = byProject[p.id] || {};
        const total = Object.values(c).reduce((a, b) => a + b, 0);
        return {
          ...p,
          memberCount: p._count.members,
          taskCounts: {
            total,
            todo: c.TODO || 0,
            inProgress: c.IN_PROGRESS || 0,
            done: c.DONE || 0,
          },
        };
      })
    );
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins create projects; workers are assigned to them.
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only an admin can create projects" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Ensure user exists in database
    await prisma.user.upsert({
      where: { id: session.user.id },
      update: {},
      create: {
        id: session.user.id,
        email: session.user.email || "unknown@unknown.com",
        name: session.user.name || "User",
      },
    });

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        members: {
          create: {
            userId: session.user.id,
          },
        },
        columns: {
          createMany: {
            data: [
              { name: "To Do", order: 0 },
              { name: "In Progress", order: 1 },
              { name: "Blocked", order: 2 },
              { name: "In Review", order: 3 },
              { name: "Done", order: 4 },
            ],
          },
        },
      },
      include: {
        members: true,
        columns: true,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "PROJECT_CREATED",
      resource: "project",
      resourceId: project.id,
      metadata: { name: project.name },
      req,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
