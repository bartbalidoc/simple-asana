import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { downloadFileFromDrive } from "@/lib/drive";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: {
    taskId: string;
    attachmentId: string;
  };
}

// Serve an attachment's bytes through the app (session + project-membership
// checked) instead of linking to Google Drive. Drive files are private to the
// service account, so Drive view links show "request access" to team members;
// proxying also keeps clinic documents off public share links.
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId, attachmentId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { include: { members: { where: { userId: session.user.id } } } },
      },
    });
    if (!task?.project.members.length) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment || attachment.taskId !== taskId) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await downloadFileFromDrive(attachment.driveFileId);
    } catch (driveError) {
      console.error("Google Drive download failed:", driveError);
      return NextResponse.json(
        { error: "Could not fetch the file from storage. Try again shortly." },
        { status: 502 }
      );
    }

    await writeAuditLog({
      actorId: session.user.id,
      action: "ATTACHMENT_DOWNLOADED",
      resource: "attachment",
      resourceId: attachment.id,
      metadata: { taskId, fileName: attachment.fileName },
      req,
    });

    // "inline" lets browsers render PDFs/images in the tab; everything else
    // falls back to a download. Filename is sanitized for the header.
    const safeName = attachment.fileName.replace(/[^\w.\- ]+/g, "_");
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Length": String(fileBuffer.length),
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/tasks/[taskId]/attachments/[attachmentId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
