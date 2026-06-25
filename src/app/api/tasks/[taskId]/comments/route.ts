import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { encrypt, decrypt } from "@/lib/encryption";
import { notifyMentions } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: {
    taskId: string;
  };
}

async function checkTaskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  return !!task?.project.members.length;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await checkTaskAccess(taskId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const decrypted = comments.map((c) => ({
      ...c,
      body: decrypt(c.bodyEnc),
    }));

    return NextResponse.json(decrypted);
  } catch (error) {
    console.error("GET /api/tasks/[taskId]/comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await checkTaskAccess(taskId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { body: commentBody } = body;

    if (!commentBody || typeof commentBody !== "string") {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const bodyEnc = encrypt(commentBody);

    const comment = await prisma.comment.create({
      data: {
        bodyEnc,
        taskId,
        authorId: session.user.id,
      },
      include: {
        author: true,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "COMMENT_CREATED",
      resource: "comment",
      resourceId: comment.id,
      metadata: { taskId },
      req,
    });

    // Email anyone @mentioned in the comment.
    const taskForProject = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (taskForProject?.projectId) {
      await notifyMentions({
        taskId,
        projectId: taskForProject.projectId,
        authorId: session.user.id,
        authorName: session.user.name,
        body: commentBody,
      });
    }

    const decrypted = {
      ...comment,
      body: decrypt(comment.bodyEnc),
    };

    return NextResponse.json(decrypted, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks/[taskId]/comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
