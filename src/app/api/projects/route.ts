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
        members: true,
        tasks: true,
        columns: {
          orderBy: { order: "asc" },
        },
      },
      // Sidebar order (feedback #5); stable tiebreak by name for equal orders.
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(projects);
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
              { name: "In Review", order: 2 },
              { name: "Done", order: 3 },
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
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("POST /api/projects error:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
