import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { decrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: {
    projectId: string;
  };
}

async function checkProjectAccess(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });

  return !!member;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { projectId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admins can view any project; workers must already be a member.
    if (session.user.role !== "ADMIN") {
      const membership = await prisma.projectMember.findFirst({
        where: { projectId, userId: session.user.id },
      });
      if (!membership) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        columns: {
          orderBy: { order: "asc" },
        },
        tasks: {
          include: {
            assignee: true,
            createdBy: true,
            subtasks: true,
          },
          where: {
            parentTaskId: null,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Hidden staging projects (Asana imports) are admin-only.
    if (project.isStaging && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Decrypt task titles and descriptions
    const decryptedProject = {
      ...project,
      tasks: project.tasks.map((task) => ({
        ...task,
        title: decrypt(task.titleEnc),
        description: task.descriptionEnc ? decrypt(task.descriptionEnc) : null,
        subtasks: task.subtasks?.map((st) => ({
          ...st,
          title: decrypt(st.titleEnc),
          description: st.descriptionEnc ? decrypt(st.descriptionEnc) : null,
        })) || [],
      })),
    };

    return NextResponse.json(decryptedProject);
  } catch (error) {
    console.error("GET /api/projects/[projectId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { projectId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Any member of the project (or an admin) can edit it
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId: session.user.id },
    });

    if (!membership && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, archived, order } = body;

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(archived !== undefined && {
          archivedAt: archived ? new Date() : null,
        }),
        // Sidebar drag-to-reorder (feedback #5).
        ...(order !== undefined && { order }),
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "PROJECT_CREATED",
      resource: "project",
      resourceId: project.id,
      metadata: { updated: Object.keys(body) },
      req,
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("PATCH /api/projects/[projectId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { projectId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins delete projects (this cascades to its tasks/columns/members).
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only an admin can delete a project" },
        { status: 403 }
      );
    }

    const project = await prisma.project.delete({
      where: { id: projectId },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "PROJECT_ARCHIVED",
      resource: "project",
      resourceId: projectId,
      metadata: { name: project.name, deleted: true },
      req,
    });

    return NextResponse.json(project);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    console.error("DELETE /api/projects/[projectId] error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
