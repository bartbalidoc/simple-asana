import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

// The daily Notes scratchpad — autosaved from the planner page.
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const date = typeof body?.date === "string" ? body.date : "";
    const text = typeof body?.body === "string" ? body.body : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date=YYYY-MM-DD is required" }, { status: 400 });
    }
    if (text.length > 20_000) {
      return NextResponse.json({ error: "Note is too long." }, { status: 413 });
    }

    await prisma.plannerNote.upsert({
      where: { userId_date: { userId: session.user.id, date } },
      update: { bodyEnc: encrypt(text) },
      create: { userId: session.user.id, date, bodyEnc: encrypt(text) },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/planner/note error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
