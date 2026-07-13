import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { canEditTask } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import { anthropicEnabled, summarizeTaskForArchive, type ArchiveSummary } from "@/lib/anthropic";
import {
  findOrCreateFolder,
  createGoogleDocFromHtml,
  moveFileToFolder,
  getFolderLink,
} from "@/lib/drive";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: { taskId: string };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : "—";

// POST /api/tasks/[taskId]/archive — "Summarize & archive to Drive" (v1.10).
// For a DONE task: Claude writes a summary, a Google Doc with the full task
// record (description, subtasks, comment transcript) is created in
// Task Archive/<Project>/<Task> inside the shared Drive folder, and the task's
// files are moved into that folder. The task itself stays in the app (marked
// archived) so nothing breaks — deleting it later is a human decision.
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const hasAccess = await canEditTask(taskId, session.user.id, session.user.role);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
      return NextResponse.json(
        { error: "Drive is not configured on this server." },
        { status: 503 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { name: true } },
        assignee: { select: { name: true, email: true } },
        createdBy: { select: { name: true } },
        subtasks: {
          orderBy: { order: "asc" },
          include: { attachments: true },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        },
        attachments: true,
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (task.parentTaskId) {
      return NextResponse.json(
        { error: "Archive the parent task — subtasks are included in its document." },
        { status: 400 }
      );
    }
    if (task.status !== "DONE") {
      return NextResponse.json(
        { error: "Only tasks marked Done can be archived." },
        { status: 400 }
      );
    }
    // Idempotent: already archived → hand back the existing document.
    if (task.archivedAt && task.archiveUrl) {
      return NextResponse.json({
        archiveUrl: task.archiveUrl,
        alreadyArchived: true,
      });
    }

    // ---- Decrypt everything the document needs -------------------------
    const title = decrypt(task.titleEnc);
    const description = task.descriptionEnc ? decrypt(task.descriptionEnc) : "";
    const subtasks = task.subtasks.map((st) => ({
      title: decrypt(st.titleEnc),
      status: st.status,
      attachments: st.attachments,
    }));
    const comments = task.comments.map((c) => ({
      author: c.author?.name || "Unknown",
      date: c.createdAt,
      body: c.bodyEnc ? decrypt(c.bodyEnc) : "",
    }));
    const allFiles = [
      ...task.attachments,
      ...task.subtasks.flatMap((st) => st.attachments),
    ];

    // ---- AI summary (best effort — archive still proceeds without it) --
    let ai: ArchiveSummary | null = null;
    if (anthropicEnabled()) {
      const dump = [
        `TITLE: ${title}`,
        `PROJECT: ${task.project?.name || ""}`,
        `ASSIGNEE: ${task.assignee?.name || "Unassigned"}`,
        `CREATED: ${fmtDate(task.createdAt)}  COMPLETED: ${fmtDate(task.completedAt || task.updatedAt)}`,
        description && `DESCRIPTION:\n${description}`,
        subtasks.length &&
          `SUBTASKS:\n${subtasks.map((s) => `- [${s.status === "DONE" ? "x" : " "}] ${s.title}`).join("\n")}`,
        comments.length &&
          `COMMENTS:\n${comments
            .map((c) => `${c.author} (${fmtDate(c.date)}): ${c.body}`)
            .join("\n")}`,
        allFiles.length && `FILES: ${allFiles.map((f) => f.fileName).join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      try {
        ai = await summarizeTaskForArchive(dump);
      } catch (err) {
        console.error("Archive summary failed (continuing without):", err);
      }
    }

    // ---- Drive: Task Archive/<Project>/<Task title> ---------------------
    const root = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const archiveRoot = await findOrCreateFolder("Task Archive", root);
    const projectFolder = await findOrCreateFolder(
      task.project?.name || "No project",
      archiveRoot
    );
    const taskFolder = await findOrCreateFolder(
      `${title.slice(0, 90)} (${fmtDate(task.completedAt || task.updatedAt)})`,
      projectFolder
    );

    // ---- The archive document -------------------------------------------
    const html = `
<h1>${esc(title)}</h1>
<p><i>Archived from Plendex (BaliDoc) on ${fmtDate(new Date())}</i></p>
<table border="1" cellpadding="4">
  <tr><td><b>Project</b></td><td>${esc(task.project?.name || "—")}</td></tr>
  <tr><td><b>Assigned to</b></td><td>${esc(task.assignee?.name || "Unassigned")}</td></tr>
  <tr><td><b>Created by</b></td><td>${esc(task.createdBy?.name || "—")} on ${fmtDate(task.createdAt)}</td></tr>
  <tr><td><b>Completed</b></td><td>${fmtDate(task.completedAt || task.updatedAt)}</td></tr>
  <tr><td><b>Priority</b></td><td>${esc(task.priority)}</td></tr>
</table>
${
  ai
    ? `<h2>Summary</h2><p>${esc(ai.summary)}</p><p><b>Outcome:</b> ${esc(ai.outcome)}</p>${
        ai.keyPoints.length
          ? `<h3>Key points</h3><ul>${ai.keyPoints.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>`
          : ""
      }`
    : ""
}
${description ? `<h2>Description</h2><p>${esc(description).replace(/\n/g, "<br>")}</p>` : ""}
${
  subtasks.length
    ? `<h2>Subtasks (${subtasks.filter((s) => s.status === "DONE").length}/${subtasks.length} done)</h2><ul>${subtasks
        .map((s) => `<li>${s.status === "DONE" ? "✅" : "⬜"} ${esc(s.title)}</li>`)
        .join("")}</ul>`
    : ""
}
${
  comments.length
    ? `<h2>Comments (${comments.length})</h2>${comments
        .map(
          (c) =>
            `<p><b>${esc(c.author)}</b> — ${fmtDate(c.date)}<br>${esc(c.body).replace(/\n/g, "<br>")}</p>`
        )
        .join("")}`
    : ""
}
${
  allFiles.length
    ? `<h2>Files (${allFiles.length})</h2><p>Stored in this same Drive folder:</p><ul>${allFiles
        .map((f) => `<li>${esc(f.fileName)} (${Math.round(f.sizeBytes / 1024)} KB)</li>`)
        .join("")}</ul>`
    : ""
}
<p><i>Full record preserved from task ${esc(taskId)}.</i></p>`;

    const doc = await createGoogleDocFromHtml(`${title.slice(0, 150)} — archive`, html, taskFolder);

    // ---- Move the task's files into the archive folder ------------------
    let movedFiles = 0;
    for (const f of allFiles) {
      try {
        await moveFileToFolder(f.driveFileId, taskFolder);
        movedFiles++;
      } catch (err) {
        console.error(`Archive: could not move file ${f.fileName}:`, err);
      }
    }

    const folderUrl = await getFolderLink(taskFolder).catch(
      () => `https://drive.google.com/drive/folders/${taskFolder}`
    );

    await prisma.task.update({
      where: { id: taskId },
      data: { archivedAt: new Date(), archiveUrl: doc.webViewLink },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "TASK_ARCHIVED",
      resource: "task",
      resourceId: taskId,
      req,
    });

    return NextResponse.json({
      archiveUrl: doc.webViewLink,
      folderUrl,
      movedFiles,
      totalFiles: allFiles.length,
      summaryIncluded: !!ai,
    });
  } catch (error) {
    console.error("POST /api/tasks/[taskId]/archive error:", error);
    return NextResponse.json(
      { error: "Couldn't archive this task. Check the server logs." },
      { status: 500 }
    );
  }
}
