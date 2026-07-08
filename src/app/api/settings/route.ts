import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Small key-value app settings (e.g. Welcome Hub card links). Readable by any
// signed-in user; writable by admins. Keys are namespaced ("welcome.*") and
// values are plain strings — never store secrets here.
const ALLOWED_PREFIXES = ["welcome."];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const prefix = req.nextUrl.searchParams.get("prefix") || "";
    if (!ALLOWED_PREFIXES.includes(prefix)) {
      return NextResponse.json({ error: "Unknown settings prefix" }, { status: 400 });
    }
    const rows = await prisma.appSetting.findMany({
      where: { key: { startsWith: prefix } },
    });
    return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admins only" }, { status: 403 });
    }
    const body = await req.json();
    const key = typeof body?.key === "string" ? body.key : "";
    const value = typeof body?.value === "string" ? body.value.slice(0, 2000) : "";
    if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
      return NextResponse.json({ error: "Unknown settings key" }, { status: 400 });
    }
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
