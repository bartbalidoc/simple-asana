import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

// Asana-migration repair (Sidney's report): the original import payload had no
// descriptions, so all imported tasks — and the copies distributed onto real
// boards — are blank inside.
//
// Repair flow:
//   1. Re-export from Asana WITH descriptions and re-POST to /api/admin/import
//      (idempotent by asanaId — staging tasks get their descriptionEnc filled).
//   2. POST here (admin session). For every staged task that now has a
//      description, fill matching real-board tasks that still have none:
//        pass A — identical titleEnc ciphertext (distribute clones the exact
//                 bytes, so untouched copies match perfectly);
//        pass B — unique plaintext-title match (copies whose title was edited
//                 and re-encrypted; only applied when exactly one candidate).
//   3. `{"dryRun": true}` (default!) reports what WOULD change; send
//      `{"dryRun": false}` to write.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admins only" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false;

    // Sources: imported tasks that HAVE a description.
    const sources = await prisma.task.findMany({
      where: { asanaId: { not: null }, descriptionEnc: { not: null } },
      select: { id: true, titleEnc: true, descriptionEnc: true },
    });
    if (sources.length === 0) {
      return NextResponse.json({
        dryRun,
        message:
          "No imported tasks have descriptions yet. First re-run the Asana export WITH descriptions and re-POST it to /api/admin/import, then call this again.",
        passA: 0,
        passB: 0,
      });
    }

    // Targets: description-less tasks on real (non-staging) boards.
    const targets = await prisma.task.findMany({
      where: {
        descriptionEnc: null,
        asanaId: null,
        project: { isStaging: false },
      },
      select: { id: true, titleEnc: true },
    });

    const bySourceCipher = new Map(sources.map((s) => [s.titleEnc, s]));
    let passA = 0;
    const unmatched: typeof targets = [];
    const updates: { id: string; descriptionEnc: string }[] = [];

    for (const t of targets) {
      const src = bySourceCipher.get(t.titleEnc);
      if (src?.descriptionEnc) {
        updates.push({ id: t.id, descriptionEnc: src.descriptionEnc });
        passA++;
      } else {
        unmatched.push(t);
      }
    }

    // Pass B: plaintext title match, only when the title maps to exactly one source.
    const titleCount = new Map<string, number>();
    const byPlainTitle = new Map<string, (typeof sources)[number]>();
    for (const s of sources) {
      try {
        const title = decrypt(s.titleEnc).trim().toLowerCase();
        titleCount.set(title, (titleCount.get(title) || 0) + 1);
        byPlainTitle.set(title, s);
      } catch {}
    }
    let passB = 0;
    for (const t of unmatched) {
      try {
        const title = decrypt(t.titleEnc).trim().toLowerCase();
        if (titleCount.get(title) === 1) {
          const src = byPlainTitle.get(title);
          if (src?.descriptionEnc) {
            updates.push({ id: t.id, descriptionEnc: src.descriptionEnc });
            passB++;
          }
        }
      } catch {}
    }

    if (!dryRun) {
      for (const u of updates) {
        await prisma.task.update({
          where: { id: u.id },
          data: { descriptionEnc: u.descriptionEnc },
        });
      }
    }

    return NextResponse.json({
      dryRun,
      sourcesWithDescriptions: sources.length,
      blankTargets: targets.length,
      passA,
      passB,
      totalRepaired: dryRun ? 0 : updates.length,
      wouldRepair: dryRun ? updates.length : undefined,
    });
  } catch (error) {
    console.error("POST /api/admin/import/repair-descriptions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
