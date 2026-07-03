import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeUserSelect } from "@/lib/safeUser";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: {
    projectId: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { projectId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only members of the project (or admins) may see its roster.
    if (session.user.role !== "ADMIN") {
      const membership = await prisma.projectMember.findFirst({
        where: { projectId, userId: session.user.id },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: safeUserSelect },
      },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("GET /api/projects/[projectId]/members error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { projectId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Any member of the project can add teammates (admins too)
    const requesterMembership = await prisma.projectMember.findFirst({
      where: { projectId, userId: session.user.id },
    });

    if (!requesterMembership && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: user.id,
      },
      include: {
        user: { select: safeUserSelect },
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "PROJECT_MEMBER_ADDED",
      resource: "project_member",
      resourceId: member.id,
      metadata: { projectId, userId: user.id },
      req,
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "User is already a member of this project" },
        { status: 409 }
      );
    }

    console.error("POST /api/projects/[projectId]/members error:", error);
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

    // Any member of the project (or an admin) can remove people from it
    const requesterMembership = await prisma.projectMember.findFirst({
      where: { projectId, userId: session.user.id },
    });

    if (!requesterMembership && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const member = await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "PROJECT_MEMBER_REMOVED",
      resource: "project_member",
      resourceId: member.id,
      metadata: { projectId, userId },
      req,
    });

    return NextResponse.json(member);
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Project member not found" },
        { status: 404 }
      );
    }

    console.error("DELETE /api/projects/[projectId]/members error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
