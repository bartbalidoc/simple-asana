import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";

// One-time bulk importer for Asana content into a hidden, admin-only "Staging"
// area. Guarded by `x-seed-secret: <SEED_SECRET>` (same secret as seed-users).
//
// Idempotent: projects/tasks/comments are keyed by their Asana GID (`asanaId`),
// so a payload can be re-sent safely and a large project can be POSTed in
// several chunks (same project asanaId, a subset of tasks each time).
//
// Payload shape:
// {
//   adminEmail?: "sidney@balidoc.com",   // owner/createdBy + comment-author fallback
//   project: {
//     asanaId, name, description?,
//     tasks: [ TaskNode, ... ]
//   }
// }
// TaskNode = {
//   asanaId, title, description?, completed?,
//   assigneeEmail?, assigneeName?, dueDate?, priority?,
//   comments?: [{ asanaId, authorEmail?, authorName?, body, createdAt? }],
//   subtasks?: [ TaskNode, ... ]
// }

const STATUS_TO_COLUMN: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

type CommentNode = {
  asanaId?: string;
  authorEmail?: string;
  authorName?: string;
  body: string;
  createdAt?: string;
};

type TaskNode = {
  asanaId: string;
  title: string;
  description?: string | null;
  completed?: boolean;
  status?: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  assigneeEmail?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  comments?: CommentNode[];
  subtasks?: TaskNode[];
};

const VALID_STATUS = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

// Cache email -> userId lookups across the whole import call.
async function makeUserResolver() {
  const cache = new Map<string, string | null>();
  return async (email?: string | null): Promise<string | null> => {
    if (!email) return null;
    const key = email.toLowerCase().trim();
    if (cache.has(key)) return cache.get(key)!;
    const user = await prisma.user.findUnique({ where: { email: key } });
    const id = user?.id ?? null;
    cache.set(key, id);
    return id;
  };
}

async function importTaskNode(
  node: TaskNode,
  ctx: {
    projectId: string;
    columnsByName: Map<string, string>;
    parentTaskId: string | null;
    adminId: string;
    resolveUser: (email?: string | null) => Promise<string | null>;
    order: number;
    counts: { tasks: number; comments: number };
  }
): Promise<void> {
  // Explicit status (e.g. derived from the Asana section) wins; otherwise
  // completed → DONE, else TODO.
  const status = node.completed
    ? "DONE"
    : node.status && VALID_STATUS.includes(node.status)
    ? node.status
    : "TODO";
  const columnId = ctx.columnsByName.get(STATUS_TO_COLUMN[status]) ?? null;
  const assigneeId = await ctx.resolveUser(node.assigneeEmail);
  const originalAssignee =
    node.assigneeName || node.assigneeEmail || null;
  const dueDate = node.dueDate ? new Date(node.dueDate) : null;
  const priority = node.priority ?? "MEDIUM";

  const titleEnc = encrypt(node.title || "(untitled)");
  const descriptionEnc =
    node.description && node.description.trim()
      ? encrypt(node.description)
      : null;

  const commonData = {
    titleEnc,
    descriptionEnc,
    status: status as "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE",
    completedAt: status === "DONE" ? new Date() : null,
    priority: priority as "LOW" | "MEDIUM" | "HIGH",
    dueDate,
    order: ctx.order,
    projectId: ctx.projectId,
    columnId,
    assigneeId,
    originalAssignee,
    parentTaskId: ctx.parentTaskId,
  };

  const task = await prisma.task.upsert({
    where: { asanaId: node.asanaId },
    create: {
      ...commonData,
      asanaId: node.asanaId,
      createdById: ctx.adminId,
    },
    // Re-import refreshes content but never resets distribution bookkeeping.
    update: commonData,
  });
  ctx.counts.tasks++;

  // Comments
  for (const c of node.comments ?? []) {
    if (!c.body) continue;
    const resolvedAuthor = await ctx.resolveUser(c.authorEmail);
    const authorId = resolvedAuthor ?? ctx.adminId;
    // If the original author isn't a Simple Asana user, keep attribution in the body.
    const bodyText =
      resolvedAuthor || !c.authorName
        ? c.body
        : `(originally by ${c.authorName}) ${c.body}`;
    const bodyEnc = encrypt(bodyText);
    const createdAt = c.createdAt ? new Date(c.createdAt) : undefined;

    if (c.asanaId) {
      await prisma.comment.upsert({
        where: { asanaId: c.asanaId },
        create: {
          asanaId: c.asanaId,
          bodyEnc,
          taskId: task.id,
          authorId,
          ...(createdAt ? { createdAt } : {}),
        },
        update: { bodyEnc },
      });
    } else {
      await prisma.comment.create({
        data: {
          bodyEnc,
          taskId: task.id,
          authorId,
          ...(createdAt ? { createdAt } : {}),
        },
      });
    }
    ctx.counts.comments++;
  }

  // Subtasks (recursive — supports nesting)
  let i = 0;
  for (const sub of node.subtasks ?? []) {
    await importTaskNode(sub, {
      ...ctx,
      parentTaskId: task.id,
      order: i++,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-seed-secret");
    if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const project = body?.project as
      | { asanaId: string; name: string; description?: string; tasks: TaskNode[] }
      | undefined;

    if (!project?.asanaId || !project?.name) {
      return NextResponse.json(
        { error: "project.asanaId and project.name are required" },
        { status: 400 }
      );
    }

    const adminEmail = (body?.adminEmail || "sidney@balidoc.com").toLowerCase();
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
      return NextResponse.json(
        { error: `Admin user ${adminEmail} not found (run the user seed first)` },
        { status: 400 }
      );
    }

    // Upsert the hidden staging project (idempotent by Asana GID).
    const existing = await prisma.project.findUnique({
      where: { asanaId: project.asanaId },
      include: { columns: true },
    });

    let projectId: string;
    let columns: { id: string; name: string }[];

    if (existing) {
      projectId = existing.id;
      columns = existing.columns;
      await prisma.project.update({
        where: { id: existing.id },
        data: { name: project.name, isStaging: true },
      });
      // Ensure the admin is a member (idempotent).
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: admin.id } },
        update: {},
        create: { projectId, userId: admin.id },
      });
    } else {
      const created = await prisma.project.create({
        data: {
          name: project.name,
          description: project.description || null,
          asanaId: project.asanaId,
          isStaging: true,
          members: { create: { userId: admin.id } },
          columns: {
            createMany: {
              data: [
                { name: "To Do", order: 0 },
                { name: "In Progress", order: 1 },
                { name: "In Review", order: 2 },
                { name: "Done", order: 3 },
              ],
            },
          },
        },
        include: { columns: true },
      });
      projectId = created.id;
      columns = created.columns;
    }

    const columnsByName = new Map(columns.map((c) => [c.name, c.id]));
    const resolveUser = await makeUserResolver();
    const counts = { tasks: 0, comments: 0 };

    let i = 0;
    for (const node of project.tasks ?? []) {
      await importTaskNode(node, {
        projectId,
        columnsByName,
        parentTaskId: null,
        adminId: admin.id,
        resolveUser,
        order: i++,
        counts,
      });
    }

    return NextResponse.json({
      ok: true,
      projectId,
      project: project.name,
      imported: counts,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("POST /api/admin/import error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
