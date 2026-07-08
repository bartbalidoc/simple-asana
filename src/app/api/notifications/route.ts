import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

// The signed-in user's in-app notifications (newest first) + unread count.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({
        where: { userId: session.user.id, readAt: null },
      }),
    ]);

    return NextResponse.json({
      unread,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        actorName: n.actorName,
        message: (() => {
          try {
            return decrypt(n.messageEnc);
          } catch {
            return "(unavailable)";
          }
        })(),
        taskId: n.taskId,
        projectId: n.projectId,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Mark one notification ({ id }) or everything ({ all: true }) as read.
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (body?.all === true) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id or all:true is required" }, { status: 400 });
    }
    // Scoped to the caller — you can only mark your own notifications.
    await prisma.notification.updateMany({
      where: { id, userId: session.user.id },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Dismiss one notification ({ id }) or clear the whole list ({ all: true }).
// Deletes, not just marks read — feedback: "clean up without clicking one by one".
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.all === true) {
      await prisma.notification.deleteMany({
        where: { userId: session.user.id },
      });
      return NextResponse.json({ ok: true });
    }

    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id or all:true is required" }, { status: 400 });
    }
    // Scoped to the caller — you can only clear your own notifications.
    await prisma.notification.deleteMany({
      where: { id, userId: session.user.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
