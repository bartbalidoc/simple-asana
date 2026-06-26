import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { encrypt, decrypt } from "@/lib/encryption";
import { sendMail, emailEnabled } from "@/lib/email";
import { findMentionedMembers } from "@/lib/mentions";
import { NextRequest, NextResponse } from "next/server";

// Email anyone @mentioned in a new comment (best-effort; never blocks/breaks
// the comment if email is unconfigured or fails). Not PHI-hardened.
async function notifyMentions(args: {
  taskId: string;
  commentBody: string;
  authorId: string;
  authorName: string;
}) {
  try {
    if (!emailEnabled()) return;
    const task = await prisma.task.findUnique({
      where: { id: args.taskId },
      select: { projectId: true, titleEnc: true },
    });
    if (!task) return;

    const members = await prisma.projectMember.findMany({
      where: { projectId: task.projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const mentioned = findMentionedMembers(
      args.commentBody,
      members.map((m) => m.user)
    ).filter((u) => u.id !== args.authorId && u.email);

    if (mentioned.length === 0) return;

    const taskTitle = (() => {
      try {
        return decrypt(task.titleEnc);
      } catch {
        return "a task";
      }
    })();
    const base = process.env.NEXTAUTH_URL || "";
    const link = `${base}/projects/${task.projectId}?task=${args.taskId}`;
    const snippet =
      args.commentBody.length > 400
        ? args.commentBody.slice(0, 400) + "…"
        : args.commentBody;

    await Promise.allSettled(
      mentioned.map((u) =>
        sendMail({
          to: u.email as string,
          subject: `${args.authorName} mentioned you on "${taskTitle}"`,
          text: `${args.authorName} mentioned you in a comment on "${taskTitle}":\n\n"${snippet}"\n\nOpen the task:\n${link}\n\n— BaliDoc`,
          html: `<p><strong>${args.authorName}</strong> mentioned you in a comment on <strong>${taskTitle}</strong>:</p>
<blockquote style="border-left:3px solid #e11d48;margin:0;padding:6px 12px;color:#374151">${snippet
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/\n/g, "<br>")}</blockquote>
<p><a href="${link}" style="color:#e11d48">Open the task →</a></p>
<p style="color:#9ca3af;font-size:12px">— BaliDoc</p>`,
        })
      )
    );
  } catch (err) {
    console.error("notifyMentions error:", err);
  }
}

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

    // Email anyone @mentioned (best-effort; doesn't block on failure).
    await notifyMentions({
      taskId,
      commentBody,
      authorId: session.user.id,
      authorName: comment.author?.name || session.user.name || "Someone",
    });

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
