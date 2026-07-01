import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

// One-time team roster seed. Call with header `x-seed-secret: <SEED_SECRET>`.
// Idempotent: existing users are left as-is except role is enforced for the admin.
const DEFAULT_PASSWORD = "Balidoc2026!";

const TEAM = [
  { name: "Sidney", email: "sidney@balidoc.com", role: "ADMIN" as const },
  { name: "Asima", email: "asima@balidoc.com", role: "MEMBER" as const },
  { name: "Adel", email: "adel@balidoc.com", role: "MEMBER" as const },
  { name: "Ani", email: "ani@balidoc.com", role: "MEMBER" as const },
  { name: "Cindy", email: "cindy@balidoc.com", role: "MEMBER" as const },
  { name: "Dr Bintang", email: "drbintang@balidoc.com", role: "MEMBER" as const },
  { name: "Dr Karina", email: "drkarina@balidoc.com", role: "MEMBER" as const },
  { name: "Dr Mona", email: "drmona@balidoc.com", role: "MEMBER" as const },
  // Admins (promoted over time — kept in sync here so a re-seed never demotes them).
  { name: "Bart", email: "bart@balidoc.com", role: "ADMIN" as const },
  { name: "Meilinda", email: "meilinda@balidoc.com", role: "ADMIN" as const },
  { name: "Gabriel", email: "gabriel@balidoc.com", role: "ADMIN" as const },
  { name: "Development", email: "development@balidoc.com", role: "ADMIN" as const },
  { name: "Fafa", email: "fafa@balidoc.com", role: "MEMBER" as const },
];

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-seed-secret");
    if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const results: string[] = [];

    for (const member of TEAM) {
      const existing = await prisma.user.findUnique({
        where: { email: member.email },
      });

      if (existing) {
        // Don't overwrite an existing password, but make sure the admin has the admin role.
        if (existing.role !== member.role) {
          await prisma.user.update({
            where: { email: member.email },
            data: { role: member.role },
          });
          results.push(`${member.email}: role updated to ${member.role}`);
        } else {
          results.push(`${member.email}: already exists (unchanged)`);
        }
      } else {
        await prisma.user.create({
          data: {
            name: member.name,
            email: member.email,
            role: member.role,
            passwordHash,
          },
        });
        results.push(`${member.email}: created (${member.role})`);
      }
    }

    return NextResponse.json({
      ok: true,
      defaultPassword: DEFAULT_PASSWORD,
      results,
    });
  } catch (error) {
    console.error("POST /api/admin/seed-users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
