import { runDueRecurrences } from "@/lib/recurrence";
import { NextRequest, NextResponse } from "next/server";

// GET/POST /api/cron/recurring — spawn every recurring task whose next copy is
// due. Guarded by the shared seed secret (header `x-seed-secret` or `?secret=`).
// Called hourly by the droplet cron as a backstop; the same work also runs
// lazily on dashboard/notification traffic, and both paths are race-safe.
async function handle(req: NextRequest) {
  const secret =
    req.headers.get("x-seed-secret") ||
    req.nextUrl.searchParams.get("secret") ||
    "";
  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const spawned = await runDueRecurrences(100);
  return NextResponse.json({ ok: true, spawned });
}

export const GET = handle;
export const POST = handle;
