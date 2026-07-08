import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewTask } from "@/lib/authz";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: {
    taskId: string;
    commentId: string;
  };
}

const ALLOWED_EMOJI = new Set(["👍", "❤️", "😂", "🎉", "👀", "✅", "🙏", "🔥"]);

// Toggle an emoji reaction on a comment (Gabriel's request). POST adds it if
// absent, removes it if the caller already reacted with that emoji.
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId, commentId } = params;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canViewTask(taskId, session.user.id, session.user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const emoji = typeof body?.emoji === "string" ? body.emoji : "";
    if (!ALLOWED_EMOJI.has(emoji)) {
      return NextResponse.json({ error: "Unsupported emoji" }, { status: 400 });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { taskId: true },
    });
    if (!comment || comment.taskId !== taskId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const existing = await prisma.commentReaction.findUnique({
      where: {
        commentId_userId_emoji: { commentId, userId: session.user.id, emoji },
      },
    });
    if (existing) {
      await prisma.commentReaction.delete({ where: { id: existing.id } });
      return NextResponse.json({ reacted: false });
    }
    await prisma.commentReaction.create({
      data: { commentId, userId: session.user.id, emoji },
    });
    return NextResponse.json({ reacted: true });
  } catch (error) {
    console.error("POST .../reactions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
