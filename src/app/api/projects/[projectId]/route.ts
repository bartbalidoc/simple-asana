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

    // Slim selects: full user rows leaked passwordHash to the client and bloated
    // the payload — the board only needs id/name/email/avatar/role.
    const userSelect = { id: true, name: true, email: true, avatarUrl: true, role: true };
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: { select: userSelect },
          },
        },
        columns: {
          orderBy: { order: "asc" },
        },
        tasks: {
          include: {
            assignee: { select: userSelect },
            createdBy: { select: userSelect },
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

    // Decrypt task titles and descriptions; drop the ciphertext fields from the
    // response — the client never uses them and they roughly double the payload.
    const stripEnc = <T extends Record<string, unknown>>(obj: T) => {
      const out: Record<string, unknown> = { ...obj };
      for (const k of Object.keys(out)) if (k.endsWith("Enc")) delete out[k];
      return out;
    };
    const decryptedProject = {
      ...project,
      tasks: project.tasks.map((task) => ({
        ...stripEnc(task),
        title: decrypt(task.titleEnc),
        description: task.descriptionEnc ? decrypt(task.descriptionEnc) : null,
        subtasks: task.subtasks?.map((st) => ({
          ...stripEnc(st),
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
      action: "PROJECT_UPDATED",
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
      // A cascade delete destroys the project's tasks/comments/attachments — the
      // audit trail must say so plainly, not "archived".
      action: "PROJECT_DELETED",
      resource: "project",
      resourceId: projectId,
      metadata: { name: project.name },
      req,
    });

    return NextResponse.json(project);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    console.error("DELETE /api/projects/[projectId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
