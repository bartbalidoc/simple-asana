import { prisma } from "./prisma";
import { AuditAction } from "@prisma/client";
import { NextRequest } from "next/server";

interface WriteAuditLogParams {
  actorId: string | null;
  action: AuditAction;
  resource: string;
  resourceId: string;
  metadata?: Record<string, any>;
  req?: NextRequest;
}

export async function writeAuditLog({
  actorId,
  action,
  resource,
  resourceId,
  metadata,
  req,
}: WriteAuditLogParams): Promise<void> {
  const ipAddress = req
    ? (req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        req.ip ||
        "unknown")
    : null;

  const userAgent = req ? req.headers.get("user-agent") || undefined : undefined;

  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        resource,
        resourceId,
        metadata,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
