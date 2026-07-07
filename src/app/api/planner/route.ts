import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

// Personal Daily Dashboard (feedback: Sidney, v1.4 — gamification deferred).
// Strictly private: every query is scoped to the signed-in user; there is no
// admin view of someone else's planner.

const QUADRANTS = new Set(["PRIORITY", "TODO", "CALL"]);
const MAX_PRIORITIES = 3;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(d: string): boolean {
  return DATE_RE.test(d) && !Number.isNaN(new Date(`${d}T00:00:00`).getTime());
}

// The "midnight reset", done lazily on first load of a new day (no cron):
// items from earlier days are archived if done/dismissed, rolled over to the
// requested day otherwise. The client sends ITS local date, so the cycle
// follows the user's clock, not the server's.
async function rollover(userId: string, today: string) {
  await prisma.plannerItem.updateMany({
    where: { userId, archivedAt: null, date: { lt: today }, done: true },
    data: { archivedAt: new Date() },
  });
  await prisma.plannerItem.updateMany({
    where: { userId, archivedAt: null, date: { lt: today }, done: false },
    data: { date: today, rolledOver: true },
  });
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const date = req.nextUrl.searchParams.get("date") || "";
    if (!isValidDate(date)) {
      return NextResponse.json({ error: "date=YYYY-MM-DD is required" }, { status: 400 });
    }

    await rollover(session.user.id, date);

    const [items, note] = await Promise.all([
      prisma.plannerItem.findMany({
        where: { userId: session.user.id, date, archivedAt: null },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      }),
      prisma.plannerNote.findUnique({
        where: { userId_date: { userId: session.user.id, date } },
      }),
    ]);

    // Resolve linked board tasks (priorities) so the UI can show title + link.
    const taskIds = items.map((i) => i.taskId).filter(Boolean) as string[];
    const tasks = taskIds.length
      ? await prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, titleEnc: true, projectId: true, status: true },
        })
      : [];
    const taskById = new Map(
      tasks.map((t) => {
        let title = "a task";
        try {
          title = decrypt(t.titleEnc);
        } catch {}
        return [t.id, { id: t.id, title, projectId: t.projectId, status: t.status }];
      })
    );

    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        quadrant: i.quadrant,
        title: (() => {
          try {
            return decrypt(i.titleEnc);
          } catch {
            return "(unavailable)";
          }
        })(),
        done: i.done,
        rolledOver: i.rolledOver,
        order: i.order,
        task: i.taskId ? taskById.get(i.taskId) || null : null,
      })),
      note: note
        ? (() => {
            try {
              return decrypt(note.bodyEnc);
            } catch {
              return "";
            }
          })()
        : "",
    });
  } catch (error) {
    console.error("GET /api/planner error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const quadrant = typeof body?.quadrant === "string" ? body.quadrant : "";
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const date = typeof body?.date === "string" ? body.date : "";
    const taskId = typeof body?.taskId === "string" && body.taskId ? body.taskId : null;

    if (!QUADRANTS.has(quadrant) || !title || !isValidDate(date)) {
      return NextResponse.json(
        { error: "quadrant (PRIORITY/TODO/CALL), title and date are required" },
        { status: 400 }
      );
    }
    if (title.length > 500) {
      return NextResponse.json({ error: "Keep items under 500 characters." }, { status: 400 });
    }

    // Priorities are capped so the day stays focused (per the request: max 3).
    if (quadrant === "PRIORITY") {
      const count = await prisma.plannerItem.count({
        where: { userId: session.user.id, date, quadrant: "PRIORITY", archivedAt: null },
      });
      if (count >= MAX_PRIORITIES) {
        return NextResponse.json(
          { error: `Max ${MAX_PRIORITIES} priorities per day — finish or dismiss one first.` },
          { status: 409 }
        );
      }
    }

    const last = await prisma.plannerItem.findFirst({
      where: { userId: session.user.id, date, quadrant, archivedAt: null },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const item = await prisma.plannerItem.create({
      data: {
        userId: session.user.id,
        quadrant,
        titleEnc: encrypt(title),
        taskId,
        date,
        order: (last?.order ?? 0) + 1,
      },
    });

    return NextResponse.json({ id: item.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/planner error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const data: any = {};
    if (typeof body.done === "boolean") {
      data.done = body.done;
      data.doneAt = body.done ? new Date() : null;
    }
    if (typeof body.title === "string" && body.title.trim()) {
      data.titleEnc = encrypt(body.title.trim().slice(0, 500));
    }
    if (body.dismissed === true) {
      // "No longer relevant" — clears it from the board without marking done.
      data.dismissed = true;
      data.archivedAt = new Date();
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    // updateMany + userId scope: you can only ever touch your own items.
    const res = await prisma.plannerItem.updateMany({
      where: { id, userId: session.user.id },
      data,
    });
    if (res.count === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/planner error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const id = req.nextUrl.searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await prisma.plannerItem.deleteMany({ where: { id, userId: session.user.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/planner error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
