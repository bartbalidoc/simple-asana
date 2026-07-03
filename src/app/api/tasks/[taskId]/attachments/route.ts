import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { uploadFileToDrive, deleteFileFromDrive } from "@/lib/drive";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: {
    taskId: string;
  };
}

async function checkTaskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  return !!task?.project.members.length;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await checkTaskAccess(taskId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json(attachments);
  } catch (error) {
    console.error("GET /api/tasks/[taskId]/attachments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await checkTaskAccess(taskId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let fileId: string, webViewLink: string;

    try {
      const result = await uploadFileToDrive(file.name, buffer, file.type);
      fileId = result.fileId;
      webViewLink = result.webViewLink;
    } catch (driveError: any) {
      console.error("Google Drive upload failed:", driveError);
      const message =
        driveError.message?.includes("GOOGLE_SERVICE_ACCOUNT_KEY_B64") ||
        driveError.message?.includes("credentials")
          ? "File uploads are not configured. Please contact your administrator."
          : "Failed to upload file to Google Drive";
      return NextResponse.json({ error: message }, { status: 503 });
    }

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.name,
        mimeType: file.type,
        driveFileId: fileId,
        driveViewUrl: webViewLink,
        sizeBytes: buffer.length,
        taskId,
        uploadedById: session.user.id,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "ATTACHMENT_UPLOADED",
      resource: "attachment",
      resourceId: attachment.id,
      metadata: { taskId, fileName: file.name },
      req,
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks/[taskId]/attachments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { taskId } = params;
    const { searchParams } = new URL(req.url);
    const attachmentId = searchParams.get("attachmentId");

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!attachmentId) {
      return NextResponse.json({ error: "attachmentId is required" }, { status: 400 });
    }

    const hasAccess = await checkTaskAccess(taskId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    // Must belong to THIS task — otherwise membership in any one project lets
    // you delete attachments from any other project's tasks.
    if (!attachment || attachment.taskId !== taskId) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    try {
      await deleteFileFromDrive(attachment.driveFileId);
    } catch (driveError) {
      console.error("Google Drive delete error:", driveError);
    }

    const deleted = await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "ATTACHMENT_DELETED",
      resource: "attachment",
      resourceId: attachmentId,
      metadata: { taskId },
      req,
    });

    return NextResponse.json(deleted);
  } catch (error) {
    console.error("DELETE /api/tasks/[taskId]/attachments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
