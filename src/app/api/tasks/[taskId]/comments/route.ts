import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { encrypt, decrypt } from "@/lib/encryption";
import { sendMail, emailEnabled } from "@/lib/email";
import { findMentionedMembers } from "@/lib/mentions";
import { createNotifications, notifyTaskCollaborators } from "@/lib/notifications";
import { canViewTask } from "@/lib/authz";
import { NextRequest, NextResponse } from "next/server";

// Notify anyone @mentioned in a new comment — in-app always, email when
// configured. Mentioning someone who is NOT on the project makes them a task
// GUEST (feedback: "tag people that are not in the project"): they get access
// to this one task only, audit-logged. Best-effort; never blocks/breaks the
// comment. Returns the mentioned user ids so the broadcast can skip them.
async function notifyMentions(args: {
  taskId: string;
  commentBody: string;
  authorId: string;
  authorName: string;
}): Promise<string[]> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: args.taskId },
      select: { projectId: true, titleEnc: true, parentTaskId: true },
    });
    if (!task) return [];

    // Match against the whole active team, not just project members.
    const team = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
    });
    const memberRows = await prisma.projectMember.findMany({
      where: { projectId: task.projectId },
      select: { userId: true },
    });
    const memberIds = new Set(memberRows.map((m) => m.userId));

    const mentioned = findMentionedMembers(args.commentBody, team).filter(
      (u) => u.id !== args.authorId && u.email
    );

    if (mentioned.length === 0) return [];

    const taskTitle = (() => {
      try {
        return decrypt(task.titleEnc);
      } catch {
        return "a task";
      }
    })();

    // Non-members become guests of this task (anchored on the parent so a
    // subtask mention also opens the panel they'll land on).
    const anchorTaskId = task.parentTaskId || args.taskId;
    const outsiders = mentioned.filter((u) => !memberIds.has(u.id));
    for (const u of outsiders) {
      await prisma.taskGuest.upsert({
        where: { taskId_userId: { taskId: anchorTaskId, userId: u.id } },
        update: {},
        create: { taskId: anchorTaskId, userId: u.id, addedById: args.authorId },
      });
      await writeAuditLog({
        actorId: args.authorId,
        action: "TASK_UPDATED",
        resource: "task",
        resourceId: anchorTaskId,
        metadata: { guestAdded: u.id, via: "mention" },
      });
    }

    // In-app notification, deep-linked to the task (parent when a subtask).
    await createNotifications({
      recipientIds: mentioned.map((u) => u.id),
      actorName: args.authorName,
      type: "MENTION",
      message: `${args.authorName} mentioned you on "${taskTitle}"`,
      taskId: anchorTaskId,
      projectId: task.projectId,
    });

    if (!emailEnabled()) return mentioned.map((u) => u.id);

    const base = process.env.NEXTAUTH_URL || "";
    const link = `${base}/projects/${task.projectId}?task=${args.taskId}`;
    const snippet =
      args.commentBody.length > 400
        ? args.commentBody.slice(0, 400) + "…"
        : args.commentBody;
    // Escape EVERYTHING interpolated into the HTML body — a task titled
    // "<img onerror=…>" must not execute in a teammate's inbox.
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    await Promise.allSettled(
      mentioned.map((u) =>
        sendMail({
          to: u.email as string,
          subject: `${args.authorName} mentioned you on "${taskTitle}"`,
          text: `${args.authorName} mentioned you in a comment on "${taskTitle}":\n\n"${snippet}"\n\nOpen the task:\n${link}\n\n— BaliDoc`,
          html: `<p><strong>${esc(args.authorName)}</strong> mentioned you in a comment on <strong>${esc(taskTitle)}</strong>:</p>
<blockquote style="border-left:3px solid #e11d48;margin:0;padding:6px 12px;color:#374151">${esc(snippet).replace(/\n/g, "<br>")}</blockquote>
<p><a href="${link}" style="color:#e11d48">Open the task →</a></p>
<p style="color:#9ca3af;font-size:12px">— BaliDoc</p>`,
        })
      )
    );
    return mentioned.map((u) => u.id);
  } catch (err) {
    console.error("notifyMentions error:", err);
    return [];
  }
}

interface RouteParams {
  params: {
    taskId: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await canViewTask(taskId, session.user.id, session.user.role);

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        // Slim select — a full author row would leak passwordHash to the client.
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        reactions: true,
        attachments: true,
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

    const hasAccess = await canViewTask(taskId, session.user.id, session.user.role);

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
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        task: { select: { titleEnc: true } },
      },
    });

    // Link files uploaded from the comment box (v1.5). Scoped to this task and
    // the caller's own not-yet-linked uploads — ids from other tasks are ignored.
    const attachmentIds: string[] = Array.isArray(body.attachmentIds)
      ? body.attachmentIds.filter((x: any) => typeof x === "string").slice(0, 10)
      : [];
    if (attachmentIds.length > 0) {
      await prisma.attachment.updateMany({
        where: {
          id: { in: attachmentIds },
          taskId,
          commentId: null,
          uploadedById: session.user.id,
        },
        data: { commentId: comment.id },
      });
    }

    await writeAuditLog({
      actorId: session.user.id,
      action: "COMMENT_CREATED",
      resource: "comment",
      resourceId: comment.id,
      metadata: { taskId },
      req,
    });

    // Notify @mentions (in-app + email), then broadcast the comment to everyone
    // involved in the task — assignees, subtask assignees, creator — minus the
    // author and anyone already notified via mention. Best-effort.
    const authorName = comment.author?.name || session.user.name || "Someone";
    const mentionedIds = await notifyMentions({
      taskId,
      commentBody,
      authorId: session.user.id,
      authorName,
    });
    const taskTitle = (() => {
      try {
        return comment.task?.titleEnc ? decrypt(comment.task.titleEnc) : "";
      } catch {
        return "";
      }
    })();
    await notifyTaskCollaborators({
      taskId,
      actorId: session.user.id,
      actorName: authorName,
      type: "COMMENT",
      message: `${authorName} commented on ${taskTitle ? `"${taskTitle}"` : "a task you're on"}`,
      skip: mentionedIds,
    });

    const { task: _task, ...commentRest } = comment;
    const decrypted = {
      ...commentRest,
      body: decrypt(comment.bodyEnc),
    };

    return NextResponse.json(decrypted, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks/[taskId]/comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
